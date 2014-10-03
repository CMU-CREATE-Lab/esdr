var httpStatus = require('http-status');
var log = require('log4js').getLogger();

module.exports = function(FeedModel, datastore) {

   this.importData = function(res, feed, data) {
      if (feed) {
         if (data) {

            datastore.importJson(feed.userId,
                                 feed.datastoreId,
                                 data,
                                 function(err, importResult) {
                                    if (err) {
                                       // See if the error contains a JSend data object.  If so, pass it on through.
                                       if (typeof err.data !== 'undefined' &&
                                           typeof err.data.code !== 'undefined' &&
                                           typeof err.data.status !== 'undefined') {
                                          return res.jsendPassThrough(err.data);
                                       }
                                       return res.jsendServerError("Failed to import data", err);
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
                                                               return res.jsendPassThrough(err.data);
                                                            }
                                                            return res.jsendServerError("Failed to get info after importing data", err);
                                                         }

                                                         // If there's data in the datastore for this device, then min and max
                                                         // time will be defined.  If they are, and if data was actually imported above,
                                                         // then update the database with the min/max times and last upload time
                                                         if (wasDataActuallyImported &&
                                                             typeof info.min_time !== 'undefined' &&
                                                             typeof info.max_time !== 'undefined') {
                                                            FeedModel.updateLastUploadTime(feed.id,
                                                                                           info.min_time,
                                                                                           info.max_time,
                                                                                           function(err) {
                                                                                              if (err) {
                                                                                                 return res.jsendServerError("Failed to update last upload time after importing data", err);
                                                                                              }
                                                                                              return res.jsendSuccess(info, httpStatus.OK); // HTTP 200 OK
                                                                                           });
                                                         }
                                                         else {
                                                            return res.jsendSuccess(info, httpStatus.OK); // HTTP 200 OK
                                                         }

                                                      });
                                 }
            );
         }
         else {
            return res.jsendClientError("No data received", null, httpStatus.BAD_REQUEST);
         }
      }
      else {
         return res.jsendClientError("Unknown or invalid feed", null, httpStatus.NOT_FOUND);
      }
   };

   this.getInfo = function(res, feed) {
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
                                    return res.jsendPassThrough(err.data);
                                 }
                                 return res.jsendServerError("Failed to get info for feed [" + feed.id + "]", err);
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

                              return res.jsendSuccess(feed, httpStatus.OK); // HTTP 200 OK
                           });
      };

   this.getTile = function(res, feed, channelName, level, offset) {
      datastore.getTile(feed.userId,
                        feed.datastoreId,
                        channelName,
                        level,
                        offset,
                        function(err, tile) {

                           if (err) {
                              log.error(JSON.stringify(err, null, 3));
                              if (err.data && err.data.code == httpStatus.UNPROCESSABLE_ENTITY) {
                                 return res.jsendPassThrough(err.data);
                              }

                              return res.jsendServerError("Failed to fetch tile: " + err.message, null);
                           }

                           // no error, so check whether there was actually any data returned at all
                           if (typeof tile['data'] === 'undefined') {
                              tile = createEmptyTile(level, offset);
                           }

                           // Must set the type since the grapher won't render anything if the type is not set
                           // (TODO: get this from the feed's channel specs, and default to value if undefined)
                           tile['type'] = "value";

                           res.jsendSuccess(tile);
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
};