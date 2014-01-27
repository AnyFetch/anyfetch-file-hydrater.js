'use strict';

/**
 * Create a new hydration server.
 * This server will use `config.hydrater_function` as its main function, to turn a file into metadatas.
 *
 * @param {Object} config Configuration hash.
 *   Mandatory:
*       hydrater_function, the actual function to use for hydration. This function takes as params the path to the file on the disk, the current datas about the document and a callback to use after hydration. First param is the path to the file, second param the document (metadata, binary_document_type). Third param is the callback, send as first argument an error if any, then the new document data.
*    Optional:
*       concurrency, max number of simultaneous calls to your hydrater function (default is 1)
*       logger, function to use for logging. Defaults to console.log
 */
module.exports.createServer = function(config) {
  if(!config.hydrater_function) {
    throw new Error("Specify `hydrater_function`");
  }
  config.logger = config.logger || console.log;

  // Load configuration and initialize server
  var restify = require('restify');
  var async = require('async');

  var hydraterEndpoint = require('./handlers/hydrater.js');
  var statusEndpoint = require('./handlers/status.js');
  var hydraterHelper = require('./helpers/hydrater.js')(config.hydrater_function, config.logger);
  var server = restify.createServer();


  // Middleware Goes Here
  server.use(restify.acceptParser(server.acceptable));
  server.use(restify.queryParser());
  server.use(restify.bodyParser());

  server.queue = async.queue(hydraterHelper, config.concurrency || 1);


  // Load routes
  server.post('/hydrate', function(req, res, next) {
    hydraterEndpoint(req, res, server, config.logger, next);
  });
  server.get('/status', function(req, res, next) {
    statusEndpoint(req, res, server, config.logger, next);
  });

  // Expose the server
  return server;
};
