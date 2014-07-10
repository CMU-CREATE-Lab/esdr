var findOne = require('./db_utils').findOne;
var executeQuery = require('./db_utils').executeQuery;
var log = require('log4js').getLogger();

var CREATE_TABLE_QUERY = " CREATE TABLE IF NOT EXISTS `Clients` ( " +
                         "`id` bigint(20) NOT NULL AUTO_INCREMENT, " +
                         "`prettyName` varchar(255) NOT NULL, " +
                         "`clientName` varchar(255) NOT NULL, " +
                         "`clientSecret` varchar(255) NOT NULL, " +
                         "`created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
                         "PRIMARY KEY (`id`), " +
                         "UNIQUE KEY `unique_clientName` (`clientName`) " +
                         ") ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8";

module.exports = function(pool) {

   this.initialize = function(callback) {
      pool.getConnection(function(err1, connection) {
         if (err1) {
            callback(err1, null);
         }
         else {
            connection.query(CREATE_TABLE_QUERY, function(err2) {
               connection.release();

               if (err2) {
                  log.error("Error trying to create the Clients table: " + err2);
                  callback(err2, null);
               }
               else {
                  callback(null, true);
               }
            });
         }
      });
   };

   this.create = function(clientDetails, callback) {
      var newClient = {
         prettyName : clientDetails.prettyName,
         clientName : clientDetails.clientName,
         clientSecret : clientDetails.clientSecret
      };
      executeQuery(pool, "INSERT INTO Clients SET ?", newClient, function(err, result) {
         if (err) {
            log.error("Error trying to create client [" + newClient.prettyName + "]: " + err);
            return callback(err);
         }

         return callback(null, {insertId : result.insertId});
      });
   };

   /**
    * Tries to find the client with the given <code>clientName</code> and returns it to the given <code>callback</code>. If
    * successful, the client is returned as the 2nd argument to the <code>callback</code> function.  If unsuccessful,
    * <code>null</code> is returned to the callback.
    *
    * @param {string} clientName name of the client to find.
    * @param {function} callback function with signature <code>callback(err, client)</code>
    */
   this.findByName = function(clientName, callback) {
      findClient(pool, "SELECT * FROM Clients WHERE clientName=?", [clientName], callback);
   };

   /**
    * Tries to find the client with the given <code>clientName</code> and <code>clientSecret</code> and returns it to
    * the given <code>callback</code>. If successful, the client is returned as the 2nd argument to the
    * <code>callback</code> function.  If unsuccessful, <code>null</code> is returned to the callback.
    *
    * @param {string} clientName name of the client to find.
    * @param {string} clientSecret secret of the client to find.
    * @param {function} callback function with signature <code>callback(err, client)</code>
    */
   this.findByNameAndSecret = function(clientName, clientSecret, callback) {
      findClient(pool, "SELECT * FROM Clients WHERE clientName=? and clientSecret=?", [clientName, clientSecret], callback);
   };

   var findClient = function(pool, query, params, callback) {
      findOne(pool, query, params, function(err, client) {
         if (err) {
            log.error("Error trying to find client: " + err);
            return callback(err);
         }

         return callback(null, client);
      });
   };
};
