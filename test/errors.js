'use strict';

require('should');
var request = require('supertest');


var cluestrFileHydrater = require('../lib/cluestr-file-hydrater/index.js');

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
  var hydrationServer = cluestrFileHydrater.createServer(config);

  it('should be handled gracefully', function(done) {
    this.timeout(4000);
    request(hydrationServer).post('/hydrate')
      .send({
        file_path: 'http://cluestr.com/file',
        callback: 'http://cluestr.com/result',
        metadatas: {
          "foo": "bar"
        }
      })
      .expect(204)
      .end(function() {});

    hydrationServer.queue.drain = function(err) {
      hydrationServer.queue.drain = null;
      done(err);
    };
  });

  it('should be handled gracefully with long_poll option', function(done) {
    this.timeout(4000);
    
    request(hydrationServer).post('/hydrate')
      .send({
        file_path: 'http://cluestr.com/file',
        callback: 'http://cluestr.com/result',
        metadatas: {
          "foo": "bar"
        },
        'long_poll': true
      })
      .expect(400)
      .end(function(err, res) {
        if(err) {
          throw err;
        }

        res.body.should.have.property('message').and.include('ERR');
        done();
      });
  });
});
