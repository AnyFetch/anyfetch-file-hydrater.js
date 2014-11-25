'use strict';

require('should');
var path = require("path");

var createFakeApi = require('./fake-api.js');
var Childs = require('../../lib/helpers/Childs');

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
        concurrency: 1,
        tasksPerProcess: process.env.TASKS_PER_PROCESS || 100,
        logger: function(str, err) {
          if(err) {
            throw err;
          }
        }
      };
      var childs = new Childs(config.concurrency, config.tasksPerProcess);
      var hydrate = require('../../lib/helpers/hydrater')(config.hydrater_function, childs, config.logger);

      var task = {};
      task.data = {
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
        concurrency: 1,
        tasksPerProcess: process.env.TASKS_PER_PROCESS || 100,
        logger: function(str, err) {
          if(err) {
            throw err;
          }
        }
      };
      var childs = new Childs(config.concurrency, config.tasksPerProcess);
      var hydrate = require('../../lib/helpers/hydrater')(config.hydrater_function, childs, config.logger);
      var task = {};
      task.data = {
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
        concurrency: 1,
        tasksPerProcess: process.env.TASKS_PER_PROCESS || 100,
        logger: function(str, err) {
          if(err) {
            throw err;
          }
        }
      };
      var childs = new Childs(config.concurrency, config.tasksPerProcess);
      var hydrate = require('../../lib/helpers/hydrater.js')(config.hydrater_function, childs, config.logger);

      var task = {};
      task.data = {
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
