var config = require('nconf');
var log = require('log4js').getLogger();

var nodeEnvironment = process.env.NODE_ENV;
var configFile = (nodeEnvironment == "test") ? './config-test.json' : './config.json';
log.info("Using config file: " + configFile);

config.argv().env().file({ file : configFile });

config.defaults({
                   "server" : {
                      "port" : 3000
                   },
                   "security" : {
                      "tokenLifeSecs" : 3600
                   },
                   "database" : {
                      "host" : "localhost",
                      "database" : "esdr",
                      "username" : "esdr",
                      "password" : "password",
                      "pool" : {
                         "connectionLimit" : 10
                      }
                   }
                });

module.exports = config;