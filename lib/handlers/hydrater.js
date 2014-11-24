'use strict';

/**
 * @file /hydrate endpoint
 *
 * Will queue requests onto the system file
 */

var restify = require('restify');

/**
 * This handler receives a document to hydrate on a POST request and processes it.
 *
 * @param {Object} req Request object from the client
 * @param {Object} res Response we want to return
 * @param {Object} server Current server. See implementation in index.js
 * @param {Function} next Callback to call once res has been populated.
 */
module.exports = function(req, res, server, logger, next) {
  if(!req.params.callback && !req.params.long_poll) {
    return next(new restify.MissingParameterError('No specified callback'));
  }

  res.send(202);
  next();

  // Prepare the new task
  var task = {};
  task.file_path = (req.params.file_path) ? req.params.file_path : null;
  task.callback = req.params.callback;


  task.document = req.params.document || {};
  task.document.metadata = task.document ? task.document.metadata || {} : {};
  task.document.data = task.document ? task.document.data || {} : {};

  task.priority = (req.params.priority) ? parseInt(req.params.priority) : 0;

  // Push it to the queue
  server.queue.push(task, -task.priority);

  logger("Queuing: " + ((task.file_path) ? task.file_path : task.document.id));
};
