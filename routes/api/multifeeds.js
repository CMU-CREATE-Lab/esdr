var express = require('express');
var router = express.Router();
var passport = require('passport');
var ValidationError = require('../../lib/errors').ValidationError;
var DuplicateRecordError = require('../../lib/errors').DuplicateRecordError;
var httpStatus = require('http-status');
var log = require('log4js').getLogger('esdr:routes:api:feeds');

module.exports = function(FeedModel, MultifeedModel) {

   // creates a new multifeed
   router.post('/',
               passport.authenticate('bearer', { session : false }),
               function(req, res, next) {
                  var multifeed = req.body;
                  MultifeedModel.create(multifeed, req.user.id, function(err, result) {
                     if (err) {
                        if (err instanceof ValidationError) {
                           return res.jsendClientValidationError("Validation failure", err.data);   // HTTP 422 Unprocessable Entity
                        }
                        if (err instanceof DuplicateRecordError) {
                           log.debug("Multifeed name [" + multifeed.name + "] already in use!");
                           return res.jsendClientError("Multifeed name already in use.", { name : multifeed.name }, httpStatus.CONFLICT);  // HTTP 409 Conflict
                        }

                        var message = "Error while trying to create multifeed [" + multifeed.name + "]";
                        log.error(message + ": " + err);
                        return res.jsendServerError(message);
                     }

                     log.debug("Created new multifeed [" + multifeed.name + "] for user [" + req.user.id + "] with id [" + result.insertId + "]");

                     return res.jsendSuccess({
                                                id : result.insertId,
                                                name : result.name
                                             }, httpStatus.CREATED); // HTTP 201 Created
                  });
               });

   router.get('/:name',
              function(req, res, next) {
                 var multifeedName = req.params.name;

                 return res.jsendSuccess("multifeed for [" + multifeedName + "]");
              }
   );

   return router;

};
