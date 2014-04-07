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


module.exports = function(hydraterFunction, logger) {
  /**
   * Take an AnyFetch document and returns metadatas
   *
   * @param {Object} task Task object, keys must be file_path (file URL) and callback (URL)
   * @param {Function} cb Callback, first parameter is the error.
   */
  return function(task, done) {
    logger("Starting task: " + task.file_path);

    async.waterfall([
      function(cb) {
        // Download the file from task.file_path, store it in temporary file
        var path = '/tmp/' + crypto.randomBytes(20).toString('hex');

        // Sometimes, request fire "end" and sometimes "finish".
        var hasFinished = false;
        var endFunction = function() {
          if(!hasFinished) {
            cb(null, path);
            hasFinished = true;
          }
        };

        // Download the file
        var r = request(task.file_path);

        r.pipe(fs.createWriteStream(path));
        r.once('error', function(err) {
          return cb(err);
        });
        r.once('end', endFunction);
        r.once('finish', endFunction);

        r.once('response', function (resp) {
          if(resp.statusCode !== 200) {
            return cb(new Error("Invalid statusCode (" + resp.statusCode + ") while downloading file," + JSON.stringify(resp)));
          }
        });
      },
      function(path, cb) {
        // Run the real hydrater function
        var domain = nodeDomain.create();
        domain.once('error', cb);
        domain.run(function() {
          var onCb = function(err, document) {
            cb(err, path, document, domain);
          };
          onCb.urlCallback = task.callback;
          if(task.callback) {
            onCb.apiUrl = task.callback.substr(0, task.callback.indexOf('/', 8));
          }

          hydraterFunction(path , task.document, onCb);
        });
      },
      function(path, document, domain, cb) {
        // Clean domain
        domain.exit();
        domain.dispose();
        // Remove file from fs
        fs.unlink(path, function(err) {
          cb(err, document);
        });
      },
      function(document, cb) {
        // When the user asked for long polling, send datas
        if(task.res && task.next) {
          task.res.send(document);
          task.next();
        }

        cb(null, document);
      },
      function(document, cb) {
        // Upload to server

        if(!document) {
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
          json: document
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
