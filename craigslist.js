var cheerio = require("cheerio");
var request = require("request");
var clLogin = require("./craigslist.login.js");

var email = clLogin.email;
var password = clLogin.password;

var cookieJar = request.jar(); // enable cookies

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

exports.renewListings = function(callback, isRetry) {
	request(
		{
			method: "GET",
			uri: "https://accounts.craigslist.org/",
			jar: cookieJar
		},
		function(err, response, body) {
			if (err) {
				console.log(err);
				return callback(false);
			}

			var $ = cheerio.load(body);

			var loginForm = $("form[name='login']");

			var notLoggedIn = !!($("body.login").length);
			console.log("- Not logged in?", notLoggedIn);

			console.log("- Account page?", !!($("body.account").length));

			if (notLoggedIn) {
				if (isRetry) {
					console.log(body);
					return callback(false);
				}

				var form = loginForm.first();

				var emailField = form.find("input[name='inputEmailHandle']").first();
				var passwordField = form.find("input[name='inputPassword']").first();

				emailField.val(email);
				passwordField.val(password);

				var formObject = createFormObject($, form);

				console.log("- Submitting login form with object:", formObject);
				request.post(form.attr("action"), { form: formObject, jar: cookieJar },
					function(err, response, body) {
						if (!err && response.statusCode === 302) {
							console.log("- Successfully logged in ("+response.statusCode+").");

							exports.renewListings(callback, true); // request the page again now that we are logged in
						} else {
							console.log("- Error submitting login form: "+ response.statusCode);
							console.log(body);
							return callback(false);
						}
					}
				);
			} else {
				var listings = $("table[summary='postings'] > tr");

				console.log("- Total listings:", listings.length);

				var activeListings = listings.filter(function(index) {
					return $(this).find("td[class='status']:contains(Active)").length; // TODO use .text() to ignore case
				});

				console.log("- Active listings:", activeListings.length);
				console.log();

				activeListings.each(function(index) {
					var listingName = $(this).find("td[class='title'] a").text().trim();
					var renewForm = $(this).find("td[class='buttons']").find("form[method='POST']").filter(function(index) {
						return $(this).find("input[type='submit'][value='renew']").length; // TODO ignore case
					});

					if (renewForm.length) {
						var formObject = createFormObject($, renewForm);
						console.log("- Submitting renewal form with object:", formObject);
						request.post(renewForm.attr("action"), { form: formObject, jar: cookieJar, followAllRedirects: true },
							function(err, response, body) {
								if (!err && response.statusCode >= 200 && response.statusCode < 300){
									console.log('Successfully renewed listing "'+ listingName + '"');
									console.log();
								} else {
									console.log("- Error submitting renewal form: "+ response.statusCode);
									console.log(body);
									return callback(false);
								}
							}
						);
					} else {
						console.log('Listing "'+ listingName +'" is not ready to be renewed');
						console.log();
					}

					if (index == activeListings.length - 1) {
						// We are done
						return callback(true); 
					}
				});
			}
		}
	);
};