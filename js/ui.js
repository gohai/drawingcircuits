// ui.js
// Copyright Gottfried Haider 2013.
// This source code is licensed under the GNU General Public License. See the file COPYING for more details.

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
});