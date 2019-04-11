const flow = require('nimble');
const DatabaseError = require('../lib/errors').DatabaseError;
const DuplicateRecordError = require('../lib/errors').DuplicateRecordError;
const log = require('log4js').getLogger('esdr:models:databasehelper');

module.exports = function(pool) {
   const SELECT_PREFIX = "SELECT ";

   const self = this;

   this.execute = function(query, params, callback) {
      pool.getConnection(function(err1, connection) {
         if (err1) {
            return callback(new DatabaseError(err1, "Error obtaining the connection"), null);
         }

         connection.query(query, params, function(err2, result) {
            connection.release();

            if (err2) {
               if (err2.code === "ER_DUP_ENTRY") {
                  return callback(new DuplicateRecordError(err2));
               }

               return callback(new DatabaseError(err2, "Error executing query [" + query + "]"));
            }

            callback(null, result);
         });
      });
   };

   this.findOne = function(query, params, callback) {
      self.execute(query, params, function(err, rows) {
         if (err) {
            return callback(err);
         }
         if (rows && rows.length > 0) {
            return callback(null, rows[0]);
         }
         callback(null, null);
      })
   };

   this.findWithLimit = function(query, params, callback) {
      if (query && query.toUpperCase().indexOf(SELECT_PREFIX) === 0) {

         // modify the query by inserting SQL_CALC_FOUND_ROWS
         query = "SELECT SQL_CALC_FOUND_ROWS " + query.slice(SELECT_PREFIX.length);

         let connection = null;
         let rows = null;
         let totalCount = null;
         let error = null;
         const hasError = function() {
            return error != null;
         };

         flow.series(
               [
                  // get the connection
                  function(done) {
                     //log.debug("findWithLimit(): 1) Getting the connection");
                     pool.getConnection(function(err, newConnection) {
                        if (err) {
                           error = err;
                        }
                        else {
                           connection = newConnection;
                        }
                        done();
                     });
                  },

                  // begin the transaction
                  function(done) {
                     if (!hasError()) {
                        //log.debug("findWithLimit(): 2) Beginning the transaction");
                        connection.beginTransaction(function(err) {
                           if (err) {
                              error = err;
                           }
                           done();
                        });
                     }
                     else {
                        done();
                     }
                  },

                  // first execute the query with the SQL_CALC_FOUND_ROWS command included
                  function(done) {
                     if (!hasError()) {
                        //log.debug("findWithLimit(): 3) Execute the query");
                        connection.query(query,
                                         params,
                                         function(err, foundRows) {
                                            if (err) {
                                               error = err;
                                            }
                                            else {
                                               rows = foundRows;
                                            }
                                            done();
                                         });
                     }
                     else {
                        done();
                     }
                  },

                  // now call SELECT FOUND_ROWS() to determine the number of rows found had there been no LIMIT clause
                  function(done) {
                     if (!hasError() && rows) {
                        //log.debug("findWithLimit(): 4) determining number of rows that would have been found with a LIMIT clause");

                        connection.query("SELECT FOUND_ROWS() AS numFoundRows",
                                         [],
                                         function(err, result) {
                                            if (err) {
                                               error = err;
                                            }
                                            else {
                                               totalCount = result[0]['numFoundRows'];
                                            }
                                            done();
                                         });
                     }
                     else {
                        done();
                     }
                  }
               ],

               // handle outcome
               function() {
                  //log.debug("findWithLimit(): 5) All done, now checking status and performing commit/rollback as necessary!");
                  if (hasError() || rows == null) {
                     if (connection == null) {
                        log.error("findWithLimit():    An error occurred, but connection is null, so there's nothing to rollback. Error:" + error);
                        callback(error);
                     }
                     else {
                        connection.rollback(function() {
                           connection.release();
                           log.error("findWithLimit():    An error occurred while executing the find query, rolled back the transaction. Error:" + error);
                           callback(error);
                        });
                     }
                  }
                  else {
                     if (connection == null) {
                        log.error("findWithLimit():    No error, but the connection is null, so there's nothing to commit. This probably shouldn't ever happen?");
                        callback(null, { totalCount : totalCount, rows : rows });
                     }
                     else {
                        //log.debug("findWithLimit():    No errors while executing find query, committing...");
                        connection.commit(function(err) {
                           if (err) {
                              log.error("findWithLimit():    Failed to commit the transaction after executing find query");

                              // rollback and then release the connection
                              connection.rollback(function() {
                                 connection.release();
                                 callback(err);
                              });
                           }
                           else {
                              connection.release();
                              //log.debug("findWithLimit():    Commit successful!");
                              callback(null, { totalCount : totalCount, rows : rows });
                           }
                        });
                     }
                  }
               }
         );
      }
      else {
         return callback(new Error("Query must be non-null and start with 'SELECT '."));
      }
   };

   this.getConnection = function(callback) {
      pool.getConnection(callback);
   };
};