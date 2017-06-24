'use strict';

let env = "dev";
// let env = "product";

let restAPI = (function(window, jQuery) {
	let _mainHost = null,
		_v1ApiBaseUrl = null;

	if (env == "dev") {
		_mainHost = "http://localhost:8000/";
	} else {
		_mainHost = "http://54.175.85.52/";
	}

	_v1ApiBaseUrl = _mainHost + "api/v1/";
	let _settings = {
			"url": _v1ApiBaseUrl + "iSamples",
			"method": "POST",
			"data": {
				"token": JSON.parse(localStorage._token || "null"),
			},
			"headers": {
				"accept": "application/json"
			}
		};

	/**
	 * 
	 * @param {string} domain 
	 * @param {string} category 
	 * @param {function} success 
	 * @param {function} failure 
	 */
	const getInitialSamples = (domain, category, success, failure) => {
			_settings.data.domain = domain;
			_settings.data.category = category;
			_settings.data.token = JSON.parse(localStorage._token);
			$.ajax(_settings).done((response) => {
				if (response.status) {
					if (typeof success === "function") {
						success(response.samples);
					}
				} else {
					if (typeof failure === "function") {
						failure();
					}
				}
			});
		};

	const register = function(name, email, password, callback) {
			$.ajax({
				url: _v1ApiBaseUrl + "register",
				data: JSON.stringify({
					name: name,
					email: email,
					password: password
				}),
				method: "post",
				contentType: "application/json",
				success: function(res) {
					if (typeof callback == "function") {
						callback(res);
					} else {
						console.log(res);
					}
				}
			});
		};

	const login = function(email, password, callback) {
			$.ajax({
				url: _v1ApiBaseUrl + "login",
				data: JSON.stringify({
					email: email,
					password: password
				}),
				method: "post",
				contentType: "application/json",
				success: function(res) {
					if (typeof callback == "function") {
						callback(res);
					} else {
						console.log(res);
					}
				}
			});
		};

	return {
		base: _mainHost,
		apiBaseUrl: _v1ApiBaseUrl,
		samples: getInitialSamples,
		register: register,
		login: login
	};
	
})(window, $)