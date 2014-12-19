var Query2Query = require('query2query');

var query2query = new Query2Query();
query2query.addField('id', true, true, false, Query2Query.types.INTEGER);
query2query.addField('name', true, true, false);
query2query.addField('deviceId', true, true, false, Query2Query.types.INTEGER);
query2query.addField('productId', true, true, false, Query2Query.types.INTEGER);
query2query.addField('userId', true, true, false, Query2Query.types.INTEGER);
query2query.addField('apiKey', false, false, false);
query2query.addField('apiKeyReadOnly', false, false, false);
query2query.addField('exposure', true, true, false);
query2query.addField('isPublic', true, true, false, Query2Query.types.BOOLEAN);
query2query.addField('isMobile', true, true, false, Query2Query.types.BOOLEAN);
query2query.addField('latitude', true, true, true, Query2Query.types.NUMBER);
query2query.addField('longitude', true, true, true, Query2Query.types.NUMBER);
query2query.addField('channelSpecs', false, false, false);
query2query.addField('channelBounds', false, false, true);
query2query.addField('created', true, true, false, Query2Query.types.DATETIME);
query2query.addField('modified', true, true, false, Query2Query.types.DATETIME);
query2query.addField('lastUpload', true, true, false, Query2Query.types.DATETIME);
query2query.addField('minTimeSecs', true, true, true, Query2Query.types.NUMBER);
query2query.addField('maxTimeSecs', true, true, true, Query2Query.types.NUMBER);

module.exports = query2query;