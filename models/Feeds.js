var trimAndCopyPropertyIfNonEmpty = require('../lib/objectUtils').trimAndCopyPropertyIfNonEmpty;
var copyPropertyIfDefinedAndNonNull = require('../lib/objectUtils').copyPropertyIfDefinedAndNonNull;
var JaySchema = require('jayschema');
var jsonValidator = new JaySchema();
var createRandomHexToken = require('../lib/token').createRandomHexToken;
var ValidationError = require('../lib/errors').ValidationError;
var httpStatus = require('http-status');
var BodyTrackDatastore = require('bodytrack-datastore');
var Query2Query = require('../lib/Query2Query');

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
                         "`channelSpecs` text NOT NULL, " +
                         "`channelBounds` text DEFAULT NULL, " +
                         "`created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
                         "`modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, " +
                         "`lastUpload` timestamp DEFAULT 0, " +
                         "`minTimeSecs` double DEFAULT NULL, " +
                         "`maxTimeSecs` double DEFAULT NULL, " +
                         "PRIMARY KEY (`id`), " +
                         "KEY `name` (`name`), " +
                         "KEY `deviceId` (`deviceId`), " +
                         "KEY `productId` (`productId`), " +
                         "KEY `userId` (`userId`), " +
                         "UNIQUE KEY `apiKey` (`apiKey`), " +
                         "UNIQUE KEY `apiKeyReadOnly` (`apiKeyReadOnly`), " +
                         "KEY `exposure` (`exposure`), " +
                         "KEY `isPublic` (`isPublic`), " +
                         "KEY `isMobile` (`isMobile`), " +
                         "KEY `latitude` (`latitude`), " +
                         "KEY `longitude` (`longitude`), " +
                         "KEY `created` (`created`), " +
                         "KEY `modified` (`modified`), " +
                         "KEY `lastUpload` (`lastUpload`), " +
                         "KEY `minTimeSecs` (`minTimeSecs`), " +
                         "KEY `maxTimeSecs` (`maxTimeSecs`), " +
                         "CONSTRAINT `feeds_deviceId_fk_1` FOREIGN KEY (`deviceId`) REFERENCES `Devices` (`id`), " +
                         "CONSTRAINT `feeds_productId_fk_1` FOREIGN KEY (`productId`) REFERENCES `Products` (`id`), " +
                         "CONSTRAINT `feeds_userId_fk_1` FOREIGN KEY (`userId`) REFERENCES `Users` (`id`) " +
                         ") ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8";

var query2query = new Query2Query();
query2query.addField('id', true, true, false, Query2Query.types.INTEGER);
query2query.addField('name', true, true, false);
query2query.addField('deviceId', true, true, false, Query2Query.types.INTEGER);
query2query.addField('productId', true, true, false, Query2Query.types.INTEGER);
query2query.addField('userId', true, true, false, Query2Query.types.INTEGER);
query2query.addField('apiKey', false, false, false);
query2query.addField('apiKeyReadOnly', false, false, false);
query2query.addField('exposure', true, true, false);
query2query.addField('isPublic', true, true, false, Query2Query.types.BOOLEAN);
query2query.addField('isMobile', true, true, false, Query2Query.types.BOOLEAN);
query2query.addField('latitude', true, true, true, Query2Query.types.NUMBER);
query2query.addField('longitude', true, true, true, Query2Query.types.NUMBER);
query2query.addField('channelSpecs', false, false, false);
query2query.addField('channelBounds', false, false, true);
query2query.addField('created', true, true, false, Query2Query.types.DATETIME);
query2query.addField('modified', true, true, false, Query2Query.types.DATETIME);
query2query.addField('lastUpload', true, true, false, Query2Query.types.DATETIME);
query2query.addField('minTimeSecs', true, true, true, Query2Query.types.NUMBER);
query2query.addField('maxTimeSecs', true, true, true, Query2Query.types.NUMBER);

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

         // now that we have validated, get the default channel specs from this device's Products table record (which
         // was already validated when inserted into the product, so no need to do so again here)
         databaseHelper.findOne("SELECT defaultChannelSpecs FROM Products WHERE id = ?",
                                [productId],
                                function(err2, result) {
                                   if (err2) {
                                      return callback(err2);
                                   }

                                   feed.channelSpecs = result.defaultChannelSpecs;

                                   // now that we have the channel specs, try to insert
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

                              // create the bounds object we'll return to the caller
                              var bounds = {
                                 channelBounds : {},
                                 importedBounds : {}
                              };

                              // If there was no error, then first see whether any data were actually
                              // imported.  The "channel_specs" field will be defined and non-null if so.
                              var wasDataActuallyImported = typeof importResult.channel_specs !== 'undefined' && importResult.channel_specs != null;

                              // if data was imported, then copy the imported_bounds from importResult to our
                              // new bounds object, but change field names from snake case to camel case.
                              if (wasDataActuallyImported) {
                                 bounds.importedBounds.channels = {};
                                 bounds.importedBounds.minTimeSecs = Number.MAX_VALUE;
                                 bounds.importedBounds.maxTimeSecs = Number.MIN_VALUE;
                                 Object.keys(importResult.channel_specs).forEach(function(channelName) {
                                    var importedBounds = importResult.channel_specs[channelName].imported_bounds;
                                    bounds.importedBounds.channels[channelName] = {
                                       minTimeSecs : importedBounds.min_time,
                                       maxTimeSecs : importedBounds.max_time,
                                       minValue : importedBounds.min_value,
                                       maxValue : importedBounds.max_value
                                    };

                                    bounds.importedBounds.minTimeSecs = Math.min(bounds.importedBounds.minTimeSecs, importedBounds.min_time);
                                    bounds.importedBounds.maxTimeSecs = Math.max(bounds.importedBounds.maxTimeSecs, importedBounds.max_time);
                                 });
                              }

                              // Get the info for this device so we can return the current state to the caller and
                              // optionally update the channel bounds, min/max times, and last upload time in the DB.
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
                                                   // time will be defined.  If they are, and if data was actually
                                                   // imported above, then update the database with the channel bounds,
                                                   // the min/max times, and last upload time
                                                   if (wasDataActuallyImported &&
                                                       typeof info.min_time !== 'undefined' &&
                                                       typeof info.max_time !== 'undefined') {

                                                      // Iterate over each of the channels in the info from the datastore
                                                      // and copy to our bounds object.
                                                      var deviceAndChannelPrefixLength = (feed.datastoreId + ".").length;
                                                      bounds.channelBounds.channels = {};
                                                      Object.keys(info.channel_specs).forEach(function(deviceAndChannel) {
                                                         var channelName = deviceAndChannel.slice(deviceAndChannelPrefixLength);
                                                         var channelInfo = info.channel_specs[deviceAndChannel];

                                                         // copy the bounds (changing from snake to camel case)
                                                         var channelBounds = channelInfo.channel_bounds;
                                                         bounds.channelBounds.channels[channelName] = {
                                                            minTimeSecs : channelBounds.min_time,
                                                            maxTimeSecs : channelBounds.max_time,
                                                            minValue : channelBounds.min_value,
                                                            maxValue : channelBounds.max_value
                                                         };
                                                      });
                                                      bounds.channelBounds.minTimeSecs = info.min_time;
                                                      bounds.channelBounds.maxTimeSecs = info.max_time;

                                                      // finally, update the database with the new bounds and lastUpload time
                                                      databaseHelper.execute("UPDATE Feeds SET " +
                                                                             "minTimeSecs=?, " +
                                                                             "maxTimeSecs=?, " +
                                                                             "channelBounds=?, " +
                                                                             "lastUpload=now() " +
                                                                             "WHERE id=?",
                                                                             [bounds.channelBounds.minTimeSecs,
                                                                              bounds.channelBounds.maxTimeSecs,
                                                                              JSON.stringify(bounds.channelBounds),
                                                                              feed.id],
                                                                             function(err) {
                                                                                if (err) {
                                                                                   return callback(new Error("Failed to update last upload time after importing data"));
                                                                                }
                                                                                return callback(null, bounds);
                                                                             });
                                                   }
                                                   else {
                                                      return callback(null, bounds);
                                                   }
                                                });
                           }
      );
   };

   this.findFeeds = function(queryString, callback) {

      query2query.parse(queryString, function(err, queryParts) {
         log.debug("QUERY PARTS: " + JSON.stringify(queryParts, null, 3));

         if (err) {
            return callback(err);
         }

         var sql = queryParts.sql("Feeds", false);
         log.debug(sql);
         databaseHelper.execute(sql, queryParts.whereValues, function(err, result) {
            if (err) {
               log.error("Feeds.findFeeds(): " + err);
               return callback(err);
            }
            return callback(null, result);
         });
      });
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
