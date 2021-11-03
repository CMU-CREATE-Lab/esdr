#!/bin/bash

# cd to the directory containing this script (found this at http://stackoverflow.com/a/3355423/703200)
cd "$(dirname "$0")" || {
   echo "Failed to cd to directory containing this script"
   exit 1
}

if [ $# -ne 2 ]; then
   echo
   echo "ERROR: You must specify both the MySQL database name and a login-path when invoking this script."
   echo
   echo "Usage:"
   echo
   echo "   ./mysql-backup.sh DATABASE_NAME LOGIN_PATH"
   echo
   echo "The login-path must already have been predefined with a command like this:"
   echo
   echo "   mysql_config_editor set --host=localhost --user=USERNAME --password --login-path=SOME_NAME_OF_YOUR_CHOOSING"
   echo
   echo "For example, to save a login-path named 'esdr_backup_script' for the root user, you would do:"
   echo
   echo "   mysql_config_editor set --host=localhost --user=root --password --login-path=esdr_backup_script"
   echo
   echo "The mysql_config_editor command will prompt you for a password, and then save the host, username,"
   echo "and password under the login-path name 'esdr_backup_script' in the file ~/.mylogin.cnf."
   echo
   echo "You would then invoke this script to backup the 'esdr_prod' database like this:"
   echo
   echo "   ./mysql-backup.sh esdr_prod esdr_backup_script"
   echo
   echo "Note that the ~/.mylogin.cnf file's contents are obfuscated, and permissions set to"
   echo "readable only by the user, so it should be safe enough."
   echo
   echo "See here for more info: https://dev.mysql.com/doc/refman/5.7/en/mysql-config-editor.html"
   echo
   exit 1
fi

database=$1
login_path=$2

# get today in YYYYMMDD format
today=$(date '+%Y%m%d')

# build the filename for the database dump
filename="${database}_${today}.sql"

if [[ -f $filename ]]; then
   echo "The file '$filename' already exists.  Aborting out of an abundance of caution."
else
   compressed_filename="${filename}.gz"

   if [[ -f $compressed_filename ]]; then
      echo "The file '$compressed_filename' already exists.  Aborting out of an abundance of caution."
   else
      echo "Exporting database '${database}' using login-path '${login_path}' to file: ${filename}"

      if mysqldump --login-path="${login_path}" --opt "${database}" >"${filename}"; then
         echo "Successfully exported the database."
         echo "Compressing ${filename}..."
         gzip "${filename}"
         echo "Done! May your day not be ruined by computers."
      else
         echo "Failed to export the database." >&2
      fi
   fi
fi
