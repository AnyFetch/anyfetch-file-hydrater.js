"use strict";

var shellExec = require('child_process').exec;
var async = require("async");

module.exports = function grepHydrater(path, document, changes, cb) {
  async.waterfall([
    function getNodeProcesses(cb) {
      shellExec('ps aux | grep "[n]ode" -c', cb);
    },
    function saveInChanges(stdout, stderr, cb) {
      changes.metadata.nodeCount = parseInt(stdout);
      cb();
    }
  ], function(err) {
    cb(err, changes);
  });
};
