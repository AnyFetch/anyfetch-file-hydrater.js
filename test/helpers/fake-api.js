"use strict";

var restify = require('restify');
var fs = require('fs');

module.exports = function() {
  var fakeApi = restify.createServer();
  fakeApi.use(restify.queryParser());
  fakeApi.use(restify.bodyParser());
  fakeApi.use(restify.acceptParser(fakeApi.acceptable));

  fakeApi.get('/afile', function(req, res, next) {
    fs.createReadStream(__filename, {encoding: 'utf8'}).pipe(res);
    next();
  });
  return fakeApi;
}
