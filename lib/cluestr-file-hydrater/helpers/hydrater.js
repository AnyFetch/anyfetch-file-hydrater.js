'use strict';

/**
 * @file Hydrate the file from scratch.
 * Download it from Cluestr, save it to local storage, run the hydrater function and returns the result.
 *
 * This helper is used in the server queue.
 */


var async = require('async');
var request = require('request');
var crypto = require('crypto');
var fs = require('fs');

module.exports = function(hydraterFunction) {
  /**
   * Take a Cluestr document and returns metadatas
   * 
   * @param {Object} task Task object, keys must be file_path (file URL) and callback (URL)
   * @param {Function} cb Callback, first parameter is the error.
   */
  return function(task, done) {
    console.log("Starting task: ", task.file_path);

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
        request(task.file_path)
          .pipe(fs.createWriteStream(path))
          .on('error', function(err) {
            throw err;
          })
          .on('end', endFunction)
          .on('finish', endFunction);
      },
      function(path, cb) {
        // Run the real hydrater function
        hydraterFunction(path , task.document, function(err, document) {
          cb(err, path, document);
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
        console.log("End of task", task.file_path);
      }
    ], done);
  };
};
