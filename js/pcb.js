(function($, window, document, undefined) {
	var options = {
		auth: {
			secret: null,
			uid: null,
			user: null
		},
		baseUrl: null
	};
	
	var board = {
		author: null,
		board: null,
		parentBoard: null,
		parentRev: null,
		test: null,
		rev: null
	};
	
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
	
	// Event handlers
	$(document).ready(function(e) {
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
					board = data;
					// DEBUG
					console.log('loaded '+board.board+' '+board.rev);
				}
			});
		},
		parent: function() {
			return { board: board.parentBoard, rev: board.parentRev };
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
			ajaxRequest({
				method: 'save',
				board: board,
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
		}
	};
})(jQuery, window, document);