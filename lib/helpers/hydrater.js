'use strict';

/**
 * @file Hydrate the file from scratch.
 * Download it from AnyFetch, save it to local storage, run the hydrater function and returns the result.
 *
 * This helper is used in the server queue.
 */


var async = require('async');
var nodeDomain = require('domain');
var request = require('request');
var crypto = require('crypto');
var restify = require('restify');
var fs = require('fs');

var lib = require('../index.js');

var hydrationError = lib.hydrationError;

module.exports = function(hydraterFunction, logger) {
  /**
   * Take an AnyFetch document and returns metadatas
   *
   * @param {Object} task Task object, keys must be file_path (file URL) and callback (URL)
   * @param {Function} cb Callback, first parameter is the error.
   */
  return function(task, done) {
    logger("Starting task: " + task.file_path);

    var changes = lib.defaultChanges();
    async.waterfall([
      function initHydration(cb) {
        // Download the file from task.file_path, store it in temporary file
        var path = '/tmp/' + crypto.randomBytes(20).toString('hex');

        // Sometimes, request fire "end" and sometimes "finish".
        var hasFinished = false;
        var endFunction = function() {
          if(!hasFinished) {
            cb(null, path);
            hasFinished = true;
            r.removeAllListeners(['error', 'end', 'finish', 'response']);
          }
        };
        // Download the file
        var r = request(task.file_path);

        r.pipe(fs.createWriteStream(path));
        r.on('error', function(err) {
          return cb(err);
        });
        r.on('end', endFunction);
        r.on('finish', endFunction);

        r.on('response', function (resp) {
          if(resp.statusCode !== 200) {
            return cb(new Error("Invalid statusCode (" + resp.statusCode + ") while downloading file," + JSON.stringify(resp)));
          }
        });
      },
      function hydration(path, cb) {

        var domain = nodeDomain.create();
        var cleaner = function(err) {
          domain.exit();
          domain.dispose();
          // Remove file from fs
          fs.unlink(path, function(_err) {
            cb(err || _err, changes);
          });
        };

        domain.on('error', cleaner);
        // Run the real hydrater function
        domain.run(function() {
          async.waterfall([
            function hydrate(cb) {
              var onCb = function(err, changes) {
                // Forward error for later catch
                cb(err, path, changes, domain);
              };
              onCb.urlCallback = task.callback;

              if(task.callback) {
                onCb.apiUrl = task.callback.substr(0, task.callback.indexOf('/', 8));
              }

              hydraterFunction(path, task.document, changes, onCb);
            }
          ], function cleanHydration(err, path, changes) {
            if(typeof err === hydrationError.name) {
              changes = {
                hydration_errored: true,
                hydration_error: err.toString()
              };
              err = null;
            }
            // Clean domain
            process.nextTick(function() {
              cleaner(err);
            });
          });
        });
      },
      function sendLongPoll(changes, cb) {
        // When the user asked for long polling, send datas
        if(task.res && task.next) {
          task.res.send(changes);
          task.next();
        }
        cb(null, changes);
      },
      function patchDocument(changes, cb) {
        // Upload to server
        if(!changes) {
          logger("Skipped task: " + task.file_path);
          return cb();
        }

        logger("End of task: " + task.file_path);

        // When long_polling, it is possible we don't have a callback
        if(!task.callback) {
          return cb();
        }

        var params = {
          url: task.callback,
          json: changes
        };

        request.patch(params, cb);
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
        logger("ERR hydrating: server refused datas! Code:" + res.statusCode);
      }
      done(err);
    });
  };
};
