var httpStatus = require('http-status');
var log = require('log4js').getLogger();

module.exports = function(FeedModel) {

   this.importData = function(res, feed, data) {
      if (feed) {
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
      }
      else {
         return res.jsendClientError("Unknown or invalid feed", null, httpStatus.NOT_FOUND);
      }
   };

   this.getInfo = function(res, feed) {
      // inflate the JSON fields into objects
      if (feed.channelSpecs) {
         feed.channelSpecs = JSON.parse(feed.channelSpecs);
      }

      if (feed.channelBounds) {
         feed.channelBounds = JSON.parse(feed.channelBounds);
      }

      // Remove the API Key. No need to reveal it here.
      delete feed.apiKey;

      return res.jsendSuccess(feed, httpStatus.OK); // HTTP 200 OK
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