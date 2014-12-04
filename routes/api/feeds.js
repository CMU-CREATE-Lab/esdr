var express = require('express');
var router = express.Router();
var passport = require('passport');
var httpStatus = require('http-status');
var log = require('log4js').getLogger('esdr:routes:api:feeds');

module.exports = function(FeedModel, feedRouteHelper) {

   // for searching for feeds, optionally matching specified criteria and sort order
   router.get('/',
              function(req, res, next) {
                 passport.authenticate('bearer', function(err, user, info) {
                    if (err) {
                       var message = "Error while authenticating to find feeds";
                       log.error(message + ": " + err);
                       return res.jsendServerError(message);
                    }

                    FeedModel.find(user ? user.id : null,
                                   req.query,
                                   function(err, result, selectedFields) {
                                      if (err) {
                                         log.error(JSON.stringify(err, null, 3));
                                         // See if the error contains a JSend data object.  If so, pass it on through.
                                         if (typeof err.data !== 'undefined' &&
                                             typeof err.data.code !== 'undefined' &&
                                             typeof err.data.status !== 'undefined') {
                                            return res.jsendPassThrough(err.data);
                                         }
                                         return res.jsendServerError("Failed to get feeds", null);
                                      }

                                      var willInflateChannelSpecs = (selectedFields.indexOf('channelSpecs') >= 0);
                                      var willInflateChannelBounds = (selectedFields.indexOf('channelBounds') >= 0);

                                      if (willInflateChannelSpecs || willInflateChannelBounds) {
                                         result.rows.forEach(function(feed) {
                                            if (willInflateChannelSpecs) {
                                               feed.channelSpecs = JSON.parse(feed.channelSpecs);
                                            }
                                            if (willInflateChannelBounds) {
                                               feed.channelBounds = JSON.parse(feed.channelBounds);
                                            }
                                         });
                                      }

                                      return res.jsendSuccess(result);
                                   });
                 })(req, res, next);
              });

   // For uploads authenticated using the user's OAuth2 access token or the feed's read-write API key in the request header
   //
   // NOTE: authenticating with the OAuth2 access token will be slower than authenticating with the feed's apiKey
   // because we have to make an extra call to the database to authenticate the user so we can determine whether she has
   // access.
   router.put('/:feedId',
              function(req, res, next) {
                 var feedId = req.params.feedId;
                 log.debug("Received PUT to upload data for feed ID [" + feedId + "] (OAuth2 access token authentication)");

                 // find the feed
                 findFeedById(res, feedId, 'id,userId,apiKey', function(feed) {
                    // Now make sure this user has access to upload to this feed and, if so, continue with the upload
                    if ("feedapikey" in req.headers) {
                       // Make sure the given feed API key matches the feed's read-write key. If not, forbid upload.
                       if (feed.apiKey == req.headers['feedapikey']) {
                          return feedRouteHelper.importData(res, feed, req.body);
                       }
                       else {
                          return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 Forbidden
                       }
                    }
                    else if ("authorization" in req.headers) {
                       // Authenticate the user to see whether she owns the feed.  If so, then she should be
                       // granted access to upload to the feed.
                       passport.authenticate('bearer', function(err, user) {
                          if (err) {
                             var message = "Error while authenticating with OAuth2 access token to upload to feed [" + feedId + "]";
                             log.error(message + ": " + err);
                             return res.jsendServerError(message);
                          }

                          // determine access simply by checking ownership
                          if (feed.userId == user.id) {
                             return feedRouteHelper.importData(res, feed, req.body);
                          }
                          else {
                             return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 Forbidden
                          }
                       })(req, res, next);
                    }
                    else {
                       return res.jsendClientError("Authentication required.", null, httpStatus.UNAUTHORIZED);  // HTTP 401 Unauthorized
                    }
                 });
              });

   // For getting info about a feed, optionally authenticated using the user's OAuth2 access token or the feed's
   // read-write or read-only API key in the request header.
   //
   // NOTE: for a private feed or when requesting the API Key from a public feed, authenticating with the OAuth2 access
   // token will be slower than authenticating with the feed's apiKey because we have to make an extra call to the
   // database to authenticate the user so we can determine whether she has access.
   router.get('/:feedId',
              function(req, res, next) {
                 var feedId = req.params.feedId;

                 log.debug("Received GET to get info for feed [" + feedId + "]");

                 // find the feed (pass null for the fieldsToSelect so we get ALL fields--we'll filter them down later)
                 findFeedById(res, feedId, null, function(feed) {
                    // Now filter the feed based on fields specified in the query string (if any)
                    FeedModel.filterFields(feed, req.query.fields, function(err, filteredFeed) {
                       if (err) {
                          return res.jsendServerError("Failed to get feed: " + err.message, null);
                       }

                       var hasAccessToApiKey = function(callback) {
                          // Determine whether the calling user is allowed to see the feed's API Key.
                          if ("feedapikey" in req.headers) {
                             // If they sent the API Key in the header (and it matches the one in the found feed), then
                             // they should obviously be allowed to see it.  However, if they sent the read-only API
                             // key in the header, they shouldn't be allowed to see the read-write key.
                             var willGrantAccessToApiKey = req.headers['feedapikey'] == feed.apiKey;
                             process.nextTick(function() {
                                callback(willGrantAccessToApiKey);
                             });
                          }
                          else if ("authorization" in req.headers) {
                             // However, if they sent an OAuth2 Authorization header, then authenticate the user to see
                             // whether she owns the feed.  If so, then she should be granted access to see the feed's
                             // API Key.
                             passport.authenticate('bearer', function(err, user) {
                                if (err) {
                                   var message = "Error while authenticating with OAuth2 access token to get info for feed [" + feedId + "]";
                                   log.error(message + ": " + err);
                                   return res.jsendServerError(message);
                                }

                                callback(user && (user.id == feed.userId));
                             })(req, res, next);
                          }
                          else {
                             // Otherwise, deny access.
                             process.nextTick(function() {
                                callback(false);
                             });
                          }
                       };

                       // Check whether the feed is public
                       if (feed.isPublic) {
                          // see whether they're requesting the read-write API Key
                          if ("apiKey" in filteredFeed) {
                             // they're requesting the API key, so we need to authenticate to make sure they're allowed
                             // to see it
                             hasAccessToApiKey(function(hasAccess) {
                                return feedRouteHelper.getInfo(res, filteredFeed, !hasAccess);
                             });
                          }
                          else {
                             // feed is public and they're not requesting the API key, so just return the filtered feed
                             return feedRouteHelper.getInfo(res, filteredFeed, true);
                          }
                       }
                       else {
                          // Determine whether the calling user is allowed to see this private feed
                          if ("feedapikey" in req.headers) {
                             // If the given feed API key matches the feed's read-write or read-only key, then grant
                             // access to see the feed.  Only grant access to see the read-write API Key if they
                             // supplied it in the header.
                             var wasGivenReadWriteApiKey = req.headers['feedapikey'] == feed.apiKey;
                             var canSeeFeed = wasGivenReadWriteApiKey ||
                                              req.headers['feedapikey'] == feed.apiKeyReadOnly;

                             if (canSeeFeed) {
                                return feedRouteHelper.getInfo(res, filteredFeed, !wasGivenReadWriteApiKey);
                             }
                             return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 Forbidden
                          }
                          else if ("authorization" in req.headers) {
                             // If they sent an OAuth2 Authorization header, then authenticate the user to see whether
                             // she owns the feed.  If so, then she should be granted access to see the feed.
                             passport.authenticate('bearer', function(err, user) {
                                if (err) {
                                   var message = "Error while authenticating with OAuth2 access token to get info for feed [" + feedId + "]";
                                   log.error(message + ": " + err);
                                   return res.jsendServerError(message);
                                }

                                if (user) {
                                   if (user.id == feed.userId) {
                                      // auth was successful, and the user is the owner, so let them have it
                                      return feedRouteHelper.getInfo(res, filteredFeed, false);
                                   }
                                }
                                return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 Forbidden
                             })(req, res, next);
                          }
                          else {
                             // Otherwise, deny access.
                             process.nextTick(function() {
                                return res.jsendClientError("Authentication required.", null, httpStatus.UNAUTHORIZED);  // HTTP 401 Unauthorized
                             });
                          }
                       }
                    });
                 });
              });

   // For tile requests, optionally authenticated using the user's OAuth2 access token or the feed's read-write or
   // read-only API key in the request header.
   //
   // NOTE: for a private feed, authenticating with the OAuth2 access token will be slower than authenticating with
   // either of the feed's API keys because we have to make an extra call to the database to authenticate the user so we
   // can determine whether she has access.
   router.get('/:feedId/channels/:channelName/tiles/:level.:offset',
              function(req, res, next) {
                 var feedId = req.params.feedId;
                 var channelName = req.params.channelName;
                 var level = req.params.level;
                 var offset = req.params.offset;

                 // find the feed
                 findFeedById(res, feedId, 'id,userId,isPublic,apiKey,apiKeyReadOnly', function(feed) {

                    var getTile = function() {
                       FeedModel.getTile(feed, channelName, level, offset, function(err, tile) {
                          if (err) {
                             if (err.data && err.data.code == httpStatus.UNPROCESSABLE_ENTITY) {
                                return res.jsendPassThrough(err.data);
                             }
                             return res.jsendServerError(err.message, null);
                          }

                          res.jsendSuccess(tile);
                       });
                    };

                    // Allow access to the tile if the feed is public
                    if (feed.isPublic) {
                       return getTile(res, feed, channelName, level, offset);
                    }
                    else {
                       // if the feed is private, then check for authorization
                       if ("feedapikey" in req.headers) {
                          var canSeeFeed = req.headers['feedapikey'] == feed.apiKey ||
                                           req.headers['feedapikey'] == feed.apiKeyReadOnly;

                          if (canSeeFeed) {
                             return getTile(res, feed, channelName, level, offset);
                          }
                          return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 Forbidden
                       }
                       else if ("authorization" in req.headers) {
                          // If they sent an OAuth2 Authorization header, then authenticate the user to see whether she
                          // owns the feed.  If so, then she should be granted access to see a tile.
                          passport.authenticate('bearer', function(err, user) {
                             if (err) {
                                var message = "Error while authenticating with OAuth2 access token to get tile for channel [" + channelName + "] in feed [" + feedId + "] with level.offset [" + level + "." + offset + "]";
                                log.error(message + ": " + err);
                                return res.jsendServerError(message);
                             }

                             if (user) {
                                if (user.id == feed.userId) {
                                   return getTile(res, feed, channelName, level, offset);
                                }
                             }
                             return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 Forbidden
                          })(req, res, next);
                       }
                       else {
                          // Otherwise, deny access.
                          process.nextTick(function() {
                             return res.jsendClientError("Authentication required.", null, httpStatus.UNAUTHORIZED);  // HTTP 401 Unauthorized
                          });
                       }
                    }
                 });
              });

   /**
    * Returns <code>true</code> if the given value is a string; returns <code>false</code> otherwise.
    *
    * Got this from http://stackoverflow.com/a/9436948/703200
    */
   var isString = function(o) {
      return (typeof o == 'string' || o instanceof String)
   };

   /**
    * Trims the given string.  If not a string, returns an empty string.
    *
    * @param {string} str the string to be trimmed
    */
   var trim = function(str) {
      if (isString(str)) {
         return str.trim();
      }
      return '';
   };

   // For exporting one or more channels from a feed
   // /api/v1/feeds/{feedId}/channels/{channels}/export?from={from}&to={to}
   router.get('/:feedId/channels/:channels/export',
              function(req, res, next) {
                 var feedId = req.params['feedId'];

                 // scrub the channels, removing dupes, but preserving the requested order of the unique ones
                 var requestedChannels = (req.params.channels || '').split(',').map(trim);
                 var alreadyIncludedChannels = {};
                 var channels = requestedChannels.filter(function(channel) {
                    var isNew = !(channel in alreadyIncludedChannels);
                    if (isNew) {
                       alreadyIncludedChannels[channel] = true;
                    }
                    return isNew;
                 });

                 // parse the min and max times
                 var parseTimeString = function(str) {
                    if (isString(str)) {
                       var val = parseFloat(str);
                       if (isFinite(val)) {
                          return val;
                       }
                    }
                    return null;
                 };
                 var minTime = parseTimeString(req.query.from);
                 var maxTime = parseTimeString(req.query.to);

                 // swap the times if minTime is greater than maxTime
                 if (minTime != null && maxTime != null && minTime > maxTime) {
                    var temp = minTime;
                    minTime = maxTime;
                    maxTime = temp;
                 }

                 // make sure the format is valid (TODO: uncomment and fix this up once the datastore can export JSON)
                 //var format = (req.query.format || 'csv');
                 //var contentType;
                 //if (isString(format)) {
                 //   format = format.toLowerCase().trim();
                 //   if (format == 'json') {
                 //      contentType = 'application/json';
                 //   }
                 //   else if (format == 'csv') {
                 //      contentType = 'text/plain';
                 //   }
                 //   else {
                 //      // TODO: throw error instead
                 //      contentType = 'text/plain';
                 //      format = 'csv';
                 //   }
                 //}
                 //else {
                 //   // TODO: throw error instead
                 //   contentType = 'text/plain';
                 //   format = 'csv';
                 //}
                 var format = 'csv';

                 // build the filename for the Content-disposition header
                 var filename = "export_of_feed_" + feedId;
                 if (minTime != null) {
                    filename += "_from_time_" + minTime;
                 }
                 if (maxTime != null) {
                    filename += "_to_" + (minTime == null ? "time_" : "") + maxTime;
                 }
                 filename += "." + format;

                 // find the feed
                 findFeedById(res, feedId, 'id,userId,isPublic,apiKey,apiKeyReadOnly', function(feed) {

                    var doExport = function() {
                       FeedModel.exportData(feed,
                                            channels,
                                            {
                                               minTime : minTime,
                                               maxTime : maxTime
                                            },
                                            function(err, eventEmitter) {
                                               if (err) {
                                                  if (err.data && err.data.code == httpStatus.UNPROCESSABLE_ENTITY) {
                                                     return res.jsendPassThrough(err.data)
                                                  }

                                                  log.error("Failed to export feed: " + JSON.stringify(err, null, 3));
                                                  return res.jsendServerError("Failed to export feed", null);
                                               }

                                               // set the status code, the connection to close, and specify the Content-disposition filename
                                               res
                                                     .status(httpStatus.OK)
                                                     .set("Connection", "close")
                                                     .attachment(filename);

                                               // pipe the eventEmitter to the response
                                               return eventEmitter.stdout.pipe(res);
                                            });
                    };

                    // Allow access to the tile if the feed is public
                    if (feed.isPublic) {
                       return doExport();
                    }
                    else {
                       // if the feed is private, then check for authorization
                       if ("feedapikey" in req.headers) {
                          var canSeeFeed = req.headers['feedapikey'] == feed.apiKey ||
                                           req.headers['feedapikey'] == feed.apiKeyReadOnly;

                          if (canSeeFeed) {
                             return doExport();
                          }
                          return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 Forbidden
                       }
                       else if ("authorization" in req.headers) {
                          // If they sent an OAuth2 Authorization header, then authenticate the user to see whether she
                          // owns the feed.  If so, then she should be granted access to see a tile.
                          passport.authenticate('bearer', function(err, user) {
                             if (err) {
                                var message = "Error while authenticating with OAuth2 access token to do export for channels [" + channels + "] from feed [" + feedId + "]";
                                log.error(message + ": " + err);
                                return res.jsendServerError(message);
                             }

                             if (user) {
                                if (user.id == feed.userId) {
                                   return doExport();
                                }
                             }
                             return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 Forbidden
                          })(req, res, next);
                       }
                       else {
                          // Otherwise, deny access.
                          process.nextTick(function() {
                             return res.jsendClientError("Authentication required.", null, httpStatus.UNAUTHORIZED);  // HTTP 401 Unauthorized
                          });
                       }
                    }
                 });
              });

   var findFeedById = function(res, feedId, fieldsToSelect, successCallback) {
      FeedModel.findById(feedId, fieldsToSelect, function(err, feed) {
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
}
;
