'use strict';

var redis = require('redis');

before(function flushRedis(cb) {
  var client = redis.createClient();
  client.flushdb(cb);
});


before(function removeLogging() {
  // Disable logging while testing
  var log = require('../lib/index.js').log;
  log.info = log.warn = log.error = function() {};
});
