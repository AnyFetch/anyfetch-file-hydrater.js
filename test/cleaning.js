"use strict";

var path = require("path");
var async = require("async");
var rarity = require("rarity");
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

    var config = {
      hydrater_function: path.resolve(__dirname, './hydraters/grep-hydrater.js'),
      concurrency: 2,
      logger: function() {},
    };
    var hydrate = require('../lib/helpers/hydrater.js')(config.hydrater_function, config.concurrency, config.logger);

    var task = {
      file_path: "http://127.0.0.1:4243/afile",
      callback: "http://127.0.0.1:4243/result",
      document: {
        id: "azerty"
      },
    };

    async.waterfall([
      function getCurrentNodeProccesses(cb) {
        shellExec('ps aux | grep "[n]ode" -c', rarity.slice(2, cb));
      },
      function hydrateManyTimes(nodeProccessesAtStart, cb) {
        var hydrationCount = 0;
        async.whilst(
          function test() {
            hydrationCount += 1;
            return hydrationCount < 10;
          },
          function hydrateAndCheck(cb) {
            hydrate(task, function(err, changes) {
              // Reuse existing process during progress
              changes.metadata.nodeCount.should.eql(nodeProccessesAtStart);
              shellExec('ps aux | grep "[n]ode" -c', function(err, stdout) {
                // keep process open after use
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
    var config = {
      hydrater_function: path.resolve(__dirname, './hydraters/buggy-hydrater.js'),
      concurrency: 2,
      logger: function() {},
    };
    var hydrate = require('../lib/helpers/hydrater.js')(config.hydrater_function, config.concurrency, config.logger);

    var task = {
      file_path: "http://127.0.0.1:4243/afile",
      callback: "http://127.0.0.1:4243/result",
      document: {
        id: "azerty"
      },
    };

    async.waterfall([
      function getActualNodeProccesses(cb) {
        shellExec('ps aux | grep "[n]ode" -c', rarity.slice(2, cb));
      },
      function hydrateManyTimes(nodeProccessesAtStart, cb) {
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

    var config = {
      hydrater_function: path.resolve(__dirname, '../hydraters/erroed-hydrater.js'),
      concurrency: 2,
      logger: function() {},
    };
    var hydrate = require('../lib/helpers/hydrater.js')(config.hydrater_function, config.concurrency, config.logger);

    var task = {
      file_path: "http://127.0.0.1:4243/afile",
      callback: "http://127.0.0.1:4243/result",
      document: {
        id: "azerty"
      },
    };

    async.waterfall([
      function getActualNodeProccesses(cb) {
        shellExec('ps aux | grep "[n]ode" -c', rarity.slice(2, cb));
      },
      function hydrateManyTimes(nodeProccessesAtStart, cb) {
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
