Environmental Sensor Data Repository (ESDR)
===========================================

The ESDR web site.

Setup
=====

1. Install the module dependencies:

        npm install
    
2. Install the BodyTrack Datastore by doing the following

    1. Fetch the BodyTrack Datastore. In your terminal window, set your working directory to the root of the ESDR repository and do the following:
               
               git clone https://github.com/BodyTrack/datastore.git
       
    2. Follow the BodyTrack Datastore's build and install instructions.

3. Install MySQL if necessary.  ESDR was tested with and assumes MySQL 5.6 (there are known issues with 5.5).

4. Do the following to create the MySQL database and user:

        CREATE DATABASE IF NOT EXISTS esdr;
        GRANT ALL PRIVILEGES ON esdr.* To 'esdr'@'localhost' IDENTIFIED BY 'password';
        GRANT SELECT,INSERT,UPDATE,DELETE,CREATE ON esdr.* TO 'esdr'@'localhost';

    Make sure the password you specify matches the password in the config JSON.

5. If you want to run the tests, do the following to create the test database and user:

        CREATE DATABASE IF NOT EXISTS esdr_test;
        GRANT ALL PRIVILEGES ON esdr_test.* To 'esdr'@'localhost' IDENTIFIED BY 'password';
        GRANT SELECT,INSERT,UPDATE,DELETE,CREATE ON esdr_test.* TO 'esdr'@'localhost';

    Again, make sure the password you specify matches the password in the `config-test.json`.

6. If running in production, do the  the following to create the production database and user:
                                    
        CREATE DATABASE IF NOT EXISTS esdr_production;
        GRANT ALL PRIVILEGES ON esdr_production.* To 'esdr_prod'@'localhost' IDENTIFIED BY 'USE_A_GOOD_PASSWORD_HERE';
        GRANT SELECT,INSERT,UPDATE,DELETE,CREATE ON esdr_production.* TO 'esdr_prod'@'localhost';

    Again, make sure the user and password you specify matches those in the `config-production.json`.
    
7. Create the `config-production.json` and `mail-config-production.json` files. Just copy from the other configs, but you need only include the parts that differ from `config.js`.



Run
===

To run the server in development mode, do:

    npm start
    
To run the server in test mode, do:

    NODE_ENV=test npm start
    
To run the server in production mode, do:

    NODE_ENV=production npm start
    
Development
===========
To generate the CSS from the SCSS template, do:

   npm run-script gen-css

