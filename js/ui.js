// ui.js
// Copyright Gottfried Haider 2013.
// This source code is licensed under the GNU General Public License. See the file COPYING for more details.

(function() {

var ui = {
	lastManualRot: 0,
	lastManualX: null,
	lastManualY: null
};

function alphanumCase(a, b) {
	// taken from http://www.davekoelle.com/files/alphanum.js (GPL-licensed)
	function chunkify(t) {
		var tz = new Array();
		var x = 0, y = -1, n = 0, i, j;

		while (i = (j = t.charAt(x++)).charCodeAt(0)) {
			var m = (i == 46 || (i >=48 && i <= 57));
			if (m !== n) {
				tz[++y] = "";
				n = m;
			}
			tz[y] += j;
		}
		return tz;
	}

	var aa = chunkify(a.toLowerCase());
	var bb = chunkify(b.toLowerCase());

	for (x = 0; aa[x] && bb[x]; x++) {
		if (aa[x] !== bb[x]) {
			var c = Number(aa[x]), d = Number(bb[x]);
			if (c == aa[x] && d == bb[x]) {
				return c - d;
			} else {
				return (aa[x] > bb[x]) ? 1 : -1;
			}
		}
	}
	return aa.length - bb.length;
};
var centerElem = function(elem) {
	var windowWidth = $(window).width();
	var windowHeight = $(window).height();
	var elemWidth = $(elem).width();
	var elemHeight = $(elem).height();
	if (elemWidth < windowWidth) {
		$(elem).css('left', (windowWidth/2-elemWidth/2)+'px');
	} else {
		$(elem).css('left', '0px');
	}
	if (elemHeight < windowHeight) {
		$(elem).css('top', (windowHeight/2-elemHeight/2)+'px');
	} else {
		$(elem).css('top', '0px');
	}
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

// TODO: remove
var showImportDialog2 = function() {
	if ($('#pcb-import-dialog').length) {
		$('#pcb-import-dialog').remove();
		$('html').off('.pcb-import-dialog');
		$(window).off('.pcb-import-dialog');
	}
	var parts = $.pcb.library();
	if (parts === false) {
		return false;
	}
	var html = '<div id="pcb-import-dialog">';
	html += '<div>Add drawing</div>';
	html += '<div><input type="text" id="pcb-import-add-drawing-part" placeholder="Name of footprint (e.g. dip28)" style="vertical-align: top;"> <input id="pcb-import-add-drawing-svg" type="file" style="cursor: pointer; opacity: 0; position: absolute; width: 112px;" disabled> <input type="button" id="pcb-import-add-drawing-btn" class="btn" style="width: 112px;" value="Select svg file" disabled></div>';
	html += '<div>Add part</div>';
	html += '<div><p>Parent</p><p><select id="pcb-import-add-part-parent"></select></p><p><input type="text" id="pcb-import-add-part-part" placeholder="Name (e.g. atmega168-dip28)"> <input type="text" id="pcb-import-add-part-title" placeholder="Title (e.g. Atmega 168 (DIP28))"></p><p><input type="text" id="pcb-import-add-part-description" placeholder="Description"></p><div id="pcb-import-add-part-drills"></div><p><input type="text" placeholder="Datasheet URL"> <input type="number" placeholder="Typical use page" min="1" max="999"></p></div>';
	html += '<div>Add supplier</div>';
	html += '<div>Add comment</div>';
	html += '</div>';
	var dialogElem = $(html);
	$('body').append(dialogElem);
	// TODO: clipping
	$(dialogElem).css('left', ($(window).width()/2-$(dialogElem).width()/2)+'px');
	$(dialogElem).css('top', ($(window).height()/2-$(dialogElem).height()/2)+'px');
	$('#pcb-import-add-drawing-part').on('keyup.pcb-import-dialog', function(e) {
		if ($(this).val().length && !$.pcb.requestPending()) {
			$('#pcb-import-add-drawing-svg').prop('disabled', false);
			$('#pcb-import-add-drawing-btn').prop('disabled', false);	
		} else {
			$('#pcb-import-add-drawing-svg').prop('disabled', true);
			$('#pcb-import-add-drawing-btn').prop('disabled', true);
		}
	});
	$('#pcb-import-add-drawing-svg').on('change.pcb-import-dialog', function(e) {
		$('#pcb-import-add-drawing-svg').prop('disabled', true);
		$('#pcb-import-add-drawing-btn').prop('disabled', true);
		$.pcb.addDrawing($('#pcb-import-add-drawing-part').val(), this.files[0], function(data) {
			console.log('added drawing');
			console.log(data);
			var found = false;
			$('#pcb-import-add-part-parent > option').each(function() {
				if ($(this).text() == data.part) {
					found = true;
				}
			});
			if (!found) {
				$('#pcb-import-add-part-parent').append('<option>'+data.part+'</option>');
			}
			$('#pcb-import-add-part-parent').val(data.part);
			$('#pcb-import-add-part-parent').prop('disabled', true);
		});
	});
	// add part
	for (var p in parts) {
		$('#pcb-import-add-part-parent').append('<option>'+p+'</option>');
	}
	$('#pcb-import-add-part-parent').on('change.pcb-import-dialog', function(e) {
		var p = $(this).val();
		$('#pcb-import-add-part-drills').html('');
		var drills = [];
		for (var d in parts[p].drills) {
			if (d.substr(0, 5) != 'drill') {
				drills.push(d);
			}
		}
		drills.sort(alphanumCase);
		for (var i=0; i < drills.length; i++) {
			$('#pcb-import-add-part-drills').append('<div><div style="display: inline-block; padding-left: 5px; width: 100px;">'+drills[i]+'</div></span> <input type="text" placeholder="Description"> <input type="text" placeholder="Comment"> <input type="checkbox"> Mark?</div>');
		}
	});
	$('html').on('click.pcb-import-dialog', function(e) {
		if ($(e.target).is('#pcb-import-dialog') || $(e.target).parents('#pcb-import-dialog').length) {
			return;
		} else {
			$('#pcb-import-dialog').remove();
			$('html').off('.pcb-import-dialog');
			$(window).off('.pcb-import-dialog');
		}
	});
	$(window).on('resize.pcb-import-dialog', function(e) {
		$(dialogElem).css('left', ($(window).width()/2-$(dialogElem).width()/2)+'px');
		$(dialogElem).css('top', ($(window).height()/2-$(dialogElem).height()/2)+'px');
	});
};

var hideDialog = function() {
	$('html').off('.pcb-dlg');
	$(window).off('.pcb-dlg');
	$('.pcb-dlg').remove();
};
// TODO: rework
var showImportDialog = function() {
	// destroy if already shown
	hideDialog();
	// get library
	var library = $.pcb.library();
	if (library === false) {
		return false;
	}
	// create
	var html = '<div id="pcb-dlg-import" class="pcb-dlg pcb-ui">';
	html += '<div><h1>Add drawing</h1><div class="pcb-dlg-import-collapsible">TODO</div></div>';
	html += '<div><h1>Add part</h1><div class="pcb-dlg-import-collapsible" style="display: none;">TODO</div></div>';
	html += '<div><h1>Add supplier</h1><div class="pcb-dlg-import-collapsible" style="display: none;">TODO</div></div>';
	html += '<div><h1>Add comment</h1><div class="pcb-dlg-import-collapsible" style="display: none;">TODO</div></div>';
	html += '<div><h1>Add schematic</h1><div class="pcb-dlg-import-collapsible" style="display: none;">TODO</div></div>';
	html += '</div>';
	var dialogElem = $(html);
	$('body').append(dialogElem);
	centerElem(dialogElem);
	// handle sections
	$('#pcb-dlg-import h1').on('click', function(e) {
		$(this).parent().children('.pcb-dlg-import-collapsible').toggle('fast');
		$(this).parent().siblings().children('.pcb-dlg-import-collapsible').hide('fast');
	});
	// handle resize
	$(window).on('resize.pcb-dlg', function(e) {
		centerElem(dialogElem);
	});
	// handle close
	$('html').on('click.pcb-dlg', function(e) {
		if ($(e.target).is('#pcb-dlg') || $(e.target).parents('#pcb-dlg-import').length) {
			return;
		} else {
			hideDialog();
		}
	});
	return true;
};
var showLoginBar = function() {
	if ($('#pcb-login').length) {
		$('#pcb-login').remove();
	}
	var auth = $.pcb.auth();
	if (auth.uid) {
		var elem = $('<div id="pcb-login" class="pcb-ui">Hello '+auth.user+' (<a href="#" id="pcb-login-logout">Logout</a>)</div>');
	} else {
		var elem = $('<div id="pcb-login" class="pcb-ui"><a href="#" id="pcb-login-login">Login</a> or <a href="'+$.pcb.baseUrl()+'signup" target="_blank">Signup</a></div>');
	}
	$('body').prepend(elem);
	$('#pcb-login-login').on('click', function(e) {
		$('#pcb-login').html('<form><input id="pcb-login-user" type="text" placeholder="User" autofocus> <input id="pcb-login-password" type="password" placeholder="Pass"> <input id="pcb-login-btn" type="submit" value="Login"></form>');
		$('#pcb-login-btn').on('click', function(e) {
			$.pcb.auth($('#pcb-login-user').val(), $('#pcb-login-password').val(), function() {
				showLoginBar();
			}, function() {
				$('#pcb-login').html('<span id="pcb-login-error">Wrong username or password</span>');
				setTimeout(showLoginBar, 2000);
			});
			return false;
		});
		// TODO: hide when clicking outside
	});
	$('#pcb-login-logout').on('click', function(e) {
		$.pcb.deauth();
		showLoginBar();
	});
};
var showMetadataDialog = function() {
	// destroy if already shown
	hideDialog();
	var dialogElem = $('<div id="pcb-dlg-metadata" class="pcb-dlg pcb-ui"><h2>Title</h2><p><input type="text" id="pcb-dlg-metadata-title" autofocus></p><p id="pcb-dlg-metadata-author"></p><h2>Description</h2><p><textarea id="pcb-dlg-metadata-description"></textarea></p><p><input type="checkbox" id="pcb-dlg-metadata-ispattern"> Is a pattern</p><h2>Bill of materials</h2><p><textarea id="pcb-dlg-metadata-bom"></textarea></p><p id="pcb-dlg-metadata-parts"></p><p><input type="button" id="pcb-dlg-metadata-btn" value="Apply"></p></div>');
	// TODO: explain pattern
	$('body').append(dialogElem);
	centerElem(dialogElem);
	var metadata = $.pcb.metadata();
	if (metadata.title) {
		$('#pcb-dlg-metadata-title').val(metadata.title);
	}

	// author
	var authorString = 'by ';
	if (metadata.author) {
		// TODO: resolve
		authorString += 'UID '+metadata.author;
	} else {
		authorString += 'Anonymous practitioner';
	}
	if (metadata.parentBoard) {
		authorString += ', based on <a href="'+$.pcb.baseUrl()+metadata.parentBoard+'/'+metadata.parentRev+'" target="_blank">Board '+metadata.parentBoard+' Revision '+metadata.parentRev+'</a>';
	}
	$('#pcb-dlg-metadata-author').html(authorString);

	if (metadata.description) {
		$('#pcb-dlg-metadata-description').val(metadata.description);
	}
	if (metadata.isPattern) {
		$('#pcb-dlg-metadata-ispattern').prop('checked', true);
	}
	if (metadata.bom) {
		$('#pcb-dlg-metadata-bom').val(metadata.bom);
	}

	// list parts on board
	var partsString = '';
	var library = $.pcb.library();
	if (library) {
		var parts = {};
		var objects = $.pcb.objects();
		for (var p in objects.parts) {
			var part = objects.parts[p].part;
			if (parts[part] !== undefined) {
				parts[part] += 1;
			} else {
				parts[part] = 1;
			}
		}
		for (var p in parts) {
			if (partsString.length) {
				partsString += ', ';
			}
			partsString += parts[p]+'x '+library[p].title;
			// TODO: list suppliers
		}
	}
	if (!partsString.length) {
		partsString = 'None';
	}
	$('#pcb-dlg-metadata-parts').html('Parts currently on the board: '+partsString);

	// handle button
	$('#pcb-dlg-metadata-btn').on('click', function(e) {
		$.pcb.metadata('title', $('#pcb-dlg-metadata-title').val());
		$.pcb.metadata('description', $('#pcb-dlg-metadata-description').val());
		$.pcb.metadata('isPattern', $('#pcb-dlg-metadata-ispattern').prop('checked'));
		$.pcb.metadata('bom', $('#pcb-dlg-metadata-bom').val());
		hideDialog();
	});
	// handle resize
	$(window).on('resize.pcb-dlg', function(e) {
		centerElem(dialogElem);
	});
	// handle close
	// TODO: unify
	$('html').on('click.pcb-dlg', function(e) {
		if ($(e.target).is('#pcb-dlg-metadata') || $(e.target).parents('#pcb-dlg-metadata').length) {
			return;
		} else {
			hideDialog();
		}
	});
};
var showPartDialog = function() {
	// destroy if already shown
	hideDialog();
	// get library
	var library = $.pcb.library();
	if (library === false) {
		return false;
	}
	// create
	var dialogElem = $('<div id="pcb-dlg-part" class="pcb-dlg pcb-ui"><ul id="pcb-dlg-part-list"></ul><div id="pcb-dlg-part-info"></div></div>');
	$('body').append(dialogElem);
	// add parts to list
	for (var p in library) {
		var itemElem = $('<li data-part="'+p+'">'+library[p].title+'</li>');
		if (p == $.pcb.selectPart()) {
			$(itemElem).addClass('pcb-dlg-part-list-selected');
		}
		$('#pcb-dlg-part-list').append(itemElem);
	}
	// handle selection
	$('#pcb-dlg-part-list > li').on('click.pcb-dlg', function(e) {
		$('.pcb-dlg-part-list-selected').removeClass('pcb-dlg-part-list-selected');
		$.pcb.selectPart($(this).data('part'));
		$.pcb.tool('part');
		$(this).addClass('pcb-dlg-part-list-selected');
	});
	// handle hover
	$('#pcb-dlg-part-list > li').on('mouseenter.pcb-dlg', function(e) {
		var p = $(this).data('part');
		var part = library[p];
		var html = '';
		if (part.description !== undefined) {
			html += '<p class="pcb-dlg-part-info-description">'+part.description+'</p>';
		}
		html += '<p class="pcb-dlg-part-info-name">'+p+'</p>';
		html += '<p class="pcb-dlg-part-info-dimensions">'+part.width+' x '+part.height+' mm</p>';
		if (part.datasheet !== undefined) {
			html += '<p class="pcb-dlg-part-info-datasheet"><a href="'+part.datasheet+'" target="_blank">Open Datasheet</a></p>';
		}
		// pins
		pins = [];
		for (var d in part.drills) {
			if (d.substr(0, 5) != 'drill' && part.drills[d].comment !== undefined) {
				pins.push(d);
			}
		}
		if (pins.length) {
			pins.sort(alphanumCase);
			html += '<p class="pcb-dlg-part-info-pins"><span class="pcb-dlg-part-info-h">Pins:</span></p>';
			html += '<ul class="pcb-dlg-part-info-pins">';
			for (var i=0; i < pins.length; i++) {
				var pin = pins[i];
				html += '<li>';
				if (part.drills[pin].description !== undefined) {
					html += part.drills[pin].description;
				} else {
					html += pin;
				}
				html += ' - '+part.drills[pin].comment+'</li>';
			}
			html += '</ul>';
		}
		// suppliers
		var suppliers = [];
		for (var s in part.suppliers) {
			suppliers.push(part.suppliers[s]);
		}
		if (suppliers.length) {
			html += '<p class="pcb-dlg-part-info-suppliers"><span class="pcb-dlg-part-info-h">Suppliers:</span></p>';
			html += '<ul class="pcb-dlg-part-info-suppliers">';
			for (var i=0; i < suppliers.length; i++) {
				var supplier = suppliers[i];
				html += '<li>';
				if (supplier.url !== null) {
					html += '<a href="'+supplier.url+'" target="_blank">';
				}
				html += supplier.supplier;
				if (supplier.partNumber !== null) {
					html += ': '+supplier.partNumber;
				}
				if (supplier.url !== null) {
					html += '</a>';
				}
				html += '</li>';
			}
			html += '</ul>';
		}
		// comments
		var comments = [];
		for (var c in part.comments) {
			comments.push(part.comments[c]);
		}
		if (comments.length) {
			html += '<p class="pcb-dlg-part-info-comments"><span class="pcb-dlg-part-info-h">Comments:</span></p>';
			html += '<ul class="pcb-dlg-part-info-comments">';
			for (var i=0; i < comments.length; i++) {
				var comment = comments[i];
				html += '<li>';
				if (comment.author === null) {
					html += 'Anonymous practitioner wrote: ';
				} else {
					// TODO: resolve
					html += 'UID '+comment.author+' wrote: ';
				}
				html += comment.comment;
				html += '</li>';
			}
			html += '</ul>';
		}
		$('#pcb-dlg-part-info').html(html);
	});
	// handle close
	$('html').on('click.pcb-dlg', function(e) {
		if ($(e.target).is('#pcb-dlg-part') || $(e.target).parents('#pcb-dlg-part').length) {
			return;
		} else {
			hideDialog();
		}
	});
	return true;
};
var showPatternDialog = function(showAllBoards) {
	// destroy if already shown
	hideDialog();
	// create
	var dialogElem = $('<div id="pcb-dlg-pattern" class="pcb-dlg pcb-ui"><ul id="pcb-dlg-pattern-list"></ul></div>');
	$('body').append(dialogElem);
	// add patterns to the list
	$.pcb.patternsLibrary(function(patterns) {
		$.each(patterns, function() {
			if (this.isPattern !== true && showAllBoards !== true) {
				return;
			}
			if (this.title !== undefined) {
				var itemElem = $('<li>'+this.title+'</li>');
			} else {
				var itemElem = $('<li>Unnamed pattern '+this.board+'</li>');
			}
			var that = this;
			$(itemElem).on('click', function() {
				$.pcb.selectPattern(that.board);
				$.pcb.tool('pattern');
			});
			$('#pcb-dlg-pattern-list').append(itemElem);
		});
	});
	// handle close
	$('html').on('click.pcb-dlg', function(e) {
		if ($(e.target).is('#pcb-dlg-pattern') || $(e.target).parents('#pcb-dlg-pattern').length) {
			return;
		} else {
			hideDialog();
		}
	});
	return true;
};

$(document).ready(function() {
	$('html').on('pcb-saving', function(e) {
		var elem = $('<div id="pcb-ui-banner-saving" class="pcb-ui-banner pcb-ui">Saving</div>');
		$('body').append(elem);
		$(elem).css('left', ($(window).width()-$(elem).width())/2);
		$(elem).css('top', ($(window).height()-$(elem).height())/2);
	});
	$('html').on('pcb-saved', function(e) {
		$('#pcb-ui-banner-saving').remove();
	});
	$('html').on('pcb-tool-changed', function(e) {
		$('.pcb-tool-selected').removeClass('pcb-tool-selected');
		$('#pcb-tool-'+$.pcb.tool()).addClass('pcb-tool-selected');
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
		} else {
			showPartDialog();
			return false;
		}
	});
	$('#pcb-tool-pattern').on('click', function(e) {
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
			$.pcb.pattern(c.x, c.y, rot);
			ui.lastManualRot = rot;
		} else {
			if (e.shiftKey) {
				showPatternDialog(true);
			} else {
				showPatternDialog();
			}
			return false;
		}
	});
	$('#pcb-icon-remove').on('click', function(e) {
		// TODO: grey out
		var sel = $.pcb.select();
		if (sel !== null) {
			$.pcb.removeObject(sel);
		}
	});
	$('#pcb-icon-clear').on('click', function(e) {
		if (confirm("Do you want to abandon your current drawing?")) {
			$.pcb.clear();
		}
	});
	$('#pcb-icon-save').on('click', function(e) {
		if (e.shiftKey) {
			var asNew = true;
		} else {
			var asNew = false;
		}
		if (!$.pcb.requestPending()) {
			var origBoard = $.pcb.board();
			$.pcb.save(asNew);
			// wait for request to finish
			var retry = function() {
				if (!$.pcb.requestPending()) {
					if (origBoard !== $.pcb.board()) {
						// redirect
						$.pcb.allowNavigation(true);
						window.location = $.pcb.baseUrl()+$.pcb.board();
					}
				} else {
					setTimeout(retry, 100);
				}
			};
			setTimeout(retry, 100);
		}
	});
	$('#pcb-icon-metadata').on('click', function(e) {
		showMetadataDialog();
		return false;
	});
	$('#pcb-icon-fabricate').on('click', function(e) {
		if (e.shiftKey) {
			$.pcb.export($.pcb.exportPreset('modela'));
		} else {
			$.pcb.export($.pcb.exportPreset('camm'));
		}
		// TODO (later): animation
	});
	$('#pcb-icon-zoomin').on('click', function(e) {
		$.pcb.zoom($.pcb.zoom()*0.8);
	});
	$('#pcb-icon-zoomout').on('click', function(e) {
		$.pcb.zoom($.pcb.zoom()*1.2);
	});
	showLoginBar();
});

})();
