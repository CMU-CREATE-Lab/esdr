var trimAndCopyPropertyIfNonEmpty = require('../lib/objectUtils').trimAndCopyPropertyIfNonEmpty;
var JaySchema = require('jayschema');
var jsonValidator = new JaySchema();
var createRandomHexToken = require('../lib/token').createRandomHexToken;
var ValidationError = require('../lib/errors').ValidationError;
var log = require('log4js').getLogger();

var CREATE_TABLE_QUERY = " CREATE TABLE IF NOT EXISTS `Feeds` ( " +
                         "`id` bigint(20) NOT NULL AUTO_INCREMENT, " +
                         "`deviceId` bigint(20) DEFAULT NULL, " +
                         "`userId` bigint(20) DEFAULT NULL, " +
                         "`datastoreId` varchar(32) NOT NULL, " +
                         "`apiToken` varchar(64) NOT NULL, " +
                         "`exposure` enum('indoor','outdoor','virtual') NOT NULL, " +
                         "`isPublic` boolean DEFAULT 0, " +
                         "`isMobile` boolean DEFAULT 0, " +
                            // TODO: add lat, long, elevation?
                         "`channelSpec` text DEFAULT NULL, " +    // TODO: make this NOT NULL and just copy from Product upon creation?
                         "`created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
                         "`modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, " +

                         "PRIMARY KEY (`id`), " +
                         "UNIQUE KEY `apiToken` (`apiToken`), " +
                         "KEY `deviceId` (`deviceId`), " +
                         "KEY `userId` (`userId`), " +
                         "KEY `exposure` (`exposure`), " +
                         "KEY `isPublic` (`isPublic`), " +
                         "KEY `isMobile` (`isMobile`), " +
                         "CONSTRAINT `feeds_deviceId_fk_1` FOREIGN KEY (`deviceId`) REFERENCES `Devices` (`id`), " +
                         "CONSTRAINT `feeds_userId_fk_1` FOREIGN KEY (`userId`) REFERENCES `Users` (`id`) " +
                         ") ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8";

var JSON_SCHEMA = {
   "$schema" : "http://json-schema.org/draft-04/schema#",
   "title" : "Feed",
   "description" : "An ESDR feed",
   "type" : "object",
   "properties" : {
      "exposure" : {
         "enum" : [ 'indoor', 'outdoor', 'virtual' ]
      },
      "isPublic" : {
         "type" : "boolean"
      },
      "isMobile" : {
         "type" : "boolean"
      }
   },
   "required" : ["exposure"]
};

module.exports = function(databaseHelper) {

   this.jsonSchema = JSON_SCHEMA;

   this.initialize = function(callback) {
      databaseHelper.execute(CREATE_TABLE_QUERY, [], function(err) {
         if (err) {
            log.error("Error trying to create the Feeds table: " + err);
            return callback(err);
         }

         return callback(null, true);
      });
   };

   this.create = function(feedDetails, deviceId, userId, callback) {
      // first build a copy and trim some fields
      var feed = {
         deviceId : deviceId,
         userId : userId,
         datastoreId : createRandomHexToken(16),
         apiToken : createRandomHexToken(32),
         isPublic : !!feedDetails.isPublic,
         isMobile : !!feedDetails.isMobile
      };
      trimAndCopyPropertyIfNonEmpty(feedDetails, feed, "exposure");

      // now validate
      jsonValidator.validate(feed, JSON_SCHEMA, function(err1) {
         if (err1) {
            return callback(new ValidationError(err1));
         }

         // now that we have the hashed secret, try to insert
         databaseHelper.execute("INSERT INTO Feeds SET ?", feed, function(err2, result) {
            if (err2) {
               return callback(err2);
            }

            return callback(null, {
               insertId : result.insertId,
               datastoreId : feed.datastoreId,
               apiToken : feed.apiToken
            });
         });
      });
   };

   var findFeed = function(query, params, callback) {
      databaseHelper.findOne(query, params, function(err, feed) {
         if (err) {
            log.error("Error trying to find feed: " + err);
            return callback(err);
         }

         return callback(null, feed);
      });
   };
};
