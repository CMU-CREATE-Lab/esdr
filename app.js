// dependencies
var config = require('./config');
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var compress = require('compression');
var requestLogger = require('morgan');
var bodyParser = require('body-parser');
var passport = require('passport');
var mongoose = require('mongoose');
var log = require('log4js').getLogger();

// decorate express.response with JSend methods
require('./lib/jsend');

// models
var models = require('./models');
var AccessTokenModel = models.AccessTokenModel;
var ClientModel = models.ClientModel;
var UserModel = models.UserModel;
var RefreshTokenModel = models.RefreshTokenModel;

// middleware
var oauthServer = require('./middleware/oauth2')(UserModel, RefreshTokenModel, models.generateNewTokens);   // create and configure OAuth2 server
var error_handlers = require('./middleware/error_handlers');

var app = null;

// Got all this connection business from http://phaninder.com/posts/mongodbmongoose-connect-best-practices
mongoose.connection.on("connected", function() {
   log.info("Connected to database!");

   // MIDDLEWARE ------------------------------------------------------------------------------------------------------

   // setup middleware
   app.use(favicon(path.join(__dirname, 'public/favicon.ico')));     // favicon serving
   app.use(requestLogger('dev'));      // request logging
   app.use(compress());                // enables gzip compression
   app.use(bodyParser.urlencoded({ extended : true }));     // form parsing
   app.use(bodyParser.json());         // json body parsing
   app.use(function(error, req, res, next) { // function MUST have arity 4 here!
      // catch invalid JSON error (found at http://stackoverflow.com/a/15819808/703200)
      res.status(400).json({status : "fail", data : "invalid JSON"})
   });
   app.use(passport.initialize());                                   // initialize passport (must come AFTER session middleware)
   app.use(express.static(path.join(__dirname, 'public')));          // static file serving

   // configure passport
   require('./middleware/auth')(ClientModel, UserModel, AccessTokenModel);

   // ROUTING ----------------------------------------------------------------------------------------------------------

   // configure routing
   app.use('/oauth', require('./routes/oauth')(oauthServer));
   app.use('/api/v1/users', require('./routes/api/users')(UserModel));
   app.use('/', require('./routes/index'));

   // ERROR HANDLERS ---------------------------------------------------------------------------------------------------

   // custom 404
   app.use(error_handlers.http404);

   // dev and prod should handle errors differently: e.g. don't show stacktraces in prod
   app.use((app.get('env') === 'development') ? error_handlers.development : error_handlers.production);

});

// If the connection throws an error
mongoose.connection.on("error", function(err) {
   console.error('Failed to connect to database on startup ', err);
});

// When the connection is disconnected
mongoose.connection.on('disconnected', function() {
   log.info('Mongoose default connection to database disconnected');
});

var gracefulExit = function() {
   mongoose.connection.close(function() {
      log.info('Mongoose connection with database is disconnected due to app termination');
      process.exit(0);
   });
};

// If the Node process ends, close the Mongoose connection
process
      .on('SIGINT', gracefulExit)
      .on('SIGTERM', gracefulExit);

// create the app and connect to the database
try {
   app = express();
   log.info("Environment: " + app.get('env'));

   module.exports = app;
   mongoose.connect(config.get("database:url"), config.get("database:options"));
   log.info("Connecting to database...");
}
catch (err) {
   log.error("Sever initialization failed ", err.message);
}
