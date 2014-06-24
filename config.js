var config = require('nconf');

config.argv().env().file({ file : './config.json' });

config.defaults({
                   "server" : {
                      "port" : 3000
                   },
                   "cookie" : {
                      "secret" : "YOUR_COOKIE_SECRET"
                   },
                   "security" : {
                      "tokenLifeSecs" : 3600
                   },
                   "database" : {
                      "url" : "mongodb://localhost/esdr",
                      "options" : {
                         "server" : {
                            "socketOptions" : {
                               "keepAlive" : 1
                            }
                         },
                         "replset" : {
                            "socketOptions" : {
                               "keepAlive" : 1
                            }
                         }
                      }
                   }
                });

module.exports = config;