var config = require('nconf');
var path = require('path');
var log = require('log4js').getLogger('esdr:config');
var RunMode = require('run-mode');

var configFile = './config-' + RunMode.get() + '.json';
var mailConfigFile = './mail-config-' + RunMode.get() + '.json';
log.info("Using config file:      " + configFile);
log.info("Using mail config file: " + mailConfigFile);

config.argv().env();
config.add('mail', { type : 'file', file : mailConfigFile });
config.add('global', { type : 'file', file : configFile });

config.defaults({
                   "server" : {
                      "port" : 3000
                   },
                   "esdr" : {
                      // the URL a client (e.g. web browser) must use to access the ESDR REST API
                      "apiRootUrl" : "http://localhost:3000/api/v1",
                      // the URL that the ESDR server must use to access itself for OAuth (should be localhost)
                      "oauthRootUrl" : "http://localhost:3000/oauth/token"
                   },
                   "cookie" : {
                      "name" : "esdr_sid",
                      "secret" : "Thou art my heaven, and I thine eremite."
                   },
                   "esdrClient" : {
                      "displayName" : "ESDR",
                      "clientName" : "ESDR",
                      "clientSecret" : "What I cannot create, I do not understand.",
                      "email" : "esdr-admin@cmucreatelab.org",
                      "resetPasswordUrl" : "http://localhost:3000/password-reset/:resetPasswordToken",
                      "verificationUrl" : "http://localhost:3000/verification/:verificationToken",
                      "isPublic" : true
                   },
                   "httpAccessLogDirectory" : path.join(__dirname, './logs/access.log'),
                   "resetPasswordToken" : {
                      "willReturnViaApi" : false,
                      "willEmailToUser" : true
                   },
                   "verificationToken" : {
                      "willReturnViaApi" : false,
                      "willEmailToUser" : true
                   },
                   "security" : {
                      "tokenLifeSecs" : 7 * 24 * 60 * 60 // 7 days
                   },
                   "database" : {
                      "host" : "localhost",
                      "port" : "3306",
                      "database" : "esdr",
                      "username" : "esdr",
                      "password" : "password",
                      "pool" : {
                         "connectionLimit" : 10
                      }
                   },
                   "datastore" : {
                      "binDirectory" : "./datastore/bin",
                      "dataDirectory" : "./datastore/data-dev"
                   },
                   "mail" : {
                      "smtp" : {
                         "host" : "smtp.host.name.here",
                         "port" : 587,
                         "login" : "login",
                         "password" : "password"
                      }
                   }
                });

module.exports = config;