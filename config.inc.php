<?php

error_reporting(E_ALL);

// load user settings
@include('user-config.inc.php');

// else set defaults
@define('BASE_URL', 'http://host/dir/');		// website base url
@define('COMMENT_VISIBILITY_GUEST', 0);			// 1 if anonymous users' comments should be visible by default, 0 if not
@define('COMMENT_VISIBILITY_USER', 1);			// 1 if logged in users' comments should be visible by default, 0 if not
@define('COMMENT_VISIBILITY_MODERATOR', 1);		// 1 if moderators' comments should be visible by default, 0 if not
@define('DEFAULT_BOARD', '');					// default board to load
@define('GOOGLE_ANALYTICS', '');				// Google Analytics id
@define('JQUERY', 'jquery-1.9.1.min.js');		// jQuery file to use
@define('PART_VISIBILITY_GUEST', 0);			// 1 if anonymous users' parts should be visible by default, 0 if not
@define('PART_VISIBILITY_USER', 0);				// 1 if logged in users' parts should be visible by default, 0 if not
@define('PART_VISIBILITY_MODERATOR', 1);		// 1 if moderators' parts should be visible by default, 0 if not
@define('SHOW_DATABASE_ERRORS', false);			// return database errors to the client
@define('SUPPLIER_VISIBILITY_GUEST', 0);		// 1 if anonymous users' suppliers should be visible by default, 0 if not
@define('SUPPLIER_VISIBILITY_USER', 0);			// 1 if logged in users' suppliers should be visible by default, 0 if not
@define('SUPPLIER_VISIBILITY_MODERATOR', 1);	// 1 if moderators' suppliers should be visible by default, 0 if not
@define('TIMEZONE', -7);						// timezone offset to UTC
@define('TMP_PATH', '/tmp/');					// location of temporary files
@define('TWITTER', '');							// Twitter handle


function base_url()
{
	// TODO (later): auto detect
	return BASE_URL;
}
