const should = require('should');
const flow = require('nimble');
const axios = require("axios");
const httpStatus = require('http-status');
const requireNew = require('require-new');
const wipe = require('./fixture-helpers/wipe');
const setup = require('./fixture-helpers/setup');
const createAuthorizationHeader = require('./fixture-helpers/test-utils').createAuthorizationHeader;

const config = require('../config');

const ESDR_API_ROOT_URL = config.get("esdr:apiRootUrl");
const ESDR_FEEDS_API_URL = ESDR_API_ROOT_URL + "/feeds";

describe("REST API", function() {
   const user1 = requireNew('./fixtures/user1.json');
   const user2 = requireNew('./fixtures/user2.json');
   const product1 = requireNew('./fixtures/product1.json');
   const product2 = requireNew('./fixtures/product2.json');
   const device1User1 = requireNew('./fixtures/device1.json');
   const device2User1 = requireNew('./fixtures/device2.json');
   const device2User2 = requireNew('./fixtures/device3.json');
   const feed1 = requireNew('./fixtures/feed1.json'); // indoor, public, "Newell Simon 3rd Floor Bathroom (feed1.json)"
   const feed2 = requireNew('./fixtures/feed4.json'); // outdoor, private, "Front Porch (feed4.json)"

   before(function(initDone) {
      flow.series(
            [
               wipe.wipeAllData,
               function(done) {
                  setup.createUser(user1, done);
               },
               function(done) {
                  setup.verifyUser(user1, done);
               },
               function(done) {
                  setup.authenticateUser(user1, done);
               },
               function(done) {
                  setup.createUser(user2, done);
               },
               function(done) {
                  setup.verifyUser(user2, done);
               },
               function(done) {
                  setup.authenticateUser(user2, done);
               },
               function(done) {
                  product1.creatorUserId = user1['id'];
                  setup.createProduct(product1, done);
               },
               function(done) {
                  product2.creatorUserId = user1['id'];
                  setup.createProduct(product2, done);
               },
               function(done) {
                  device1User1.userId = user1['id'];
                  device1User1.productId = product1['id'];
                  setup.createDevice(device1User1, done);
               },
               function(done) {
                  device2User1.userId = user1['id'];
                  device2User1.productId = product2['id'];
                  setup.createDevice(device2User1, done);
               },
               function(done) {
                  device2User2.userId = user2['id'];
                  device2User2.productId = product1['id'];
                  setup.createDevice(device2User2, done);
               },
               function(done) {
                  feed1.userId = user1.id;
                  feed1.deviceId = device1User1.id;
                  feed1.productId = product1.id;
                  feed1.channelSpecs = product1.defaultChannelSpecs;
                  setup.createFeed(feed1, done);
               },
               function(done) {
                  feed2.userId = user1.id;
                  feed2.deviceId = device1User1.id;
                  feed2.productId = product1.id;
                  feed2.channelSpecs = product1.defaultChannelSpecs;
                  setup.createFeed(feed2, done);
               },
            ],
            initDone
      );
   });

   describe("Feeds", function() {
      describe("Patch", function() {

         const checkResponse = async function(test, res) {
            if (test.willDebug) {
               console.log(JSON.stringify(res.data, null, 3));
            }

            res.should.have.property('status', test.expectedHttpStatus);

            if (!test.hasEmptyBody) {

               res.should.have.property('data');
               res.data.should.have.properties({
                                                  code : test.expectedHttpStatus,
                                                  status : test.expectedStatusText
                                               });

               if (typeof test.expectedResponseData !== 'undefined') {
                  if (test.expectedResponseData === null) {
                     res.data.should.have.property('data', null);
                  }
                  else {
                     res.data.should.have.property('data');
                     const expectedResponseData = typeof test.expectedResponseData === 'function' ? test.expectedResponseData() : test.expectedResponseData;
                     res.data.data.should.have.properties(expectedResponseData);
                  }
               }
            }

            if (typeof test.additionalTests === 'function') {
               await test.additionalTests(res.data);
            }
         };

         const executeTest = function(test) {
            it(test.description, async function() {
               const config = (typeof test.config === 'function' ? test.config() : null);
               await axios.patch(test.url(), test.data, config)
                     .then(async function(res) {
                        await checkResponse(test, res);
                     })
                     .catch(async function(e) {
                        await checkResponse(test, e.response);
                     });
            });
         };

         [
            {
               description : "Patch should fail with no authorization",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {}
               },
               data : [],
               expectedHttpStatus : httpStatus.UNAUTHORIZED,
               expectedStatusText : 'error',
               hasEmptyBody : true,
               willDebug : false
            },
            {
               description : "Patch should fail with invalid authorization (invalid auth header token)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { Authorization : "Bearer bogus" }
                  }
               },
               data : [],
               expectedHttpStatus : httpStatus.UNAUTHORIZED,
               expectedStatusText : 'error',
               hasEmptyBody : true,
               willDebug : false
            },
            {
               description : "Patch should fail with apikey authorization (apiKey in header)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { FeedApiKey : feed1.apiKey }
                  }
               },
               data : [],
               expectedHttpStatus : httpStatus.UNAUTHORIZED,
               expectedStatusText : 'error',
               hasEmptyBody : true,
               willDebug : false
            },
            {
               description : "Patch should fail with apikey authorization (apiKeyReadOnly in header)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { FeedApiKey : feed1.apiKeyReadOnly }
                  }
               },
               data : [],
               expectedHttpStatus : httpStatus.UNAUTHORIZED,
               expectedStatusText : 'error',
               hasEmptyBody : true,
               willDebug : false
            },
            {
               description : "Patch should fail with apikey authorization (apiKey in URL)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.apiKey;
               },
               data : [],
               expectedHttpStatus : httpStatus.UNAUTHORIZED,
               expectedStatusText : 'error',
               hasEmptyBody : true,
               willDebug : false
            },
            {
               description : "Patch should fail with apikey authorization (apiKeyReadOnly in URL)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.apiKeyReadOnly;
               },
               data : [],
               expectedHttpStatus : httpStatus.UNAUTHORIZED,
               expectedStatusText : 'error',
               hasEmptyBody : true,
               willDebug : false
            },
            {
               description : "Patch should fail with incorrect authorization (user 2 cannot patch feed owned by user 1)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user2.accessToken) }
                  }
               },
               data : [],
               expectedHttpStatus : httpStatus.FORBIDDEN,
               expectedStatusText : 'error',
               hasEmptyBody : true,
               willDebug : false
            },
            {
               description : "Patch should fail with a document containing no operations",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [],
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "message" : "validation failed",
                  "errors" : [
                     {
                        "keyword" : "minItems",
                        "dataPath" : "",
                        "schemaPath" : "#/minItems",
                        "params" : {
                           "limit" : 1
                        },
                        "message" : "should NOT have fewer than 1 items"
                     }
                  ],
                  "validation" : true,
               },
               willDebug : false
            },
            {
               description : "Patch should fail if the operation is missing one or more required params (all)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  {},
               ],
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "message" : "validation failed",
                  "errors" : [
                     {
                        "keyword" : "required",
                        "dataPath" : "[0]",
                        "schemaPath" : "#/items/required",
                        "params" : {
                           "missingProperty" : "value"
                        },
                        "message" : "should have required property 'value'"
                     },
                     {
                        "keyword" : "required",
                        "dataPath" : "[0]",
                        "schemaPath" : "#/items/required",
                        "params" : {
                           "missingProperty" : "op"
                        },
                        "message" : "should have required property 'op'"
                     },
                     {
                        "keyword" : "required",
                        "dataPath" : "[0]",
                        "schemaPath" : "#/items/required",
                        "params" : {
                           "missingProperty" : "path"
                        },
                        "message" : "should have required property 'path'"
                     }
                  ],
                  "validation" : true,
               },
            },
            {
               description : "Patch should fail if the operation is missing one or more required params (path, value)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  { op : "replace" },
               ],
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "message" : "validation failed",
                  "errors" : [
                     {
                        "keyword" : "required",
                        "dataPath" : "[0]",
                        "schemaPath" : "#/items/required",
                        "params" : {
                           "missingProperty" : "value"
                        },
                        "message" : "should have required property 'value'"
                     },
                     {
                        "keyword" : "required",
                        "dataPath" : "[0]",
                        "schemaPath" : "#/items/required",
                        "params" : {
                           "missingProperty" : "path"
                        },
                        "message" : "should have required property 'path'"
                     }
                  ],
                  "validation" : true,
               },
            },
            {
               description : "Patch should fail if the operation is missing one or more required params (op, value)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  { path : "/name" },
               ],
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "message" : "validation failed",
                  "errors" : [
                     {
                        "keyword" : "required",
                        "dataPath" : "[0]",
                        "schemaPath" : "#/items/required",
                        "params" : {
                           "missingProperty" : "value"
                        },
                        "message" : "should have required property 'value'"
                     },
                     {
                        "keyword" : "required",
                        "dataPath" : "[0]",
                        "schemaPath" : "#/items/required",
                        "params" : {
                           "missingProperty" : "op"
                        },
                        "message" : "should have required property 'op'"
                     },
                  ],
                  "validation" : true,
               },
            },
            {
               description : "Patch should fail if the operation is missing one or more required params (op, path)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  { value : "the value" },
               ],
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "message" : "validation failed",
                  "errors" : [
                     {
                        "keyword" : "required",
                        "dataPath" : "[0]",
                        "schemaPath" : "#/items/required",
                        "params" : {
                           "missingProperty" : "op"
                        },
                        "message" : "should have required property 'op'"
                     },
                     {
                        "keyword" : "required",
                        "dataPath" : "[0]",
                        "schemaPath" : "#/items/required",
                        "params" : {
                           "missingProperty" : "path"
                        },
                        "message" : "should have required property 'path'"
                     },
                  ],
                  "validation" : true,
               },
            },
            {
               description : "Patch should fail if the operation is missing one or more required params (op)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  { "path" : "/name", "value" : "this is the new awesome name" },
               ],
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "message" : "validation failed",
                  "errors" : [
                     {
                        "keyword" : "required",
                        "dataPath" : "[0]",
                        "schemaPath" : "#/items/required",
                        "params" : {
                           "missingProperty" : "op"
                        },
                        "message" : "should have required property 'op'"
                     },
                  ],
                  "validation" : true,
               },
            },
            {
               description : "Patch should fail if the operation is missing one or more required params (path)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  { "op" : "replace", "value" : "this is the new awesome name" },
               ],
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "message" : "validation failed",
                  "errors" : [
                     {
                        "keyword" : "required",
                        "dataPath" : "[0]",
                        "schemaPath" : "#/items/required",
                        "params" : {
                           "missingProperty" : "path"
                        },
                        "message" : "should have required property 'path'"
                     }
                  ],
                  "validation" : true,
               },
            },
            {
               description : "Patch should fail if the operation is missing one or more required params (op)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  { "op" : "replace", "path" : "/name", },
               ],
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "message" : "validation failed",
                  "errors" : [
                     {
                        "keyword" : "required",
                        "dataPath" : "[0]",
                        "schemaPath" : "#/items/required",
                        "params" : {
                           "missingProperty" : "value"
                        },
                        "message" : "should have required property 'value'"
                     },
                  ],
                  "validation" : true,
               },
            },
            {
               description : "Patch should fail with an invalid operation (bogus)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  { "op" : "bogus", "path" : "/name", "value" : "this is the new awesome name" },
               ],
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "message" : "validation failed",
                  "errors" : [
                     {
                        "keyword" : "enum",
                        "dataPath" : "[0].op",
                        "schemaPath" : "#/items/properties/op/enum",
                        "params" : {
                           "allowedValues" : [
                              "replace"
                           ]
                        },
                        "message" : "should be equal to one of the allowed values"
                     }
                  ],
               },
            },
            {
               description : "Patch should fail with an invalid operation ('')",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  { "op" : "", "path" : "/name", "value" : "this is the new awesome name" },
               ],
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "message" : "validation failed",
                  "errors" : [
                     {
                        "keyword" : "enum",
                        "dataPath" : "[0].op",
                        "schemaPath" : "#/items/properties/op/enum",
                        "params" : {
                           "allowedValues" : [
                              "replace"
                           ]
                        },
                        "message" : "should be equal to one of the allowed values"
                     }
                  ],
               },
            },
            {
               description : "Patch should fail with an invalid operation (null)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  { "op" : null, "path" : "/name", "value" : "this is the new awesome name" },
               ],
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "message" : "validation failed",
                  "errors" : [
                     {
                        "keyword" : "enum",
                        "dataPath" : "[0].op",
                        "schemaPath" : "#/items/properties/op/enum",
                        "params" : {
                           "allowedValues" : [
                              "replace"
                           ]
                        },
                        "message" : "should be equal to one of the allowed values"
                     }
                  ],
               },
            },
            {
               description : "Patch should fail with an invalid operation ('  replace  ')",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  { "op" : "  replace  ", "path" : "/name", "value" : "this is the new awesome name" },
               ],
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "message" : "validation failed",
                  "errors" : [
                     {
                        "keyword" : "enum",
                        "dataPath" : "[0].op",
                        "schemaPath" : "#/items/properties/op/enum",
                        "params" : {
                           "allowedValues" : [
                              "replace"
                           ]
                        },
                        "message" : "should be equal to one of the allowed values"
                     }
                  ],
               },
            },
            {
               description : "Patch should fail with an invalid path (null)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  { "op" : "replace", "path" : null, "value" : "this is the new awesome name" },
               ],
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "message" : "validation failed",
                  "errors" : [
                     {
                        "keyword" : "enum",
                        "dataPath" : "[0].path",
                        "schemaPath" : "#/items/properties/path/enum",
                        "params" : {
                           "allowedValues" : [
                              "/name",
                              "/latitude",
                              "/longitude",
                              "/isPublic",
                              "/exposure"
                           ]
                        },
                        "message" : "should be equal to one of the allowed values"
                     }
                  ],
               },
            },
            {
               description : "Patch should fail with an invalid path ('')",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  { "op" : "replace", "path" : "", "value" : "this is the new awesome name" },
               ],
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "message" : "validation failed",
                  "errors" : [
                     {
                        "keyword" : "enum",
                        "dataPath" : "[0].path",
                        "schemaPath" : "#/items/properties/path/enum",
                        "params" : {
                           "allowedValues" : [
                              "/name",
                              "/latitude",
                              "/longitude",
                              "/isPublic",
                              "/exposure"
                           ]
                        },
                        "message" : "should be equal to one of the allowed values"
                     }
                  ],
               },
            },
            {
               description : "Patch should fail with an invalid path (bogus)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  { "op" : "replace", "path" : "bogus", "value" : "this is the new awesome name" },
               ],
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "message" : "validation failed",
                  "errors" : [
                     {
                        "keyword" : "enum",
                        "dataPath" : "[0].path",
                        "schemaPath" : "#/items/properties/path/enum",
                        "params" : {
                           "allowedValues" : [
                              "/name",
                              "/latitude",
                              "/longitude",
                              "/isPublic",
                              "/exposure"
                           ]
                        },
                        "message" : "should be equal to one of the allowed values"
                     }
                  ],
               },
            },
            {
               description : "Patch should fail with an invalid path (name)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  { "op" : "replace", "path" : "name", "value" : "this is the new awesome name" },
               ],
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "message" : "validation failed",
                  "errors" : [
                     {
                        "keyword" : "enum",
                        "dataPath" : "[0].path",
                        "schemaPath" : "#/items/properties/path/enum",
                        "params" : {
                           "allowedValues" : [
                              "/name",
                              "/latitude",
                              "/longitude",
                              "/isPublic",
                              "/exposure"
                           ]
                        },
                        "message" : "should be equal to one of the allowed values"
                     }
                  ],
               },
            },
            {
               description : "Patch should fail with an invalid name value (empty string)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  { "op" : "replace", "path" : "/name", "value" : "" },
               ],
               willDebug : false,
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "/name" : {
                     "message" : "validation failed",
                     "errors" : [
                        {
                           "keyword" : "minLength",
                           "dataPath" : ".value",
                           "schemaPath" : "#/properties/value/minLength",
                           "params" : {
                              "limit" : 1
                           },
                           "message" : "should NOT be shorter than 1 characters"
                        }
                     ],
                     "validation" : true,
                     "ajv" : true
                  }
               },
            },
            {
               description : "Patch should fail with an invalid name value (null)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  { "op" : "replace", "path" : "/name", "value" : null },
               ],
               willDebug : false,
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "/name" : {
                     "message" : "validation failed",
                     "errors" : [
                        {
                           "keyword" : "type",
                           "dataPath" : ".value",
                           "schemaPath" : "#/properties/value/type",
                           "params" : {
                              "type" : "string"
                           },
                           "message" : "should be string"
                        }
                     ],
                     "validation" : true,
                     "ajv" : true
                  }
               },
            },
            {
               description : "Patch should fail with an invalid name value (> 255 characters)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  {
                     "op" : "replace",
                     "path" : "/name",
                     "value" : "012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789"
                  },
               ],
               willDebug : false,
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "/name" : {
                     "message" : "validation failed",
                     "errors" : [
                        {
                           "keyword" : "maxLength",
                           "dataPath" : ".value",
                           "schemaPath" : "#/properties/value/maxLength",
                           "params" : {
                              "limit" : 255
                           },
                           "message" : "should NOT be longer than 255 characters"
                        }
                     ],
                     "validation" : true,
                     "ajv" : true
                  }
               },
            },
            {
               description : "Patch should fail with an invalid latitude value (empty string)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  {
                     "op" : "replace",
                     "path" : "/latitude",
                     "value" : ""
                  },
               ],
               willDebug : false,
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "/latitude" : {
                     "message" : "validation failed",
                     "errors" : [
                        {
                           "keyword" : "type",
                           "dataPath" : ".value",
                           "schemaPath" : "#/properties/value/type",
                           "params" : {
                              "type" : "number,null"
                           },
                           "message" : "should be number,null"
                        }
                     ],
                     "validation" : true,
                     "ajv" : true
                  }
               },
            },
            {
               description : "Patch should fail with an invalid latitude value (string)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  {
                     "op" : "replace",
                     "path" : "/latitude",
                     "value" : "bogus"
                  },
               ],
               willDebug : false,
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "/latitude" : {
                     "message" : "validation failed",
                     "errors" : [
                        {
                           "keyword" : "type",
                           "dataPath" : ".value",
                           "schemaPath" : "#/properties/value/type",
                           "params" : {
                              "type" : "number,null"
                           },
                           "message" : "should be number,null"
                        }
                     ],
                     "validation" : true,
                     "ajv" : true
                  }
               },
            },
            {
               description : "Patch should fail with an invalid latitude value (< -90)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  {
                     "op" : "replace",
                     "path" : "/latitude",
                     "value" : -900
                  },
               ],
               willDebug : false,
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "/latitude" : {
                     "message" : "validation failed",
                     "errors" : [
                        {
                           "keyword" : "minimum",
                           "dataPath" : ".value",
                           "schemaPath" : "#/properties/value/minimum",
                           "params" : {
                              "comparison" : ">=",
                              "limit" : -90,
                              "exclusive" : false
                           },
                           "message" : "should be >= -90"
                        }
                     ],
                     "validation" : true,
                     "ajv" : true
                  }
               },
            },
            {
               description : "Patch should fail with an invalid latitude value (> 90)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  {
                     "op" : "replace",
                     "path" : "/latitude",
                     "value" : 4242
                  },
               ],
               willDebug : false,
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "/latitude" : {
                     "message" : "validation failed",
                     "errors" : [
                        {
                           "keyword" : "maximum",
                           "dataPath" : ".value",
                           "schemaPath" : "#/properties/value/maximum",
                           "params" : {
                              "comparison" : "<=",
                              "limit" : 90,
                              "exclusive" : false
                           },
                           "message" : "should be <= 90"
                        }
                     ],
                     "validation" : true,
                     "ajv" : true
                  }
               },
            },
            {
               description : "Patch should fail with an invalid longitude value (empty string)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  {
                     "op" : "replace",
                     "path" : "/longitude",
                     "value" : ""
                  },
               ],
               willDebug : false,
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "/longitude" : {
                     "message" : "validation failed",
                     "errors" : [
                        {
                           "keyword" : "type",
                           "dataPath" : ".value",
                           "schemaPath" : "#/properties/value/type",
                           "params" : {
                              "type" : "number,null"
                           },
                           "message" : "should be number,null"
                        }
                     ],
                     "validation" : true,
                     "ajv" : true
                  }
               },
            },
            {
               description : "Patch should fail with an invalid longitude value (string)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  {
                     "op" : "replace",
                     "path" : "/longitude",
                     "value" : "bogus"
                  },
               ],
               willDebug : false,
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "/longitude" : {
                     "message" : "validation failed",
                     "errors" : [
                        {
                           "keyword" : "type",
                           "dataPath" : ".value",
                           "schemaPath" : "#/properties/value/type",
                           "params" : {
                              "type" : "number,null"
                           },
                           "message" : "should be number,null"
                        }
                     ],
                     "validation" : true,
                     "ajv" : true
                  }
               },
            },
            {
               description : "Patch should fail with an invalid longitude value (< -180)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  {
                     "op" : "replace",
                     "path" : "/longitude",
                     "value" : -4242
                  },
               ],
               willDebug : false,
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "/longitude" : {
                     "message" : "validation failed",
                     "errors" : [
                        {
                           "keyword" : "minimum",
                           "dataPath" : ".value",
                           "schemaPath" : "#/properties/value/minimum",
                           "params" : {
                              "comparison" : ">=",
                              "limit" : -180,
                              "exclusive" : false
                           },
                           "message" : "should be >= -180"
                        }
                     ],
                     "validation" : true,
                     "ajv" : true
                  }
               },
            },
            {
               description : "Patch should fail with an invalid longitude value (> 180)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  {
                     "op" : "replace",
                     "path" : "/longitude",
                     "value" : 4242
                  },
               ],
               willDebug : false,
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "/longitude" : {
                     "message" : "validation failed",
                     "errors" : [
                        {
                           "keyword" : "maximum",
                           "dataPath" : ".value",
                           "schemaPath" : "#/properties/value/maximum",
                           "params" : {
                              "comparison" : "<=",
                              "limit" : 180,
                              "exclusive" : false
                           },
                           "message" : "should be <= 180"
                        }
                     ],
                     "validation" : true,
                     "ajv" : true
                  }
               },
            },
            {
               description : "Patch should fail with an invalid exposure value (empty string)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  {
                     "op" : "replace",
                     "path" : "/exposure",
                     "value" : ""
                  },
               ],
               willDebug : false,
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "/exposure" : {
                     "message" : "validation failed",
                     "errors" : [
                        {
                           "keyword" : "enum",
                           "dataPath" : ".value",
                           "schemaPath" : "#/properties/value/enum",
                           "params" : {
                              "allowedValues" : [
                                 "indoor",
                                 "outdoor",
                                 "virtual"
                              ]
                           },
                           "message" : "should be equal to one of the allowed values"
                        }
                     ],
                     "validation" : true,
                     "ajv" : true
                  }
               },
            },
            {
               description : "Patch should fail with an invalid exposure value (string other than 'indoor', 'outdoor', 'virtual': 'bogus')",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  {
                     "op" : "replace",
                     "path" : "/exposure",
                     "value" : "bogus"
                  },
               ],
               willDebug : false,
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "/exposure" : {
                     "message" : "validation failed",
                     "errors" : [
                        {
                           "keyword" : "enum",
                           "dataPath" : ".value",
                           "schemaPath" : "#/properties/value/enum",
                           "params" : {
                              "allowedValues" : [
                                 "indoor",
                                 "outdoor",
                                 "virtual"
                              ]
                           },
                           "message" : "should be equal to one of the allowed values"
                        }
                     ],
                     "validation" : true,
                     "ajv" : true
                  }
               },
            },
            {
               description : "Patch should fail with an invalid exposure value (string other than 'indoor', 'outdoor', 'virtual': 'INDOOR')",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  {
                     "op" : "replace",
                     "path" : "/exposure",
                     "value" : "INDOOR"
                  },
               ],
               willDebug : false,
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "/exposure" : {
                     "message" : "validation failed",
                     "errors" : [
                        {
                           "keyword" : "enum",
                           "dataPath" : ".value",
                           "schemaPath" : "#/properties/value/enum",
                           "params" : {
                              "allowedValues" : [
                                 "indoor",
                                 "outdoor",
                                 "virtual"
                              ]
                           },
                           "message" : "should be equal to one of the allowed values"
                        }
                     ],
                     "validation" : true,
                     "ajv" : true
                  }
               },
            },
            {
               description : "Patch should fail with an invalid exposure value (null)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  {
                     "op" : "replace",
                     "path" : "/exposure",
                     "value" : null
                  },
               ],
               willDebug : false,
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "/exposure" : {
                     "message" : "validation failed",
                     "errors" : [
                        {
                           "keyword" : "enum",
                           "dataPath" : ".value",
                           "schemaPath" : "#/properties/value/enum",
                           "params" : {
                              "allowedValues" : [
                                 "indoor",
                                 "outdoor",
                                 "virtual"
                              ]
                           },
                           "message" : "should be equal to one of the allowed values"
                        }
                     ],
                     "validation" : true,
                     "ajv" : true
                  }
               },
            },
            {
               description : "Patch should fail with an invalid exposure value (42)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  {
                     "op" : "replace",
                     "path" : "/exposure",
                     "value" : 42
                  },
               ],
               willDebug : false,
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "/exposure" : {
                     "message" : "validation failed",
                     "errors" : [
                        {
                           "keyword" : "enum",
                           "dataPath" : ".value",
                           "schemaPath" : "#/properties/value/enum",
                           "params" : {
                              "allowedValues" : [
                                 "indoor",
                                 "outdoor",
                                 "virtual"
                              ]
                           },
                           "message" : "should be equal to one of the allowed values"
                        }
                     ],
                     "validation" : true,
                     "ajv" : true
                  }
               },
            },
            {
               description : "Patch should fail with an invalid isPublic value (null)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  {
                     "op" : "replace",
                     "path" : "/isPublic",
                     "value" : null
                  },
               ],
               willDebug : false,
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "/isPublic" : {
                     "message" : "validation failed",
                     "errors" : [
                        {
                           "keyword" : "type",
                           "dataPath" : ".value",
                           "schemaPath" : "#/properties/value/type",
                           "params" : {
                              "type" : "boolean"
                           },
                           "message" : "should be boolean"
                        }
                     ],
                     "validation" : true,
                     "ajv" : true
                  }
               },
            },
            {
               description : "Patch should fail with an invalid isPublic value (42)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  {
                     "op" : "replace",
                     "path" : "/isPublic",
                     "value" : 42
                  },
               ],
               willDebug : false,
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "/isPublic" : {
                     "message" : "validation failed",
                     "errors" : [
                        {
                           "keyword" : "type",
                           "dataPath" : ".value",
                           "schemaPath" : "#/properties/value/type",
                           "params" : {
                              "type" : "boolean"
                           },
                           "message" : "should be boolean"
                        }
                     ],
                     "validation" : true,
                     "ajv" : true
                  }
               },
            },
            {
               description : "Patch should fail with an invalid isPublic value (1)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  {
                     "op" : "replace",
                     "path" : "/isPublic",
                     "value" : 1
                  },
               ],
               willDebug : false,
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "/isPublic" : {
                     "message" : "validation failed",
                     "errors" : [
                        {
                           "keyword" : "type",
                           "dataPath" : ".value",
                           "schemaPath" : "#/properties/value/type",
                           "params" : {
                              "type" : "boolean"
                           },
                           "message" : "should be boolean"
                        }
                     ],
                     "validation" : true,
                     "ajv" : true
                  }
               },
            },
            {
               description : "Patch should fail with an invalid isPublic value (0)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  {
                     "op" : "replace",
                     "path" : "/isPublic",
                     "value" : 0
                  },
               ],
               willDebug : false,
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "/isPublic" : {
                     "message" : "validation failed",
                     "errors" : [
                        {
                           "keyword" : "type",
                           "dataPath" : ".value",
                           "schemaPath" : "#/properties/value/type",
                           "params" : {
                              "type" : "boolean"
                           },
                           "message" : "should be boolean"
                        }
                     ],
                     "validation" : true,
                     "ajv" : true
                  }
               },
            },
            {
               description : "Patch should fail with an invalid isPublic value ('true')",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  {
                     "op" : "replace",
                     "path" : "/isPublic",
                     "value" : "true"
                  },
               ],
               willDebug : false,
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "/isPublic" : {
                     "message" : "validation failed",
                     "errors" : [
                        {
                           "keyword" : "type",
                           "dataPath" : ".value",
                           "schemaPath" : "#/properties/value/type",
                           "params" : {
                              "type" : "boolean"
                           },
                           "message" : "should be boolean"
                        }
                     ],
                     "validation" : true,
                     "ajv" : true
                  }
               },
            },
            {
               description : "Patch should fail with an invalid isPublic value ('false')",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  {
                     "op" : "replace",
                     "path" : "/isPublic",
                     "value" : "false"
                  },
               ],
               willDebug : false,
               expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
               expectedStatusText : 'error',
               expectedResponseData : {
                  "/isPublic" : {
                     "message" : "validation failed",
                     "errors" : [
                        {
                           "keyword" : "type",
                           "dataPath" : ".value",
                           "schemaPath" : "#/properties/value/type",
                           "params" : {
                              "type" : "boolean"
                           },
                           "message" : "should be boolean"
                        }
                     ],
                     "validation" : true,
                     "ajv" : true
                  }
               },
            },

            {
               description : "Should be able to patch a feed name",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  // note that ops with invalid values that are superceded by a valid one are ignored
                  { "op" : "replace", "path" : "/name", "value" : "" },                // invalid
                  { "op" : "replace", "path" : "/name", "value" : "my cool feed" },    // valid
               ],
               willDebug : false,
               expectedHttpStatus : httpStatus.OK,
               expectedStatusText : 'success',
               expectedResponseData : function() {
                  return {
                     "feedId" : feed1.id,
                     "patched" : {
                        "/name" : "my cool feed",
                     }
                  }
               },
               additionalTests : async function() {
                  // read the feed and verify the patch worked
                  await axios.get(ESDR_FEEDS_API_URL + "/" + feed1.id + "?fields=name,exposure,isPublic,latitude,longitude")
                        .then(res => {
                           res.should.have.property('data');
                           res.data.should.have.property('data');
                           res.data.data.should.have.properties({
                                                                   name : "my cool feed",
                                                                   exposure : "indoor",
                                                                   isPublic : 1,
                                                                   latitude : 40.443403,
                                                                   longitude : -79.94564
                                                                });
                        });
               }
            },
            {
               description : "Should be able to patch a feed exposure",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  { "op" : "replace", "path" : "/exposure", "value" : "outdoor" },
               ],
               willDebug : false,
               expectedHttpStatus : httpStatus.OK,
               expectedStatusText : 'success',
               expectedResponseData : function() {
                  return {
                     "feedId" : feed1.id,
                     "patched" : {
                        "/exposure" : "outdoor",
                     }
                  }
               },
               additionalTests : async function() {
                  // read the feed and verify the patch worked
                  await axios.get(ESDR_FEEDS_API_URL + "/" + feed1.id + "?fields=name,exposure,isPublic,latitude,longitude")
                        .then(res => {
                           res.should.have.property('data');
                           res.data.should.have.property('data');
                           res.data.data.should.have.properties({
                                                                   name : "my cool feed",
                                                                   exposure : "outdoor",
                                                                   isPublic : 1,
                                                                   latitude : 40.443403,
                                                                   longitude : -79.94564
                                                                });
                        });
               }
            },
            {
               description : "Should be able to patch latitude and longitude (null,null)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  { "op" : "replace", "path" : "/latitude", "value" : null },
                  { "op" : "replace", "path" : "/longitude", "value" : null },
               ],
               willDebug : false,
               expectedHttpStatus : httpStatus.OK,
               expectedStatusText : 'success',
               expectedResponseData : function() {
                  return {
                     "feedId" : feed1.id,
                     "patched" : {
                        "/latitude" : null,
                        "/longitude" : null,
                     }
                  }
               },
               additionalTests : async function() {
                  // read the feed and verify the patch worked
                  await axios.get(ESDR_FEEDS_API_URL + "/" + feed1.id + "?fields=name,exposure,isPublic,latitude,longitude")
                        .then(res => {
                           res.should.have.property('data');
                           res.data.should.have.property('data');
                           res.data.data.should.have.properties({
                                                                   name : "my cool feed",
                                                                   exposure : "outdoor",
                                                                   isPublic : 1,
                                                                   latitude : null,
                                                                   longitude : null
                                                                });
                        });
               }
            },
            {
               description : "Should be able to patch latitude and longitude (50.676109, -120.340836)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  { "op" : "replace", "path" : "/latitude", "value" : 50.676109 },
                  { "op" : "replace", "path" : "/longitude", "value" : -120.340836 },
               ],
               willDebug : false,
               expectedHttpStatus : httpStatus.OK,
               expectedStatusText : 'success',
               expectedResponseData : function() {
                  return {
                     "feedId" : feed1.id,
                     "patched" : {
                        "/latitude" : 50.676109,
                        "/longitude" : -120.340836,
                     }
                  }
               },
               additionalTests : async function() {
                  // read the feed and verify the patch worked
                  await axios.get(ESDR_FEEDS_API_URL + "/" + feed1.id + "?fields=name,exposure,isPublic,latitude,longitude")
                        .then(res => {
                           res.should.have.property('data');
                           res.data.should.have.property('data');
                           res.data.data.should.have.properties({
                                                                   name : "my cool feed",
                                                                   exposure : "outdoor",
                                                                   isPublic : 1,
                                                                   latitude : 50.676109,
                                                                   longitude : -120.340836
                                                                });
                        });
               }
            },
            {
               description : "Should be able to patch a feed isPublic",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  { "op" : "replace", "path" : "/isPublic", "value" : false },
                  { "op" : "replace", "path" : "/name", "value" : "my cool private feed" },
               ],
               willDebug : false,
               expectedHttpStatus : httpStatus.OK,
               expectedStatusText : 'success',
               expectedResponseData : function() {
                  return {
                     "feedId" : feed1.id,
                     "patched" : {
                        "/name" : "my cool private feed",
                        "/isPublic" : false,
                     }
                  }
               },
               additionalTests : async function() {
                  // read the feed WITHOUT authorization to verify that it's now private and thus can't be read
                  await axios.get(ESDR_FEEDS_API_URL + "/" + feed1.id + "?fields=name,exposure,isPublic,latitude,longitude")
                        .catch(e => {
                           e.should.have.property('response');
                           e.response.should.have.property('data');
                           e.response.data.should.have.properties({
                                                                     code : 401,
                                                                     status : 'error',
                                                                     data : null,
                                                                     message : 'Authentication required.'
                                                                  });
                        });

                  // now read again WITH authorization
                  await axios.get(ESDR_FEEDS_API_URL + "/" + feed1.id + "?fields=name,exposure,isPublic,latitude,longitude",
                                  {
                                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                                  })
                        .then(res => {
                           res.should.have.property('data');
                           res.data.should.have.property('data');
                           res.data.data.should.have.properties({
                                                                   name : "my cool private feed",
                                                                   exposure : "outdoor",
                                                                   isPublic : 0,
                                                                   latitude : 50.676109,
                                                                   longitude : -120.340836
                                                                });
                        });
               }
            },
            {
               description : "Should be able to patch a feed with multiple operations",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id;
               },
               config : function() {
                  return {
                     headers : { ...createAuthorizationHeader(user1.accessToken) }
                  }
               },
               data : [
                  // order of operations doesn't matter...it's just last one for each path wins
                  { "op" : "replace", "path" : "/latitude", "value" : 42 },            // valid
                  { "op" : "replace", "path" : "/latitude", "value" : "" },            // invalid
                  { "op" : "replace", "path" : "/latitude", "value" : "40.440624" },   // invalid

                  { "op" : "replace", "path" : "/longitude", "value" : -42 },          // valid
                  { "op" : "replace", "path" : "/longitude", "value" : "" },           // invalid
                  { "op" : "replace", "path" : "/longitude", "value" : "-79.995888" }, // invalid

                  { "op" : "replace", "path" : "/isPublic", "value" : 42 },            // invalid
                  { "op" : "replace", "path" : "/isPublic", "value" : "X" },           // invalid
                  { "op" : "replace", "path" : "/isPublic", "value" : true },          // valid

                  { "op" : "replace", "path" : "/exposure", "value" : 'bogus' },       // invalid
                  { "op" : "replace", "path" : "/exposure", "value" : 'indoor' },      // valid

                  { "op" : "replace", "path" : "/name", "value" : [] },                // invalid
                  { "op" : "replace", "path" : "/name", "value" : "The best ever public feed" },   // valid

                  { "op" : "replace", "path" : "/longitude", "value" : -79.995888 },   // valid
                  { "op" : "replace", "path" : "/latitude", "value" : 40.440624 },     // valid
               ],
               willDebug : false,
               expectedHttpStatus : httpStatus.OK,
               expectedStatusText : 'success',
               expectedResponseData : function() {
                  return {
                     "feedId" : feed1.id,
                     "patched" : {
                        "/name" : 'The best ever public feed',
                        "/exposure" : 'indoor',
                        "/isPublic" : true,
                        "/latitude" : 40.440624,
                        "/longitude" : -79.995888,
                     }
                  }
               },
               additionalTests : async function() {
                  // read the feed WITHOUT authorization to verify that it's now public again
                  await axios.get(ESDR_FEEDS_API_URL + "/" + feed1.id + "?fields=name,exposure,isPublic,latitude,longitude")
                        .then(res => {
                           res.should.have.property('data');
                           res.data.should.have.property('data');
                           res.data.data.should.have.properties({
                                                                   name : "The best ever public feed",
                                                                   exposure : "indoor",
                                                                   isPublic : 1,
                                                                   latitude : 40.440624,
                                                                   longitude : -79.995888
                                                                });
                        });
               }
            },
         ].forEach(executeTest);

      });   // End Patch
   });   // End Feeds
});   // End REST API
