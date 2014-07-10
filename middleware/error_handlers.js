var log = require('log4js').getLogger();

module.exports = {
   http404 : function(req, res, next) {
      log.error("In 404 error handler...");
      var statusCode = 404;
      res.jsendClientError("Resource not found", null, statusCode);
   },

   development : function(err, req, res, next) {
      log.debug("In DEV error handler!");
      log.error(err);
      var statusCode = err.status || 500;
      return res.jsendServerError(err.message, null, statusCode);
   },

   production : function(err, req, res, next) {
      log.debug("In PROD error handler!");
      log.error(err);
      var statusCode = err.status || 500;
      return res.jsendServerError("Sorry, an unexpected error occurred", null, statusCode);
   }
};