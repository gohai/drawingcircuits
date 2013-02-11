<?php
@require_once('config.inc.php');
?>
<!DOCTYPE html>
<html>
<head>
<title>Drawing Circuits: Signup</title>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width">
<link rel="stylesheet" href="<?php echo base_url(); ?>css/reset.min.css" type="text/css">
<link rel="stylesheet" href="<?php echo base_url(); ?>css/ui.css" type="text/css">
<style type="text/css">
	h1 {
		margin-bottom: 10px;
		text-align: center;
	}
	input {
		height: 16px;
		margin: 2px 0px;
		width: 194px;
	}
	#pcb-signup {
		border-color: lightgrey;
		border-style: solid;
		border-width: 1px;
		margin: 100px auto;
		padding: 20px 40px;
		width: 200px;
	}
	#pcb-signup-btn {
		margin-top: 10px;
		width: 200px;
	}
</style>
<script type="text/javascript" src="<?php echo base_url(); ?>js/<?php echo JQUERY; ?>"></script>
<script type="text/javascript">
$(document).ready(function() {
	var baseUrl = '<?php echo base_url(); ?>';
	$('#pcb-signup-btn').on('click', function(e) {
		// TODO: put this elsewhere
		var data = {
			method: 'addUser',
			user: $('#pcb-signup-user').val(),
			email: $('#pcb-signup-email').val(),
			password: $('#pcb-signup-password').val()
		};
		for (var key in data) {
			data[key] = JSON.stringify(data[key]);
		}
		$.ajax({
			url: baseUrl+'ajax.php',
			type: 'POST',
			data: data,
			dataType: 'json',
			success: function(data) {
				if (data === null) {
					alert('There was an error creating a new user, please try again later');
				} else if (data.uid === undefined) {
					alert('User '+$('#pcb-signup-user').val()+' already exists');
					$('#pcb-signup-user').focus();
				} else {
					localStorage.setItem('pcbSecret', data.secret);
					localStorage.setItem('pcbUid', data.uid);
					localStorage.setItem('pcbUser', data.user);
					window.location = baseUrl;
				}
			}
		});
		return false;
	});
});
</script>
</head>
<body>
<div id="pcb-signup">
<form>
<h1>Signup for Drawing Circuits</h1>
<p><input type="text" id="pcb-signup-user" placeholder="Username" autofocus></p>
<p><input type="email" id="pcb-signup-email" placeholder="Email"></p>
<p><input type="password" id="pcb-signup-password" placeholder="Password"></p>
<p><input type="submit" id="pcb-signup-btn" value="Submit"></p>
</form>
</div>
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
