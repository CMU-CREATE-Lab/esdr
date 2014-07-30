var DatabaseError = require('../lib/errors').DatabaseError;
var DuplicateRecordError = require('../lib/errors').DuplicateRecordError;

module.exports = function(pool) {
   var self = this;

   this.execute = function(query, params, callback) {
      pool.getConnection(function(err1, connection) {
         if (err1) {
            return callback(new DatabaseError(err1, "Error obtaining the connection"), null);
         }

         connection.query(query, params, function(err2, result) {
            connection.release();

            if (err2) {
               if (err2.code == "ER_DUP_ENTRY") {
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

   this.getConnection = function(callback) {
      pool.getConnection(callback);
   };
};