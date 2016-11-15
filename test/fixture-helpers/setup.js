// sanity check: make sure we're running in test mode!
if (!require('run-mode').isTest()) {
   console.log("FATAL ERROR: the setup fixture library may only be used in the 'test' Node environment (NODE_ENV=test). Aborting.");
   process.exit(1);
}

var should = require('should');
var superagent = require('superagent-ls');
var httpStatus = require('http-status');
var database = require('./database');
var createRandomHexToken = require('../../lib/token').createRandomHexToken;
var trimAndCopyPropertyIfNonEmpty = require('../../lib/objectUtils').trimAndCopyPropertyIfNonEmpty;
var Query2Query = require('query2query');
var feedsQuery2query = require('../../models/feeds-query2query');
var qs = require('qs');

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
module.exports.authenticateUser = function(user, callback) {
   module.exports.authenticateUserWithClient(user, config.get("esdrClient"), callback);
};

// get an OAuth2 access token for this user (auth'd against the given client) and save it to the given user object
module.exports.authenticateUserWithClient = function(user, client, callback) {
   superagent
         .post(ESDR_OAUTH_ROOT_URL)
         .send({
                  grant_type : "password",
                  client_id : client.clientName,
                  client_secret : client.clientSecret,
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

// create the feed and save the database id to the given device object
module.exports.createFeed = function(feed, callback) {
   if (typeof feed.apiKey === 'undefined') {
      feed.apiKey = createRandomHexToken(32);
   }

   if (typeof feed.apiKeyReadOnly === 'undefined') {
      feed.apiKeyReadOnly = createRandomHexToken(32);
   }

   if (typeof feed.channelSpecs === 'undefined') {
      console.log("ERROR: setup.createFeed(): Cannot insert feed because the channelSpecs field is undefined! Aborting.");
      process.exit(1);
   }

   database.insertFeed(feed, function(err, result) {
      if (err) {
         return callback(err);
      }
      feed.id = result.insertId;
      callback(null, feed.id);
   });
};

module.exports.deleteFeed = function(feedId, callback) {
   database.deleteFeed(feedId, callback);
};

// create the multifeed and save the database id to the given device object
module.exports.createMultifeed = function(multifeed, callback) {

   var mf = {
      userId : multifeed.userId,
      spec : multifeed.spec,
      querySpec : "" // created below...
   };
   trimAndCopyPropertyIfNonEmpty(multifeed, mf, "name");
   if (typeof multifeed.name === 'undefined' || multifeed.name == null) {
      mf.name = createRandomHexToken(32);
   }

   // convert the spec to a more usable form for SQL queries, so we don't have to rebuild this for every request
   var querySpecParts = [];
   for (var i = 0; i < multifeed.spec.length; i++) {
      var specItem = multifeed.spec[i];
      var miniQueryString = qs.parse(specItem.feeds);
      try {
         var result = feedsQuery2query.parseSync(miniQueryString);
         if (result.where != null && result.where.length > 0) {
            querySpecParts.push({
                                   feeds : {
                                      where : result.where,
                                      values : result.whereValues
                                   },
                                   channels : specItem.channels
                                });
         }
         else {
            return callback(new ValidationError(miniQueryString, "No where clause found"));
         }
      }
      catch (e) {
         return callback(e);
      }
   }

   // need to stringify the spec and querySpec objects for storage in the DB
   mf.spec = JSON.stringify(multifeed.spec);
   mf.querySpec = JSON.stringify(querySpecParts);

   database.insertMultifeed(mf, function(err, result) {
      if (err) {
         console.log(JSON.stringify(err, null, 3));
         return callback(err);
      }
      multifeed.id = result.insertId;
      multifeed.name = mf.name;
      callback(null, multifeed.id);
   });
};
