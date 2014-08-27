'use strict';

require('should');
var request = require('supertest');
var async = require('async');
var anyfetchFileHydrater = require('../lib/');

var config = {
  hydrater_function: __dirname + '/hydraters/dummy-hydrater.js',
  logger: function(str, err) {
    if(err) {
      throw err;
    }
  }
};

describe('POST /hydrate', function() {
  var fakeApi = require('./helpers/fake-api.js')();
  before(function() {

    fakeApi.patch('/callback', function(req, res, next) {
      res.send(204);
      next();
    });
    fakeApi.listen(4243);
  });

  after(function() {
    fakeApi.close();
  });

  var server = anyfetchFileHydrater.createServer(config);

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

  it('should accept request without callback when long_polling', function(done) {
    request(server).post('/hydrate')
      .send({
        'file_path': 'http://127.0.0.1:4243/afile',
        'long_poll': true,
        'document': {
          'metadata': {},
        }
      })
      .expect(200)
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

  it('should allow for long polling', function(done) {
    this.timeout(10000);

    request(server)
      .post('/hydrate')
      .send({
        'file_path': 'http://127.0.0.1:4243/afile',
        'callback': 'http://127.0.0.1:4243/callback',
        'long_poll': true,
        'document': {
          'metadata': {},
        }
      })
      .expect(200)
      .expect(function(res){
        res.body.should.have.property('metadata').and.have.property('hydrated').and.equal(true);
      })
      .end(done);
  });
});


describe('GET /status', function() {
  var server = anyfetchFileHydrater.createServer(config);

  it('should reply with current status', function(done) {
    request(server).get('/status')
      .expect(200)
      .end(function(err, res) {
        if(err) {
          throw err;
        }

        res.body.should.have.property('status', 'ok');
        res.body.should.have.property('queued_items', 0);

        done();
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
      function callError(cb){
        cb(new anyfetchFileHydrater.HydrationError("test error"));
      }
    ],
    function(err){
      if(err.message === "test error") {
        done();
      }
      else {
        done(err);
      }
    });
  });
});
