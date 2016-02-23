var should = require('should');
var ValidationError = require('../lib/errors').ValidationError;
var DatabaseError = require('../lib/errors').DatabaseError;
var DuplicateRecordError = require('../lib/errors').DuplicateRecordError;

describe.only("Custom Error Classes", function() {
   describe("ValidationError", function() {
      var errorMessage = "oops, validation failed";
      var errorData = {foo : "bar", baz : {bat : "bif"}};
      var error1 = new ValidationError(errorData);
      var error2 = new ValidationError(errorData, errorMessage);

      it("Should be an instance of Error", function() {
         (error1 instanceof Error).should.be.true;
         (error2 instanceof Error).should.be.true;
      });

      it("Should be an instance of ValidationError", function() {
         (error1 instanceof ValidationError).should.be.true;
         (error2 instanceof ValidationError).should.be.true;
      });

      it("Should have the data property set", function() {
         // do a deep equal
         should(error1.data).eql(errorData);
         should(error2.data).eql(errorData);
      });

      it("Should have the message property set", function() {
         error1.should.have.property("message");
         error2.should.have.property("message", errorMessage);
      });
   });

   describe("DatabaseError", function() {
      var errorMessage = "oops, a database error";
      var errorData = {foo : "boo", baz : {bat : "blah"}};
      var error1 = new DatabaseError(errorData);
      var error2 = new DatabaseError(errorData, errorMessage);

      var nestedError = new Error("This is the nested error with a code");
      nestedError.code = "This is the code";
      var error3 = new DatabaseError(nestedError, errorMessage);

      it("Should be an instance of Error", function() {
         (error1 instanceof Error).should.be.true;
         (error2 instanceof Error).should.be.true;
         (error3 instanceof Error).should.be.true;
      });

      it("Should be an instance of DatabaseError", function() {
         (error1 instanceof DatabaseError).should.be.true;
         (error2 instanceof DatabaseError).should.be.true;
         (error3 instanceof DatabaseError).should.be.true;
      });

      it("Should have the data property set", function() {
         // do a deep equal
         should(error1.data).eql(errorData);
         should(error2.data).eql(errorData);
         should(error3.data).eql(nestedError);
      });

      it("Should have the message property set", function() {
         error1.should.have.property("message");
         error2.should.have.property("message", errorMessage);
         error3.should.have.property("message", errorMessage);
      });
   });

   describe("DuplicateRecordError", function() {
      var errorMessage = "oops, a duplicate record error";
      var errorData = {foo : "duplicate", baz : {bat : "record"}};
      var error1 = new DuplicateRecordError(errorData);
      var error2 = new DuplicateRecordError(errorData, errorMessage);

      var nestedError = new Error("This is the nested error with a code");
      nestedError.code = "This is the code";
      var error3 = new DuplicateRecordError(nestedError, errorMessage);

      it("Should be an instance of Error", function() {
         (error1 instanceof Error).should.be.true;
         (error2 instanceof Error).should.be.true;
         (error3 instanceof Error).should.be.true;
      });

      it("Should be an instance of DatabaseError", function() {
         (error1 instanceof DatabaseError).should.be.true;
         (error2 instanceof DatabaseError).should.be.true;
         (error3 instanceof DatabaseError).should.be.true;
      });

      it("Should be an instance of DuplicateRecordError", function() {
         (error1 instanceof DuplicateRecordError).should.be.true;
         (error2 instanceof DuplicateRecordError).should.be.true;
         (error3 instanceof DuplicateRecordError).should.be.true;
      });

      it("Should have the data property set", function() {
         // do a deep equal
         should(error1.data).eql(errorData);
         should(error2.data).eql(errorData);
         should(error3.data).eql(nestedError);
      });

      it("Should have the message property set", function() {
         error1.should.have.property("message");
         error2.should.have.property("message", errorMessage);
         error3.should.have.property("message", errorMessage);
      });
   });
});
