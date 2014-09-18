var trimAndCopyPropertyIfNonEmpty = require('../lib/objectUtils').trimAndCopyPropertyIfNonEmpty;
var copyPropertyIfDefinedAndNonNull = require('../lib/objectUtils').copyPropertyIfDefinedAndNonNull;
var JaySchema = require('jayschema');
var jsonValidator = new JaySchema();
var createRandomHexToken = require('../lib/token').createRandomHexToken;
var ValidationError = require('../lib/errors').ValidationError;
var log = require('log4js').getLogger();

var CREATE_TABLE_QUERY = " CREATE TABLE IF NOT EXISTS `Feeds` ( " +
                         "`id` bigint(20) NOT NULL AUTO_INCREMENT, " +
                         "`name` varchar(255) NOT NULL, " +
                         "`deviceId` bigint(20) DEFAULT NULL, " +
                         "`userId` bigint(20) DEFAULT NULL, " +
                         "`datastoreId` varchar(32) NOT NULL, " +
                         "`apiToken` varchar(64) NOT NULL, " +
                         "`exposure` enum('indoor','outdoor','virtual') NOT NULL, " +
                         "`isPublic` boolean DEFAULT 0, " +
                         "`isMobile` boolean DEFAULT 0, " +
                         "`latitude` double DEFAULT NULL, " +
                         "`longitude` double DEFAULT NULL, " +
                         "`channelSpec` text NOT NULL, " +
                         "`created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
                         "`modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, " +
                         "`lastUpload` timestamp DEFAULT 0, " +
                         "`minTimeSecs` double DEFAULT NULL, " +
                         "`maxTimeSecs` double DEFAULT NULL, " +
                         "PRIMARY KEY (`id`), " +
                         "UNIQUE KEY `apiToken` (`apiToken`), " +
                         "KEY `deviceId` (`deviceId`), " +
                         "KEY `userId` (`userId`), " +
                         "KEY `exposure` (`exposure`), " +
                         "KEY `isPublic` (`isPublic`), " +
                         "KEY `isMobile` (`isMobile`), " +
                         "KEY `latitude` (`latitude`), " +
                         "KEY `longitude` (`longitude`), " +
                         "CONSTRAINT `feeds_deviceId_fk_1` FOREIGN KEY (`deviceId`) REFERENCES `Devices` (`id`), " +
                         "CONSTRAINT `feeds_userId_fk_1` FOREIGN KEY (`userId`) REFERENCES `Users` (`id`) " +
                         ") ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8";

var JSON_SCHEMA = {
   "$schema" : "http://json-schema.org/draft-04/schema#",
   "title" : "Feed",
   "description" : "An ESDR feed",
   "type" : "object",
   "properties" : {
      "name" : {
         "type" : "string",
         "minLength" : 1,
         "maxLength" : 255
      },
      "exposure" : {
         "enum" : [ 'indoor', 'outdoor', 'virtual' ]
      },
      "latitude" : {
         "type" : "number",
         "minimum" : -90,
         "maximum" : 90
      },
      "longitude" : {
         "type" : "number",
         "minimum" : -180,
         "maximum" : 180
      },
      "isPublic" : {
         "type" : "boolean"
      },
      "isMobile" : {
         "type" : "boolean"
      }
   },
   "required" : ["name", "exposure"]
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
      trimAndCopyPropertyIfNonEmpty(feedDetails, feed, "name");
      trimAndCopyPropertyIfNonEmpty(feedDetails, feed, "exposure");
      copyPropertyIfDefinedAndNonNull(feedDetails, feed, "latitude");
      copyPropertyIfDefinedAndNonNull(feedDetails, feed, "longitude");

      // now validate
      jsonValidator.validate(feed, JSON_SCHEMA, function(err1) {
         if (err1) {
            return callback(new ValidationError(err1));
         }

         // now that we have validated, get the default channel spec from this device's Products table record (which was
         // already validated when inserted into the product, so no need to do so again here)
         databaseHelper.findOne("SELECT defaultChannelSpec FROM Products WHERE id = (SELECT productId FROM Devices WHERE id=?)",
                                [deviceId],
                                function(err2, result) {
                                   if (err2) {
                                      return callback(err2);
                                   }

                                   feed.channelSpec = result.defaultChannelSpec;

                                   // now that we have the channel spec, try to insert
                                   databaseHelper.execute("INSERT INTO Feeds SET ?", feed, function(err3, result) {
                                      if (err3) {
                                         return callback(err3);
                                      }

                                      return callback(null, {
                                         insertId : result.insertId,
                                         datastoreId : feed.datastoreId,
                                         apiToken : feed.apiToken
                                      });
                                   });
                                });

      });
   };

   this.findFeedsForDevice = function(deviceId, callback) {
      databaseHelper.execute("SELECT " +
                             "id, " +
                             "name, " +
                             "deviceId, " +
                             "userId, " +
                             "apiToken, " +
                             "exposure, " +
                             "isPublic, " +
                             "isMobile, " +
                             "latitude, " +
                             "longitude, " +
                             "channelSpec, " +
                             "created, " +
                             "modified, " +
                             "lastUpload, " +
                             "minTimeSecs, " +
                             "maxTimeSecs " +
                             "FROM Feeds WHERE deviceId=?", [deviceId], callback);
   };
};
