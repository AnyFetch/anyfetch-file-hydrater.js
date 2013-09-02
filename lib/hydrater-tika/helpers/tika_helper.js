'use strict';

/**
 * @file Helper for Tika file processing
 * For more information about Tika :
 * See http://tika.apache.org/1.4/gettingstarted.html
 */

var async = require('async');

var config = require('../../../config/configuration.js');

/**
 * Extract the content of the specified file
 *
 * @param {string} path Path of the specified file
 * @param {string} attr Specific behavior for tika processing (html, metadata, text, language)
 * @param {function} cb Callback, first parameter, is the error if any, then the processed data
 */
var extractData = function(path, attr, cb) {
  var allowedAttrs = ['html', 'metadata', 'text', 'language'];
  if(allowedAttrs.indexOf(attr) === -1) {
    cb(new Error('Invalid attr'));
  }
  
  var content = '';
  attr = '--' + attr;
  var spawn = require('child_process').spawn;
  var tika = spawn('java', ['-jar', config.tika_path, attr, path]);

  tika.stdout.on('data', function(data) {
    content += data.toString('utf8');
  });

  tika.stderr.on('data', function(data) {
    cb(new Error('Invalid processing: ' + data));
  });

  tika.on('close', function(code) {
    if (code !== 0) {
      return cb(new Error ('Invalid processing: ' + code));
    }

    cb(null, content);
  });
};


/**
 * Formatting the metadatas the right way to send it back to the API
 * Assumes valid data.
 *
 * @param {string} data The extracted metadata, e.g. "Created: adate\nModified: anotherdate"
 * @param {function} cb Callback, first parameter is the formatted object {'created': 'adate', 'modified': 'anotherdate'}
 */
var formatMetaData = function(data, cb) {
  var meta = {};
  var rowData = data.split('\n');
  rowData.forEach(function(item) {
    var splitted = item.split(': ');

    if(splitted[1]) {
      meta[splitted[0].toLowerCase()] = splitted[1];
    }
  });

  cb(meta);
};


/**
 * Extract all the accessible data with Tika
 *
 * @param {string} path Path to the file to process
 * @param {function} cb Callback
 */
module.exports = function (path, cb) {
  var html;
  var meta;
  var raw;

  async.parallel([
    function(cb){
      extractData(path, '--html', function(err, data) {
        html = data;
        cb(err);
      });
    },
    function(cb){
      extractData(path, '--metadata', function(err, data) {
        formatMetaData(data, function(formatedMeta) {
          meta = formatedMeta;
          cb(err);
        });
      });
    },
    function(cb){
      extractData(path, '--text', function(err, data) {
        raw = data;
        cb(err);
      });
    }
  ],
  function(err){
    if (err) {
      return cb(err);
    }

    var returnedDatas = {
      "meta": meta,
      "html": html,
      "raw": raw,
    };

    cb(null, returnedDatas);
  });
};
