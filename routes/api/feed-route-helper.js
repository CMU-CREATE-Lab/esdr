var httpStatus = require('http-status');
var log = require('log4js').getLogger('esdr:routes:api:feed-route-helper');

module.exports = function(FeedModel) {

   this.importData = function(res, feed, data) {
      if (data) {
         FeedModel.importData(feed,
                              data,
                              function(err, importResult) {
                                 if (err) {
                                    // See if the error contains a JSend data object.  If so, pass it on through.
                                    if (typeof err.data !== 'undefined' &&
                                        typeof err.data.code !== 'undefined' &&
                                        typeof err.data.status !== 'undefined') {
                                       return res.jsendPassThrough(err.data);
                                    }
                                    return res.jsendServerError("Failed to import data: " + err.message, null);
                                 }

                                 return res.jsendSuccess(importResult, httpStatus.OK); // HTTP 200 OK
                              }
         );
      }
      else {
         return res.jsendClientError("No data received", null, httpStatus.BAD_REQUEST);
      }
   };

   /**
    * Assumes the given feed has already been filtered by the route handler to include only fields requested by the
    * caller.
    */
   this.getInfo = function(res, filteredFeed, willPreventSelectionOfApiKey) {
      // inflate the JSON fields into objects
      if ("channelSpecs" in filteredFeed) {
         filteredFeed.channelSpecs = JSON.parse(filteredFeed.channelSpecs);
      }

      if ("channelBounds" in filteredFeed) {
         filteredFeed.channelBounds = JSON.parse(filteredFeed.channelBounds);
      }

      // delete the API key if not allowed to see it
      if (willPreventSelectionOfApiKey) {
         delete filteredFeed.apiKey;
      }

      return res.jsendSuccess(filteredFeed, httpStatus.OK); // HTTP 200 OK
   };

   this.getTile = function(res, feed, channelName, level, offset) {
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
};