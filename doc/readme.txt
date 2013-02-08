This software is known to work best with Google Chrome (23). Safari should also work. There are currently some issues with Firefox (17).

When installing on a server, make sure to execute ../cron.sh every couple of minutes. If your webserver is running under a different user than www-data you also need to make some slight changes to this file. Also, set the permissions of the img directory so that the webserver process can write to it.
