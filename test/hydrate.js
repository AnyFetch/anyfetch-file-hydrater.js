'use strict';

var request = require('supertest');
var should = require('should');
var async = require('async');

var app = require('../app.js');
var config = require('../config/configuration.js');


describe('POST /hydrate API endpoint', function() {
  it('should refuse every request without a file', function(done) {
    request(app).post('/hydrate')
      .expect(405)
      .end(done);
  });

  it('should accept request with a file attached', function(done) {
    request(app).post('/hydrate')
      .attach('file', __filename)
      .expect(200)
      .end(done);
  });

  it('should respond with the correct informations', function(done) {
    request(app).post('/hydrate')
      .attach('file', __filename)
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function(err, res) {

      res.body.should.have.property('raw');
      res.body.should.have.property('html');
      res.body.should.have.property('content-encoding');

      done();
    });
  });
});
