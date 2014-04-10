var craigslist = require("./craigslist");

craigslist.renewListings(function(didSucceed) {
	console.log("Done. Success =", didSucceed);
});