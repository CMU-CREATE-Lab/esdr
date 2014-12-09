var express = require('express');
var router = express.Router();
var passport = require('passport');
var httpStatus = require('http-status');
var log = require('log4js').getLogger('esdr:routes:api:feed');

module.exports = function(FeedModel, feedRouteHelper, authHelper) {

   // for uploads authenticated using the feed's API Key in the header
   router.put('/',
              passport.authenticate('feed-apikey', { session : false }),
              function(req, res, next) {
                 var feed = req.authInfo.feed;
                 var isReadOnly = req.authInfo.isReadOnly;

                 // Deny access if user authenticated with the read-only API key
                 if (isReadOnly) {
                    return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 Forbidden
                 }

                 log.debug("Received PUT to upload data for feed ID [" + feed.id + "] (feed API Key authentication)");
                 return feedRouteHelper.importData(res, feed, req.body);
              });

   var noCache = function(req, res, next) {
      // Taken from https://github.com/andrewrk/connect-nocache/blob/master/index.js
      res.setHeader('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');

      // taken from http://stackoverflow.com/a/20429914
      res.header('Expires', '-1');
      res.header('Pragma', 'no-cache');
      next();
   };

   // for getting info about a feed, authenticated using the feed's API Key in the request header
   router.get('/',
              noCache,
              function(req, res, next) {
                 return getFeedInfo(req.headers['feedapikey'], req, res);
              });

   // for getting info about a feed, authenticated using the feed's API Key in the URL
   router.get('/:feedApiKey',
              function(req, res, next) {
                 return getFeedInfo(req.params['feedApiKey'], req, res);
              });

   var getFeedInfo = function(feedApiKey, req, res) {
      authHelper.authenticateByFeedApiKey(feedApiKey, function(err, user, info) {
         if (err) {
            var message = "Error while authenticating the feed API key";
            log.error(message + ": " + err);
            return res.jsendServerError(message);
         }

         var feed = info.feed;
         if (feed) {
            log.debug("Received GET to get info for in feed [" + feed.id + "] (feed API Key authentication)");

            FeedModel.filterFields(feed, req.query.fields, function(err, filteredFeed) {
               if (err) {
                  return res.jsendServerError("Failed to get feed: " + err.message, null);
               }

               return feedRouteHelper.getInfo(res, filteredFeed, info.isReadOnly);
            });
         }
         else {
            return res.jsendClientError("Authentication required.", null, httpStatus.UNAUTHORIZED);  // HTTP 401 Unauthorized
         }
      });
   };

   return router;
};
