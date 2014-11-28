'use strict';

var util = require('util');
var restify = require('restify');
var yaqs = require('yaqs');
var Childs = require('./helpers/Childs');
var Logger = require("bunyan");
var restifyBunyanLogger = require('restify-bunyan-logger');

var utils = require('./utils.js');


// Create bunyan logger
var log = new Logger.createLogger({
  name: process.env.APP_NAME || 'hydrater',
});
module.exports.log = log;


/**
 * Create a new hydration server.
 * This server will use `config.hydrater_function` as its main function, to turn a file into metadata.
 *
 * @param {Object} config Configuration hash.
 *   Mandatory:
 *       hydrater_function, the actual function to use for hydration. This function takes as params the path to the file on the disk, the current data about the document and a callback to use after hydration. First param is the path to the file, second param the document (metadata, binary_document_type). Third param is the callback, send as first argument an error if any, then the new document data.
 *    Optional:
 *       concurrency, max number of simultaneous calls to your hydrater function (default is 1)
 *       opbeat, opbeat credentials
 */
module.exports.createServer = function(config) {
  if(!config.hydrater_function) {
    throw new Error("Specify `hydrater_function`");
  }

  utils.logError.config = config;

  /* istanbul ignore next */
  if(config.opbeat && config.opbeat.secretToken) {
    var opbeat = require('opbeat');
    utils.logError.opbeat = opbeat(config.opbeat);
  }

  var concurrency = config.concurrency || 1;
  var tasksPerProcess = config.tasksPerProcess || 100;

  // Load configuration and initialize server
  var hydraterEndpoint = require('./handlers/hydrater.js');
  var statusEndpoint = require('./handlers/status.js');

  var childs = new Childs(concurrency, tasksPerProcess);

  var hydraterHelper = require('./helpers/hydrater.js')(config.hydrater_function, childs);

  var server = restify.createServer({
    log: log
  });

  server.on('after', restifyBunyanLogger());

  // Middleware Goes Here
  server.use(restify.requestLogger());
  server.use(restify.acceptParser(server.acceptable));
  server.use(restify.queryParser());
  server.use(restify.bodyParser());

  server.yaqsClient = yaqs({
    prefix: config.appName,
    redis: config.redisUrl,
    defaultConcurrency: concurrency
  });

  server.queue = server.yaqsClient.createQueue('hydration', {});
  server.queue.setWorker(hydraterHelper).start();


  function sigtermYaqs() {
    server.yaqsClient.stopAllQueues(function(err) {
      if(err) {
        log.warn(err, "Unable to stop queues");
      }
      childs.stopAllChilds();
      log.info('YAQS has stopped.');
      process.exit(0);
    });
  }

  process.once('SIGTERM', sigtermYaqs);

  // Load routes
  server.post('/hydrate', function(req, res, next) {
    hydraterEndpoint(req, res, server, next);
  });
  server.get('/status', function(req, res, next) {
    statusEndpoint(req, res, server, next);
  });

  // Expose the server
  return server;
};

module.exports.defaultChanges = function() {
  return {
    data: {},
    metadata: {},
    userAccess: [],
    actions: {}
  };
};

/**
 * Custom hydration error. Use it to signal that the hydration was unable to complete, and should not be tried again.
 */
module.exports.HydrationError = function(message) {
  this.name = 'HydrationError';
  this.message = (message || "").toString();
  this._hydrationError = true;
};
util.inherits(module.exports.HydrationError, Error);
