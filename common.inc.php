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