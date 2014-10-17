var express = require('express');
var router = express.Router();
var passport = require('passport');
var httpStatus = require('http-status');
var log = require('log4js').getLogger();

module.exports = function(FeedModel, feedRouteHelper) {

   // for searching for feeds, optionally matching specified criteria and sort order
   router.get('/',
              function(req, res, next) {
                 passport.authenticate('bearer', function(err, user, info) {
                    if (err) {
                       var message = "Error while authenticating to get feed list";
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
                       return feedRouteHelper.importData(res, feed, req.body);
                    }
                    else {
                       return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 Forbidden
                    }
                 });
              });

   // For getting info about a feed, authenticated using the user's OAuth2 access token in the request header (but only if the feed is private)
   //
   // NOT: for private feeds, this will be slower than authenticating with the feed's apiKey or apiKeyReadOnly because
   // we have to make an extra call to the database to authenticate the user so we can determine whether she has access
   // to the private feed.
   router.get('/:feedId',
              function(req, res, next) {
                 var feedId = req.params.feedId;

                 log.debug("Received GET to get info for feed [" + feedId + "]");

                 // find the feed
                 findFeedById(res, feedId, function(feed) {
                    // Allow access to the tile if the feed is public
                    if (feed.isPublic) {
                       return feedRouteHelper.getInfo(res, feed);
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
                                return feedRouteHelper.getInfo(res, feed);
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
                       return feedRouteHelper.getTile(res, feed, channelName, level, offset);
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
                                return feedRouteHelper.getTile(res, feed, channelName, level, offset);
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
