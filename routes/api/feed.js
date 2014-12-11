var express = require('express');
var router = express.Router();
var passport = require('passport');
var httpStatus = require('http-status');
var log = require('log4js').getLogger('esdr:routes:api:feed');

module.exports = function(FeedModel, feedRouteHelper, authHelper) {

   /**
    * For uploads authenticated using the feed's API Key in the header
    * @deprecated: use PUT /feeds/:feedApiKey instead
    */
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

   return router;
};
