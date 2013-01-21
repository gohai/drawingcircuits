<?php

/*
 *	ajax.php
 *	Handle requests from the client
 *
 *	Copyright Gottfried Haider 2013.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

@require_once('config.inc.php');
@require_once('common.inc.php');
@require_once('db.inc.php');
@require_once('util.inc.php');

// decode request data
json_request();


if (empty($_REQUEST['method'])) {
	// method argument missing
	http_error(400, true);
	die();
} elseif ($_REQUEST['method'] == 'addDrawing') {
	checkAuth();

	$part = array();
	$part['part'] = arg_required($_REQUEST['part'], 'string');
	$part['rev'] = getLatestPartRev($part['part'])+1;
	$part['title'] = NULL;
	$part['parent'] = NULL;
	$part['svg'] = arg_required($_REQUEST['svg'], 'string');
	$part['json'] = array();
	$part['added'] = 'NOW()';
	$part['author'] = $_REQUEST['auth']['uid'];
	$part['host'] = gethostbyaddr($_SERVER['REMOTE_ADDR']);
	$part['originalSvg'] = arg_required($_REQUEST['svg'], 'string');
	$part['visible'] = 0;

	$ret = parseSvg($part['svg'], $part['json']);
	if ($ret !== true) {
		json_response(array('error'=>$ret));
	}
	$part['svg'] = stripComments($part['svg']);

	// insert into database
	$q = $part['json'] = @json_encode($part['json'], JSON_FORCE_OBJECT);
	db_insert('parts', $part);
	if ($q === false) {
		json_response(array('error'=>databaseError()));
	} else {
		json_response(setupPart($part, array('visibility'=>true)));
	}
} elseif ($_REQUEST['method'] == 'addPart') {
	checkAuth();
	$parent = arg_required($_REQUEST['parent'], array('string', 'NULL'));

	if ($parent === null) {
		// load original part
		$q = db_fetch('parts', 'part=\''.db_esc(arg_required($_REQUEST['part'], 'string')).'\' ORDER BY rev DESC LIMIT 1');
		if ($q === false) {
			json_response(array('error'=>databaseError()));
		} elseif (empty($q)) {
			json_response(array('error'=>'Part '.$_REQUEST['part'].' not found'));
		} else {
			$part = $q[0];
		}

		// check if we have the permission to modify the part
		// TODO: check for (administrative) role as well
		if ($part['author'] !== NULL && $part['author'] != $_REQUEST['auth']['uid']) {
			json_response(array('error'=>'Insufficient privileges to modify part '.$part['part']));
		}

		// modify
		$part['title'] = arg_required($_REQUEST['title'], 'string');
		$part['json'] = array_merge_deep(@json_decode($part['json'], true), arg_required($_REQUEST['overlay'], 'array'));
		$part['visible'] = PART_VISIBILITY_GUEST;
		if ($_REQUEST['auth']['role'] & 0x01) {
			$part['visible'] |= PART_VISIBILITY_USER;
		}
		if ($_REQUEST['auth']['role'] & 0x02) {
			$part['visible'] |= PART_VISIBILITY_MODERATOR;
		}
		if ($_REQUEST['auth']['role'] & 0x04) {
			$part['visible'] |= 1;
		}

		// update database
		$part['json'] = @json_encode($part['json'], JSON_FORCE_OBJECT);
		$q = db_update('parts', 'part=\''.db_esc($part['part']).'\' AND rev='.$part['rev'], array_key_whitelist($part, array('title', 'json', 'visible')), 1);
		if ($q === false) {
			json_response(array('error'=>databaseError()));
		} else {
			json_response(setupPart($part, array('visibility'=>true)));
			// TODO: email notification if not visible
		}
	} else {
		// create a new part
		$part = array();
		$part['part'] = arg_required($_REQUEST['part'], 'string');
		$part['rev'] = getLatestPartRev($part['part'])+1;
		$part['title'] = arg_required($_REQUEST['title'], 'string');
		// check if parent exists
		if (getLatestPartRev($parent) == 0) {
			json_response(array('error'=>'Part '.$parent.' not found'));
		} else {
			$part['parent'] = $parent;
		}
		$part['svg'] = NULL;
		$part['json'] = @json_encode(arg_required($_REQUEST['overlay'], 'array'), JSON_FORCE_OBJECT);
		$part['added'] = 'NOW()';
		$part['author'] = $_REQUEST['auth']['uid'];
		$part['host'] = gethostbyaddr($_SERVER['REMOTE_ADDR']);
		$part['originalSvg'] = NULL;
		$part['visible'] = PART_VISIBILITY_GUEST;
		if ($_REQUEST['auth']['role'] & 0x01) {
			$part['visible'] |= PART_VISIBILITY_USER;
		}
		if ($_REQUEST['auth']['role'] & 0x02) {
			$part['visible'] |= PART_VISIBILITY_MODERATOR;
		}
		if ($_REQUEST['auth']['role'] & 0x04) {
			$part['visible'] |= 1;
		}

		// insert into database
		$q = db_insert('parts', $part);
		if ($q === false) {
			json_response(array('error'=>databaseError()));
		} else {
			json_response(setupPart($part, array('visibility'=>true)));
			// TODO: email notification if not visible
		}
	}
} elseif ($_REQUEST['method'] == 'addPartComment') {
	checkAuth();

	$comment = array();
	$comment['part'] = arg_required($_REQUEST['part'], 'string');
	// check if part exists
	if (getLatestPartRev($comment['part']) == 0) {
		json_response(array('error'=>'Part '.$comment['part'].' not found'));
	}
	$comment['comment'] = arg_required($_REQUEST['comment'], 'string');
	$comment['added'] = 'NOW()';
	$comment['author'] = $_REQUEST['auth']['uid'];
	$comment['host'] = gethostbyaddr($_SERVER['REMOTE_ADDR']);
	$comment['visible'] = COMMENT_VISIBILITY_GUEST;
	if ($_REQUEST['auth']['role'] & 0x01) {
		$comment['visible'] |= COMMENT_VISIBILITY_USER;
	}
	if ($_REQUEST['auth']['role'] & 0x02) {
		$comment['visible'] |= COMMENT_VISIBILITY_MODERATOR;
	}
	if ($_REQUEST['auth']['role'] & 0x04) {
		$comment['visible'] |= 1;
	}

	// insert into database
	$q = db_insert('comments', $comment);
	if ($q === false) {
		json_response(array('error'=>databaseError()));
	} else {
		$comment['id'] = $q;
		json_response(array_key_whitelist($comment, array('id', 'part', 'comment', 'visible')));
		// TODO: email notification if not visible
	}
} elseif ($_REQUEST['method'] == 'addPartSupplier') {
	checkAuth();

	$supplier = array();
	$supplier['part'] = arg_required($_REQUEST['part'], 'string');
	// check if part exists
	if (getLatestPartRev($supplier['part']) == 0) {
		json_response(array('error'=>'Part '.$supplier['part'].' not found'));
	}
	$supplier['supplier'] = arg_required($_REQUEST['supplier'], 'string');
	$supplier['partNumber'] = arg_optional($_REQUEST['partNumber'], array('string', 'NULL'), NULL);
	$supplier['url'] = arg_optional($_REQUEST['url'], array('string', 'NULL'), NULL);
	$supplier['added'] = 'NOW()';
	$supplier['addedBy'] = $_REQUEST['auth']['uid'];
	$supplier['host'] = gethostbyaddr($_SERVER['REMOTE_ADDR']);
	$supplier['visible'] = SUPPLIER_VISIBILITY_GUEST;
	if ($_REQUEST['auth']['role'] & 0x01) {
		$supplier['visible'] |= SUPPLIER_VISIBILITY_USER;
	}
	if ($_REQUEST['auth']['role'] & 0x02) {
		$supplier['visible'] |= SUPPLIER_VISIBILITY_MODERATOR;
	}
	if ($_REQUEST['auth']['role'] & 0x04) {
		$supplier['visible'] |= 1;
	}

	// insert into database
	$q = db_insert('suppliers', $supplier);
	if ($q === false) {
		json_response(array('error'=>databaseError()));
	} else {
		json_response(array_key_whitelist($supplier, array('part', 'supplier', 'partNumber', 'url', 'visible')));
		// TODO: email notification if not visible
	}
} elseif ($_REQUEST['method'] == 'export') {
	$board = arg_required($_REQUEST['board'], 'integer');

	if (@is_int($_REQUEST['rev'])) {
		$rev = $_REQUEST['rev'];
	} else {
		$rev = getLatestBoardRev($board);
		if ($rev === false) {
			http_error(500, true);
			die();
		}
	}

	$ret = loadBoard($board, $rev);
	if (@is_int($ret)) {
		http_error($ret, true);
		die();
	} else {
		$board = $ret;
		foreach (array_keys($board['layers']) as $key) {
			$board['layers'][$key]['png'] = @imagecreatefromstring($board['layers'][$key]['png']);
			// alpha is not needed for fab modules
			//@imagesavealpha($board['layers'][$key]['png'], true);
		}
	}

	$prefix = 'board'.$board['board'].'rev'.$board['rev'].'-'.date('YmdHis').'-';
	$opts = arg_optional($_REQUEST['opts'], 'array', array());
	$opts['prefix'] = $prefix;
	@umask(0111);
	// DEBUG
	$f = fopen(TMP_PATH.$prefix.'debug.txt', 'a');
	fwrite($f, 'Request: '.print_r($_REQUEST, true)."\r\n");
	fclose($f);
	filterDrillLayer($board);
	foreach (array_keys($board['layers']) as $key) {
		if ($key == 'top' || $key == 'bottom') {
			// get offset_number parameter
			$offset_number = 1;
			if (@is_array($opts['png_path']) && isset($opts['png_path']['offset_number'])) {
				$offset_number = $opts['png_path']['offset_number'];
			}
			if (@is_array($opts[$key]) && @is_array($opts[$key]['png_path']) && isset($opts[$key]['png_path']['offset_number'])) {
				$offset_number = $opts[$key]['png_path']['offset_number'];
			}
			if ($offset_number != -1) {
				// not necessary if we're clearing the entire board
				filterDrillIsolation($board['layers'][$key], $board, $opts);
			}
			if ($offset_number == -1) {
				// don't clear parts of the board outside of the substrate area
				filterSubstrateMask($board['layers'][$key], $board, $opts);
			}
			// TODO: filterSafetyMask($board['layers'][$key], $opts);
		}
		if ($key == 'bottom') {
			filterFlipX($board['layers'][$key]);
		}
	}
	// Modela-specific
	foreach (array_keys($board['layers']) as $key) {
		filterRotate($board['layers'][$key], -90.0);
		filterFabmodulesColor($board['layers'][$key]);
		filterToFile($board['layers'][$key], $prefix.$key.'.png');
		filterFixDpi($board['layers'][$key]);
		filterFabmodulesPath($board['layers'][$key], $key, $opts);
		filterFabmodulesRml($board['layers'][$key], $key, $opts);
		filterFabmodulesPng($board['layers'][$key]);
	}

	// compress
	$zip = new ZipArchive();
	$zipFn = TMP_PATH.$prefix.'modela40a.zip';
	$zip->open($zipFn, ZIPARCHIVE::CREATE);
	$dir = scandir(TMP_PATH);
	foreach ($dir as $f) {
		if (substr($f, 0, strlen($prefix)) != $prefix) {
			continue;
		}
		if (substr($f, -5) == '.path') {
			continue;
		}
		$zip->addFile(TMP_PATH.$f, $f);
	}
	$zip->close();

	// send
	header('Content-type: application/octet-stream');
	header('Content-Disposition: attachment; filename="'.basename($zipFn).'"');
	@readfile($zipFn);

	// cleanup
	foreach (glob(TMP_PATH.$prefix.'*') as $f) {
		@unlink($f);
	}
	die();
} elseif ($_REQUEST['method'] == 'getLibrary') {
	// sort it with revision ascending so that later entries overwrite prior ones
	$q = db_fetch('parts', 'visible=1 ORDER BY title ASC, part ASC, rev ASC');
	if ($q === false) {
		http_error(500, true);
		die();
	}
	$ret = array();
	foreach ($q as $r) {
		$part = setupPart($r, array('extensive'=>true));
		$ret[$part['part']] = $part;
		unset($ret[$part['part']]['part']);
	}
	json_response($ret);
} elseif ($_REQUEST['method'] == 'load') {
	$board = arg_required($_REQUEST['board'], 'integer');

	if (@is_int($_REQUEST['rev'])) {
		$rev = $_REQUEST['rev'];
	} else {
		$rev = getLatestBoardRev($board);
		if ($rev === false) {
			http_error(500, true);
			die();
		}
	}

	$ret = loadBoard($board, $rev);
	if (@is_int($ret)) {
		http_error($ret, true);
		die();
	} else {
		// encode the image data
		foreach ($ret['layers'] as &$l) {
			$l['png'] = 'data:image/png;base64,'.@base64_encode($l['png']);
		}
		json_response($ret);
	}
} elseif ($_REQUEST['method'] == 'save') {
	checkAuth();
	$board = $_REQUEST['board'];
	$auth = $_REQUEST['auth'];

	// check if we have the permission to save a revision
	if ($board['board'] !== NULL) {
		$q = db_fetch('boards', 'board='.@intval($board['board']));
		if ($q === false) {
			http_error(500, true);
			die();
		} elseif (empty($q)) {
			// unknown board
			http_error(400, true);
			die();
		} elseif ($q[0]['owner'] !== NULL && $q[0]['owner'] !== $auth['uid']) {
			// TODO: we might check for administrative role here as well
			$board['board'] = NULL;
		}
	}

	if ($board['board'] === NULL) {
		// create a new board
		$id = db_insert('boards', array('owner'=>$auth['uid']));
		if ($id === false) {
			http_error(500, true);
			die();
		} else {
			$board['board'] = $id;
			$board['rev'] = 1;
		}
	} else {
		// create a new revision
		$q = db_fetch_raw('SELECT rev FROM revisions WHERE board='.@intval($board['board']).' ORDER BY rev DESC LIMIT	1');
		if ($q === false) {
			http_error(500, true);
			die();
		} elseif (empty($q)) {
			// no revisions
			$board['rev'] = 1;
		} else {
			$board['rev'] = $q[0]['rev']+1;
		}
	}

	// save layers separately
	foreach ($board['layers'] as $key=>$val) {
		if (!@is_string($val['png']) || substr($val['png'], 0, 22) != 'data:image/png;base64,') {
			// unsupported Data-URL
			// TODO: allow for blank layers being set to NULL later
			continue;
		}
		$val['png'] = @base64_decode(substr($val['png'], 22));
		db_insert('layers', array('board'=>$board['board'], 'rev'=>$board['rev'], 'layer'=>$key, 'width'=>$val['width'], 'height'=>$val['height'], 'png'=>$val['png']));
	}

	// save the rest
	$json = array_key_blacklist($board, array('author', 'board', 'layers', 'parentBoard', 'parentRev', 'rev'));
	$json = json_encode($json, JSON_FORCE_OBJECT);
	db_insert('revisions', array('board'=>$board['board'], 'rev'=>$board['rev'], 'created'=>'NOW()', 'author'=>$auth['uid'], 'host'=>gethostbyaddr($_SERVER['REMOTE_ADDR']), 'parentBoard'=>$board['parentBoard'], 'parentRev'=>$board['parentRev'], 'json'=>$json));
	// return ids
	json_response(array('board'=>$board['board'], 'rev'=>$board['rev']));
} else {
	// unsupported method
	http_error(400, true);
	die();
}
