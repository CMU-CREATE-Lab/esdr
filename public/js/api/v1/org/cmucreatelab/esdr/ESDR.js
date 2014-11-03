//======================================================================================================================
// VERIFY NAMESPACE
//======================================================================================================================
// Create the global symbol "org" if it doesn't exist.  Throw an error if it does exist but is not an object.
var org;
if (!org) {
   org = {};
}
else {
   if (typeof org != "object") {
      var orgExistsMessage = "Error: failed to create org namespace: org already exists and is not an object";
      alert(orgExistsMessage);
      throw new Error(orgExistsMessage);
   }
}

if (!org.cmucreatelab) {
   org.cmucreatelab = {};
}
else {
   if (typeof org.cmucreatelab != "object") {
      var orgCmucreatelabExistsMessage = "Error: failed to create org.cmucreatelab namespace: org.cmucreatelab already exists and is not an object";
      alert(orgCmucreatelabExistsMessage);
      throw new Error(orgCmucreatelabExistsMessage);
   }
}

if (!org.cmucreatelab.esdr) {
   org.cmucreatelab.esdr = {};
}
else {
   if (typeof org.cmucreatelab.esdr != "object") {
      var orgCmucreatelabEsdrExistsMessage = "Error: failed to create org.cmucreatelab.esdr namespace: org.cmucreatelab.esdr already exists and is not an object";
      alert(orgCmucreatelabEsdrExistsMessage);
      throw new Error(orgCmucreatelabEsdrExistsMessage);
   }
}
//======================================================================================================================
// DEPENDECIES
//======================================================================================================================
if (!window['superagent']) {
   var noSuperagentMsg = "The superagent library is required by org.cmucreatelab.esdr.ESDR.js";
   alert(noSuperagentMsg);
   throw new Error(noSuperagentMsg);
}
//======================================================================================================================

/*
 Products
 --------
 POST  /products - create new product
 GET   /products - search for products (allows field selection)
 GET   /products/:productNameOrId - get details for a specific product (allows field selection)

 Devices (auth required for all these)
 -------
 * POST  /products/:productNameOrId/devices - create new device
 * GET   /products/:productNameOrId/devices/:serialNumber - get info for a specific device (allows field selection)
 GET   /devices - search for devices (allows field selection)
 GET   /devices/:deviceId - get details for a specific device (allows field selection)

 Feeds
 -----
 * POST  /devices/:deviceId/feeds - create a new feed
 * GET   /feeds - search for feeds (allows field selection)
 PUT   /feeds/:feedId - for uploads authenticated using the user's OAuth2 access token in the header
 GET   /feeds/:feedId - for getting info about a feed, authenticated using the user's OAuth2 access token in the request header (but only if the feed is private)
 GET   /feeds/:feedId/channels/:channelName/tiles/:level.:offset - for tile requests optionally authenticated using the user's OAuth2 access token in the header
 PUT   /feed - for uploads authenticated using the feed's API Key in the header
 GET   /feed - for getting info about a feed, authenticated using the feed's API Key in the request header
 GET   /feed/channels/:channelName/tiles/:level.:offset - for tile requests authenticated using the feed's API Key in the header
 */

(function() {
   var SCRIPT_PATH = "/js/api/v1/org/cmucreatelab/esdr/ESDR.js";

   // figure out the URL used to load this file, and use the protocol,
   // domain, and port for building the root REST API URL.
   var ESDR_API_ROOT_URL = (function() {
      // Iterate over the various <script> elements, looking for the one that includes
      // this script.  Do the iteration in reverse order, which should usually turn up
      // this one in the first element (not so if other scripts are inserted asynchronously
      // into the DOM).
      var scripts = document.getElementsByTagName('script');
      for (var i = scripts.length - 1; i >= 0; i--) {
         var src = scripts[i].src;
         var position = src.indexOf(SCRIPT_PATH);
         if (position !== -1) {
            var url = src.slice(0, position) + "/api/v1";
            console.log("ESDR REST API URL: " + url);
            return url;
         }
      }

      throw new Error("Could not determine the root URL for the ESDR REST API");
   })();

   org.cmucreatelab.esdr.ESDR = function(accessToken) {

      var authorizationHeader = {
         Authorization : "Bearer " + accessToken
      };

      var createResponseHandler = function(callbacks) {
         return function(err, res) {
            if (typeof callbacks.complete === 'function') {
               callbacks.complete(err, res);
            }

            if (err) {
               return callbacks.failure(err, res.status);
            }

            switch (res.status) {
               case 200:
                  return callbacks.success(res.body.data);
               case 201:
                  return callbacks.created(res.body.data);
               case 400:
                  return callbacks.badRequest();
               case 401:
                  return callbacks.unauthorized();
               case 403:
                  return callbacks.forbidden();
               case 404:
                  return callbacks.notFound();
               case 409:
                  return callbacks.duplicate();
               case 422:
                  return callbacks.validationError(res.body.data);
               default:
                  return callbacks.error(res.body, res.status);
            }
         };
      };

      // trims and makes sure it starts with a question mark
      var sanitizeQueryString = function(queryString){
         queryString = (queryString || "").trim();
         if (queryString.length > 0 && queryString.lastIndexOf('?', 0) !== 0) {
            queryString = "?" + queryString;
         }
         return queryString;
      };

      this.products = {};

      this.devices = {

         /**
          * Creates a new device with the given serial number for the given product.
          *
          * Required callbacks:
          * - created(device)
          * - duplicate()
          * - validationError(errors)
          * - error(responseBody, httpStatusCode)
          * - failure(err, httpStatusCode)
          *
          * Optional callbacks:
          * - complete() [optional]
          *
          * @param {string|int} productNameOrId Name or ID of the product for this device
          * @param {obj} device Details for the new device (name and serialNumber)
          * @param {obj} callbacks
          */
         create : function(productNameOrId, device, callbacks) {
            superagent
                  .post(ESDR_API_ROOT_URL + "/products/" + productNameOrId + "/devices")
                  .set(authorizationHeader)
                  .send(device)
                  .end(createResponseHandler(callbacks));
         },

         /**
          * Find devices owned by the user according to the parameters specified in the given query string.
          *
          * Required callbacks:
          * - success(feeds)
          * - unauthorized()
          * - validationError(errors)
          * - error(responseBody, httpStatusCode)
          * - failure(err, httpStatusCode)
          *
          * Optional callbacks:
          * - complete() [optional]
          *
          * @param queryString
          * @param callbacks
          */
         find : function(queryString, callbacks) {
            superagent
                  .get(ESDR_API_ROOT_URL + "/devices" + sanitizeQueryString(queryString))
                  .set(authorizationHeader)
                  .end(createResponseHandler(callbacks));
         },

         /**
          * Get info for a specific device.
          *
          * Required callbacks:
          * - success(device)
          * - unauthorized()
          * - notFound()
          * - error(responseBody, httpStatusCode)
          * - failure(err, httpStatusCode)
          *
          * Optional callbacks:
          * - complete() [optional]
          *
          * @param {string|int} productNameOrId Name or ID of the product for this device
          * @param {string} deviceSerialNumber Serial number of the device
          * @param {string} fieldsToSelect Comma-delimited string of the fields to select. Returns all fields if
          * <code>null</code> or an empty string.
          * @param {obj} callbacks
          */
         findByProductAndSerialNumber : function(productNameOrId, deviceSerialNumber, fieldsToSelect, callbacks) {
            fieldsToSelect = fieldsToSelect || "";
            superagent
                  .get(ESDR_API_ROOT_URL + "/products/" + productNameOrId + "/devices/" + deviceSerialNumber + "?fields=" + fieldsToSelect.trim())
                  .set(authorizationHeader)
                  .end(createResponseHandler(callbacks));
         }
      };

      this.feeds = {

         /**
          * Creates a new feed for the device specified by the given device ID.
          *
          * Required callbacks:
          * - created(creationResult)
          * - unauthorized()
          * - forbidden()
          * - notFound()
          * - validationError(errors)
          * - error(responseBody, httpStatusCode)
          * - failure(err, httpStatusCode)
          *
          * Optional callbacks:
          * - complete() [optional]
          *
          * @param {int} deviceId Device ID of the feed to be created
          * @param {obj} feed Object containing the various properties for the feed to be created
          * @param {obj} callbacks
          */
         create : function(deviceId, feed, callbacks) {
            superagent
                  .post(ESDR_API_ROOT_URL + "/devices/" + deviceId + "/feeds")
                  .set(authorizationHeader)
                  .send(feed)
                  .end(createResponseHandler(callbacks));
         },

         /**
          * Find feeds according to the parameters specified in the given query string.
          *
          * Required callbacks:
          * - success(feeds)
          * - validationError(errors)
          * - error(responseBody, httpStatusCode)
          * - failure(err, httpStatusCode)
          *
          * Optional callbacks:
          * - complete() [optional]
          *
          * @param queryString
          * @param callbacks
          */
         find : function(queryString, callbacks) {
            superagent
                  .get(ESDR_API_ROOT_URL + "/feeds" + sanitizeQueryString(queryString))
                  .set(authorizationHeader)
                  .end(createResponseHandler(callbacks));
         },

         /**
          * Uploads the given data to the feed specifed by the given <code>apiKey</code>.
          *
          * Required callbacks:
          * - success(creationResult)
          * - badRequest()
          * - unauthorized()
          * - forbidden()
          * - validationError(errors)
          * - error(responseBody, httpStatusCode)
          * - failure(err, httpStatusCode)
          *
          * Optional callbacks:
          * - complete() [optional]
          *
          * @param {string} apiKey The feed's (read/write) API Key
          * @param {obj} data The data to upload
          * @param {obj} callbacks
          */
         upload : function(apiKey, data, callbacks) {
            superagent
                  .put(ESDR_API_ROOT_URL + "/feed")
                  .set({
                          ApiKey : apiKey
                       })
                  .send(data)
                  .end(createResponseHandler(callbacks));
         }
      };

      this.tiles = {
         /**
          * Gets a tile for the feed specified by the given <code>apiKey</code>.
          *
          * Required callbacks:
          * - success(creationResult)
          * - unauthorized()
          * - forbidden()
          * - error(responseBody, httpStatusCode)
          * - failure(err, httpStatusCode)
          *
          * Optional callbacks:
          * - complete() [optional]
          *
          * @param {string} apiKey The feed's API Key (either the read/write or read-only key)
          * @param {string} channelName The channel name
          * @param {int} level The tile's level
          * @param {int} offset The tile's offset
          * @param {obj} callbacks
          */
         get : function(apiKey, channelName, level, offset, callbacks) {
            superagent
                  .get(ESDR_API_ROOT_URL + "/feed/channels/" + channelName + "/tiles/" + level + "." + offset)
                  .set({
                          ApiKey : apiKey
                       })
                  .end(createResponseHandler(callbacks));
         }

      };
   };

})();