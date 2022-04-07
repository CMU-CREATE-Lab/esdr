# How To Use ESDR

Until I get time to write good API docs, this document will attempt to at least describe how to get data into ESDR, and how to view it with a simple visualization.

Instructions here use `curl` commands, but you could certainly imagine using other tools (e.g. [Axios](https://www.npmjs.com/package/axios)) for making HTTP requests.

## Create an Account

To begin, the first thing you should do is go to [esdr.cmucreatelab.org](https://esdr.cmucreatelab.org/) and create yourself an account.

Once your account is created and verified (ESDR will email you a verification link), follow the steps below in sequence.


## Create the OAuth2 Client

While logged in to ESDR, go to the Clients tab to create your OAuth2 client.

NOTE: The *Visibility* setting in the client creation form merely controls whether the email address and URLs associated with your client will be publicly visible.  Upon further reflection, there's probably not a great need for making any part of any client publicly visible/discoverable, so that may change.


## Authentication

Before you can do anything, you must first authenticate using your client and user account.  Create a file named `auth.json` using the content below as a template. Keep the `grant_type` set to `password`, but change the values of the other four fields. Use the Client ID and Client Secret you used above when creating your OAuth2 client, and also insert your ESDR username (i.e. your email address) and password:

```json
{
   "grant_type" : "password",
   "client_id" : "my_client",
   "client_secret" : "Secret secret, I've got a secret!",
   "username" : "email@example.com",
   "password" : "bartley"
}
```

You can now execute the following to authenticate and obtain your OAuth2 tokens:

    curl -X POST -H "Content-Type:application/json" https://esdr.cmucreatelab.org/oauth/token -d @auth.json

ESDR should respond with an HTTP 200, with content similar to:

```json
{
   "access_token":"5ea621c52a9eff664d6dec7ce4035b33d4712ed69a945521e73c8f40a305fe18",
   "refresh_token":"64cbf6915fbd25bf6954f807332810a316ad3932526f7e8acdef742ce8ef11c3",
   "userId":2,
   "expires_in":604800,
   "token_type":"Bearer"
}
```

Make a note of that `access_token`...you'll need it below.

NOTE: Since the access token expires in 7 days, you might find yourself in a situation where you need to refresh the token.  You could simply re-authenticate to get a new token, but it's typically more desirable to use the refresh token to obtain new access and refresh tokens. The process for doing so is very similar. To refresh the tokens shown above, first create a file named `refresh.json` with the following contents:

```json
{
"grant_type" : "refresh_token",
"client_id" : "my_client",
"client_secret" : "Secret secret, I've got a secret!",
"refresh_token" : "64cbf6915fbd25bf6954f807332810a316ad3932526f7e8acdef742ce8ef11c3"
}
```

Then request the new tokens:

    curl -X POST -H "Content-Type:application/json" https://esdr.cmucreatelab.org/oauth/token -d @refresh.json

ESDR should respond with an HTTP 200 and return new access and refresh tokens, similar to this:

```json
{
"access_token":"f1faf1e7d0ed139ecc19431de59247c5a933c4f1686648fdb553753b3d112983",
"refresh_token":"9eb05b1284328a07c7c5a98e744f4c0d837fdbde74576f8911aebf331ce7ab3a",
"expires_in":604800,
"token_type":"Bearer"
}
```

## Create a Product

Create a file named `product.json` using the content below as a template.  You may need to change the value for the `name` field, since product names must be unique.  A product name can contain letters, numbers, or underscores, but must contain at least one letter.

In ESDR, a product has a `defaultChannelSpecs` field, and a feed has a `channelSpecs` field (which, upon creation, defaults to the product's `defaultChannelSpecs` if not specified).  Both are expected to be JSON, but otherwise it's totally up to the user what to stick in there.  We typically use it to describe things such as a "pretty name" for a channel, the units, visualization styling, etc.

For this example, just leave the `defaultChannelSpecs` field as is.

```json
{
   "name" : "my_test_product",
   "prettyName" : "My Test Product",
   "vendor" : "Acme, Inc.",
   "description" : "A sensor that senses stuff.",
   "defaultChannelSpecs" : {
      "version" : 1,
      "channels" : {
         "temperature" : {
            "prettyName" : "Temperature",
            "units" : "C",
            "range" : {
               "min" : -273.15,
               "max" : null
            }
         },
         "conductivity" : {
            "prettyName" : "Conductivity",
            "units" : "uS/cm",
            "range" : {
               "min" : 0,
               "max" : null
            }
         },
         "battery_voltage" : {
            "prettyName" : "Battery Voltage",
            "units" : "V",
            "range" : {
               "min" : 0,
               "max" : 5
            }
         }
      }
   }
}
```

Execute the following, being sure to substitute `ACCESS_TOKEN_HERE` with the access_token you obtained above:

    curl -X POST -H "Content-Type:application/json" -H "Authorization: Bearer ACCESS_TOKEN_HERE" https://esdr.cmucreatelab.org/api/v1/products -d @product.json

ESDR should respond with an HTTP 201, with content similar to:

```json
{
   "code":201,
   "status":"success",
   "data": {
      "id":5,
      "name":"my_test_product"
   }
}
```

Remember that id...you'll need it in the next step when creating the device.


## Create a Device

Create a file named `device.json` using the content below as a template:

```json
{
   "name" : "Widget 2000",
   "serialNumber" : "abcdefghij0123456789"
}
```

In the device.json file, the `name` field is optional.  Valid characters for a serial number are alphanumeric and underscore, plus, minus, comma, and colon. The Devices table in the database treats the combo of product ID, user ID, and serial number as a compound key (to handle the case where ownership of a particular device transfers to another user).

For this command, insert your OAuth2 access token in the curl command below, and also replace `PRODUCT_ID` with the ID you obtained in the previous step.

    curl -X POST -H "Content-Type:application/json" -H "Authorization: Bearer ACCESS_TOKEN_HERE" https://esdr.cmucreatelab.org/api/v1/products/PRODUCT_ID/devices -d @device.json

ESDR should respond with an HTTP 201, with content similar to:

```json
{
   "code" : 201,
   "status" : "success",
   "data" : {
      "id" : 9,
      "name" : "Widget 2000",
      "serialNumber" : "abcdefghij0123456789"
   }
}
```

Remember that id...you'll need it in the next step when creating the feed.


## Create A Feed

Create a file named `feed.json` using the content below as a template:

```json
{
   "name" : "Back porch",
   "exposure" : "outdoor",
   "isPublic" : 0,
   "isMobile" : 0,
   "latitude" : 40.443403,
   "longitude" : -79.94564
}
```

In the feed.json file, the `name` field can be whatever you want, perhaps the same as the device name.  The "exposure" field is an enum and must be one of `indoor`, `outdoor`, or `virtual`.  Only `name` and `exposure` are required.  The `latitude` and `longitude` fields default to `null` if unspecified, and `isPublic` and `isMobile` both default to false if unspecified.

    curl -X POST -H "Content-Type:application/json" -H "Authorization: Bearer ACCESS_TOKEN_HERE" https://esdr.cmucreatelab.org/api/v1/devices/DEVICE_ID/feeds -d @feed.json

ESDR should respond with an HTTP 201, with content similar to:

```json
{
   "code" : 201,
   "status" : "success",
   "data" : {
      "id" : 11,
      "apiKey" : "48e5a9e9cfc54638742fa9ec6dec71219cfdb5a7d924a8465c248ddece10be9a",
      "apiKeyReadOnly" : "cdb373703ac19fd3734699927fb09f17f8078bb80745d539bc12ed3d3bfe6614"
   }
}
```

## Edit a Feed

ESDR supports HTTP PATCH for editing a feed, with the following restrictions:  

* PATCH requests must be authorized with OAuth2.  Attempts to patch a feed using the feed API key will be rejected with an HTTP 401 Unauthorized.
* ESDR accepts only JSON PATCH documents.
* The only JSON patch operation currently supported is `replace`.  
* The only fields within a feed that we currently allow to be patched are `name`, `isPublic`, `exposure`, `latitude`, and `longitude`.  Attempts to edit other fields will be rejected with an HTTP 422.  The JSON PATCH `path` parameters for these fields are: `/name`, `/isPublic`, `/exposure`, `/latitude`, and `/longitude`
* Multiple `replace` operations within the same JSON PATCH document for the same path will be collapsed, with a "last one wins" policy.  See below for details.  
* Field validation follows the same rules as for feed creation:
  * `name` must be a string between 1 and 255 characters
  * `isPublic` must be a boolean (`true` or `false` only...variants such as `0`, `1`, `"true"`, `"false"`, etc. will be rejected)
  * `exposure` must be one of `indoor`, `outdoor`, or `virtual`
  * `latitude` must be a number within the range [-90, 90], or `null`
  * `longitude` must be a number within the range [-180, 180], or `null`

### Last One Wins

In the case of multiple operations on the same path withing a single JSON PATCH document, we employ a "last one wins" policy, with all other operations on that path completely ignored, even if invalid.

For example, given the following JSON PATCH document:

```json
[
   { "op" : "replace", "path" : "/name", "value" : "This is a valid name" },
   { "op" : "replace", "path" : "/name", "value" : null },
   { "op" : "replace", "path" : "/name", "value" : "The best feed ever" }
]
```

...the feed would be edited to have a name of `The best feed ever`.  The first two replace operations are ignored, including even the second one which is invalid since feed names cannot be `null`.

### Example

Given a JSON file named `patch-data.json` containing the following:

```json
[
   { "op" : "replace", "path" : "/name", "value" : "The best feed ever" },
   { "op" : "replace", "path" : "/longitude", "value" : -120.340836 },
   { "op" : "replace", "path" : "/latitude", "value" : 50.676109 },
   { "op" : "replace", "path" : "/exposure", "value" : "outdoor" },
   { "op" : "replace", "path" : "/isPublic", "value" : true }
]
```

Do the following to execute a patch to a feed:

```shell
curl -X PATCH -H "Content-Type:application/json" -H "Authorization: Bearer ACCESS_TOKEN_HERE" https://esdr.cmucreatelab.org/api/v1/feeds/FEED_ID -d @patch-data.json
```

Example response upon success:

```JSON
{
   "code" : 200,
   "status" : "success",
   "data" : {
      "feedId" : 7,
      "patched" : {
         "/name" : "The best feed ever",
         "/longitude" : -120.340836,
         "/latitude" : 50.676109,
         "/exposure" : "outdoor",
         "/isPublic" : true
      }
   }
}
```

## Upload Data

We're finally ready to upload data samples to the feed.  To do so, you'll need either the feed's API Key (obtained above) or the feed ID and your OAuth2 access token.  Create a file named `data.json` and insert the following:

```json
{
   "channel_names" : ["temperature", "conductivity", "battery_voltage"],
   "data" : [
      [1380276279.1, 19.0, 516, 3.85],
      [1380449602, 19.2, 485, 3.84],
      [1380472357, 18.6, 485, 3.84],
      [1380556690, 18.3, 501, 3.84],
      [1380643808, 19.5, 583, 3.84],
      [1380725507, 19.6, 551, 3.84],
      [1380752155, 20.0, 511, 3.84],
      [1380836116, 20.7, 491, 3.84],
      [1380883999, 21.1, 612, 3.84],
      [1380909922, 20.3, 587, 3.84],
      [1380922452, 19.5, 571, 3.84],
      [1380969641, 21.8, 495, 3.84],
      [1381002132, 21.6, 503, 3.84],
      [1381062285, 22.2, 464, 3.84],
      [1381154132.009, 18.5, 565, 3.84]
   ]
}
```

Do either of the following curl commands if you want to use the feed's API Key to upload:

    curl -X PUT -H "Content-Type:application/json" https://esdr.cmucreatelab.org/api/v1/feeds/FEED_API_KEY_HERE -d @data.json

    curl -X PUT -H "Content-Type:application/json" -H "FeedApiKey: FEED_API_KEY_HERE" https://esdr.cmucreatelab.org/api/v1/feeds/FEED_ID -d @data.json

If you'd rather use the OAuth2 access token, do this:

    curl -X PUT -H "Content-Type:application/json" -H "Authorization: Bearer ACCESS_TOKEN_HERE" https://esdr.cmucreatelab.org/api/v1/feeds/FEED_ID -d @data.json

With any of the above ways to upload, the response should be the same.  It should respond with an HTTP 200, with content similar to:

```json
{
   "code" : 200,
   "status" : "success",
   "data" : {
      "channelBounds" : {
         "channels" : {
            "battery_voltage" : {
               "minTimeSecs" : 1380276279.1,
               "maxTimeSecs" : 1381154132.009,
               "minValue" : 3.84,
               "maxValue" : 3.85
            },
            "conductivity" : {
               "minTimeSecs" : 1380276279.1,
               "maxTimeSecs" : 1381154132.009,
               "minValue" : 464,
               "maxValue" : 612
            },
            "temperature" : {
               "minTimeSecs" : 1380276279.1,
               "maxTimeSecs" : 1381154132.009,
               "minValue" : 18.3,
               "maxValue" : 22.2
            }
         },
         "minTimeSecs" : 1380276279.1,
         "maxTimeSecs" : 1381154132.009
      },
      "importedBounds" : {
         "channels" : {
            "battery_voltage" : {
               "minTimeSecs" : 1380276279.1,
               "maxTimeSecs" : 1381154132.009,
               "minValue" : 3.84,
               "maxValue" : 3.85
            },
            "conductivity" : {
               "minTimeSecs" : 1380276279.1,
               "maxTimeSecs" : 1381154132.009,
               "minValue" : 464,
               "maxValue" : 612
            },
            "temperature" : {
               "minTimeSecs" : 1380276279.1,
               "maxTimeSecs" : 1381154132.009,
               "minValue" : 18.3,
               "maxValue" : 22.2
            }
         },
         "minTimeSecs" : 1380276279.1,
         "maxTimeSecs" : 1381154132.009
      }
   }
}
```

Let's take a look at the uploaded data again:

```json
{
   "channel_names" : ["temperature", "conductivity", "battery_voltage"],
   "data" : [
      [1380276279.1, 19.0, 516, 3.85],
      [1380449602, 19.2, 485, 3.84],
      [1380472357, 18.6, 485, 3.84],
      [1380556690, 18.3, 501, 3.84],
      [1380643808, 19.5, 583, 3.84],
      [1380725507, 19.6, 551, 3.84],
      [1380752155, 20.0, 511, 3.84],
      [1380836116, 20.7, 491, 3.84],
      [1380883999, 21.1, 612, 3.84],
      [1380909922, 20.3, 587, 3.84],
      [1380922452, 19.5, 571, 3.84],
      [1380969641, 21.8, 495, 3.84],
      [1381002132, 21.6, 503, 3.84],
      [1381062285, 22.2, 464, 3.84],
      [1381154132.009, 18.5, 565, 3.84]
   ]
}
```

You'll notice that there are only three names in the `channel_names` array, but four values in each of the data arrays.  That's because ESDR assumes that the first value in each data array is the sample's timestamp.  The timestamp must be numeric--it's UNIX time, in seconds.  Internally, it's stored as a double, so it can have a decimal component to represent fractional seconds.

There are also strict rules for channel names.  A channel name must:

* be a string
* be non-empty
* not start or end with a dot
* not contain two or more consecutive dots
* consist of only the following characters: a-z, A-Z, 0-9, underscore (_), dot (.), and dash (-)

As mentioned above, we use a feed's `channelSpecs` field to map pretty names and units to each of the channel names, for use in visualizations.

## Queries

Querying over clients, products, devices, and feeds is fairly robust.  You can do where clauses joined by AND or OR (or both), order by (ASC or DESC), limit, offset, and specify which fields you want to select.  Where clauses also support comparison with =, <>, <, <=, >, >=, is null, and is not null.  Simple examples:

* List all public clients: [https://esdr.cmucreatelab.org/api/v1/clients](https://esdr.cmucreatelab.org/api/v1/clients)
* List all products:  [https://esdr.cmucreatelab.org/api/v1/products](https://esdr.cmucreatelab.org/api/v1/products)
* List all products, but retrieving only the `id` and `name`:  [https://esdr.cmucreatelab.org/api/v1/products?fields=id,name](https://esdr.cmucreatelab.org/api/v1/products?fields=id,name)
* List all public feeds:  [https://esdr.cmucreatelab.org/api/v1/feeds](https://esdr.cmucreatelab.org/api/v1/feeds)
* List all public feeds for the ACHD product (product ID 1), but retrieve only the `id`, `name`, `latitude`, `longitude`, and `lastUpload` fields:  [https://esdr.cmucreatelab.org/api/v1/feeds?where=productId=1&fields=id,name,latitude,longitude,lastUpload](https://esdr.cmucreatelab.org/api/v1/feeds?where=productId=1&fields=id,name,latitude,longitude,lastUpload)
* List ACHD product feeds, retrieving only the `id`, `name` fields, and sorted by id in descending order:  [https://esdr.cmucreatelab.org/api/v1/feeds?where=productId=1&fields=id,name&orderBy=-id](https://esdr.cmucreatelab.org/api/v1/feeds?where=productId=1&fields=id,name&orderBy=-id)
* List ACHD and RAMP feeds (products 1 and 68, respectively), ordered by `productId` in ascending order and then `feedId` in descending order: [https://esdr.cmucreatelab.org/api/v1/feeds?fields=id,name,productId&whereOr=productId=1,productId=68&orderBy=productId,-id](https://esdr.cmucreatelab.org/api/v1/feeds?fields=id,name,productId&whereOr=productId=1,productId=68&orderBy=productId,-id)
* List the 10 most recently updated (i.e. received an upload) PurpleAir feeds, sorted by `lastUpload` in descending order: [https://esdr.cmucreatelab.org/api/v1/feeds?fields=id,name,lastUpload&where=productId=69&orderBy=-lastUpload&limit=10](https://esdr.cmucreatelab.org/api/v1/feeds?fields=id,name,lastUpload&where=productId=69&orderBy=-lastUpload&limit=10) 
* List PurpleAir feeds located within a bounding box roughly around Allegheny County PA: [https://esdr.cmucreatelab.org/api/v1/feeds?fields=id,name,latitude,longitude&whereAnd=productId=69,latitude%3E=39.420978,latitude%3C=40.756547,longitude%3E=-81.451293,longitude%3C=-79.677010](https://esdr.cmucreatelab.org/api/v1/feeds?fields=id,name,latitude,longitude&whereAnd=productId=69,latitude%3E=39.420978,latitude%3C=40.756547,longitude%3E=-81.451293,longitude%3C=-79.677010)
* List all outdoor ACHD, RAMP, PurpleAir, and Airviz monitors within a lat/long bounding box (the `whereJoin` query parameter specifies how to join the `whereAnd` and `whereOr` clauses): [https://esdr.cmucreatelab.org/api/v1/feeds?offset=0&whereAnd=latitude%3E=40.19740606389117,latitude%3C=40.65260973628207,longitude%3E=-80.21541759011052,longitude%3C=-79.61736838677,exposure=outdoor&whereOr=productId=1,productId=68,productId=69,productId=82&whereJoin=AND&fields=id,name](https://esdr.cmucreatelab.org/api/v1/feeds?offset=0&whereAnd=latitude%3E=40.19740606389117,latitude%3C=40.65260973628207,longitude%3E=-80.21541759011052,longitude%3C=-79.61736838677,exposure=outdoor&whereOr=productId=1,productId=68,productId=69,productId=82&whereJoin=AND&fields=id,name)

NOTE: Searching over devices requires you to supply the OAuth2 access token in the request header.

## Get Info

### Single Feed

For any public feed, you can get (JSON) info about the feed with:

    curl https://esdr.cmucreatelab.org/api/v1/feeds/FEED_ID

For example, this:

    curl 'https://esdr.cmucreatelab.org/api/v1/feeds/26?fields=id,name,latitude,longitude,lastUpload'

...will return something like this:

```json
{
   "code" : 200,
   "status" : "success",
   "data" : {
      "id" : 26,
      "name" : "Lawrenceville ACHD",
      "latitude" : 40.46542,
      "longitude" : -79.960757,
      "lastUpload" : "2021-05-11T19:36:19.000Z"
   }
}
```

If you want the read-write feed API Key, you need to provide the OAuth2 access token in the Authorization request header.

You can also get info for a feed using the feed's read-write or read-only API key.  The URL is the same as above, but use the API key instead of the `FEED_ID`.

If you want the info as CSV, append `format=csv` in the query string, e.g.:

    curl 'https://esdr.cmucreatelab.org/api/v1/feeds/FEED_ID?format=csv'

For example, this:

    curl 'https://esdr.cmucreatelab.org/api/v1/feeds/26?fields=id,name,latitude,longitude,lastUpload,channelBounds,channelSpecs&format=csv'

...will return something like this:

```text
id,name,latitude,longitude,lastUpload
26,Lawrenceville ACHD,40.46542,-79.960757,2021-05-12T13:36:16.000Z
```

### Multiple Feeds

ESDR's API also supports retrieving metadata for multiple feeds using the query language described above.  For example, this returns the `id`, `name`, `latitude`, `longitude`, and `lastUpload` fields of the first five ACHD feeds when sorted by name in alphabetical order:

    curl 'https://esdr.cmucreatelab.org/api/v1/feeds?where=productId=1&fields=id,name,latitude,longitude,lastUpload&orderBy=name&limit=5'

That will return something like this:

```json
{
   "code" : 200,
   "status" : "success",
   "data" : {
      "totalCount" : 22,
      "rows" : [
         {
            "id" : 1,
            "name" : "Avalon ACHD",
            "latitude" : 40.499767,
            "longitude" : -80.071337,
            "lastUpload" : "2021-05-12T15:36:04.000Z"
         },
         {
            "id" : 2,
            "name" : "Avalon ACHD",
            "latitude" : 40.499767,
            "longitude" : -80.071337,
            "lastUpload" : "0000-00-00 00:00:00"
         },
         {
            "id" : 26086,
            "name" : "Clairton ACHD",
            "latitude" : 40.294341,
            "longitude" : -79.885331,
            "lastUpload" : "2019-12-19T13:36:13.000Z"
         },
         {
            "id" : 22,
            "name" : "Court House ACHD",
            "latitude" : 40.438632,
            "longitude" : -80.002543,
            "lastUpload" : "2014-12-03T12:35:38.000Z"
         },
         {
            "id" : 23,
            "name" : "Flag Plaza ACHD",
            "latitude" : 40.443367,
            "longitude" : -79.990293,
            "lastUpload" : "2021-05-12T15:36:07.000Z"
         }
      ],
      "offset" : 0,
      "limit" : 5
   }
}
```

Or, the same in CSV format:

    curl 'https://esdr.cmucreatelab.org/api/v1/feeds?where=productId=1&fields=id,name,latitude,longitude,lastUpload&orderBy=name&limit=5&format=csv'

...will return something like this:

```text
id,name,latitude,longitude,lastUpload
1,Avalon ACHD,40.499767,-80.071337,2021-05-12T15:36:04.000Z
2,Avalon ACHD,40.499767,-80.071337,0000-00-00 00:00:00
26086,Clairton ACHD,40.294341,-79.885331,2019-12-19T13:36:13.000Z
22,Court House ACHD,40.438632,-80.002543,2014-12-03T12:35:38.000Z
23,Flag Plaza ACHD,40.443367,-79.990293,2021-05-12T15:36:07.000Z
```

### Notes About CSV format for Feed Metadata

Important notes about retrieving feed metadata as CSV:

* Feed names containing a comma will be quoted in the returned CSV.
* Returned date fields will be in simplified extended ISO format (ISO 8601).
* Field values which are `null` in JSON metadata are returned as an empty string in CSV.
* The CSV format will never include the `channelSpecs` or `channelBounds` fields, regardless of whether you explicitly ask for it.  They're both JSON fields, so the rationale is that if you know how to deal with JSON, then you wouldn't be requesting feed metadata as CSV.

## Fetch Tiles

For any public feed, you can fetch tiles with:

    curl https://esdr.cmucreatelab.org/api/v1/feeds/FEED_ID_OR_API_KEY/channels/CHANNEL_NAME/tiles/LEVEL.OFFSET

If the feed is private, give it either the read-write or the read-only feed API Key, or your OAuth2 access token (which, again, will be slightly slower due to the extra SQL select).

ESDR also has a "multi-get-tile" API method which will let you get tiles for any number of channels from any number of feeds in a single call.  This is critical to supporting visualizations of large numbers of sensors.  The initial version is working, but it is still in flux, so documentation will be provided once the API is more stable.

Details about how to compute `level` and `offset` are provided in [Fluxtream/BodyTrack's API docs](https://fluxtream.atlassian.net/wiki/display/FLX/BodyTrack+server+APIs#BodyTrackserverAPIs-Formattingoftime).

See the Viewing Data section below for an example which makes tile fetches.


## Most Recent

Sometimes, all you care about is the most recent value(s).  For example, if you're polling the feed every few minutes, then it probably makes sense to use the most-recent method instead of export or tile fetching, e.g.:

    https://esdr.cmucreatelab.org/api/v1/feeds/FEED_ID_OR_API_KEY/most-recent

Or, for a single channel:

	 https://esdr.cmucreatelab.org/api/v1/feeds/FEED_ID_OR_API_KEY/channels/CHANNEL_NAME/most-recent


## Viewing Data

See the `/public/plot/index.html` file in this repository for an example of the grapher doing tile fetches to render the plot. Just open it in your browser, then append `?feed=FEED_ID_OR_API_KEY` to the URL, replacing `FEED_ID_OR_API_KEY` with your feed's ID (if public) or API key (obtained above when you created the feed).

A fancier version will eventually be rolled into ESDR, but this at least provides a simple way to view feed channels.

## Export

There are two API methods for exporting ESDR feed data: 

* one for exporting one or more channels from a single feed, with support for exporting from a private feed
* one for exporting one or more channels from one or more *public* feeds.

Timestamps of exported data will be in UNIX epoch time if no timezone is specified.  If a timezone parameter is specified, timestamps will be ISO8601 format for the given timezone.  The value of the timezone parameter is case-sensitive and must be a name from the [IANA time zone database](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) (e.g. "UTC", "America/New_York", etc).

### Exporting Data from a Single Feed

Use this method when you want to export one or more channels from a single (public or private) feed to CSV (the default) or JSON.

Here's the format:

    https://esdr.cmucreatelab.org/api/v1/feeds/FEED_ID_OR_API_KEY/channels/ONE_OR_MORE_CHANNELS_COMMA_DELIMITED/export?from=UNIX_TIME_SECS&to=UNIX_TIME_SECS&format=[csv|json]&timezone=IANA_TIMEZONE

The "from", "to", "format", and "timezone" parameters are all optional.  

Examples:

    https://esdr.cmucreatelab.org/api/v1/feeds/4231/channels/PM2_5_daily_mean,PM2_5_daily_max,PM2_5_daily_median/export
   
    https://esdr.cmucreatelab.org/api/v1/feeds/1/channels/PM25B_UG_M3_daily_mean/export?from=1420088400&to=1451624399&format=json
    
    https://esdr.cmucreatelab.org/api/v1/feeds/1/channels/PM25B_UG_M3_daily_mean/export?from=1420088400&to=1451624399&format=csv&timezone=America/New_York

### Exporting Data from Multiple Feeds

Use this method when you want to export data from multiple public feeds.  Support for exporting from multiple private feeds, or a mix or public and private may be added in the future.  Currently, any private feeds specified will be ignored.  If only private feeds are specified, the method returns an HTTP 404.

Here's the format:

    https://esdr.cmucreatelab.org/api/v1/feeds/export/feedId.channelName[,feedId.channelName,...]?from=UNIX_TIME_SECS&to=UNIX_TIME_SECS&format=[csv|json]&timezone=IANA_TIMEZONE

As with the single-feed export API method, the "from", "to", "format", and "timezone" parameters are all optional.

Examples:

    https://esdr.cmucreatelab.org/api/v1/feeds/export/4231.PM2_5_daily_mean,4231.PM2_5_daily_max,4231.PM2_5_daily_median

    https://esdr.cmucreatelab.org/api/v1/feeds/export/26.OUT_T_DEGC,28.SO2_PPM?from=1609563600&to=1609606800&format=json

    https://esdr.cmucreatelab.org/api/v1/feeds/export/26.OUT_T_DEGC,28.SO2_PPM?from=1609563600&to=1609606800&format=csv&timezone=America/New_York
