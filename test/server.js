'use strict';

require('should');
var request = require('supertest');

var cluestrFileHydrater = require('../lib/cluestr-file-hydrater/index.js');


var dummyHydrater = function(path, document, cb) {
  document.metadatas.hydrated = true;
  cb(null, document);
};

describe('POST /hydrate', function() {
  var config = {
    hydrater_function: dummyHydrater,
  };

  var server = cluestrFileHydrater.createServer(config);

  it('should refuse request without file_path', function(done) {
    request(server).post('/hydrate')
      .send({
        'metadatas': 'http://example.org/file',
        'callback': 'http://localhost/'
      })
      .expect(405)
      .end(done);
  });

  it('should refuse request without callback', function(done) {
    request(server).post('/hydrate')
      .send({
        'metadatas': {},
        'file_path': 'http://example.org/file'
      })
      .expect(405)
      .end(done);
  });

  it('should immediately return 204', function(done) {
    this.timeout(300);
    request(server)
      .post('/hydrate')
      .send({
        'metadatas': {},
        'file_path': 'http://example.org/file',
        'callback': 'http://localhost/'
      })
      .expect(204)
      .end(done);
  });

  it('should allow for long polling', function(done) {
    request(server)
      .post('/hydrate')
      .send({
        'metadatas': {},
        'file_path': 'http://example.org/file',
        'callback': 'http://localhost/',
        'long_poll': true
      })
      .expect(200)
      .end(function(err, res) {
        if(err) {
          throw err;
        }

        console.log(res.body);
        done();
      });
  });
});
