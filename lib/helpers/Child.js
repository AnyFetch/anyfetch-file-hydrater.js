"use strict";

var fork = require('child_process').fork;


var Child = function(tasksPerProcess) {
  this.ttl = tasksPerProcess;
  this.available = true;

  this.process = fork(__dirname + '/child-process.js', {silent: true});

  this.reset = function() {
    this.process.kill('SIGKILL');
    this.process = fork(__dirname + '/child-process.js', {silent: true});
    this.ttl = tasksPerProcess;
    this.available = true;
  };

  this.clean = function() {
    this.process.removeAllListeners();
    this.process.stdout.removeAllListeners();
    this.process.stderr.removeAllListeners();
  };
};

module.exports = Child;
