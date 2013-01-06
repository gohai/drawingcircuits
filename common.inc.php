<?php

@require_once('config.inc.php');
@require_once('db.inc.php');
@require_once('util.inc.php');

function checkAuth()
{
	if (!@is_array($_REQUEST['auth'])) {
		$_REQUEST['auth'] = array('uid'=>NULL, 'secret'=>NULL, 'role'=>0);
		return false;
	}
	if (!@is_int($_REQUEST['auth']['uid']) || !@is_string($_REQUEST['auth']['secret'])) {
		$_REQUEST['auth'] = array('uid'=>NULL, 'secret'=>NULL, 'role'=>0);
		return false;
	}
	$role = checkCreds($_REQUEST['auth']['uid'], $_REQUEST['auth']['secret']);
	if ($role !== false) {
		$_REQUEST['auth']['role'] = $role;
		return true;
	} else {
		$_REQUEST['auth'] = array('uid'=>NULL, 'secret'=>NULL, 'role'=>0);
		return false;
	}
}


function checkCreds($uid, $secret)
{
	$q = db_fetch('users', 'uid='.$uid.' AND secret="'.db_esc($secret).'"');
	if (empty($q)) {
		return false;
	} else {
		// 0x01 .. user
		// 0x02 .. moderator
		// 0x04 .. admin
		return $q[0]['role'];
	}
}


function databaseError()
{
	if (SHOW_DATABASE_ERRORS) {
		return db_error();
	} else {
		return 'Database error';
	}
}


function filterDrillIsolation(&$layer, $board, $opts)
{
	$black = @imagecolorallocatealpha($layer['png'], 0, 0, 0, 0);
	foreach ($board['drills'] as $drill) {
		@imagefilledellipse($layer['png'], mmToPx($drill['x']), mmToPx($drill['y']), mmToPx($drill['diameter']), mmToPx($drill['diameter']), $black);
	}
}


function filterDrillLayer(&$board)
{
	$w = $board['layers']['top']['width'];
	$h = $board['layers']['top']['height'];
	$board['layers']['drills'] = array();
	$board['layers']['drills']['png'] = @imagecreatetruecolor($w, $h);
	$board['layers']['drills']['width'] = $w;
	$board['layers']['drills']['height'] = $h;

	$transparent = @imagecolorallocatealpha($board['layers']['drills']['png'], 0, 0, 0, 127);
	@imagealphablending($board['layers']['drills']['png'], false);
	foreach ($board['drills'] as $drill) {
		@imagefilledellipse($board['layers']['drills']['png'], mmToPx($drill['x']), mmToPx($drill['y']), mmToPx($drill['diameter']), mmToPx($drill['diameter']), $transparent);
	}
}


function filterFabmodulesColor(&$layer)
{
	$w = @imagesx($layer['png']);
	$h = @imagesy($layer['png']);
	$white = @imagecolorallocate($layer['png'], 255, 255, 255);
	$black = @imagecolorallocate($layer['png'], 0, 0, 0);
	for ($x = 0; $x < $w; $x++) {
		for ($y = 0; $y < $h; $y++) {
			$color = @imagecolorat($layer['png'], $x, $y);
			if ($color != (127 << 24)) {
				@imagesetpixel($layer['png'], $x, $y, $white);
			} else {
				@imagesetpixel($layer['png'], $x, $y, $black);
			}
		}
	}
}


function filterFabmodulesPath(&$layer, $key, $opts = array())
{
	// TODO: check against source
	$default_args = array(
		'error' => 1.1,
		'offset_diameter' => 0,
		'offset_number' => 1,
		'offset_overlap' => 0.5,
		'intensity_top' => 0.5,
		'intensity_bottom' => 0.5,	// default: intensity_top
		'z_top' => 0,
		'z_bottom' => 0,			// default: z_top
		'z_thickness' => 0,			// default: z_top-z_bottom
		'xz' => 0,
		'yz' => 0,
		'xy' => 1
	);
	$args = $default_args;
	if (@is_array($opts['png_path'])) {
		foreach ($opts['png_path'] as $key=>$val) {
			if (isset($args[$key])) {
				$args[$key] = $val;
			}
		}
	}
	if (@is_array($opts[$key]['png_path'])) {
		foreach ($opts[$key]['png_path'] as $key=>$val) {
			if (isset($args[$key])) {
				$args[$key] = $val;
			}
		}
	}
	$s = '';
	for ($i=count(array_keys($default_args))-1; 0 <= $i; $i--) {
		$argKey = array_pop(array_slice(array_keys($default_args), $i, 1));
		if ($default_args[$argKey] !== $args[$argKey]) {
			for ($j=0; $j<=$i; $j++) {
				$argKey = array_pop(array_slice(array_keys($default_args), $j, 1));
				$s .= ' '.$args[$argKey];
			}
		}
	}
	@exec('./bin/png_path /tmp/'.$layer['fn'].' /tmp/'.basename($layer['fn'], '.png').'.path'.$s);
}


function filterFabmodulesPng(&$layer)
{
	@exec('./bin/path_png /tmp/'.basename($layer['fn'], '.png').'.path /tmp/'.basename($layer['fn'], '.png').'-toolpath.png');
}


function filterFabmodulesRml(&$layer, $key, $opts = array())
{
	// TODO: check against source
	$default_args = array(
		'speed' => 4,
		'xmin' => 0,	// default: path value
		'ymin' => 0,	// default: path value
		'zmin' => 0,	// default: path value
		'z_up' => 1,
		'direction' => 1
	);
	$args = $default_args;
	if (@is_array($opts['path_rml'])) {
		foreach ($opts['path_rml'] as $key=>$val) {
			if (isset($args[$key])) {
				$args[$key] = $val;
			}
		}
	}
	if (@is_array($opts[$key]['path_rml'])) {
		foreach ($opts[$key]['path_rml'] as $key=>$val) {
			if (isset($args[$key])) {
				$args[$key] = $val;
			}
		}
	}
	$s = '';
	for ($i=count(array_keys($default_args))-1; 0 <= $i; $i--) {
		$argKey = array_pop(array_slice(array_keys($default_args), $i, 1));
		if ($default_args[$argKey] !== $args[$argKey]) {
			for ($j=0; $j<=$i; $j++) {
				$argKey = array_pop(array_slice(array_keys($default_args), $j, 1));
				$s .= ' '.$args[$argKey];
			}
		}
	}
	@exec('./bin/path_rml /tmp/'.basename($layer['fn'], '.png').'.path /tmp/'.basename($layer['fn'], '.png').'.rml'.$s);
}


function filterFixDpi(&$layer)
{
	@exec('./bin/png_size /tmp/'.$layer['fn'].' '.($layer['width']/(300.0/25.4)).' '.($layer['height']/(300.0/25.4)));
}


function filterFlipX(&$layer)
{
	@imagealphablending($layer['png'], false);
	$w = @imagesx($layer['png']);
	$h = @imagesy($layer['png']);
	for ($x = 0; $x < ceil(($w-1)/2); $x++) {
		for ($y = 0; $y < $h; $y++) {
			$left = @imagecolorat($layer['png'], $x, $y);
			$right = @imagecolorat($layer['png'], $w-1-$x, $y);
			@imagesetpixel($layer['png'], $x, $y, $right);
			@imagesetpixel($layer['png'], $w-1-$x, $y, $left);
		}
	}
}


function filterRotate(&$layer, $rot)
{
	$transparent = @imagecolorallocatealpha($layer['png'], 0, 0, 0, 127);
	$layer['png'] = @imagerotate($layer['png'], -$rot, $transparent);
	$layer['width'] = @imagesx($layer['png']);
	$layer['height'] = @imagesy($layer['png']);
}


function filterToFile(&$layer, $fn)
{
	if (@imagepng($layer['png'], '/tmp/'.$fn)) {
		$layer['fn'] = $fn;
	} else {
		$layer['fn'] = NULL;
	}
}


function getLatestBoardRev($board)
{
	$q = db_fetch_raw('SELECT rev FROM revisions WHERE board='.@intval($board).' ORDER BY rev DESC LIMIT 1');
	if ($q === false) {
		return false;
	} elseif (empty($q)) {
		return 0;
	} else {
		return $q[0]['rev'];
	}
}


function getLatestPartRev($part)
{
	$q = db_fetch_raw('SELECT rev FROM parts WHERE part=\''.db_esc($part).'\' ORDER BY rev DESC LIMIT 1');
	if ($q === false) {
		return 0;
	} elseif (empty($q)) {
		return 0;
	} else {
		return $q[0]['rev'];
	}
}


function loadBoard($board, $rev)
{
	$q = db_fetch('revisions', 'board='.$board.' AND rev='.$rev);
	if ($q === false) {
		return 500;
	} elseif (empty($q)) {
		// revision not found
		return 404;
	} else {
		$ret = @json_decode($q[0]['json'], true);
		$ret['board'] = $board;
		$ret['rev'] = $rev;
		$ret['author'] = $q[0]['author'];
		$ret['parentBoard'] = $q[0]['parentBoard'];
		$ret['parentRev'] = $q[0]['parentRev'];
		// load layers
		$ret['layers'] = array();
		$q = db_fetch('layers', 'board='.$board.' AND rev='.$rev);
		if ($q !== false) {
			foreach ($q as $l) {
				$ret['layers'][$l['layer']] = array('width'=>$l['width'], 'height'=>$l['height'], 'png'=>$l['png']);
			}
		}
		return $ret;
	}
}


function mmToPx($mm)
{
	return floor($mm*300.0/25.4);
}


function parseSvg(&$xmlString, &$ret)
{
	$xml = @simplexml_load_string($xmlString);
	if ($xml === false) {
		return 'Cannot parse SVG';
	}

	// get dimensions
	if (empty($xml->attributes()->width) || empty($xml->attributes()->height)) {
		return 'SVG width and height are not set';
	} else {
		// round to get more even numbers (e.g. 1 mm)
		$ret['width'] = round(svgToMm($xml->attributes()->width), 3);
		$ret['height'] = round(svgToMm($xml->attributes()->height), 3);
	}

	// get drill holes
	if (!@is_array($ret['drills'])) {
		$ret['drills'] = array();
	}
	for ($i=0; $i < count($xml->g); $i++) {
		// check if it is the right group
		$g = $xml->g[$i];
		if (empty($g->attributes()->id) || $g->attributes()->id != 'drills') {
			continue;
		}
		// handle circles with id set first
		foreach ($g->circle as $c) {
			if (empty($c->attributes()->id)) {
				continue;
			} else {
				$name = strval($c->attributes()->id);
				$ret['drills'][$name] = array(
					'x'=>round(svgToMm($c->attributes()->cx)-$ret['width']/2.0, 3),
					'y'=>round(svgToMm($c->attributes()->cy)-$ret['height']/2.0, 3),
					'diameter'=>round(svgToMm($c->attributes()->r)*2.0, 3)
				);
			}
		}
		// continue with unnamed circles
		foreach ($g->circle as $c) {
			if (!empty($c->attributes()->id)) {
				continue;
			} else {
				$j = 0;
				while (true) {
					$name = 'drill'.$j;
					if (!isset($ret[$name])) {
						break;
					} else {
						$j++;
					}
				}
				$ret['drills'][$name] = array(
					'x'=>round(svgToMm($c->attributes()->cx)-$ret['width']/2.0, 3),
					'y'=>round(svgToMm($c->attributes()->cy)-$ret['height']/2.0, 3),
					'diameter'=>round(svgToMm($c->attributes()->r)*2.0, 3)
				);
			}
		}
		// remove drill holes from the xml
		unset($xml->g[$i]);
		break;
	}

	// update xml string
	$xmlString = $xml->asXML();

	return true;
}


function setupPart($part, $options = array())
{
	// options
	if (empty($options['extensive'])) {
		$options['extensive'] = false;
	}
	if (empty($options['visibility'])) {
		$options['visibility'] = false;
	}

	// decode json
	$part['json'] = @json_decode($part['json'], true);

	// pull in parent
	if ($part['parent'] !== NULL) {
		$q = db_fetch('parts', 'part=\''.db_esc($part['parent']).'\' ORDER BY visible DESC, rev DESC LIMIT 1');
		if (!empty($q)) {
			if ($part['title'] === NULL) {
				$part['title'] = $q[0]['title'];
			}
			if ($part['svg'] === NULL) {
				$part['svg'] = $q[0]['svg'];
			}
			$part['json'] = array_merge_deep(@json_decode($q[0]['json'], true), $part['json']);
			if ($part['originalSvg'] === NULL) {
				$part['originalSvg'] = $q[0]['originalSvg'];
			}
		}
	}

	// filter unwanted fields
	$part = array_key_whitelist($part, array('part', 'rev', 'title', 'parent', 'svg', 'json', 'visible'));
	if (!$options['visibility']) {
		$part = array_key_blacklist($part, array('visible'));
	}

	// merge json with main object
	$part = array_merge($part['json'], $part);
	unset($part['json']);

	// pull in suppliers and comments
	if ($options['extensive']) {
		$part['suppliers'] = array();
		$q = db_fetch('suppliers', 'part=\''.db_esc($part['part']).'\' AND visible=1 ORDER BY supplier ASC, partNumber ASC');
		if (!empty($q)) {
			foreach ($q as $r) {
				$part['suppliers'][] = array_key_whitelist($r, array('supplier', 'partNumber', 'url'));
			}
		}

		$part['comments'] = array();
		$q = db_fetch('comments', 'part=\''.db_esc($part['part']).'\' AND visible=1 ORDER BY added ASC');
		if (!empty($q)) {
			foreach ($q as $r) {
				$part['comments'][] = array_key_whitelist($r, array('id', 'comment', 'added', 'author'));
			}
		}
	}

	return $part;
}


function svgToMm($s) {
	// this assumes 72 DPI
	return @floatval($s)/72.0*25.4;
}