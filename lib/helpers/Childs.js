"use strict";

var fork = require('child_process').fork;


/**
 * Manage a child process
 */
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

  this.terminate = function() {
    this.process.kill('SIGTERM');
  };
};


/**
 * Manage a pool of childs process
 */
var Childs = function(concurrency, tasksPerProcess) {
  this.childs = [];
  for(var i = 0; i < concurrency; i += 1) {
    this.childs[i] = new Child(tasksPerProcess);
  }
};

// Return the first available child
Childs.prototype.getAvailableChild = function() {
  var availableChilds = this.childs.filter(function(child) {
    return child.available;
  });

  return availableChilds[0];
};

// Find a worker to do the task.
// Recycle oldest workers to avoid memory leaks
Childs.prototype.getOrForkChild = function() {
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

// Terminate everyone
Childs.prototype.stopAllChilds = function() {
  this.childs.forEach(function(child) {
    child.terminate();
  });
};


module.exports = Childs;
