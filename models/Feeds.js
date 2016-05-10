var trimAndCopyPropertyIfNonEmpty = require('../lib/objectUtils').trimAndCopyPropertyIfNonEmpty;
var copyPropertyIfDefinedAndNonNull = require('../lib/objectUtils').copyPropertyIfDefinedAndNonNull;
var JaySchema = require('jayschema');
var jsonValidator = new JaySchema();
var createRandomHexToken = require('../lib/token').createRandomHexToken;
var ValidationError = require('../lib/errors').ValidationError;
var httpStatus = require('http-status');
var BodyTrackDatastore = require('bodytrack-datastore');
var query2query = require('./feeds-query2query');
var config = require('../config');
var flow = require('nimble');
var nr = require('newrelic');
var JSendClientError = require('jsend-utils').JSendClientError;
var JSendServerError = require('jsend-utils').JSendServerError;
var isString = require('../lib/typeUtils').isString;

// instantiate the datastore
var datastore = new BodyTrackDatastore({
   binDir : config.get("datastore:binDirectory"),
   dataDir : config.get("datastore:dataDirectory")
});

var log = require('log4js').getLogger('esdr:models:feeds');

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
                         "`lastUpload` timestamp NOT NULL DEFAULT 0, " +
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

var MAX_FOUND_FEEDS = 1000;
var MIN_CHANNEL_SPECS_STRING_LENGTH = 2;

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
         "enum" : ['indoor', 'outdoor', 'virtual']
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
      },
      "channelSpecs" : {
         "type" : "string",
         "minLength" : MIN_CHANNEL_SPECS_STRING_LENGTH
      }
   },
   "required" : ["name", "exposure", "channelSpecs"]
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

      var channelSpecs = null;
      flow.series(
            [
               // get the channelSpecs from the product, if necessary
               function(done) {
                  var isChannelSpecsSpecified = (typeof feedDetails.channelSpecs !== 'undefined') && (feedDetails.channelSpecs != null);
                  if (isChannelSpecsSpecified) {
                     channelSpecs = JSON.stringify(feedDetails.channelSpecs);
                     done();
                  }
                  else {
                     // Since the channelSpecs weren't specified, get the default channel specs from this device's
                     // Product (which was already validated when inserted into the product, so no need to do so here)
                     databaseHelper.findOne("SELECT defaultChannelSpecs FROM Products WHERE id = ?",
                                            [productId],
                                            function(err, result) {
                                               if (err) {
                                                  log.error("Feeds.create: failed to get defaultChannelSpecs for product [" + productId + "]");
                                               }
                                               else {
                                                  if (result) {
                                                     channelSpecs = result.defaultChannelSpecs;
                                                  }
                                                  else {
                                                     log.error("Feeds.create: no result when getting defaultChannelSpecs for product [" + productId + "]");
                                                  }
                                               }

                                               done();
                                            });
                  }
               }
            ],

            // now that we (should) have the channelSpecs, validate
            function() {
               feed.channelSpecs = channelSpecs;

               jsonValidator.validate(feed, JSON_SCHEMA, function(err1) {
                  if (err1) {
                     return callback(new ValidationError(err1));
                  }

                  // now try to insert
                  databaseHelper.execute("INSERT INTO Feeds SET ?", feed, function(err2, result) {
                     if (err2) {
                        return callback(err2);
                     }

                     return callback(null, {
                        insertId : result.insertId,
                        apiKey : feed.apiKey,
                        apiKeyReadOnly : feed.apiKeyReadOnly
                     });
                  });

               });
            }
      );
   };

   this.deleteFeed = function(feedId, userId, callback) {
      // We want to be able to return proper HTTP status codes for if the feed doesn't exist (404), the feed isn't owned
      // by the user (403), or successful delete (200), etc.  So, we'll create a transaction, try to find the feed,
      // manually check whether the feed is owned by the user, and proceed with the delete accordingly.

      var connection = null;
      var error = null;
      var hasError = function() {
         return error != null;
      };
      var isExistingFeed = false;
      var isFeedOwnedByUser = false;
      var deleteResult = null;

      flow.series(
            [
               // get the connection
               function(done) {
                  log.debug("delete feed [user " + userId + ", feed " + feedId + "]: 1) Getting the connection");
                  databaseHelper.getConnection(function(err, newConnection) {
                     if (err) {
                        error = err;
                     }
                     else {
                        connection = newConnection;
                     }
                     done();
                  });
               },

               // begin the transaction
               function(done) {
                  if (!hasError()) {
                     log.debug("delete feed [user " + userId + ", feed " + feedId + "]: 2) Beginning the transaction");
                     connection.beginTransaction(function(err) {
                        if (err) {
                           error = err;
                        }
                        done();
                     });
                  }
                  else {
                     done();
                  }
               },

               // find the feed
               function(done) {
                  if (!hasError()) {
                     log.debug("delete feed [user " + userId + ", feed " + feedId + "]: 3) Find the feed");
                     connection.query("SELECT userId FROM Feeds WHERE id=?",
                                      [feedId],
                                      function(err, rows) {
                                         if (err) {
                                            error = err;
                                         }
                                         else {
                                            // set flags for whether the feed exists and is owned by the requesting user
                                            isExistingFeed = (rows && rows.length == 1);
                                            if (isExistingFeed) {
                                               isFeedOwnedByUser = rows[0].userId === userId;
                                            }
                                         }
                                         done();
                                      });
                  }
                  else {
                     done();
                  }
               },

               // delete ONLY if there were no errors, the feed exists, and is owned by the user
               function(done) {
                  if (!hasError() && isExistingFeed && isFeedOwnedByUser) {
                     log.debug("delete feed [user " + userId + ", feed " + feedId + "]: 4) Delete the feed");
                     connection.query("DELETE FROM Feeds where id = ? AND userId = ?",
                                      [feedId, userId],
                                      function(err, result) {
                                         if (err) {
                                            error = err;
                                         }
                                         else {
                                            deleteResult = result;
                                         }
                                         done();
                                      });
                  }
                  else {
                     log.debug("delete feed [user " + userId + ", feed " + feedId + "]: 4) Delete skipped because feed doesn't exist or not owned by user");
                     done();
                  }
               }
            ],

            // handle outcome
            function() {
               log.debug("delete feed [user " + userId + ", feed " + feedId + "]: 5) All done, now checking status and performing commit/rollback as necessary!");
               if (hasError()) {
                  connection.rollback(function() {
                     connection.release();
                     log.error("delete feed [user " + userId + ", feed " + feedId + "]: 6) An error occurred while deleting the feed, rolled back the transaction. Error:" + error);
                     callback(error);
                  });
               }
               else if (deleteResult == null) {
                  connection.rollback(function() {
                     connection.release();
                     log.info("delete feed [user " + userId + ", feed " + feedId + "]: 6) Feed not deleted (doesn't exist or not owned by user), rolled back the transaction.");
                     if (isExistingFeed) {
                        if (isFeedOwnedByUser) {
                           log.error("delete feed [user " + userId + ", feed " + feedId + "]: 7) The deleteResult is null, but the feed [" + feedId + "] exists AND is owned by the user [" + userId + "]--this should NEVER happen!");
                           return callback(new JSendServerError("Internal Server Error"));
                        }
                        else {
                           return callback(new JSendClientError("Forbidden", { id : feedId }, httpStatus.FORBIDDEN));
                        }
                     }
                     else {
                        return callback(new JSendClientError("Feed not found", { id : feedId }, httpStatus.NOT_FOUND));
                     }
                  });
               }
               else {
                  log.debug("delete feed [user " + userId + ", feed " + feedId + "]: 6) Delete successful, attempting to commit the transaction...");
                  connection.commit(function(err) {
                     if (err) {
                        log.error("delete feed [user " + userId + ", feed " + feedId + "]: 7) Failed to commit the transaction after deleting the feed");

                        // rollback and then release the connection
                        connection.rollback(function() {
                           connection.release();
                           callback(err);
                        });
                     }
                     else {
                        connection.release();
                        log.debug("delete feed [user " + userId + ", feed " + feedId + "]: 7) Commit successful!");

                        // delete datastore files from disk
                        datastore.deleteDevice(userId, getDatastoreDeviceNameForFeed(feedId), function(err) {
                           // Just log the error--we're more concerned about the database record being deleted, so we'll
                           // still return a success to the callback. We can have a cron job clean up orphaned datastore
                           // files later.
                           if (err) {
                              log.warn("delete feed [user " + userId + ", feed " + feedId + "]: 8) Failed to delete datastore files");
                           } else {
                              log.debug("delete feed [user " + userId + ", feed " + feedId + "]: 8) Datastore files deleted!");
                           }

                           callback(null, deleteResult);
                        });
                     }
                  });
               }
            }
      );
   };

   this.getTile = function(feed, channelName, level, offset, callback) {
      datastore.getTile(feed.userId,
                        getDatastoreDeviceNameForFeed(feed.id),
                        channelName,
                        level,
                        offset,
                        nr.createTracer("datastore:getTile",
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
                                        })
      );
   };

   /**
    * Get tiles at the specified <code>level</code> and <code>offset</code> for the specified feed channels, returning
    * data to the callback via an EventEmitter.  The feed channels are defined in the given
    * <code>feedsAndChannels</code> array, which must be an array of objects where each object must be of the form:
    * <code>
    *    {
    *    feeds : [ { id:FEED_ID, userId: FEED_USER_ID}, ... ],
    *    channels: [ "CHANNEL_1", ... ]
    *    }
    * </code>
    *
    * @param {Array} feedsAndChannels array of objects describing the feeds and channels
    * @param {int} level the tile level
    * @param {int} offset the tile offset
    * @param {function} callback
    */
   this.getTiles = function(feedsAndChannels, level, offset, callback) {

      // remove duplicates
      var feedMap = {};
      feedsAndChannels.forEach(function(item) {
         var feeds = item.feeds;
         var channels = item.channels;

         feeds.forEach(function(feed) {
            if (!(feed.id in feedMap)) {
               feedMap[feed.id] = { userId : feed.userId, channels : {} };
            }

            channels.forEach(function(channel) {
               feedMap[feed.id].channels[channel] = true;
            });
         });
      });

      // build the userIdDeviceChannelObjects array needed for the call to getTiles()
      var userIdDeviceChannelObjects = [];
      Object.keys(feedMap).forEach(function(feedId) {
         userIdDeviceChannelObjects.push({
                                            userId : feedMap[feedId].userId,
                                            deviceName : getDatastoreDeviceNameForFeed(feedId),
                                            channelNames : Object.keys(feedMap[feedId].channels)
                                         });
      });

      try {
         datastore.getTiles(userIdDeviceChannelObjects, level, offset, nr.createTracer("datastore:getTiles", callback));
      }
      catch (e) {
         log.error("Error calling datastore.getTiles: " + JSON.stringify(e, null, 3));
         callback(e);
      }
   };

   var getDatastoreDeviceNameForFeed = function(feedId) {
      return "feed_" + feedId;
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
      var deviceName = getDatastoreDeviceNameForFeed(feed.id);
      datastore.importJson(feed.userId,
                           deviceName,
                           data,
                           nr.createTracer("datastore:importJson",
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
                                                       deviceName : deviceName
                                                    },
                                                    nr.createTracer("datastore:getInfo",
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
                                                                          var deviceAndChannelPrefixLength = (deviceName + ".").length;
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
                                                                                                 }                                                                          );
                                                                       }
                                                                       else {
                                                                          return callback(null, bounds);
                                                                       }
                                                                    })
                                              );
                                           }
                           )
      );
   };

   this.getMostRecent = function(feed, channelName, callback) {
      var deviceName = getDatastoreDeviceNameForFeed(feed.id);

      var options = {
         userId : feed.userId,
         deviceName : deviceName,
         willFindMostRecentSample : true
      };

      if (isString(channelName)) {
         options.channelName = channelName;
      }

      datastore.getInfo(options,
                        nr.createTracer("datastore:getInfo",
                                        function(err, rawInfo) {
                                           if (err) {
                                              // See if the error contains a JSend data object.  If so, pass it on through.
                                              if (typeof err.data !== 'undefined' &&
                                                  typeof err.data.code !== 'undefined' &&
                                                  typeof err.data.status !== 'undefined') {
                                                 return callback(err);
                                              }
                                              return callback(new Error("Failed to get feed info"));
                                           }

                                           var channelInfo = {
                                              channels : {}
                                           };

                                           // If there's data in the datastore for this device, rawInfo.channel_specs will be non-empty
                                           if (rawInfo && rawInfo.channel_specs) {
                                              // Iterate over each of the channels in the info from the datastore
                                              // and copy to our channelInfo object.
                                              var deviceAndChannelPrefixLength = (deviceName + ".").length;
                                              Object.keys(rawInfo.channel_specs).forEach(function(deviceAndChannel) {
                                                 var channelName = deviceAndChannel.slice(deviceAndChannelPrefixLength);
                                                 var rawChannelInfo = rawInfo.channel_specs[deviceAndChannel];

                                                 channelInfo.channels[channelName] = {};

                                                 // copy the bounds and most recent data sample (changing from snake to camel case)
                                                 if (rawChannelInfo.channel_bounds) {
                                                    channelInfo.channels[channelName].channelBounds = {
                                                       minTimeSecs : rawChannelInfo.channel_bounds.min_time,
                                                       maxTimeSecs : rawChannelInfo.channel_bounds.max_time,
                                                       minValue : rawChannelInfo.channel_bounds.min_value,
                                                       maxValue : rawChannelInfo.channel_bounds.max_value
                                                    };
                                                 }
                                                 if (rawChannelInfo.most_recent_data_sample) {
                                                    channelInfo.channels[channelName].mostRecentDataSample = {
                                                       timeSecs : rawChannelInfo.most_recent_data_sample.time,
                                                       value : rawChannelInfo.most_recent_data_sample.value
                                                    };
                                                 }
                                                 if (rawChannelInfo.most_recent_string_sample) {
                                                    channelInfo.channels[channelName].mostRecentStringSample = {
                                                       timeSecs : rawChannelInfo.most_recent_string_sample.time,
                                                       value : rawChannelInfo.most_recent_string_sample.value
                                                    };
                                                 }
                                              });

                                              return callback(null, channelInfo);
                                           }
                                           else {
                                              return callback(null, channelInfo);
                                           }
                                        })
      );
   };

   /**
    * Exports the specified feed channels, optionally filtered with the given filter.  Data is returned to the callback
    * via an EventEmitter.
    *
    * @param {Array} feedAndChannelsObjects - array of objects of the form <code>{feed: FEED_OBJ, channels: ["CHANNEL_1",...]}</code>
    * @param {Object} filter
    * @param {function} callback
    */
   this.exportData = function(feedAndChannelsObjects, filter, callback) {
      filter = filter || {};
      var userIdDeviceChannelObjects = [];
      feedAndChannelsObjects.forEach(function(feedAndChannels) {
         userIdDeviceChannelObjects.push({
                                            userId : feedAndChannels.feed.userId,
                                            deviceName : getDatastoreDeviceNameForFeed(feedAndChannels.feed.id),
                                            channelNames : feedAndChannels.channels
                                         });
      });
      datastore.exportData(userIdDeviceChannelObjects,
                           {
                              minTime : filter.minTime,
                              maxTime : filter.maxTime,
                              format : filter.format
                           },
                           nr.createTracer("datastore:exportData", callback));
   };

   this.find = function(authUserId, queryString, callback) {

      query2query.parse(queryString,
                        function(err, queryParts) {

                           if (err) {
                              return callback(err);
                           }

                           // We need to be really careful about security here!  Restrict the WHERE clause to allow returning
                           // only the public feeds, or feeds owned by the authenticated user (if any).
                           var additionalWhereExpression = "(isPublic = true)";
                           if (authUserId != null) {
                              additionalWhereExpression = "(" + additionalWhereExpression + " OR (userId = " + authUserId + "))";
                           }
                           var whereClause = "WHERE " + additionalWhereExpression;
                           if (queryParts.whereExpressions.length > 0) {
                              whereClause += " AND (" + queryParts.where + ")";
                           }

                           // More security! Now disallow selection of the apiKey if not authenticated.  If the user IS authenticated,
                           // then we'll need to manually remove the apiKey field from feeds not owned by the auth'd user after we fetch
                           // the feeds from the database (see below).
                           var apiKeyIndex = queryParts.selectFields.indexOf('apiKey');
                           if (authUserId == null && apiKeyIndex >= 0) {
                              // remove the apiKey field from the array
                              queryParts.selectFields.splice(apiKeyIndex, 1);
                           }

                           // remember whether the user is requesting the user ID
                           var isRequestingUserId = queryParts.selectFields.indexOf('userId') >= 0;

                           // we need the user ID in order to do the feed ownership security check below, so make sure
                           // it gets requested in the query
                           if (!isRequestingUserId) {
                              queryParts.selectFields.push('userId');
                           }

                           // build the restricted SQL query
                           var restrictedSql = [
                              "SELECT " + queryParts.selectFields.join(','),
                              "FROM Feeds",
                              whereClause,
                              queryParts.orderByClause,
                              queryParts.limitClause
                           ].join(' ');
                           log.debug("Feeds.find(): " + restrictedSql + (queryParts.whereValues.length > 0 ? " [where values: " + queryParts.whereValues + "]" : ""));

                           // use findWithLimit so we can also get a count of the total number of records that would have been returned
                           // had there been no LIMIT clause included in the query
                           databaseHelper.findWithLimit(restrictedSql, queryParts.whereValues, function(err, result) {
                              if (err) {
                                 return callback(err);
                              }

                              // copy in the offset and limit
                              result.offset = queryParts.offset;
                              result.limit = queryParts.limit;

                              // now that we have the feeds, we need to manually remove the apiKey field (if selected) from all feeds
                              // which the user does not own.
                              if (authUserId != null && apiKeyIndex >= 0) {
                                 result.rows.forEach(function(feed) {
                                    if (feed.userId != authUserId) {
                                       delete feed.apiKey;
                                    }
                                 });
                              }

                              // finally, if the user didn't request the userId, strip it out of the found feeds
                              if (!isRequestingUserId) {
                                 result.rows.forEach(function(feed) {
                                    delete feed.userId;
                                 });
                              }

                              return callback(null, result, queryParts.selectFields);
                           });
                        },
                        MAX_FOUND_FEEDS);
   };

   /**
    * Tries to find the feed with the given <code>id</code> and returns it to the given <code>callback</code>. If
    * successful, the feed is returned as the 2nd argument to the <code>callback</code> function.  If unsuccessful,
    * <code>null</code> is returned to the callback.
    *
    * @param {string|int} id ID of the feed to find.
    * @param {string|array} fieldsToSelect comma-delimited string or array of strings of field names to select.
    * @param {function} callback function with signature <code>callback(err, feed)</code>
    */
   this.findById = function(id, fieldsToSelect, callback) {
      query2query.parse({ fields : fieldsToSelect }, function(err, queryParts) {
         if (err) {
            return callback(err);
         }

         var sql = queryParts.selectClause + " FROM Feeds WHERE id=?";
         databaseHelper.findOne(sql, [id], function(err, feed) {
            if (err) {
               log.error("Error trying to find feed with id [" + id + "]: " + err);
               return callback(err);
            }

            return callback(null, feed);
         });
      });
   };

   /**
    * Tries to find the feed with the given read-write or read-only API key and returns it to the given
    * <code>callback</code>. If successful, the feed is returned as the 2nd argument to the <code>callback</code>
    * function.  If unsuccessful, <code>null</code> is returned to the callback.
    *
    * @param {string} apiKey The read-write or read-only API key of the feed to find.
    * @param {string|array} fieldsToSelect comma-delimited string or array of strings of field names to select.
    * @param {function} callback function with signature <code>callback(err, feed)</code>
    */
   this.findByApiKey = function(apiKey, fieldsToSelect, callback) {
      query2query.parse({ fields : fieldsToSelect }, function(err, queryParts) {
         if (err) {
            return callback(err);
         }

         databaseHelper.findOne(queryParts.selectClause + " FROM Feeds WHERE apiKey=? OR apiKeyReadOnly=?",
                                [apiKey, apiKey],
                                callback);
      });
   };

   /**
    * Finds feeds contained in the set defined by the given whereSql.  Any where clause in the given queryString is
    * ignored. Returned feeds can be filtered by the "fields" param in the given queryString, ordered by the "orderBy"
    * param, and/or windowed by the "limit" and "offset" params.
    *
    * @param whereSql
    * @param queryString
    * @param willLimitResults
    * @param callback
    */
   this.findBySqlWhere = function(whereSql, queryString, willLimitResults, callback) {

      var limitedQueryString;
      if (typeof queryString !== 'undefined' && queryString != null) {
         // make a copy, then delete the where clause stuff
         limitedQueryString = JSON.parse(JSON.stringify(queryString));
         delete limitedQueryString['where'];
         delete limitedQueryString['whereOr'];
         delete limitedQueryString['whereAnd'];
         delete limitedQueryString['whereJoin'];
      }

      query2query.parse(queryString,
                        function(err, queryParts) {
                           if (err) {
                              return callback(err);
                           }

                           queryParts.where = whereSql.where;
                           queryParts.whereClause = "WHERE " + whereSql.where;
                           queryParts.whereValues = whereSql.values;

                           var handleFindResult = function(err, result) {
                              if (err) {
                                 return callback(err);
                              }

                              if (willLimitResults) {
                                 // copy in the offset and limit
                                 result.offset = queryParts.offset;
                                 result.limit = queryParts.limit;
                              }

                              return callback(null, result, queryParts.selectFields);
                           };

                           if (willLimitResults) {
                              // use findWithLimit so we can also get a count of the total number of records that would have been returned
                              // had there been no LIMIT clause included in the query
                              databaseHelper.findWithLimit(queryParts.sql("Feeds"),
                                                           queryParts.whereValues,
                                                           handleFindResult);
                           }
                           else {
                              // passing true in the 2nd argument ensures that limit/offset won't be considered
                              var sql = queryParts.sql("Feeds", true);
                              databaseHelper.execute(sql,
                                                     queryParts.whereValues,
                                                     handleFindResult);
                           }
                        },
                        MAX_FOUND_FEEDS);

   };

   this.filterFields = function(feed, fieldsToSelect, callback) {
      query2query.parse({ fields : fieldsToSelect }, function(err, queryParts) {
         if (err) {
            return callback(err);
         }

         var filteredFeed = {};
         queryParts.selectFields.forEach(function(fieldName) {
            if (fieldName in feed) {
               filteredFeed[fieldName] = feed[fieldName];
            }
         });

         callback(null, filteredFeed);
      });
   };
};
