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
   var noSuperagentMsg = "The superagent library is required by org.cmucreatelab.esdr.AccessToken.js";
   alert(noSuperagentMsg);
   throw new Error(noSuperagentMsg);
}
//======================================================================================================================

(function() {

   org.cmucreatelab.esdr.AccessToken = function() {

      var accessToken = null;

      this.load = function(callback) {
         if (accessToken != null) {
            return callback(null, accessToken);
         }
         superagent
               .get("/access-token?no-cache=" + new Date().getTime())
               .end(function(err, res) {
                       if (err) {
                          return callback(new Error("Failed to get the access token due to an unexpected error."));
                       }
                       // remember the accessToken for later, then return to the caller
                       accessToken = res.body.data ? res.body.data.token : null;
                       return callback(null, accessToken);
                    });
      };

      this.get = function() {
         return accessToken;
      };

      this.set = function(newAccessToken) {
         accessToken = newAccessToken;
      };
   };

})();
