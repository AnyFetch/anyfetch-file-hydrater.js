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
module.exports = function(req, res, server, logger, errLogger, next) {
  if(!req.params.callback && !req.params.long_poll) {
    return next(new restify.MissingParameterError('No specified callback'));
  }

  var task = {};
  task.file_path = (req.params.file_path) ? req.params.file_path : null;
  task.callback = req.params.callback;

  if(req.params.long_poll) {
    task.res = res;
    task.next = next;
    task.long_poll = true;
  }
  else {
    res.send(202);
    next();
  }
  if(req.params.long_poll) {
    task.priority = (req.params.priority) ? parseInt(req.params.priority) : server.yaqsClient.PRIORITY.NORMAL;
  }
  else {
    task.priority = (req.params.priority) ? parseInt(req.params.priority) : server.yaqsClient.PRIORITY.NORMAL;
  }
  // Push it to the queue
  var job = server.queue.createJob(task, {priority: task.priority});
  job.save(function(err) {
    if(err) {
      errLogger("Error while queuing: " + ((task.file_path) ? task.file_path : task.document.id) + "\nError :" + err.toString());
    }
    else {
      logger("Queuing: " + ((task.file_path) ? task.file_path : task.document.id));
    }
  });

};
