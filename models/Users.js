var config = require('../config');
var bcrypt = require('bcrypt');
var crypto = require('crypto');
var trimAndCopyPropertyIfNonEmpty = require('../lib/objectUtils').trimAndCopyPropertyIfNonEmpty;
var JaySchema = require('jayschema');
var jsonValidator = new JaySchema();
var ValidationError = require('../lib/errors').ValidationError;
var log = require('log4js').getLogger();

var CREATE_TABLE_QUERY = " CREATE TABLE IF NOT EXISTS `Users` ( " +
                         "`id` bigint(20) NOT NULL AUTO_INCREMENT, " +
                         "`email` varchar(255) NOT NULL, " +
                         "`password` varchar(255) NOT NULL, " +
                         "`displayName` varchar(255) DEFAULT NULL, " +
                         "`created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
                         "`modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, " +
                         "`verificationToken` varchar(64) NOT NULL, " +
                         "`isVerified` boolean DEFAULT 0, " +
                         "`verified` timestamp, " +
                         "`resetPasswordToken` varchar(64) DEFAULT NULL, " +
                         "`resetPasswordExpiration` timestamp, " +
                         "PRIMARY KEY (`id`), " +
                         "UNIQUE KEY `unique_email` (`email`), " +
                         "UNIQUE KEY `unique_verificationToken` (`verificationToken`), " +
                         "UNIQUE KEY `unique_resetPasswordToken` (`resetPasswordToken`) " +
                         ") ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8";

var EMAIL_ATTRS = {
   "type" : "string",
   "minLength" : 6,
   "maxLength" : 255,
   "format" : "email"
};
var PASSWORD_ATTRS = {
   "type" : "string",
   "minLength" : 5,
   "maxLength" : 255
};
var JSON_SCHEMA = {
   "$schema" : "http://json-schema.org/draft-04/schema#",
   "title" : "User",
   "description" : "An ESDR user",
   "type" : "object",
   "properties" : {
      "email" : EMAIL_ATTRS,
      "password" : PASSWORD_ATTRS,
      "displayName" : {
         "type" : "string",
         "maxLength" : 255
      }
   },
   "required" : ["email", "password"]
};

var JSON_SCHEMA_EMAIL = {
   "$schema" : "http://json-schema.org/draft-04/schema#",
   "title" : "User email",
   "description" : "An ESDR user's email",
   "type" : "object",
   "properties" : {
      "email" : EMAIL_ATTRS
   },
   "required" : ["email"]
};

var JSON_SCHEMA_PASSWORD = {
   "$schema" : "http://json-schema.org/draft-04/schema#",
   "title" : "User password",
   "description" : "An ESDR user's password",
   "type" : "object",
   "properties" : {
      "password" : PASSWORD_ATTRS
   },
   "required" : ["password"]
};

module.exports = function(databaseHelper) {

   this.jsonSchema = JSON_SCHEMA;

   this.initialize = function(callback) {
      databaseHelper.execute(CREATE_TABLE_QUERY, [], function(err) {
         if (err) {
            log.error("Error trying to create the Users table: " + err);
            return callback(err);
         }

         return callback(null, true);
      });
   };

   this.create = function(userDetails, callback) {
      // first build a copy and trim some fields
      var user = {
         password : userDetails.password,
         verificationToken : generateToken()
      };
      trimAndCopyPropertyIfNonEmpty(userDetails, user, "email");
      trimAndCopyPropertyIfNonEmpty(userDetails, user, "displayName");

      // now validate
      jsonValidator.validate(user, JSON_SCHEMA, function(err1) {
         if (err1) {
            return callback(new ValidationError(err1));
         }

         // if validation was successful, then hash the password
         bcrypt.hash(user.password, 8, function(err2, hashedPassword) {
            if (err2) {
               return callback(err2);
            }

            // now that we have the hashed password, try to insert
            user.password = hashedPassword;
            databaseHelper.execute("INSERT INTO Users SET ?", user, function(err3, result) {
               if (err3) {
                  return callback(err3);
               }

               var obj = {
                  insertId : result.insertId,
                  verificationToken : user.verificationToken,

                  // include these because they might have been modified by the trimming
                  email : user.email,
                  displayName : user.displayName
               };

               return callback(null, obj);
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
      findUser("SELECT * FROM Users WHERE id=?", [userId], callback);
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
      findUser("SELECT * FROM Users WHERE email=?", [email], callback);
   };

   /**
    * Tries to verify user with the given verification <code>token</code> and returns the result to the given
    * <code>callback</code>. If successful, the result is returned as the 2nd argument to the <code>callback</code>
    * function.  If unsuccessful, <code>null</code> is returned to the callback.  The returned result is a JSON object
    * containing a single property, <code>isVerified</code>, with a boolean value indicating whether verification
    * succeeded.
    *
    * @param {string} token verification token of the user to verify
    * @param {function} callback function with signature <code>callback(err, isVerified)</code>
    */
   this.verify = function(token, callback) {
      databaseHelper.findOne("SELECT id, isVerified " +
                             "FROM Users " +
                             "WHERE verificationToken=?",
                             [token],
                             function(err, user) {
                                if (err) {
                                   return callback(err);
                                }

                                // verification token not found
                                if (!user) {
                                   return callback(null, {isVerified : false});
                                }

                                // already verified
                                if (user.isVerified == 1) {
                                   return callback(null, {isVerified : true});
                                }

                                databaseHelper.execute("UPDATE Users " +
                                                       "SET verified=now(),isVerified=1 " +
                                                       "WHERE id=?",
                                                       [user.id],
                                                       function(err, result) {
                                                          if (err) {
                                                             return callback(err);
                                                          }

                                                          return callback(null, {isVerified : result.changedRows == 1});
                                                       });
                             });

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

   this.createResetPasswordToken = function(email, callback) {
      // validate--don't even bother hitting the DB if the email is obviously invalid
      jsonValidator.validate({email : email}, JSON_SCHEMA_EMAIL, function(err1) {
         if (err1) {
            return callback(new ValidationError(err1));
         }

         // generate a token expiring in 1 hour and try to update the user with the given email
         var token = generateToken();
         databaseHelper.execute("UPDATE Users " +
                                "SET " +
                                "resetPasswordToken=?," +
                                "resetPasswordExpiration=now()+INTERVAL 1 HOUR " +
                                "WHERE email=?",
                                [token, email],
                                function(err2, result) {
                                   if (err2) {
                                      return callback(err2);
                                   }

                                   return callback(null, result.changedRows == 1 ? token : null);
                                });
      });
   };

   this.setPassword = function(resetPasswordToken, newPassword, callback) {
      // validate
      jsonValidator.validate({password : newPassword}, JSON_SCHEMA_PASSWORD, function(err1) {
         if (err1) {
            return callback(new ValidationError(err1));
         }

         // if validation was successful, then hash the password
         bcrypt.hash(newPassword, 8, function(err2, hashedPassword) {
            if (err2) {
               return callback(err2);
            }

            // now that we have the hashed password, try to update
            databaseHelper.execute("UPDATE Users " +
                                   "SET " +
                                   "password=?," +
                                   "resetPasswordToken=NULL," +
                                   "resetPasswordExpiration=0 " +
                                   "WHERE resetPasswordToken=? AND resetPasswordExpiration>now()",
                                   [hashedPassword, resetPasswordToken],
                                   function(err3, result) {
                                      if (err3) {
                                         return callback(err3);
                                      }
                                      return callback(null, result.changedRows == 1);
                                   });
         });
      });
   };

   var isValidPassword = function(user, clearTextPassword) {
      return bcrypt.compareSync(clearTextPassword, user.password);
   };

   var findUser = function(query, params, callback) {
      databaseHelper.findOne(query, params, function(err, user) {
         if (err) {
            log.error("Error trying to find user: " + err);
            return callback(err);
         }

         return callback(null, user);
      });
   };

   var generateToken = function() {
      return crypto.randomBytes(32).toString('hex');
   };
};
