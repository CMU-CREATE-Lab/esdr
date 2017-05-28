var JaySchema = require('jayschema');
var jsonValidator = new JaySchema();
var createRandomHexToken = require('../lib/token').createRandomHexToken;
var ValidationError = require('../lib/errors').ValidationError;
var Query2Query = require('query2query');
var log = require('log4js').getLogger('esdr:models:mirrorregistrations');

var CREATE_TABLE_QUERY = " CREATE TABLE IF NOT EXISTS `MirrorRegistrations` ( " +
                         "`id` bigint(20) NOT NULL AUTO_INCREMENT, " +
                         "`realm` varchar(64) NOT NULL, " +
                         "`userId` bigint(20) NOT NULL, " +
                         "`productId` bigint(20) DEFAULT NULL, " +
                         "`deviceId` bigint(20) DEFAULT NULL, " +
                         "`feedId` bigint(20) DEFAULT NULL, " +
                         "`mirrorToken` varchar(64) NOT NULL, " +
                         "`lastMirrorAttempt` timestamp NOT NULL DEFAULT 0, " +
                         "`wasMirrorSuccessful` boolean DEFAULT 0, " +
                         "`created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
                         "`modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, " +
                         "PRIMARY KEY (`id`), " +
                         "UNIQUE KEY `unique_mirrorToken` (`mirrorToken`), " +
                         "UNIQUE KEY `unique_realm_userId_productId` (`realm`,`userId`,`productId`), " +
                         "UNIQUE KEY `unique_realm_userId_deviceId_feedId` (`realm`,`userId`,`deviceId`), " +
                         "UNIQUE KEY `unique_realm_userId_feedId` (`realm`,`userId`,`feedId`), " +
                         "KEY `realm` (`realm`), " +
                         "KEY `userId` (`userId`), " +
                         "KEY `productId` (`productId`), " +
                         "KEY `deviceId` (`deviceId`), " +
                         "KEY `feedId` (`feedId`), " +
                         "KEY `lastMirrorAttempt` (`lastMirrorAttempt`), " +
                         "KEY `wasMirrorSuccessful` (`wasMirrorSuccessful`), " +
                         "KEY `created` (`created`), " +
                         "KEY `modified` (`modified`), " +
                         "CONSTRAINT `mirror_registrations_productId_fk_1` FOREIGN KEY (`productId`) REFERENCES `Products` (`id`), " +
                         "CONSTRAINT `mirror_registrations_deviceId_fk_1` FOREIGN KEY (`deviceId`) REFERENCES `Devices` (`id`), " +
                         "CONSTRAINT `mirror_registrations_feedId_fk_1` FOREIGN KEY (`feedId`) REFERENCES `Feeds` (`id`), " +
                         "CONSTRAINT `mirror_registrations_userId_fk_1` FOREIGN KEY (`userId`) REFERENCES `Users` (`id`) " +
                         ") ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8";

var query2query = new Query2Query();
query2query.addField('id', false, false, false, Query2Query.types.INTEGER);
query2query.addField('realm', false, false, false);
query2query.addField('userId', false, false, false, Query2Query.types.INTEGER);
query2query.addField('productId', false, false, true, Query2Query.types.INTEGER);
query2query.addField('deviceId', false, false, true, Query2Query.types.INTEGER);
query2query.addField('feedId', false, false, true, Query2Query.types.INTEGER);
query2query.addField('mirrorToken', false, false, false);
query2query.addField('lastMirrorAttempt', false, false, false, Query2Query.types.DATETIME);
query2query.addField('wasMirrorSuccessful', false, false, false, Query2Query.types.BOOLEAN);
query2query.addField('created', false, false, false, Query2Query.types.DATETIME);
query2query.addField('modified', false, false, false, Query2Query.types.DATETIME);

var REALM_JSON_SCHEMA_PROPERTIES = {
   "type" : "string",
   "pattern" : "^[a-zA-Z0-9][a-zA-Z0-9_\\-\\.]*$",   // alphanumeric, underscore, hyphen, and period, but must start with an alphanumeric
   "minLength" : 2,
   "maxLength" : 64
};

var MIRROR_TOKEN_JSON_SCHEMA_PROPERTIES = {
   "type" : "string",
   "pattern" : "^[a-f0-9]{64}$",   // hex digits
   "minLength" : 64,
   "maxLength" : 64
};

var REALM_JSON_SCHEMA = {
   "$schema" : "http://json-schema.org/draft-04/schema#",
   "title" : "MirrorRegistrationRealm",
   "description" : "A data mirror registration realm",
   "type" : "object",
   "properties" : {
      "realm" : REALM_JSON_SCHEMA_PROPERTIES
   },
   "required" : ["realm"]
};

var REALM_AND_MIRROR_TOKEN_JSON_SCHEMA = {
   "$schema" : "http://json-schema.org/draft-04/schema#",
   "title" : "MirrorRegistrationRealmAndToken",
   "description" : "A data mirror registration realm and mirror token",
   "type" : "object",
   "properties" : {
      "realm" : REALM_JSON_SCHEMA_PROPERTIES,
      "mirrorToken" : MIRROR_TOKEN_JSON_SCHEMA_PROPERTIES
   },
   "required" : ["realm", "mirrorToken"]
};

module.exports = function(databaseHelper) {

   this.initialize = function(callback) {
      databaseHelper.execute(CREATE_TABLE_QUERY, [], function(err) {
         if (err) {
            log.error("Error trying to create the MirrorRegistrations table: " + err);
            return callback(err);
         }

         return callback(null, true);
      });
   };

   // Assumes the entity type and id has already be validated!
   this.createForProduct = function(realm, userId, productId, callback) {
      var registration = {
         realm : realm
      };

      jsonValidator.validate(registration, REALM_JSON_SCHEMA, function(err) {
         if (err) {
            log.error(err);
            return callback(new ValidationError(err));
         }

         registration.userId = userId;
         registration.productId = productId;
         registration.mirrorToken = createRandomHexToken(32).toLowerCase();   // create token, force lowercase

         databaseHelper.execute("INSERT INTO MirrorRegistrations SET ?",
                                registration,
                                function(err, result) {
                                   if (err) {
                                      return callback(err);
                                   }

                                   return callback(null, {
                                      id : result.insertId,
                                      mirrorToken : registration.mirrorToken
                                   });
                                });
      });
   };

   this.deleteRegistration = function(realm, mirrorToken, callback) {
      // force to be a string and lowercase
      mirrorToken = ("" + (mirrorToken || "")).toLowerCase();

      jsonValidator.validate({
                                realm : realm,
                                mirrorToken : mirrorToken
                             },
                             REALM_AND_MIRROR_TOKEN_JSON_SCHEMA,
                             function(err) {
                                if (err) {
                                   return callback(new ValidationError(err));
                                }

                                databaseHelper.execute("DELETE FROM MirrorRegistrations WHERE realm=? AND mirrorToken=?",
                                                       [realm, mirrorToken],
                                                       function(err, deleteResult) {
                                                          if (err) {
                                                             log.error("Error trying to delete mirror registration with realm [" + realm + "] and mirror token [" + mirrorToken + "]: " + err);
                                                             return callback(err);
                                                          }

                                                          return callback(null, { registrationsDeleted : deleteResult.affectedRows });
                                                       });
                             });

   };

   /**
    * Tries to find the record with the given <code>realm</code> and <code>mirrorToken</code> and returns it to the given
    * <code>callback</code>. If successful, the mirror registration is returned as the 2nd argument to the
    * <code>callback</code> function.  If unsuccessful, <code>null</code> is returned to the callback.
    *
    * @param {string} realm Realm of the mirror registration record to find.
    * @param {string} mirrorToken Mirror token of the mirror registration record to find.
    * @param {function} callback function with signature <code>callback(err, mirrorRegistration)</code>
    */
   this.findByRealmAndMirrorToken = function(realm, mirrorToken, callback) {
      jsonValidator.validate({
                                realm : realm,
                                mirrorToken : mirrorToken
                             },
                             REALM_AND_MIRROR_TOKEN_JSON_SCHEMA,
                             function(err) {
                                if (err) {
                                   log.error(err);
                                   return callback(new ValidationError(err));
                                }

                                findOne("SELECT * FROM MirrorRegistrations WHERE realm=? AND mirrorToken=?",
                                        [realm, mirrorToken],
                                        callback);
                             });
   };

   /**
    * Tries to find the record with the given <code>realm</code> and <code>mirrorToken</code> and returns it to the given
    * <code>callback</code>. If successful, the mirror registration is returned as the 2nd argument to the
    * <code>callback</code> function.  If unsuccessful, <code>null</code> is returned to the callback.
    *
    * @param {string} realm Realm of the mirror registration record to find.
    * @param {int} userId User ID of the mirror registration record to find.
    * @param {int} productId Product ID of the mirror registration record to find.
    * @param {function} callback function with signature <code>callback(err, mirrorRegistration)</code>
    */
   this.findByRealmUserAndProduct = function(realm, userId, productId, callback) {
      jsonValidator.validate({ realm : realm }, REALM_JSON_SCHEMA, function(err) {
         if (err) {
            log.error(err);
            return callback(new ValidationError(err));
         }

         findOne("SELECT * FROM MirrorRegistrations WHERE realm=? AND userId=? AND productId=?",
                 [realm, userId, productId],
                 callback);
      });
   };

   this.filterFields = function(mirrorRegistration, fieldsToSelect, callback) {
      query2query.parse({ fields : fieldsToSelect }, function(err, queryParts) {
         if (err) {
            return callback(err);
         }

         var filteredRegistration = {};
         queryParts.selectFields.forEach(function(fieldName) {
            if (fieldName in mirrorRegistration) {
               filteredRegistration[fieldName] = mirrorRegistration[fieldName];
            }
         });

         callback(null, filteredRegistration);
      });
   };

   var findOne = function(query, params, callback) {
      databaseHelper.findOne(query, params, function(err, user) {
         if (err) {
            log.error("Error trying to find mirror registration: " + err);
            return callback(err);
         }

         return callback(null, user);
      });
   };
};
