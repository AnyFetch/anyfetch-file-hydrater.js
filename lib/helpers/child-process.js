"use strict";
var async = require("async");

process.on('message', function(task) {
  var hydrate = require(task.functionPath);
  async.waterfall([
    function startHydration(cb) {
      cb.urlCallback = task.options.urlCallback;
      cb.apiUrl = task.options.apiUrl;
      hydrate(task.path, task.document, task.changes, cb);
    }
  ],
  function(err, changes) {
    process.send({
      err: err,
      changes: changes
    });
  });
});
