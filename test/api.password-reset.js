var should = require('should');
var flow = require('nimble');
var httpStatus = require('http-status');
var superagent = require('superagent-ls');
var requireNew = require('require-new');
var wipe = require('./fixture-helpers/wipe');
var setup = require('./fixture-helpers/setup');

var config = require('../config');

var ESDR_API_ROOT_URL = config.get("esdr:apiRootUrl");
var ESDR_PASSWORD_RESET_API_URL = ESDR_API_ROOT_URL + "/password-reset";

describe("REST API", function() {
   var client1 = requireNew('./fixtures/client1.json');
   var user1 = requireNew('./fixtures/user1.json');
   var newPassword = "this is the new password";

   before(function(initDone) {
      flow.series(
            [
               wipe.wipeAllData,
               function(done) {
                  setup.createClient(client1, done);
               },
               function(done) {
                  setup.createUser(user1, done);
               }
            ],
            initDone
      );
   });

   describe("Password Reset", function() {

      var testRequestPasswordResetToken = function(test) {
         var client = test.client || client1;
         it(test.description, function(done) {
            superagent
                  .post(ESDR_PASSWORD_RESET_API_URL)
                  .auth(client.clientName, client.clientSecret)
                  .send({ email : test.email })
                  .end(function(err, res) {
                     should.not.exist(err);
                     should.exist(res);

                     res.should.have.property('status', test.expectedHttpStatus);
                     res.body.should.have.properties({
                                                        code : test.expectedHttpStatus,
                                                        status : test.expectedStatusText || 'success'
                                                     });

                     if (typeof test.expectedResponseData !== 'undefined') {
                        res.body.should.have.property('data');
                        res.body.data.should.have.properties(test.expectedResponseData);
                        if (typeof test.expectedAdditionalResponseDataProperties !== 'undefined') {
                           res.body.data.should.have.properties(test.expectedAdditionalResponseDataProperties);
                        }
                     }

                     if (typeof test.saveTokenAs !== 'undefined') {
                        savedTokens[test.saveTokenAs] = res.body.data.resetPasswordToken;
                     }

                     done();
                  });
         });
      };

      var testResetPassword = function(test) {
         it(test.description, function(done) {
            superagent
                  .put(ESDR_PASSWORD_RESET_API_URL)
                  .send({
                           password : test.password,
                           token : typeof test.token === 'function' ? test.token() : test.token
                        })
                  .end(function(err, res) {
                     should.not.exist(err);
                     should.exist(res);

                     res.should.have.property('status', test.expectedHttpStatus);
                     res.body.should.have.properties({
                                                        code : test.expectedHttpStatus,
                                                        status : test.expectedStatusText || 'success'
                                                     });
                     res.body.should.have.property('data');

                     if (typeof test.expectedResponseData !== 'undefined') {
                        if (Array.isArray(test.expectedResponseData)) {
                           res.body.data.should.have.length(test.expectedResponseData.length);

                           res.body.data.forEach(function(validationItem, index) {
                              validationItem.should.have.properties(test.expectedResponseData[index]);
                           });

                        }
                        else {
                           res.body.data.should.have.properties(test.expectedResponseData);
                        }
                     }

                     done();
                  });
         });
      };

      var savedTokens = {};

      testRequestPasswordResetToken({
                                       description : "Should be able to request a password reset token",
                                       email : user1.email,
                                       expectedHttpStatus : httpStatus.CREATED,
                                       expectedResponseData : {
                                          email : user1.email
                                       },
                                       expectedAdditionalResponseDataProperties : ['resetPasswordToken'],
                                       saveTokenAs : "token1"
                                    });

      testRequestPasswordResetToken({
                                       description : "Should be able to request a password reset token again",
                                       email : user1.email,
                                       expectedHttpStatus : httpStatus.CREATED,
                                       expectedResponseData : {
                                          email : user1.email
                                       },
                                       expectedAdditionalResponseDataProperties : ['resetPasswordToken'],
                                       saveTokenAs : "token2"
                                    });

      it("Requesting the password reset token multiple times should yield different tokens", function(done) {
         savedTokens['token1'].should.not.equal(savedTokens['token2']);
         done();
      });

      testResetPassword(
            {
               description : "Should fail to set the password if the reset password token is missing",
               password : newPassword,
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error'
            }
      );

      testResetPassword(
            {
               description : "Should fail to set the password using an invalid reset password token",
               password : newPassword,
               token : "bogus",
               expectedHttpStatus : httpStatus.BAD_REQUEST,
               expectedStatusText : 'error'
            }
      );

      testResetPassword(
            {
               description : "Should fail to set the password using an invalid password",
               password : "z",
               token : function() {
                  return savedTokens['token2']
               },
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : [
                  {
                     instanceContext : '#/password',
                     constraintName : 'minLength',
                     testedValue : 1,
                     kind : 'StringValidationError'
                  }
               ]
            }
      );

      testResetPassword(
            {
               description : "Should be able to set the password using the reset password token",
               password : newPassword,
               token : function() {
                  return savedTokens['token2']
               },
               expectedHttpStatus : httpStatus.OK
            }
      );

      it("Should fail to find the user by email and the old password", function(done) {
         global.db.users.findByEmailAndPassword(user1.email, user1.password, function(err, user) {
            should.not.exist(err);
            should.not.exist(user);

            done();
         });
      });

      it("Should be able to find the user by email and the new password", function(done) {
         global.db.users.findByEmailAndPassword(user1.email, newPassword, function(err, user) {
            should.not.exist(err);
            should.exist(user);

            user.should.have.properties('password', 'created', 'modified');
            user.should.have.properties({
                                           id : user1.id,
                                           email : user1.email,
                                           displayName : user1.displayName,
                                        });

            done();
         });
      });

      testRequestPasswordResetToken({
                                       description : "Should fail to request a password reset token if email is not specified",
                                       expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
                                       expectedStatusText : 'error'
                                    });

      testRequestPasswordResetToken({
                                       description : "Should fail to request a password reset token for an invalid email",
                                       email : 'invalid',
                                       expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
                                       expectedStatusText : 'error',
                                       expectedResponseData : {
                                          email : 'invalid'
                                       }
                                    });

      testRequestPasswordResetToken({
                                       description : "Should fail to request a password reset token for an unknown email",
                                       email : 'unknown@unknown.com',
                                       expectedHttpStatus : httpStatus.BAD_REQUEST,
                                       expectedStatusText : 'error',
                                       expectedResponseData : {
                                          email : 'unknown@unknown.com'
                                       }
                                    });

      it("A request for a password reset token to be sent should not require client authentication", function(done) {
         superagent
               .post(ESDR_PASSWORD_RESET_API_URL)
               .send({ email : user1.email })
               .end(function(err, res) {
                  should.not.exist(err);
                  should.exist(res);

                  res.should.have.property('status', httpStatus.CREATED);
                  res.body.should.have.properties({
                                                     code : httpStatus.CREATED,
                                                     status : 'success'
                                                  });
                  res.body.should.have.property('data');
                  res.body.data.should.have.property('email', user1.email);
                  res.body.data.should.have.property('resetPasswordToken');
                  savedTokens['token3'] = res.body.data.resetPasswordToken;

                  done();
               });
      });

      testRequestPasswordResetToken({
                                       description : "A request for a password reset token to be sent should fail if the client authentication is invalid",
                                       email : user1.email,
                                       client : {
                                          clientName : client1.clientName,
                                          clientSecret : 'bogus',
                                       },
                                       expectedHttpStatus : httpStatus.UNAUTHORIZED,
                                       expectedStatusText : 'error'
                                    });

      testRequestPasswordResetToken({
                                       description : "Should fail to request a password reset token for an invalid client",
                                       email : user1.email,
                                       client : {
                                          clientName : 'bogus_client',
                                          clientSecret : 'bogus',
                                       },
                                       expectedHttpStatus : httpStatus.UNAUTHORIZED,
                                       expectedStatusText : 'error'
                                    });

   });   // End User Verification
});   // End REST API