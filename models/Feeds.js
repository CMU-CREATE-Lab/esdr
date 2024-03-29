const trimAndCopyPropertyIfNonEmpty = require('../lib/objectUtils').trimAndCopyPropertyIfNonEmpty;
const copyPropertyIfDefinedAndNonNull = require('../lib/objectUtils').copyPropertyIfDefinedAndNonNull;
const Ajv = require('ajv');
const createRandomHexToken = require('../lib/token').createRandomHexToken;
const ValidationError = require('../lib/errors').ValidationError;
const httpStatus = require('http-status');
const BodyTrackDatastore = require('bodytrack-datastore');
const query2query = require('./feeds-query2query');
const config = require('../config');
const flow = require('nimble');
const JSendClientError = require('jsend-utils').JSendClientError;
const JSendServerError = require('jsend-utils').JSendServerError;
const isString = require('data-type-utils').isString;

// instantiate the datastore
const datastore = new BodyTrackDatastore({
                                            binDir : config.get("datastore:binDirectory"),
                                            dataDir : config.get("datastore:dataDirectory")
                                         });

const log = require('log4js').getLogger('esdr:models:feeds');

// language=MySQL
const CREATE_TABLE_QUERY = " CREATE TABLE IF NOT EXISTS `Feeds` ( " +
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

const MAX_FOUND_FEEDS = 1000;
const MIN_CHANNEL_SPECS_STRING_LENGTH = 2;

const NAME_ATTRS = {
   "type" : "string",
   "minLength" : 1,
   "maxLength" : 255
};

const EXPOSURE_ATTRS = {
   "enum" : ['indoor', 'outdoor', 'virtual']
};

const LATITUDE_ATTRS = {
   "type" : ["number", "null"],
   "minimum" : -90,
   "maximum" : 90
};

const LONGITUDE_ATTRS = {
   "type" : ["number", "null"],
   "minimum" : -180,
   "maximum" : 180
};

const IS_PUBLIC_ATTRS = {
   "type" : "boolean"
};

const JSON_SCHEMA = {
   "$async" : true,
   "title" : "Feed",
   "description" : "An ESDR feed",
   "type" : "object",
   "properties" : {
      "name" : NAME_ATTRS,
      "exposure" : EXPOSURE_ATTRS,
      "latitude" : LATITUDE_ATTRS,
      "longitude" : LONGITUDE_ATTRS,
      "isPublic" : IS_PUBLIC_ATTRS,
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

const JSON_PATCH_DOCUMENT_SCHEMA = {
   "$async" : true,
   "title" : "JSON Patch Document",
   "description" : "A set of JSON PATCH operations allowed by ESDR for patching feeds.",
   "type" : "array",
   "minItems" : 1,
   "items" : {
      "type" : "object",
      "properties" : {
         "op" : {
            "enum" : ['replace']
         },
         "path" : {
            "enum" : ['/name', '/latitude', '/longitude', '/isPublic', '/exposure']
         },
      },
      "required" : ["op", "path", "value"]
   }
};

const ajv = new Ajv({ allErrors : true });
const ifFeedIsValid = ajv.compile(JSON_SCHEMA);
const ifJsonPatchDocumentIsValid = ajv.compile(JSON_PATCH_DOCUMENT_SCHEMA);

const createJsonSchema = function(path, valueAttrs) {
   return {
      "$async" : true,
      "type" : "object",
      "properties" : {
         "path" : {
            "enum" : [path]
         },
         "value" : valueAttrs
      },
      "required" : ["path", "value"]
   };
};
const jsonPatchPathValueValidators = {
   '/name' : ajv.compile(createJsonSchema('/name', NAME_ATTRS)),
   '/latitude' : ajv.compile(createJsonSchema('/latitude', LATITUDE_ATTRS)),
   '/longitude' : ajv.compile(createJsonSchema('/longitude', LONGITUDE_ATTRS)),
   '/isPublic' : ajv.compile(createJsonSchema('/isPublic', IS_PUBLIC_ATTRS)),
   '/exposure' : ajv.compile(createJsonSchema('/exposure', EXPOSURE_ATTRS)),
};

module.exports = function(databaseHelper) {

   const self = this;

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
      const feed = {
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

      let channelSpecs = null;
      flow.series(
            [
               // get the channelSpecs from the product, if necessary
               function(done) {
                  const isChannelSpecsSpecified = (typeof feedDetails.channelSpecs !== 'undefined') && (feedDetails.channelSpecs != null);
                  if (isChannelSpecsSpecified) {
                     channelSpecs = JSON.stringify(feedDetails.channelSpecs);
                     done();
                  }
                  else {
                     // Since the channelSpecs weren't specified, get the default channel specs from this device's
                     // Product (which was already validated when inserted into the product, so no need to do so here)
                     // language=MySQL
                     const sql = "SELECT defaultChannelSpecs FROM Products WHERE id = ?";
                     databaseHelper.findOne(sql,
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

               ifFeedIsValid(feed)
                     .then(function() {
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
                     })
                     .catch(err => callback(new ValidationError(err)));
            }
      );
   };

   // This method assumes you've already determined that the feed exists and is allowed to be patched!  That is, you've
   // done proper authentication/authorization and have determined that the user attempting to do the patch actually
   // owns the feed.
   this.patch = function(feedId, jsonPatchDocument, callback) {
      ifJsonPatchDocumentIsValid(jsonPatchDocument)
            .then(() => {
               try {
                  // The patch document is valid, so now iterate over the operations and roll them up into edits (in
                  // case of duplicate operations on the same path, then our policy is last one wins).  I'm not clear on
                  // what the "right" thing is to do if, say, a user submits a patch document with two operations like
                  // this:
                  //
                  // [
                  //    {op: "replace", path: "/latitude", value: "bogus"},
                  //    {op: "replace", path: "/latitude", value: 40.440624}
                  // ]
                  //
                  // The first one is invalid since latitude must be a number, but by the "last one wins" rule, then do
                  // we really care since it gets superceded by the following valid one?  I'm going to say that, no, we
                  // don't. So, with that policy in mind, my approach is going to be to iterate over all operations, and
                  // put them into a Map keyed on path.  Then, iterate over the items in the Map and validate before
                  // constructing the SQL.
                  const pathToNewValue = new Map();
                  jsonPatchDocument.forEach(({ _, path, value }) => {
                     pathToNewValue.set(path, value);
                  });

                  // iterate over the map entries and create a validation promise to validate the value depending on the path
                  const validationPromises = [];
                  for (const [path, value] of pathToNewValue.entries()) {
                     validationPromises.push(new Promise((resolve, reject) => {
                        jsonPatchPathValueValidators[path]({ path : path, value : value })
                              .then(resolve)
                              .catch(e => {
                                 const o = {}
                                 o[path] = e;
                                 reject(o);
                              })
                     }));
                  }

                  // validate all in parallel, waiting for them all to settle and then round up the results
                  Promise.allSettled(validationPromises)
                        .then(results => {
                           // find any validation errors and dump them into a map keyed on path (which we'll return to
                           // the user)
                           const validationErrorsByPath = {};
                           for (const result of results) {
                              if (result.status === 'rejected') {
                                 for (const path of Object.keys(result.reason)) {
                                    validationErrorsByPath[path] = result.reason[path];
                                 }
                              }
                           }

                           // See whether there were any validation errors and respond accordingly
                           if (Object.keys(validationErrorsByPath).length > 0) {
                              callback(new ValidationError(validationErrorsByPath));
                           }
                           else {
                              // OK, all validation checks out, so attempt to update the database.  Start by building
                              // the SQL command
                              const setClauses = [];
                              const values = [];

                              for (const [path, value] of pathToNewValue.entries()) {
                                 const fieldName = path.slice(1);    // chop off the leading slash
                                 setClauses.push(fieldName + '=?')
                                 values.push(value);
                              }

                              const sqlParts = ['UPDATE Feeds SET'];
                              sqlParts.push(setClauses.join(', '));
                              sqlParts.push('WHERE id=?');
                              values.push(feedId);

                              // join the sql parts into the SQL string
                              const sql = sqlParts.join(' ');

                              // execute the update command!
                              databaseHelper.execute(sql, values, function(err) {
                                 if (err) {
                                    callback(err);
                                 }
                                 else {
                                    callback(null, {
                                       feedId : feedId,
                                       patched : Object.fromEntries(pathToNewValue),
                                    });
                                 }
                              });
                           }
                        })
                        .catch(e => {
                           log.error("Error in FeedModel.patch allSettled...this probably shouldn't happen: ", e);
                           return callback(new JSendServerError("Internal Server Error"));
                        })
               }
               catch (e) {
                  log.error("Error while processing the patch: " + e);
                  return callback(new JSendServerError("Internal Server Error"));
               }
            })
            .catch(err => callback(new ValidationError(err)));
   };

   this.deleteFeed = function(feedId, userId, callback) {
      // We want to be able to return proper HTTP status codes for if the feed doesn't exist (404), the feed isn't owned
      // by the user (403), or successful delete (200), etc.  So, we'll create a transaction, try to find the feed,
      // manually check whether the feed is owned by the user, and proceed with the delete accordingly.

      let connection = null;
      let error = null;
      const hasError = function() {
         return error != null;
      };
      let isExistingFeed = false;
      let isFeedOwnedByUser = false;
      let deleteResult = null;

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
                     // language=MySQL
                     connection.query("SELECT userId FROM Feeds WHERE id=?",
                                      [feedId],
                                      function(err, rows) {
                                         if (err) {
                                            error = err;
                                         }
                                         else {
                                            // set flags for whether the feed exists and is owned by the requesting user
                                            isExistingFeed = (rows && rows.length === 1);
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

               // delete ONLY if there were no errors, the feed exists, and is owned by the user.  If so, start by
               // deleting any feed properties and then delete the feed if no errors
               function(done) {
                  if (!hasError() && isExistingFeed && isFeedOwnedByUser) {
                     log.debug("delete feed [user " + userId + ", feed " + feedId + "]: 4) Delete the feed properties (if any), then the feed");
                     // language=MySQL
                     connection.query("DELETE FROM FeedProperties where feedId = ?",
                                      [feedId],
                                      function(err) {
                                         if (err) {
                                            error = err;
                                         }
                                         else {
                                            connection.query("DELETE FROM Feeds where id = ? AND userId = ?",
                                                             [feedId, userId],
                                                             function(err) {
                                                                if (err) {
                                                                   error = err;
                                                                }
                                                                else {
                                                                   deleteResult = {
                                                                      id : feedId
                                                                   };
                                                                }
                                                                done();
                                                             });
                                         }
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
                           }
                           else {
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
                        function(err, tile) {

                           if (err) {
                              if (err.data && err.data.code === httpStatus.UNPROCESSABLE_ENTITY) {
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
      const feedMap = {};
      feedsAndChannels.forEach(function(item) {
         const feeds = item.feeds;
         const channels = item.channels;

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
      const userIdDeviceChannelObjects = [];
      Object.keys(feedMap).forEach(function(feedId) {
         userIdDeviceChannelObjects.push({
                                            userId : feedMap[feedId].userId,
                                            deviceName : getDatastoreDeviceNameForFeed(feedId),
                                            channelNames : Object.keys(feedMap[feedId].channels)
                                         });
      });

      try {
         datastore.getTiles(userIdDeviceChannelObjects, level, offset, callback);
      }
      catch (e) {
         log.error("Error calling datastore.getTiles: " + JSON.stringify(e, null, 3));
         callback(e);
      }
   };

   const getDatastoreDeviceNameForFeed = function(feedId) {
      return "feed_" + feedId;
   };

   const createEmptyTile = function(level, offset) {
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
      const deviceName = getDatastoreDeviceNameForFeed(feed.id);
      datastore.importJson(feed.userId,
                           deviceName,
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
                              const bounds = {
                                 channelBounds : {},
                                 importedBounds : {}
                              };

                              // If there was no error, then first see whether any data were actually
                              // imported.  The "channel_specs" field will be defined and non-null if so.
                              const wasDataActuallyImported = typeof importResult['channel_specs'] !== 'undefined' && importResult['channel_specs'] != null;

                              // if data was imported, then copy the imported_bounds from importResult to our
                              // new bounds object, but change field names from snake case to camel case.
                              if (wasDataActuallyImported) {
                                 bounds.importedBounds.channels = {};
                                 bounds.importedBounds.minTimeSecs = Number.MAX_VALUE;
                                 bounds.importedBounds.maxTimeSecs = Number.MIN_VALUE;
                                 Object.keys(importResult['channel_specs']).forEach(function(channelName) {
                                    const importedBounds = importResult['channel_specs'][channelName]['imported_bounds'];
                                    bounds.importedBounds.channels[channelName] = {
                                       minTimeSecs : importedBounds['min_time'],
                                       maxTimeSecs : importedBounds['max_time'],
                                       minValue : importedBounds['min_value'],
                                       maxValue : importedBounds['max_value']
                                    };

                                    bounds.importedBounds.minTimeSecs = Math.min(bounds.importedBounds.minTimeSecs, importedBounds['min_time']);
                                    bounds.importedBounds.maxTimeSecs = Math.max(bounds.importedBounds.maxTimeSecs, importedBounds['max_time']);
                                 });
                              }

                              // Get the info for this device so we can return the current state to the caller and
                              // optionally update the channel bounds, min/max times, and last upload time in the DB.
                              datastore.getInfo({
                                                   userId : feed.userId,
                                                   deviceName : deviceName
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
                                                       typeof info['min_time'] !== 'undefined' &&
                                                       typeof info['max_time'] !== 'undefined') {

                                                      // Iterate over each of the channels in the info from the datastore
                                                      // and copy to our bounds object.
                                                      const deviceAndChannelPrefixLength = (deviceName + ".").length;
                                                      bounds.channelBounds.channels = {};
                                                      Object.keys(info['channel_specs']).forEach(function(deviceAndChannel) {
                                                         const channelName = deviceAndChannel.slice(deviceAndChannelPrefixLength);
                                                         const channelInfo = info['channel_specs'][deviceAndChannel];

                                                         // copy the bounds (changing from snake to camel case)
                                                         const channelBounds = channelInfo['channel_bounds'];
                                                         bounds.channelBounds.channels[channelName] = {
                                                            minTimeSecs : channelBounds['min_time'],
                                                            maxTimeSecs : channelBounds['max_time'],
                                                            minValue : channelBounds['min_value'],
                                                            maxValue : channelBounds['max_value']
                                                         };
                                                      });
                                                      bounds.channelBounds.minTimeSecs = info['min_time'];
                                                      bounds.channelBounds.maxTimeSecs = info['max_time'];

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

   this.getMostRecent = function(feed, channelName, callback) {
      const deviceName = getDatastoreDeviceNameForFeed(feed.id);

      const options = {
         userId : feed.userId,
         deviceName : deviceName,
         willFindMostRecentSample : true
      };

      if (isString(channelName)) {
         options.channelName = channelName;
      }

      datastore.getInfo(options,
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

                           const channelInfo = {
                              channels : {}
                           };

                           // If there's data in the datastore for this device, rawInfo['channel_specs'] will be non-empty
                           if (rawInfo && rawInfo['channel_specs']) {
                              // Iterate over each of the channels in the info from the datastore
                              // and copy to our channelInfo object.
                              const deviceAndChannelPrefixLength = (deviceName + ".").length;
                              Object.keys(rawInfo['channel_specs']).forEach(function(deviceAndChannel) {
                                 const channelName = deviceAndChannel.slice(deviceAndChannelPrefixLength);
                                 const rawChannelInfo = rawInfo['channel_specs'][deviceAndChannel];

                                 channelInfo.channels[channelName] = {};

                                 // copy the bounds and most recent data sample (changing from snake to camel case)
                                 if (rawChannelInfo['channel_bounds']) {
                                    channelInfo.channels[channelName].channelBounds = {
                                       minTimeSecs : rawChannelInfo['channel_bounds']['min_time'],
                                       maxTimeSecs : rawChannelInfo['channel_bounds']['max_time'],
                                       minValue : rawChannelInfo['channel_bounds']['min_value'],
                                       maxValue : rawChannelInfo['channel_bounds']['max_value']
                                    };
                                 }
                                 if (rawChannelInfo['most_recent_data_sample']) {
                                    channelInfo.channels[channelName].mostRecentDataSample = {
                                       timeSecs : rawChannelInfo['most_recent_data_sample'].time,
                                       value : rawChannelInfo['most_recent_data_sample'].value
                                    };
                                 }
                                 if (rawChannelInfo['most_recent_string_sample']) {
                                    channelInfo.channels[channelName].mostRecentStringSample = {
                                       timeSecs : rawChannelInfo['most_recent_string_sample'].time,
                                       value : rawChannelInfo['most_recent_string_sample'].value
                                    };
                                 }
                              });

                              return callback(null, channelInfo);
                           }
                           else {
                              return callback(null, channelInfo);
                           }
                        });
   };

   /**
    * Exports the specified feed channels, with the given options. Data is returned to the callback via an EventEmitter.
    *
    * @param {Array} feedAndChannelsObjects - array of objects of the form <code>{feed: FEED_OBJ, channels: ["CHANNEL_1",...]}</code>
    * @param {Object} options
    * @param {function} callback
    */
   this.exportData = function(feedAndChannelsObjects, options, callback) {
      options = options || {};
      const userIdDeviceChannelObjects = [];
      feedAndChannelsObjects.forEach(function(feedAndChannels) {
         userIdDeviceChannelObjects.push({
                                            userId : feedAndChannels.feed.userId,
                                            deviceName : getDatastoreDeviceNameForFeed(feedAndChannels.feed.id),
                                            channelNames : feedAndChannels.channels
                                         });
      });
      datastore.exportData(userIdDeviceChannelObjects,
                           {
                              minTime : options.minTime,
                              maxTime : options.maxTime,
                              format : options.format,
                              timezone : options.timezone
                           },
                           callback);
   };

   this.find = function(authUserId, queryString, callback) {

      query2query.parse(queryString,
                        function(err, queryParts) {

                           if (err) {
                              return callback(err);
                           }

                           // We need to be really careful about security here!  Restrict the WHERE clause to allow returning
                           // only the public feeds, or feeds owned by the authenticated user (if any).
                           let additionalWhereExpression = "(isPublic = true)";
                           if (authUserId != null) {
                              additionalWhereExpression = "(" + additionalWhereExpression + " OR (userId = " + authUserId + "))";
                           }
                           let whereClause = "WHERE " + additionalWhereExpression;
                           if (queryParts.whereExpressions.length > 0) {
                              whereClause += " AND (" + queryParts.where + ")";
                           }

                           // More security! Now disallow selection of the apiKey if not authenticated.  If the user IS authenticated,
                           // then we'll need to manually remove the apiKey field from feeds not owned by the auth'd user after we fetch
                           // the feeds from the database (see below).
                           const apiKeyIndex = queryParts.selectFields.indexOf('apiKey');
                           if (authUserId == null && apiKeyIndex >= 0) {
                              // remove the apiKey field from the array
                              queryParts.selectFields.splice(apiKeyIndex, 1);
                           }

                           // remember whether the user is requesting the user ID
                           const isRequestingUserId = queryParts.selectFields.indexOf('userId') >= 0;

                           // we need the user ID in order to do the feed ownership security check below, so make sure
                           // it gets requested in the query
                           if (!isRequestingUserId) {
                              queryParts.selectFields.push('userId');
                           }

                           // build the restricted SQL query
                           const restrictedSql = [
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
                                    if (feed.userId !== authUserId) {
                                       delete feed.apiKey;
                                    }
                                 });
                              }

                              // finally, if the user didn't request the userId, strip it out of the found feeds
                              if (!isRequestingUserId) {
                                 result.rows.forEach(function(feed) {
                                    delete feed.userId;
                                 });

                                 // restore the queryParts.selectFields by filtering out the userId field
                                 queryParts.selectFields = queryParts.selectFields.filter(f => f !== 'userId');
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

         const sql = queryParts.selectClause + " FROM Feeds WHERE id=?";
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
    * Returns <code>true</code> if the feed denoted by the given <code>feedId</code> is owned by the user denoted by the
    * given <code>userId</code>; <code>false</code> otherwise.
    *
    * @param {int} feedId ID of the feed to find.
    * @param {int} userId ID of the user to find.
    * @param {function} callback function with signature <code>callback(err, isOwnedByUser, doesFeedExist)</code>
    */
   this.isFeedOwnedByUser = function(feedId, userId, callback) {
      self.findById(feedId, "userId", function(err, feed) {
         if (err) {
            callback(err);
         }
         else {
            if (feed) {
               callback(null, feed.userId === userId, true);
            }
            else {
               callback(null, false, false);
            }
         }
      })
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

      let limitedQueryString;
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

                           const handleFindResult = function(err, result) {
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
                              const sql = queryParts.sql("Feeds", true);
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

         const filteredFeed = {};
         queryParts.selectFields.forEach(function(fieldName) {
            if (fieldName in feed) {
               filteredFeed[fieldName] = feed[fieldName];
            }
         });

         callback(null, filteredFeed);
      });
   };
};
