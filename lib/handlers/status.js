'use strict';

/**
 * @file Status endpoint
 *
 */


/**
 * This handler displays data about the current hydrater status
 *
 * @param {Object} req Request object from the client
 * @param {Object} res Response we want to return
 * @param {Object} server Current server. See implementation in index.js
 * @param {Function} next Callback to call once res has been populated.
 */
module.exports = function(req, res, server, logger, next) {
  var ret = {
    'status': 'ok',
    'queued_items': server.queue.length()
  };

  res.send(ret);
  next();
};
