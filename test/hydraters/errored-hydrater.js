var anyfetchFileHydrater = require('../../lib/');


module.exports = function erroredHydrater(path, document, changes, cb) {
  cb(new anyfetchFileHydrater.HydrationError("hydrater errored"))
};
