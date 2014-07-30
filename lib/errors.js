// Code for subclassing Error taken from http://stackoverflow.com/a/8460753

/**
 * Creates an instance of a <code>DatabaseError</code> with the given <code>data</code> object and
 * optional <code>message</code>.
 *
 * @param {object} data Extra data about the error.  Will be saved in this instance's <code>data</code> property.
 * @param {string} [message] Optional message about the error.
 * @constructor
 */
function DatabaseError(data, message) {
   this.constructor.prototype.__proto__ = Error.prototype;
   Error.captureStackTrace(this, this.constructor);
   this.name = this.constructor.name;
   this.data = data;
   this.message = message || "Database error";
}

/**
 * Creates an instance of a <code>DuplicateRecordError</code> with the given <code>data</code> object and
 * optional <code>message</code>.  This is a subclass of <code>DatabaseError</code>.
 *
 * @param {object} data Extra data about the error.  Will be saved in this instance's <code>data</code> property.
 * @param {string} [message] Optional message about the error.
 * @constructor
 */
function DuplicateRecordError(data, message) {
   this.constructor.prototype.__proto__ = DatabaseError.prototype;
   Error.captureStackTrace(this, this.constructor);
   this.name = this.constructor.name;
   this.data = data;
   this.message = message || "Duplicate Record error";
}

/**
 * Creates an instance of a <code>ValidationError</code> with the given <code>data</code> object and
 * optional <code>message</code>.
 *
 * @param {object} data Extra data about the error.  Will be saved in this instance's <code>data</code> property.
 * @param {string} [message] Optional message about the error.
 * @constructor
 */
function ValidationError(data, message) {
   this.constructor.prototype.__proto__ = Error.prototype;
   Error.captureStackTrace(this, this.constructor);
   this.name = this.constructor.name;
   this.data = data;
   this.message = message || "Validation error";
}

module.exports.DatabaseError = DatabaseError;
module.exports.DuplicateRecordError = DuplicateRecordError;
module.exports.ValidationError = ValidationError;