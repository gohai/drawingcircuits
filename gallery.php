<?php
@require_once('config.inc.php');
?>
<!DOCTYPE html>
<html>
<head>
<title>Drawing Circuits > Gallery</title>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width">
<link rel="stylesheet" href="<?php echo base_url(); ?>css/reset.min.css" type="text/css">
<link rel="stylesheet" href="<?php echo base_url(); ?>css/ui.css" type="text/css">
<style type="text/css">
	.pcb-gallery-board {
		background-position: center center;
		background-repeat: no-repeat;
		background-size: contain;
		cursor: pointer;
		height: 50px;
		position: absolute;
		transition: all .1s ease;
		-moz-transition: all .1s ease;
		-webkit-transition: all .1s ease;
		width: 50px;
	}
	.pcb-gallery-board:hover {
		transform: scale(3.5);
		-moz-transform: scale(3.5);
		-webkit-transform: scale(3.5);
	}
	#pcb-gallery-first {
		background-image: url("media/gallery_first.jpg");
		background-repeat: no-repeat;
		background-size: 100% 100%;
		left: 0px;
		position: absolute;
		top: 0px;
	}
	#pcb-gallery-nav {
		position: fixed;
	}
	#pcb-gallery-repeat {
		background-image: url("media/gallery_repeat.jpg");
		background-repeat: repeat-x;
		background-size: contain;
		height: 100%;
		position: absolute;
		top: 0px;
		width: 2000px;
	}
</style>
<script type="text/javascript" src="<?php echo base_url(); ?>js/<?php echo JQUERY; ?>"></script>
<script type="text/javascript">
$(document).ready(function() {
	var ajaxRequest = function(data, success) {
		// setup shim success function
		var shimSuccess = function(data) {
			if (typeof success == 'function') {
				success(data);
			}
		};

		// encode request data
		for (var key in data) {
			data[key] = JSON.stringify(data[key]);
		}
		$.ajax({
			url: baseUrl+'ajax.php',
			type: 'POST',
			data: data,
			dataType: 'json',
			success: shimSuccess
		});
	};
	var baseUrl = '<?php echo base_url(); ?>';
	var offset = 200;

	ajaxRequest({method: 'listBoards'}, function(data) {
		$.each(data, function() {
			var elem = $('<div class="pcb-gallery-board"></div>');
			$(elem).css('background-image', 'url("img/thumb-'+this.board+'.png")');
			var that = this;
			$(elem).on('click', function(e) {
				window.location = baseUrl+that.board;
			});
			$(elem).on('mouseenter', function(e) {
				var infoElem = $('<div class="pcb-gallery-board-walltext" style="position: absolute;"></div>');
				$(infoElem).css('left', ($(elem).position().left-30)+'px');
				$(infoElem).css('top', ($(elem).position().top+$(elem).height()+85)+'px');
				$(infoElem).html(that.title);
				$('body').append(infoElem);
			});
			$(elem).on('mouseleave', function(e) {
				$('.pcb-gallery-board-walltext').remove();
			});
			$(elem).css('left', offset+'px');
			offset += 100;
			$(elem).css('top', ($(window).height()*0.45)+'px');
			$('body').append(elem);
		});
		$('#pcb-gallery-repeat').css('width', (offset+150-$('#pcb-gallery-first').width())+'px');
	});

	$(window).resize(function() {
		var imgWidth = 1340;
		var imgHeight = 1000;
		var windowWidth = $(window).width();
		var windowHeight = $(window).height();
		$('#pcb-gallery-first').css('height', windowHeight+'px');
		$('#pcb-gallery-first').css('width', (windowHeight*imgWidth/imgHeight)+'px');
		$('#pcb-gallery-repeat').css('left', (windowHeight*imgWidth/imgHeight)+'px');
		$('#pcb-gallery-repeat').css('width', (offset+150-$('#pcb-gallery-first').width())+'px');
		$('.pcb-gallery-board').css('top', ($(window).height()*0.45)+'px');
	});
	$(window).trigger('resize');
});
</script>
</head>
<body>
<div id="pcb-gallery-first"></div>
<div id="pcb-gallery-repeat"></div>
<div id="pcb-gallery-nav" class="pcb-ui">
<select id="pcb-gallery-sort"><option>Order by date</option><option>Order by name</option><option>Order by reception</option></select>
<input id="pcb-gallery-filter" type="text" placeholder="Search">
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
