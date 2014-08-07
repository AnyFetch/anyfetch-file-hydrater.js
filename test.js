'use strict';

var nodeDomain = require('domain');
var shellExec = require('child_process').exec;

var domain = nodeDomain.create();

var count = 0;

var log = function() {
  count += 0.1;
  console.log(count);
};

domain.run(function() {
  setInterval(log, 100);
  shellExec('watch -n 1 "echo haha >> /tmp/test"', function() {

  });
});

setTimeout(function() {
  console.log("killing");
  domain.exit();
  domain.dispose();
}, 10000);
