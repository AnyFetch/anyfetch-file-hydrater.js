'use strict';

require('should');



describe("Hydrated document", function() {
  it("should have only updated changes", function(done) {

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

  it("should keep Dates", function(done) {
    var dummyHydrater = function(path, document, changes, cb) {
      changes.creation_date = new Date();

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
    var task = {
      callback: "http://wedontcare.com",
      filepath: "/tmp/anyfetch-hydrater.test",
      document: {
        id: "azerty"
      }
    };

    hydrate(task, function(changes) {
      changes.should.have.keys(["creation_date"]);
      done();
    });
  });
});
