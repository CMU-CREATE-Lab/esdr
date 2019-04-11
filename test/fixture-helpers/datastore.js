// sanity check before doing anything else--make sure we're running in test mode!
if (!require('run-mode').isTest()) {
   console.log("FATAL ERROR: the datastore fixture library may only be used in the 'test' Node environment (NODE_ENV=test). Aborting.");
   process.exit(1);
}

const fs = require('fs');
const deleteDir = require('rimraf');
const config = require('../../config');

const log4js = require('log4js');
log4js.configure('log4js-config-test.json');
const log = log4js.getLogger('esdr:test:fixture-helpers:datastore');

const DATASTORE_DATA_DIRECTORY = config.get("datastore:dataDirectory");

module.exports.erase = function(callback) {
   // delete the data directory, so we're sure we're always starting fresh
   deleteDir(DATASTORE_DATA_DIRECTORY, function(err) {
      if (err) {
         return callback(err, false);
      }

      // create the data directory
      fs.mkdir(DATASTORE_DATA_DIRECTORY, function(err) {
         if (err) {
            return callback(err, false);
         }

         log.trace("Datastore erased.");
         callback(null, true);
      });
   });
};