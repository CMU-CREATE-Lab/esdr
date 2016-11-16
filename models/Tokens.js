var flow = require('nimble');
var config = require('../config');
var createRandomHexToken = require('../lib/token').createRandomHexToken;
var log = require('log4js').getLogger('esdr:models:tokens');

var CREATE_TABLE_QUERY = " CREATE TABLE IF NOT EXISTS `Tokens` ( " +
                         "`id` bigint(20) NOT NULL AUTO_INCREMENT, " +
                         "`userId` bigint(20) NOT NULL, " +
                         "`clientId` bigint(20) NOT NULL, " +
                         "`accessToken` varchar(64) NOT NULL, " +
                         "`refreshToken` varchar(64) NOT NULL, " +
                         "`created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
                         "PRIMARY KEY (`id`), " +
                         "UNIQUE KEY `unique_accessToken` (`accessToken`), " +
                         "UNIQUE KEY `unique_refreshToken` (`refreshToken`), " +
                         "UNIQUE KEY `userId_clientId_index` (`userId`,`clientId`), " +
                         "KEY `userId` (`userId`), " +
                         "KEY `clientId` (`clientId`), " +
                         "CONSTRAINT `refreshtokens_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `Users` (`id`), " +
                         "CONSTRAINT `refreshtokens_ibfk_2` FOREIGN KEY (`clientId`) REFERENCES `Clients` (`id`) " +
                         ") ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8";

var isTokenExpired = function(tokenRecord) {
   return Math.round((Date.now() - new Date(tokenRecord.created).getTime()) / 1000) > config.get("security:tokenLifeSecs")
};

module.exports = function(databaseHelper) {

   var self = this;

   this.initialize = function(callback) {
      databaseHelper.execute(CREATE_TABLE_QUERY, [], function(err) {
         if (err) {
            log.error("Error trying to create the Tokens table: " + err);
            return callback(err);
         }

         return callback(null, true);
      });
   };

   var generateTokens = function() {
      return {
         access : createRandomHexToken(32),
         refresh : createRandomHexToken(32)
      };
   };

   this.create = function(userId, clientId, callback) {
      log.debug("creating tokens for user [" + userId + "] and client [" + clientId + "]");

      var connection = null;
      var error = null;
      var hasError = function() {
         return error != null;
      };
      var tokens = null;

      flow.series(
            [
               // get the connection
               function(done) {
                  log.debug("create(): 1) Getting the connection");
                  databaseHelper.getConnection(function(err, newConnection) {
                     if (err) {
                        error = err;
                     }
                     else {
                        connection = newConnection;
                     }
                     done();
                  });
               },

               // begin the transaction
               function(done) {
                  if (!hasError()) {
                     log.debug("create(): 2) Beginning the transaction");
                     connection.beginTransaction(function(err) {
                        if (err) {
                           error = err;
                        }
                        done();
                     });
                  }
                  else {
                     done();
                  }
               },

               // see whether this user already has unexpired tokens
               function(done) {
                  if (!hasError()) {
                     log.debug("create(): 3) Looking for existing unexpired tokens");
                     connection.query("SELECT * FROM Tokens WHERE userId=? AND clientId=?",
                                      [userId, clientId],
                                      function(err, rows) {
                                         if (err) {
                                            error = err;
                                            done();
                                         }
                                         else {
                                            if (rows && rows.length > 0) {
                                               // existing token record found, so now see whether it's expired
                                               var tokenRecord = rows[0];
                                               if (isTokenExpired(tokenRecord)) {
                                                  // token expired, so create new and update
                                                  log.debug("create(): 4) Token is expired, so creating new and updating record");
                                                  tokens = generateTokens();
                                                  connection.query("UPDATE Tokens SET accessToken=?, refreshToken=?, created=now() WHERE id=?",
                                                                   [tokens.access, tokens.refresh, tokenRecord.id],
                                                                   function(err, result) {
                                                                      if (err) {
                                                                         error = err;
                                                                      }
                                                                      done();
                                                                   });
                                               }
                                               else {
                                                  // token still valid, so just update the created timestamp
                                                  log.debug("create(): 4) Token is still valid, so updating the token's expiration date");

                                                  tokens = {
                                                     access : tokenRecord.accessToken,
                                                     refresh : tokenRecord.refreshToken,
                                                  };
                                                  connection.query("UPDATE Tokens SET created=now() WHERE id=?",
                                                                   [tokenRecord.id],
                                                                   function(err, result) {
                                                                      if (err) {
                                                                         error = err;
                                                                      }
                                                                      done();
                                                                   });
                                               }
                                            }
                                            else {
                                               // no existing tokens found, so create new and insert
                                               log.debug("create(): 4) No token found, so creating new and inserting");
                                               tokens = generateTokens();
                                               connection.query("INSERT INTO Tokens (userId, clientId, accessToken, refreshToken) VALUES (?,?,?,?)",
                                                                [userId, clientId, tokens.access, tokens.refresh],
                                                                function(err, result) {
                                                                   if (err) {
                                                                      error = err;
                                                                   }
                                                                   done();
                                                                });
                                            }
                                         }
                                      });
                  }
                  else {
                     done();
                  }
               }
            ],
            function() {
               log.debug("create(): 5) All done, now checking status and performing commit/rollback as necessary!");
               if (hasError() || tokens == null) {
                  connection.rollback(function() {
                     connection.release();
                     if (hasError()) {
                        log.error("create():    An error occurred while creating tokens, rolled back the transaction. Error:" + error);
                        callback(error);
                     }
                     else {
                        log.error("create():    Failed to create tokens, rolled back the transaction.");
                        callback(null);
                     }
                  });
               }
               else {
                  log.debug("create():    No errors while creating tokens, committing...");
                  connection.commit(function(err) {
                     if (err) {
                        log.error("create():    Failed to commit the transaction after creating tokens");

                        // rollback and then release the connection
                        connection.rollback(function() {
                           connection.release();
                           callback(err);
                        });
                     }
                     else {
                        connection.release();
                        log.debug("create():    Commit successful!");
                        callback(null, tokens);
                     }
                  });
               }
            }
      );
   };

   this.findAccessTokenForUserAndClient = function(userId, clientId, callback) {
      databaseHelper.findOne("SELECT accessToken FROM Tokens WHERE userId=? AND clientId=?", [userId, clientId], callback);
   };

   this.remove = function(userId, clientId, callback) {
      databaseHelper.execute("DELETE FROM Tokens WHERE userId=? AND clientId=?",
                             [userId, clientId],
                             function(err) {
                                if (err) {
                                   callback(err, false);
                                }
                                else {
                                   callback(null, true);
                                }
                             });
   };

   this.refreshToken = function(clientId, refreshToken, callback) {

      var connection = null;
      var error = null;
      var hasError = function() {
         return error != null;
      };
      var userId = null;
      var newTokens = null;

      log.debug("Refreshing access token with this refresh token: " + refreshToken);
      flow.series(
            [
               // get the connection
               function(done) {
                  log.debug("refreshToken(): 1) Getting the connection");
                  databaseHelper.getConnection(function(err, newConnection) {
                     if (err) {
                        error = err;
                     }
                     else {
                        connection = newConnection;
                     }
                     done();
                  });
               },

               // begin the transaction
               function(done) {
                  if (!hasError()) {
                     log.debug("refreshToken(): 2) Beginning the transaction");
                     connection.beginTransaction(function(err) {
                        if (err) {
                           error = err;
                        }
                        done();
                     });
                  }
                  else {
                     done();
                  }
               },

               // find the refresh token for this client--from this we'll determine the userId of the user owning this token
               function(done) {
                  if (!hasError()) {
                     log.debug("refreshToken(): 3) Find the refresh token for the client");
                     connection.query("SELECT userId FROM Tokens WHERE refreshToken=? AND clientId=?",
                                      [refreshToken, clientId],
                                      function(err, rows) {
                                         if (err) {
                                            error = err;
                                         }
                                         else {
                                            // might not find anything, but that's OK--just set to null and
                                            // later code will deal appropriately
                                            userId = (rows && rows.length > 0) ? rows[0].userId : null;
                                            log.debug("refreshToken():    Refresh token exists=" + (userId != null) + ", userId=" + JSON.stringify(userId, null, 3));
                                         }
                                         done();
                                      });
                  }
                  else {
                     done();
                  }
               },

               // delete old tokens and generate new
               function(done) {
                  if (!hasError() && userId) {
                     log.debug("refreshToken(): 4) delete old tokens and generate new");

                     connection.query("DELETE FROM Tokens WHERE refreshToken=?",
                                      [refreshToken],
                                      function(err, result) {
                                         if (err) {
                                            error = err;
                                            done();
                                         }
                                         else {
                                            // Generate new tokens. We can't just call self.create here since we're in a transaction, and
                                            // so DELETE above won't have been committed in the context that self.create will operate in,
                                            // so it would just return the existing tokens.
                                            newTokens = generateTokens();
                                            connection.query("INSERT INTO Tokens (userId, clientId, accessToken, refreshToken) VALUES (?,?,?,?)",
                                                             [userId, clientId, newTokens.access, newTokens.refresh],
                                                             function(err, result) {
                                                                if (err) {
                                                                   error = err;
                                                                }
                                                                done();
                                                             });
                                         }
                                      });
                  }
                  else {
                     done();
                  }
               }
            ],

            // handle outcome
            function() {
               log.debug("refreshToken(): 5) All done, now checking status and performing commit/rollback as necessary!");
               if (hasError() || userId == null) {
                  connection.rollback(function() {
                     connection.release();
                     if (hasError()) {
                        log.error("refreshToken():    An error occurred while refreshing token, rolled back the transaction. Error:" + error);
                        callback(error);
                     }
                     else {
                        log.error("refreshToken():    Invalid refresh token, rolled back the transaction.");
                        callback(null);
                     }
                  });
               }
               else {
                  log.debug("refreshToken():    No errors while refreshing token, committing...");
                  connection.commit(function(err) {
                     if (err) {
                        log.error("refreshToken():    Failed to commit the transaction after refreshing token");

                        // rollback and then release the connection
                        connection.rollback(function() {
                           connection.release();
                           callback(err);
                        });
                     }
                     else {
                        connection.release();
                        log.debug("refreshToken():    Commit successful!");
                        callback(null, newTokens);
                     }
                  });
               }
            }
      );
   };

   /**
    * Tries to find the given access token. Returns the full token details (userId, clientId, access and refresh tokens,
    * creation date, etc.) if it exists and has not expired.  Returns <code>null</code> if it either doesn't exist or is
    * expired.
    *
    * @param {string} accessToken the access token to validate
    * @param {function} callback callback function with signature <code>callback(err, token, message)</code>
    */
   this.validateAccessToken = function(accessToken, callback) {

      databaseHelper.findOne('SELECT * FROM Tokens where accessToken=?', [accessToken], function(err, tokenRecord) {
         if (err) {
            return callback(err);
         }

         // if not null, then check expiration
         if (tokenRecord) {
            if (isTokenExpired(tokenRecord)) {
               log.debug("validateAccessToken(): token expired!");
               return callback(null, null, 'Token expired');
            }
            else {
               log.debug("validateAccessToken(): token found!");
               return callback(null, tokenRecord);
            }
         }
         else {
            log.debug("validateAccessToken(): token not found!");
            callback(null, null);
         }
      });
   };
};
