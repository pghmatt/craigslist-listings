var cheerio = require('cheerio');
var request = require('request');
var clLogin = require('./craigslist.login.json');

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

exports.renewListings = function(isRetry) {
	request(
		{
			method: "GET",
			uri: "https://accounts.craigslist.org/",
			jar: cookieJar
		},
		function(err, response, body) {
			if (err) return next(err);
			var $ = cheerio.load(body);

			var loginForm = $("form[name='login']");

			var notLoggedIn = $("body.login");
			console.log("- Not logged in?", !!notLoggedIn);

			if (notLoggedIn) {
				if (isRetry) {
					return false;
				}

				var form = loginForm.first();

				var emailField = form.find("input[name='inputEmailHandle']");
				var passwordField = form.find("input[name='inputPassword']");

				emailField.val(email);
				passwordField.val(password);

				var formObject = createFormObject($, form);

				console.log("- Submitting login form with object:", formObject);
				request.post(form.attr("action"), { form: formObject, followAllRedirects: true },
					function(err, response, body) {
						if(response.statusCode >= 200 && response.statusCode < 300){
							console.log('- Successfully logged in');

							exports.renewListings(true); // request the page again now that we are logged in
						} else {
							console.log('- Error submitting login form: '+ response.statusCode);
							console.log(body);
							return false;
						}
					}
				);
			} else {
				var postingsTable = $("table[summary='postings']");
				var activeListings = postingsTable.children().first().children()
										.filter(function(index) {
											return !!($(this).find("td[class='status']:contains('Active')").first());
										});
				activeListings.each(function() {
					var listingName = $(this).find("td[class='title']").first().children().first().text();
					var renewForm = $(this).find("td[class='buttons']").first().find("form[method='POST']:contains('renew')").first();
					if (renewForm) {
						var formObject = createFormObject($, renewForm);
						console.log("- Submitting renewal form with object:", formObject);
						/*
						request.post(form.attr("action"), { form: formObject, followAllRedirects: true },
							function(err, response, body) {
								if (response.statusCode >= 200 && response.statusCode < 300){
									
									console.log();
									console.log('Successfully renewed listing '+ listingName);
									console.log();
								} else {
									console.log('- Error submitting renewal form: '+ response.statusCode);
									console.log(body);
									return false;
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

	return true;
};