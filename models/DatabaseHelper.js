var flow = require('nimble');
var log = require('log4js').getLogger();

module.exports = function(pool) {
   var self = this;

   this.execute = function(query, params, callback) {
      pool.getConnection(function(err1, connection) {
         if (err1) {
            return callback(err1, null);
         }

         connection.query(query, params, function(err2, result) {
            connection.release();

            if (err2) {
               return callback(err2);
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