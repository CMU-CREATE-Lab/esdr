var bcrypt = require('bcrypt');
var findOne = require('./db_utils').findOne;
var executeQuery = require('./db_utils').executeQuery;
var log = require('log4js').getLogger();

var CREATE_TABLE_QUERY = " CREATE TABLE IF NOT EXISTS `Users` ( " +
                         "`id` bigint(20) NOT NULL AUTO_INCREMENT, " +
                         "`username` varchar(255) NOT NULL, " +
                         "`password` varchar(255) NOT NULL, " +
                         "`email` varchar(255) NOT NULL, " +
                         "`created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
                         "`modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, " +
                         "PRIMARY KEY (`id`), " +
                         "UNIQUE KEY `unique_username` (`username`) " +
                         ") ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8";

module.exports = function(pool) {

   this.initialize = function(callback) {
      pool.getConnection(function(err1, connection) {
         if (err1) {
            callback(err1);
         }
         else {
            connection.query(CREATE_TABLE_QUERY, function(err2) {
               connection.release();

               if (err2) {
                  log.error("Error trying to create the Users table: " + err2);
                  callback(err2);
               }
               else {
                  callback(null, true);
               }
            });
         }
      });
   };

   this.create = function(userDetails, callback) {
      bcrypt.hash(userDetails.password, 8, function(err1, hashedPassword) {
         if (err1) {
            callback(err1);
         }
         else {
            var newUser = {
               username : userDetails.username,
               password : hashedPassword,
               email : userDetails.email
            };
            executeQuery(pool, "INSERT INTO Users SET ?", newUser, function(err2, result) {
               if (err2) {
                  log.error("Error trying to create user [" + newUser.username + "]: " + err2);
                  return callback(err2);
               }

               return callback(null, {insertId : result.insertId});
            });
         }
      });
   };

   /**
    * Tries to find the user with the given <code>userId</code> and returns it to the given <code>callback</code>. If
    * successful, the user is returned as the 2nd argument to the <code>callback</code> function.  If unsuccessful,
    * <code>null</code> is returned to the callback.
    *
    * @param {int} userId ID of the user to find.
    * @param {function} callback function with signature <code>callback(err, user)</code>
    */
   this.findById = function(userId, callback) {
      findUser(pool, "SELECT * FROM Users WHERE id=?", [userId], callback);
   };

   /**
    * Tries to find the user with the given <code>username</code> and returns it to the given <code>callback</code>. If
    * successful, the user is returned as the 2nd argument to the <code>callback</code> function.  If unsuccessful,
    * <code>null</code> is returned to the callback.
    *
    * @param {string} username username of the user to find.
    * @param {function} callback function with signature <code>callback(err, user)</code>
    */
   this.findByUsername = function(username, callback) {
      findUser(pool, "SELECT * FROM Users WHERE username=?", [username], callback);
   };

   /**
    * Tries to find the user with the given <code>username</code> and <code>clearTextPassword</code> and returns it to
    * the given <code>callback</code>. If successful, the user is returned as the 2nd argument to the
    * <code>callback</code> function.  If unsuccessful, <code>null</code> is returned to the callback.
    *
    * @param {string} username username of the user to find.
    * @param {string} clearTextPassword clear-text password of the user to find.
    * @param {function} callback function with signature <code>callback(err, user)</code>
    */
   this.findByUsernameAndPassword = function(username, clearTextPassword, callback) {
      this.findByUsername(username, function(err, user) {
         if (err) {
            return callback(err);
         }

         if (user && isValidPassword(user, clearTextPassword)) {
            return callback(null, user);
         }

         callback(null, null);
      });
   };

   var isValidPassword = function(user, clearTextPassword) {
      return bcrypt.compareSync(clearTextPassword, user.password);
   };

   var findUser = function(pool, query, params, callback) {
      findOne(pool, query, params, function(err, user) {
         if (err) {
            log.error("Error trying to find user: " + err);
            return callback(err);
         }

         return callback(null, user);
      });
   };
};
