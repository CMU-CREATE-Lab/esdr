var log = require('log4js').getLogger();

var executeQuery = function(pool, query, params, callback) {
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

var findOne = function(pool, query, params, callback) {
   executeQuery(pool, query, params, function(err, rows) {
      if (err) {
         return callback(err);
      }
      if (rows && rows.length > 0) {
         return callback(null, rows[0]);
      }
      callback(null, null);
   })
};

var findOneUsingConnection = function(connection, query, params, callback) {
   connection.query(query, params, function(err, rows) {
      if (err) {
         return callback(err);
      }
      if (rows && rows.length > 0) {
         return callback(null, rows[0]);
      }
      callback(null, null);
   })
};

module.exports.executeQuery = executeQuery;
module.exports.findOne = findOne;
module.exports.findOneUsingConnection = findOneUsingConnection;