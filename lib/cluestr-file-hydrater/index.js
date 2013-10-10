'use strict';

/**
 * Create a new hydration server.
 * This server will use `hydrater` as its main function, to turn a file into metadatas.
 *
 * @param {Object} config Configuration hash.
 *   Mandatory:
*       hydrater_url, with the current URL this server will run, e.g. http://hydrater.example.org.
*       hydrater_function, the actual function to use for hydration. This function takes as params the path to the file on the disk, the current datas about the document and a callback to use after hydration. First param is the path to the file, second param the document (metadata, binary_document_type). Third param is the callback, send as first argument an error if any, then the new document data.
*    Optional:
*       concurrency, max number of simultaneous calls to your hydrater function (default is 1)
 */
module.exports.createServer = function(config) {
  // Load configuration and initialize server
  var restify = require('restify');
  var async = require('async');

  var hydraterEndpoint = require('./handlers/hydrater.js');
  var hydraterHelper = require('./helpers/hydrater.js')(config.hydrater_url, config.hydrater_function);
  var server = restify.createServer();


  // Middleware Goes Here
  server.use(restify.acceptParser(server.acceptable));
  server.use(restify.queryParser());
  server.use(restify.bodyParser());

  server.queue = async.queue(hydraterHelper, config.concurrency || 1);


  // Load routes
  server.post('/hydrate', function(req, res, next) {
    hydraterEndpoint(req, res, server, next);
  });

  // Expose the server
  return server;
};

