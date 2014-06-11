'use strict';

require('should');
var request = require('supertest');
var restify = require('restify');

var anyfetchFileHydrater = require('../lib/');

var buggyHydrater = function() {
  // Fake async stuff
  process.nextTick(function() {
    throw new Error("I'm buggy");
  });
};

describe('Errors', function() {
  var config = {
    hydrater_function: buggyHydrater,
    logger: function() {// Will be pinged with error. We don't care.
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
      .end(function(err, res) {
        if(err) {
          throw err;
        }

        res.body.should.have.property('message').and.include('ERR');
        res.body.should.have.property('message').and.include('buggy');
        done();
      });
  });

  it('should be handled gracefully if file does not exists', function(done) {
    this.timeout(10000);

    request(hydrationServer).post('/hydrate')
      .send({
        file_path: 'http://anyfetch.com/NOPE',
        callback: 'http://anyfetch.com/result',
        document: {
          metadata: {
            "foo": "bar"
          },
        },
        'long_poll': true
      })
      .expect(400)
      .end(function(err, res) {
        if(err) {
          throw err;
        }

        res.body.should.have.property('message').and.include('ERR');
        res.body.should.have.property('message').and.include('Invalid statusCode');
        res.body.should.have.property('message').and.include('404');
        done();
      });
  });
});

describe('hydrationErrors', function() {
  var erroredHydrater = function(path, document, changes, cb) {
    // Fake async stuff
    process.nextTick(function() {
      cb(new anyfetchFileHydrater.hydrationError("hydrater errored"));
    });
  };

  var config = {
    hydrater_function: erroredHydrater,
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
      if(req.params.hydration_errored && req.params.hydration_error === "hydrater errored") {
        done();
      }
      else {
        done(new Error("Invalid call"));
      }
      next();
      fakeApi.close();
    });
    fakeApi.listen(4242);

    request(hydrationErrorServer).post('/hydrate')
      .send({
        file_path: 'http://anyfetch.com/',
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
