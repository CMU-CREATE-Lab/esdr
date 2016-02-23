var superagent = require('superagent-ls');
var should = require('should');

var shallowClone = function(obj) {
   if (obj) {
      var clone = {};
      Object.keys(obj).forEach(function(key) {
         clone[key] = obj[key];
      });
      return clone;
   }
   return obj;
};

var executeUploadTest = function(test) {
   it(test.description, function(done) {
      superagent
            .put(typeof test.url === 'function' ? test.url() : test.url)
            .set(typeof test.headers === 'undefined' ? {} : (typeof test.headers === 'function' ? test.headers() : test.headers))
            .send(test.dataToUpload)
            .end(function(err, res) {
               should.not.exist(err);
               should.exist(res);

               if (test.willDebug) {
                  console.log(JSON.stringify(res.body, null, 3));
               }

               res.should.have.property('status', test.expectedHttpStatus);
               if (!test.hasEmptyBody) {

                  res.should.have.property('body');

                  res.body.should.have.properties({
                                                     code : test.expectedHttpStatus,
                                                     status : test.expectedStatusText
                                                  });

                  if (typeof test.expectedResponseData !== 'undefined') {
                     if (test.expectedResponseData == null) {
                        res.body.should.have.property('data', null);
                     }
                     else {
                        res.body.should.have.property('data');
                        res.body.data.should.have.properties(test.expectedResponseData);
                     }
                  }
               }

               done();
            });
   });
};

var createAuthorizationHeader = function(accessToken) {
   var token = typeof accessToken === 'function' ? accessToken() : accessToken;
   var authorization;
   if (typeof token !== 'undefined' && token != null) {
      authorization = {
         Authorization : "Bearer " + token
      };
   }

   return authorization;
};

module.exports.shallowClone = shallowClone;
module.exports.executeUploadTest = executeUploadTest;
module.exports.createAuthorizationHeader = createAuthorizationHeader;