<?php
@require_once('config.inc.php');
@require_once('util.inc.php');
?>
<!DOCTYPE html>
<html>
<head>
<title>Drawing Circuits</title>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width">
<link rel="stylesheet" href="<?php echo base_url(); ?>css/reset.min.css" type="text/css">
<link rel="stylesheet" href="<?php echo base_url(); ?>css/pcb.css" type="text/css">
<link rel="stylesheet" href="<?php echo base_url(); ?>css/ui.css" type="text/css">
<script type="text/javascript" src="<?php echo base_url(); ?>js/<?php echo JQUERY; ?>"></script>
<script type="text/javascript" src="<?php echo base_url(); ?>js/jquery-migrate-1.1.0.js"></script>
<script type="text/javascript" src="<?php echo base_url(); ?>js/paper.js"></script>
<script type="text/javascript" src="<?php echo base_url(); ?>js/pcb.js"></script>
<script type="text/javascript" src="<?php echo base_url(); ?>js/ui.js"></script>
<script type="text/javascript">
	try { $.pcb.baseUrl('<?php echo base_url(); ?>'); } catch (e) {}
<?php

	$board = DEFAULT_BOARD;
	if (!empty($_REQUEST['board'])) {
		$board = $_REQUEST['board'];
	}
	if (!empty($board)) {
		echo tab().'$(document).ready(function(e) { $.pcb.load('.$board;
		if (!empty($_REQUEST['rev'])) {
			echo ', '.$_REQUEST['rev'];
		}
		echo '); });'.nl();
	}

?>
</script>
</head>
<body>
<div id="pcb-tool-draw" class="pcb-tool pcb-icon pcb-ui" title="Draw (shift to set diameter, alt for manual coordinates)"></div>
<div id="pcb-tool-erase" class="pcb-tool pcb-icon pcb-ui" title="Erase (shift to set diameter, alt for manual coordinates)"></div>
<div id="pcb-tool-drill" class="pcb-tool pcb-icon pcb-ui" title="Place a drill hole (shift to set diameter, alt for manual coordinates)"></div>
<div id="pcb-tool-part" class="pcb-tool pcb-icon pcb-ui" title="Place a part (alt for manual coordinates)"></div>
<div id="pcb-tool-sel" class="pcb-tool pcb-icon pcb-ui" title="Select objects"></div>
<div id="pcb-icon-remove" class="pcb-icon pcb-ui" title="Remove selected object"></div>
<div id="pcb-icon-import" class="pcb-icon pcb-ui" title="Import assets"></div>
<div id="pcb-icon-metadata" class="pcb-icon pcb-ui" title="Metadata"></div>
<!-- <object id="pcb-wacom-plugin" type="application/x-wacomtabletplugin" style="height: 0px; width: 0px;"></object> -->
<?php

	$s = TWITTER;
	if (!empty($s)) {

?>
<div id="pcb-login"></div>
<div id="pcb-twitter">
	<a href="https://twitter.com/<?php echo TWITTER; ?>" class="twitter-follow-button" data-show-count="false" data-size="large" data-show-screen-name="false">Follow @<?php echo TWITTER; ?></a>
	<script>!function(d,s,id){var js,fjs=d.getElementsByTagName(s)[0];if(!d.getElementById(id)){js=d.createElement(s);js.id=id;js.src="//platform.twitter.com/widgets.js";fjs.parentNode.insertBefore(js,fjs);}}(document,"script","twitter-wjs");</script>
</div>
<?php

	}

?>
<?php

	$s = GOOGLE_ANALYTICS;
	if (!empty($s)) {

?>
<script type="text/javascript">
	var _gaq = _gaq || [];
	_gaq.push(['_setAccount', '<?php echo GOOGLE_ANALYTICS; ?>']);
	_gaq.push(['_trackPageview']);
	(function() {
		var ga = document.createElement('script');
		ga.type = 'text/javascript';
		ga.async = true;
		ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
		var s = document.getElementsByTagName('script')[0];
		s.parentNode.insertBefore(ga, s);
	})();
</script>
<?php

	}

?>
</body>
</html>
