var express = require('express');
var router = express.Router();
var passport = require('passport');
var httpStatus = require('http-status');
var S = require('string');
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

   // For uploads authenticated using the user's OAuth2 access token or the feed's read-write API key in the URL or request header
   //
   // NOTE: authenticating with the OAuth2 access token will be slower than authenticating with the feed's apiKey
   // because we have to make an extra call to the database to authenticate the user so we can determine whether she has
   // access.
   router.put('/:feedIdOrApiKey',
              function(req, res, next) {
                 getFeedForWritingByIdOrApiKey(req.params.feedIdOrApiKey,
                                               'id,userId,apiKey',
                                               function(feed) {
                                                  return feedRouteHelper.importData(res, feed, req.body);
                                               },
                                               req, res, next);
              });

   // For getting info about a feed, optionally authenticated using the user's OAuth2 access token or the feed's
   // read-write or read-only API key in the URL or request header.
   //
   // NOTE: for a private feed or when requesting the API Key from a public feed, authenticating with the OAuth2 access
   // token will be slower than authenticating with the feed's apiKey because we have to make an extra call to the
   // database to authenticate the user so we can determine whether she has access.
   router.get('/:feedIdOrApiKey',
              function(req, res, next) {
                 var feedIdOrApiKey = req.params.feedIdOrApiKey;

                 log.debug("Received GET to get info for feed [" + feedIdOrApiKey + "]");
                 getFeedForReadingByIdOrApiKey(feedIdOrApiKey,
                                               null,  // passing null will cause it to select all fields--we'll filter them below
                                               function(feed, authInfo) {
                                                  // we found the feed, so now filter the fields to return based on fields
                                                  // specified in the query string (if any)
                                                  FeedModel.filterFields(feed, req.query.fields, function(err, filteredFeed) {
                                                     if (err) {
                                                        return res.jsendServerError("Failed to get feed: " + err.message, null);
                                                     }

                                                     var getInfo = function(isAllowedToSelectReadWriteFeedApiKey) {
                                                        // inflate the JSON fields into objects
                                                        if ("channelSpecs" in filteredFeed) {
                                                           filteredFeed.channelSpecs = JSON.parse(filteredFeed.channelSpecs);
                                                        }

                                                        if ("channelBounds" in filteredFeed) {
                                                           filteredFeed.channelBounds = JSON.parse(filteredFeed.channelBounds);
                                                        }

                                                        // delete the read-write feed API key if not allowed to see it
                                                        if (!isAllowedToSelectReadWriteFeedApiKey) {
                                                           delete filteredFeed.apiKey;
                                                        }

                                                        return res.jsendSuccess(filteredFeed, httpStatus.OK); // HTTP 200 OK
                                                     };

                                                     // The only way authInfo won't be defined is if the feed is public, and is
                                                     // being accessed by feedId in the URL.
                                                     if (authInfo) {
                                                        return getInfo(authInfo.hasAccessToReadWriteFeedApiKey);
                                                     }
                                                     else {
                                                        // See whether they're even trying to ask for the read-write feed API
                                                        // key.  If so, then we need to auth the user either by feed API key in
                                                        // the request header or OAuth access token in the request header.
                                                        if ("apiKey" in filteredFeed) {
                                                           if ("feedapikey" in req.headers) {
                                                              // If the given feed API key matches the feed's read-write key,
                                                              // then they obviously should be allowed to see it because they
                                                              // already know it!
                                                              var wasGivenReadWriteApiKey = req.headers['feedapikey'] == feed.apiKey;
                                                              return getInfo(wasGivenReadWriteApiKey);
                                                           }
                                                           else {
                                                              // If they sent an OAuth2 Authorization header, then authenticate
                                                              // the user to see whether she owns the feed.  If so, then she
                                                              // should be granted access to see the read-write API key.
                                                              passport.authenticate('bearer', function(err, user) {
                                                                 if (err) {
                                                                    log.error(message + ": " + err);
                                                                    return res.jsendServerError(message);
                                                                 }

                                                                 // prevent selection of the read-write API key unless the user
                                                                 // was authenticated successfully, and she owns the feed
                                                                 return getInfo(user && user.id == feed.userId);
                                                              })(req, res, next);
                                                           }
                                                        }
                                                        else {
                                                           // they're not requesting the API key, so just return the filtered feed
                                                           return getInfo(false);
                                                        }
                                                     }
                                                  });
                                               },
                                               req, res, next);
              });

   // For tile requests, optionally authenticated using the user's OAuth2 access token or the feed's read-write or
   // read-only API key in the URL or request header.
   //
   // NOTE: for a private feed, authenticating with the OAuth2 access token will be slower than authenticating with
   // either of the feed's API keys because we have to make an extra call to the database to authenticate the user so we
   // can determine whether she has access.
   router.get('/:feedIdOrApiKey/channels/:channelName/tiles/:level.:offset',
              function(req, res, next) {
                 var feedIdOrApiKey = req.params.feedIdOrApiKey;
                 var channelName = req.params.channelName;
                 var level = req.params.level;
                 var offset = req.params.offset;

                 getFeedForReadingByIdOrApiKey(feedIdOrApiKey,
                                               'id,userId,isPublic,apiKey,apiKeyReadOnly',
                                               function(feed) {
                                                  FeedModel.getTile(feed, channelName, level, offset, function(err, tile) {
                                                     if (err) {
                                                        if (err.data && err.data.code == httpStatus.UNPROCESSABLE_ENTITY) {
                                                           return res.jsendPassThrough(err.data);
                                                        }
                                                        return res.jsendServerError(err.message, null);
                                                     }

                                                     res.jsendSuccess(tile);
                                                  });
                                               }, req, res, next);
              });

   // For exporting one or more channels from a feed
   // /api/v1/feeds/{feedIdOrApiKey}/channels/{channels}/export?from={from}&to={to}
   router.get('/:feedIdOrApiKey/channels/:channels/export',
              function(req, res, next) {
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

                 getFeedForReadingByIdOrApiKey(req.params['feedIdOrApiKey'],
                                               'id,userId,isPublic,apiKey,apiKeyReadOnly',
                                               function(feed) {
                                                  // build the filename for the Content-disposition header
                                                  var filename = "export_of_feed_" + feed.id;
                                                  if (minTime != null) {
                                                     filename += "_from_time_" + minTime;
                                                  }
                                                  if (maxTime != null) {
                                                     filename += "_to_" + (minTime == null ? "time_" : "") + maxTime;
                                                  }
                                                  filename += "." + format;

                                                  // export the data
                                                  FeedModel.exportData([{
                                                           feed : feed,
                                                           channels : channels
                                                        }],
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

                                                           // I don't really understand why, but we must have a
                                                           // function (even an empty one!) listening on stderr,
                                                           // or else sometimes I get no data on stdout.  As of
                                                           // 2015-01-13, I've only seen this on multifeed
                                                           // getTiles and not with export, but I guess it can't
                                                           // hurt here.
                                                           eventEmitter.stderr.on('data', function(data) {
                                                              // log.error(data);
                                                           });

                                                           eventEmitter.on('error', function(e) {
                                                              log.error("Error event from EventEmitter while exporting: " + JSON.stringify(e, null, 3));
                                                           });

                                                           // pipe the eventEmitter to the response
                                                           return eventEmitter.stdout.pipe(res);
                                                        });
                                               },
                                               req, res, next)
              });

   // Finds a feed for writing by ID or API Key
   var getFeedForWritingByIdOrApiKey = function(feedIdOrApiKey, fieldsToSelect, successCallback, req, res, next) {
      if (isFeedApiKey(feedIdOrApiKey)) {
         var feedApiKey = feedIdOrApiKey;
         FeedModel.findByApiKey(feedApiKey, fieldsToSelect, function(err, feed) {
            if (err) {
               var message = "Error while trying to find feed with API key [" + feedApiKey + "]";
               log.error(message + ": " + err);
               return res.jsendServerError(message);
            }

            if (feed) {
               // make sure user is using the read-write API key
               if (feed.apiKey == feedApiKey) {
                  return successCallback(feed);
               }
               else {
                  return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 Forbidden
               }
            }
            else {
               return res.jsendClientError("Unknown or invalid feed", null, httpStatus.NOT_FOUND); // HTTP 404 Not Found
            }
         });
      }
      else {
         var feedId = feedIdOrApiKey;
         // Not a Feed API key, but now make sure the ID is completely numeric (e.g. reject things like '4240abc')
         if (S(feedId).isNumeric()) {
            FeedModel.findById(feedId, fieldsToSelect, function(err, feed) {
               if (err) {
                  var message = "Error while trying to find feed with ID [" + feedId + "]";
                  log.error(message + ": " + err);
                  return res.jsendServerError(message);
               }

               if (feed) {
                  // verify acces, either by the read-write API key in the header, or the OAuth2 authorization
                  if ("feedapikey" in req.headers) {
                     if ((req.headers['feedapikey'] == feed.apiKey)) {
                        return successCallback(feed);
                     }
                     return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 Forbidden
                  }
                  else if ("authorization" in req.headers) {
                     // If they sent an OAuth2 Authorization header, then authenticate the user to see whether she
                     // owns the feed.  If so, then she should be granted access to see a tile.
                     passport.authenticate('bearer', function(err, user) {
                        if (err) {
                           var message = "Error while authenticating with OAuth2 access token for feed [" + feed.id + "]";
                           log.error(message + ": " + err);
                           return res.jsendServerError(message);
                        }

                        if (user) {
                           // make sure the user owns the feed
                           if (user.id == feed.userId) {
                              return successCallback(feed);
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
               else {
                  return res.jsendClientError("Unknown or invalid feed", null, httpStatus.NOT_FOUND); // HTTP 404 Not Found
               }
            });
         }
         else {
            return res.jsendClientError("Unknown or invalid feed", null, httpStatus.NOT_FOUND); // HTTP 404 Not Found
         }
      }
   };

   // Finds a feed for reading by ID or API Key
   var getFeedForReadingByIdOrApiKey = function(feedIdOrApiKey, fieldsToSelect, successCallback, req, res, next) {
      if (isFeedApiKey(feedIdOrApiKey)) {
         var feedApiKey = feedIdOrApiKey;
         FeedModel.findByApiKey(feedApiKey, fieldsToSelect, function(err, feed) {
            if (err) {
               var message = "Error while trying to find feed with API key [" + feedApiKey + "]";
               log.error(message + ": " + err);
               return res.jsendServerError(message);
            }

            if (feed) {
               return successCallback(feed, { hasAccessToReadWriteFeedApiKey : feed.apiKey == feedApiKey });
            }
            else {
               return res.jsendClientError("Unknown or invalid feed", null, httpStatus.NOT_FOUND); // HTTP 404 Not Found
            }
         });
      }
      else {
         var feedId = feedIdOrApiKey;
         // Not a Feed API key, but now make sure the ID is completely numeric (e.g. reject things like '4240abc')
         if (S(feedId).isNumeric()) {
            FeedModel.findById(feedId, fieldsToSelect, function(err, feed) {
               if (err) {
                  var message = "Error while trying to find feed with ID [" + feedId + "]";
                  log.error(message + ": " + err);
                  return res.jsendServerError(message);
               }

               if (feed) {
                  // Allow access if the feed is public
                  if (feed.isPublic) {
                     return successCallback(feed);
                  }
                  else {
                     // if the feed is private, then check for authorization
                     if ("feedapikey" in req.headers) {
                        var isReadWriteKey = (req.headers['feedapikey'] == feed.apiKey);
                        var isReadOnlyKey = (req.headers['feedapikey'] == feed.apiKeyReadOnly);

                        if (isReadWriteKey || isReadOnlyKey) {
                           return successCallback(feed, { hasAccessToReadWriteFeedApiKey : isReadWriteKey });
                        }
                        return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 Forbidden
                     }
                     else if ("authorization" in req.headers) {
                        // If they sent an OAuth2 Authorization header, then authenticate the user to see whether she
                        // owns the feed.  If so, then she should be granted access to see a tile.
                        passport.authenticate('bearer', function(err, user) {
                           if (err) {
                              var message = "Error while authenticating with OAuth2 access token for feed [" + feed.id + "]";
                              log.error(message + ": " + err);
                              return res.jsendServerError(message);
                           }

                           if (user) {
                              // make sure the user owns the feed
                              if (user.id == feed.userId) {
                                 return successCallback(feed, { hasAccessToReadWriteFeedApiKey : true });
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
               }
               else {
                  return res.jsendClientError("Unknown or invalid feed", null, httpStatus.NOT_FOUND); // HTTP 404 Not Found
               }
            });
         }
         else {
            return res.jsendClientError("Unknown or invalid feed", null, httpStatus.NOT_FOUND); // HTTP 404 Not Found
         }
      }
   };

   var FEED_API_KEY_REGEX = /^[a-f0-9]{64}$/i;
   // If the given value is a string and matches the FEED_API_KEY_REGEX regex, then consider it a Feed API Key
   var isFeedApiKey = function(str) {
      return (isString(str) && FEED_API_KEY_REGEX.test(str));
   };

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

   return router;
};
