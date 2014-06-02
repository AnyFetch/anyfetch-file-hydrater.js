'use strict';

require('should');
var request = require('supertest');
var async = require('async');
var anyfetchFileHydrater = require('../lib/');


var dummyHydrater = function(path, document, changes, cb) {
  changes.metadata.hydrated = true;

  cb(null, changes);
};

var config = {
  hydrater_function: dummyHydrater,
  logger: function(str, err) {
    if(err) {
      throw err;
    }
  }
};

describe('POST /hydrate', function() {

  var server = anyfetchFileHydrater.createServer(config);

  it('should refuse request without file_path', function(done) {
    request(server).post('/hydrate')
      .send({
        'callback': 'http://anyfetch.com/callback',
        'document': {
          'metadata': {},
        }
      })
      .expect(405)
      .end(done);
  });

  it('should refuse request without callback', function(done) {
    request(server).post('/hydrate')
      .send({
        'file_path': 'http://anyfetch.com/file',
        'document': {
          'metadata': {},
        }
      })
      .expect(405)
      .end(done);
  });

  it('should accept request without callback when long_polling', function(done) {
    request(server).post('/hydrate')
      .send({
        'file_path': 'http://anyfetch.com',
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
        'file_path': 'http://anyfetch.com/',
        'callback': 'http://anyfetch.com/callback',
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
        'file_path': 'http://anyfetch.com/',
        'callback': 'http://anyfetch.com/callback',
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
      e.toString().should.include('hydrater_function');
      return done();
    }

    done(new Error("Hydrater function was not asked"));
  });
});

describe('hydrationError()', function() {
  it('should send a custom error', function(done) {
    async.waterfall([
      function callError(cb){
        cb(new anyfetchFileHydrater.hydrationError("test error"));
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
