'use strict';

require('should');

var dummyHydrater = function(path, document, changes, cb) {
  changes.metadata.hydrated = true;

  cb(null, changes);
};

var config = {
  hydrater_function: dummyHydrater,
  logger: function(str, err) {
    if(err) {
      throw err;
    }
  }
};

var hydrate = require('../../lib/helpers/hydrater')(config.hydrater_function, config.logger);

describe("Hydrated document", function() {
  it("should have only updated changes", function(done) {
    var task = {
      callback: "http://wedontcare.com",
      filepath: "/tmp/anyfetch-hydrater.test",
      document: {
        id: "azerty"
      }
    };

    hydrate(task, function(changes) {
      changes.should.have.keys(["metadata"]);
      done();
    });
  });
});
