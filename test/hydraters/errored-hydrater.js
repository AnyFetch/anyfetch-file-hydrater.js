"use strict";

var HydrationError = require('../../lib/').HydrationError;

module.exports = function erroredHydrater(path, document, changes, cb) {
  cb(new HydrationError("hydrater errored"));
};
