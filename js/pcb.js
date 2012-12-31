(function($, window, document, undefined) {
	var options = {
		auth: {
			secret: null,
			uid: null,
			user: null
		},
		baseUrl: null,
		highDpi: 300,
		library: null
	};

	var defaultBoard = {
		author: null,
		board: null,
		drills: {},
		height: 100,
		jumpers: {},
		layers: {
			'bottom': null,
			'substrate': null,
			'top': null
		},
		parentBoard: null,
		parentRev: null,
		parts: {},
		rev: null,
		texts: {},
		width: 100
	};
	var board = {};

	var defaultView = {
		ajaxPending: 0,
		diameterDraw: 2,
		diameterDrill: 1,
		diameterErase: 2,
		lastMouseX: null,
		lastMouseY: null,
		layer: 'top',
		layers: {},
		layersToLoad: 0,
		part: null,
		parts: {},
		redrawPending: false,
		ruler: false,
		tool: 'draw',
		toolData: {},
		zoom: 1
	};
	var view = {};

	// Helper functions
	var addPartsDrills = function(parts, drills) {
		// add parts' drill holes
		for (var p in parts) {
			drills = $.extend(true, drills, drillsFromObject(parts[p], p));
		}
	};
	var ajaxRequest = function(data, success) {
		// setup shim success function
		var shimSuccess = function(data) {
			if (typeof success == 'function') {
				success(data);
			}
			// reference counting (also see ajaxError())
			view.ajaxPending--;
			// sanity check
			if (view.ajaxPending < 0) {
				view.ajaxPending = 0;
			}
		};

		// encode request data
		for (key in data) {
			data[key] = JSON.stringify(data[key]);
		}
		// reference counting
		view.ajaxPending++;
		$.ajax({
			url: options.baseUrl+'ajax.php',
			type: 'POST',
			data: data,
			dataType: 'json',
			success: shimSuccess
		});
	};
	var downloadRequest = function(data) {
		var arg = '';
		// encode request data
		for (key in data) {
			if (arg.length == 0) {
				arg = '?';
			} else {
				arg += '&';
			}
			arg += encodeURIComponent(key);
			arg += '=';
			arg += encodeURIComponent(JSON.stringify(data[key]));
		}
		var iframe = $('<iframe class="pcb-download" style="display: none;"></iframe>');
		// TODO: Resource interpreted as Document but transferred with MIME type application/octet-stream
		$(iframe).prop('src', options.baseUrl+'ajax.php'+arg);
		// TODO: set and check for cookie (see jquery.fileDownload.js)
		$('body').append(iframe);
	};
	var drawDrill = function(ctx, x, y, diameter, opt) {
		if (typeof opt != 'object') {
			opt = {};
		}

		ctx.save();
		ctx.translate(x, y);
		ctx.fillStyle = '#fff'
		ctx.beginPath();
		ctx.arc(0, 0, mmToPx(diameter/2, true), 0, 2*Math.PI);
		ctx.fill();
		// via
		if (opt.via === true) {
			ctx.fillStyle = '#ff0';
			ctx.beginPath();
			ctx.arc(0, 0, mmToPx(diameter/4, true), 0, 2*Math.PI);
			ctx.fill();
		}
		ctx.restore();
	};
	var drawPart = function(ctx, part, x, y, rot, opt) {
		if (typeof rot != 'number') {
			rot = 0;
		}
		if (typeof opt != 'object') {
			opt = {};
		}

		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(rot*Math.PI/180);
		// drill holes
		if (opt.noDrillHoles !== true) {
			for (var d in options.library[part].drills) {
				var drill = options.library[part].drills[d];
				drawDrill(ctx, mmToPx(drill.x, true), mmToPx(drill.y, true), drill.diameter);
			}
		}
		// outline
		var img = requestPart(part);
		if (img !== null) {
			var w = mmToPx(options.library[part].width, true);
			var h = mmToPx(options.library[part].height, true);
			// I don't really know where the +1 comes from, but it is off-center without it
			ctx.drawImage(img, (-w/2)+1, (-h/2)+1, w, h);
		}
		ctx.restore();
	};
	var drillsFromObject = function(obj, name) {
		// get the part
		var part = options.library[obj.part];
		if (part === undefined) {
			return {};
		}
		// calculate the drills, taking into account the object rotation
		var ret = {};
		for (var d in part.drills) {
			var drill = part.drills[d];
			var c = Math.cos(-obj.rot*Math.PI/180);
			var s = Math.sin(-obj.rot*Math.PI/180);
			// coordinate origin is the top-left corner of the _top_ layer
			if (obj.layer == 'bottom') {
				var x = obj.x-(drill.x*c+drill.y*s);
			} else {
				var x = obj.x+(drill.x*c+drill.y*s);
			}
			ret[name+'-'+d] = {
				x: x,
				y: obj.y+(-drill.x*s+drill.y*c),
				diameter: drill.diameter,
				parent: name,
				via: false
			};
		}
		return ret;
	};
	var fillCanvas = function(cvs, color) {
		var ctx = cvs.getContext('2d');
		ctx.save();
		ctx.fillStyle = color;
		ctx.fillRect(0, 0, cvs.width, cvs.height);
		ctx.restore();
	};
	var getFirstAvailableKey = function(object, prefix, start) {
		if (start === undefined) {
			// start with index zero
			var max = -1;
		} else {
			var max = start-1;
		}
		for (var key in object) {
			if (key.substr(0, prefix.length) == prefix) {
				var cur = parseInt(key.substr(prefix.length));
				if (max < cur) {
					max = cur;
				}
			}
		}
		return prefix+(max+1);
	};
	var imgToCanvas = function(src, callback) {
		var img = new Image();
		img.onload = function() {
			var cvs = $('<canvas></canvas>');
			$(cvs).prop('width', this.width);
			$(cvs).prop('height', this.height);
			var ctx = $(cvs).get(0).getContext('2d');
			ctx.save();
			ctx.drawImage(img, 0, 0);
			ctx.restore();
			callback($(cvs).get(0));
		};
		img.src = src;
	};
	var invalidateView = function(l) {
		// delete variable DPI canvas elements
		if (l === undefined) {
			// all layers
			view.layers = {};
		} else if (l !== false) {
			// a specific layer
			delete view.layers[l];
		} else {
			// none (only call redraw())
		}

		// recreate them if needed
		for (var l in board.layers) {
			if (view.layers[l] === undefined) {
				var cvs = $('<canvas></canvas>');
				$(cvs).prop('width', mmToPx(board.width, true));
				$(cvs).prop('height', mmToPx(board.height, true));
				view.layers[l] = $(cvs).get(0);
				// copy
				var ctx = view.layers[l].getContext('2d');
				ctx.save();
				ctx.drawImage(board.layers[l], 0, 0, board.layers[l].width, board.layers[l].height, 0, 0, view.layers[l].width, view.layers[l].height);
				ctx.restore();
			}
		}

		// try to cancel outstanding requests
		if (typeof view.redrawPending == 'number') {
			cancelAnimationFrame(view.redrawPending);
			view.redrawPending = false;
		}
		redraw();
	}
	var isLayerMirrored = function(l) {
		if (l === undefined) {
			l = view.layer;
		}
		if (l == 'bottom') {
			return true;
		} else {
			return false;
		}
	}
	var mirrorContext = function(ctx) {
		ctx.translate(mmToPx(board.width, true)/2, 0);
		ctx.scale(-1, 1);
		ctx.translate(-mmToPx(board.width, true)/2, 0);
	};
	var mmToPx = function(mm, handleZoom) {
		if (handleZoom === false || handleZoom === undefined) {
			// high DPI
			return Math.floor(mm*options.highDpi/25.4);
		} else {
			// variable DPI
			return Math.floor(mm*options.highDpi/25.4/view.zoom);
		}
	};
	var normalizeAngle = function(angle) {
		while (360 < angle) {
			angle -= 360;
		}
		while (angle < 0) {
			angle += 360;
		}
		return angle;
	};
	var pxToMm = function(px, handleZoom) {
		if (handleZoom === false || handleZoom === undefined) {
			// high DPI
			return px/(options.highDpi/25.4);
		} else {
			// variable DPI
			return px/(options.highDpi/25.4)*view.zoom;
		}
	};
	var redraw = function() {
		// clear flag (see requestRedraw())
		view.redrawPending = false;
		// clear canvas
		$('#pcb-canvas').prop('width', mmToPx(board.height, true));
		$('#pcb-canvas').prop('height', mmToPx(board.width, true));
		// draw to screen
		var cvs = $('#pcb-canvas').get(0);
		var ctx = cvs.getContext('2d');
		ctx.save();
		if (isLayerMirrored()) {
			mirrorContext(ctx);
		}
		// enable better quality interpolation
		// TODO: doesn't seem to work on Chrome atm
		//ctx.imageSmoothingEnabled = true;
		//ctx.mozImageSmoothingEnabled = true;
		//ctx.webkitImageSmoothingEnabled = true;

		// parts on the inactive layer
		ctx.save();
		ctx.globalAlpha = 0.1;
		// TODO: there must be a better way to do this
		ctx.globalCompositeOperation = 'lighter';
		for (var p in board.parts) {
			var part = board.parts[p];
			if (part.layer == view.layer) {
				continue;
			} else {
				ctx.save();
				ctx.translate(mmToPx(part.x, true), mmToPx(part.y, true));
				if (part.layer == 'bottom') {
					ctx.scale(-1, 1);
				}
				drawPart(ctx, part.part, 0, 0, part.rot, { noDrillHoles: true });
				drawPart(ctx, part.part, 0, 0, part.rot, { noDrillHoles: true });
				drawPart(ctx, part.part, 0, 0, part.rot, { noDrillHoles: true });
				drawPart(ctx, part.part, 0, 0, part.rot, { noDrillHoles: true });
				drawPart(ctx, part.part, 0, 0, part.rot, { noDrillHoles: true });
				ctx.restore();
			}
		}
		ctx.restore();

		// layers
		ctx.save();
		ctx.globalAlpha = 0.5;
		if (view.layer == 'bottom') {
			var order = ['top', 'substrate', 'bottom'];
		} else if (view.layer == 'substrate') {
			var order = ['bottom', 'top', 'substrate'];
		} else {
			var order = ['bottom', 'substrate', 'top'];
		}
		for (var l in order) {
			ctx.drawImage(view.layers[order[l]], 0, 0);
		}
		ctx.restore();

		// drill holes
		for (var d in board.drills) {
			var drill = board.drills[d];
			drawDrill(ctx, mmToPx(drill.x, true), mmToPx(drill.y, true), drill.diameter, {via: drill.via});
		}
		for (var p in board.parts) {
			var part = board.parts[p];
			var drills = drillsFromObject(part, p);
			for (var d in drills) {
				var drill = drills[d];
				drawDrill(ctx, mmToPx(drill.x, true), mmToPx(drill.y, true), drill.diameter);				
			}
		}

		// parts
		for (var p in board.parts) {
			var part = board.parts[p];
			if (part.layer != view.layer) {
				continue;
			} else {
				ctx.save();
				ctx.translate(mmToPx(part.x, true), mmToPx(part.y, true));
				if (part.layer == 'bottom') {
					ctx.scale(-1, 1);
				}
				drawPart(ctx, part.part, 0, 0, part.rot, { noDrillHoles: true });
				ctx.restore();
			}
		}

		// texts
		// TODO: handle mirrored text
		// TODO: handle zoom
		// TODO: always draw crosshair if we have no parent
		// TODO: right-align text if close to the right border
		// TODO: top to bottom (optional)
		ctx.save();
		for (var t in board.texts) {
			if (typeof board.texts[t].parent == 'object') {
				if (board.texts[t].parent.layer != view.layer) {
					continue;
				}
				var lines = board.texts[t].text.split('\\n');
				var lineHeight = 30;
				ctx.fillStyle = '#ff0';
				ctx.font = 'caption';
				ctx.textBaseline = 'top';
				for (var l in lines) {
					ctx.fillText(lines[l], mmToPx(board.texts[t].parent.x, true)+5, mmToPx(board.texts[t].parent.y, true)+5+l*lineHeight);
				}
			}
		}
		ctx.restore();

		// mouse cursor
		ctx.save();
		if (view.lastMouseX !== null && view.lastMouseY !== null) {
			if (view.tool == 'text') {
				ctx.strokeStyle = '#ff0';
				ctx.beginPath();
				ctx.moveTo(view.lastMouseX+0.5, view.lastMouseY-4.5);
				ctx.lineTo(view.lastMouseX+0.5, view.lastMouseY+4.5);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(view.lastMouseX-3.5, view.lastMouseY+0.5);
				ctx.lineTo(view.lastMouseX+5.5, view.lastMouseY+0.5);
				ctx.stroke();
			} else if (view.tool == 'part' && view.part !== null) {
				ctx.translate(view.lastMouseX, view.lastMouseY);
				if (view.layer == 'bottom') {
					ctx.scale(-1, 1);
				}
				drawPart(ctx, view.part, 0, 0, view.toolData.rot);
			} else {
				ctx.strokeStyle = '#f00';
				ctx.beginPath();
				ctx.arc(view.lastMouseX, view.lastMouseY, mmToPx($.pcb.diameter()/2, true), 0, 2*Math.PI);
				ctx.stroke();
			}
		}
		ctx.restore();

		// ruler
		// TODO: have it always visible
		if (view.ruler == true) {
			ctx.save();
			ctx.strokeStyle = '#000';
			var cnt = 0;
			for (var x=0; x < cvs.width; x += (cvs.width-1)/board.width) {
				ctx.beginPath();
				// this is to make sure we draw at .5 for a 1px line
				ctx.moveTo(Math.round(x)+0.5, 0);
				if (cnt % 10 == 0) {
					ctx.lineTo(Math.round(x)+0.5, 10);
				} else {
					ctx.lineTo(Math.round(x)+0.5, 5);
				}
				// TODO: text
				cnt++;
				ctx.stroke();
			}
			cnt = 0;
			for (var y=0; y < cvs.width; y += (cvs.height-1)/board.height) {
				ctx.beginPath();
				ctx.moveTo(0, Math.round(y)+0.5);
				if (cnt % 10 == 0) {
					ctx.lineTo(10, Math.round(y)+0.5);
				} else {
					ctx.lineTo(5, Math.round(y)+0.5);
				}
				cnt++;
				ctx.stroke();
			}
			ctx.restore();
		}

		ctx.restore();
	};
	var removePartsDrills = function(drills) {
		// remove parts' drill holes
		for (var d in drills) {
			if (drills[d].parent !== null) {
				delete drills[d];
			}
		}
	};
	var requestPart = function(part) {
		if (view.parts[part] === undefined) {
			// not yet in the cache
			view.parts[part] = false;
			var img = new Image();
			img.onload = function() {
				view.parts[part] = img;
			}
			img.src = 'data:image/svg+xml;utf8,'+options.library[part].svg;
			return null;
		} else if (view.parts[part] === false) {
			// still loading
			return null;
		} else {
			return view.parts[part];
		}
	};
	var requestRedraw = function() {
		if (view.redrawPending === false) {
			var ret = requestAnimationFrame(redraw);
			// set flag (cleared in redraw())
			if (typeof ret == 'number') {
				view.redrawPending = ret;
			} else {
				view.redrawPending = true;
			}
			return true;
		} else {
			// already requested
			return false;
		}
	};
	var screenPxToCanvas = function(x, y) {
		if (isLayerMirrored()) {
			x = mmToPx(board.width, true)-x;
		}
		return { x: x, y: y };
	};
	var updateTooltip = function() {
		if (view.ruler && view.lastMouseX !== null && view.lastMouseY !== null) {
			$('#pcb-canvas').prop('title', pxToMm(view.lastMouseX, true).toFixed(1)+', '+pxToMm(view.lastMouseY, true).toFixed(1)+' mm');
		} else {
			$('#pcb-canvas').prop('title', '');
		}
	};

	// Event handlers
	$(document).ready(function(e) {
		$('html').on('contextmenu', '#pcb-canvas', function(e) {
			// prevent context menu from showing up
			return false;
		});
		$('html').on('keypress', function(e) {
			if (!$(e.target).is('body')) {
				return;
			}
			if (e.keyCode == 43 || e.keyCode == 61) {
				// + or =
				$.pcb.zoom($.pcb.zoom()*0.8);
			} else if (e.keyCode == 45) {
				// -
				$.pcb.zoom($.pcb.zoom()*1.2);
			} else if (e.keyCode == 48) {
				// 0
				$.pcb.zoom(defaultView.zoom);
			} else if (e.keyCode == 49) {
				// 1
				$.pcb.layer('top');
			} else if (e.keyCode == 50) {
				$.pcb.layer('substrate');
			} else if (e.keyCode == 51) {
				$.pcb.layer('bottom');
			} else if (e.keyCode == 91) {
				// [
				$.pcb.diameter($.pcb.diameter()-1);
			} else if (e.keyCode == 93) {
				// ]
				$.pcb.diameter($.pcb.diameter()+1);
			} else if (e.keyCode == 98) {
				// b
				$.pcb.tool('draw');
			} else if (e.keyCode == 100) {
				// d
				$.pcb.tool('drill');
			} else if (e.keyCode == 101) {
				// e
				$.pcb.tool('erase');
			} else if (e.keyCode == 112) {
				// p
				$.pcb.tool('part');
				// TODO: remove
				$.pcb.selectPart('atmega168-dip28');
			} else if (e.keyCode == 114) {
				// r
				$.pcb.ruler(!$.pcb.ruler());
			} else if (e.keyCode == 115) {
				// s
				if (!$.pcb.requestPending()) {
					var origBoard = $.pcb.board();
					$.pcb.save();
					// wait for request to finish
					var retry = function() {
						if (!$.pcb.requestPending()) {
							if (origBoard !== $.pcb.board()) {
								// redirect
								view.allowNavigation = true;
								window.location = $.pcb.baseUrl()+$.pcb.board();
							}
						} else {
							setTimeout(retry, 100);
						}
					};
					setTimeout(retry, 100);
				}
			} else if (e.keyCode == 116) {
				// t
				$.pcb.tool('text');
			} else {
				// DEBUG
				//console.log(e.keyCode);
			}
		});
		$('html').on('mousedown', '#pcb-canvas', function(e) {
			var p = screenPxToCanvas(e.offsetX, e.offsetY);
			if (view.tool == 'draw' || view.tool == 'erase' || view.tool == 'drill') {
				$.pcb.point(pxToMm(p.x, true), pxToMm(p.y, true));
				view.toolData.usingTool = true;
			} else if (view.tool == 'text') {
				var text = prompt("Enter text");
				if (text !== null) {
					$.pcb.text({
						x: pxToMm(p.x, true),
						y: pxToMm(p.y, true)
					}, text);
				}
			} else if (view.tool == 'part') {
				if (view.part !== null & e.which == 1) {
					// place a part
					$.pcb.part(view.part, pxToMm(p.x, true), pxToMm(p.y, true), view.toolData.rot);
				} else if (view.part !== null & e.which == 3) {
					// rotate part
					if (view.toolData.rot === undefined) {
						view.toolData.rot = 22.5;
					} else {
						view.toolData.rot += 22.5;
					}
					view.toolData.rot = normalizeAngle(view.toolData.rot);
					requestRedraw();
				}
			}
			return false;
		});
		$('html').on('mousemove', '#pcb-canvas', function(e) {
			var p = screenPxToCanvas(e.offsetX, e.offsetY);
			if (view.tool == 'draw' || view.tool == 'erase') {
				if (view.toolData.usingTool === true) {
					$.pcb.point(pxToMm(p.x, true), pxToMm(p.y, true));
				}
			}
			// track mouse
			view.lastMouseX = p.x;
			view.lastMouseY = p.y;
			updateTooltip();
			requestRedraw();
			return false;
		});
		$('html').on('mouseup', '#pcb-canvas', function(e) {
			if (view.toolData.usingTool === true) {
				view.toolData.usingTool = false;
			}
			return false;
		});
		$('html').on('mouseleave', '#pcb-canvas', function(e) {
			if (view.toolData.usingTool === true) {
				view.toolData.usingTool = false;
			}
			// track mouse
			view.lastMouseX = null;
			view.lastMouseY = null;
			requestRedraw();
			return false;
		});
		$('html').ajaxError(function(e, jqxhr, settings, exception) {
			// DEBUG
			console.warn('ajaxError: '+exception);
			// reference counting (also see ajaxRequest())
			view.ajaxPending--;
			// sanity check
			if (view.ajaxPending < 0) {
				view.ajaxPending = 0;
			}
		});
		$(window).on('beforeunload', function(e) {
			if (view.allowNavigation !== true) {
				// show a message before navigating away
				return 'You might have unsaved changes';
			}
		});

		// create main canvas
		var cvs = $('<canvas id="pcb-canvas"></canvas>');
		$('body').append(cvs);
		// normalize {request,cancel}AnimationFrame across browsers
		var requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.msRequestAnimationFrame;
		window.requestAnimationFrame = requestAnimationFrame;
		var cancelAnimationFrame = window.cancelAnimationFrame || window.webkitCancelAnimationFrame || window.mozCancelAnimationFrame || window.msCancelAnimationFrame;
		window.cancelAnimationFrame = cancelAnimationFrame;

		$.pcb.clear();
		$.pcb.library();
	});

	// Interface
	$.pcb = {
		addDrawing: function(part, svg, success) {
			if (typeof part != 'string') {
				return false;
			}
			if (typeof svg != 'object') {
				return false;
			}
			// read file
			var reader = new FileReader();
			reader.onload = function() {
				ajaxRequest({
					method: 'addDrawing',
					part: part,
					svg: reader.result,
					auth: options.auth,
				}, function(data) {
					if (data !== null) {
						if (typeof data.error == 'string') {
							console.warn(data.error);
						} else if (typeof success == 'function') {
							success(data);
						}
					}
				});
			};
			reader.readAsText(svg);
		},
		addPart: function(part, title, parent, overlay, success) {
			if (typeof part != 'string') {
				return false;
			}
			if (typeof title != 'string') {
				return false;
			}
			if (typeof parent != 'string' && parent !== null) {
				return false;
			}
			if (typeof overlay != 'object') {
				return false;
			}
			ajaxRequest({
				method: 'addPart',
				part: part,
				title: title,
				parent: parent,
				overlay: overlay,
				auth: options.auth
			}, function(data) {
				if (data !== null) {
					if (typeof data.error == 'string') {
						console.warn(data.error);
					} else if (typeof success == 'function') {
						success(data);
					}
				}
			});
		},
		addPartComment: function(part, comment, success) {
			if (typeof part != 'string') {
				return false;
			}
			if (typeof comment != 'string') {
				return false;
			}
			ajaxRequest({
				method: 'addPartComment',
				part: part,
				comment: comment,
				auth: options.auth
			}, function(data) {
				if (data !== null) {
					if (typeof data.error == 'string') {
						console.warn(data.error);
					} else if (typeof success == 'function') {
						success(data);
					}
				}
			});
		},
		addPartSupplier: function(part, supplier, partNumber, url, success) {
			if (typeof part != 'string') {
				return false;
			}
			if (typeof supplier != 'string') {
				return false;
			}
			if (typeof partNumber != 'string') {
				partNumber = null;
			}
			if (typeof url != 'string') {
				url = null;
			}
			ajaxRequest({
				method: 'addPartSupplier',
				part: part,
				supplier: supplier,
				partNumber: partNumber,
				url: url,
				auth: options.auth
			}, function(data) {
				if (data != null) {
					if (typeof data.error == 'string') {
						console.warn(data.error);
					} else if (typeof success == 'function') {
						success(data);
					}
				}
			});
		},
		author: function() {
			return board.author;
		},
		baseUrl: function(url) {
			if (url === undefined) {
				return options.baseUrl;
			} else {
				options.baseUrl = url;
			}
		},
		board: function() {
			return board.board;
		},
		clear: function(width, height) {
			// setup board & view
			board = $.extend(true, {}, defaultBoard);
			if (width !== undefined) {
				board.width = width;
			}
			if (height !== undefined) {
				board.height = height;
			}
			// create high DPI canvas elements
			for (var l in board.layers) {
				// TODO: replace by function (that fills substrate etc)
				var cvs = $('<canvas></canvas>');
				$(cvs).prop('width', mmToPx(board.width));
				$(cvs).prop('height', mmToPx(board.height));
				board.layers[l] = $(cvs).get(0);
				// substrate is filled by default
				if (l == 'substrate') {
					fillCanvas(board.layers[l], '#000');
				}
			}
			view = $.extend(true, {}, defaultView);
			invalidateView();
		},
		diameter: function(mm) {
			var diameterKey = 'diameter'+view.tool.charAt(0).toUpperCase()+view.tool.slice(1);
			if (mm === undefined) {
				if (view[diameterKey] === undefined) {
					return 0;
				} else {
					return view[diameterKey];
				}
			} else {
				if (mm <= 0) {
					return false;
				} else {
					view[diameterKey] = mm;
					requestRedraw();
					// TODO: event
					return true;
				}
			}
		},
		drill: function(x, y, diameter, parent) {
			if (typeof x != 'number' || typeof y != 'number') {
				return false;
			}
			if (diameter === undefined) {
				diameter = $.pcb.diameter();
			} else if (typeof diameter != 'number') {
				return false;
			}
			if (parent === undefined) {
				parent = null;
			}
			// get key for new object
			var key = getFirstAvailableKey(board.drills, 'drill');
			board.drills[key] = {
				x: x,
				y: y,
				diameter: diameter,
				parent: parent,
				via: false
			};
			requestRedraw();
			return key;
		},
		editText: function(name, string) {
			if (name === undefined) {
				return false;
			} else if (board.texts[name] === undefined) {
				return false;
			} else if (string === undefined) {
				return board.texts[name].text;
			} else {
				if (string == board.texts[name].text) {
					return;
				} else {
					board.texts[name].text = string;
					requestRedraw();
					return true;
				}
			}
		},
		export: function() {
			// save board first
			$.pcb.save();
			var retry = function() {
				if ($.pcb.requestPending()) {
					setTimeout(retry, 100);
					return;
				}
				if (board.board === null || board.rev === null) {
					return;
				}
				downloadRequest({
					method: 'export',
					board: board.board,
					rev: board.rev
				});
			};
			setTimeout(retry, 100);
		},
		layer: function(l) {
			if (l === undefined) {
				return view.layer;
			} else {
				if (board.layers[l] === undefined) {
					return false;
				} else {
					view.layer = l;
					invalidateView(false);
					// TODO: event
					return true;
				}
			}
		},
		library: function(forceReload) {
			if (forceReload === true) {
				options.library = null;
			}
			if (options.library === null) {
				options.library = false;
				ajaxRequest({
					method: 'getLibrary'
				}, function(data) {
					if (data !== null) {
						options.library = data;
					} else {
						options.library = null;
					}
				});
				return false;
			} else {
				return $.extend(true, {}, options.library);
			}
		},
		line: function(x1, y1, x2, y2) {
			var len = Math.sqrt(Math.pow(x2-x1, 2)+Math.pow(y2-y1, 2));
			var step = pxToMm(1);
			// TODO: evaluate performance later
			for (var i=0; i <= len; i += step) {
				$.pcb.point(x1+((x2-x1)/len)*i, y1+((y2-y1)/len)*i);
			}
			// TODO: add raw pixel access
		},
		load: function(brd, rev) {
			if (typeof brd != 'number') {
				return false;
			}
			if (typeof rev != 'number') {
				rev = null;
			}
			ajaxRequest({
				method: 'load',
				board: brd,
				rev: rev
			}, function(data) {
				if (data !== null) {
					// decode layers
					view.layersToLoad = 0;
					var hasLayers = false;
					for (var l in data.layers) {
						view.layersToLoad++;
						hasLayers = true;
						(function(l){
							imgToCanvas(data.layers[l].png, function(cvs) {
								data.layers[l] = cvs;
								view.layersToLoad--;
								if (view.layersToLoad == 0) {
									// done: setup board & view
									board = $.extend(true, defaultBoard, data);
									removePartsDrills(board.drills);
									view = $.extend(true, {}, defaultView);
									invalidateView();
									// EVENT
									$('html').trigger('pcb-loaded');
								}
							});
						}(l));
					}
					// fallback if we don't have any layers at all
					if (!hasLayers) {
						// done: setup board & view
						board = $.extend(true, defaultBoard, data);
						removePartsDrills(board.drills);
						view = $.extend(true, {}, defaultView);
						invalidateView();
						// EVENT
						$('html').trigger('pcb-loaded');
					}
				}
			});
			// EVENT
			$('html').trigger('pcb-loading');
		},
		objects: function(withPartDrills) {
			var ret = {};
			ret.drills = $.extend(true, {}, board.drills);
			ret.texts = $.extend(true, {}, board.texts);
			ret.parts = $.extend(true, {}, board.parts);
			if (withPartDrills === true) {
				addPartsDrills(ret.parts, ret.drills);
			}
			return ret;
		},
		parentBoard: function() {
			return { board: board.parentBoard, rev: board.parentRev };
		},
		part: function(part, x, y, rot, layer) {
			var l = $.pcb.library();
			if (l === false) {
				console.log('Library not available yet');
				return false;
			} else if (l[part] === undefined) {
				return false;
			}
			if (typeof x != 'number' || typeof y != 'number') {
				return false;
			}
			if (typeof layer != 'string') {
				layer = $.pcb.layer();
			}
			if (typeof rot != 'number') {
				rot = 0;
			}
			if (layer != 'top' && layer != 'bottom') {
				return false;
			}

			// get a unique name
			var i = 0;
			var name = part;
			if (48 <= name.charCodeAt(name.length-1) && name.charCodeAt(name.length-1) <= 57) {
				name += '-';
			}
			while (board.parts[name+i] !== undefined) {
				i++;
			}
			name += i;

			board.parts[name] = {
				part: part,
				x: x,
				y: y,
				rot: rot,
				layer: layer,
				rev: options.library[part].rev,
				width: options.library[part].width,
				height: options.library[part].height
			};
			return name;
		},
		point: function(x, y) {
			if (view.tool == 'draw' || view.tool == 'erase') {
				for (var i=0; i < 2; i++) {
					if (i == 0) {
						var cvs = board.layers[view.layer];
						var zoom = false;
					} else {
						var cvs = view.layers[view.layer];
						var zoom = true;
					}
					var ctx = cvs.getContext('2d');
					ctx.save();
					if (view.tool == 'draw') {
						if (view.layer == 'top') {
							// TODO: change color for high DPI
							ctx.fillStyle = '#f00';
						} else if (view.layer == 'substrate') {
							ctx.fillStyle = '#000';
						} else {
							ctx.fillStyle = '#00f';
						}
					} else {
						ctx.fillStyle = '#000';
						ctx.globalCompositeOperation = 'destination-out';
					}
					ctx.beginPath();
					ctx.arc(mmToPx(x, zoom), mmToPx(y, zoom), mmToPx($.pcb.diameter()/2, zoom), 0, 2*Math.PI);
					ctx.fill();
					ctx.restore();
				}
				requestRedraw();
			} else if (view.tool == 'drill') {
				$.pcb.drill(x, y, $.pcb.diameter());
			}
		},
		removeObject: function(name) {
			var scope = [ board.drills, board.texts, board.parts ];
			for (s in scope) {
				for (o in scope[s]) {
					if (name === o) {
						// TODO: event
						if (scope[s] == board.drills) {
							// TODO: also remove connected jumpers, texts
							delete board.drills[name];
						} else if (scope[s] == board.texts) {
							delete board.texts[name];
						} else if (scope[s] == board.parts) {
							// TODO: also remove connected jumpers, texts
							delete board.parts[name];
						}
						requestRedraw();
						return true;
					}
				}
			}
			return false;
		},
		requestPending: function() {
			return (0 < view.ajaxPending);
		},
		rev: function() {
			return board.rev;
		},
		ruler: function(enable) {
			if (enable === undefined) {
				return view.ruler;
			} else {
				if (enable) {
					enable = true;
				} else {
					enable = false;
				}
				if (enable == view.ruler) {
					return;
				} else {
					view.ruler = enable;
					requestRedraw();
				}
			}
		},
		save: function(asNew) {
			board.parentBoard = board.board;
			board.parentRev = board.rev;
			board.rev = null;
			if (asNew) {
				board.board = null;
			}
			// make a copy of board in order to base64-encode the contained layers
			var boardCopy = $.extend(true, {}, board);
			for (var l in boardCopy.layers) {
				var png = boardCopy.layers[l].toDataURL('image/png');
				boardCopy.layers[l] = {
					width: boardCopy.layers[l].width,
					height: boardCopy.layers[l].height,
					png: png
				};
			}
			addPartsDrills(boardCopy.parts, boardCopy.drills);
			ajaxRequest({
				method: 'save',
				board: boardCopy,
				auth: options.auth
			}, function(data) {
				if (data !== null) {
					board.board = data.board;
					board.rev = data.rev;
					// EVENT
					$('html').trigger('pcb-saved');
					// TODO: have redirect in UI code
				}
			});
			// EVENT
			$('html').trigger('pcb-saving');
		},
		selectPart: function(part) {
			var l = $.pcb.library();
			if (l === false) {
				console.log('Library not available yet');
				return false;
			} else if (l[part] === undefined) {
				return false;
			} else if (part !== view.part) {
				view.part = part;
				view.toolData.rot = 0;
				requestRedraw();
			}
		},
		testParts: function() {
			// TODO: remove
			var elem = $('<input type="file">');
			$(elem).on('change', function(e) {
				$.pcb.addDrawing('dip28', this.files[0], function(data) {
					console.log('added drawing');
					console.log(data);
					$.pcb.addPart('dip28', 'DIP28', null, { description: 'Generic DIP 28 IC' }, function(data) {
						console.log('added dip28');
						console.log(data);
					});
					$.pcb.addPart('atmega168-dip28', 'Atmega 168 (DIP28)', 'dip28', { description: 'Microcontroller', drills: { 'pin1': { description: 'PC6' } } }, function(data) {
						console.log('added atmega168-dip28');
						console.log(data);
					});
					$.pcb.addPartComment('atmega168-dip28', 'Nice chip', function(data) {
						console.log('added comment');
						console.log(data);
					});
					$.pcb.addPartSupplier('atmega168-dip28', 'DigiKey', '123', '456', function(data) {
						console.log('added supplier');
						console.log(data);
					});
				});
				$(this).remove();
			});
			$('body').append(elem);
		},
		text: function(parent, string) {
			if (typeof parent == 'object' && typeof parent.x == 'number' && typeof parent.y == 'number') {
				if (parent.layer === undefined) {
					parent.layer = view.layer;
				}
				// get key for new object
				var key = getFirstAvailableKey(board.texts, 'text');
				board.texts[key] = {
					parent: {
						x: parent.x,
						y: parent.y,
						layer: parent.layer
					},
					text: string
				};
				requestRedraw();
				return key;
			}
			// TODO: other parents
			return false;
		},
		tool: function(t) {
			if (t === undefined) {
				return view.tool;
			} else {
				if (t == view.tool) {
					return;
				} else {
					view.tool = t;
					view.toolData = {};
					requestRedraw();
				}
			}
		},
		via: function(drill, isVia) {
			if (board.drills[drill] === undefined) {
				return false;
			} else if (isVia === undefined) {
				return board.drills[drill].via;
			} else {
				if (isVia) {
					isVia = true;
				} else {
					isVia = false;
				}
				if (isVia == board.drills[drill].via) {
					return;
				} else {
					board.drills[drill].via = isVia;
					requestRedraw();
					return true;
				}
			}
		},
		zoom: function(fac) {
			if (fac === undefined) {
				return view.zoom;
			} else {
				if (fac <= 0) {
					return false;
				} else if (fac === view.zoom) {
					return;
				} else {
					view.zoom = fac;
					invalidateView();
					return true;
				}
			}
		}
	};
})(jQuery, window, document);