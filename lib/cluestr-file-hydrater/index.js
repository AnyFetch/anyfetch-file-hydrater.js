'use strict';

module.exports.createServer = function(config, hydrater) {
  // Load configuration and initialize server
  var restify = require('restify');
  var async = require('async');

  var hydraterEndpoint = require('./handlers/hydrater.js');
  var hydraterHelper = require('./helpers/hydrater.js')(config.hydrater_url, hydrater);
  var server = restify.createServer();


  // Middleware Goes Here
  server.use(restify.acceptParser(server.acceptable));
  server.use(restify.queryParser());
  server.use(restify.bodyParser());

  server.queue = async.queue(hydraterHelper, config.concurrency);


  // Load routes
  server.post('/hydrate', function(req, res, next) {
    hydraterEndpoint(req, res, server, next);
  });

  // Expose the server
  return server;
};

