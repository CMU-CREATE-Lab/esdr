var JaySchema = require('jayschema');
var jsonValidator = new JaySchema();
var createRandomHexToken = require('../lib/token').createRandomHexToken;
var ValidationError = require('../lib/errors').ValidationError;
var flow = require('nimble');
var log = require('log4js').getLogger('esdr:models:mirrorregistrations');

var CREATE_TABLE_QUERY = " CREATE TABLE IF NOT EXISTS `MirrorRegistrations` ( " +
                         "`id` bigint(20) NOT NULL AUTO_INCREMENT, " +
                         "`realm` varchar(64) NOT NULL, " +
                         "`userId` bigint(20) NOT NULL, " +
                         "`productId` bigint(20) DEFAULT NULL, " +
                         "`deviceId` bigint(20) DEFAULT NULL, " +
                         "`feedId` bigint(20) DEFAULT NULL, " +
                         "`mirrorToken` varchar(64) NOT NULL, " +
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
                         "KEY `created` (`created`), " +
                         "KEY `modified` (`modified`), " +
                         "CONSTRAINT `mirror_registrations_productId_fk_1` FOREIGN KEY (`productId`) REFERENCES `Products` (`id`), " +
                         "CONSTRAINT `mirror_registrations_deviceId_fk_1` FOREIGN KEY (`deviceId`) REFERENCES `Devices` (`id`), " +
                         "CONSTRAINT `mirror_registrations_feedId_fk_1` FOREIGN KEY (`feedId`) REFERENCES `Feeds` (`id`), " +
                         "CONSTRAINT `mirror_registrations_userId_fk_1` FOREIGN KEY (`userId`) REFERENCES `Users` (`id`) " +
                         ") ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8";

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
};
