const trimAndCopyPropertyIfNonEmpty = require('../lib/objectUtils').trimAndCopyPropertyIfNonEmpty;
const bcrypt = require('bcrypt');
const JaySchema = require('jayschema');
const jsonValidator = new JaySchema();
const ValidationError = require('../lib/errors').ValidationError;
const Query2Query = require('query2query');
const config = require('../config');
const log = require('log4js').getLogger('esdr:models:clients');

// noinspection SqlNoDataSourceInspection
const CREATE_TABLE_QUERY = " CREATE TABLE IF NOT EXISTS `Clients` ( " +
                           "`id` bigint(20) NOT NULL AUTO_INCREMENT, " +
                           "`displayName` varchar(255) NOT NULL, " +
                           "`clientName` varchar(255) NOT NULL, " +
                           "`clientSecret` varchar(255) NOT NULL, " +
                           "`email` varchar(255) NOT NULL, " +
                           "`verificationUrl` varchar(512) NOT NULL, " +
                           "`resetPasswordUrl` varchar(512) NOT NULL, " +
                           "`creatorUserId` bigint(20) DEFAULT NULL, " +
                           "`isPublic` boolean DEFAULT 0, " +
                           "`created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
                           "`modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, " +
                           "PRIMARY KEY (`id`), " +
                           "KEY `displayName` (`displayName`), " +
                           "UNIQUE KEY `unique_clientName` (`clientName`), " +
                           "KEY `email` (`email`), " +
                           "KEY `creatorUserId` (`creatorUserId`), " +
                           "KEY `isPublic` (`isPublic`), " +
                           "KEY `created` (`created`), " +
                           "KEY `modified` (`modified`), " +
                           "CONSTRAINT `clients_creatorUserId_fk_1` FOREIGN KEY (`creatorUserId`) REFERENCES `Users` (`id`) " +
                           ") ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8";

const MAX_FOUND_CLIENTS = 100;

const query2query = new Query2Query();
query2query.addField('id', true, true, false, Query2Query.types.INTEGER);
query2query.addField('displayName', true, true, false);
query2query.addField('clientName', true, true, false);
query2query.addField('email', true, true, false);
query2query.addField('verificationUrl', false, false, false);
query2query.addField('resetPasswordUrl', false, false, false);
query2query.addField('creatorUserId', true, true, true, Query2Query.types.INTEGER);
query2query.addField('isPublic', true, true, false, Query2Query.types.BOOLEAN);
query2query.addField('created', true, true, false, Query2Query.types.DATETIME);
query2query.addField('modified', true, true, false, Query2Query.types.DATETIME);

const JSON_SCHEMA = {
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
         "pattern" : "^[a-zA-Z0-9][a-zA-Z0-9_\\-\\.]*$",   // alphanumeric, underscore, hyphen, and period, but must start with an alphanumeric
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
      },
      "isPublic" : {
         "type" : "boolean"
      }
   },
   "required" : ["displayName", "clientName", "clientSecret", "email", "verificationUrl", "resetPasswordUrl"]
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
      const client = {
         creatorUserId : creatorUserId,
         clientSecret : clientDetails.clientSecret,
         // don't allow private clients if the creating user isn't auth'd
         isPublic : (typeof creatorUserId === 'undefined' || creatorUserId == null) ? true : !!clientDetails.isPublic
      };
      trimAndCopyPropertyIfNonEmpty(clientDetails, client, "displayName");
      trimAndCopyPropertyIfNonEmpty(clientDetails, client, "clientName");
      trimAndCopyPropertyIfNonEmpty(clientDetails, client, "email");
      trimAndCopyPropertyIfNonEmpty(clientDetails, client, "verificationUrl");
      trimAndCopyPropertyIfNonEmpty(clientDetails, client, "resetPasswordUrl");

      // use the ESDR email, verificationUrl and resetPasswordUrl if not provided
      if (!("email" in client)) {
         client.email = config.get("esdrClient:email");
      }
      if (!("verificationUrl" in client)) {
         client.verificationUrl = config.get("esdrClient:verificationUrl");
      }
      if (!("resetPasswordUrl" in client)) {
         client.resetPasswordUrl = config.get("esdrClient:resetPasswordUrl");
      }

      // now validate
      jsonValidator.validate(client, JSON_SCHEMA, function(err1) {
         if (err1) {
            return callback(new ValidationError(err1));
         }

         // if validation was successful, then hash the secret
         bcrypt.hash(client.clientSecret, 8)
               .then(hashedSecret => {
                  // now that we have the hashed secret, try to insert
                  client.clientSecret = hashedSecret;
                  // noinspection SqlNoDataSourceInspection
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
               })
               .catch(err => callback(err));
      });
   };

   this.find = function(authUserId, queryString, callback) {
      query2query.parse(queryString, function(err, queryParts) {

                           if (err) {
                              return callback(err);
                           }

                           // Build the restricted SQL query.  Note that we manually add the isPublic and creatorUserId
                           // fields to the SELECT statement.  This is so we can filter out the the email,
                           // verificationUrl, and resetPasswordUrl if the client record is not public or not owned by
                           // the auth'd user.  We'll remove them from the results below if not requested by user.
                           const restrictedSql = [
                              "SELECT " + queryParts.selectFields.join(',') + ",isPublic,creatorUserId",
                              "FROM Clients",
                              queryParts.whereClause,
                              queryParts.orderByClause,
                              queryParts.limitClause
                           ].join(' ');
                           log.debug("Clients.find(): " + restrictedSql + (queryParts.whereValues.length > 0 ? " [where values: " + queryParts.whereValues + "]" : ""));

                           // Use findWithLimit so we can also get a count of the total number of records that would
                           // have been returned had there been no LIMIT clause included in the query
                           databaseHelper.findWithLimit(restrictedSql, queryParts.whereValues, function(err, result) {
                              if (err) {
                                 return callback(err);
                              }

                              // copy in the offset and limit
                              result.offset = queryParts.offset;
                              result.limit = queryParts.limit;

                              // if the user didn't explicitly select the isPublic and creatorUserId, then we'll want to
                              // strip those fields from the response
                              const willDeleteIsPublicField = (queryParts.selectFields.indexOf('isPublic') < 0);
                              const willDeleteCreatorUserIdField = (queryParts.selectFields.indexOf('creatorUserId') < 0);

                              // For every found client, do the following:
                              // 1) if the client is private or not owned by the auth'd user, then remove the email,
                              //    verificationUrl, and resetPasswordUrl fields
                              // 2) if the user didn't ask for the isPublic field, remove it
                              // 3) if the user didn't ask for the creatorUserId field, remove it
                              result.rows.forEach(function(row) {
                                 if (!row.isPublic && (authUserId == null || (row.creatorUserId !== authUserId))) {
                                    delete row.email;
                                    delete row.verificationUrl;
                                    delete row.resetPasswordUrl;
                                 }

                                 if (willDeleteIsPublicField) {
                                    delete row.isPublic;
                                 }
                                 if (willDeleteCreatorUserIdField) {
                                    delete row.creatorUserId;
                                 }
                              });

                              return callback(null, result, queryParts.selectFields);
                           });
                        },
                        MAX_FOUND_CLIENTS);
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
      // noinspection SqlNoDataSourceInspection,SqlDialectInspection
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

   const findClient = function(query, params, callback) {
      databaseHelper.findOne(query, params, function(err, client) {
         if (err) {
            log.error("Error trying to find client: " + err);
            return callback(err);
         }

         return callback(null, client);
      });
   };

   const isValidSecret = function(client, clearTextSecret) {
      return bcrypt.compareSync(clearTextSecret, client.clientSecret);
   };
};
