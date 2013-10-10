'use strict';

require('should');
var request = require('supertest');
var restify = require('restify');
var fs = require('fs');


var cluestrFileHydrater = require('../lib/cluestr-file-hydrater/index.js');

var dummyHydrater = function(path, cb) {
  console.log("Hydrating");
  cb(null, {
    foo: "bar",
    path: path,
    text: fs.readFileSync(path).toString()
  });
};

describe('/hydrate webhooks', function() {
  var config = {
    concurrency: 2,
    hydrater_url: 'http://myhydrater.com'
  };

  var hydrationServer = cluestrFileHydrater.createServer(config, dummyHydrater);

  it('should be pinged with hydrater result', function(done) {
    //WARNING.
    // Is this test timeouting? This is due to should conditions being done beyond the standard event loop, and not properly bubbled up to Mocha.
    // So, in case of timeout, just uncomment the console.log a few lines below.

    // Create a fake HTTP server
    var fileServer = restify.createServer();
    fileServer.use(restify.acceptParser(fileServer.acceptable));
    fileServer.use(restify.queryParser());
    fileServer.use(restify.bodyParser());

    fileServer.get('/file', function(req, res, next) {
      console.log("Asked for file");
      fs.createReadStream(__filename).pipe(res);
      next();
    });

    fileServer.patch('/result', function(req, res, next) {
      console.log("Got results");
      // Uncomment on test timeout
      //console.log(req.params);

      req.params.should.have.property('hydrater', config.hydrater_url + "/hydrate");
      req.params.should.have.property('metadatas');
      req.params.metadatas.should.have.property('foo', 'bar');
      req.params.metadatas.should.have.property('path');
      req.params.metadatas.should.have.property('text', fs.readFileSync(__filename).toString());
      res.send(204);

      next();

      done();
    });
    fileServer.listen(1337);


    request(hydrationServer).post('/hydrate')
      .send({
        metadatas: {},
        file_path: 'http://127.0.0.1:1337/file',
        callback: 'http://127.0.0.1:1337/result'
      })
      .expect(204)
      .end(function() {});
  });
});
