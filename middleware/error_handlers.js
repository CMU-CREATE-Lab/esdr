var httpStatus = require('http-status');
var S = require('string');
var log = require('log4js').getLogger('esdr:middleware:error_handlers');

var isApi = function(req) {
   return (S(req.url).startsWith("/oauth/") ||
           S(req.url).startsWith("/api/") ||
           (
           req.method.toLowerCase() == "post" &&
           S(req.url).startsWith("/login")
           )
   );
};

var handleError = function(req, res, message, data, statusCode) {
   if (isApi(req)) {
      res.jsendServerError(message, data, statusCode);
   }
   else {
      res.status(statusCode).render('error', {
         layout : "error-layout",
         title : "HTTP " + statusCode,
         message : message
      });
   }
};

module.exports = {
   http404 : function(req, res, next) {

      var message = "Resource not found";
      var statusCode = httpStatus.NOT_FOUND;

      if (isApi(req)) {
         res.jsendClientError(message, { url : req.url }, statusCode);
      }
      else {
         res.status(statusCode).render('error', {
            layout : "error-layout",
            title : "HTTP " + statusCode,
            message : message
         });
      }
   },

   dev : function(err, req, res, next) {
      log.debug("In DEV error handler: " + JSON.stringify(err, null, 3));
      var message = err.message;
      var statusCode = err.status || httpStatus.INTERNAL_SERVER_ERROR;

      handleError(req, res, message, err, statusCode);
   },

   prod : function(err, req, res, next) {
      log.debug("In PROD error handler: " + JSON.stringify(err, null, 3));
      var message = "Sorry, an unexpected error occurred";
      var statusCode = err.status || httpStatus.INTERNAL_SERVER_ERROR;

      handleError(req, res, message, null, statusCode);
   }
};