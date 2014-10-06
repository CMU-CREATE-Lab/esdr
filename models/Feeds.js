var trimAndCopyPropertyIfNonEmpty = require('../lib/objectUtils').trimAndCopyPropertyIfNonEmpty;
var copyPropertyIfDefinedAndNonNull = require('../lib/objectUtils').copyPropertyIfDefinedAndNonNull;
var JaySchema = require('jayschema');
var jsonValidator = new JaySchema();
var createRandomHexToken = require('../lib/token').createRandomHexToken;
var ValidationError = require('../lib/errors').ValidationError;
var httpStatus = require('http-status');
var BodyTrackDatastore = require('bodytrack-datastore');
var config = require('../config');

// instantiate the datastore
var datastore = new BodyTrackDatastore({
                                          binDir : config.get("datastore:binDirectory"),
                                          dataDir : config.get("datastore:dataDirectory")
                                       });

var log = require('log4js').getLogger();

var CREATE_TABLE_QUERY = " CREATE TABLE IF NOT EXISTS `Feeds` ( " +
                         "`id` bigint(20) NOT NULL AUTO_INCREMENT, " +
                         "`name` varchar(255) NOT NULL, " +
                         "`deviceId` bigint(20) NOT NULL, " +
                         "`productId` bigint(20) NOT NULL, " +
                         "`userId` bigint(20) NOT NULL, " +
                         "`apiKey` varchar(64) NOT NULL, " +
                         "`apiKeyReadOnly` varchar(64) NOT NULL, " +
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
                         "UNIQUE KEY `apiKey` (`apiKey`), " +
                         "UNIQUE KEY `apiKeyReadOnly` (`apiKeyReadOnly`), " +
                         "KEY `deviceId` (`deviceId`), " +
                         "KEY `productId` (`productId`), " +
                         "KEY `userId` (`userId`), " +
                         "KEY `exposure` (`exposure`), " +
                         "KEY `isPublic` (`isPublic`), " +
                         "KEY `isMobile` (`isMobile`), " +
                         "KEY `latitude` (`latitude`), " +
                         "KEY `longitude` (`longitude`), " +
                         "CONSTRAINT `feeds_deviceId_fk_1` FOREIGN KEY (`deviceId`) REFERENCES `Devices` (`id`), " +
                         "CONSTRAINT `feeds_productId_fk_1` FOREIGN KEY (`productId`) REFERENCES `Products` (`id`), " +
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

   var self = this;

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

   this.create = function(feedDetails, deviceId, productId, userId, callback) {
      // first build a copy and trim some fields
      var feed = {
         deviceId : deviceId,
         productId : productId,
         userId : userId,
         apiKey : createRandomHexToken(32),
         apiKeyReadOnly : createRandomHexToken(32),
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
         databaseHelper.findOne("SELECT defaultChannelSpec FROM Products WHERE id = ?",
                                [productId],
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
                                         datastoreId : "feed_" + result.insertId,
                                         apiKey : feed.apiKey,
                                         apiKeyReadOnly : feed.apiKeyReadOnly
                                      });
                                   });
                                });

      });
   };

   this.updateLastUploadTime = function(feedId, minTimeSecs, maxTimeSecs, callback) {
      databaseHelper.execute("UPDATE Feeds SET " +
                             "minTimeSecs=?, " +
                             "maxTimeSecs=?, " +
                             "lastUpload=now() " +
                             "WHERE id=?",
                             [minTimeSecs, maxTimeSecs, feedId],
                             function(err, result) {
                                if (err) {
                                   return callback(err);
                                }

                                return callback(null, result.changedRows == 1);
                             });
   };

   this.getTile = function(feed, channelName, level, offset, callback) {
      datastore.getTile(feed.userId,
                        feed.datastoreId,
                        channelName,
                        level,
                        offset,
                        function(err, tile) {

                           if (err) {
                              if (err.data && err.data.code == httpStatus.UNPROCESSABLE_ENTITY) {
                                 return callback(err);
                              }

                              return callback(new Error("Failed to fetch tile: " + err.message));
                           }

                           // no error, so check whether there was actually any data returned at all
                           if (typeof tile['data'] === 'undefined') {
                              tile = createEmptyTile(level, offset);
                           }

                           // Must set the type since the grapher won't render anything if the type is not set
                           // (TODO: get this from the feed's channel specs, and default to value if undefined)
                           tile['type'] = "value";

                           return callback(null, tile);
                        });
   };

   var createEmptyTile = function(level, offset) {
      return {
         "data" : [],
         "fields" : ["time", "mean", "stddev", "count"],
         "level" : level,
         "offset" : offset,
         "sample_width" : 0,

         // TODO: get this from the feed's channel specs, and default to value if undefined
         "type" : "value"
      };
   };

   this.getInfo = function(feed, callback) {
      datastore.getInfo({
                           userId : feed.userId,
                           deviceName : feed.datastoreId
                        },
                        function(err, info) {
                           if (err) {
                              if (typeof err.data !== 'undefined' &&
                                  typeof err.data.code !== 'undefined' &&
                                  typeof err.data.status !== 'undefined') {
                                 return callback(err.data);
                              }
                              return callback(new Error("Failed to get info for feed [" + feed.id + "]: " + err.message));
                           }

                           // inflate the channel spec JSON text into an object
                           feed.channelSpec = JSON.parse(feed.channelSpec);

                           // Iterate over each of the channels in the info from the datastore
                           // and copy to our new format, merged with the channelSpec.
                           var deviceAndChannelPrefixLength = (feed.datastoreId + ".").length;
                           Object.keys(info.channel_specs).forEach(function(deviceAndChannel) {
                              var channelName = deviceAndChannel.slice(deviceAndChannelPrefixLength);
                              var channelInfo = info.channel_specs[deviceAndChannel];

                              // copy the bounds (changing from snake to camel case)
                              var channelBounds = channelInfo.channel_bounds;
                              feed.channelSpec[channelName].bounds = {
                                 minTimeSecs : channelBounds.min_time,
                                 maxTimeSecs : channelBounds.max_time,
                                 minValue : channelBounds.min_value,
                                 maxValue : channelBounds.max_value
                              };
                           });

                           // rename the channelSpec field to simply "channels"
                           feed.channels = feed.channelSpec;
                           delete feed.channelSpec;

                           // Remove the datastoreId and API Key. No need to reveal either here.
                           delete feed.datastoreId;
                           delete feed.apiKey;

                           return callback(null, feed);
                        });
   };

   this.importData = function(feed, data, callback) {
      datastore.importJson(feed.userId,
                           feed.datastoreId,
                           data,
                           function(err, importResult) {
                              if (err) {
                                 // See if the error contains a JSend data object.  If so, pass it on through.
                                 if (typeof err.data !== 'undefined' &&
                                     typeof err.data.code !== 'undefined' &&
                                     typeof err.data.status !== 'undefined') {
                                    return callback(err);
                                 }
                                 return callback(new Error("Failed to import data"));
                              }

                              // If there was no error, then first see whether any data were actually
                              // imported.  The "channel_specs" field will be defined and non-null if so.
                              var wasDataActuallyImported = typeof importResult.channel_specs !== 'undefined' && importResult.channel_specs != null;

                              // Get the info for this device so we can return the current state to the caller
                              // and optionally update the min/max times and last upload time in the DB.
                              datastore.getInfo({
                                                   userId : feed.userId,
                                                   deviceName : feed.datastoreId
                                                },
                                                function(err, info) {
                                                   if (err) {
                                                      // See if the error contains a JSend data object.  If so, pass it on through.
                                                      if (typeof err.data !== 'undefined' &&
                                                          typeof err.data.code !== 'undefined' &&
                                                          typeof err.data.status !== 'undefined') {
                                                         return callback(err);
                                                      }
                                                      return callback(new Error("Failed to get info after importing data"));
                                                   }

                                                   // If there's data in the datastore for this device, then min and max
                                                   // time will be defined.  If they are, and if data was actually imported above,
                                                   // then update the database with the min/max times and last upload time
                                                   if (wasDataActuallyImported &&
                                                       typeof info.min_time !== 'undefined' &&
                                                       typeof info.max_time !== 'undefined') {
                                                      self.updateLastUploadTime(feed.id,
                                                                                info.min_time,
                                                                                info.max_time,
                                                                                function(err) {
                                                                                   if (err) {
                                                                                      return callback(new Error("Failed to update last upload time after importing data"));
                                                                                   }
                                                                                   return callback(null, info);
                                                                                });
                                                   }
                                                   else {
                                                      return callback(null, info);
                                                   }
                                                });
                           }
      );
   };

   this.findFeedsForDevice = function(deviceId, callback) {
      databaseHelper.execute("SELECT *, concat('feed_',id) AS datastoreId FROM Feeds WHERE deviceId=?", [deviceId], callback);
   };

   this.findById = function(id, callback) {
      databaseHelper.findOne("SELECT *, concat('feed_',id) AS datastoreId FROM Feeds WHERE id=?", [id], callback);
   };

   this.findByApiKey = function(apiKey, callback) {
      databaseHelper.findOne("SELECT *, concat('feed_',id) AS datastoreId FROM Feeds WHERE apiKey=? OR apiKeyReadOnly=?", [apiKey, apiKey], callback);
   };
};
