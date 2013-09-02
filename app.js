'use strict';

// Load configuration and initialize server
var restify       = require('restify'),
    configuration = require('./config/configuration.js'),
    lib           = require("./lib/hydrater-tika"),
    server        = restify.createServer();


// Middleware Goes Here
server.use(restify.acceptParser(server.acceptable));
server.use(restify.queryParser());
server.use(restify.bodyParser());

// Load routes
require("./config/routes.js")(server, lib);

// Expose the server
module.exports = server;