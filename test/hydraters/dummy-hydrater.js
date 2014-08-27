"use strict";

module.exports = function dummyHydrater(path, document, changes, cb) {
  changes.metadata.hydrated = true;
  cb(null, changes);
};
