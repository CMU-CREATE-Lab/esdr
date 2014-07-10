var mysql = require('mysql');
var flow = require('nimble');

var Users = require('./Users.js');
var Clients = require('./Clients.js');
var Tokens = require('./Tokens.js');

var config = require('../config');
var log = require('log4js').getLogger();

module.exports = {
   create : function(callback) {
      log.info("Initializing database...");

      var errors = [];
      var hasErrors = function() {
         return errors.length > 0
      };

      var pool = null;
      var db = {
         users : null,
         clients : null,
         tokens : null
      };

      // do the database initialization in serial order, since some tables have foreign keys to other tables
      flow.series(
            [
               // make sure the database exists
               function(done) {
                  log.info("1) Ensuring the database exists.");
                  var conn = mysql.createConnection({
                                                       host : config.get("database:host"),
                                                       user : config.get("database:username"),
                                                       password : config.get("database:password")
                                                    });

                  if (conn) {
                     conn.query("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = 'esdr'",
                                function(err1, rows) {
                                   if (err1) {
                                      errors.push(new Error("Error trying to query for the database: " + err1));
                                   }
                                   else {
                                      if (!(rows && rows.length > 0 && rows[0]['SCHEMA_NAME'] == "esdr")) {
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
                     log.info("2) Creating the connection pool.");
                     pool = mysql.createPool({
                                                connectionLimit : config.get("database:pool:connectionLimit"),
                                                host : config.get("database:host"),
                                                database : config.get("database:database"),
                                                user : config.get("database:username"),
                                                password : config.get("database:password")
                                             });
                  }
                  done();
               },

               // create the Users table, if necessary
               function(done) {
                  if (!hasErrors()) {
                     log.info("3) Ensuring the Users table exists.");
                     var users = new Users(pool);
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
                     log.info("4) Ensuring the Clients table exists.");
                     var clients = new Clients(pool);
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
                     log.info("5) Ensuring the Tokens table exists.");
                     var tokens = new Tokens(pool);
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
               }

            ],
            function() {

               if (hasErrors()) {
                  log.error("The following error(s) occurred during database initialization:");
                  errors.forEach(function(e) {
                     log.error("   " + e);
                  });

                  var error = new Error("Error(s) occurred during database initialization. See errors property in this object.");
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