<?php

/*
 *	db.inc.php
 *	MySQL Database abstraction
 *
 *	Copyright Gottfried Haider 2013.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

// Default database configuration
// see db_default_context
//@define('DB_HOST', 'localhost');
//@define('DB_USER', 'user');
//@define('DB_PASS', 'pass');
//@define('DB_NAME', 'database');

/**
 *	return the default database context
 *
 *	@return			(array) database context
 */
function db_default_ctx()
{
	return array('host' => DB_HOST, 'user' => DB_USER, 'pass' => DB_PASS, 'db' => DB_NAME);
}


/**
 *	delete a row
 *
 *	@param $table	(string) table name (escaped)
 *	@param $where	(string) where clause (escaped)
 *	@param $ctx		(array) database context to use (see db_default_ctx())
 *	@return			(int) number of rows affected (or false)
 */
function db_delete($table, $where, $ctx = array())
{
	if (empty($ctx)) {
		$ctx = db_default_ctx();
	}

	if (!@mysql_connect($ctx['host'], $ctx['user'], $ctx['pass'])) {
		return false;
	}
	@mysql_set_charset('utf8');
	@mysql_select_db($ctx['db']);

	if (!@mysql_query('DELETE FROM `'.$table.'` WHERE '.$where)) {
		return false;
	}

	return @mysql_affected_rows();
}


/**
 *	return the last error message
 *
 *	@return			(string) database error
 */
function db_error()
{
	return @mysql_error();
}


/**
 *	escape string for MySQL
 *
 *	@param $s		string to be escaped
 *	@param $ctx		(array) database context to use (see db_default_ctx())
 *	@return			escaped string ('' in case of error)
 */
function db_esc($s, $ctx = array())
{
	if (empty($ctx)) {
		$ctx = db_default_ctx();
	}

	if (!@mysql_connect($ctx['host'], $ctx['user'], $ctx['pass'])) {
		return '';
	}
	@mysql_set_charset('utf8');
	@mysql_select_db($ctx['db']);

	if (!($ret = @mysql_real_escape_string($s))) {
		return '';
	} else {
		return $ret;
	}
}


/**
 *	return result of a query as an associative array
 *
 *	@param $table	(string) table name (escaped)
 *	@param $where	(string) where clause (escaped, default: 1)
 *	@param $ctx		(array) database context to use (see db_default_ctx())
 *	@return			array of associative arrays (or false)
 */
function db_fetch($table, $where = '', $ctx = array())
{
	if (empty($where)) {
		$where = '1';
	}
	$query = 'SELECT * FROM `'.$table.'` WHERE '.$where;
	return db_fetch_raw($query, $ctx);
}


/**
 *	return result of a query as an associative array
 *
 *	This only works with the default context.
 *	@param $query	(string) formatted string (escaped)
 *	@param ...		(mixed) variable arguments (escaped)
 *	@return			array of associative arrays (or false)
 */
function db_fetch_format($query)
{
	$query = @call_user_func_array('sprintf', func_get_args());
	return db_fetch_raw($query);
}


/**
 *	return result of a query as an associative array
 *
 *	@param $query	(string) query string (escaped)
 *	@param $ctx		(array) database context to use (see db_default_ctx())
 *	@return			array of associative arrays (or false)
 */
function db_fetch_raw($query, $ctx = array())
{
	if (empty($ctx)) {
		$ctx = db_default_ctx();
	}

	if (!@mysql_connect($ctx['host'], $ctx['user'], $ctx['pass'])) {
		return false;
	}
	@mysql_set_charset('utf8');
	@mysql_select_db($ctx['db']);

	if (!($q = @mysql_query($query))) {
		return false;
	}

	// fetch result
	$ret = array();
	while ($r = @mysql_fetch_assoc($q)) {
		$ret[] = db_type_dec($q, $r);
	}

	return $ret;
}


/**
 *	insert a row
 *
 *	@param $table	(string) table name (escaped)
 *	@param $fields	(array) column=>value pairs (variable type must match)
 *	@param $ctx		(array) database context to use (see db_default_ctx())
 *	@return			(int) new id (or false)
 */
function db_insert($table, $fields = array(), $ctx = array())
{
	if (empty($ctx)) {
		$ctx = db_default_ctx();
	}

	if (!@mysql_connect($ctx['host'], $ctx['user'], $ctx['pass'])) {
		return false;
	}
	@mysql_set_charset('utf8');
	@mysql_select_db($ctx['db']);

	$col = '';
	$val = '';
	foreach($fields as $c=>$v) {
		$enc = db_type_enc($v);
		if ($enc === false) {
			continue;
		}
		$col .= '`'.$c.'`, ';
		$val .= $enc.', ';
	}
	// remove last ', '
	$col = substr($col, 0, -2);
	$val = substr($val, 0, -2);

	if (!@mysql_query('INSERT INTO `'.$table.'` ('.$col.') VALUES ('.$val.')')) {
		return false;
	}

	return @mysql_insert_id();
}


/**
 *	delete all rows
 *
 *	@param $table	(string) table name (escaped)
 *	@param $ctx		(array) database context to use (see db_default_ctx())
 *	@return			(boolean) true if successful, false if not
 */
function db_truncate($table, $ctx = array())
{
	if (empty($ctx)) {
		$ctx = db_default_ctx();
	}

	if (!@mysql_connect($ctx['host'], $ctx['user'], $ctx['pass'])) {
		return false;
	}
	@mysql_set_charset('utf8');
	@mysql_select_db($ctx['db']);

	if (!@mysql_query('TRUNCATE TABLE `'.$table.'`')) {
		return false;
	}

	return true;
}


/**
 *	convert MySQL result to native PHP types
 *
 *	@param $q		(query) MySQL query
 *	@param $r		(array) query result row
 *	@return			associative array
 */
function db_type_dec($q, $r)
{
	$i = 0;
	foreach ($r as $ind=>$val) {
		// handle NULL
		if (is_null($val)) {
			$r[$ind] = NULL;
			$i++;
			continue;
		}
		switch (@mysql_field_type($q, $i)) {
			case 'bool':
				if ($val == '1') {
					$r[$ind] = true;
				} else {
					$r[$ind] = false;
				}
				break;
			case 'real':
				$r[$ind] = floatval($val);
				break;
			case 'int':
			case 'mediumint':
			case 'longint':
				$r[$ind] = intval($val);
				break;
			// nothing to do for string, date
		}
		$i++;
	}

	return $r;
}


/**
 *	convert native PHP types to a MYSQL-compatible syntax
 *
 *	@param $v		(mixed) variable
 *	@return			string (or false incase of unsupported type)
 */
function db_type_enc($v)
{
	if (is_bool($v)) {
		if ($v) {
			return '1';
		} else {
			return '0';
		}
	} elseif (is_float($v) || is_int($v)) {
		return strval($v);
	} elseif (is_null($v)) {
		return 'NULL';
	} elseif (is_string($v) && $v == 'NOW()') {
		// HACK
		return $v;
	} elseif (is_string($v)) {
		return '\''.@mysql_real_escape_string($v).'\'';
	} else {
		// ignore value
		return false;
	}
}


/**
 *	update rows
 *
 *	@param $table	(string) table name (escaped)
 *	@param $where	(string) where clause (escaped)
 *	@param $values	(array) column=>value pairs (variable type must match)
 *	@param $limit	(int) limit (default: no limit)
 *	@param $ctx		(array) database context to use (see db_default_ctx())
 *	@return			(int) number of affected rows (or false)
 */
function db_update($table, $where, $values, $limit = 0, $ctx = array())
{
	if (empty($ctx)) {
		$ctx = db_default_ctx();
	}

	if (!@mysql_connect($ctx['host'], $ctx['user'], $ctx['pass'])) {
		return false;
	}
	@mysql_set_charset('utf8');
	@mysql_select_db($ctx['db']);

	// setup string
	$set = '';
	foreach ($values as $col=>$val) {
		$enc = db_type_enc($val);
		if ($enc === false) {
			continue;
		}
		$set .= '`'.$col.'`='.$enc.', ';
	}
	// remove last ', '
	$set = substr($set, 0, -2);

	// setup limit
	if ($limit == 0) {
		$limit = '';
	} else {
		$limit = ' LIMIT '.intval($limit);
	}

	if (!@mysql_query('UPDATE `'.$table.'` SET '.$set.' WHERE '.$where.$limit)) {
		return false;
	}

	return @mysql_affected_rows();
}
