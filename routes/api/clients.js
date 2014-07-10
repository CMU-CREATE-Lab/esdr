var express = require('express');
var router = express.Router();
var passport = require('passport');
var JaySchema = require('jayschema');
var ClientSchema = require('../../models/json-schemas').ClientSchema;
var log = require('log4js').getLogger();

var jsonValidator = new JaySchema();

module.exports = function(ClientModel) {

   router.post('/',
               function(req, res) {
                  var clientJson = req.body;
                  log.debug("Received POST to create client:" + JSON.stringify(clientJson, null, 3));

                  // validate JSON (asynchronously)
                  jsonValidator.validate(clientJson, ClientSchema, function(err1) {
                     if (err1) {
                        return res.jsendClientError("Validation failure", err1);
                     }

                     // JSON is valid, so now see whether this client name is already taken
                     ClientModel.findByName(clientJson.clientName, function(err2, client) {
                        if (err2) {
                           var message = "Error while trying to find client [" + clientJson.clientName + "]";
                           log.error(message + ": " + err2);
                           return res.jsendServerError(message);
                        }

                        if (client && client.id) {
                           log.debug("Client name [" + clientJson.clientName + "] already in use!");
                           return res.jsendClientError("Client name already in use.", null, 409);  // HTTP 409 Conflict
                        }
                        else {
                           var newClient = {
                              prettyName : clientJson.prettyName,
                              clientName : clientJson.clientName,
                              clientSecret : clientJson.clientSecret
                           };
                           ClientModel.create(newClient,
                                              function(err3, result) {
                                                 if (err3) {
                                                    var message = "Error while trying to create client [" + clientJson.clientName + "]";
                                                    log.error(message + ": " + err3);
                                                    return res.jsendServerError(message);
                                                 }
                                                 log.debug("Created new client [" + newClient.clientName + "] with id [" + result.insertId + "] ");

                                                 res.jsendSuccess({
                                                                     prettyName : newClient.prettyName,
                                                                     clientName : newClient.clientName
                                                                  }, 201); // HTTP 201 Created
                                              });

                        }
                     });
                  });
               });

   return router;
};
