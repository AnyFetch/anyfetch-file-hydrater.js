"use strict";

var request = require("supertest");
var async = require("async");


var apiUrl = "https://api.anyfetch.com";
var token = "8908af446f7ffbbc0b02e83bef62bf84cde5f48624e2aae8d1f5d3e6fe8ce8ee";

var tokenApiRequest = function tokenApiRequest(method, url) {
  return request(apiUrl)
    [method](url)
    .set('Authorization', "Bearer " + token);
};

var sendDocument = function sendDocument(payload) {
  return function(done) {
    tokenApiRequest('post', '/documents')
      .send(payload)
      .expect(200)
      .end(function(err) {
        done(err);
        done();
      });
  };
};


/**
 * Associate file with identifier
 */
var sendFile = function sendFile(payload, file) {
  return function(done) {
    tokenApiRequest('post', '/documents/' + payload.id + '/file')
      .attach('file', file)
      .expect(204)
      .end(done);
  };
};

var payload = {
  document_type: 'email',
  metadata: {
    text: 'Salut !\n----- forwarded message ------\nDe : buathi_q@epitech.eu....'
  },
};

async.forever(
  function(cb) {
    sendDocument(payload)(cb);
  },
  function(err) {
    console.log(err);
  }
);



