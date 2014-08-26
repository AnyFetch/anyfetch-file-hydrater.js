'use strict';

require('should');
var request = require('supertest');
var restify = require('restify');

var anyfetchFileHydrater = require('../lib/');

describe('Errors', function() {
  var config = {
    hydrater_function: __dirname + '/hydraters/buggy-hydrater.js',
    logger: function() {// Will be pinged with error. We don't care.
    },
    errLogger: function() {// Will be pinged with error. We don't care.
    }
  };
  var hydrationServer = anyfetchFileHydrater.createServer(config);

  it('should be handled gracefully while hydrating', function(done) {
    this.timeout(10000);
    request(hydrationServer).post('/hydrate')
      .send({
        file_path: 'http://anyfetch.com',
        callback: 'http://anyfetch.com/result',
        document: {
          metadata: {
            "foo": "bar"
          }
        }
      })
      .expect(204)
      .end(function() {});

    hydrationServer.queue.drain = function(err) {
      hydrationServer.queue.drain = null;
      done(err);
    };
  });

  it('should be handled gracefully with long_poll option while hydrating', function(done) {
    this.timeout(10000);

    request(hydrationServer).post('/hydrate')
      .send({
        file_path: 'http://anyfetch.com',
        callback: 'http://anyfetch.com/result',
        document: {
          metadata: {
            "foo": "bar"
          },
        },
        'long_poll': true
      })
      .expect(400)
      .expect(/err/i)
      .expect(/buggy/i)
      .expect(400)
      .end(done);
  });

  it.only('should be handled gracefully if file does not exists', function(done) {
    this.timeout(10000);

    request(hydrationServer).post('/hydrate')
      .send({
        file_path: 'http://oseftarace.com/NOPE?some_query',
        callback: 'http://oseftarace.com/result?some_query',
        document: {
          metadata: {
            "foo": "bar"
          },
        },
        'long_poll': true
      })
      .expect(400)
      .expect(/err/i)
      .expect(/downloading file/i)
      .expect(/404/i)
      .end(done);
  });
});

describe('hydrationErrors', function() {
  var config = {
    hydrater_function: __dirname + '/hydraters/errored-hydrater.js',
    logger: function() {// Will be pinged with error. We don't care.
    }
  };
  var hydrationErrorServer = anyfetchFileHydrater.createServer(config);

  it('should be handled gracefully while hydrating', function(done) {
    this.timeout(10000);

    var fakeApi = restify.createServer();
    fakeApi.use(restify.queryParser());
    fakeApi.use(restify.bodyParser());

    fakeApi.patch('/result', function(req, res, next) {
      //should
      res.send(204);
      next();

      if(req.params.hydration_errored && req.params.hydration_error === "hydrater errored") {
        done();
      }
      else {
        done(new Error("Invalid call"));
      }
      fakeApi.close();
    });
    fakeApi.listen(4242);

    request(hydrationErrorServer).post('/hydrate')
      .send({
        file_path: 'http://osef.com/',
        callback: 'http://127.0.0.1:4242/result',
        document: {
          metadata: {
            "foo": "bar"
          }
        }
      })
      .expect(202)
      .end(function(err) {
        if(err) {
          throw err;
        }
      });
  });
});
