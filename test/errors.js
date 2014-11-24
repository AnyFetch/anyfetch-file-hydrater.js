'use strict';

require('should');
var request = require('supertest');
var anyfetchFileHydrater = require('../lib/');

describe('Errors', function() {
  var hydrationServer;

  before(function() {
    var config = {
      hydraterUrl: "test-hydrater",
      hydrater_function: __dirname + '/hydraters/buggy-hydrater.js',
      concurrency: 1,
      logger: function() {}, // Will be pinged with error. We don't care.
      errLogger: function() {} // Will be pinged with error. We don't care.

    };

    hydrationServer = anyfetchFileHydrater.createServer(config);
  });

  after(function(done) {
    hydrationServer.queue.remove(done);
  });

  describe('in lib', function() {
    var fakeApi = require('./helpers/fake-api.js')();
    before(function() {
      fakeApi.get('/notafile', function(req, res, next) {
        res.send(404);
        next();
      });
      fakeApi.listen(4243);
    });

    after(function() {
      fakeApi.close();
    });

    it('should be handled gracefully while hydrating', function(done) {
      this.timeout(10000);
      request(hydrationServer).post('/hydrate')
        .send({
          file_path: 'http://127.0.0.1:4243/afile',
          callback: 'http://127.0.0.1:4243/result',
          document: {
            metadata: {
              "foo": "bar"
            }
          }
        })
        .expect(202)
        .end(function() {});

      hydrationServer.queue.once('empty', function() {
        done();
      });
    });

    it('should be handled gracefully if file does not exists', function(done) {
      this.timeout(10000);

      var fakeApi = require('./helpers/fake-api.js')();
      fakeApi.patch('/result', function(req, res, next) {
        res.send(204);
        next();
        if(req.params.hydration_error === 'Error when downloading file http://127.0.0.1:4244/notafile: 404') {
          done();
        }
        else {
          done(new Error("Should send an error"));
        }
        fakeApi.close();

      });

      fakeApi.listen(4244);

      request(hydrationServer).post('/hydrate')
        .send({
          file_path: 'http://127.0.0.1:4244/notafile',
          callback: 'http://127.0.0.1:4244/result',
          document: {
            metadata: {
              "foo": "bar"
            },
          }
        })
        .expect(202)
        .end(function() {});
    });
  });

  describe('in hydrators', function() {

    var hydrationErrorServer;

    before(function() {
      var config = {
        hydrater_function: __dirname + '/hydraters/errored-hydrater.js',
        logger: function() {// Will be pinged with error. We don't care.
        }
      };
      hydrationErrorServer = anyfetchFileHydrater.createServer(config);
    });

    after(function(done) {
      hydrationErrorServer.queue.remove(done);
    });

    it('should be handled gracefully while hydrating', function(done) {
      var fakeApi = require('./helpers/fake-api.js')();
      fakeApi.patch('/result', function(req, res, next) {
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

      fakeApi.listen(4243);

      request(hydrationErrorServer).post('/hydrate')
        .send({
          file_path: 'http://127.0.0.1:4243/afile',
          callback: 'http://127.0.0.1:4243/result',
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
});
