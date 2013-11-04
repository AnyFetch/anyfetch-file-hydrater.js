'use strict';

/**
 * @file Define the hydrater endpoint
 *
 * Will queue requests onto the system file
 *
 */

var restify = require('restify');


/**
 * This handler receives a document on a POST request and process the document.
 *
 * @param {Object} req Request object from the client
 * @param {Object} res Response we want to return
 * @param {Object} server Current server. See implementation in index.js
 * @param {Function} next Callback to call once res has been populated.
 */
module.exports = function(req, res, server, logger, next) {
  if(!req.params.file_path) {
    return next(new restify.BadMethodError('No file to process'));
  } else if(!req.params.callback) {
    return next(new restify.BadMethodError('No specified callback'));
  }


  // Push the new task to the queue
  var task = {};
  task.file_path = req.params.file_path;
  task.callback = req.params.callback;

  delete req.params.file_path;
  delete req.params.callback;

  if(req.params.long_poll) {
    task.res = res;
    task.next = next;
    delete req.params.long_poll;
  }
  else {
    res.send(202);
    next();
  }

  task.document = req.params;

  // Add this new task to queue
  server.queue.push(task);

  logger("Queuing: " + task.file_path);
};
