'use strict';

require('should');
var request = require('supertest');

var cluestrFileHydrater = require('../lib/cluestr-file-hydrater/index.js');


var dummyHydrater = function(path, document, cb) {
  document.metadatas.hydrated = true;
  cb(null, document);
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

  var server = cluestrFileHydrater.createServer(config);

  it('should refuse request without file_path', function(done) {
    request(server).post('/hydrate')
      .send({
        'metadatas': {},
        'callback': 'http://cluestr.com/callback'
      })
      .expect(405)
      .end(done);
  });

  it('should refuse request without callback', function(done) {
    request(server).post('/hydrate')
      .send({
        'metadatas': {},
        'file_path': 'http://cluestr.com/file'
      })
      .expect(405)
      .end(done);
  });

  it('should immediately return 202', function(done) {
    this.timeout(300);
    request(server)
      .post('/hydrate')
      .send({
        'metadatas': {},
        'file_path': 'http://cluestr.com/file',
        'callback': 'http://cluestr.com/callback'
      })
      .expect(202)
      .end(done);
  });

  it('should allow for long polling', function(done) {
    this.timeout(4000);
    
    request(server)
      .post('/hydrate')
      .send({
        'metadatas': {},
        'file_path': 'http://cluestr.com/file',
        'callback': 'http://cluestr.com/callback',
        'long_poll': true
      })
      .expect(200)
      .end(function(err, res) {
        if(err) {
          throw err;
        }
        res.body.should.have.property('metadatas').and.have.property('hydrated').and.equal(true);
        done();
      });
  });
});


describe('GET /status', function() {
  var server = cluestrFileHydrater.createServer(config);

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
      cluestrFileHydrater.createServer({});
    } catch(e) {
      e.toString().should.include('hydrater_function');
      return done();
    }

    done(new Error("Hydrater function was not asked"));
  });
});
