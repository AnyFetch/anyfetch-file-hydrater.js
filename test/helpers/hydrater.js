'use strict';

require('should');
var path = require("path");
var createFakeApi = require('./fake-api.js');

describe("hydrate()", function() {
  var fakeApi = createFakeApi();
  before(function() {
    fakeApi.listen(4243);
  });

  after(function() {
    fakeApi.close();
  });

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
        file_path: "http://127.0.0.1:4243/afile",
        callback: "http://127.0.0.1:4243",
        document: {
          id: "azerty"
        }
      };

      hydrate(task, function(err, changes) {
        changes.should.have.keys(["metadata"]);
        done(err);
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
        file_path: "http://127.0.0.1:4243/afile",
        callback: "http://127.0.0.1:4243",
        document: {
          id: "azerty"
        }
      };

      hydrate(task, function(err, changes) {
        changes.should.have.keys(["creation_date"]);
        done();
      });
    });
  });

  describe('Timeout', function() {
    it('should send an error', function(done) {
      process.env.TIMEOUT = 20;

      var config = {
        hydrater_function: path.resolve(__dirname, '../hydraters/too-long-hydrater.js'),
        logger: function(str, err) {
          if(err) {
            console.log(err)
            //throw err;
          }
        }
      };
      var hydrate = require('../../lib/helpers/hydrater.js')(config.hydrater_function, config.logger);

      var task = {
        file_path: "http://127.0.0.1:4243/afile",
        callback: "http://127.0.0.1:4243",
        document: {
          id: "azerty"
        }
      };

      hydrate(task, function(err, changes) {
        changes.should.have.property('hydration_errored', true);
        changes.should.have.property('hydration_error', 'Task took too long.');
        process.env.TIMEOUT =  60 * 1000;
        done(err);
      });
    });
  });
});
