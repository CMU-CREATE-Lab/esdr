#How To Use ESDR

Until I get time to write good API docs, this document will attempt to at least describe how to get data into ESDR, and how to view it with a simple visualization.

Instructions here use `curl` commands, but you could certainly imagine using other tools for making HTTP requests ([Superagent](http://visionmedia.github.io/superagent/) is my current favorite).

##Create an Account

To begin, the first thing you should do is go to [esdr.cmucreatelab.org](https://esdr.cmucreatelab.org/) and create yourself an account.

Once your account is created and verified (ESDR will email you a verification link), follow the steps below in sequence.


##Create the OAuth2 Client

While logged in to ESDR, go to the Clients tab to create your OAuth2 client.

NOTE: The *Visibility* setting in the client creation form merely controls whether the email address and URLs associated with your client will be publicly visible.  Upon further reflection, there's probably not a great need for making any part of any client publicly visible/discoverable, so that may change.


##Authentication

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

##Create a Product

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


##Create a Device

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


##Create A Feed

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

##Upload Data

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

##Get Info

For any public feed, you can get info about the feed with:

    curl https://esdr.cmucreatelab.org/api/v1/feeds/FEED_ID

If you want the read-write feed API Key, you need to provide the OAuth2 access token in the Authorization request header.

You can also get info for a feed using the feed's read-write or read-only API key.  The URL is the same as above, but use the API key instead of the `FEED_ID`.


##Fetch Tiles

For any public feed, you can fetch tiles with:

    curl https://esdr.cmucreatelab.org/api/v1/feeds/FEED_ID_OR_API_KEY/channels/CHANNEL_NAME/tiles/LEVEL.OFFSET

If the feed is private, give it either the read-write or the read-only feed API Key, or your OAuth2 access token (which, again, will be slightly slower due to the extra SQL select).

ESDR also has a "multi-get-tile" API method which will let you get tiles for any number of channels from any number of feeds in a single call.  This is critical to supporting visualizations of large numbers of sensors.  The initial version is working, but it is still in flux, so documentation will be provided once the API is more stable.

Details about how to compute `level` and `offset` are provided in [Fluxtream/BodyTrack's API docs](https://fluxtream.atlassian.net/wiki/display/FLX/BodyTrack+server+APIs#BodyTrackserverAPIs-Formattingoftime).

See the next section for an example which makes tile fetches.

##Viewing Data

See the `/etc/plot.html` file in this repository for an example of the grapher doing tile fetches to render the plot. Just double-click it to open it in your browser, then append `?feed=FEED_ID_OR_API_KEY` to the URL, replacing `FEED_ID_OR_API_KEY` with your feed's ID (if public) or its read-write API key (obtained above when you created the feed).

A fancier version will eventually be rolled into ESDR, but this at least provides a simple way to view feed channels.

##Export

You can currently export one or more channels from a single feed to CSV.  We'll add JSON support soon.

Here's how the current single-feed export works:

    https://esdr.cmucreatelab.org/api/v1/feeds/FEED_ID_OR_API_KEY/channels/ONE_OR_MORE_CHANNELS_COMMA_DELIMITED/export?from=UNIX_TIME_SECS&to=UNIX_TIME_SECS

The "from" and "to" filters are optional.

Multi-feed export is coming soon, too.


##Queries

Querying over clients, products, devices, and feeds is fairly robust.  You can do where clauses joined by AND or OR (or both), order by (ASC or DESC), limit, offset, and specify which fields you want to select.  Where clauses also support comparison with =, <>, <, <=, >, >=, is null, and is not null.  Detailed examples will be coming soon.  Some simple examples:

* List all public clients: https://esdr.cmucreatelab.org/api/v1/clients
* List all products:  https://esdr.cmucreatelab.org/api/v1/products
* List all public feeds:  https://esdr.cmucreatelab.org/api/v1/feeds
* Searching for specific feeds:  https://esdr.cmucreatelab.org/api/v1/feeds?fields=id,userId,productId,deviceId&whereOr=productId=2,productId>=3&orderBy=-id

NOTE: Searching over devices requires you to supply the OAuth2 access token in the request header.