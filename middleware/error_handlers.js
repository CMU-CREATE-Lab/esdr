const httpStatus = require('http-status');
const log = require('log4js').getLogger('esdr:middleware:error_handlers');

const isApi = function(req) {
   return (req.url.startsWith("/oauth/") ||
           req.url.startsWith("/api/") ||
           (
                 req.method.toLowerCase() === "post" &&
                 req.url.startsWith("/login")
           )
   );
};

const handleError = function(req, res, message, data, statusCode) {
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

// noinspection JSUnusedLocalSymbols
module.exports = {
   http404 : function(req, res, next) {

      const message = "Resource not found";
      const statusCode = httpStatus.NOT_FOUND;

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
      const message = err.message;
      const statusCode = err.status || httpStatus.INTERNAL_SERVER_ERROR;

      handleError(req, res, message, err, statusCode);
   },

   prod : function(err, req, res, next) {
      log.debug("In PROD error handler: " + JSON.stringify(err, null, 3));
      const message = "Sorry, an unexpected error occurred";
      const statusCode = err.status || httpStatus.INTERNAL_SERVER_ERROR;

      handleError(req, res, message, null, statusCode);
   }
};