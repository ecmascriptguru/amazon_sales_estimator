'use strict';

let globalTimer = null;

let ContentScript = (function() {
	let _token = null;
	let _parser = null;

	/**
	 * Initialize 2 objects to manage eBooks category and Books category on various amazon sub domains.
	 * @param {string} domain 
	 * @param {string} category 
	 */
	const init = (domain, category) => {
	};

	return {
		init: init
	};
})();

(function(window, jQuery) {
	chrome.runtime.sendMessage({
		from: "amazon",
		action: "status"
	}, function(response) {
		const determine = () => {
			let host = window.location.host,
				wwwPrefix = "www.",
				path = window.location.pathname,
				category = null,
				mode = null;

			if (host.indexOf("www.amazon.") !== 0) {
				return false;
			}

			let domain = (host.indexOf(wwwPrefix) > -1) ? host.substr(wwwPrefix.length) : host;

			if (path.match(/(\/(B|b)est-(S|s)ellers-(B|b)ooks-.*\/zgbs\/books)|(\/gp\/bestsellers\/books)/g)) {
				category = "Books";
				mode = "list";
			} else if (path.match(/(\/Best-Sellers-Kindle-Store.*\/zgbs\/digital-text)|(\/gp\/bestsellers\/digital-text)/g)) {
				category = "eBooks";
				mode = "list";
			} else if (path.match(/(\/ref=zg_bs_books_\d+)|(\/ref=tmm_pap_swatch_\d+)|(\/ref=mt_paperback)/g)) {
				category = "Books";
				mode = "individual";
			} else if (path.match(/(\/ref=zg_bs_\d+)|(\/ref=mt_kindle\d+)||(\/ref=tmm_kin_swatch_\d+)/g)) {
				category = "eBooks";
				mode = "individual";
			} else {
				return false;
			}

			return {
				domain,
				category,
				mode
			};
		};

		let params = determine();

		if (!params) {
			chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
				switch(request.from) {
					case "popup":
						if (request.action == "get_data") {
							sendResponse({
								started: _started,
								layout: false
							});
						}
						break;
				}
			})
		} else {
			Parser.init(params.domain, params.category, params.mode);
		}
	});
})(window, $);