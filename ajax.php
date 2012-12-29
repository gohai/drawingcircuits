<?php

@require_once('config.inc.php');
@require_once('common.inc.php');
@require_once('db.inc.php');
@require_once('util.inc.php');

// decode request data
json_request();


if (empty($_REQUEST['method'])) {
	// method argument missing
	http_error(400, false);
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
	$board = $_REQUEST['board'];
	$rev = $_REQUEST['rev'];
	$q = db_fetch('layers', 'board='.@intval($board).' AND rev='.@intval($rev).' AND layer="top"');
	if ($q === false) {
		http_error(500, false);
		die();
	} elseif (empty($q)) {
		http_error(404, false);
		die();
	} else {
		header('Content-type: application/octet-stream');
		header('Content-Disposition: attachment; filename="board'.$board.'_rev'.$rev.'_top.png"');
		echo $q[0]['png'];
		die();
	}
} elseif ($_REQUEST['method'] == 'getLibrary') {
	// sort it with revision ascending so that later entries overwrite prior ones
	$q = db_fetch('parts', 'visible=1 ORDER BY title ASC, part ASC, rev ASC');
	if ($q === false) {
		http_error(500, false);
		die();
	}
	$ret = array();
	foreach ($q as $r) {
		$part = setupPart($r, array('extensive'=>true));
		$ret[$part['part']] = $part;
		unset($ret[$part['part']]['part']);
	}
	return json_response($ret);
} elseif ($_REQUEST['method'] == 'load') {
	$board = arg_required($_REQUEST['board'], 'integer');

	if (@is_int($_REQUEST['rev'])) {
		$rev = $_REQUEST['rev'];
	} else {
		// use the latest revision
		$q = db_fetch_raw('SELECT rev FROM revisions WHERE board='.$board.' ORDER BY rev DESC LIMIT 1');
		if ($q === false) {
			http_error(500, false);
			die();
		} elseif (empty($q)) {
			// no revision for board
			http_error(404, false);
			die();
		} else {
			$rev = $q[0]['rev'];
		}
	}

	$q = db_fetch('revisions', 'board='.$board.' AND rev='.$rev);
	if ($q === false) {
		http_error(500, false);
		die();
	} elseif (empty($q)) {
		// revision not found
		http_error(404, false);
		die();
	} else {
		$json = @json_decode($q[0]['json'], true);
		$json['board'] = $board;
		$json['rev'] = $rev;
		$json['author'] = $q[0]['author'];
		$json['parentBoard'] = $q[0]['parentBoard'];
		$json['parentRev'] = $q[0]['parentRev'];
		// load layers
		$json['layers'] = array();
		$q = db_fetch('layers', 'board='.$board.' AND rev='.$rev);
		if ($q !== false) {
			foreach ($q as $l) {
				$json['layers'][$l['layer']] = array('width'=>$l['width'], 'height'=>$l['height'], 'png'=>'data:image/png;base64,'.@base64_encode($l['png']));
			}
		}
		json_response($json);
	}
} elseif ($_REQUEST['method'] == 'save') {
	checkAuth();
	$board = $_REQUEST['board'];
	$auth = $_REQUEST['auth'];

	// check if we have the permission to save a revision
	if ($board['board'] !== NULL) {
		$q = db_fetch('boards', 'board='.@intval($board['board']));
		if ($q === false) {
			http_error(500, false);
			die();
		} elseif (empty($q)) {
			// unknown board
			http_error(400, false);
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
			http_error(500, false);
			die();
		} else {
			$board['board'] = $id;
			$board['rev'] = 1;
		}
	} else {
		// create a new revision
		$q = db_fetch_raw('SELECT rev FROM revisions WHERE board='.@intval($board['board']).' ORDER BY rev DESC LIMIT	1');
		if ($q === false) {
			http_error(500, false);
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
	http_error(400, false);
	die();
}