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
<link rel="stylesheet" href="<?php echo base_url(); ?>css/bootstrap.min.css" type="text/css">
<link rel="stylesheet" href="<?php echo base_url(); ?>css/pcb.css" type="text/css">
<link rel="stylesheet" href="<?php echo base_url(); ?>css/ui.css" type="text/css">
<script type="text/javascript" src="<?php echo base_url(); ?>js/<?php echo JQUERY; ?>"></script>
<script type="text/javascript" src="<?php echo base_url(); ?>js/paper.js"></script>
<script type="text/javascript" src="<?php echo base_url(); ?>js/pcb.js"></script>
<script type="text/javascript" src="<?php echo base_url(); ?>js/ui.js"></script>
<script type="text/javascript">
	try { $.pcb.baseUrl('<?php echo base_url(); ?>'); } catch (e) {}
<?php

	if (!empty($_REQUEST['board'])) {
		echo tab().'$(document).ready(function(e) { $.pcb.load('.$_REQUEST['board'];
		if (!empty($_REQUEST['rev'])) {
			echo ', '.$_REQUEST['rev'];
		}
		echo '); });'.nl();
	}

?>
</script>
</head>
<body>
<div id="pcb-tool-draw" class="pcb-tool pcb-ui" title="Draw (shift to set diameter, alt for manual coordinates)"></div>
<div id="pcb-tool-erase" class="pcb-tool pcb-ui" title="Erase (shift to set diameter, alt for manual coordinates)"></div>
<div id="pcb-tool-drill" class="pcb-tool pcb-ui" title="Place a drill hole (shift to set diameter, alt for manual coordinates)"></div>
<div id="pcb-tool-part" class="pcb-tool pcb-ui" title="Place a part (alt for manual coordinates)"></div>
<object id="pcb-wacom-plugin" type="application/x-wacomtabletplugin" style="height: 0px; width: 0px;"></object>
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
