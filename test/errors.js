'use strict';

require('should');
var request = require('supertest');


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
  after(function() {
    hydrationServer.close();
  });

  it('should be handled gracefully while hydrating', function(done) {
    this.timeout(10000);
    request(hydrationServer).post('/hydrate')
      .send({
        file_path: 'http://anyfetch.com',
        callback: 'http://anyfetch.com/result',
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

  it('should be handled gracefully with long_poll option while hydrating', function(done) {
    this.timeout(10000);
    
    request(hydrationServer).post('/hydrate')
      .send({
        file_path: 'http://anyfetch.com',
        callback: 'http://anyfetch.com/result',
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
        res.body.should.have.property('message').and.include('Invalid statusCode');
        done();
      });
  });
});
