var express = require('express');
var router = express.Router();
var passport = require('passport');
var ValidationError = require('../../lib/errors').ValidationError;
var DuplicateRecordError = require('../../lib/errors').DuplicateRecordError;
var log = require('log4js').getLogger();

module.exports = function(ClientModel) {

   router.post('/',
               function(req, res) {
                  var newClient = req.body;
                  log.debug("Received POST to create client [" + (newClient && newClient.clientName ? newClient.clientName : null) + "]");

                  ClientModel.create(newClient,
                                     function(err, result) {
                                        if (err) {
                                           if (err instanceof ValidationError) {
                                              return res.jsendClientError("Validation failure", err.data);
                                           }
                                           if (err instanceof DuplicateRecordError) {
                                              log.debug("Client name [" + newClient.clientName + "] already in use!");
                                              return res.jsendClientError("Client name already in use.", {clientName : newClient.clientName}, 409);  // HTTP 409 Conflict
                                           }

                                           var message = "Error while trying to create client [" + newClient.clientName + "]";
                                           log.error(message + ": " + err);
                                           return res.jsendServerError(message);
                                        }

                                        log.debug("Created new client [" + result.clientName + "] with id [" + result.insertId + "] ");

                                        res.jsendSuccess({
                                                            displayName : result.displayName,
                                                            clientName : result.clientName
                                                         }, 201); // HTTP 201 Created
                                     });
               });

   return router;
};
