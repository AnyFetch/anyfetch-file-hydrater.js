'use strict';

require('should');
var request = require('supertest');
var async = require('async');
var anyfetchFileHydrater = require('../lib/');
var createFakeApi = require('./helpers/fake-api.js');

var config = {
  hydrater_function: __dirname + '/hydraters/dummy-hydrater.js',
  concurrency: 1,
};

describe('POST /hydrate', function() {
  var fakeApi = createFakeApi();
  var server;
  before(function() {
    fakeApi.patch('/callback', function(req, res, next) {
      res.send(204);
      next();
    });
    fakeApi.listen(4243);

    server = anyfetchFileHydrater.createServer(config);
  });

  after(function clean(done) {
    async.waterfall([
      function cleanYaqs(cb) {
        server.queue.remove(cb);
      },
      function cleanApi(cb) {
        fakeApi.close(cb);
      },
    ], function(err) {
      done(err);
    });
  });

  it('should refuse request without callback', function(done) {
    request(server).post('/hydrate')
      .send({
        'file_path': 'http://127.0.0.1:4243/afile',
        'document': {
          'metadata': {},
        }
      })
      .expect(409)
      .end(done);
  });

  it('should immediately return 202', function(done) {
    this.timeout(300);
    request(server)
      .post('/hydrate')
      .send({
        'file_path': 'http://127.0.0.1:4243/afile',
        'callback': 'http://127.0.0.1:4243/callback',
        'document': {
          'metadata': {},
        }
      })
      .expect(202)
      .end(done);
  });
});


describe('GET /status', function() {
  it('should reply with current status', function(done) {
    var server = anyfetchFileHydrater.createServer(config);
    request(server).get('/status')
      .expect(200)
      .end(function(err, res) {
        if(err) {
          throw err;
        }
        try {
          res.body.should.have.property('status', 'ok');
          res.body.should.have.property('pending');
          res.body.should.have.property('processing');
        }
        catch(err) {
          return done(err);
        }
        server.queue.remove(done);
      });
  });
});


describe('createServer()', function() {
  it('should refuse to create without hydrater_function', function(done) {
    try {
      anyfetchFileHydrater.createServer({});
    } catch(e) {
      e.toString().should.containDeep('hydrater_function');
      return done();
    }

    done(new Error("Hydrater function was not asked"));
  });
});

describe('HydrationError()', function() {
  it('should send a custom error', function(done) {
    async.waterfall([
      function callError(cb) {
        cb(new anyfetchFileHydrater.HydrationError("test error"));
      }
    ],
    function(err) {
      if(err.message === "test error") {
        done();
      }
      else {
        done(err);
      }
    });
  });
});
