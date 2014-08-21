var config = require('nconf');
var log = require('log4js').getLogger();

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
                   "resetPasswordToken" : {
                      "willReturnViaApi" : false,
                      "willEmailToUser" : true
                   },
                   "verificationToken" : {
                      "willReturnViaApi" : false,
                      "willEmailToUser" : true
                   },
                   "security" : {
                      "tokenLifeSecs" : 3600
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
                   "mail" : {
                      "sender" : {
                         "name" : "ESDR Admin",
                         "email" : "esdr-admin@cmucreatelab.org"
                      },
                      "smtp" : {
                         "host" : "smtp.host.name.here",
                         "port" : 587,
                         "login" : "login",
                         "password" : "password"
                      }
                   }
                });

module.exports = config;