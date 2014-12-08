'use strict';

/**
 * @file Hydrate the file from scratch.
 * Download it from AnyFetch, save it to local storage, run the hydrater function and return the result.
 *
 * This helper is used in the server queue.
 */

var async = require('async');
var request = require('supertest');
var url = require('url');
var rarity = require('rarity');
var util = require('util');

var lib = require('../index.js');
var log = lib.log;
var HydrationError = lib.HydrationError;
var logError = require('../utils').logError;


module.exports = function(hydraterFunction, childs, opbeatConfig) {
  /**
   * Handle a hydration task:
   * - Download the file
   * - Call the user-provided `hydraterFunction`
   * - Patch the document to apply the changes against the AnyFetch API
   * - Cleanup
   *
   * @param {Object} task Task object, keys must be `file_path` (file URL) and `callback` (URL)
   * @param {Function} done(err)
   */
  return function(job, done) {
    var task = job.data;
    var loggingTask = {file_path: task.file_path, callback: task.callback, document: {id: task.document.id, identifier: task.document.identifier}};

    log.info(loggingTask, "Starting task");

    async.waterfall([
      function performHydration(cb) {
        var child = childs.getOrForkChild();
        var stderr = "";
        var stdout = "";
        var timeout;
        /**
         * Function to call, either on domain error, on hydration error or successful hydration.
         * Will clean the fs and dispose the domain for better performance.
         */
        var cleaner = function(err, changes) {
          if(!cleaner.called) {
            cleaner.called = true;
            if(err) {
              var extra = JSON.parse(JSON.stringify(task));
              extra.changes = changes;
              extra.stdout = stdout;
              extra.stderr = stderr;

              logError(err, extra);
              child.reset();
            }
            else {
              child.available = true;
            }
            cb(err, changes);
          }
          if(stdout !== "") {
            loggingTask.std = "out";
            log.info(loggingTask, stdout);
          }
          if(stderr !== "") {
            loggingTask.std = "err";
            log.info(loggingTask, stderr);
          }
          clearTimeout(timeout);
        };
        cleaner.called = false;

        child.process.on('error', function(exitCode) {
          cleaner(new HydrationError("Wild error appeared while spawning child. Exit code:" + exitCode));
        });

        child.process.stderr.on('readable', function() {
          var chunk;
          while ((chunk = child.process.stderr.read()) !== null) {
            stderr += chunk;
          }
        });

        child.process.stdout.on('readable', function() {
          var chunk;
          while ((chunk = child.process.stdout.read()) !== null) {
            stdout += chunk;
          }
        });

        child.process.on('exit', function(errCode) {
          if(errCode === 143) {
            // The child process exited normally after we sent him a SIGTERM. The output will be catch in the timeout, not here.
            return;
          }
          if(errCode !== 0) {
            cleaner(new HydrationError("Child exiting with err code: " + errCode + stdout + stderr));
          }
        });

        // Build objects to send to child
        var options = {};
        options.urlCallback = task.callback;
        options.apiUrl = '';
        if(task.callback) {
          var parsed = url.parse(task.callback);
          options.apiUrl = parsed.protocol + "//" + parsed.host;
        }

        child.process.send({
          functionPath: hydraterFunction,
          priority: task.priority,
          file_path: task.file_path,
          document: task.document,
          changes: lib.defaultChanges(),
          options: options,
          opbeatConfig: opbeatConfig
        });

        child.process.on('message', function(res) {
          var err = res.err;
          // If the function replied with an "HydrationError", we'll wrap this in a nicely formatted document
          // and stop the error from bubbling up.
          if(err && err._hydrationError) {
            res.changes = {};
            res.changes.hydration_errored = true;
            res.changes.hydration_error = err.message;
            err = null;
          }
          cleaner(err, res.changes);
        });

        timeout = setTimeout(function() {
          if(!cleaner.called) {
            var changes = {};
            changes.hydration_errored = true;
            changes.hydration_error = "Task took too long.";
            log.warn(loggingTask, 'Killing task');
            child.process.kill('SIGTERM');
            setTimeout(function() {
              if(child.process.connected) {
                child.reset();
              }
              cleaner(null, changes);
            }, process.env.TIMEOUT / 6 || 10 * 1000);
          }
        }, process.env.TIMEOUT || 60 * 1000);
      },
      function cleanChanges(changes, cb) {
        // Removing empty changes to patch only effective changes
        var isEmpty = function(elem) {
          if(util.isArray(elem)) {
            return (elem.length === 0);
          }
          if(elem instanceof Object) {
            if(util.isDate(elem)) {
              return false;
            }
            return (Object.getOwnPropertyNames(elem).length === 0);
          }
          return false;
        };

        if(changes !== null) {
          Object.keys(changes).forEach(function(key) {
            if(isEmpty(changes[key])) {
              delete changes[key];
            }
          });
        }

        cb(null, changes);
      },
      function patchDocument(changes, cb) {
        // Returning null means we won't complete the hydration, and are waiting for something else.
        if(changes === null) {
          log.info(loggingTask, "Skipped task");
          return cb();
        }

        log.info(loggingTask, "End of task");

        var apiUrl = url.parse(task.callback, false, true);

        request(apiUrl.protocol + "//" + apiUrl.host)
          .patch(apiUrl.path)
          .send(changes)
          .end(rarity.carry([changes], cb));
      }
    ], function handleErrors(err, changes, res) {
      async.waterfall([
        function logErrors(cb) {
          if(err) {
            var extra = JSON.parse(JSON.stringify(task));
            extra.changes = changes;
            logError(err, extra);
            log.warn(err, "Unable to hydrate");
          }

          if(res && res.statusCode && res.statusCode !== 204) {
            loggingTask.code = res.statusCode;
            log.warn(loggingTask, "Server refused data!");
          }

          cb(null);
        },
        function forwardError(cb) {
          if(err) {
            var apiUrl = url.parse(task.callback, false, true);

            request(apiUrl.protocol + "//" + apiUrl.host)
              .patch(apiUrl.path)
              .send({
                hydration_error: err.toString()
              })
              .end(cb);
          }
          else {
            cb(null);
          }
        }
      ], function(internalErr) {
        /* istanbul ignore next */
        if(internalErr) {
          var extra = JSON.parse(JSON.stringify(task));
          extra.changes = changes;
          logError(internalErr, extra);
          log.error(internalErr, "Internal error");
        }
        done(err || internalErr, changes);
      });
    });
  };
};
