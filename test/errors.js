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
    hydrater_function: buggyHydrater
  };
  var hydrationServer = cluestrFileHydrater.createServer(config);

  it('should be handled gracefully', function(done) {
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

    hydrationServer.queue.drain = done;
  });
});
