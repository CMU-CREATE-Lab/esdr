// sanity check: make sure we're running in test mode!
if (!require('run-mode').isTest()) {
   console.log("FATAL ERROR: the wipe fixture library may only be used in the 'test' Node environment (NODE_ENV=test). Aborting.");
   process.exit(1);
}

var flow = require('nimble');
var database = require("./database");
var datastore = require("./datastore");

module.exports.wipeAllData = function(callback) {
   flow.series(
         [
            datastore.erase,
            database.wipeAllTables
         ],
         callback
   );
};