var config = require('nconf');
var path = require('path');
var log = require('log4js').getLogger('esdr:config');

var nodeEnvironment = process.env.NODE_ENV || "development";
var configFile = './config-' + nodeEnvironment + '.json';
var mailConfigFile = './mail-config-' + nodeEnvironment + '.json';
log.info("Using config file:      " + configFile);
log.info("Using mail config file: " + mailConfigFile);

config.argv().env();
config.add('mail', { type : 'file', file : mailConfigFile });
config.add('global', { type : 'file', file : configFile });

config.defaults({
                   "server" : {
                      "port" : 3000
                   },
                   "esdrClient" : {
                      "displayName" : "ESDR",
                      "clientName" : "ESDR",
                      "clientSecret" : "What I cannot create, I do not understand.",
                      "email" : "esdr-admin@cmucreatelab.org",
                      "resetPasswordUrl" : "http://localhost:3000/password-reset/:resetPasswordToken",
                      "verificationUrl" : "http://localhost:3000/verification/:verificationToken"
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
                      "dataDirectory" : "./datastore/data-development"
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