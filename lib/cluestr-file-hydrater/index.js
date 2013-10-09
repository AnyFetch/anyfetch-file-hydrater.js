'use strict';

module.exports.getServer = function(config, hydrater, cb) {
  // Load configuration and initialize server
  var restify = require('restify');
  var async = require('async');

  var hydraterEndpoint = require('handlers/hydrater.js');
  var hydraterHelper = require('helpers/hydrater.js')(hydrater);
  var server = restify.createServer();


  // Middleware Goes Here
  server.use(restify.acceptParser(server.acceptable));
  server.use(restify.queryParser());
  server.use(restify.bodyParser());

  server.queue = async.queue(hydraterHelper, config.concurrency);

  // Load routes
  server.post('/hydrate', hydraterEndpoint);

  // Expose the server
  cb(server);
};

