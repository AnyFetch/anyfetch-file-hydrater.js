'use strict';

require('should');
var path = require("path");


describe("Hydrated document", function() {
  it("should have only updated changes", function(done) {
    var config = {
      hydrater_function: path.resolve(__dirname, '../hydraters/dummy-hydrater.js'),
      logger: function(str, err) {
        if(err) {
          throw err;
        }
      }
    };
    var hydrate = require('../../lib/helpers/hydrater')(config.hydrater_function, config.logger);

    var task = {
      callback: "http://osef.com",
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
    var config = {
      hydrater_function: path.resolve(__dirname, '../hydraters/update-date-hydrater.js'),
      logger: function(str, err) {
        if(err) {
          throw err;
        }
      }
    };
    var hydrate = require('../../lib/helpers/hydrater')(config.hydrater_function, config.logger);
    var task = {
      callback: "http://osef.com",
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
var shellFork = require('child_process').fork;
var HydrationError = require('../../lib/index.js').HydrationError;


  it('should send an error', function(done) {
    process.env.TIMEOUT = 20;

    var config = {
      hydrater_function: path.resolve(__dirname, '../hydraters/too-long-hydrater.js'),
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
