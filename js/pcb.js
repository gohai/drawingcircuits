// pcb.js
// Copyright Gottfried Haider 2013.
// This source code is licensed under the GNU General Public License. See the file COPYING for more details.

(function($, window, document, undefined) {
	var options = {
		auth: {
			secret: null,
			uid: null,
			user: null
		},
		baseUrl: null,
		donMode: false,
		highDpi: 300,
		library: null,
		zoomCutoffPins: 1,
		zoomCutoffSiblingText: 2,
		zoomCutoffText: 3
	};

	var defaultBoard = {
		author: null,
		board: null,
		drills: {},
		height: 152.4,
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
		width: 101.6
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
		part: null,
		parts: {},
		pattern: null,
		redrawPending: false,
		ruler: false,
		tool: 'draw',
		toolData: {},
		zoom: 2
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
		for (var key in data) {
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
	var arrayKeys = function(a) {
		var ret = [];
		for (var k in a) {
			ret.push(k);
		}
		return ret;
	};
	var arrayUnique = function(a) {
		var o = {};
		for (var i=0; i < a.length; i++) {
			o[a[i]] = 1;
		}
		a = [];
		for (var l in o) {
			a.push(l);
		}
		return a;
	};
	var canvasIsEmpty = function(cvs, bgARGB) {
		if (bgARGB === undefined) {
			bgARGB = 0;
		}
		var ctx = cvs.getContext('2d');
		var data = ctx.getImageData(0, 0, cvs.width, cvs.height);
		for (var i=0; i < cvs.width*cvs.height*4; i+=4) {
			// ARGB
			var col = (data.data[i+3]<<24)|(data.data[i]<<16)|(data.data[i+1]<<8)|data.data[i+2];
			if (col != bgARGB) {
				return false;
			}
		}
		return true;
	};
	var centerCanvas = function() {
		var canvasWidth = $('#pcb-canvas').width();
		var windowWidth = $(window).width();
		if (canvasWidth < windowWidth) {
			$('#pcb-canvas').css('left', (windowWidth-canvasWidth)/2+'px');
		} else {
			$('#pcb-canvas').css('left', '0px');
		}
		var canvasHeight = $('#pcb-canvas').height();
		var windowHeight = $(window).height();
		if (canvasHeight < windowHeight) {
			$('#pcb-canvas').css('top', (windowHeight-canvasHeight)/2+'px');
		} else {
			$('#pcb-canvas').css('top', '0px');
		}
	};
	var createCanvas = function(width, height) {
		var cvs = $('<canvas></canvas>');
		$(cvs).prop('width', mmToPx(width));
		$(cvs).prop('height', mmToPx(height));
		return $(cvs).get(0);
	};
	var downloadRequest = function(data) {
		var arg = '';
		// encode request data
		for (var key in data) {
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
		// TODO (later): Resource interpreted as Document but transferred with MIME type application/octet-stream
		$(iframe).prop('src', options.baseUrl+'ajax.php'+arg);
		// TODO (later): set and check for cookie (see jquery.fileDownload.js)
		$('body').append(iframe);
	};
	// draw functions need to be static (use opt instead of the global view)
	var drawDrill = function(ctx, obj, opt) {
		ctx.save();
		ctx.translate(mmToPx(obj.x, opt.zoom), mmToPx(obj.y, opt.zoom));
		drawDrillGfx(ctx, obj.diameter, opt);
		if (obj.via === true) {
			drawViaGfx(ctx, obj.diameter, opt);
		}
		ctx.restore();
	};
	var drawDrillGfx = function(ctx, diameter, opt) {
		ctx.save();
		ctx.fillStyle = '#fff';
		ctx.beginPath();
		ctx.arc(0, 0, mmToPx(diameter/2, opt.zoom), 0, 2*Math.PI);
		ctx.fill();
		ctx.restore();
	};
	var drawJumper = function(ctx, coords, opt) {
		ctx.save();
		ctx.lineCap = 'round';
		ctx.lineWidth = mmToPx(0.75, opt.zoom);
		ctx.strokeStyle = '#ff0';
		ctx.beginPath()
		ctx.moveTo(mmToPx(coords.from.x, opt.zoom), mmToPx(coords.from.y, opt.zoom));
		ctx.lineTo(mmToPx(coords.to.x, opt.zoom), mmToPx(coords.to.y, opt.zoom));
		ctx.stroke();
		ctx.restore();
	};
	var drawMouseCursor = function(ctx, x, y) {
		// drawMouseCursor can access view directly
		ctx.save();
		ctx.translate(x, y);
		if (view.tool == 'part' && view.part !== null) {
			// parts on the bottom layer are being drawn inverted (so that pin 1 is 
			// still at the bottom left corner by default)
			if (view.layer == 'bottom') {
				ctx.scale(-1, 1);
			}
			if (view.toolData.rot === undefined) {
				view.toolData.rot = 0;
			}
			drawPartOutlineGfx(ctx, view.part, view.toolData.rot, view);
			drawPartDrillsGfx(ctx, view.part, view.toolData.rot, view);
		} else if (view.tool == 'pattern' && view.pattern !== null) {
			var w = mmToPx(view.pattern.width, true);
			var h = mmToPx(view.pattern.height, true);
			var cvs = $('<canvas></canvas>');
			$(cvs).prop('width', w);
			$(cvs).prop('height', h);
			cvs = $(cvs).get(0);
			renderBoard(cvs, view.pattern, view);
			if (view.layer == 'bottom') {
				ctx.scale(-1, 1);
			}
			if (view.toolData.rot === undefined) {
				view.toolData.rot = 0;
			}
			if (view.layer == 'bottom') {
				ctx.rotate(-view.toolData.rot*Math.PI/180);
			} else {
				ctx.rotate(view.toolData.rot*Math.PI/180);
			}
			// TODO (later): cache board
			ctx.drawImage(cvs, -cvs.width/2, -cvs.height/2);
		} else if (view.tool == 'text') {
			ctx.strokeStyle = '#f00';
			ctx.beginPath();
			ctx.moveTo(-5, 0);
			ctx.lineTo(5, 0);
			ctx.moveTo(0, -5);
			ctx.lineTo(0, 5);
			ctx.stroke();
		} else {
			// default
			ctx.strokeStyle = '#f00';
			ctx.beginPath();
			ctx.arc(0, 0, mmToPx($.pcb.diameter()/2, true), 0, 2*Math.PI);
			ctx.stroke();
		}
		ctx.restore();
	};
	var drawPartDrills = function(ctx, obj, opt) {
		ctx.save();
		// parts on the bottom layer are being drawn inverted (so that pin 1 is 
		// still at the bottom left corner by default)
		ctx.translate(mmToPx(obj.x, opt.zoom), mmToPx(obj.y, opt.zoom));
		if (obj.layer == 'bottom') {
			ctx.scale(-1, 1);
		}
		drawPartDrillsGfx(ctx, obj.part, obj.rot, opt);
		ctx.restore();
	};
	var drawPartDrillsGfx = function(ctx, part, rot, opt) {
		var part = options.library[part];
		ctx.save();
		ctx.rotate(rot*Math.PI/180);
		for (var d in part.drills) {
			var drill = part.drills[d];
			var x = mmToPx(drill.x, opt.zoom);
			var y = mmToPx(drill.y, opt.zoom);
			ctx.translate(x, y);
			drawDrillGfx(ctx, drill.diameter, opt);
			if (opt.zoom <= options.zoomCutoffPins && d.substr(0, 5) != 'drill') {
				ctx.rotate(-rot*Math.PI/180);
				// TODO: bug
				if (opt.layer == 'bottom') {
					ctx.scale(-1, 1);
				}
				if (drill.description !== undefined) {
					drawTextGfx(ctx, drill.description);
				} else {
					drawTextGfx(ctx, d);
				}
				if (opt.layer == 'bottom') {
					ctx.scale(-1, 1);
				}
				ctx.rotate(rot*Math.PI/180);
			}
			ctx.translate(-x, -y);
		}
		ctx.restore();
	};
	var drawPartOutline = function(ctx, obj, opt) {
		ctx.save();
		ctx.translate(mmToPx(obj.x, opt.zoom), mmToPx(obj.y, opt.zoom));
		// parts on the bottom layer are being drawn inverted (so that pin 1 is 
		// still at the bottom left corner by default)
		if (obj.layer == 'bottom') {
			ctx.scale(-1, 1);
		}
		drawPartOutlineGfx(ctx, obj.part, obj.rot, opt);
		ctx.restore();
	};
	var drawPartOutlineGfx = function(ctx, part, rot, opt) {
		ctx.save();
		ctx.rotate(rot*Math.PI/180);
		var img = requestPart(part);
		if (img !== null) {
			var w = mmToPx(options.library[part].width, opt.zoom);
			var h = mmToPx(options.library[part].height, opt.zoom);
			ctx.drawImage(img, (-w/2)+1, (-h/2)+1, w, h);
		}
		ctx.restore();
	};
	var drawText = function(ctx, x, y, text, opt) {
		ctx.save();
		ctx.translate(mmToPx(x, opt.zoom), mmToPx(y, opt.zoom));
		if (opt.layer == 'bottom') {
			ctx.scale(-1, 1);
		}
		drawTextGfx(ctx, text);
		ctx.restore();
	};
	var drawTextGfx = function(ctx, text) {
		ctx.save();
		ctx.fillStyle = '#000';
		ctx.font = '11px '+$('body').css('font-family');
		ctx.textBaseline = 'middle';
		ctx.fillText(text, -ctx.measureText(text).width/2, 0);
		ctx.restore();
	};
	var drawViaGfx = function(ctx, diameter, opt) {
		ctx.save();
		ctx.fillStyle = '#ff0';
		ctx.beginPath();
		ctx.arc(0, 0, mmToPx(diameter/3, opt.zoom), 0, 2*Math.PI);
		ctx.fill();
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
			// TODO (later): use rotatePoint()
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
	var findObject = function(name, brd, types) {
		if (typeof brd != 'object') {
			brd = board;
		}
		if (typeof types != 'array') {
			types = [ 'drills', 'jumpers', 'parts', 'texts' ];
		}
		for (var t in types) {
			if (brd[types[t]][name] !== undefined) {
				return { type: types[t], obj: brd[types[t]][name] };
			}
		}
		return false;
	};
	var findObjectRefs = function(name, brd, types) {
		if (typeof brd != 'object') {
			brd = board;
		}
		if (typeof types != 'array') {
			types = [ 'drills', 'jumpers', 'parts', 'texts' ];
		}
		var ret = [];
		for (var t in types) {
			var type = types[t];
			for (var o in brd[type]) {
				var obj = brd[type][o];
				if (type == 'jumpers' && (obj.from === name || obj.to === name)) {
					ret.push({ type: type, name: o, obj: obj });
				} else if (type == 'texts' && obj.parent === name) {
					ret.push({ type: type, name: o, obj: obj });
				}
			}
		}
		return ret;
	};
	var fitZoomToViewport = function() {
		$('meta[name=viewport]').attr('content', 'initial-scale='+(1/window.devicePixelRatio)+', maximum-scale='+(1/window.devicePixelRatio)+', minimum-scale='+(1/window.devicePixelRatio)+', user-scalable=no, width=device-width');
		var zoomWidth = mmToPx(board.width)/$(window).width();
		var zoomHeight = mmToPx(board.height)/$(window).height();
		$.pcb.zoom(Math.max(zoomWidth, zoomHeight));
	};
	var getFirstAvailableKey = function(object, prefix, start) {
		// add a dash if the prefix ends with a digit
		if (48 <= prefix.charCodeAt(prefix.length-1) && prefix.charCodeAt(prefix.length-1) <= 57) {
			prefix += '-';
		}
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
	var getJumperCoords = function(jumper, brd) {
		var ret = {};
		ret.layers = [];
		if (typeof jumper.from == 'object') {
			ret.from = { x: jumper.from.x, y: jumper.from.y, layer: jumper.from.layer };
			ret.layers.push(jumper.from.layer);
		} else {
			var obj = findObject(jumper.from, brd);
			ret.from = { x: obj.obj.x, y: obj.obj.y };
			ret.layers.push('top');
			ret.layers.push('bottom');
		}
		if (typeof jumper.to == 'object') {
			ret.to = { x: jumper.to.x, y: jumper.to.y, layer: jumper.to.layer };
			ret.layers.push(jumper.to.layer);
		} else {
			var obj = findObject(jumper.to, brd);
			ret.to = { x: obj.obj.x, y: obj.obj.y };
			ret.layers.push('top');
			ret.layers.push('bottom');
		}
		ret.layers = arrayUnique(ret.layers);
		return ret;
	};
	var getPrefixFromKey = function(key) {
		for (var i=key.length-1; 0 <= i; i--) {
			if (key.charCodeAt(i) < 48 || 57 < key.charCodeAt(i)) {
				var ret = key.substr(0, i+1);
				// remove tailing dash
				if (ret.substr(-1) == '-') {
					return ret.substr(0, ret.length-1);
				} else {
					return ret;
				}
			}
		}
		return '';
	};
	var getWacomPlugin = function() {
		var plugin = document.getElementById('pcb-wacom-plugin');
		if (plugin === null || typeof plugin.version != 'string') {
			return null;
		} else {
			return plugin;
		}
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
		} else {
			// none (only call redraw())
		}

		// try to cancel outstanding requests
		if (typeof view.redrawPending == 'number') {
			cancelAnimationFrame(view.redrawPending);
			view.redrawPending = false;
		}
		redraw();
	};
	var isTouchDevice = function() {
		// taken from Modernizr
		return !!('ontouchstart' in window) || !!('onmsgesturechange' in window);
	};
	var loadBoard = function(brd, rev, success) {
		ajaxRequest({
			method: 'load',
			board: brd,
			rev: rev
		}, function(data) {
			if (data === null) {
				return;
			}
			// decode layers
			var layersToLoad = 0;
			for (var l in data.layers) {
				layersToLoad++;
				(function(l){
					imgToCanvas(data.layers[l].png, function(cvs) {
						data.layers[l] = cvs;
						layersToLoad--;
						if (layersToLoad == 0 && typeof success == 'function') {
								// merge board with default
								data = $.extend(true, {}, defaultBoard, data);
								removePartsDrills(data.drills);
								success(data);
						}
					});
				}(l));
			}
			// fallback if we don't have any layers at all
			if (layersToLoad == 0 && typeof success == 'function') {
					// merge board with default
					data = $.extend(true, {}, defaultBoard, data);
					removePartsDrills(data.drills);
					success(data);
			}
		});
	};
	var mergeBoards = function(dest, src, srcX, srcY, srcRot) {
		// layers
		for (var l in src.layers) {
			if (dest.layers[l] === undefined) {
				continue;
			}
			var ctx = dest.layers[l].getContext('2d');
			ctx.save();
			ctx.translate(mmToPx(srcX), mmToPx(srcY));
			ctx.rotate(srcRot*Math.PI/180);
			// mask everything except the source
			ctx.beginPath();
			// the offset prevents a tiny border around the pattern
			ctx.rect(Math.ceil(-src.layers[l].width/2), Math.ceil(-src.layers[l].height/2), src.layers[l].width-1, src.layers[l].height-1);
			ctx.closePath();
			ctx.clip();
			// copy image
			ctx.globalCompositeOperation = 'copy';
			ctx.drawImage(src.layers[l], -src.layers[l].width/2, -src.layers[l].height/2);
			ctx.restore();
		}

		// objects
		// operate on a local copy of src
		var src = $.extend(true, {}, src);
		var offsetX = srcX-src.width/2;
		var offsetY = srcY-src.height/2;
		var scopes = [ 'drills', 'jumpers', 'parts', 'texts' ];
		for (var s in scopes) {
			var scope = scopes[s];
			var objs = arrayKeys(src[scope]);
			for (var o in objs) {
				var o = objs[o];
				// move object
				// TODO (later): consolidate with .moveObject
				var obj = src[scope][o];
				if (scope == 'drills') {
					var p = rotatePoint(obj.x, obj.y, srcRot, src.width/2, src.height/2);
					obj.x = offsetX+p.x;
					obj.y = offsetY+p.y;
				} else if (scope == 'jumpers') {
					if (typeof obj.from == 'object') {
						var p = rotatePoint(obj.from.x, obj.from.y, srcRot, src.width/2, src.height/2);
						obj.from.x = offsetX+p.x;
						obj.from.y = offsetY+p.y;
					}
					if (typeof obj.to == 'object') {
						var p = rotatePoint(obj.to.x, obj.to.y, srcRot, src.width/2, src.height/2);
						obj.to.x = offsetX+p.x;
						obj.to.y = offsetY+p.y;
					}
				} else if (scope == 'parts') {
					var p = rotatePoint(obj.x, obj.y, srcRot, src.width/2, src.height/2);
					obj.x = offsetX+p.x;
					obj.y = offsetY+p.y;
					obj.rot = normalizeAngle(obj.rot+srcRot);
				} else if (scope == 'texts') {
					if (typeof obj.parent == 'object') {
						var p = rotatePoint(obj.parent.x, obj.parent.y, srcRot, src.width/2, src.height/2);
						obj.parent.x = offsetX+p.x;
						obj.parent.y = offsetY+p.y;
					}
				}
				// rename objects
				if (dest[scope][o] !== undefined) {
					var oldName = o;
					var newName = getFirstAvailableKey(dest[scope], getPrefixFromKey(oldName));
					// find references to the old name
					var refs = findObjectRefs(oldName, src);
					for (var r in refs) {
						var ref = refs[r];
						if (ref.type == 'jumpers') {
							if (ref.obj.from === oldName) {
								ref.obj.from = newName;
							}
							if (ref.obj.to == oldName) {
								ref.obj.to = newName;
							}
						} else if (ref.type == 'texts') {
							ref.obj.parent = newName;
						}
					}
					// add to dest
					dest[scope][newName] = src[scope][oldName];
				} else {
					dest[scope][o] = src[scope][o];
				}
			}
		}
		// TODO (later): merge BOMs
	};
	var mirrorContext = function(ctx) {
		ctx.translate(ctx.canvas.width/2, 0);
		ctx.scale(-1, 1);
		ctx.translate(-ctx.canvas.width/2, 0);
	};
	var mmToPx = function(mm, handleZoom) {
		if (handleZoom === false || handleZoom === undefined) {
			// high DPI
			return Math.floor(mm*options.highDpi/25.4);
		} else if (typeof handleZoom == 'number') {
			// variable DPI with custom zoom factor
			return Math.floor(mm*options.highDpi/25.4/handleZoom);
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
		// setup canvas
		$('#pcb-canvas').prop('width', mmToPx(board.width, true));
		$('#pcb-canvas').prop('height', mmToPx(board.height, true));
		var cvs = $('#pcb-canvas').get(0);

		// render board
		renderBoard(cvs, board, view);

		// render additional elements
		var ctx = cvs.getContext('2d');
		ctx.save();
		if (view.layer == 'bottom') {
			mirrorContext(ctx);
		}
		// mouse cursor
		if (view.lastMouseX !== null && view.lastMouseY !== null) {
			drawMouseCursor(ctx, view.lastMouseX, view.lastMouseY);
		}
		// ruler
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
	var removeObject = function(name, brd) {
		if (typeof brd != 'object') {
			brd = board;
		}
		// delete the object itself
		var obj = findObject(name, brd);
		if (obj === false) {
			return false;
		} else {
			// TODO (later): event
			delete brd[obj.type][name];
		}
		// find and delete objects that had a reference
		var refs = findObjectRefs(name, brd);
		for (var r in refs) {
			removeObject(refs[r].name, brd);
		}
		return true;
	};
	var removePartsDrills = function(drills) {
		// remove parts' drill holes
		for (var d in drills) {
			if (typeof drills[d].parent == 'string') {
				delete drills[d];
			}
		}
	};
	var renderBoard = function(cvs, brd, opt) {
		var ctx = cvs.getContext('2d');

		ctx.save();
		if (opt.layer == 'bottom') {
			mirrorContext(ctx);
		}

		// jumpers on the inactive layer
		for (var j in brd.jumpers) {
			var jumper = brd.jumpers[j];
			var coords = getJumperCoords(jumper, brd);
			if ($.inArray(opt.layer, coords.layers) == -1) {
				drawJumper(ctx, coords, opt);
			}
		}

		// parts on the inactive layer
		for (var p in brd.parts) {
			var part = brd.parts[p];
			if (part.layer == opt.layer) {
				continue;
			} else {
				// TODO (later): change color
				drawPartOutline(ctx, part, opt);
			}
		}

		// layers
		ctx.save();
		ctx.globalAlpha = 0.5;
		if (opt.layer == 'bottom') {
			var order = ['top', 'substrate', 'bottom'];
		} else if (opt.layer == 'substrate') {
			var order = ['bottom', 'top', 'substrate'];
		} else {
			var order = ['bottom', 'substrate', 'top'];
		}
		for (var l in order) {
			ctx.drawImage(requestViewLayer(brd, order[l], opt), 0, 0);
		}
		ctx.restore();

		// parts on the active layer
		for (var p in brd.parts) {
			var part = brd.parts[p];
			if (part.layer != opt.layer) {
				continue;
			} else {
				drawPartOutline(ctx, part, opt);
			}
		}

		// drill holes
		for (var d in brd.drills) {
			drawDrill(ctx, brd.drills[d], opt);
		}
		for (var p in brd.parts) {
			drawPartDrills(ctx, brd.parts[p], opt);
		}

		// text
		for (var t in brd.texts) {
			var text = brd.texts[t];
			if (typeof text.parent == 'object') {
				if (text.parent.layer != opt.layer) {
					continue;
				} else if (options.zoomCutoffText < opt.zoom) {
					continue;
				}
				var x = text.parent.x;
				var y = text.parent.y;
			} else {
				if (options.zoomCutoffSiblingText < opt.zoom) {
					continue;
				}
				var parent = findObject(text.parent, brd);
				if (parent.type == 'drills') {
					if (opt.layer == 'substrate') {
						continue;
					}
					var x = parent.obj.x;
					var y = parent.obj.y;
				} else if (parent.type == 'jumpers') {
					var coords = getJumperCoords(parent.obj, brd);
					if ($.inArray(opt.layer, coords.layers) == -1) {
						continue;
					} else {
						var x = (coords.from.x+coords.to.x)/2;
						var y = (coords.from.y+coords.to.y)/2;
						// TODO (later): maybe rotate and offset
					}
				} else if (parent.type == 'parts') {
					if (opt.layer != parent.obj.layer) {
						continue;
					}
					var x = parent.obj.x;
					var y = parent.obj.y;
				}
			}
			drawText(ctx, x, y, text.text, opt);
		}

		// jumpers on the active layer
		for (var j in brd.jumpers) {
			var jumper = brd.jumpers[j];
			var coords = getJumperCoords(jumper, brd);
			if ($.inArray(opt.layer, coords.layers) != -1) {
				drawJumper(ctx, coords, opt);
			}
		}

		ctx.restore();
	};
	var requestPart = function(part) {
		if (view.parts[part] === undefined) {
			// not yet in the cache
			view.parts[part] = false;
			var img = new Image();
			img.onload = function() {
				// TODO (later): evaluate performance later (we could convert it to a canvas element here as well)
				view.parts[part] = img;
			}
			// encodeURIComponent() fixes Mozilla (would error out on #)
			img.src = 'data:image/svg+xml;utf8,'+encodeURIComponent(options.library[part].svg);
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
	var requestViewLayer = function(brd, l, opt) {
		if (brd == board) {
			var prefix = '';
		} else {
			var prefix = 'board'+brd.board+'-';
		}

		// create them if needed
		if (view.layers[prefix+l] === undefined) {
			var cvs = $('<canvas></canvas>');
			$(cvs).prop('width', mmToPx(brd.width, opt.zoom));
			$(cvs).prop('height', mmToPx(brd.height, opt.zoom));
			view.layers[prefix+l] = $(cvs).get(0);
			// copy
			var ctx = view.layers[prefix+l].getContext('2d');
			ctx.save();
			ctx.drawImage(brd.layers[l], 0, 0, brd.layers[l].width, brd.layers[l].height, 0, 0, view.layers[prefix+l].width, view.layers[prefix+l].height);
			ctx.globalCompositeOperation = 'source-in';
			if (l == 'top') {
				ctx.fillStyle = '#f00';
			} else if (l == 'substrate') {
				// not really necessary
				ctx.fillStlye = '#000';
			} else if (l == 'bottom') {
				ctx.fillStyle = '#00f';
			}
			ctx.rect(0, 0, view.layers[prefix+l].width, view.layers[prefix+l].height);
			ctx.fill();
			ctx.restore();
		}

		return view.layers[prefix+l];
	};
	var rotatePoint = function(pointX, pointY, deg, pivotX, pivotY) {
		if (deg == 0) {
			return {x: pointX, y: pointY};
		} else {
			var rad = deg * Math.PI / 180.0;
			if (pivotX === undefined) {
				pivotX = 0;
			}
			if (pivotY === undefined) {
				pivotY = 0;
			}
			return {
				x: Math.cos(rad)*(pointX-pivotX)-Math.sin(rad)*(pointY-pivotY)+pivotX,
				y: Math.sin(rad)*(pointX-pivotX)+Math.cos(rad)*(pointY-pivotY)+pivotY
			};
		}
	};
	var screenPxToCanvas = function(x, y) {
		if (view.layer == 'bottom') {
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
			if (e.charCode == 43 || e.charCode == 61) {
				// + or =
				$.pcb.zoom($.pcb.zoom()*0.8);
			} else if (e.charCode == 45) {
				// -
				$.pcb.zoom($.pcb.zoom()*1.2);
			} else if (e.charCode == 48) {
				// 0
				$.pcb.zoom(defaultView.zoom);
			} else if (e.charCode == 49) {
				// 1
				$.pcb.layer('top');
			} else if (e.charCode == 50) {
				$.pcb.layer('substrate');
			} else if (e.charCode == 51) {
				$.pcb.layer('bottom');
			} else if (e.charCode == 80) {
				// P
				$.pcb.tool('pattern');
			} else if (e.charCode == 91) {
				// [
				$.pcb.diameter($.pcb.diameter()-1);
			} else if (e.charCode == 93) {
				// ]
				$.pcb.diameter($.pcb.diameter()+1);
			} else if (e.charCode == 98) {
				// b
				$.pcb.tool('draw');
			} else if (e.charCode == 100) {
				// d
				$.pcb.tool('drill');
			} else if (e.charCode == 101) {
				// e
				$.pcb.tool('erase');
			} else if (e.charCode == 112) {
				// p
				$.pcb.tool('part');
			} else if (e.charCode == 114) {
				// r
				$.pcb.ruler(!$.pcb.ruler());
			} else if (e.charCode == 115) {
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
			} else if (e.charCode == 116) {
				// t
				$.pcb.tool('text');
			} else {
				// DEBUG
				//console.log(e.charCode);
			}
		});
		$('html').on('mousedown', '#pcb-canvas', function(e) {
			if (typeof e.offsetX != 'number') {
				var o = $(this).offset();
				e.offsetX = e.pageX-o.left;
				e.offsetY = e.pageY-o.top;
			}
			var p = screenPxToCanvas(e.offsetX, e.offsetY);
			var wacom = getWacomPlugin();
			if (wacom !== null) {
				if (view.tool == 'draw' && wacom.penAPI.pointerType == 3) {
					$.pcb.tool('erase');
				} else if (view.tool == 'erase' && wacom.penAPI.pointerType == 1) {
					$.pcb.tool('draw');
				}
			}
			if (view.tool == 'draw' || view.tool == 'drill' || view.tool == 'erase') {
				$.pcb.point(pxToMm(p.x, true), pxToMm(p.y, true));
				view.toolData.usingTool = true;
			} else if (view.tool == 'part' || view.tool == 'pattern') {
				if (e.which == 1) {
					// place a part or pattern
					if (view.toolData.rot === undefined) {
						view.toolData.rot = 0;
					}
					if (view.tool == 'part' && view.part !== null) {
						$.pcb.part(view.part, pxToMm(p.x, true), pxToMm(p.y, true), view.toolData.rot);
					} else if (view.tool == 'pattern' && view.pattern !== null) {
						$.pcb.pattern(pxToMm(p.x, true), pxToMm(p.y, true), view.toolData.rot);
					}
				} else if (e.which == 3) {
					// rotate a part or pattern
					if (view.toolData.rot === undefined) {
						view.toolData.rot = 22.5;
					} else {
						view.toolData.rot += 22.5;
					}
					view.toolData.rot = normalizeAngle(view.toolData.rot);
					requestRedraw();
				}
			} else if (view.tool == 'text') {
				var text = prompt("Enter text");
				if (text !== null) {
					$.pcb.text({
						x: pxToMm(p.x, true),
						y: pxToMm(p.y, true)
					}, text);
				}
			}
			return false;
		});
		$('html').on('mousemove', '#pcb-canvas', function(e) {
			if (typeof e.offsetX != 'number') {
				var o = $(this).offset();
				e.offsetX = e.pageX-o.left;
				e.offsetY = e.pageY-o.top;
			}
			var p = screenPxToCanvas(e.offsetX, e.offsetY);
			var wacom = getWacomPlugin();
			if (wacom !== null) {
				if (view.tool == 'draw' && wacom.penAPI.pointerType == 3) {
					$.pcb.tool('erase');
				} else if (view.tool == 'erase' && wacom.penAPI.pointerType == 1) {
					$.pcb.tool('draw');
				}
			}
			if (view.tool == 'draw' || view.tool == 'erase') {
				if (view.toolData.usingTool === true) {
					$.pcb.line(pxToMm(view.lastMouseX, true), pxToMm(view.lastMouseY, true), pxToMm(p.x, true), pxToMm(p.y, true));
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
		// TODO (later): this certainly needs more testing and love
		$('html').on('touchstart', '#pcb-canvas', function(e) {
			for (var t in e.originalEvent.targetTouches) {
				var touch = e.originalEvent.targetTouches[t];
				if (typeof touch != 'object' || typeof touch.pageX != 'number') {
					continue;
				}
				$.pcb.point(pxToMm(touch.pageX, true), pxToMm(touch.pageY, true));
			}
			return false;
		});
		$('html').on('touchmove', '#pcb-canvas', function(e) {
			for (var t in e.originalEvent.targetTouches) {
				var touch = e.originalEvent.targetTouches[t];
				if (typeof touch != 'object' || typeof touch.pageX != 'number') {
					continue;
				}
				$.pcb.point(pxToMm(touch.pageX, true), pxToMm(touch.pageY, true));
			}
			return false;
		});
		$('html').on('touchstop', '#pcb-canvas', function(e) {
			for (var t in e.originalEvent.targetTouches) {
				var touch = e.originalEvent.targetTouches[t];
				if (typeof touch != 'object' || typeof touch.pageX != 'number') {
					continue;
				}
				$.pcb.point(pxToMm(touch.pageX, true), pxToMm(touch.pageY, true));
			}
			return false;
		});
		$(document).ajaxError(function(e, jqxhr, settings, exception) {
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
		$(window).on('resize', function(e) {
			if (isTouchDevice()) {
				fitZoomToViewport();
			} else {
				centerCanvas();
			}
		});

		// create main canvas
		var cvs = $('<canvas id="pcb-canvas"></canvas>');
		$('body').prepend(cvs);
		// normalize {request,cancel}AnimationFrame across browsers
		var requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.msRequestAnimationFrame;
		window.requestAnimationFrame = requestAnimationFrame;
		var cancelAnimationFrame = window.cancelAnimationFrame || window.webkitCancelAnimationFrame || window.mozCancelAnimationFrame || window.msCancelAnimationFrame;
		window.cancelAnimationFrame = cancelAnimationFrame;

		$.pcb.clear();
		$.pcb.library();
		// TODO (later): remove once the UI is in place
		$.pcb.selectPattern(1);
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
			if (typeof width == 'number' && 0 < width) {
				board.width = width;
			}
			if (typeof height == 'number' && 0 < height) {
				board.height = height;
			}
			// create high DPI canvas elements
			for (var l in board.layers) {
				var cvs = createCanvas(board.width, board.height);
				// substrate is filled by default
				if (l == 'substrate') {
					fillCanvas(cvs, '#000');
				}
				board.layers[l] = cvs;
			}
			view = $.extend(true, {}, defaultView);
			invalidateView();
			if (isTouchDevice()) {
				fitZoomToViewport();
			} else {
				centerCanvas();
			}
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
				if (typeof mm != 'number' || mm <= 0) {
					return false;
				} else {
					view[diameterKey] = mm;
					requestRedraw();
					// TODO (later): event
					return true;
				}
			}
		},
		dimensions: function() {
			return { width: board.width, height: board.height };
		},
		donMode: function(enable) {
			if (enable === undefined) {
				return options.donMode;
			} else {
				if (enable) {
					if (options.donMode) {
						return;
					} else {
						options.donMode = true;
					}
					var elem = $('<audio id="pcb-don-music" loop><source src="media/don.ogg" type="audio/ogg"><source src="media/don.mp3" type="audio/mpeg"></audio>');
					$(elem).on('durationchange', function(e) {
						// seek to a random position
						this.currentTime = this.duration*Math.random();
						this.volume = 0;
						this.play();
					});
					$(elem).on('play', function(e) {
						// fade in
						$(this).animate({volume: 1}, 4000);
					});
					$('body').append(elem);
				} else {
					options.donMode = false;
					$('#pcb-don-music').each(function() {
						// fade out
						$(this).animate({volume: 0}, 4000, 'swing', function() {
							$(this).get(0).pause();
							$(this).remove();
						});
					});
				}
			}
		},
		drill: function(x, y, diameter) {
			if (typeof x != 'number' || typeof y != 'number') {
				return false;
			}
			if (diameter === undefined) {
				diameter = view.diameterDrill;
			} else if (typeof diameter != 'number') {
				return false;
			}
			// get key for new object
			var key = getFirstAvailableKey(board.drills, 'drill');
			board.drills[key] = {
				x: x,
				y: y,
				diameter: diameter,
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
		export: function(options) {
			if (typeof options != 'object') {
				// assume that we're being passed a preset name
				options = $.pcb.exportPreset(options);
			}
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
					rev: board.rev,
					opts: options
				});
			};
			setTimeout(retry, 100);
		},
		exportPreset: function(preset) {
			if (preset === undefined) {
				preset = 'modela';
			}
			if (preset == 'modela') {
				return {
					safety: 5,
					png_path: {
						offset_diameter: 0.79375,		// for 1/32" end mill
					},
					path_rml: {
						xmin: 0,
						ymin: 0,
						z_up: 8
					},
					top: {
						png_path: {
							offset_number: -1,
							offset_overlap: 0.5
						},
						path_rml: {
							speed: 4,
							zmin: -0.25
						}
					},
					drills: {
						png_path: {
							offset_number: 1
						},
						path_rml: {
							speed: 0.5,
							zmin: -2.0
						}
					},
					substrate: {
						png_path: {
							offset_number: 1
						},
						path_rml: {
							speed: 0.5,
							zmin: -2.0
						}
					},
					bottom: {
						png_path: {
							offset_number: -1
						},
						path_rml: {
							speed: 4,
							zmin: -0.25
						}
					}
				};
			} else {
				return {};
			}
		},
		jumper: function(from, to) {
			var jumper = {};
			// from
			if (typeof from == 'object' && typeof from.x == 'number' && typeof from.y == 'number') {
				jumper.from = { x: from.x, y: from.y };
				if (from.layer !== undefined) {
					jumper.from.layer = from.layer;
				} else {
					jumper.from.layer = $.pcb.layer();
				}
				if (jumper.from.layer == 'substrate') {
					return false;
				}
			} else if (typeof from == 'string') {
				// jumpers can be added to drills
				var obj = findObject(from, board, [ 'drills' ]);
				if (obj !== false) {
					jumper.from = from;
				} else {
					return false;
				}
			} else {
				return false;
			}
			// to
			if (typeof to == 'object' && typeof to.x == 'number' && typeof to.y == 'number') {
				jumper.to = { x: to.x, y: to.y };
				if (to.layer !== undefined) {
					jumper.to.layer = to.layer;
				} else {
					jumper.to.layer = $.pcb.layer();
				}
				if (jumper.to.layer == 'substrate') {
					return false;
				}
			} else if (typeof to == 'string') {
				var obj = findObject(to, board, [ 'drills' ]);
				if (obj !== false) {
					jumper.to = to;
				} else {
					return false;
				}
			} else {
				return false;
			}
			// get key for new object
			var key = getFirstAvailableKey(board.jumpers, 'jumper');
			board.jumpers[key] = jumper;
			requestRedraw();
			return key;
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
					// TODO (later): event
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
			// TODO (later): evaluate performance later
			for (var i=0; i <= len; i += step) {
				$.pcb.point(x1+((x2-x1)/len)*i, y1+((y2-y1)/len)*i);
			}
		},
		load: function(brd, rev) {
			if (typeof brd != 'number') {
				return false;
			}
			if (typeof rev != 'number') {
				rev = null;
			}
			loadBoard(brd, rev, function(newBoard) {
				board = newBoard;
				view = $.extend(true, {}, defaultView);
				if (isTouchDevice()) {
					fitZoomToViewport();
				}
				invalidateView();
				// EVENT
				$('html').trigger('pcb-loaded');
			});
			// EVENT
			$('html').trigger('pcb-loading');
		},
		moveObject: function(name, x, y) {
			if (typeof x != 'number' || typeof y != 'number') {
				return false;
			}
			if (x < 0 || board.width < x || y < 0 || board.height < y) {
				console.warn('Coordinates exceed board dimensions');
				return false;
			}

			var ret = false;
			if (board.drills[name] !== undefined) {
				// move drills
				board.drills[name].x = x;
				board.drills[name].y = y;
				ret = true;
			} else if (board.parts[name] !== undefined) {
				// move parts
				board.parts[name].x = x;
				board.parts[name].y = y;
				ret = true;
			} else if (board.texts[name] !== undefined) {
				// move texts
				if (typeof board.texts[name].parent == 'object') {
					board.texts[name].parent.x = x;
					board.texts[name].parent.y = y;
					ret = true;
				}
			}
			if (ret) {
				requestRedraw();
				// TODO (later): event
			}
			return ret;
		},
		objects: function(withPartDrills) {
			var ret = {};
			ret.drills = $.extend(true, {}, board.drills);
			ret.texts = $.extend(true, {}, board.texts);
			ret.parts = $.extend(true, {}, board.parts);
			ret.jumpers = $.extend(true, {}, board.jumpers);
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
				console.warn('Library not yet available');
				return false;
			} else if (l[part] === undefined) {
				return false;
			}
			if (typeof x != 'number' || typeof y != 'number') {
				return false;
			}
			if (typeof rot != 'number') {
				rot = 0;
			}
			if (typeof layer != 'string') {
				layer = $.pcb.layer();
			}
			if (layer != 'top' && layer != 'bottom') {
				return false;
			}

			var name = getFirstAvailableKey(board.parts, part);
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
			requestRedraw();
			return name;
		},
		pattern: function(x, y, rot) {
			if (view.pattern === null) {
				return false;
			}
			if (typeof x != 'number' || typeof y != 'number') {
				return false;
			}
			if (typeof rot != 'number') {
				rot = 0;
			}
			mergeBoards(board, view.pattern, x, y, rot);
			invalidateView();
		},
		point: function(x, y) {
			if (view.tool == 'draw' || view.tool == 'erase') {
				for (var i=0; i < 2; i++) {
					if (i == 0) {
						var cvs = board.layers[view.layer];
						var zoom = false;
					} else {
						var cvs = requestViewLayer(board, view.layer, view);
						var zoom = true;
					}
					var ctx = cvs.getContext('2d');
					ctx.save();
					if (view.tool == 'draw') {
						if (zoom == false) {
							// the high DPI board is b/w
							ctx.fillStyle = '#000';
						} else {
							if (view.layer == 'top') {
								ctx.fillStyle = '#f00';
							} else if (view.layer == 'substrate') {
								ctx.fillStyle = '#000';
							} else {
								ctx.fillStyle = '#00f';
							}
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
			var ret = removeObject(name);
			if (ret) {
				requestRedraw();
			}
			return ret;
		},
		requestPending: function() {
			return (0 < view.ajaxPending);
		},
		resize: function(width, height, anchor) {
			if (typeof width != 'number' || width < 0 || typeof height != 'number' || height < 0) {
				return false;
			}
			if (typeof anchor != 'string') {
				anchor = '';
			}

			// calculate offsets
			if (anchor == 'nw' || anchor == 'w' || anchor == 'sw') {
				var offsetX = 0;
			} else if (anchor == 'ne' || anchor == 'e' || anchor == 'se') {
				var offsetX = width-board.width;
			} else {
				var offsetX = (width-board.width)/2;
			}
			if (anchor == 'nw' || anchor == 'n' || anchor == 'ne') {
				var offsetY = 0;
			} else if (anchor == 'sw' || anchor == 's' || anchor == 'se') {
				var offsetY = height-board.height;
			} else {
				var offsetY = (height-board.height)/2;
			}

			// handle layers
			for (var l in board.layers) {
				var cvs = createCanvas(width, height);
				// substrate is filled by default
				if (l == 'substrate' && canvasIsEmpty(board.layers[l], 255<<24)) {
					fillCanvas(cvs, '#000');
				}
				var ctx = cvs.getContext('2d');
				ctx.save();
				ctx.drawImage(board.layers[l], 0, 0, board.layers[l].width, board.layers[l].height, mmToPx(offsetX), mmToPx(offsetY), board.layers[l].width, board.layers[l].height);
				ctx.restore();
				board.layers[l] = cvs;
			}

			// handle objects
			for (var d in board.drills) {
				var drill = board.drills[d];
				drill.x += offsetX;
				drill.y += offsetY;
				if (drill.x < 0 || width < drill.x || drill.y < 0 || height < drill.y) {
					removeObject(d, board);
				}
			}
			for (var j in board.jumpers) {
				var jumper = board.jumpers[j];
				if (typeof jumper.from == 'object') {
					jumper.from.x += offsetX;
					jumper.from.y += offsetY;
					if (jumper.from.x < 0 || width < jumper.from.x || jumper.from.y < 0 || height < jumper.from.y) {
						removeObject(j, board);
						continue;
					}
				}
				if (typeof jumper.to == 'object') {
					jumper.to.x += offsetX;
					jumper.to.y += offsetY;
					if (jumper.to.x < 0 || width < jumper.to.x || jumper.to.y < 0 || height < jumper.to.y) {
						removeObject(j, board);
					}
				}
			}
			for (var p in board.parts) {
				var part = board.parts[p];
				part.x += offsetX;
				part.y += offsetY;
				if (part.x < 0 || width < part.x || part.y < 0 || height < part.y) {
					removeObject(p, board);
				}
			}
			for (var t in board.texts) {
				var text = board.texts[t];
				if (typeof text.parent == 'object') {
					text.parent.x += offsetX;
					text.parent.y += offsetY;
					if (text.parent.x < 0 || width < text.parent.x || text.parent.y < 0 || height < text.parent.y) {
						removeObject(t, board);
					}
				}
			}

			board.width = width;
			board.height = height;
			invalidateView();
			return true;
		},
		rev: function() {
			return board.rev;
		},
		rotateObject: function(name, deg) {
			if (typeof deg != 'number') {
				return false;
			} else {
				deg = normalizeAngle(deg);
			}
			var obj = findObject(name, board, [ 'parts' ]);
			if (obj !== false) {
				if (obj.obj.rot != deg) {
					obj.obj.rot = deg;
					requestRedraw();
					return true;
				}
			} else {
				return false;
			}
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
				}
			});
			// EVENT
			$('html').trigger('pcb-saving');
		},
		selectPart: function(part) {
			if (part === undefined) {
				return view.part;
			} else {
				var l = $.pcb.library();
				if (l === false) {
					console.warn('Library not yet available');
					return false;
				} else if (l[part] === undefined) {
					return false;
				} else if (part !== view.part) {
					view.part = part;
					requestRedraw();
				}
			}
		},
		selectPattern: function(brd) {
			if (typeof brd !== 'number') {
				return false;
			}
			loadBoard(brd, null, function(patternBoard) {
				view.pattern = patternBoard;
				requestRedraw();
			});
		},
		testParts: function() {
			// TODO (later): remove once the UI is in place
			var elem = $('<input type="file">');
			$(elem).on('change', function(e) {
				$.pcb.addDrawing('arduinoshield', this.files[0], function(data) {
					console.log('added drawing');
					console.log(data);
					$.pcb.addPart('arduinoshield', 'Arduino Shield', null, { description: 'Generic Arduino Shield' }, function(data) {
						console.log('added part');
						console.log(data);
					});
					//$.pcb.addPart('atmega168-dip28', 'Atmega 168 (DIP28)', 'dip28', { description: 'Microcontroller', drills: { 'pin1': { description: 'PC6' } } }, function(data) {
					//	console.log('added atmega168-dip28');
					//	console.log(data);
					//});
					//$.pcb.addPartComment('atmega168-dip28', 'Nice chip', function(data) {
					//	console.log('added comment');
					//	console.log(data);
					//});
					//$.pcb.addPartSupplier('atmega168-dip28', 'DigiKey', '123', '456', function(data) {
					//	console.log('added supplier');
					//	console.log(data);
					//});
				});
				$(this).remove();
			});
			$('body').append(elem);
		},
		text: function(parent, string) {
			var text = {};
			if (typeof parent == 'object' && typeof parent.x == 'number' && typeof parent.y == 'number') {
				text.parent = { x: parent.x, y: parent.y };
				if (parent.layer !== undefined) {
					text.parent.layer = parent.layer;
				} else {
					text.parent.layer = $.pcb.layer();
				}
			} else if (typeof parent == 'string') {
				// texts can be added to drills, jumpers, parts
				var obj = findObject(parent, board, [ 'drills', 'jumpers', 'parts' ]);
				if (obj !== false) {
					text.parent = parent;
				} else {
					return false;
				}
			} else {
				return false;
			}
			if (typeof string == 'string') {
				text.text = string;
			} else {
				return false;
			}
			// get key for new object
			var key = getFirstAvailableKey(board.texts, 'text');
			board.texts[key] = text;
			requestRedraw();
			return key;
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
					if (!isTouchDevice()) {
						centerCanvas();
					}
					return true;
				}
			}
		}
	};
})(jQuery, window, document);
