'use strict';

/**
 * @file Hydrate the file from scratch.
 * Download it from AnyFetch, save it to local storage, run the hydrater function and return the result.
 *
 * This helper is used in the server queue.
 */

var async = require('async');
var nodeDomain = require('domain');
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
      function initHydration(cb) {
        if(task.file_path) {
          // Download the file
          var stream = fs.createWriteStream(path);

          // Store error if statusCode !== 200
          var err;
          stream.on("finish", function() {
            cb(err);
          });

          var apiUrl = url.parse(task.file_path, false, true);
          var req = request(apiUrl.protocol + "//" + apiUrl.host)
            .get(apiUrl.path);

          req.end().req.once('response', function(res) {
            if(res.statusCode !== 200) {
              err = new restify.BadGatewayError('Error when downloading file ' + task.file_path + ': ' + res.statusCode);
              stream.end();
              this.abort();
            }
          });

          req.pipe(stream);
        }
        else {
          cb(null);
        }
      },
      function performHydration(cb) {
        var domain = nodeDomain.create();

        var timeout;
        /**
         * Function to call, either on domain error, on hydration error or successful hydration.
         * Will clean the fs and dispose the domain for better performance.
         */
        var cleaner = function(err, changes) {
          if(!cleaner.called) {
            cleaner.called = true;
            domain.exit();
            domain.dispose();
            cb(err, changes);
          }
        };
        cleaner.called = false;

        domain.on('error', cleaner);

        // Run in a domain to prevent memory leak on crash
        domain.run(function() {
          async.waterfall([
            function callHydrationFunction(cb) {
              // Give user access to the final URL callback and the API url (which can be staging, prod or anything)
              // In case he wants to bypass us and send the changes himself
              cb.urlCallback = task.callback;
              cb.apiUrl = '';
              if(task.callback) {
                var parsed = url.parse(task.callback);
                cb.apiUrl = parsed.protocol + "//" + parsed.host;
              }

              // Call the real function for hydration.
              hydraterFunction((task.file_path) ? path : null, task.document, lib.defaultChanges(), cb);
            }
          ], function cleanHydration(err, changes) {
            // If the function replied with an "HydrationError", we'll wrap this in a nicely formatted document
            // and stop the error from bubbling up.
            if(err instanceof HydrationError) {
              changes = {};
              changes.hydration_errored = true;
              changes.hydration_error = err.message;
              err = null;
            }

            // Wait for nexttick, to end this function and be able to properly GC it on domain.dispose().
            process.nextTick(function() {
              cleaner(err, changes);
            });
          });
        });

        timeout = setTimeout(function() {
          if(!cleaner.called) {
            var changes = {};
            changes.hydration_errored = true;
            changes.hydration_error = "Task took too long.";
            cleaner(null, changes);
          }
        }, process.env.TIMEOUT || 60 * 1000);
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
