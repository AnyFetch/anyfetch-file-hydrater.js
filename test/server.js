'use strict';

var request = require('supertest');

var cluestrFileHydrater = require('../lib/cluestr-file-hydrater/index.js');

var dummyHydrater = function(path, cb) {
  cb(null, {});
};

describe('POST /hydrate', function() {
  var config = {
    concurrency: 2
  };

  var server = cluestrFileHydrater.createServer(config, dummyHydrater);

  it('should refuse request without file_path', function(done) {
    request(server).post('/hydrate')
      .send({
        'metadatas': 'http://example.org/file',
        'callback': 'http://example.org'
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
    this.timeout(500);
    request(server)
      .post('/hydrate')
      .send({
        'metadatas': {},
        'file_path': 'http://example.org/file',
        'callback': 'http://example.org'
      })
      .expect(204)
      .end(done);
  });
});