"use strict";
/*
 * A new process is spawned with this file for some tasks.
 * Inter process comunication is used to send and receive message from the parent process regarding the task.
 * This let us finely control the behavior of the hydration function.
 * If it happens to get stuck in a subprocess or in an HTTP blackhole,
 * the master process can simply kill the child and resume its normal operation.
 * Without the sub-process isolation, we get stuck quite fast and get leaks everywhere.
 */

var crypto = require('crypto');
var async = require('async');
var fs = require('fs');
var request = require('supertest');
var url = require('url');
var rarity = require('rarity');

var logError = require('../utils').logError;

var filePath;
var path;

var opbeatInitialized = false;

process.on('message', function(task) {
  filePath = task.file_path;
  path = '/tmp/AFH-' + crypto.randomBytes(20).toString('hex');
  var hydrate = require(task.functionPath);

  logError.config = task.opbeatConfig;

  /* istanbul ignore next */
  if(!opbeatInitialized && task.opbeatConfig && task.opbeatConfig.secretToken) {
    var opbeat = require('opbeat');
    logError.opbeat = opbeat(task.opbeatConfig);
    opbeatInitialized = true;
  }

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
            if(res.statusCode === 410) {
              err = new Error('410 Gone');
              err.skip = true;
            }
            else {
              err = 'Error when downloading file ' + task.file_path + ': ' + res.statusCode;
            }

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
      cb.priority = task.priority;
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
    if(err && err.skip) {
      err = null;
      changes = null;
    }

    if(err) {
      var extra = JSON.parse(JSON.stringify(task));
      extra.fromChild = true;
      extra.changes = changes;
      logError(err, extra);
      process.send({
        err: {
          message: err.toString(),
          _hydrationError: err._hydrationError
        },
        changes: changes
      });
    }
    else {
      process.send({
        changes: changes
      });
    }
  });
});


process.on('SIGTERM', function() {
  if(filePath) {
    try {
      fs.unlinkSync(path);
    }
    catch (err) {}
  }
  process.disconnect();
  process.exit(0);
});
