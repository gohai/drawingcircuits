(function($, window, document, undefined) {
	var options = {
		auth: {
			secret: null,
			uid: null,
			user: null
		},
		baseUrl: null,
		highDpi: 300.0
	};
	
	var defaultBoard = {
		author: null,
		board: null,
		height: 100.0,
		layers: {
			'bottom': null,
			'substrate': null,
			'top': null
		},
		parentBoard: null,
		parentRev: null,
		rev: null,
		width: 100.0
	};
	var board = {};
	
	var defaultView = {
		diameter: 5.0,
		lastMouseX: null,
		lastMouseY: null,
		layer: 'top',
		layers: {},
		layersToLoad: 0,
		redrawPending: false,
		tool: 'draw',
		zoom: 1.0
	};
	var view = {};
	
	// Helper functions
	var ajaxRequest = function(data, success) {
		// encode request data
		for (key in data) {
			data[key] = JSON.stringify(data[key]);
		}
		$.ajax({
			url: options.baseUrl+'ajax.php',
			type: 'POST',
			data: data,
			dataType: 'json',
			success: success
		});
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
		$('#pcb-canvas').attr('width', mmToPx(board.height, true));
		$('#pcb-canvas').attr('height', mmToPx(board.width, true));
		// draw to screen
		var cvs = $('#pcb-canvas').get(0);
		var ctx = cvs.getContext('2d');
		// layers
		ctx.save();
		ctx.drawImage(view.layers[view.layer], 0, 0);
		ctx.restore();
		// mouse cursor
		if (view.lastMouseX !== null && view.lastMouseY !== null) {
			ctx.save();
			ctx.strokeStyle='#f00';
			ctx.beginPath();
			ctx.arc(view.lastMouseX, view.lastMouseY, mmToPx(view.diameter/2, true), 0, 2*Math.PI);
			ctx.stroke();
			ctx.restore();
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
	
	// Event handlers
	$(document).ready(function(e) {
		$('html').on('mousedown', '#pcb-canvas', function(e) {
			view.usingTool = true;
			$.pcb.point(pxToMm(e.offsetX, true), pxToMm(e.offsetY, true));
			return false;
		});
		$('html').on('mousemove', '#pcb-canvas', function(e) {
			if (view.usingTool === true) {
				$.pcb.point(pxToMm(e.offsetX, true), pxToMm(e.offsetY, true));
			}
			// track mouse
			view.lastMouseX = e.offsetX;
			view.lastMouseY = e.offsetY;
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
			}
			view = $.extend(true, {}, defaultView);
			invalidateView();
		},
		diameter: function(mm) {
			if (mm === undefined) {
				return view.diameter;
			} else {
				view.diameter = mm;
				requestRedraw();
				// TODO: event
			}
		},
		layer: function() {
			return view.layer;
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
					// convert layers into canvas elements
					view.layersToLoad = 0;
					var hasLayers = false;
					for (var l in data.layers) {
						view.layersToLoad++;
						hasLayers = true;
						(function(l) {
							var img = new Image();
							img.onload = function() {
								var cvs = $('<canvas></canvas>');
								$(cvs).attr('width', this.width);
								$(cvs).attr('height', this.height);
								var ctx = $(cvs).get(0).getContext('2d');
								ctx.save();
								ctx.drawImage(img, 0, 0);
								ctx.restore();
								data.layers[l] = $(cvs).get(0);
								view.layersToLoad--;
								if (view.layersToLoad == 0) {
									board = data;
									invalidateView();
								}
							};
							img.src = data.layers[l].png;
						}(l));
					}
					// fallback if we don't have any layers
					if (!hasLayers) {
						board = data;
						invalidateView();
					}
				}
			});
		},
		parent: function() {
			return { board: board.parentBoard, rev: board.parentRev };
		},
		point: function(x, y) {
			if (view.tool == 'draw') {
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
					ctx.fillStyle='#000';
					ctx.beginPath();
					ctx.arc(mmToPx(x, zoom), mmToPx(y, zoom), mmToPx(view.diameter/2, zoom), 0, 2*Math.PI);
					ctx.fill();
					ctx.restore();
				}
				requestRedraw();
			}
		},
		rev: function() {
			return board.rev;
		},
		save: function(asNew) {
			board.parentBoard = board.board;
			board.parentRev = board.rev;
			board.rev = null;
			if (asNew) {
				board.board = null;
			}
			// make a copy of board in order to base64-encode the contained layers
			var b = $.extend(true, {}, board);
			for (var l in b.layers) {
				var png = b.layers[l].toDataURL('image/png');
				b.layers[l] = {
					width: b.layers[l].width,
					height: b.layers[l].height,
					png: png
				};
			}
			ajaxRequest({
				method: 'save',
				board: b,
				auth: options.auth
			}, function(data) {
				if (data !== null) {
					var redirect = false;
					if (data.board !== board.board) {
						redirect = true;
					}
					board.board = data.board;
					board.rev = data.rev;
					if (redirect) {
						// redirect if we created a whole new board
						window.location = options.baseUrl+board.board;
					}
				}
			});
		},
		tool: function() {
			return view.tool;
		},
		zoom: function(fac) {
			if (fac === undefined) {
				return view.zoom;
			} else {
				if (fac === view.zoom) {
					return;
				} else {
					view.zoom = fac;
					invalidateView();
				}
			}
		}
	};
})(jQuery, window, document);