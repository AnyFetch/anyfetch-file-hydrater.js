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

var Childs = function(concurrency, tasksPerProcess) {
  this.childs = [];
  for(var i = 0; i < concurrency; i += 1) {
    this.childs[i] = new Child(tasksPerProcess);
  }

  this.getAvailableChild = function() {
    var availableChilds = this.childs.filter(function(child) {
      return child.available;
    });
    if(availableChilds.length === 0) {
      console.error("No available child found !");
      process.exit(1);
    }
    else {
      return availableChilds[0];
    }
  };

  this.getOrForkChild = function() {
    var child = this.getAvailableChild();
    child.ttl -= 1;
    if(child.ttl > 0) {
      child.clean();
      child.available = false;
      return child;
    }
    else {
      child.reset();
      child.available = false;
      return child;
    }
  };
};


module.exports = Childs;
