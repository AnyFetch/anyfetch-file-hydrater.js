"use strict";
/*
 * A new process is spawned with this file for some tasks.
 *
 * Inter process comunication is used to send and receive message from the parent process regarding the task.
 * (using process.on())
 *
 * This let us finely tune the behavior of the hydration function.
 * If it gets stuck in a subprocess or in an HTTP blackhole,
 * the master process can simply kill the child, abort the task,
 * start a new child and keep going.
*
 * Without the sub-process isolation, we get stuck quite fast
 * and leak memory via HTTP or other subprocess.
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


process.on('message', function(task) {
  filePath = task.file_path;
  // Generate a random name to store the file
  path = '/tmp/AFH-' + crypto.randomBytes(20).toString('hex');
  var hydrate = require(task.functionPath);

  logError.config = task.opbeatConfig;

  /* istanbul ignore next */
  if(!logError.opbeat && task.opbeatConfig && task.opbeatConfig.secretToken) {
    var opbeat = require('opbeat');
    logError.opbeat = opbeat(task.opbeatConfig);
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

        // Warning, Black magic.
        // Streaming and checking for status code is no easy task...
        req.end(function() {}).req.once('response', function(res) {
          if(res.statusCode !== 200) {
            if(res.statusCode === 410) {
              err = new Error('410 Gone');
              err.skip = true;
            }
            else {
              err = new Error('Error downloading file, got status ' + res.statusCode);
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

      // Real hydration task
      hydrate(path, task.document, task.changes, cb);
    },
    function cleanFile(changes, cb) {
      // Clean the temp file
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
      // Discard the error and the changes
      err = null;
      changes = null;
    }

    if(err) {
      // Log on Opbeat
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


// On SIGTERM, kick current file
process.on('SIGTERM', function() {
  if(filePath) {
    try {
      fs.unlinkSync(filePath);
    }
    catch (err) {}
  }
  process.exit(0);
});
