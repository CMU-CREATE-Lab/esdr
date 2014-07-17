var bcrypt = require('bcrypt');
var findOne = require('./db_utils').findOne;
var executeQuery = require('./db_utils').executeQuery;
var trimAndCopyPropertyIfNonEmpty = require('../lib/objectUtils').trimAndCopyPropertyIfNonEmpty;
var JaySchema = require('jayschema');
var jsonValidator = new JaySchema();
var log = require('log4js').getLogger();

var CREATE_TABLE_QUERY = " CREATE TABLE IF NOT EXISTS `Users` ( " +
                         "`id` bigint(20) NOT NULL AUTO_INCREMENT, " +
                         "`email` varchar(255) NOT NULL, " +
                         "`password` varchar(255) NOT NULL, " +
                         "`displayName` varchar(255) DEFAULT NULL, " +
                         "`created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
                         "`modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, " +
                         "PRIMARY KEY (`id`), " +
                         "UNIQUE KEY `unique_email` (`email`) " +
                         ") ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8";

var JSON_SCHEMA = {
   "$schema" : "http://json-schema.org/draft-04/schema#",
   "title" : "User",
   "description" : "An ESDR user",
   "type" : "object",
   "properties" : {
      "email" : {
         "type" : "string",
         "minLength" : 6,
         "format" : "email"
      },
      "password" : {
         "type" : "string",
         "minLength" : 5
      },
      "displayName" : {
         "type" : "string"
      }
   },
   "required" : ["email", "password"]
};

module.exports = function(pool) {

   this.jsonSchema = JSON_SCHEMA;

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
      // first build a copy and trim some fields
      var user = {
         password : userDetails.password
      };
      trimAndCopyPropertyIfNonEmpty(userDetails, user, "email");
      trimAndCopyPropertyIfNonEmpty(userDetails, user, "displayName");

      // now validate
      jsonValidator.validate(user, JSON_SCHEMA, function(err1) {
         if (err1) {
            return callback(err1, {errorType : "validation"});
         }

         // if validation was successful, then hash the password
         bcrypt.hash(user.password, 8, function(err2, hashedPassword) {
            if (err2) {
               return callback(err2);
            }

            // now that we have the hashed password, try to insert
            user.password = hashedPassword;
            executeQuery(pool, "INSERT INTO Users SET ?", user, function(err3, result) {
               if (err3) {
                  return callback(err3, {errorType : "database"});
               }

               return callback(null, {insertId : result.insertId});
            });
         });
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
    * Tries to find the user with the given <code>email</code> and returns it to the given <code>callback</code>. If
    * successful, the user is returned as the 2nd argument to the <code>callback</code> function.  If unsuccessful,
    * <code>null</code> is returned to the callback.
    *
    * @param {string} email email of the user to find.
    * @param {function} callback function with signature <code>callback(err, user)</code>
    */
   this.findByEmail = function(email, callback) {
      findUser(pool, "SELECT * FROM Users WHERE email=?", [email], callback);
   };

   /**
    * Tries to find the user with the given <code>email</code> and <code>clearTextPassword</code> and returns it to
    * the given <code>callback</code>. If successful, the user is returned as the 2nd argument to the
    * <code>callback</code> function.  If unsuccessful, <code>null</code> is returned to the callback.
    *
    * @param {string} email email of the user to find.
    * @param {string} clearTextPassword clear-text password of the user to find.
    * @param {function} callback function with signature <code>callback(err, user)</code>
    */
   this.findByEmailAndPassword = function(email, clearTextPassword, callback) {
      this.findByEmail(email, function(err, user) {
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
