'use strict';

/**
 * @file /hydrate endpoint
 *
 * Will queue requests onto the system file
 */

var restify = require('restify');

var log = require('../index.js').log;


/**
 * This handler receives a document to hydrate on a POST request and processes it.
 *
 * @param {Object} req Request object from the client
 * @param {Object} res Response we want to return
 * @param {Object} server Current server. See implementation in index.js
 * @param {Function} next Callback to call once res has been populated.
 */
module.exports = function(req, res, server, next) {
  if(!req.params.callback) {
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
  var job = server.queue.createJob(task, {priority: task.priority});
  job.save(function(err) {
    if(err) {
      log.warn(err, "Error while queuing " + (task.file_path) ? task.file_path : task.document.id);
    }
    else {
      var loggingTask = {file_path: task.file_path, callback: task.callback, document: {id: task.document.id, identifier: task.document.identifier}};
      log.info(loggingTask, "Queuing task");
    }
  });

};
