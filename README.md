
# craigslist-listings

A tool for managing your account and listings on Craigslist.

Tired of having to remember to log in every 48 hours just so you can click the "renew" button for your listing? Why not use a tool to do it for you?

## Introduction

```js
var craigslist = require('craigslist-listings');

craigslist.login({
	email: "foo@bar.com",
	password: "myPassword"
});

craigslist.renewListings(function(err, renewed) {
	if (err) next(err);
	console.log("Done. Renewed the following listings:", renewed);
});
```

## Installation
`npm install craigslist-account`

## API

### Options

All options can be set as either global defaults (via the `defaults()` method), or on a per-call basis (via the optional first parameter of any method).

Right now the only options are the following:
```js
var craigslist = require('craigslist-listings');
craigslist.defaults({
	autoLogin: true,		// If set to true then all requests will log you in automatically (if needed) using the following global options:
	email: "foo@bar.com",	// CL login email
	password: "myPassword"	// CL login password
});
```

### Renew listings

You can [renew all of your listings that are able to be renewed](http://www.craigslist.org/about/help/repost) by calling one method. Craigslist allows you to renew each listing once every 48 hours, so I recommend running this method periodically (as a [cron task](http://en.wikipedia.org/wiki/Cron), for example) to keep all listings fresh.
```js
var craigslist = require('craigslist-listings');
craigslist.renewListings(options, function(err, renewed) {
	if (err) next(err);
	console.log("Done. Renewed the following listings:", renewed);
});
```
## Upcoming features
- Delete listings
- Repost listings (?)
- Test coverage

## License

(The MIT License)

Copyright (c) 2014 David Idol &lt;david.idol@gmail.com&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
