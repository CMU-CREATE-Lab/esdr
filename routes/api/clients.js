var express = require('express');
var router = express.Router();
var passport = require('passport');
var log = require('log4js').getLogger();

module.exports = function(ClientModel) {

   router.post('/',
               function(req, res) {
                  var newClient = req.body;
                  log.debug("Received POST to create client:" + JSON.stringify(newClient, null, 3));

                  ClientModel.create(newClient,
                                     function(err, result) {
                                        if (err) {
                                           // some errors have an error type defined in the result
                                           if (result && result.errorType) {
                                              if (result.errorType == "validation") {
                                                 return res.jsendClientError("Validation failure", err);
                                              }
                                              else if (result.errorType == "database" && err.code == "ER_DUP_ENTRY") {
                                                 log.debug("Client name [" + newClient.clientName + "] already in use!");
                                                 return res.jsendClientError("Client name already in use.", null, 409);  // HTTP 409 Conflict
                                              }
                                           }
                                           var message = "Error while trying to create client [" + newClient.clientName + "]";
                                           log.error(message + ": " + err);
                                           return res.jsendServerError(message);
                                        }

                                        log.debug("Created new client [" + newClient.clientName + "] with id [" + result.insertId + "] ");

                                        res.jsendSuccess({
                                                            displayName : newClient.displayName,
                                                            clientName : newClient.clientName
                                                         }, 201); // HTTP 201 Created
                                     });
               });

   return router;
};
