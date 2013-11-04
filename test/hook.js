'use strict';

require('should');
var request = require('supertest');
var restify = require('restify');
var fs = require('fs');


var cluestrFileHydrater = require('../lib/cluestr-file-hydrater/index.js');

var dummyHydrater = function(path, document, cb) {
  document.metadatas.path = path;
  document.metadatas.text = fs.readFileSync(path).toString();

  cb(null, document);
};

describe('/hydrate webhooks', function() {
  // Patch Cluestr URL
  // Avoid uselessly pinging cluestr.com with invalid requests
  process.env.CLUESTR_SERVER = 'http://localhost';

  var config = {
    hydrater_function: dummyHydrater,
    logger: function(str, err) {
      if(err) {
        throw err;
      }
    }
  };

  var hydrationServer = cluestrFileHydrater.createServer(config);

  it('should be pinged with hydrater result', function(done) {
    // Create a fake HTTP server to send a file and test results
    var fileServer = restify.createServer();
    fileServer.use(restify.acceptParser(fileServer.acceptable));
    fileServer.use(restify.queryParser());
    fileServer.use(restify.bodyParser());

    fileServer.get('/file', function(req, res, next) {
      fs.createReadStream(__filename).pipe(res);
      next();
    });

    fileServer.patch('/result', function(req, res, next) {
      try {
        req.params.should.have.property('metadatas');
        req.params.metadatas.should.have.property('foo', 'bar');
        req.params.metadatas.should.have.property('path');
        req.params.metadatas.should.have.property('text', fs.readFileSync(__filename).toString());
        res.send(204);

        next();

        done();
      } catch(e) {
        // We need a try catch cause mocha is try-catching on main event loop, and the server create a new stack. 
        done(e);
      }
    });
    fileServer.listen(1337);


    request(hydrationServer).post('/hydrate')
      .send({
        file_path: 'http://127.0.0.1:1337/file',
        callback: 'http://127.0.0.1:1337/result',
        metadatas: {
          "foo": "bar"
        }
      })
      .expect(204)
      .end(function() {});
  });
});
