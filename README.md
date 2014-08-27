AnyFetch hydrater
====================
[![Build Status](https://travis-ci.org/AnyFetch/anyfetch-hydrater.js.png?branch=master)](https://travis-ci.org/AnyFetch/anyfetch-hydrater.js)[![Dependency Status](https://gemnasium.com/AnyFetch/anyfetch-hydrater.js.png)](https://gemnasium.com/AnyFetch/anyfetch-hydrater.js)
[![Coverage Status](https://coveralls.io/repos/AnyFetch/anyfetch-hydrater.js/badge.png?branch=master)](https://coveralls.io/r/AnyFetch/anyfetch-hydrater?branch=master)
[![NPM version](https://badge.fury.io/js/anyfetch-hydrater.png)](http://badge.fury.io/js/anyfetch-hydrater)

Base library for hydration on http://anyfetch.com.

This library allows you to create a hydrater server from a single function. Taking an optional file path and initial data, it should return improved or augmented data.

Read first
----------
To understand the role of "hydraters", read the [dedicated documentation page](http://developers.anyfetch.com/guides/using/hydrater.html).

Usage
-----

```js
'use strict';
// In path/to/my/function.js

/**
 * Hydration function, to add metadata to the document
 *
 * @param {String} filePath Path to the file from which hydrate, downloaded for you on the filesystem (or null if no file)
 * @param {Object} document Data currently known (from previous hydraters, or from providers). Always includes `document_type`, `metadata`, `data` and `actions` keys.
 * @param {Object} changes Convenience object provided with empty keys `document_type`, `metadata`, `data` and `actions`. Add your changes in there.
 * @param {Function} cb(err, changes) Call this with an error if any, or pass your changes as second parameter.
 */
module.exports = function myHydrationFunction(path, document, changes, cb)
  // Extract interesting stuff from the file or the document...
  // Improve the document...

  cb(err, changes);
};
```

And then:
```js
'use strict';

var anyfetchHydrater = require('anyfetch-hydrater');

var config = {
  'hydrater_function': 'path/to/my/function.js'
};

var hydrationServer = anyfetchHydrater.createServer(config);
hydrationServer.listen(8000);
```

You're all set! Your server is running on port 8000.
Access `/hydrate` with a standard AnyFetch `POST` request to start hydrating your file.

```
POST <your_hydrater_server_url>/hydrate
  {
    file_path: <url-file-to-hydrate>
    callback: <url-to-ping>
    document: {base document}
  }
```

> In some cases, you may want to bypass the lib and send the result yourself. The property `cb.callbackUrl` tells you where to send the data back to the client. After having sent the data, call `cb()` *without any error or document*. This will finalize hydration, clean the file and start the next task.

### Optional parameters
`createServer()` takes an object hash for argument. `hydrater_function` is mandatory, optional values includes:

* `concurrency`: max number of simultaneous calls to your hydrater function (default: 1)
* `logger`: function to use for logging. It will get called with strings when a task is started or ended, default to `console.log`.
* `errLogger`: function to use for logging errors, default to `console.warn`.

Errors
------
You may use `require('anyfetch-hydrater').HydrationError` as a special error to inform the hydration was unable to complete, and should not be tried again:

```js
var myHydrationFunction = function(filePath, document, cb) {
  // Do stuff with the file or the document...
  cb(new anyfetchHydrater.HydrationError("Corrupted file"));
};
```

For other (transient) errors, use standard `Error` objects.


### Optional env variables
* `TIMEOUT` in ms. Time to hydrate a file. After this, the process will stop the file hydration and the next file will be hydrated. Default: 60 sec.
