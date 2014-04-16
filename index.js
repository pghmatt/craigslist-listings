var cheerio = require("cheerio");
var request = require("request");
var winston = require("winston");
var async = require("async");
var extend = require("xtend");

var globalOptions = {
	autoLogin: false
};

var cookieJar = request.jar(); // enable cookies
var logger = new (winston.Logger)({
	transports: [
		new (winston.transports.Console)({ silent: true }) // adjust to show console log output
	]
});

/**
 * Creates a JS object from a DOM form element.
 * @param  {Cheerio} $ The Cheerio object to use.
 * @param  {DOMObject} formDom The <form> DOM element.
 * @return {Object} The converted JS object.
 */
function createFormObject($, formDom) {
	var formObject = {};

	formDom.find("input, textarea, select").each(function() {
		var item = $(this);
		if (!item.is("input[type='button'], input[type='submit']")) {
			formObject[item.attr("name")] = item.attr("value");
		}
	});

	return formObject;
}

/**
 * Determines if the fetched account page is for a logged in user or if a login is required
 * (due to missing or expired session cookie).
 * @param  {Cheerio} $ The Cheerio object to use.
 * @return {Boolean} If logged in or not.
 */
function isLoggedIn($) {
	var loginForm = $("form[name='login']");

	var loginPage = !!($("body.login").length);
	var accountPage = !!($("body.account").length);

	return !loginPage && accountPage;
}

/**
 * Login helper function. Used to avoid having to GET the entire HTML again.
 * Logs a user in if they are not already logged in.
 * @param  {Cheerio}   $
 * @param  {String}   email
 * @param  {String}   password
 * @param  {Function} callback Callback function when done logging in. Also called in the case the user is already logged in.
 */
function loginFromPage($, email, password, callback) {
	if (!email || !password) {
		var errorMsg = "No email/password provided to login to Craigslist with";
		logger.error(errorMsg);
		return callback(new Error(errorMsg));
	}

	var loggedIn = isLoggedIn($);
	logger.info("Logged in?", loggedIn);

	if (!loggedIn) {
		var loginForm = $("form[name='login']");
		var form = loginForm.first();

		var emailField = form.find("input[name='inputEmailHandle']").first();
		var passwordField = form.find("input[name='inputPassword']").first();

		emailField.val(email);
		passwordField.val(password);

		var formObject = createFormObject($, form);

		logger.info("Submitting login form with object:", formObject);
		request.post(form.attr("action"), { form: formObject, jar: cookieJar },
			function(err, response, body) {
				if (err) return callback(err)
				if (response.statusCode === 302) {
					logger.info("Successfully logged in ("+response.statusCode+").");
					return callback(null);
				} else {
					var errorMsg = "Error submitting login form: "+ response.statusCode;
					logger.error(errorMsg);
					return callback(new Error(errorMsg));
				}
			}
		);
	} else {
		async.nextTick(function() {
			return callback(null);
		});
	}
}

/**
 * Performs an action once on the account page.
 * @param  {Object} options             Optional options.
 * @param  {Function} doneCallback        Function to call when done (args can vary as long as "err" is first)
 * @param  {Function} afterLoggedInAction Function to call when logged in (calls the doneCallback). Args are required to be ($, options, doneCallback).
 */
function accountsPageAction(options, doneCallback, afterLoggedInAction) {
	logger.info("options:", options);
	request(
		{
			method: "GET",
			uri: "https://accounts.craigslist.org/",
			jar: cookieJar
		},
		function(err, response, body) {
			if (err) {
				logger.error(err);
				return doneCallback(err);
			}

			var $ = cheerio.load(body);

			if (options.autoLogin) {
				loginFromPage($, globalOptions.email, globalOptions.password, function(err) {
					if (err) return doneCallback(err);

					// Now that we are logged in, we just re-run the method with autoLogin set to false
					options.autoLogin = false;
					return accountsPageAction(options, doneCallback, afterLoggedInAction);
				});
			} else {
				async.nextTick(function() {
					return afterLoggedInAction($, options, doneCallback);
				});
			}
		}
	);
}

/**
 * Sets the global (default) options for all methods.
 * @param  {Object} options Options object.
 */
exports.defaults = function(options) {
	globalOptions = extend(globalOptions, options);
	logger.info("global options set to", globalOptions);
};

/**
 * Manually logs the user in to Craigslist.
 * @param  {Object}   options
 * @param  {Function} callback Callback function to call when done.
 */
exports.login = function(options, callback) {
	var email = options.email || globalOptions.email;
	var password = options.password || globalOptions.password;

	request(
		{
			method: "GET",
			uri: "https://accounts.craigslist.org/",
			jar: cookieJar
		},
		function(err, response, body) {
			if (err) {
				logger.error(err);
				return callback(err, false);
			}

			var $ = cheerio.load(body);

			loginFromPage($, email, password, callback);
		}
	);
};

/**
 * Renews any Craigslist listings that are active and ready to be renewed.
 * @param  {Object}   options  The options.
 * @param  {Function} callback The function called when done. Accepts (err, arryOfListingNamesRenewed) as arguments.
 */
exports.renewListings = function(options, callback) {
	if (arguments.length === 1) {
		if (Object.prototype.toString.call(options) === "[object Function]") {
			callback = options;
			options = {};
		}
	}

	var mergedOptions = extend(globalOptions, options);

	var action = function($, options, doneCallback) {
		var listings = $("table[summary='postings'] > tr");

		logger.info("Total listings:", listings.length);

		var activeListings = listings.filter(function(index) {
			return $(this).find("td[class='status']:contains(Active)").length; // TODO ignore case
		});

		logger.info("Active listings:", activeListings.length);

		var numDone = 0;
		var renewed = [];
		var checkIfDone = function(renewedListing) {
			numDone++;
			if (renewedListing) renewed.push(renewedListing);
			if (numDone === activeListings.length) {
				return callback(null, renewed);
			}
		};

		activeListings.each(function(index) {
			var listingName = $(this).find("td[class='title'] a").text().trim();
			var renewForm = $(this).find("td[class='buttons']").find("form[method='POST']").filter(function(index) {
				return $(this).find("input[type='submit'][value='renew']").length; // TODO ignore case
			});

			if (renewForm.length) {
				var formObject = createFormObject($, renewForm);
				logger.info("Submitting renewal form with object:", formObject);
				request.post(renewForm.attr("action"), { form: formObject, jar: cookieJar, followAllRedirects: true },
					function(err, response, body) {
						if (err) {
							logger.error(err);
							return callback(err);
						}
						if (response.statusCode >= 200 && response.statusCode < 300){
							logger.info('Successfully renewed listing "'+ listingName + '"');
							checkIfDone(listingName);
						} else {
							var errorMsg = "Error submitting renewal form: "+ response.statusCode;
							logger.error(errorMsg);
							return callback(new Error(errorMsg));
						}
					}
				);
			} else {
				logger.info('Listing "'+ listingName +'" is not ready to be renewed');
				checkIfDone();
			}
		});
	};

	return accountsPageAction(mergedOptions, callback, action);
};