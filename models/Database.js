const mysql = require('mysql');
const flow = require('nimble');

const DatabaseHelper = require("./DatabaseHelper");
const Users = require('./Users.js');
const Clients = require('./Clients.js');
const Tokens = require('./Tokens.js');
const Products = require('./Products.js');
const Devices = require('./Devices.js');
const Feeds = require('./Feeds.js');
const Multifeeds = require('./Multifeeds.js');
const UserProperties = require('./UserProperties.js');
const FeedProperties = require('./FeedProperties.js');
const DeviceProperties = require('./DeviceProperties.js');
const MirrorRegistrations = require('./MirrorRegistrations.js');

const DuplicateRecordError = require('../lib/errors').DuplicateRecordError;

const config = require('../config');
const log = require('log4js').getLogger('esdr:models:database');

module.exports = {
   create : function(callback) {
      log.info("Initializing database...");

      const errors = [];
      const hasErrors = function() {
         return errors.length > 0
      };

      let databaseHelper = null;
      const db = {
         users : null,
         clients : null,
         tokens : null,
         products : null,
         devices : null,
         feeds : null,
         multifeeds : null,
         userProperties : null,
         feedProperties : null,
         deviceProperties : null,
         mirrorRegistrations : null
      };

      // do the database initialization in serial order, since some tables have foreign keys to other tables
      flow.series(
            [
               // make sure the database exists
               function(done) {
                  log.info(" 1) Ensuring the database exists.");
                  const conn = mysql.createConnection({
                                                         host : config.get("database:host"),
                                                         port : config.get("database:port"),
                                                         user : config.get("database:username"),
                                                         password : config.get("database:password")
                                                      });

                  if (conn) {
                     conn.query("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?",
                                [config.get("database:database")],
                                function(err1, rows) {
                                   if (err1) {
                                      errors.push(new Error("Error trying to query for the database: " + err1));
                                   }
                                   else {
                                      if (!(rows && rows.length > 0 && rows[0]['SCHEMA_NAME'] === config.get("database:database"))) {
                                         errors.push(new Error("Could not find the database."));
                                      }
                                   }

                                   // close the connection
                                   conn.end(function(err2) {
                                      if (err2) {
                                         errors.push(new Error("Error trying to close the connection after querying for the database: " + err2));
                                      }
                                      done();
                                   });
                                });
                  }
                  else {
                     errors.push(new Error("Failed to get a connection to the database."));
                     done();
                  }
               },

               // create the connection pool
               function(done) {
                  if (!hasErrors()) {
                     log.info(" 2) Creating the connection pool.");
                     const pool = mysql.createPool({
                                                      connectionLimit : config.get("database:pool:connectionLimit"),
                                                      host : config.get("database:host"),
                                                      port : config.get("database:port"),
                                                      database : config.get("database:database"),
                                                      user : config.get("database:username"),
                                                      password : config.get("database:password")
                                                   });
                     databaseHelper = new DatabaseHelper(pool);
                  }
                  done();
               },

               // create the Users table, if necessary
               function(done) {
                  if (!hasErrors()) {
                     log.info(" 3) Ensuring the Users table exists.");
                     const users = new Users(databaseHelper);
                     users.initialize(function(err) {
                        if (err) {
                           errors.push(err)
                        }
                        else {
                           db.users = users;
                        }

                        done();
                     });
                  }
                  else {
                     done();
                  }
               },

               // create the Clients table, if necessary
               function(done) {
                  if (!hasErrors()) {
                     log.info(" 4) Ensuring the Clients table exists.");
                     const clients = new Clients(databaseHelper);
                     clients.initialize(function(err) {
                        if (err) {
                           errors.push(err)
                        }
                        else {
                           db.clients = clients;
                        }

                        done();
                     });
                  }
                  else {
                     done();
                  }
               },

               // create the Tokens table, if necessary
               function(done) {
                  if (!hasErrors()) {
                     log.info(" 5) Ensuring the Tokens table exists.");
                     const tokens = new Tokens(databaseHelper);
                     tokens.initialize(function(err) {
                        if (err) {
                           errors.push(err)
                        }
                        else {
                           db.tokens = tokens;
                        }

                        done();
                     });
                  }
                  else {
                     done();
                  }
               },

               // create the Products table, if necessary
               function(done) {
                  if (!hasErrors()) {
                     log.info(" 6) Ensuring the Products table exists.");
                     const products = new Products(databaseHelper);
                     products.initialize(function(err) {
                        if (err) {
                           errors.push(err)
                        }
                        else {
                           db.products = products;
                        }

                        done();
                     });
                  }
                  else {
                     done();
                  }
               },

               // create the Devices table, if necessary
               function(done) {
                  if (!hasErrors()) {
                     log.info(" 7) Ensuring the Devices table exists.");
                     const devices = new Devices(databaseHelper);
                     devices.initialize(function(err) {
                        if (err) {
                           errors.push(err)
                        }
                        else {
                           db.devices = devices;
                        }

                        done();
                     });
                  }
                  else {
                     done();
                  }
               },

               // create the Feeds table, if necessary
               function(done) {
                  if (!hasErrors()) {
                     log.info(" 8) Ensuring the Feeds table exists.");
                     const feeds = new Feeds(databaseHelper);
                     feeds.initialize(function(err) {
                        if (err) {
                           errors.push(err)
                        }
                        else {
                           db.feeds = feeds;
                        }

                        done();
                     });
                  }
                  else {
                     done();
                  }
               },

               // create the Multifeeds table, if necessary
               function(done) {
                  if (!hasErrors()) {
                     log.info(" 9) Ensuring the Multifeeds table exists.");
                     const multifeeds = new Multifeeds(databaseHelper);
                     multifeeds.initialize(function(err) {
                        if (err) {
                           errors.push(err)
                        }
                        else {
                           db.multifeeds = multifeeds;
                        }

                        done();
                     });
                  }
                  else {
                     done();
                  }
               },

               // create the UserProperties table, if necessary
               function(done) {
                  if (!hasErrors()) {
                     log.info("10) Ensuring the UserProperties table exists.");
                     const userProperties = new UserProperties(databaseHelper);
                     userProperties.initialize(function(err) {
                        if (err) {
                           errors.push(err)
                        }
                        else {
                           db.userProperties = userProperties;
                        }

                        done();
                     });
                  }
                  else {
                     done();
                  }
               },

               // create the FeedProperties table, if necessary
               function(done) {
                  if (!hasErrors()) {
                     log.info("11) Ensuring the FeedProperties table exists.");
                     const feedProperties = new FeedProperties(databaseHelper);
                     feedProperties.initialize(function(err) {
                        if (err) {
                           errors.push(err)
                        }
                        else {
                           db.feedProperties = feedProperties;
                        }

                        done();
                     });
                  }
                  else {
                     done();
                  }
               },

               // create the DeviceProperties table, if necessary
               function(done) {
                  if (!hasErrors()) {
                     log.info("12) Ensuring the DeviceProperties table exists.");
                     const deviceProperties = new DeviceProperties(databaseHelper);
                     deviceProperties.initialize(function(err) {
                        if (err) {
                           errors.push(err)
                        }
                        else {
                           db.deviceProperties = deviceProperties;
                        }

                        done();
                     });
                  }
                  else {
                     done();
                  }
               },

               // create the MirrorRegistrations table, if necessary
               function(done) {
                  if (!hasErrors()) {
                     log.info("13) Ensuring the MirrorRegistrations table exists.");
                     const mirrorRegistrations = new MirrorRegistrations(databaseHelper);
                     mirrorRegistrations.initialize(function(err) {
                        if (err) {
                           errors.push(err)
                        }
                        else {
                           db.mirrorRegistrations = mirrorRegistrations;
                        }

                        done();
                     });
                  }
                  else {
                     done();
                  }
               },

               // create the ESDR client, if necessary
               function(done) {
                  if (!hasErrors()) {
                     log.info("14) Ensuring the ESDR client exists.");
                     const esdrClient = config.get("esdrClient");
                     db.clients.findByNameAndSecret(esdrClient.clientName,
                                                    esdrClient.clientSecret,
                                                    function(err, foundClient) {
                                                       if (err) {
                                                          errors.push(err);
                                                          done();
                                                       }
                                                       else {
                                                          if (foundClient) {
                                                             log.info("   Found client [" + esdrClient.clientName + "] with ID [" + foundClient.id + "]");
                                                             config.set("esdrClient:id", foundClient.id);
                                                             done();
                                                          }
                                                          else {
                                                             log.info("   Client [" + esdrClient.clientName + "] not found, creating...");
                                                             db.clients.create(esdrClient, null, function(err, creationResult) {
                                                                if (err && !(err instanceof DuplicateRecordError)) {
                                                                   errors.push(err);
                                                                }
                                                                else {
                                                                   log.info("   Client [" + esdrClient.clientName + "] created with ID [" + creationResult.insertId + "]");
                                                                   config.set("esdrClient:id", creationResult.insertId);
                                                                }
                                                                done();
                                                             });
                                                          }
                                                       }
                                                    });
                  }
                  else {
                     done();
                  }
               }
            ],
            function() {

               if (hasErrors()) {
                  log.error("The following error(s) occurred during database initialization:");
                  errors.forEach(function(e) {
                     log.error("   " + e);
                  });

                  const error = new Error("Error(s) occurred during database initialization. See errors property in this object.");
                  error.errors = errors;
                  callback(error, null);
               }
               else {
                  log.info("Database initialization complete!");
                  callback(null, db);
               }
            }
      );
   }
};