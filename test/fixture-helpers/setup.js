// sanity check: make sure we're running in test mode!
if (!require('run-mode').isTest()) {
   console.log("FATAL ERROR: the setup fixture library may only be used in the 'test' Node environment (NODE_ENV=test). Aborting.");
   process.exit(1);
}

var should = require('should');
var superagent = require('superagent-ls');
var httpStatus = require('http-status');
var database = require('./database');

var config = require('../../config');

var ESDR_OAUTH_ROOT_URL = config.get("esdr:oauthRootUrl");
var ESDR_API_ROOT_URL = config.get("esdr:apiRootUrl");

// create the client and save the database id to the given client object
module.exports.createClient = function(client, callback) {
   database.insertClient(client, function(err, result) {
      if (err) {
         return callback(err);
      }
      client.id = result.insertId;
      callback(null, client.id);
   });
};

// create the user and save the database id to the given user object
module.exports.createUser = function(user, callback) {
   database.insertUser(user, function(err, result) {
      if (err) {
         return callback(err);
      }
      user.id = result.insertId;
      callback(null, user.id);
   });
};

// mark user as verified
module.exports.verifyUser = function(user, callback) {
   superagent
         .put(ESDR_API_ROOT_URL + "/user-verification")
         .send({ token : user.verificationToken })
         .end(callback);
};

// get an OAuth2 access token for this user (auth'd against the ESDR client) and save it to the given user object
module.exports.authentcateUser = function(user, callback) {
   superagent
         .post(ESDR_OAUTH_ROOT_URL)
         .send({
                  grant_type : "password",
                  client_id : config.get("esdrClient:clientName"),
                  client_secret : config.get("esdrClient:clientSecret"),
                  username : user.email,
                  password : user.password
               })
         .end(function(err, res) {
            should.not.exist(err);
            should.exist(res);

            res.should.have.property('status', httpStatus.OK);
            res.should.have.property('body');
            res.body.should.have.properties('access_token', 'refresh_token');
            res.body.should.have.properties({
                                               userId : user.id,
                                               expires_in : config.get("security:tokenLifeSecs"),
                                               token_type : 'Bearer'
                                            });

            // remember the access token
            user.accessToken = res.body.access_token;

            callback(null, user.accessToken);
         });
};

// create the product and save the database id to the given product object
module.exports.createProduct = function(product, callback) {
   database.insertProduct(product, function(err, result) {
      if (err) {
         return callback(err);
      }
      product.id = result.insertId;
      callback(null, product.id);
   });
};

// create the device and save the database id to the given device object
module.exports.createDevice = function(device, callback) {
   database.insertDevice(device, function(err, result) {
      if (err) {
         return callback(err);
      }
      device.id = result.insertId;
      callback(null, device.id);
   });
};
