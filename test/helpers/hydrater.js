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


describe('Timeout', function() {
  it('should send an error', function(done) {
    process.env.TIMEOUT = 20;

    var tooLongHydrater = function(path, document, changes, cb) {
      setTimeout(function() {
        cb(null, changes);
      }, 1000);
    };

    var config = {
      hydrater_function: tooLongHydrater,
      logger: function(str, err) {
        if(err) {
          throw err;
        }
      }
    };
    var hydrate = require('../../lib/helpers/hydrater.js')(config.hydrater_function, config.logger);

    var task = {
      callback: "http://wedontcare.com",
      filepath: "/tmp/anyfetch-hydrater.test",
      document: {
        id: "azerty"
      }
    };

    hydrate(task, function(changes) {
      changes.should.have.property('hydration_errored', true);
      process.env.TIMEOUT =  60 * 1000;
      done();
    });
  });
});
