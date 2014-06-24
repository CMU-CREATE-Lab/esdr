var mongoose = require('mongoose');
var crypto = require('crypto');
var bcrypt = require('bcrypt');
var log = require('log4js').getLogger();
var config = require('../config');

// =====================================================================================================================

var User = new mongoose.Schema({
                                  username : {
                                     type : String,
                                     unique : true,
                                     required : true
                                  },
                                  password : {
                                     type : String,
                                     required : true
                                  },
                                  email : {
                                     type : String,
                                     required : true
                                  },
                                  created : {
                                     type : Date,
                                     default : Date.now
                                  }
                               });

// This prevents the password (and other junk) from being included
User.methods.toJSON = function() {
   return {
      id : this._id,
      username : this.username,
      email : this.email
   };
};

User.methods.isValidPassword = function(password) {
   return bcrypt.compareSync(password, this.password);
};

User.statics.findByUsername = function(username, callback) {
   UserModel.findOne({ username : username }, callback);
};

User.statics.createUser = function(userDetails, callback) {
   bcrypt.hash(userDetails.password, 8, function(err, hashedPassword) {
      if (err) {
         callback(err);
      }
      else {
         UserModel.create({
                             username : userDetails.username,
                             password : hashedPassword,
                             email : userDetails.email
                          }, callback);
      }
   });
};

// =====================================================================================================================

var Client = new mongoose.Schema({
                                    name : {
                                       type : String,
                                       unique : true,
                                       required : true
                                    },
                                    clientId : {
                                       type : String,
                                       unique : true,
                                       required : true
                                    },
                                    clientSecret : {
                                       type : String,
                                       required : true
                                    },
                                    created : {
                                       type : Date,
                                       default : Date.now
                                    }
                                 });

Client.statics.findByClientId = function(clientId, callback) {
   ClientModel.findOne({ clientId : clientId }, callback);
};

// =====================================================================================================================

var AccessToken = new mongoose.Schema({
                                         userId : {
                                            type : String,
                                            required : true
                                         },
                                         clientId : {
                                            type : String,
                                            required : true
                                         },
                                         token : {
                                            type : String,
                                            unique : true,
                                            required : true
                                         },
                                         created : {
                                            type : Date,
                                            default : Date.now
                                         }
                                      });

AccessToken.methods.isExpired = function() {
   return Math.round((Date.now() - this.created) / 1000) > config.get('security:tokenLifeSecs');
};

// =====================================================================================================================

var RefreshToken = new mongoose.Schema({
                                          userId : {
                                             type : String,
                                             required : true
                                          },
                                          clientId : {
                                             type : String,
                                             required : true
                                          },
                                          token : {
                                             type : String,
                                             unique : true,
                                             required : true
                                          },
                                          created : {
                                             type : Date,
                                             default : Date.now
                                          }
                                       });

// =====================================================================================================================

var generateNewTokens = function(user, client, callback) {
   var userId = user.id;
   var clientId = client.clientId;
   log.debug("generateNewTokens() for user [" + user.username + "] and client [" + clientId + "]");

   // delete old tokens for this user/client combo
   RefreshTokenModel.remove({ userId : userId, clientId : clientId }, function(err) {
      if (err) {
         return callback(err);
      }
   });
   AccessTokenModel.remove({ userId : userId, clientId : clientId }, function(err) {
      if (err) {
         return callback(err);
      }
   });

   // generate new token values
   var tokenValues = {
      access : crypto.randomBytes(128).toString('base64'),
      refresh : crypto.randomBytes(128).toString('base64')
   };

   // create the tokens
   var accessToken = new AccessTokenModel({ token : tokenValues.access, clientId : clientId, userId : userId });
   var refreshToken = new RefreshTokenModel({ token : tokenValues.refresh, clientId : clientId, userId : userId });

   // save each to the DB and then return the values to the caller
   accessToken.save(function(err) {
      if (err) {
         return callback(err);
      }
      refreshToken.save(function(err) {
         if (err) {
            return callback(err);
         }
         callback(null, tokenValues);
      });
   });
};

// =====================================================================================================================

var UserModel = mongoose.model('User', User);
var ClientModel = mongoose.model('Client', Client);
var AccessTokenModel = mongoose.model('AccessToken', AccessToken);
var RefreshTokenModel = mongoose.model('RefreshToken', RefreshToken);

// =====================================================================================================================

module.exports.AccessTokenModel = AccessTokenModel;
module.exports.ClientModel = ClientModel;
module.exports.RefreshTokenModel = RefreshTokenModel;
module.exports.UserModel = UserModel;
module.exports.generateNewTokens = generateNewTokens;

