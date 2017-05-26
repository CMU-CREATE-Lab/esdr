var express = require('express');
var router = express.Router();
var passport = require('passport');
var httpStatus = require('http-status');
var log = require('log4js').getLogger('esdr:routes:api:mirror-registrations');
var JSendError = require('jsend-utils').JSendError;
var ValidationError = require('../../lib/errors').ValidationError;
var DuplicateRecordError = require('../../lib/errors').DuplicateRecordError;

module.exports = function(ProductModel, MirrorRegistrationsModel) {

   router.post('/:realm/registrations/products/:productNameOrId',
               passport.authenticate(['basic-username-password', 'bearer'], { session : false }),
               function(req, res, next) {

                  // first try to find the product
                  var productNameOrId = req.params['productNameOrId'];
                  ProductModel.findByNameOrId(productNameOrId, 'id', function(err, product) {
                     if (err) {
                        var message = "Error while trying to find product [" + productNameOrId + "]";
                        log.error(message + ": " + err);
                        return res.jsendServerError(message);
                     }

                     // continue if we found the product, otherwise return a 404
                     if (product) {
                        var user = req.user;
                        var realm = req.params['realm'];

                        MirrorRegistrationsModel.createForProduct(realm, user.id, product.id, function(err, result) {
                           if (err) {
                              if (err instanceof JSendError) {
                                 return res.jsendPassThrough(err.data);
                              }
                              else {
                                 if (err instanceof ValidationError) {
                                    return res.jsendClientValidationError("Validation failure", err.data);   // HTTP 422 Unprocessable Entity
                                 }
                                 if (err instanceof DuplicateRecordError) {
                                    log.debug("Mirror registration for realm [" + realm + "], user [" + user.id + "], and product [" + product.id + "] already exists!");
                                    return res.jsendClientError("Mirror registration already exists.",
                                                                {
                                                                   realm : realm,
                                                                   userId : user.id,
                                                                   productId : product.id
                                                                },
                                                                httpStatus.CONFLICT);  // HTTP 409 Conflict
                                 }

                                 var message = "Error while trying to create mirror registration for realm [" + realm + "], user [" + user.id + "], and product [" + product.id + "]";
                                 log.error(message + ": " + err);
                                 return res.jsendServerError(message);
                              }
                           }

                           return res.jsendSuccess({ mirrorToken : result.mirrorToken }, httpStatus.CREATED); // HTTP 201 Created
                        });
                     }
                     else {
                        return res.jsendClientError("Unknown or invalid product", null, httpStatus.NOT_FOUND); // HTTP 404 Not Found
                     }
                  });
               });

   router.delete('/:realm/registrations/:mirrorToken',
                 function(req, res, next) {
                    var realm = req.params['realm'];
                    var mirrorToken = req.params['mirrorToken'];

                    MirrorRegistrationsModel.deleteRegistration(realm, mirrorToken, function(err, deleteResult) {
                       if (err) {
                          if (err instanceof ValidationError) {
                             return res.jsendClientValidationError(err.message || "Validation failure", err.data);   // HTTP 422 Unprocessable Entity
                          }
                          if (typeof err.data !== 'undefined' &&
                              typeof err.data.code !== 'undefined' &&
                              typeof err.data.status !== 'undefined') {
                             return res.jsendPassThrough(err.data);
                          }

                          var message = "Error while deleting mirror registration for realm [" + realm + "] with mirror token [" + mirrorToken + "]";
                          log.error(message + ": " + err);
                          return res.jsendServerError(message);
                       }

                       return res.jsendSuccess(deleteResult); // HTTP 200 OK
                    });
                 }
   );

   return router;
};