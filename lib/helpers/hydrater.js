'use strict';

/**
 * @file Hydrate the file from scratch.
 * Download it from AnyFetch, save it to local storage, run the hydrater function and return the result.
 *
 * This helper is used in the server queue.
 */

var async = require('async');
var shellFork = require('child_process').fork;
var request = require('supertest');
var crypto = require('crypto');
var restify = require('restify');
var fs = require('fs');
var url = require('url');
var rarity = require('rarity');
var util = require('util');

var lib = require('../index.js');

var HydrationError = lib.HydrationError;

module.exports = function(hydraterFunction, logger, errLogger) {
  if(!errLogger) {
    errLogger = logger;
  }

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
  return function(task, done) {
    logger("Starting task: " + ((task.file_path) ? task.file_path : task.document.id));

    var path = '/tmp/AFH-' + crypto.randomBytes(20).toString('hex');
    async.waterfall([
      /**
       * Download the file from task.file_path, store it in a temporary file if there is file_path
       */
      function downloadFile(cb) {
        if(task.file_path) {
          var apiUrl = url.parse(task.file_path, false, true);
          request(apiUrl.protocol + "//" + apiUrl.host)
            .get(apiUrl.path)
            .expect(200)
            .end(function(err, res) {
              if(err) {
                err = new restify.BadGatewayError('Error when downloading file ' + task.file_path + ': ' + err);
              }
              cb(err, res && res.text);
            });
        }
        else {
          cb(null);
        }
      },
      function saveFile(res, cb) {
        if(res) {
          fs.writeFile(path, res, cb);
        }
        else {
          cb();
        }
      },
      function performHydration(cb) {
        var child = shellFork(__dirname + '/child-process.js', {silent: true});
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
            cb(err, changes);
          }
          clearTimeout(timeout);
        };
        cleaner.called = false;

        child.on('error', function(exitCode) {
          cleaner(new HydrationError("Wild error appeared while spawning child. Exit code:" + exitCode));
        });

        child.stderr.on('readable', function() {
          var chunk;
          while (null !== (chunk = child.stderr.read())) {
            stderr += chunk;
          }
        });

        child.stdout.on('readable', function() {
          var chunk;
          while (null !== (chunk = child.stdout.read())) {
            stdout += chunk;
          }
        });

        child.on('exit', function(errCode) {
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

        child.send({
          functionPath: hydraterFunction,
          path: (task.file_path) ? path : null,
          document: task.document,
          changes: lib.defaultChanges(),
          options: options,
        });

        child.on('message', function(res) {
          var err = res.err
          // If the function replied with an "HydrationError", we'll wrap this in a nicely formatted document
          // and stop the error from bubbling up.
          if(err && err._hydrationError) {
            res.changes = {};
            res.changes.hydration_errored = true;
            res.changes.hydration_error = res.err.message;
            err = null;
          }
          cleaner(err, res.changes);

        });

        timeout = setTimeout(function() {
          if(!cleaner.called) {
            var changes = {};
            changes.hydration_errored = true;
            changes.hydration_error = "Task took too long.";
            child.kill('SIGKILL');
            cleaner(null, changes);
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
      function sendLongPoll(changes, cb) {
        // When the user asked for long polling, send data
        if(task.res && task.next) {
          task.res.send(changes);
          task.next();
        }
        cb(null, changes);
      },
      function patchDocument(changes, cb) {
        // Returning null means we won't complete the hdyration, and are waiting for something else.
        if(changes === null) {
          logger("Skipped task: " + ((task.file_path) ? task.file_path : task.document.id));
          return cb();
        }

        logger("End of task: " + ((task.file_path) ? task.file_path : task.document.id));

        // When long_polling, it is possible we don't have a callback
        if(!task.callback) {
          return cb();
        }

        var apiUrl = url.parse(task.callback, false, true);

        request(apiUrl.protocol + "//" + apiUrl.host)
          .patch(apiUrl.path)
          .send(changes)
          .end(rarity.carry([changes], cb));
      }
    ], function handleErrors(err, changes, res) {
      if(err) {
        // When the user asked for long polling, send error
        if(task.next) {
          task.next(new restify.InvalidContentError("ERR hydrating " + ((task.file_path) ? task.file_path : task.document.id) + err.toString()));
        }
        errLogger("ERR hydrating " + ((task.file_path) ? task.file_path : task.document.id), err);
      }

      if(res && res.statusCode && res.statusCode !== 204) {
        errLogger("ERR hydrating: server refused data! Code:" + res.statusCode);
      }

      if(task.file_path) {
        fs.unlink(path, function(_err) {
          done(err || _err, changes);
        });
      }
      else {
        done(changes);
      }
    });
  };
};
