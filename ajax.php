<?php

@require_once('config.inc.php');
@require_once('db.inc.php');
@require_once('util.inc.php');

// decode request data
foreach ($_REQUEST as $key=>$val) {
	$_REQUEST[$key] = @json_decode($val, true);
}

if ($_REQUEST['method'] == 'save') {
	check_auth();
	$board = $_REQUEST['board'];
	$auth = $_REQUEST['auth'];
	
	// check if we have the permission to save a revision
	if ($board['board'] !== NULL) {
		$q = db_fetch('boards', 'board='.@intval($board['board']));
		if ($q === false) {
			http_error(500);
		} elseif (empty($q)) {
			// unknown board
			http_error(400);
		} elseif ($q[0]['owner'] !== NULL && $q[0]['owner'] !== $auth['uid']) {
			// TODO: we might check for administrative role here as well
			$board['board'] = NULL;
		}
	}
	
	if ($board['board'] === NULL) {
		// create a new board
		$id = db_insert('boards', array('owner'=>$auth['uid']));
		if ($id === false) {
			http_error(500);
		} else {
			$board['board'] = $id;
			$board['rev'] = 1;
		}
	} else {
		// create a new revision
		$q = db_fetch_raw('SELECT rev FROM revisions WHERE board='.@intval($board['board']).' ORDER BY rev DESC LIMIT	1');
		if ($q === false) {
			http_error(500);
		} elseif (empty($q)) {
			// no revisions
			$board['rev'] = 1;
		} else {
			$board['rev'] = $q[0]['rev']+1;
		}
	}
	
	// save layers separately
	foreach ($board['layers'] as $key=>$val) {
		if (@is_string($val['png'])) {
			if (substr($val['png'], 0, 22) == 'data:image/png;base64,') {
				$val['png'] = @base64_decode(substr($val['png'], 22));
			} else {
				// unsupported Data-URL
				$val['png'] = NULL;
			}
			// png can be set to NULL, meaning that the layer is blank
		}
		db_insert('layers', array('board'=>$board['board'], 'rev'=>$board['rev'], 'layer'=>$key, 'width'=>$val['width'], 'height'=>$val['height'], 'png'=>$val['png']));
	}
	
	// save the rest
	$json = array_key_blacklist($board, array('author', 'board', 'layers', 'parentBoard', 'parentRev', 'rev'));
	$json = json_encode($json, JSON_FORCE_OBJECT);
	db_insert('revisions', array('board'=>$board['board'], 'rev'=>$board['rev'], 'created'=>'NOW()', 'author'=>$auth['uid'], 'host'=>$_SERVER['REMOTE_ADDR'], 'parentBoard'=>$board['parentBoard'], 'parentRev'=>$board['parentRev'], 'json'=>$json));
	// return ids
	ajax_response(array('board'=>$board['board'], 'rev'=>$board['rev']));
} elseif ($_REQUEST['method'] == 'load') {
	if (@is_int($_REQUEST['board'])) {
		$board = $_REQUEST['board'];
	} else {
		// use the default board
		$board = DEFAULT_BOARD;
	}
	
	if (@is_int($_REQUEST['rev'])) {
		$rev = $_REQUEST['rev'];
	} else {
		// use the latest revision
		$q = db_fetch_raw('SELECT rev FROM revisions WHERE board='.$board.' ORDER BY rev DESC LIMIT 1');
		if ($q === false) {
			http_error(500);
		} elseif (empty($q)) {
			// no revision for board
			http_error(404);
		} else {
			$rev = $q[0]['rev'];
		}
	}
	
	$q = db_fetch('revisions', 'board='.$board.' AND rev='.$rev);
	if ($q === false) {
		http_error(500);
	} elseif (empty($q)) {
		// revision not found
		http_error(404);
	} else {
		$json = @json_decode($q[0]['json'], true);
		$json['board'] = $board;
		$json['rev'] = $rev;
		$json['author'] = $q[0]['author'];
		$json['parentBoard'] = $q[0]['parentBoard'];
		$json['parentRev'] = $q[0]['parentRev'];
		ajax_response($json);
	}
} else {
	// unsupported method
	http_error(400);
}


// TODO: move most of those
function ajax_response($data)
{
	header('Content-type: application/json');
	echo @json_encode($data, JSON_FORCE_OBJECT);
	die();
}

function array_key_blacklist($a, $keys)
{
	$ret = array();
	foreach ($a as $key=>$val) {
		if (!in_array($key, $keys)) {
			$ret[$key] = $val;
		}
	}
	return $ret;
}

function check_auth()
{
	if (!@is_array($_REQUEST['auth'])) {
		$_REQUEST['auth'] = array('uid'=>NULL, 'secret'=>NULL);
		return false;
	}
	if (!@is_int($_REQUEST['auth']['uid']) || !@is_string($_REQUEST['auth']['secret'])) {
		$_REQUEST['auth'] = array('uid'=>NULL, 'secret'=>NULL);
		return false;
	}
	$role = check_creds($_REQUEST['auth']['uid'], $_REQUEST['auth']['secret']);
	if ($role !== false) {
		$_REQUEST['auth']['role'] = $role;
		return true;
	} else {
		$_REQUEST['auth'] = array('uid'=>NULL, 'secret'=>NULL);
		return false;
	}
}

function check_creds($uid, $secret)
{
	$q = db_fetch('users', 'uid='.$uid.' AND secret="'.db_esc($secret).'"');
	if (empty($q)) {
		return false;
	} else {
		return $q[0]['role'];
	}
}