"use strict";

/* istanbul ignore next */
module.exports.logError = function logError(err, req, extra) {
  // No logging on test or if err is undefined
  if(process.env.NODE_ENV === "test" || !err) {
    return;
  }

  if(!extra) {
    extra = req;
    req = null;
  }

  delete err.domain;
  delete err.domainThrown;

  if(err.__alreadyLogged) {
    console.warn("Skipping an error already sent to Opbeat: ", err.toString());
    return;
  }

  if(!extra) {
    extra = {};
  }

  if(module.exports.logError.config) {
    extra.hydrater = module.exports.logError.config.hydraterUrl;
  }
  if(process.env.APP_NAME) {
    extra.hydrater_name = process.env.APP_NAME;
  }

  if(module.exports.logError.opbeat) {
    var meta = {
      extra: extra
    };

    if(req) {
      meta.request = req;

      if(req.token) {
        meta.user = {
          is_authenticated: true,
          id: req.token.anyfetchToken,
          username: req.token.accountName,
          email: req.token.accountName
        };
      }
    }

    module.exports.logError.opbeat.captureError(err, meta);
  }
  else {
    var all = {
      details: err.toString(),
      err: err,
      extra: extra
    };

    try {
      all = JSON.stringify(all);
    }
    catch(e) {
      // Converting circular structure to JSON.
      // We can't do anything, let's log the raw object.
    }

    console.warn("LOG-ERROR-DETAILS", all);
  }

  err.__alreadyLogged = true;
};
