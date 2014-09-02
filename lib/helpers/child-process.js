"use strict";
/*
 * A new process is spawned with this file for each task.
 * Inter process comunication is used to send and receive message from the parent process regarding the task.
 * This let us finely control the behavior of the hydration function.
 * If it happens to get stuck in a subprocess or in an HTTP blackhole,
 * the master process can simply kill the child and resume its normal operation.
 * Without the sub-process isolation, we get stuck quite fast and get leaks everywhere.
 */

var crypto = require('crypto');
var async = require("async");
var fs = require('fs');
var request = require('supertest');
var url = require('url');
var rarity = require('rarity');


process.on('message', function(task) {
  var hydrate = require(task.functionPath);
  var path = '/tmp/AFH-' + crypto.randomBytes(20).toString('hex');
  async.waterfall([
    /**
     * Download the file from task.file_path, store it in a temporary file if there is file_path
     */
    function downloadFile(cb) {
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
            err = 'Error when downloading file ' + task.file_path + ': ' + res.statusCode;
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
    function startHydration(cb) {
      cb.urlCallback = task.options.urlCallback;
      cb.apiUrl = task.options.apiUrl;
      hydrate(path, task.document, task.changes, cb);
    },
    function cleanFile(changes, cb) {
      if(task.file_path) {
        fs.unlink(path, rarity.carry([changes], cb));
      }
      else {
        cb(null, changes);
      }
    }
  ],
  function(err, changes) {
    process.send({
      err: err,
      changes: changes
    });
    process.exit(0);
  });
});
