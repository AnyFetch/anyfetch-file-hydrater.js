module.exports = function buggyHydrater(path, document, changes, cb) {
  throw new Error("I'm buggy");
};
