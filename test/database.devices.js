var should = require('should');
var flow = require('nimble');
var httpStatus = require('http-status');
var wipe = require('./fixture-helpers/wipe');
var database = require('./fixture-helpers/database');
var DuplicateRecordError = require('../lib/errors').DuplicateRecordError;
var JSendError = require('jsend-utils').JSendError;
var JSendClientError = require('jsend-utils').JSendClientError;

describe("Database", function() {
   var user1 = require('./fixtures/user1.json');
   var user2 = require('./fixtures/user2.json');
   var product4 = require('./fixtures/product4.json');

   before(function(initDone) {
      flow.series(
            [
               wipe.wipeAllData,
               function(done) {
                  // insert the user and remember the id
                  database.insertUser(user1, function(err, result) {
                     if (err) {
                        return done(err);
                     }

                     user1.id = result.insertId;
                     done();
                  });
               },
               function(done) {
                  // insert the user and remember the id
                  database.insertUser(user2, function(err, result) {
                     if (err) {
                        return done(err);
                     }

                     user2.id = result.insertId;
                     done();
                  });
               },
               function(done) {
                  // insert the product and remember the id
                  database.insertProduct(product4, function(err, result) {
                     if (err) {
                        return done(err);
                     }

                     product4.id = result.insertId;
                     done();
                  });
               }
            ],
            initDone
      );
   });

   describe("Devices", function() {
      var device5 = require('./fixtures/device5.json');

      describe("Create", function() {

         it("Should be able to create a device", function(done) {
            global.db.devices.create(device5, product4.id, user1.id, function(err, device) {
               should.not.exist(err);
               should.exist(device);

               device.should.have.property('insertId');
               device.should.have.property('serialNumber', device5.serialNumber);

               // remember the insert ID
               device5.id = device.insertId;

               done();
            });
         });

         it("Should be able to create the same device, but for a different user", function(done) {
            global.db.devices.create(device5, product4.id, user2.id, function(err, device) {
               should.not.exist(err);
               should.exist(device);

               device.should.have.property('insertId');
               device.should.have.property('serialNumber', device5.serialNumber);

               done();
            });
         });

         it("Should fail to create a duplicate device for the same user", function(done) {
            global.db.devices.create(device5, product4.id, user1.id, function(err, device) {
               should.exist(err);
               should.not.exist(device);

               err.should.be.an.instanceOf(DuplicateRecordError);
               err.should.have.property("data");
               err.data.should.have.property("code", "ER_DUP_ENTRY");

               done();
            });
         });

      });   // End Create

      describe("Find", function() {
         it("Should be able to find a device by ID and user ID", function(done) {
            global.db.devices.findByIdForUser(device5.id, user1.id, null, function(err, device) {
               should.not.exist(err);
               should.exist(device);

               device.should.have.properties({
                                                "id" : device5.id,
                                                "serialNumber" : device5.serialNumber,
                                                "productId" : product4.id,
                                                "userId" : user1.id
                                             });
               device.should.have.properties('created', 'modified');

               done();
            });
         });

         it("Should fail to find a device by ID and user ID if the device ID is wrong", function(done) {
            global.db.devices.findByIdForUser(-1, user1.id, null, function(err, device) {
               should.not.exist(err);
               should.not.exist(device);

               done();
            });
         });

         it("Should fail to find a device by ID and user ID if the user ID is wrong", function(done) {
            global.db.devices.findByIdForUser(device5.id, -1, null, function(err, device) {
               should.exist(err);
               should.not.exist(device);

               err.should.be.an.instanceOf(JSendError);
               err.should.be.an.instanceOf(JSendClientError);
               err.should.have.property('data');
               err.data.should.have.properties({
                                                  code : httpStatus.FORBIDDEN,
                                                  status : 'error'
                                               });

               done();
            });
         });

         it("Should be able to find a device by product ID, serial number, and user ID", function(done) {
            global.db.devices.findByProductIdAndSerialNumberForUser(product4.id,
                                                                    device5.serialNumber,
                                                                    user1.id,
                                                                    'id,serialNumber,productId,userId',
                                                                    function(err, device) {
                                                                       if (err) {
                                                                          return done(err);
                                                                       }

                                                                       device.should.have.properties({
                                                                                                        id : device5.id,
                                                                                                        serialNumber : device5.serialNumber,
                                                                                                        productId : product4.id,
                                                                                                        userId : user1.id

                                                                                                     });
                                                                       // shouldn't have these properties since I didn't ask for them
                                                                       device.should.not.have.properties('created', 'modified');

                                                                       done();
                                                                    });
         });

      });   // End Find

   });   // End Devices
});   // End Database