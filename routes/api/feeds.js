var express = require('express');
var router = express.Router();
var passport = require('passport');
var ValidationError = require('../../lib/errors').ValidationError;
var httpStatus = require('http-status');
var log = require('log4js').getLogger();

module.exports = function(FeedModel, datastore) {

   var handleUpload = function(res, user, feed, data) {

      if (user) {
         if (feed) {
            if (data) {

               datastore.importJson(user.id,
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
                                                            userId : user.id,
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
      }
      else {
         return res.jsendClientError("Authentication required", null, httpStatus.UNAUTHORIZED);
      }

   };
   // for uploads authenticated using the feed's API Key in the header
   router.put('/',
              passport.authenticate('localapikey', { session : false }),
              function(req, res, next) {
                 var feed = req.authInfo.feed;

                 log.debug("Received PUT to upload data for feed ID [" + feed.id + "] (feed API Key authentication)");
                 return handleUpload(res, req.user, feed, req.body);
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
                       return handleUpload(res, req.user, feed, req.body);
                    }
                    else {
                       return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 Forbidden
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
