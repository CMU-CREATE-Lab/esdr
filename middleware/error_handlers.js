var httpStatus = require('http-status');
var log = require('log4js').getLogger('esdr:middleware:error_handlers');

module.exports = {
   http404 : function(req, res, next) {
      log.error("In 404 error handler...");
      var statusCode = httpStatus.NOT_FOUND;
      res.jsendClientError("Resource not found", null, statusCode);
   },

   dev : function(err, req, res, next) {
      log.debug("In DEV error handler!");
      log.error(err);
      var statusCode = err.status || httpStatus.INTERNAL_SERVER_ERROR;
      return res.jsendServerError(err.message, null, statusCode);
   },

   prod : function(err, req, res, next) {
      log.debug("In PROD error handler!");
      log.error(err);
      var statusCode = err.status || httpStatus.INTERNAL_SERVER_ERROR;
      return res.jsendServerError("Sorry, an unexpected error occurred", null, statusCode);
   }
};