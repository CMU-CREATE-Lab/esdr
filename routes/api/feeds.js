var express = require('express');
var router = express.Router();
var passport = require('passport');
var ValidationError = require('../../lib/errors').ValidationError;
var httpStatus = require('http-status');
var log = require('log4js').getLogger();

module.exports = function(FeedModel, datastore) {

   var handleUpload = function(res, feed, data) {

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

   // for uploads authenticated using the feed's API Key in the header
   router.put('/',
              passport.authenticate('localapikey', { session : false }),
              function(req, res, next) {
                 var feed = req.authInfo.feed;
                 var isReadOnly = req.authInfo.isReadOnly;

                 // Deny access if user authenticated with the read-only API key
                 if (isReadOnly) {
                    return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 Forbidden
                 }

                 log.debug("Received PUT to upload data for feed ID [" + feed.id + "] (feed API Key authentication)");
                 return handleUpload(res, feed, req.body);
              });

   // for uploads authenticated using the user's OAuth2 access token in the header
   router.put('/:feedId',
              passport.authenticate('bearer', { session : false }),
              function(req, res, next) {
                 var feedId = req.params.feedId;
                 log.debug("Received PUT to upload data for feed ID [" + feedId + "] (OAuth2 access token authentication)");

                 // find the feed
                 findFeedById(res, feedId, function(feed) {
                    // Now make sure this user has access to upload to this feed and, if so, continue with the upload
                    if (req.user.id == feed.userId) {
                       return handleUpload(res, feed, req.body);
                    }
                    else {
                       return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 Forbidden
                    }
                 });
              });

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

   var getTile = function(res, feed, channelName, level, offset) {
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

   var getFeedInfo = function(res, feed, channelName) {
      var infoFilter = {
         userId : feed.userId,
         deviceName : feed.datastoreId
      };
      if (typeof channelName !== 'undefined' && channelName != null) {
         infoFilter.channelName = channelName;
      }

      datastore.getInfo(infoFilter,
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

                           return res.jsendSuccess(info, httpStatus.OK); // HTTP 200 OK

                        });
   };

   // for getting info about a feed, authenticated using the feed's API Key in the header
   // TODO: allow filtering by min/max time
   router.get('/info',
              passport.authenticate('localapikey', { session : false }),
              function(req, res, next) {
                 var feed = req.authInfo.feed;

                 log.debug("Received GET to get info for in feed [" + feed.id + "] (feed API Key authentication)");
                 return getFeedInfo(res, feed);
              });

   // For getting info about a feed, authenticated using the user's OAuth2 access token in the header
   //
   // NOT: for private feeds, this will be slower than authenticating with the feed's apiKey or apiKeyReadOnly because
   // we have to make an extra call to the database to authenticate the user so we can determine whether she has access
   // to the private feed.
   // TODO: allow filtering by min/max time
   router.get('/:feedId/info',
              function(req, res, next) {
                 var feedId = req.params.feedId;

                 log.debug("Received GET to get info for feed [" + feedId + "]");

                 // find the feed
                 findFeedById(res, feedId, function(feed) {
                    // Allow access to the tile if the feed is public
                    if (feed.isPublic) {
                       return getFeedInfo(res, feed);
                    }
                    else {
                       // if the feed is private, then authenticate and check for authorization
                       passport.authenticate('bearer', function(err, user, info) {
                          if (err) {
                             var message = "Error while authenticating to get info for feed [" + feedId + "]";
                             log.error(message + ": " + err);
                             return res.jsendServerError(message);
                          }

                          if (user) {
                             if (user.id == feed.userId) {
                                return getFeedInfo(res, feed);
                             }

                             return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 Forbidden
                          }
                          else {
                             return res.jsendClientError("Authentication required.", null, httpStatus.UNAUTHORIZED);  // HTTP 401 Unauthorized
                          }

                       })(req, res, next);
                    }
                 });
              });

   // for getting info about a feed's channel, authenticated using the feed's API Key in the header
   // TODO: allow filtering by min/max time
   router.get('/channels/:channelName/info',
              passport.authenticate('localapikey', { session : false }),
              function(req, res, next) {
                 var feed = req.authInfo.feed;
                 var channelName = req.params.channelName;

                 log.debug("Received GET to get info for in channel [" + channelName + "] in feed [" + feed.id + "] (feed API Key authentication)");
                 return getFeedInfo(res, feed, channelName);
              });

   // For getting info about a feed's channel, authenticated using the user's OAuth2 access token in the header
   //
   // NOT: for private feeds, this will be slower than authenticating with the feed's apiKey or apiKeyReadOnly because
   // we have to make an extra call to the database to authenticate the user so we can determine whether she has access
   // to the private feed.
   // TODO: allow filtering by min/max time
   router.get('/:feedId/channels/:channelName/info',
              function(req, res, next) {
                 var feedId = req.params.feedId;
                 var channelName = req.params.channelName;

                 log.debug("Received GET to get info for channel [" + channelName + "] in feed [" + feedId + "]");

                 // find the feed
                 findFeedById(res, feedId, function(feed) {
                    // Allow access to the tile if the feed is public
                    if (feed.isPublic) {
                       return getFeedInfo(res, feed, channelName);
                    }
                    else {
                       // if the feed is private, then authenticate and check for authorization
                       passport.authenticate('bearer', function(err, user, info) {
                          if (err) {
                             var message = "Error while authenticating to get info for channel [" + channelName + "] in feed [" + feedId + "]";
                             log.error(message + ": " + err);
                             return res.jsendServerError(message);
                          }

                          if (user) {
                             if (user.id == feed.userId) {
                                return getFeedInfo(res, feed, channelName);
                             }

                             return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 Forbidden
                          }
                          else {
                             return res.jsendClientError("Authentication required.", null, httpStatus.UNAUTHORIZED);  // HTTP 401 Unauthorized
                          }

                       })(req, res, next);
                    }
                 });
              });

   // for tile requests authenticated using the feed's API Key in the header
   router.get('/channels/:channelName/tiles/:level.:offset',
              passport.authenticate('localapikey', { session : false }),
              function(req, res, next) {
                 var feed = req.authInfo.feed;
                 var channelName = req.params.channelName;
                 var level = req.params.level;
                 var offset = req.params.offset;

                 log.debug("Received GET to get tile for channel [" + channelName + "] in feed [" + feed.id + "] with level.offset [" + level + "." + offset + "](feed API Key authentication)");
                 return getTile(res, feed, channelName, level, offset);
              });

   // For tile requests optionally authenticated using the user's OAuth2 access token in the header
   //
   // NOT: for private feeds, this will be slower than authenticating with the feed's apiKey or apiKeyReadOnly because
   // we have to make an extra call to the database to authenticate the user so we can determine whether she has access
   // to the private feed.
   router.get('/:feedId/channels/:channelName/tiles/:level.:offset',
              function(req, res, next) {
                 var feedId = req.params.feedId;
                 var channelName = req.params.channelName;
                 var level = req.params.level;
                 var offset = req.params.offset;

                 log.debug("Received GET to get tile for channel [" + channelName + "] in feed [" + feedId + "] with level.offset [" + level + "." + offset + "]");

                 // find the feed
                 findFeedById(res, feedId, function(feed) {
                    // Allow access to the tile if the feed is public
                    if (feed.isPublic) {
                       return getTile(res, feed, channelName, level, offset);
                    }
                    else {
                       // if the feed is private, then authenticate and check for authorization
                       passport.authenticate('bearer', function(err, user, info) {
                          if (err) {
                             var message = "Error while authenticating to get tile for channel [" + channelName + "] in feed [" + feedId + "] with level.offset [" + level + "." + offset + "]";
                             log.error(message + ": " + err);
                             return res.jsendServerError(message);
                          }

                          if (user) {
                             if (user.id == feed.userId) {
                                return getTile(res, feed, channelName, level, offset);
                             }

                             return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 Forbidden
                          }
                          else {
                             return res.jsendClientError("Authentication required.", null, httpStatus.UNAUTHORIZED);  // HTTP 401 Unauthorized
                          }

                       })(req, res, next);
                    }
                 });
              });

   var findFeedById = function(res, feedId, successCallback) {
      FeedModel.findById(feedId, function(err, feed) {
         if (err) {
            var message = "Error while trying to find feed with ID [" + feedId + "]";
            log.error(message + ": " + err);
            return res.jsendServerError(message);
         }

         if (feed) {
            return successCallback(feed);
         }
         else {
            return res.jsendClientError("Unknown or invalid feed ID", null, httpStatus.NOT_FOUND); // HTTP 404 Not Found
         }
      });
   };

   return router;
};
