'use strict';

/**
 * @file Hydrate the file from scratch.
 * Download it from AnyFetch, save it to local storage, run the hydrater function and returns the result.
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

var lib = require('../index.js');

var hydrationError = lib.hydrationError;

module.exports = function(hydraterFunction, logger) {
  /**
   * Take an AnyFetch document and returns metadata
   *
   * @param {Object} task Task object, keys must be file_path (file URL) and callback (URL)
   * @param {Function} cb Callback, first parameter is the error.
   */
  return function(task, done) {
    logger("Starting task: " + task.file_path);


    async.waterfall([
      function initHydration(cb) {
        // Download the file from task.file_path, store it in temporary file
        var path = '/tmp/' + crypto.randomBytes(20).toString('hex');

        // Download the file
        var stream = fs.createWriteStream(path);

        var err;
        stream.on("finish", function() {
          cb(err, path);
        });

        var apiUrl = url.parse(task.file_path, false, true);

        var req = request(apiUrl.protocol + "//" + apiUrl.host)
          .get(apiUrl.pathname);

        req.end().req.once('response', function(res) {
            if(res.statusCode !== 200) {
              err = new Error("Invalid statusCode (" + res.statusCode + ") while downloading file " + task.file_path);
              stream.end();
              this.abort();
            }
          });

        req.pipe(stream);
      },

      function doHydration(path, cb) {
        var domain = nodeDomain.create();

        // function to call, either on domain error, on hydration error or successful hydration.
        // Will clean the fs and dispose the domain for better performance.
        var cleaner = function(err, changes) {
          domain.exit();
          domain.dispose();
          // Remove file from fs
          fs.unlink(path, function(_err) {
            cb(err || _err, changes);
          });
        };

        domain.on('error', cleaner);

        // Run in a domain to prevent memory leak on crash
        domain.run(function() {
          async.waterfall([
            function callHydrationFunction(cb) {
              // Give user access to the final URL callback and the API url (which can be staging, prod or anything)
              cb.urlCallback = task.callback;
              cb.apiUrl = task.callback ? task.callback.substr(0, task.callback.indexOf('/', 8)): '';

              // Call the real function for hydration.
              hydraterFunction(path, task.document, lib.defaultChanges(), cb);
            }
          ], function cleanHydration(err, changes) {
            changes = changes || {};

            // If the function replied with an "hydrationError", we'll wrap this in a nicely formatted document
            // and stop the error from bubbling up.
            if(err instanceof hydrationError) {
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
        // Upload to server
        if(Object.keys(changes).length === 0) {
          logger("Skipped task: " + task.file_path);
          return cb();
        }

        logger("End of task: " + task.file_path);

        // When long_polling, it is possible we don't have a callback
        if(!task.callback) {
          return cb();
        }

        var apiUrl = url.parse(task.callback, false, true);
        request(apiUrl.protocol + "//" + apiUrl.host)
          .patch(apiUrl.pathname)
          .send(changes)
          .end(cb);

      }
    ], function(err, res) {
      if(err) {
        // When the user asked for long polling, send error
        if(task.next) {
          task.next(new restify.InvalidContentError("ERR hydrating " + task.file_path + err.toString()));
        }
        logger("ERR hydrating " + task.file_path, err);
      }

      if(res && res.statusCode && res.statusCode !== 204) {
        logger("ERR hydrating: server refused data! Code:" + res.statusCode);
      }
      done(err);
    });
  };
};
