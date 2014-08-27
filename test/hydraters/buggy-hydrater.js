"use strict";

module.exports = function buggyHydrater() {
  throw new Error("I'm buggy");
};
