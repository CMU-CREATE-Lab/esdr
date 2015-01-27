var express = require('express');
var router = express.Router();
var passport = require('passport');
var ValidationError = require('../../lib/errors').ValidationError;
var DuplicateRecordError = require('../../lib/errors').DuplicateRecordError;
var httpStatus = require('http-status');
var log = require('log4js').getLogger('esdr:routes:api:clients');

module.exports = function(ClientModel) {

   // create a new client (with optional authentication)
   router.post('/',
               passport.authenticate('bearer', { session : false }),
               function(req, res, next) {
                  var userId = req.user.id;
                  var newClient = req.body;
                  log.debug("Received POST from user ID [" + userId + "] to create client [" + (newClient && newClient.clientName ? newClient.clientName : null) + "]");
                  ClientModel.create(newClient,
                                     userId,
                                     function(err, result) {
                                        if (err) {
                                           if (err instanceof ValidationError) {
                                              return res.jsendClientValidationError("Validation failure", err.data);   // HTTP 422 Unprocessable Entity
                                           }
                                           if (err instanceof DuplicateRecordError) {
                                              log.debug("Client name [" + newClient.clientName + "] already in use!");
                                              return res.jsendClientError("Client name already in use.", { clientName : newClient.clientName }, httpStatus.CONFLICT);  // HTTP 409 Conflict
                                           }

                                           var message = "Error while trying to create client [" + newClient.clientName + "]";
                                           log.error(message + ": " + err);
                                           return res.jsendServerError(message);
                                        }

                                        log.debug("Created new client [" + result.clientName + "] with id [" + result.insertId + "] ");

                                        res.jsendSuccess({
                                                            displayName : result.displayName,
                                                            clientName : result.clientName
                                                         }, httpStatus.CREATED); // HTTP 201 Created
                                     });
               });

   // for searching for clients, optionally matching specified criteria and sort order
   router.get('/',
              function(req, res, next) {
                 passport.authenticate('bearer', function(err, user, info) {
                    if (err) {
                       var message = "Error while authenticating to find clients";
                       log.error(message + ": " + err);
                       return res.jsendServerError(message);
                    }

                    ClientModel.find(user ? user.id : null,
                                     req.query,
                                     function(err, result, selectedFields) {
                                        if (err) {
                                           log.error(JSON.stringify(err, null, 3));
                                           // See if the error contains a JSend data object.  If so, pass it on through.
                                           if (typeof err.data !== 'undefined' &&
                                               typeof err.data.code !== 'undefined' &&
                                               typeof err.data.status !== 'undefined') {
                                              return res.jsendPassThrough(err.data);
                                           }
                                           return res.jsendServerError("Failed to get clients", null);
                                        }

                                        return res.jsendSuccess(result);
                                     });
                 })(req, res, next);
              });

   return router;
};
