"use strict";

module.exports = function updateDateHydrater(path, document, changes, cb) {
  changes.creation_date = new Date();
  cb(null, changes);
};
