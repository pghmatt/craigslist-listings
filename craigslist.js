var cheerio = require('cheerio');
var request = require('request');
var clLogin = require('./craigslist.login.js');

var email = clLogin.email;
var password = clLogin.password;

var cookieJar = request.jar(); // enable cookies
request.defaults({
	headers: {
		// spoof the user agent
		'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/32.0.1664.3 Safari/537.36'
	}
});

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
			if (err) return next(err);
			var $ = cheerio.load(body);

			console.log('Cookie jar:', cookieJar);

			var loginForm = $("form[name='login']");

			var notLoggedIn = !!($("body.login").length);
			console.log("- Not logged in?", !!notLoggedIn);

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
				request.post(form.attr("action"), { form: formObject, followAllRedirects: true },
					function(err, response, body) {
						if(response.statusCode >= 200 && response.statusCode < 300){
							console.log('- Successfully logged in ('+response.statusCode+'). Cookie jar:', cookieJar);

							exports.renewListings(function(){}, true); // request the page again now that we are logged in
						} else {
							console.log('- Error submitting login form: '+ response.statusCode);
							console.log(body);
							return callback(false);
						}
					}
				);
			} else {
				var postingsTable = $("table[summary='postings']");
				var activeListings = postingsTable.children().first().children()
										.filter(function(index) {
											return !!($(this).find("td[class='status']:contains('Active')")[0]);
										});
				activeListings.each(function() {
					var listingName = $(this).find("td[class='title']:first").children().first().text();
					var renewForm = $(this).find("td[class='buttons']:first").find("form[method='POST']:contains('renew')").first();
					if (renewForm.length) {
						var formObject = createFormObject($, renewForm);
						console.log("- Submitting renewal form with object:", formObject);
						/*
						request.post(form.attr("action"), { form: formObject, followAllRedirects: true },
							function(err, response, body) {
								if (response.statusCode >= 200 && response.statusCode < 300){
									
									console.log();
									console.log('Successfully renewed listing '+ listingName);
									console.log();
									// if last one return callback(true); // TODO use async lib here
								} else {
									console.log('- Error submitting renewal form: '+ response.statusCode);
									console.log(body);
									return callback(false);
								}
							}
						);
						*/
					} else {
						console.log();
						console.log('Listing '+ listingName +' is not ready to be renewed');
						console.log();
					}
				});
			}
		}
	);
};