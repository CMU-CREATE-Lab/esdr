# Environmental Sensor Data Repository (ESDR)

ESDR is an open source data repository intended for storing and retrieving time series environmental data.  Basically, if the data has a timestamp and a value, ESDR can store it and provide ways to retrieve it quickly and securely.  Data is stored in a custom, open source [datastore](https://github.com/BodyTrack/datastore) which provides extremely fast data inserts and fetches, making for fast and responsive visualizations.  The ESDR web site ([esdr.cmucreatelab.org](https://esdr.cmucreatelab.org/)) provides a REST API interface to the datastore, making it easy to read/write data. Metadata is stored in a MySQL database.

ESDR is pronounced like the female name, Esther.

## Concepts and Terminology

If you're familiar with Xively's API, you'll see a lot of parallels with ESDR.  Our intention is to use ESDR as the data repository not only for our own products and visualizations, but also for anyone else who wants a place to store data and have tools to easily visualize it.

First, some terminology: ESDR has *clients*, *users*, *products*, *devices*, *feeds*, *channels*, and *tiles*.  Understanding how these entities relate will give a good understanding of how the data and metadata are structured and how the system works.

* **Client**: ESDR uses OAuth2 for authentication, so a client in ESDR is simply an OAuth2 client.
* **User**: no real surprise here...simply a person who has registered with ESDR and may own one or more products, devices, or feeds.  When a user logs in, he/she does so on behalf of an OAuth2 client.
* **Product**: a product is simply a certain kind of sensor, for example, the [Speck particle sensor](http://www.specksensor.com/).
* **Device**: a particular instantiation of a product, i.e. an actual sensor device--something you can put your hands on--typically with a unique serial number.
* **Feed**: a particular installation of a device.  For example, if I buy a Speck and register it, the behind-the-scenes registration process creates for me both an ESDR device instance (with my Speck's serial number), as well as a feed, for the location I specified during registration.  For example, let's say I purchase a Speck and install it under the awning on my deck.  During registration, I would give the location a name (e.g. "Deck"), set the latitude/longitude to my house, mark the *exposure* to outdoors, set visibility (public or private), etc. Data recorded and uploaded by the Speck would be associated with that particular feed.  If I then move the Speck to my kitchen, I would re-register the Speck so it is associated with a new feed, because the environment/location has changed.  If I accidentally drop the Speck in a sink full of water and replace it with a new one, that new one would be registered as a new device (it has a different serial number), but, at my option, could be associated with the existing feed from the old Speck (so that I have one continuous stream of data since it's the environment being measured which matters most, not the actual device doing the measurement).  Similarly, if I sell the Speck, the new owner would register it under her account, and get a new feed for it.
* **Channel**: a sensor device measures one or more aspects of its environment, such as temperature, humidity, particle count, battery voltage, etc.  Each is considered a different channel.  A feed comprises one or more channels.
* **Tiles**: data from a particular feed's channel can be retrieved from ESDR in small chunks of JSON which we call *tiles*.  A tile contains at most 512 data points, and is associated with a particular starting timestamp and duration.  For example, a tile could represent a summary of a decade's worth of data, or it could contain the actual recorded data samples spanning, say, only 1 second (e.g. heart rate data).  The [grapher we use](https://github.com/CMU-CREATE-Lab/grapher) fetches tiles as the user pans and zooms the timeline--it requests only the small subset of data it needs to render the plot. The most appropriate analogy is panning/zooming in Google Maps--the browser only requests map tiles for the current small region of the Earth you're exploring at the time.  ESDR also has support for a multi-tile fetch where you can fetch data from multiple channels from multiple feeds with a single GET request.  This is essential for being able to do visualizations of lots of sensors simultaneously, e.g. air quality in cities all over the country.

Again, the data samples themselves are all stored in the datastore.  Data for the above entities is stored in a MySQL database.  The big win with the datastore is that it works with billions of samples, doing time aggregation upon insert (and yet inserts are still fast), storing the data at a number of different summarization levels.  Thus, it can return a summary of a year's worth (or more!) of data just as quickly as, say, five minutes worth.  No summarization computation is required when fetching tiles, so visualizations remain responsive and fast at any zoom level.

We don't yet do spatiotemporal aggregation, but it's on the TODO list.

Please see the [HOW TO](https://github.com/CMU-CREATE-Lab/esdr/blob/master/HOW_TO.md) document for more details on how to use ESDR.

## Setup

1. Install the module dependencies:

        npm install
    
2. Install the BodyTrack Datastore by doing the following

    1. Fetch the BodyTrack Datastore. In your terminal window, set your working directory to the root of the ESDR repository and do the following:
               
               git clone https://github.com/BodyTrack/datastore.git
       
    2. Follow the BodyTrack Datastore's build and install instructions.

3. Install MySQL if necessary.  ESDR was tested with and assumes MySQL 5.6 (there are known issues with 5.5).

4. Do the following to create the development MySQL database and user:

        CREATE DATABASE IF NOT EXISTS esdr_dev;
        GRANT ALL PRIVILEGES ON esdr_dev.* To 'esdr_dev'@'localhost' IDENTIFIED BY 'password';
        GRANT SELECT,INSERT,UPDATE,DELETE,CREATE ON esdr_dev.* TO 'esdr_dev'@'localhost';

    If you choose to change the password, make sure it matches the password in `config-dev.json`.

5. If you want to be able to run the tests, do the following to create the test database and user:

        CREATE DATABASE IF NOT EXISTS esdr_test;
        GRANT ALL PRIVILEGES ON esdr_test.* To 'esdr_test'@'localhost' IDENTIFIED BY 'password';
        GRANT SELECT,INSERT,UPDATE,DELETE,CREATE ON esdr_test.* TO 'esdr_test'@'localhost';

    If you choose to change the password, make sure it matches the password in `config-test.json`.

6. If running in production, do the following:

    1. Create the `config-prod.json` and `mail-config-prod.json` files. Just copy from the other configs, but you need only include the parts that differ from `config.js`.

    2. Do the following to create the production database and user:
                                    
            CREATE DATABASE IF NOT EXISTS esdr_prod;
            GRANT ALL PRIVILEGES ON esdr_prod.* To 'esdr_prod'@'localhost' IDENTIFIED BY 'USE_A_GOOD_PASSWORD_HERE';
            GRANT SELECT,INSERT,UPDATE,DELETE,CREATE ON esdr_prod.* TO 'esdr_prod'@'localhost';

        Again, make sure the user and password you specify matches those in `config-prod.json`.

7. Make sure the datastore data directory defined in the config file exists.

## Run

The `NODE_ENV` environment variable may be specified when running, and must be one of `dev`, `development`, `test`, `prod`, or `production`. Defaults to `dev` if unspecified.

To run the server in development mode, do any of the following:

    npm start
    NODE_ENV=dev npm start
    NODE_ENV=development npm start

To run the server in test mode, do:

    NODE_ENV=test npm start
    
To run the server in production mode, do either of the following:

    NODE_ENV=prod npm start
    NODE_ENV=production npm start

## Development

To generate the CSS from the SCSS template, do:

    npm run-script gen-css

To compile the handlebars templates, do:

    npm run-script gen-handlebars