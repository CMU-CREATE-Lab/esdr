var express = require('express');
var router = express.Router();
var passport = require('passport');
var httpStatus = require('http-status');
var config = require('../../config');

var log = require('log4js').getLogger('esdr:routes:api:feed');

module.exports = function(FeedModel, feedRouteHelper, authHelper) {

   const FEED_UPLOAD_RESPONSE_DELAY_MILLIS = config.get("esdr:feedUploadResponseDelayMillis") || 0;

   var pause = function(delay) {
      if (delay > 0) {
         return function(req, res, next) {
            setTimeout(next, delay);
         };
      }
      else {
         return function(req, res, next) {
            next();
         };
      }
   };

   /**
    * For uploads authenticated using the feed's API Key in the header
    * @deprecated: use PUT /feeds/:feedApiKey instead
    */
   router.put('/',
              passport.authenticate('feed-apikey', { session : false }),
              pause(FEED_UPLOAD_RESPONSE_DELAY_MILLIS),
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

   return router;
};
