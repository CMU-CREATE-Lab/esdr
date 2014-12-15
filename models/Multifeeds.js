var trimAndCopyPropertyIfNonEmpty = require('../lib/objectUtils').trimAndCopyPropertyIfNonEmpty;
var JaySchema = require('jayschema');
var jsonValidator = new JaySchema();
var ValidationError = require('../lib/errors').ValidationError;
var Query2Query = require('query2query');
var createRandomHexToken = require('../lib/token').createRandomHexToken;
var log = require('log4js').getLogger('esdr:models:multifeeds');

var CREATE_TABLE_QUERY = " CREATE TABLE IF NOT EXISTS `Multifeeds` ( " +
                         "`id` bigint(20) NOT NULL AUTO_INCREMENT, " +
                         "`name` varchar(255) NOT NULL, " +
                         "`userId` bigint(20) NOT NULL, " +
                         "`spec` text NOT NULL, " +
                         "`created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
                         "`modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, " +
                         "PRIMARY KEY (`id`), " +
                         "UNIQUE KEY `name` (`name`), " +
                         "KEY `userId` (`userId`), " +
                         "KEY `created` (`created`), " +
                         "KEY `modified` (`modified`), " +
                         "CONSTRAINT `multifeeds_userId_fk_1` FOREIGN KEY (`userId`) REFERENCES `Users` (`id`) " +
                         ") ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8";

var query2query = new Query2Query();
query2query.addField('id', true, true, false, Query2Query.types.INTEGER);
query2query.addField('name', true, true, false);
query2query.addField('userId', true, true, false, Query2Query.types.INTEGER);
query2query.addField('spec', false, false, false);
query2query.addField('created', true, true, false, Query2Query.types.DATETIME);
query2query.addField('modified', true, true, false, Query2Query.types.DATETIME);

var JSON_SCHEMA = {
   "$schema" : "http://json-schema.org/draft-04/schema#",
   "title" : "Multitile",
   "description" : "An ESDR multitile",
   "type" : "object",
   "properties" : {
      "name" : {
         "type" : "string",
         "pattern" : "^[a-zA-Z0-9_\\-]+$",   // alphanumeric, underscore, and hyphen
         "minLength" : 1,
         "maxLength" : 255
      },
      "spec" : {
         "type" : "array",
         "minItems" : 1,
         "items" : {
            "type" : "object",
            "properties" : {
               "feeds" : {
                  "type" : "string",
                  "minLength" : 1
               },
               "channels" : {
                  "type" : "array",
                  "minItems" : 1,
                  "uniqueItems" : true,
                  "items" : {
                     "type" : "string",
                     "minLength" : 1
                  }
               }
            },
            "required" : ["feeds", "channels"]
         }
      }
   },
   "required" : ["name", "spec"]
};

module.exports = function(databaseHelper) {

   this.jsonSchema = JSON_SCHEMA;

   this.initialize = function(callback) {
      databaseHelper.execute(CREATE_TABLE_QUERY, [], function(err) {
         if (err) {
            log.error("Error trying to create the Multifeeds table: " + err);
            return callback(err);
         }

         return callback(null, true);
      });
   };

   this.create = function(multifeedDetails, userId, callback) {
      var multifeed = {
         userId : userId,
         spec : multifeedDetails.spec
      };
      trimAndCopyPropertyIfNonEmpty(multifeedDetails, multifeed, "name");
      if (typeof multifeed.name === 'undefined' || multifeed.name == null) {
         multifeed.name = createRandomHexToken(32);
      }

      // now validate
      jsonValidator.validate(multifeed, JSON_SCHEMA, function(err1) {
         if (err1) {
            return callback(new ValidationError(err1));
         }

         // need to stringify the spec for storage in the DB
         multifeed.spec = JSON.stringify(multifeedDetails.spec);

         // now that we have the hashed secret, try to insert
         databaseHelper.execute("INSERT INTO Multifeeds SET ?", multifeed, function(err, result) {
            if (err) {
               return callback(err);
            }

            return callback(null, {
               insertId : result.insertId,
               // include these because they might have been modified by the trimming
               name : multifeed.name
            });
         });
      });

   };
};
