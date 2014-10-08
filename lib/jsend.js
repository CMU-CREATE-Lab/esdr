var httpStatusCodes = require('http-status');
var response = require('express').response;

// Simple helper methods to produce JSend responses (http://labs.omniti.com/labs/jsend)

/**
 * Creates and returns JSend success object.
 *
 * @param {*} data wrapper for any data returned by the API call. If the call returns no data, this parameter should be
 * set to <code>null</code>.
 * @param {number} [httpStatus] the HTTP status code to use for the response, defaults to 200 (OK).  If specified, it
 * should be an HTTP status code in the range [200, 299].
 */
var createJSendSuccess = function(data, httpStatus) {
   httpStatus = httpStatus || httpStatusCodes.OK;
   return {
      code : httpStatus,
      status : 'success',
      data : data
   }
};

/**
 * Creates and returns JSend error object for a client error, for when an API call is rejected due to invalid data or
 * call conditions.
 *
 * @param {string} message A meaningful, end-user-readable (or at the least log-worthy) message, explaining what went
 * wrong.
 * @param {*} data details of why the request failed. If the reasons for failure correspond to POST values, the response
 * object's keys SHOULD correspond to those POST values. Can be <code>null</code>.
 * @param {number} [httpStatus] the HTTP status code to use for the response, defaults to 400 (Bad Request). If
 * specified, it should be an HTTP status code in the range [400, 499].
 */
var createJSendClientError = function(message, data, httpStatus) {
   httpStatus = httpStatus || httpStatusCodes.BAD_REQUEST;
   return {
      code : httpStatus,
      status : 'error',   // JSend calls actually calls for "fail", but that seems counterintuitive and wrong
      data : data,
      message : message
   }
};

/**
 * Creates and returns JSend error object for a client validation error, for when an API call is rejected due to a data
 * validation error.  The code will be HTTP status code 422 (Unprocessable Entity).
 *
 * @param {string} message A meaningful, end-user-readable (or at the least log-worthy) message, explaining what went
 * wrong.
 * @param {*} data details of why the request failed. If the reasons for failure correspond to POST values, the response
 * object's keys SHOULD correspond to those POST values. Can be <code>null</code>.
 */
var createJSendClientValidationError = function(message, data) {
   return createJSendClientError(message, data, httpStatusCodes.UNPROCESSABLE_ENTITY);
};

/**
 * Creates and returns JSend failure object for a server error, for when an API call fails due to an error on the
 * server.
 *
 * @param {string} message A meaningful, end-user-readable (or at the least log-worthy) message, explaining what went
 * wrong.
 * @param {*} [data] A generic container for any other information about the error, i.e. the conditions that caused the
 * error, stack traces, etc. Can be <code>null</code>.
 * @param {number} [httpStatus] the HTTP status code to use for the response, defaults to 500 (Internal Server Error).
 * If specified, it should be an HTTP status code in the range [500, 599].
 */
var createJSendServerError = function(message, data, httpStatus) {
   httpStatus = httpStatus || httpStatusCodes.INTERNAL_SERVER_ERROR;
   return {
      code : httpStatus,
      status : 'fail',  // JSend calls actually calls for "error", but that seems counterintuitive and wrong
      data : data,
      message : message
   };
};

/**
 * Sets the HTTP status and sends a JSend success response, for when an API call is successful.
 *
 * @param {*} data wrapper for any data returned by the API call. If the call returns no data, this parameter should be
 * set to <code>null</code>.
 * @param {number} [httpStatus] the HTTP status code to use for the response, defaults to 200 (OK).  If specified, it
 * should be an HTTP status code in the range [200, 299].
 */
response.jsendSuccess = function(data, httpStatus) {
   var jsendObj = createJSendSuccess(data, httpStatus);
   return this.status(jsendObj.code).json(jsendObj);
};

/**
 * Sets the HTTP status and sends a JSend response for a client error, for when an API call is rejected due to invalid
 * data or call conditions.
 *
 * @param {string} message A meaningful, end-user-readable (or at the least log-worthy) message, explaining what went
 * wrong.
 * @param {*} data details of why the request failed. If the reasons for failure correspond to POST values, the response
 * object's keys SHOULD correspond to those POST values. Can be <code>null</code>.
 * @param {number} [httpStatus] the HTTP status code to use for the response, defaults to 400 (Bad Request). If
 * specified, it should be an HTTP status code in the range [400, 499].
 */
response.jsendClientError = function(message, data, httpStatus) {
   var jsendObj = createJSendClientError(message, data, httpStatus);
   return this.status(jsendObj.code).json(jsendObj);
};

/**
 * Sets the HTTP status and sends a JSend response for a client validation error, for when an API call is rejected due
 * to a data validation error.  The code will be HTTP status code 422 (Unprocessable Entity).
 *
 * @param {string} message A meaningful, end-user-readable (or at the least log-worthy) message, explaining what went
 * wrong.
 * @param {*} data details of why the request failed. If the reasons for failure correspond to POST values, the response
 * object's keys SHOULD correspond to those POST values. Can be <code>null</code>.
 */
response.jsendClientValidationError = function(message, data) {
   var jsendObj = createJSendClientValidationError(message, data);
   return this.status(jsendObj.code).json(jsendObj);
};

/**
 * Sets the HTTP status and sends a JSend response for a server error, for when an API call fails due to an error on
 * the server.
 *
 * @param {string} message A meaningful, end-user-readable (or at the least log-worthy) message, explaining what went
 * wrong.
 * @param {*} [data] A generic container for any other information about the error, i.e. the conditions that caused the
 * error, stack traces, etc. Can be <code>null</code>.
 * @param {number} [httpStatus] the HTTP status code to use for the response, defaults to 500 (Internal Server Error).
 * If specified, it should be an HTTP status code in the range [500, 599].
 */
response.jsendServerError = function(message, data, httpStatus) {
   var jsendObj = createJSendServerError(message, data, httpStatus);
   return this.status(jsendObj.code).json(jsendObj);
};

/**
 * Useful for passing a JSend response from a third party system along to the caller.  This method simply picks the
 * HTTP status code from the given <code>jsendResponse</code>, sets the response to that status code, and then send
 * the <code>jsendResponse</code>.
 *
 * @param {string|object} jsendResponse The JSend response to pass through
 */
response.jsendPassThrough = function(jsendResponse) {
   if (typeof jsendResponse === 'string') {
      jsendResponse = JSON.parse(jsendResponse);
   }
   return this.status(jsendResponse.code).json(jsendResponse);
};

/**
 * Creates an instance of a <code>JSendError</code> with the given JSend object (<code>jsendObj</code>) and optional
 * <code>message</code>.  Use this error when you need to pass an error back to the caller, but want to provide more
 * details about the error within a JSend object.
 *
 * @param {object} jsendObj Extra data about the error, in the form of a JSend object.  Will be saved in this instance's
 * <code>data</code> property.
 * @param {string} [message] Optional message about the error.
 * @constructor
 */
function JSendError(jsendObj, message) {
   this.constructor.prototype.__proto__ = Error.prototype;
   Error.captureStackTrace(this, this.constructor);
   this.name = this.constructor.name;
   this.data = jsendObj;
   this.message = message || "Error";
}

module.exports.createJSendSuccess = createJSendSuccess;
module.exports.createJSendClientError = createJSendClientError;
module.exports.createJSendClientValidationError = createJSendClientValidationError;
module.exports.createJSendServerError = createJSendServerError;
module.exports.JSendError = JSendError;
