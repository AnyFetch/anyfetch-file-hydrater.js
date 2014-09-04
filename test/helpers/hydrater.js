'use strict';

require('should');
var path = require("path");
var async = require("async");
var shellExec = require('child_process').exec;

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
            throw err;
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

describe('Hydration', function() {

  var fakeApi = createFakeApi();

  fakeApi.patch('/result', function(req, res,next) {
    res.send(204);
    next();
  });
  before(function() {
    fakeApi.listen(4243);
  });

  after(function() {
    fakeApi.close();
  });

  it('should be cleaned every every time', function(done) {
    this.timeout(10000);

    var nodeProccessesAtStart;
    async.waterfall([
      function getActualNodeProccesses(cb) {
        shellExec('ps aux | grep "[n]ode" -c', cb);
      },
      function setNodeProcessesNumber(stdout, stderr, cb) {
        nodeProccessesAtStart = parseInt(stdout);
        cb();
      },
      function hydrateManyTimes(cb) {
        var config = {
          hydrater_function: path.resolve(__dirname, '../hydraters/grep-hydrater.js'),
          logger: function() {},
        };
        var hydrate = require('../../lib/helpers/hydrater.js')(config.hydrater_function, config.logger);

        var task = {
          file_path: "http://127.0.0.1:4243/afile",
          callback: "http://127.0.0.1:4243/result",
          document: {
            id: "azerty"
          },
        };

        var hydrationCount = 0;
        async.whilst(
          function test() {
            hydrationCount += 1;
            return hydrationCount < 10;
          },
          function hydrateAndCheck(cb) {
            hydrate(task, function(err, changes) {
              changes.metadata.nodeCount.should.eql(nodeProccessesAtStart + 1);
              cb(err);
            });
          },
          cb
        );

      }
    ], done);
  });
});