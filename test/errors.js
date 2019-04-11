const should = require('should');
const ValidationError = require('../lib/errors').ValidationError;
const DatabaseError = require('../lib/errors').DatabaseError;
const DuplicateRecordError = require('../lib/errors').DuplicateRecordError;

describe("Custom Error Classes", function() {
   describe("ValidationError", function() {
      const errorMessage = "oops, validation failed";
      const errorData = { foo : "bar", baz : { bat : "bif" } };
      const error1 = new ValidationError(errorData);
      const error2 = new ValidationError(errorData, errorMessage);

      it("Should be an instance of Error", function() {
         (error1 instanceof Error).should.be.true();
         (error2 instanceof Error).should.be.true();
      });

      it("Should be an instance of ValidationError", function() {
         (error1 instanceof ValidationError).should.be.true();
         (error2 instanceof ValidationError).should.be.true();
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
      const errorMessage = "oops, a database error";
      const errorData = { foo : "boo", baz : { bat : "blah" } };
      const error1 = new DatabaseError(errorData);
      const error2 = new DatabaseError(errorData, errorMessage);

      const nestedError = new Error("This is the nested error with a code");
      nestedError.code = "This is the code";
      const error3 = new DatabaseError(nestedError, errorMessage);

      it("Should be an instance of Error", function() {
         (error1 instanceof Error).should.be.true();
         (error2 instanceof Error).should.be.true();
         (error3 instanceof Error).should.be.true();
      });

      it("Should be an instance of DatabaseError", function() {
         (error1 instanceof DatabaseError).should.be.true();
         (error2 instanceof DatabaseError).should.be.true();
         (error3 instanceof DatabaseError).should.be.true();
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
      const errorMessage = "oops, a duplicate record error";
      const errorData = { foo : "duplicate", baz : { bat : "record" } };
      const error1 = new DuplicateRecordError(errorData);
      const error2 = new DuplicateRecordError(errorData, errorMessage);

      const nestedError = new Error("This is the nested error with a code");
      nestedError.code = "This is the code";
      const error3 = new DuplicateRecordError(nestedError, errorMessage);

      it("Should be an instance of Error", function() {
         (error1 instanceof Error).should.be.true();
         (error2 instanceof Error).should.be.true();
         (error3 instanceof Error).should.be.true();
      });

      it("Should be an instance of DatabaseError", function() {
         (error1 instanceof DatabaseError).should.be.true();
         (error2 instanceof DatabaseError).should.be.true();
         (error3 instanceof DatabaseError).should.be.true();
      });

      it("Should be an instance of DuplicateRecordError", function() {
         (error1 instanceof DuplicateRecordError).should.be.true();
         (error2 instanceof DuplicateRecordError).should.be.true();
         (error3 instanceof DuplicateRecordError).should.be.true();
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
