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
               return callbacks.failure(err, res ? res.status : null);
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
                  if (typeof callbacks.conflict === 'function') {
                     return callbacks.conflict(res.body.data);
                  }
                  else {
                     return callbacks.duplicate();
                  }
               case 413:
                  return callbacks.entityTooLarge();
               case 422:
                  return callbacks.validationError(res.body.data);
               default:
                  return callbacks.error(res.body, res.status);
            }
         };
      };

      // trims and makes sure it starts with a question mark
      var sanitizeQueryString = function(queryString) {
         queryString = (queryString || "").trim();
         if (queryString.length > 0 && queryString.lastIndexOf('?', 0) !== 0) {
            queryString = "?" + queryString;
         }
         return queryString;
      };

      this.clients = {
         /**
          * Creates a new client.
          *
          * Required callbacks:
          * - created(createdClient)
          * - duplicate()
          * - unauthorized()
          * - validationError(errors)
          * - error(responseBody, httpStatusCode)
          * - failure(err, httpStatusCode)
          *
          * Optional callbacks:
          * - complete() [optional]
          *
          * @param {obj} client Details for the new client
          * @param {obj} callbacks
          */
         create : function(client, callbacks) {
            superagent
                  .post(ESDR_API_ROOT_URL + "/clients")
                  .set(authorizationHeader)
                  .send(client)
                  .end(createResponseHandler(callbacks));
         },

         /**
          * Find clients optionally filtered according to the parameters specified in the given query string.
          *
          * Required callbacks:
          * - success(devices)
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
                  .get(ESDR_API_ROOT_URL + "/clients" + sanitizeQueryString(queryString))
                  .set(authorizationHeader)
                  .end(createResponseHandler(callbacks));
         }
      };

      this.users = {
         /**
          * Returns info for the user specified by the given <code>userId</code>.  Requires authorization, so it will
          * only succeed when requesting info for the authorized user.
          *
          * Required callbacks:
          * - success(userInfo)
          * - unauthorized()
          * - forbidden()
          * - error(responseBody, httpStatusCode)
          * - failure(err, httpStatusCode)
          *
          * @param userId
          * @param callbacks
          */
         findById : function(userId, callbacks) {
            superagent
                  .get(ESDR_API_ROOT_URL + "/users/" + userId)
                  .set(authorizationHeader)
                  .end(createResponseHandler(callbacks));
         }
      };

      this.products = {};

      this.devices = {

         /**
          * Creates a new device with the given serial number for the given product.
          *
          * Required callbacks:
          * - created(device)
          * - duplicate()
          * - unauthorized()
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
          * Deletes the device with the given deviceId.
          *
          * Required callbacks:
          * - success(data)
          * - conflict(data)
          * - unauthorized()
          * - forbidden()
          * - notFound()
          * - error(responseBody, httpStatusCode)
          * - failure(err, httpStatusCode)
          *
          * Optional callbacks:
          * - complete() [optional]
          *
          * @param {int} deviceId ID of the device to delete
          * @param {obj} callbacks
          */
         deleteDevice : function(deviceId, callbacks) {
            superagent
                  .del(ESDR_API_ROOT_URL + "/devices/" + deviceId)
                  .set(authorizationHeader)
                  .end(createResponseHandler(callbacks));
         },

         /**
          * Find devices owned by the user according to the parameters specified in the given query string.
          *
          * Required callbacks:
          * - success(devices)
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

      this.deviceProperties = {
         set : function(deviceId, key, value, callbacks){
            superagent
                  .put(ESDR_API_ROOT_URL + "/devices/" + deviceId + "/properties/" + key)
                  .set(authorizationHeader)
                  .send(value)
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
          * Deletes the feed with the given feedId.
          *
          * Required callbacks:
          * - success(data)
          * - unauthorized()
          * - forbidden()
          * - notFound()
          * - error(responseBody, httpStatusCode)
          * - failure(err, httpStatusCode)
          *
          * Optional callbacks:
          * - complete() [optional]
          *
          * @param {int} feedId ID of the feed to delete
          * @param {obj} callbacks
          */
         deleteFeed : function(feedId, callbacks) {
            superagent
                  .del(ESDR_API_ROOT_URL + "/feeds/" + feedId)
                  .set(authorizationHeader)
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
          * @param {string} queryString
          * @param {obj} callbacks
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
          * - entityTooLarge()
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
                          FeedApiKey : apiKey
                       })
                  .send(data)
                  .end(createResponseHandler(callbacks));
         }
      };

      this.multifeeds = {

         /**
          * Returns the feeds included in the specified multifeed set. Returned feed fields can (and should!) be
          * filtered with the "fields" query string param. The various where clause query string params are ignored, but
          * results can be sorted with orderBy and/or windowed with limit and offset.
          *
          * Required callbacks:
          * - success(feeds)
          * - error(responseBody, httpStatusCode)
          * - failure(err, httpStatusCode)
          *
          * Optional callbacks:
          * - complete() [optional]
          *
          * @param {string|int} nameOrId - multifeed name or id
          * @param {string} queryString
          * @param {obj} callbacks
          */
         getFeeds : function(nameOrId, queryString, callbacks) {
            superagent
                  .get(ESDR_API_ROOT_URL + "/multifeeds/" + nameOrId + "/feeds" + sanitizeQueryString(queryString))
                  .end(createResponseHandler(callbacks));
         }
      };

      this.tiles = {
         /**
          * Gets a tile for the feed specified by the given <code>feedId</code> and optional <code>apiKey</code>.
          *
          * Required callbacks:
          * - success(tile)
          * - unauthorized()
          * - forbidden()
          * - error(responseBody, httpStatusCode)
          * - failure(err, httpStatusCode)
          *
          * Optional callbacks:
          * - complete() [optional]
          *
          * @param {int} feedIdOrApiKey The feed's ID or API Key (either the read/write or read-only key).
          * @param {string} channelName The channel name
          * @param {int} level The tile's level
          * @param {int} offset The tile's offset
          * @param {obj} callbacks
          */
         get : function(feedIdOrApiKey, channelName, level, offset, callbacks) {
            superagent
                  .get(ESDR_API_ROOT_URL + "/feeds/" + feedIdOrApiKey + "/channels/" + channelName + "/tiles/" + level + "." + offset)
                  .end(createResponseHandler(callbacks));
         }

      };
   };

})();
