module.exports = function tooLongHydrater(path, document, changes, cb) {
  setTimeout(function() {
    changes.changed = true;
    cb(null, changes);
  }, 1000)
};
