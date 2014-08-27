"use strict";

var fs = require("fs");

module.exports = function usefulHydrater(path, document, changes, cb) {
  changes.metadata.path = path;
  changes.metadata.text = fs.readFileSync(path).toString();
  cb(null, changes);
};