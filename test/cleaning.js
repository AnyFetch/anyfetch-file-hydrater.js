"use strict";

var path = require("path");
var async = require("async");
var shellExec = require('child_process').exec;
var createFakeApi = require('./helpers/fake-api.js');

describe('Hydration should be cleaned every time', function() {
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

  it('on normal workflow', function(done) {
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
          hydrater_function: path.resolve(__dirname, './hydraters/grep-hydrater.js'),
          logger: function() {},
        };
        var hydrate = require('../lib/helpers/hydrater.js')(config.hydrater_function, config.logger);

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
              // + one process when working
              changes.metadata.nodeCount.should.eql(nodeProccessesAtStart + 1);
              // +0 process after work
              shellExec('ps aux | grep "[n]ode" -c', function(err, stdout) {
                parseInt(stdout).should.be.eql(nodeProccessesAtStart);
                cb(err);
              });
            });
          },
          cb
        );
      }
    ], done);
  });

  it('on crash', function(done) {
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
          hydrater_function: path.resolve(__dirname, './hydraters/buggy-hydrater.js'),
          logger: function() {},
        };
        var hydrate = require('../lib/helpers/hydrater.js')(config.hydrater_function, config.logger);

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
            hydrate(task, function() {
              // +0 process after work
              shellExec('ps aux | grep "[n]ode" -c', function(err, stdout) {
                parseInt(stdout).should.be.eql(nodeProccessesAtStart);
                cb(err);
              });
            });
          },
          cb
        );

      }
    ], done);
  });

  it('on error', function(done) {
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
          hydrater_function: path.resolve(__dirname, '../hydraters/erroed-hydrater.js'),
          logger: function() {},
        };
        var hydrate = require('../lib/helpers/hydrater.js')(config.hydrater_function, config.logger);

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
             hydrate(task, function() {
              // +0 process after work
              shellExec('ps aux | grep "[n]ode" -c', function(err, stdout) {
                parseInt(stdout).should.be.eql(nodeProccessesAtStart);
                cb(err);
              });
            });
          },
          cb
        );

      }
    ], done);
  });
});
