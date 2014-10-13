var assert = require('assert');
var should = require('should');
var Query2Query = require('../lib/Query2Query');

var DEFAULT_MIN_LIMIT = 1;
var DEFAULT_MAX_LIMIT = 20;

describe("Query2Query", function() {

   var query2query;

   before(function(initDone) {
      query2query = new Query2Query();

      initDone();
   });

   describe("Setup", function() {
      it("Should be able to add fields", function(done) {

         query2query.addField('id', true, true, false, Query2Query.types.INTEGER);
         query2query.addField('firstName', true, true, false, Query2Query.types.STRING);
         query2query.addField('lastName', true, true, true);
         query2query.addField('favoriteStory', false, false, true);
         query2query.addField('favoriteNumber', true, true, false, Query2Query.types.NUMBER);
         query2query.addField('likesPickles', true, true, false, Query2Query.types.BOOLEAN);
         query2query.addField('created', true, true, false, Query2Query.types.DATETIME);

         done();
      });
   });

   describe("Empty query string", function() {
      var verify = function(err, queryParts, maxLimit, done) {
         if (err) {
            return done(err);
         }
         assert.notEqual(queryParts, null);
         queryParts.should.have.property('selectFields', ['id',
                                                          'firstName',
                                                          'lastName',
                                                          'favoriteStory',
                                                          'favoriteNumber',
                                                          'likesPickles',
                                                          'created']);
         queryParts.should.have.property('whereExpressions', []);
         queryParts.should.have.property('whereValues', []);
         queryParts.should.have.property('orderByFields', []);
         queryParts.should.have.property('whereJoin', "AND");
         queryParts.should.have.property('offset', 0);
         queryParts.should.have.property('limit', maxLimit);
         assert.equal(queryParts.sql("Users"), "SELECT id,firstName,lastName,favoriteStory,favoriteNumber,likesPickles,created FROM Users   LIMIT 0," + maxLimit);

         done();
      };

      it("Should be able to parse an empty query string (default max limit of " + DEFAULT_MAX_LIMIT + ")", function(done) {
         query2query.parse("", function(err, queryParts) {
            verify(err, queryParts, DEFAULT_MAX_LIMIT, done);
         });
      });

      it("Should be able to parse an empty query string (max limit of 50)", function(done) {
         var maxLimit = 50;
         query2query.parse("", function(err, queryParts) {
                              verify(err, queryParts, maxLimit, done);
                           },
                           maxLimit);
      });

   });

   describe("Specify limit and offset", function() {

      it("Should be able to limit the number of returned records", function(done) {
         var limit = 13;
         query2query.parse({
                              "fields" : "id,firstName,created",
                              "limit" : "" + limit
                           }, function(err, queryParts) {
                              if (err) {
                                 return done(err);
                              }
                              assert.notEqual(queryParts, null);
                              queryParts.should.have.property('selectFields', ['id',
                                                                               'firstName',
                                                                               'created']);
                              queryParts.should.have.property('whereExpressions', []);
                              queryParts.should.have.property('whereValues', []);
                              queryParts.should.have.property('orderByFields', []);
                              queryParts.should.have.property('whereJoin', "AND");
                              queryParts.should.have.property('offset', 0);
                              queryParts.should.have.property('limit', limit);
                              assert.equal(queryParts.sql("Users"), "SELECT id,firstName,created FROM Users   LIMIT 0," + limit);

                              done();
                           }
         );
      });

      it("Should be able to limit the number of returned records and set the offset", function(done) {
         var limit = 13;
         var offset = 5;
         query2query.parse({
                              "fields" : "id,firstName,created",
                              "limit" : "" + limit,
                              "offset" : "" + offset
                           }, function(err, queryParts) {
                              if (err) {
                                 return done(err);
                              }
                              assert.notEqual(queryParts, null);
                              queryParts.should.have.property('selectFields', ['id',
                                                                               'firstName',
                                                                               'created']);
                              queryParts.should.have.property('whereExpressions', []);
                              queryParts.should.have.property('whereValues', []);
                              queryParts.should.have.property('orderByFields', []);
                              queryParts.should.have.property('whereJoin', "AND");
                              queryParts.should.have.property('offset', offset);
                              queryParts.should.have.property('limit', limit);
                              assert.equal(queryParts.sql("Users"), "SELECT id,firstName,created FROM Users   LIMIT " + offset + "," + limit);

                              done();
                           }
         );
      });

      it("Invalid limit and offset will be ignored and defaults used instead", function(done) {
         query2query.parse({
                              "fields" : "id,firstName,created",
                              "limit" : "-13",
                              "offset" : "-5"
                           }, function(err, queryParts) {
                              if (err) {
                                 return done(err);
                              }
                              assert.notEqual(queryParts, null);
                              queryParts.should.have.property('selectFields', ['id',
                                                                               'firstName',
                                                                               'created']);
                              queryParts.should.have.property('whereExpressions', []);
                              queryParts.should.have.property('whereValues', []);
                              queryParts.should.have.property('orderByFields', []);
                              queryParts.should.have.property('whereJoin', "AND");
                              queryParts.should.have.property('offset', 0);
                              queryParts.should.have.property('limit', DEFAULT_MIN_LIMIT);
                              assert.equal(queryParts.sql("Users"), "SELECT id,firstName,created FROM Users   LIMIT 0," + DEFAULT_MIN_LIMIT);

                              done();
                           }
         );
      });

   });   // END "Specify limit"

   describe("Select specific fields", function() {

      it("Should be able to limit the selected fields", function(done) {
         query2query.parse({"fields" : "id,firstName,created"}, function(err, queryParts) {
                              if (err) {
                                 return done(err);
                              }
                              assert.notEqual(queryParts, null);
                              queryParts.should.have.property('selectFields', ['id',
                                                                               'firstName',
                                                                               'created']);
                              queryParts.should.have.property('whereExpressions', []);
                              queryParts.should.have.property('whereValues', []);
                              queryParts.should.have.property('orderByFields', []);
                              queryParts.should.have.property('whereJoin', "AND");
                              queryParts.should.have.property('offset', 0);
                              queryParts.should.have.property('limit', DEFAULT_MAX_LIMIT);
                              assert.equal(queryParts.sql("Users"), "SELECT id,firstName,created FROM Users   LIMIT 0," + DEFAULT_MAX_LIMIT);

                              done();
                           }
         );
      });

      it("Should ignore bogus selected fields", function(done) {
         query2query.parse({"fields" : "id,foo,bar,bogus,created"}, function(err, queryParts) {
                              if (err) {
                                 return done(err);
                              }
                              assert.notEqual(queryParts, null);
                              queryParts.should.have.property('selectFields', ['id',
                                                                               'created']);
                              queryParts.should.have.property('whereExpressions', []);
                              queryParts.should.have.property('whereValues', []);
                              queryParts.should.have.property('orderByFields', []);
                              queryParts.should.have.property('whereJoin', "AND");
                              queryParts.should.have.property('offset', 0);
                              queryParts.should.have.property('limit', DEFAULT_MAX_LIMIT);
                              assert.equal(queryParts.sql("Users"), "SELECT id,created FROM Users   LIMIT 0," + DEFAULT_MAX_LIMIT);

                              done();
                           }
         );
      });

      it("Should skip duplicated fields", function(done) {
         query2query.parse({"fields" : "id, id, created, id, created"}, function(err, queryParts) {
                              if (err) {
                                 return done(err);
                              }
                              assert.notEqual(queryParts, null);
                              queryParts.should.have.property('selectFields', ['id',
                                                                               'created']);
                              queryParts.should.have.property('whereExpressions', []);
                              queryParts.should.have.property('whereValues', []);
                              queryParts.should.have.property('orderByFields', []);
                              queryParts.should.have.property('whereJoin', "AND");
                              queryParts.should.have.property('offset', 0);
                              queryParts.should.have.property('limit', DEFAULT_MAX_LIMIT);
                              assert.equal(queryParts.sql("Users"), "SELECT id,created FROM Users   LIMIT 0," + DEFAULT_MAX_LIMIT);

                              done();
                           }
         );
      });

   });   // END "Subset of selected fields"

   describe("Order By", function() {

      it("Should be able to specify an ORDER BY field", function(done) {
         query2query.parse({
                              "fields" : "id,firstName,created",
                              "orderBy" : "created"
                           }, function(err, queryParts) {
                              if (err) {
                                 return done(err);
                              }
                              assert.notEqual(queryParts, null);
                              queryParts.should.have.property('selectFields', ['id',
                                                                               'firstName',
                                                                               'created']);
                              queryParts.should.have.property('whereExpressions', []);
                              queryParts.should.have.property('whereValues', []);
                              queryParts.should.have.property('orderByFields', ['created']);
                              queryParts.should.have.property('whereJoin', "AND");
                              queryParts.should.have.property('offset', 0);
                              queryParts.should.have.property('limit', DEFAULT_MAX_LIMIT);
                              assert.equal(queryParts.sql("Users"), "SELECT id,firstName,created FROM Users  ORDER BY created LIMIT 0," + DEFAULT_MAX_LIMIT);

                              done();
                           }
         );
      });

      it("Fields not allowed in ORDER BY should be filtered out", function(done) {
         query2query.parse({
                              "fields" : "id,firstName,created",
                              "orderBy" : "created, favoriteStory"
                           }, function(err, queryParts) {
                              if (err) {
                                 return done(err);
                              }
                              assert.notEqual(queryParts, null);
                              queryParts.should.have.property('selectFields', ['id',
                                                                               'firstName',
                                                                               'created']);
                              queryParts.should.have.property('whereExpressions', []);
                              queryParts.should.have.property('whereValues', []);
                              queryParts.should.have.property('orderByFields', ['created']);
                              queryParts.should.have.property('whereJoin', "AND");
                              queryParts.should.have.property('offset', 0);
                              queryParts.should.have.property('limit', DEFAULT_MAX_LIMIT);
                              assert.equal(queryParts.sql("Users"), "SELECT id,firstName,created FROM Users  ORDER BY created LIMIT 0," + DEFAULT_MAX_LIMIT);

                              done();
                           }
         );
      });

      it("Redundant ORDER BY fields should be filtered out", function(done) {
         query2query.parse({
                              "fields" : "id,firstName,created",
                              "orderBy" : "created, id, created, firstName, firstName"
                           }, function(err, queryParts) {
                              if (err) {
                                 return done(err);
                              }
                              assert.notEqual(queryParts, null);
                              queryParts.should.have.property('selectFields', ['id',
                                                                               'firstName',
                                                                               'created']);
                              queryParts.should.have.property('whereExpressions', []);
                              queryParts.should.have.property('whereValues', []);
                              queryParts.should.have.property('orderByFields', ['created', 'id', 'firstName']);
                              queryParts.should.have.property('whereJoin', "AND");
                              queryParts.should.have.property('offset', 0);
                              queryParts.should.have.property('limit', DEFAULT_MAX_LIMIT);
                              assert.equal(queryParts.sql("Users"), "SELECT id,firstName,created FROM Users  ORDER BY created,id,firstName LIMIT 0," + DEFAULT_MAX_LIMIT);

                              done();
                           }
         );
      });

      it("Should be able to specify multiple ORDER BY fields", function(done) {
         query2query.parse({
                              "fields" : "id,firstName,created",
                              "orderBy" : "created, id"
                           }, function(err, queryParts) {
                              if (err) {
                                 return done(err);
                              }
                              assert.notEqual(queryParts, null);
                              queryParts.should.have.property('selectFields', ['id',
                                                                               'firstName',
                                                                               'created']);
                              queryParts.should.have.property('whereExpressions', []);
                              queryParts.should.have.property('whereValues', []);
                              queryParts.should.have.property('orderByFields', ['created', 'id']);
                              queryParts.should.have.property('whereJoin', "AND");
                              queryParts.should.have.property('offset', 0);
                              queryParts.should.have.property('limit', DEFAULT_MAX_LIMIT);
                              assert.equal(queryParts.sql("Users"), "SELECT id,firstName,created FROM Users  ORDER BY created,id LIMIT 0," + DEFAULT_MAX_LIMIT);

                              done();
                           }
         );
      });

      it("Should be able to specify ORDER BY fields to sort in descending order", function(done) {
         query2query.parse({
                              "fields" : "id,firstName,created",
                              "orderBy" : "created, -id"
                           }, function(err, queryParts) {
                              if (err) {
                                 return done(err);
                              }
                              assert.notEqual(queryParts, null);
                              queryParts.should.have.property('selectFields', ['id',
                                                                               'firstName',
                                                                               'created']);
                              queryParts.should.have.property('whereExpressions', []);
                              queryParts.should.have.property('whereValues', []);
                              queryParts.should.have.property('orderByFields', ['created', 'id DESC']);
                              queryParts.should.have.property('whereJoin', "AND");
                              queryParts.should.have.property('offset', 0);
                              queryParts.should.have.property('limit', DEFAULT_MAX_LIMIT);
                              assert.equal(queryParts.sql("Users"), "SELECT id,firstName,created FROM Users  ORDER BY created,id DESC LIMIT 0," + DEFAULT_MAX_LIMIT);

                              done();
                           }
         );
      });

   });   // END of "Order By"

   describe("Where Clauses", function() {

      it("Should be able to specify a WHERE clause", function(done) {
         query2query.parse({
                              "fields" : "id,firstName,created",
                              "where" : "id=4",
                              "orderBy" : "created, -id"
                           }, function(err, queryParts) {
                              if (err) {
                                 return done(err);
                              }
                              assert.notEqual(queryParts, null);
                              queryParts.should.have.property('selectFields', ['id',
                                                                               'firstName',
                                                                               'created']);
                              queryParts.should.have.property('whereExpressions', ['(id = ?)']);
                              queryParts.should.have.property('whereValues', [4]);
                              queryParts.should.have.property('orderByFields', ['created', 'id DESC']);
                              queryParts.should.have.property('whereJoin', "AND");
                              queryParts.should.have.property('offset', 0);
                              queryParts.should.have.property('limit', DEFAULT_MAX_LIMIT);
                              assert.equal(queryParts.sql("Users"), "SELECT id,firstName,created " +
                                                                    "FROM Users " +
                                                                    "WHERE (id = ?) " +
                                                                    "ORDER BY created,id DESC LIMIT 0," + DEFAULT_MAX_LIMIT);

                              done();
                           }
         );
      });

      it("Fields not allowed in WHERE should be filtered out", function(done) {
         query2query.parse({
                              "fields" : "id,firstName,created",
                              "where" : "id=4,favoriteStory",
                              "orderBy" : "created, -id"
                           }, function(err, queryParts) {
                              if (err) {
                                 return done(err);
                              }
                              assert.notEqual(queryParts, null);
                              queryParts.should.have.property('selectFields', ['id',
                                                                               'firstName',
                                                                               'created']);
                              queryParts.should.have.property('whereExpressions', ['(id = ?)']);
                              queryParts.should.have.property('whereValues', [4]);
                              queryParts.should.have.property('orderByFields', ['created', 'id DESC']);
                              queryParts.should.have.property('whereJoin', "AND");
                              queryParts.should.have.property('offset', 0);
                              queryParts.should.have.property('limit', DEFAULT_MAX_LIMIT);
                              assert.equal(queryParts.sql("Users"), "SELECT id,firstName,created " +
                                                                    "FROM Users " +
                                                                    "WHERE (id = ?) " +
                                                                    "ORDER BY created,id DESC LIMIT 0," + DEFAULT_MAX_LIMIT);

                              done();
                           }
         );
      });

      it("Should be able to specify a compound WHERE clause, joined with AND (multiple in a single 'where' param)", function(done) {
         query2query.parse({
                              "fields" : "id,firstName,created",
                              "where" : "id>4,id<42",
                              "orderBy" : "created, -id"
                           }, function(err, queryParts) {
                              if (err) {
                                 return done(err);
                              }
                              assert.notEqual(queryParts, null);
                              queryParts.should.have.property('selectFields', ['id',
                                                                               'firstName',
                                                                               'created']);
                              queryParts.should.have.property('whereExpressions', ['((id > ?) AND (id < ?))']);
                              queryParts.should.have.property('whereValues', [4, 42]);
                              queryParts.should.have.property('orderByFields', ['created', 'id DESC']);
                              queryParts.should.have.property('whereJoin', "AND");
                              queryParts.should.have.property('offset', 0);
                              queryParts.should.have.property('limit', DEFAULT_MAX_LIMIT);
                              assert.equal(queryParts.sql("Users"), "SELECT id,firstName,created " +
                                                                    "FROM Users " +
                                                                    "WHERE ((id > ?) AND (id < ?)) " +
                                                                    "ORDER BY created,id DESC LIMIT 0," + DEFAULT_MAX_LIMIT);

                              done();
                           }
         );
      });

      it("Should be able to specify a compound WHERE clause, joined with AND (multiple 'where' params)", function(done) {
         query2query.parse({
                              "fields" : "id,firstName,created",
                              "where" : ["id>4", "id<42"],
                              "orderBy" : "created, -id"
                           }, function(err, queryParts) {
                              if (err) {
                                 return done(err);
                              }
                              assert.notEqual(queryParts, null);
                              queryParts.should.have.property('selectFields', ['id',
                                                                               'firstName',
                                                                               'created']);
                              queryParts.should.have.property('whereExpressions', ['(id > ?)', '(id < ?)']);
                              queryParts.should.have.property('whereValues', [4, 42]);
                              queryParts.should.have.property('orderByFields', ['created', 'id DESC']);
                              queryParts.should.have.property('whereJoin', "AND");
                              queryParts.should.have.property('offset', 0);
                              queryParts.should.have.property('limit', DEFAULT_MAX_LIMIT);
                              assert.equal(queryParts.sql("Users"), "SELECT id,firstName,created " +
                                                                    "FROM Users " +
                                                                    "WHERE (id > ?) AND (id < ?) " +
                                                                    "ORDER BY created,id DESC LIMIT 0," + DEFAULT_MAX_LIMIT);

                              done();
                           }
         );
      });

      it("Should be able to specify a compound WHERE clause, joined with AND (multiple 'whereAnd' params)", function(done) {
         query2query.parse({
                              "fields" : "id,firstName,created",
                              "whereAnd" : ["id>4", "id<42", "lastName=__null__"],
                              "orderBy" : "created, -id"
                           }, function(err, queryParts) {
                              if (err) {
                                 return done(err);
                              }
                              assert.notEqual(queryParts, null);
                              queryParts.should.have.property('selectFields', ['id',
                                                                               'firstName',
                                                                               'created']);
                              queryParts.should.have.property('whereExpressions', ['(id > ?)', '(id < ?)', '(lastName IS ?)']);
                              queryParts.should.have.property('whereValues', [4, 42, null]);
                              queryParts.should.have.property('orderByFields', ['created', 'id DESC']);
                              queryParts.should.have.property('whereJoin', "AND");
                              queryParts.should.have.property('offset', 0);
                              queryParts.should.have.property('limit', DEFAULT_MAX_LIMIT);
                              assert.equal(queryParts.sql("Users"), "SELECT id,firstName,created " +
                                                                    "FROM Users " +
                                                                    "WHERE (id > ?) AND (id < ?) AND (lastName IS ?) " +
                                                                    "ORDER BY created,id DESC LIMIT 0," + DEFAULT_MAX_LIMIT);

                              done();
                           }
         );
      });

      it("Should be able to specify a compound WHERE clause, joined with OR (multiple 'where' params)", function(done) {
         query2query.parse({
                              "fields" : "id,firstName,created",
                              "where" : ["id>4", "id<42"],
                              "whereJoin" : "or",
                              "orderBy" : "created, -id"
                           }, function(err, queryParts) {
                              if (err) {
                                 return done(err);
                              }
                              assert.notEqual(queryParts, null);
                              queryParts.should.have.property('selectFields', ['id',
                                                                               'firstName',
                                                                               'created']);
                              queryParts.should.have.property('whereExpressions', ['(id > ?)', '(id < ?)']);
                              queryParts.should.have.property('whereValues', [4, 42]);
                              queryParts.should.have.property('orderByFields', ['created', 'id DESC']);
                              queryParts.should.have.property('whereJoin', "OR");
                              queryParts.should.have.property('offset', 0);
                              queryParts.should.have.property('limit', DEFAULT_MAX_LIMIT);
                              assert.equal(queryParts.sql("Users"), "SELECT id,firstName,created " +
                                                                    "FROM Users " +
                                                                    "WHERE (id > ?) OR (id < ?) " +
                                                                    "ORDER BY created,id DESC LIMIT 0," + DEFAULT_MAX_LIMIT);

                              done();
                           }
         );
      });

      it("Should be able to specify a compound WHERE clause, joined with AND (multiple in 'whereOr' and 'whereAnd' params)", function(done) {
         query2query.parse({
                              "fields" : "id,firstName,created",
                              "whereOr" : ["firstName=Foo,firstName=Bar,likesPickles=TRUE"],
                              "whereAnd" : ["id>4,id<42"],
                              "orderBy" : "created, -id"
                           }, function(err, queryParts) {
                              if (err) {
                                 return done(err);
                              }
                              assert.notEqual(queryParts, null);
                              queryParts.should.have.property('selectFields', ['id',
                                                                               'firstName',
                                                                               'created']);
                              queryParts.should.have.property('whereExpressions', ['((id > ?) AND (id < ?))',
                                                                                   '((firstName = ?) OR (firstName = ?) OR (likesPickles = ?))']);
                              queryParts.should.have.property('whereValues', [4, 42, 'Foo', 'Bar', true]);
                              queryParts.should.have.property('orderByFields', ['created', 'id DESC']);
                              queryParts.should.have.property('whereJoin', "AND");
                              queryParts.should.have.property('offset', 0);
                              queryParts.should.have.property('limit', DEFAULT_MAX_LIMIT);
                              assert.equal(queryParts.sql("Users"), "SELECT id,firstName,created " +
                                                                    "FROM Users " +
                                                                    "WHERE ((id > ?) AND (id < ?)) AND ((firstName = ?) OR (firstName = ?) OR (likesPickles = ?)) " +
                                                                    "ORDER BY created,id DESC LIMIT 0," + DEFAULT_MAX_LIMIT);

                              done();
                           }
         );
      });

      it("Should be able to specify a compound WHERE clause, joined with OR (multiple in 'whereOr' and 'whereAnd' params)", function(done) {
         query2query.parse({
                              "fields" : "id,firstName,created",
                              "whereOr" : ["firstName=Foo,firstName=Bar"],
                              "whereAnd" : ["id<>4,id<42,likesPickles=0"],
                              "whereJoin" : "or",
                              "orderBy" : "created, -id"
                           }, function(err, queryParts) {
                              if (err) {
                                 return done(err);
                              }
                              assert.notEqual(queryParts, null);
                              queryParts.should.have.property('selectFields', ['id',
                                                                               'firstName',
                                                                               'created']);
                              queryParts.should.have.property('whereExpressions', ['((id <> ?) AND (id < ?) AND (likesPickles = ?))',
                                                                                   '((firstName = ?) OR (firstName = ?))']);
                              queryParts.should.have.property('whereValues', [4, 42, false, 'Foo', 'Bar']);
                              queryParts.should.have.property('orderByFields', ['created', 'id DESC']);
                              queryParts.should.have.property('whereJoin', "OR");
                              queryParts.should.have.property('offset', 0);
                              queryParts.should.have.property('limit', DEFAULT_MAX_LIMIT);
                              assert.equal(queryParts.sql("Users"), "SELECT id,firstName,created " +
                                                                    "FROM Users " +
                                                                    "WHERE ((id <> ?) AND (id < ?) AND (likesPickles = ?)) OR ((firstName = ?) OR (firstName = ?)) " +
                                                                    "ORDER BY created,id DESC LIMIT 0," + DEFAULT_MAX_LIMIT);

                              done();
                           }
         );
      });

      it("Should fail for an invalid where join", function(done) {
         query2query.parse({
                              "fields" : "id,firstName,created",
                              "whereOr" : ["firstName=Foo,firstName=Bar"],
                              "whereAnd" : ["id>4,id<42"],
                              "whereJoin" : "bogus",
                              "orderBy" : "created, -id"
                           }, function(err, queryParts) {
                              assert.notEqual(err, null);
                              assert.equal(queryParts, null);

                              err.should.have.property('message');
                              err.should.have.property('data');
                              err.data.should.have.property('code', 422);
                              err.data.should.have.property('status', "error");

                              done();
                           }
         );
      });

      it("Should fail if comparing a non-null field with NULL", function(done) {
         query2query.parse({
                              "fields" : "id,firstName,created",
                              "where" : ["id<>NULL"]
                           }, function(err, queryParts) {
                              assert.notEqual(err, null);
                              assert.equal(queryParts, null);

                              err.should.have.property('message');
                              err.should.have.property('data');
                              err.data.should.have.property('code', 422);
                              err.data.should.have.property('status', "error");

                              done();
                           }
         );
      });

      it("Should fail if conversion to an integer field fails", function(done) {
         query2query.parse({
                              "fields" : "id,firstName,created",
                              "where" : ["id=foo"]
                           }, function(err, queryParts) {
                              assert.notEqual(err, null);
                              assert.equal(queryParts, null);

                              err.should.have.property('message');
                              err.should.have.property('data');
                              err.data.should.have.property('code', 422);
                              err.data.should.have.property('status', "error");

                              done();
                           }
         );
      });

      it("Should fail if conversion to an number field fails", function(done) {
         query2query.parse({
                              "fields" : "id,firstName,created",
                              "where" : ["favoriteNumber=foo"]
                           }, function(err, queryParts) {
                              assert.notEqual(err, null);
                              assert.equal(queryParts, null);

                              err.should.have.property('message');
                              err.should.have.property('data');
                              err.data.should.have.property('code', 422);
                              err.data.should.have.property('status', "error");

                              done();
                           }
         );
      });

      it("Should fail if conversion to an datetime field fails", function(done) {
         query2query.parse({
                              "fields" : "id,firstName,created",
                              "where" : ["created=foo"]
                           }, function(err, queryParts) {
                              assert.notEqual(err, null);
                              assert.equal(queryParts, null);

                              err.should.have.property('message');
                              err.should.have.property('data');
                              err.data.should.have.property('code', 422);
                              err.data.should.have.property('status', "error");

                              done();
                           }
         );
      });

   });

});
