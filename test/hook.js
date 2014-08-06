'use strict';

require('should');
var request = require('supertest');
var restify = require('restify');
var fs = require('fs');


var anyfetchFileHydrater = require('../lib/');


describe('/hydrate webhooks', function() {
  // Patch AnyFetch URL
  // Avoid uselessly pinging anyfetch.com with invalid requests
  process.env.ANYFETCH_API_URL = 'http://localhost';

  var dummyHydrater;
  var hydrationFunction = function(path, document, changes, cb) {
    dummyHydrater(path, document, changes, cb);
  };
  var config = {
    hydrater_function: hydrationFunction,
    logger: function(str, err) {
      if(err) {
        throw err;
      }
    }
  };
  var hydrationServer = anyfetchFileHydrater.createServer(config);

  // Create a fake HTTP server to send a file and test results
  var fileServer = restify.createServer();
  fileServer.use(restify.acceptParser(fileServer.acceptable));
  fileServer.use(restify.queryParser());
  fileServer.use(restify.bodyParser());

  fileServer.get('/file', function(req, res, next) {
    fs.createReadStream(__filename).pipe(res);
    next();
  });
  fileServer.listen(1337);

  var patchFunction;
  fileServer.patch('/result', function(req, res, next) {
    patchFunction(req, res, next);
  });

  it('should be pinged with hydrater result', function(done) {
    dummyHydrater = function(path, document, changes, cb) {
      if(document.replace) {
        return cb();
      }

      changes.metadata.path = path;
      changes.metadata.text = fs.readFileSync(path).toString();

      cb(null, changes);
    };

    patchFunction = function(req, res, next) {
      try {
        req.params.should.have.property('metadata');
        req.params.metadata.should.not.have.property('foo');
        req.params.metadata.should.have.property('path');
        req.params.metadata.should.have.property('text', fs.readFileSync(__filename).toString());
        res.send(204);

        next();

        done();
      } catch(e) {
        // We need a try catch cause mocha is try-catching on main event loop, and the server create a new stack.
        done(e);
      }
    };

    request(hydrationServer).post('/hydrate')
      .send({
        file_path: 'http://127.0.0.1:1337/file',
        callback: 'http://127.0.0.1:1337/result',
        document: {
          metadata: {
            "foo": "bar"
          }
        }
      })
      .expect(204)
      .end(function() {});
  });

  it('should not be pinged on skipped task', function(done) {
    dummyHydrater = function(path, document, changes, cb) {
      return cb(null, null);
    };

    patchFunction = function() {
      done(new Error("should not be called"));
    };

    request(hydrationServer).post('/hydrate')
      .send({
        file_path: 'http://127.0.0.1:1337/file',
        callback: 'http://127.0.0.1:1337/result',
        document: {
          metadata: {
            "foo": "bar"
          }
        }
      })
      .expect(204)
      .end(function() {});

    var interval = setInterval(function() {
      if(hydrationServer.queue.length() === 0) {
        clearInterval(interval);
        done();
      }
    }, 25);

  });

  after(function() {
    fileServer.close();
  });
});
