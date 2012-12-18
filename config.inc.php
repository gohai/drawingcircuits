<?php

error_reporting(E_ALL);

// load user settings
@include('user-config.inc.php');

// else set defaults
@define('BASE_URL', 'http://host/dir/');
@define('DEFAULT_BOARD', 1);
@define('GOOGLE_ANALYTICS', '');
@define('JQUERY', 'jquery-1.8.3.min.js');


function base_url()
{
	// TODO: auto detect
	return BASE_URL;
}