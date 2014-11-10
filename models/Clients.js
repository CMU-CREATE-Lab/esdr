var trimAndCopyPropertyIfNonEmpty = require('../lib/objectUtils').trimAndCopyPropertyIfNonEmpty;
var bcrypt = require('bcrypt');
var JaySchema = require('jayschema');
var jsonValidator = new JaySchema();
var ValidationError = require('../lib/errors').ValidationError;
var log = require('log4js').getLogger('esdr:models:clients');

var CREATE_TABLE_QUERY = " CREATE TABLE IF NOT EXISTS `Clients` ( " +
                         "`id` bigint(20) NOT NULL AUTO_INCREMENT, " +
                         "`displayName` varchar(255) NOT NULL, " +
                         "`clientName` varchar(255) NOT NULL, " +
                         "`clientSecret` varchar(255) NOT NULL, " +
                         "`email` varchar(255) DEFAULT NULL, " +
                         "`verificationUrl` varchar(512) NOT NULL, " +
                         "`resetPasswordUrl` varchar(512) NOT NULL, " +
                         "`creatorUserId` bigint(20) DEFAULT NULL, " +
                         "`created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
                         "`modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, " +
                         "PRIMARY KEY (`id`), " +
                         "KEY `displayName` (`displayName`), " +
                         "UNIQUE KEY `unique_clientName` (`clientName`), " +
                         "KEY `creatorUserId` (`creatorUserId`), " +
                         "KEY `created` (`created`), " +
                         "KEY `modified` (`modified`), " +
                         "CONSTRAINT `clients_creatorUserId_fk_1` FOREIGN KEY (`creatorUserId`) REFERENCES `Users` (`id`) " +
                         ") ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8";

var JSON_SCHEMA = {
   "$schema" : "http://json-schema.org/draft-04/schema#",
   "title" : "Client",
   "description" : "An ESDR client",
   "type" : "object",
   "properties" : {
      "displayName" : {
         "type" : "string",
         "minLength" : 4,
         "maxLength" : 255
      },
      "clientName" : {
         "type" : "string",
         "minLength" : 4,
         "maxLength" : 255
      },
      "clientSecret" : {
         "type" : "string",
         "minLength" : 10,
         "maxLength" : 255
      },
      "email" : {
         "type" : "string",
         "minLength" : 0,
         "maxLength" : 255,
         "format" : "email"
      },
      "verificationUrl" : {
         "type" : "string",
         "minLength" : 10,
         "maxLength" : 512
      },
      "resetPasswordUrl" : {
         "type" : "string",
         "minLength" : 10,
         "maxLength" : 512
      }
   },
   "required" : ["displayName", "clientName", "clientSecret", "verificationUrl", "resetPasswordUrl"]
};

module.exports = function(databaseHelper) {

   this.jsonSchema = JSON_SCHEMA;

   this.initialize = function(callback) {
      databaseHelper.execute(CREATE_TABLE_QUERY, [], function(err) {
         if (err) {
            log.error("Error trying to create the Clients table: " + err);
            return callback(err);
         }

         return callback(null, true);
      });
   };

   this.create = function(clientDetails, creatorUserId, callback) {
      // first build a copy and trim some fields
      var client = {
         creatorUserId : creatorUserId,
         clientSecret : clientDetails.clientSecret
      };
      trimAndCopyPropertyIfNonEmpty(clientDetails, client, "displayName");
      trimAndCopyPropertyIfNonEmpty(clientDetails, client, "clientName");
      trimAndCopyPropertyIfNonEmpty(clientDetails, client, "email");
      trimAndCopyPropertyIfNonEmpty(clientDetails, client, "verificationUrl");
      trimAndCopyPropertyIfNonEmpty(clientDetails, client, "resetPasswordUrl");

      // now validate
      jsonValidator.validate(client, JSON_SCHEMA, function(err1) {
         if (err1) {
            return callback(new ValidationError(err1));
         }

         // if validation was successful, then hash the secret
         bcrypt.hash(client.clientSecret, 8, function(err2, hashedSecret) {
            if (err2) {
               return callback(err2);
            }

            // now that we have the hashed secret, try to insert
            client.clientSecret = hashedSecret;
            databaseHelper.execute("INSERT INTO Clients SET ?", client, function(err2, result) {
               if (err2) {
                  return callback(err2);
               }

               return callback(null, {
                  insertId : result.insertId,
                  // include these because they might have been modified by the trimming
                  displayName : client.displayName,
                  clientName : client.clientName
               });
            });

         });
      });
   };

   /**
    * Tries to find the client with the given <code>clientName</code> and <code>clientSecret</code> and returns it to
    * the given <code>callback</code>. If successful, the client is returned as the 2nd argument to the
    * <code>callback</code> function.  If unsuccessful, <code>null</code> is returned to the callback.
    *
    * @param {string} clientName name of the client to find.
    * @param {string} clearTextSecret clear-text secret of the client to find.
    * @param {function} callback function with signature <code>callback(err, client)</code>
    */
   this.findByNameAndSecret = function(clientName, clearTextSecret, callback) {
      findClient("SELECT * FROM Clients WHERE clientName=?", [clientName], function(err, client) {
         if (err) {
            return callback(err);
         }

         if (client && isValidSecret(client, clearTextSecret)) {
            return callback(null, client);
         }

         callback(null, null);
      });
   };

   var findClient = function(query, params, callback) {
      databaseHelper.findOne(query, params, function(err, client) {
         if (err) {
            log.error("Error trying to find client: " + err);
            return callback(err);
         }

         return callback(null, client);
      });
   };

   var isValidSecret = function(client, clearTextSecret) {
      return bcrypt.compareSync(clearTextSecret, client.clientSecret);
   };
};
