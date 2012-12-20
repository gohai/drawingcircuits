(function($, window, document, undefined) {
	var options = {
		auth: {
			secret: null,
			uid: null,
			user: null
		},
		baseUrl: null,
		highDpi: 300
	};
	
	var defaultBoard = {
		author: null,
		board: null,
		drill: {},
		height: 100,
		layers: {
			'bottom': null,
			'substrate': null,
			'top': null
		},
		parentBoard: null,
		parentRev: null,
		rev: null,
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
		zoom: 1
	};
	var view = {};
	
	// Helper functions
	var ajaxRequest = function(data, success) {
		// setup shim success function
		var shimSuccess = function(data) {
			success(data);
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
		for (var d in board.drill) {
			ctx.fillStyle = '#000';
			ctx.beginPath();
			ctx.arc(mmToPx(board.drill[d].x, true), mmToPx(board.drill[d].y, true), mmToPx(board.drill[d].diameter/2, true), 0, 2*Math.PI);
			ctx.fill();
			// vias
			if (board.drill[d].via == true) {
				ctx.fillStyle = '#FF0'
				ctx.beginPath();
				ctx.arc(mmToPx(board.drill[d].x, true), mmToPx(board.drill[d].y, true), mmToPx(board.drill[d].diameter*0.5/2, true), 0, 2*Math.PI);
				ctx.fill();
			}
		}
		ctx.restore();
		
		// mouse cursor
		ctx.save();
		if (view.lastMouseX !== null && view.lastMouseY !== null) {
			ctx.strokeStyle = '#f00';
			ctx.beginPath();
			ctx.arc(view.lastMouseX, view.lastMouseY, mmToPx($.pcb.diameter()/2, true), 0, 2*Math.PI);
			ctx.stroke();
		}
		ctx.restore();
		
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
				// B
				$.pcb.tool('draw');
			} else if (e.keyCode == 100) {
				// D
				$.pcb.tool('drill');
			} else if (e.keyCode == 101) {
				// E
				$.pcb.tool('erase');
			} else if (e.keyCode == 114) {
				// R
				$.pcb.ruler(!$.pcb.ruler());
			} else if (e.keyCode == 115) {
				// S
				if (!$.pcb.requestPending()) {
					$.pcb.save();
				}
			} else {
				// DEBUG
				//console.log(e.keyCode);
			}
		});
		$('html').on('mousedown', '#pcb-canvas', function(e) {
			view.usingTool = true;
			var p = screenPxToCanvas(e.offsetX, e.offsetY);
			if (view.tool == 'draw' || view.tool == 'erase' || view.tool == 'drill') {
				$.pcb.point(pxToMm(p.x, true), pxToMm(p.y, true));
			}
			return false;
		});
		$('html').on('mousemove', '#pcb-canvas', function(e) {
			var p = screenPxToCanvas(e.offsetX, e.offsetY);
			if (view.usingTool === true) {
				if (view.tool == 'draw' || view.tool == 'erase') {
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
			view.usingTool = false;
			return false;
		});
		$('html').on('mouseleave', '#pcb-canvas', function(e) {
			view.usingTool = false;
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
	});
	
	// Interface
	$.pcb = {
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
			var max = -1;
			for (var key in board.drill) {
				if (key.substr(0, 5) == 'drill') {
					var cur = parseInt(key.substr(5));
					if (max < cur) {
						max = cur;
					}
				}
			}
			var key = 'drill'+(max+1);
			board.drill[key] = {
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
		line: function(x1, y1, x2, y2) {
			var len = Math.sqrt(Math.pow(x2-x1, 2)+Math.pow(y2-y1, 2));
			var step = pxToMm(1);
			// TODO: evaluate performance later
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
			var ret = {
				drill: {}
			};
			ret.drill = $.extend(true, {}, board.drill);
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
			var scope = [ board.drill ];
			for (s in scope) {
				for (o in scope[s]) {
					if (name === o) {
						// TODO: event
						if (scope[s] == board.drill) {
							// TODO: also remove connected jumpers
							delete board.drill[name];
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
		tool: function(t) {
			if (t === undefined) {
				return view.tool;
			} else {
				if (t == view.tool) {
					return;
				} else {
					view.tool = t;
					requestRedraw();
				}
			}
		},
		via: function(drill, isVia) {
			if (board.drill[drill] === undefined) {
				return false;
			} else if (isVia === undefined) {
				return board.drill[drill].via;
			} else {
				if (isVia) {
					isVia = true;
				} else {
					isVia = false;
				}
				if (isVia == board.drill[drill].via) {
					return;
				} else {
					board.drill[drill].via = isVia;
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