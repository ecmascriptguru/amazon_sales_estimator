'use strict';
let _mainHost = null;
let env = "dev";
// let env = "product";

if (env == "dev") {
	_mainHost = "http://localhost:8000/";
} else {
	_mainHost = "http://54.175.85.52/";
}

let restAPI = (function(window, jQuery) {
	let _v1ApiBaseUrl = _mainHost + "api/v1/";
	let _settings = {
		"url": _v1ApiBaseUrl + "iSamples",
		"method": "POST",
		"data": {  },
		"headers": {
			"accept": "application/json"
		}
	};

	/**
	 * Send request to API to the specific url with given params.
	 * @param {string} url 
	 * @param {object} params 
	 * @param {function} success 
	 * @param {function} failure 
	 */
	const sendRequest = (url, params, success, failure) => {
		_settings.url = url;
		_settings.data = params;
		$.ajax(_settings).done((response) => {
			if (response.status) {
				if (typeof success === "function") {
					success(response);
				}
			} else {
				if (typeof failure === "function") {
					failure(response);
				}
			}
		});
	}

	/**
	 * Getting initial sample parameters to compute estimation of unit sales.
	 * @param {string} domain 
	 * @param {string} category 
	 * @param {function} success 
	 * @param {function} failure 
	 */
	const getInitialSamples = (domain, category, success, failure) => {
		let params = {
			domain: domain,
			category: category,
			token: JSON.parse(localStorage._token),
		}

		sendRequest(_v1ApiBaseUrl + "iSamples", params, success, failure);
	};

	/**
	 * Getting all of products being tracked by authenticated user for given domain and category.
	 * @param {string} domain 
	 * @param {string} category 
	 * @param {function} success 
	 * @param {function} failure 
	 */
	const getTrackingProducts = (domain, category, success, failure) => {
		let params = {
			domain: domain,
			category: category,
			token: JSON.parse(localStorage._token),
		}
		sendRequest(_v1ApiBaseUrl + "items", params, success, failure);
	}

	/**
	 * Register user with name, email address and password.
	 * @param {string} name 
	 * @param {string} email 
	 * @param {string} password 
	 * @param {function} callback 
	 * @param {function} failure
	 */
	const register = function(name, email, password, success, failure) {
		let params = {
			name: name,
			email: email,
			password: password
		};

		sendRequest(_v1ApiBaseUrl + "register", params, success, failure);
	};

	/**
	 * Login with email address and password.
	 * @param {string} email 
	 * @param {string} password 
	 * @param {function} success 
	 * @param {function} failure
	 */
	const login = function(email, password, success, failure) {
		let params = {
			email: email,
			password: password
		}

		sendRequest(_v1ApiBaseUrl + "login", params, success, failure);
	};

	return {
		base: _mainHost,
		apiBaseUrl: _v1ApiBaseUrl,
		trackings: getTrackingProducts,
		samples: getInitialSamples,
		register: register,
		login: login
	};
	
})(window, $)