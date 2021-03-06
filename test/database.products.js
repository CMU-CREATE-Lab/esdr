const should = require('should');
const flow = require('nimble');
const requireNew = require('require-new');
const wipe = require('./fixture-helpers/wipe');
const setup = require('./fixture-helpers/setup');
const shallowClone = require('./fixture-helpers/test-utils').shallowClone;
const DuplicateRecordError = require('../lib/errors').DuplicateRecordError;
const ValidationError = require('../lib/errors').ValidationError;

describe("Database", function() {
   const user1 = requireNew('./fixtures/user1.json');

   before(function(initDone) {
      flow.series(
            [
               wipe.wipeAllData,
               function(done) {
                  setup.createUser(user1, done);
               }
            ],
            initDone
      );
   });

   describe("Products", function() {

      const product4 = requireNew('./fixtures/product4.json');
      const product5 = requireNew('./fixtures/product5.json');

      describe("Create", function() {

         it("Should be able to create a product with a null creator", function(done) {
            global.db.products.create(product4, null, function(err, product) {
               should.not.exist(err);
               should.exist(product);

               product.should.have.property('insertId');
               product.should.have.property('name', product4['name']);

               // remember the insert ID
               product4['id'] = product.insertId;

               done();
            });
         });

         it("Should fail to create a product with a name that doesn't contain at least one letter", function(done) {
            const invalidProduct = shallowClone(product4);
            invalidProduct['name'] = "4242";

            global.db.products.create(invalidProduct, null, function(err, product) {
               should.exist(err);
               should.not.exist(product);

               err.should.be.an.instanceOf(ValidationError);
               err.should.have.property('data');
               err.data.errors.should.have.length(1);
               err.data.errors[0].should.have.properties({
                                                            keyword : 'pattern',
                                                            dataPath : '.name',
                                                            schemaPath : '#/properties/name/pattern'
                                                         });

               done();
            });
         });

         it("Should be able to create a product with a non-null creator", function(done) {
            global.db.products.create(product5, user1['id'], function(err, product) {
               should.not.exist(err);
               should.exist(product);

               product.should.have.property('insertId');
               product.should.have.property('name', product5['name']);

               // remember the insert ID
               product5['id'] = product.insertId;

               done();
            });
         });

         it("Should fail to create a duplicate product", function(done) {
            global.db.products.create(product4, user1['id'], function(err, product) {
               should.exist(err);
               should.not.exist(product);

               err.should.be.an.instanceOf(DuplicateRecordError);
               err.should.have.property("data");
               err.data.should.have.property("code", "ER_DUP_ENTRY");

               done();
            });
         });

      });   // End Create

      describe("Find", function() {
         it("Should be able to find a product by name", function(done) {
            global.db.products.findByName(product4['name'], null, function(err, product) {
               should.not.exist(err);
               should.exist(product);

               product.should.have.properties({
                                                 id : product4['id'],
                                                 name : product4['name'],
                                                 prettyName : product4['prettyName'],
                                                 vendor : product4['vendor'],
                                                 description : product4['description'],
                                                 creatorUserId : null
                                              });
               product.should.have.properties('created', 'modified');

               // do a deep equal
               should(JSON.parse(product['defaultChannelSpecs'])).eql(product4['defaultChannelSpecs']);

               done();
            });
         });

         it("Should be able to find a product by ID", function(done) {
            global.db.products.findById(product5['id'], null, function(err, product) {
               should.not.exist(err);
               should.exist(product);

               product.should.have.properties({
                                                 id : product5['id'],
                                                 name : product5['name'],
                                                 prettyName : product5['prettyName'],
                                                 vendor : product5['vendor'],
                                                 description : product5['description'],
                                                 creatorUserId : user1['id']
                                              });
               product.should.have.properties('created', 'modified');

               // do a deep equal
               should(JSON.parse(product['defaultChannelSpecs'])).eql(product5['defaultChannelSpecs']);

               done();
            });
         });

         it("Should not be able to find a product by a non-existent name", function(done) {
            global.db.products.findByName("bogus", null, function(err, product) {
               should.not.exist(err);
               should.not.exist(product);

               done();
            });
         });

         it("Should not be able to find a product by a non-existent ID", function(done) {
            global.db.products.findById(-1, null, function(err, product) {
               should.not.exist(err);
               should.not.exist(product);

               done();
            });
         });

      });   // End Find

   });   // End Products
});   // End Database