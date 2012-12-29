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
		redrawPending: false,
		ruler: false,
		tool: 'draw',
		toolData: {},
		zoom: 1
	};
	var view = {};

	// Helper functions
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

		// layers
		ctx.save();
		ctx.globalAlpha = 0.5;
		if (view.layer == 'top' || view.layer == 'substrate') {
			var order = ['bottom', 'substrate', 'top'];
		} else {
			var order = ['top', 'substrate', 'bottom'];
		}
		for (var l in order) {
			ctx.drawImage(view.layers[order[l]], 0, 0);
		}
		ctx.restore();

		// drill holes
		ctx.save();
		for (var d in board.drills) {
			ctx.fillStyle = '#000';
			ctx.beginPath();
			ctx.arc(mmToPx(board.drills[d].x, true), mmToPx(board.drills[d].y, true), mmToPx(board.drills[d].diameter/2, true), 0, 2*Math.PI);
			ctx.fill();
			// vias
			if (board.drills[d].via == true) {
				ctx.fillStyle = '#ff0'
				ctx.beginPath();
				ctx.arc(mmToPx(board.drills[d].x, true), mmToPx(board.drills[d].y, true), mmToPx(board.drills[d].diameter*0.5/2, true), 0, 2*Math.PI);
				ctx.fill();
			}
		}
		ctx.restore();

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
		drill: function(x, y, diameter, parent, pin) {
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
			if (typeof pin != 'number') {
				pin = null;
			}
			// get key for new object
			var key = getFirstAvailableKey(board.drills, 'drill');
			board.drills[key] = {
				x: x,
				y: y,
				diameter: diameter,
				parent: parent,
				pin: pin,
				via: false,
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
		objects: function() {
			var ret = {};
			ret.drills = $.extend(true, {}, board.drills);
			ret.texts = $.extend(true, {}, board.texts);
			return ret;
		},
		parentBoard: function() {
			return { board: board.parentBoard, rev: board.parentRev };
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
			var scope = [ board.drills, board.texts ];
			for (s in scope) {
				for (o in scope[s]) {
					if (name === o) {
						// TODO: event
						if (scope[s] == board.drills) {
							// TODO: also remove connected jumpers, texts
							delete board.drills[name];
						} else if (scope[s] == board.texts) {
							delete board.texts[name];
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