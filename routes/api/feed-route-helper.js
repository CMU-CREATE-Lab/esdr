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
};