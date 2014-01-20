'use strict';

/**
 * @file Hydrate the file from scratch.
 * Download it from AnyFetch, save it to local storage, run the hydrater function and returns the result.
 *
 * This helper is used in the server queue.
 */


var async = require('async');
var domain = require('domain');
var request = require('request');
var crypto = require('crypto');
var restify = require('restify');
var fs = require('fs');

module.exports = function(hydraterFunction, logger) {
  /**
   * Take a AnyFetch document and returns metadatas
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
        r.on('response', function (resp) {
          if(resp.statusCode !== 200) {
            return cb(new Error("Invalid statusCode (" + resp.statusCode + ") while downloading file," + resp.body));
          }
          r.pipe(fs.createWriteStream(path))
          .on('error', function(err) {
            throw err;
          })
          .on('end', endFunction)
          .on('finish', endFunction);
        });
      },
      function(path, cb) {
        // Run the real hydrater function
        var d = domain.create();
        d.once('error', cb);
        d.run(function() {
          hydraterFunction(path , task.document, function(err, document) {
            cb(err, path, document);
          });
        });
      },
      function(path, document, cb) {
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

        var params = {
          url: task.callback,
          json: document
        };

        request.patch(params, cb);
        logger("End of task" + task.file_path);
      }
    ], function(err) {
      if(err) {
        // When the user asked for long polling, send error
        if(task.next) {
          task.next(new restify.InvalidContentError("ERR hydrating " + task.file_path + err.toString()));
        }
        
        logger("ERR hydrating " + task.file_path, err);
      }
      done(err);
    });
  };
};
