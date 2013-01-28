// ui.js
// Copyright Gottfried Haider 2013.
// This source code is licensed under the GNU General Public License. See the file COPYING for more details.

(function() {

var ui = {
	lastManualRot: 0,
	lastManualX: null,
	lastManualY: null
};

var promptManualCoords = function() {
	s = prompt('Set x coordinate (mm)', ui.lastManualX);
	if (s === null) {
		return false;
	} else {
		var x = parseFloat(s);
	}
	s = prompt('Set y coordinate (mm)', ui.lastManualY);
	if (s === null) {
		return false;
	} else {
		var y = parseFloat(s);
	}
	ui.lastManualX = x;
	ui.lastManualY = y;
	return {x: x, y: y};
};

$(document).ready(function() {
	$('html').on('pcb-loading', function(e) {
		var elem = $('<div id="pcb-ui-banner-loading" class="pcb-ui-banner pcb-ui">Loading</div>');
		$('body').append(elem);
		$(elem).css('left', ($(window).width()-$(elem).width())/2);
		$(elem).css('top', ($(window).height()-$(elem).height())/2);
	});
	$('html').on('pcb-loaded', function(e) {
		$('#pcb-ui-banner-loading').remove();
	});
	$('html').on('pcb-saving', function(e) {
		var elem = $('<div id="pcb-ui-banner-saving" class="pcb-ui-banner pcb-ui">Saving</div>');
		$('body').append(elem);
		$(elem).css('left', ($(window).width()-$(elem).width())/2);
		$(elem).css('top', ($(window).height()-$(elem).height())/2);
	});
	$('html').on('pcb-saved', function(e) {
		$('#pcb-ui-banner-saving').remove();
	});

	$('.pcb-tool').on('click', function(e) {
		var p = $(this).prop('id').lastIndexOf('-');
		if (p === -1) {
			return;
		} else {
			$.pcb.tool($(this).prop('id').substr(p+1));
		}
	});
	$('#pcb-tool-draw, #pcb-tool-erase, #pcb-tool-drill').on('click', function(e) {
		if (e.shiftKey || e.altKey) {
			var s = prompt('Set diameter (mm)', $.pcb.diameter());
			if (s === null) {
				return;
			} else {
				$.pcb.diameter(parseFloat(s));
			}
		}
		if (e.altKey) {
			var c = promptManualCoords();
			if (c !== false) {
				$.pcb.point(c.x, c.y);
			}
		}
	});
	$('#pcb-tool-part').on('click', function(e) {
		if (e.altKey) {
			var c = promptManualCoords();
			if (c === false) {
				return;
			}
			s = prompt('Set rotation (deg clockwise)', ui.lastManualRot);
			if (s === null) {
				return;
			} else {
				var rot = parseFloat(s);
			}
			$.pcb.part($.pcb.selectPart(), c.x, c.y, rot);
			ui.lastManualRot = rot;
		}
	});
});

})();
