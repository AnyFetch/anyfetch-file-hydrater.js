Cluestr file hydrater
====================

Base library for file hydration on http://cluestr.com.

This library takes a path and metadatas, and returns more metadatas.

How to use?
-------------------

```javascript
'use strict';

var cluestrFileHydrater = require('cluestr-file-hydrater');

/**
 * Hydration function, to add metadatas to the document
 * 
 * @param{Object} filePath Path to the file to hydrate, downloaded for you on the filesystem
 * @param {Object} document Metadatas currently known (from previous hydraters, of from providers). Includes `binary_document_type`, `semantic_document_type` and `metadatas`.
 */
var myHydrationFunction = function(filePath, document, cb) {
  // Do stuff with the file...
  // Improve document...

  cb(err, document);
};

var config = {
  'hydrater_function': myHydrationFunction
};

var hydrationServer = cluestrFileHydrater.createServer(config);
hydrationServer.listen(8000);
```

Now you're all done! Your server is running on port 8000.
Access `/hydrate` with a standard Cluestr POST request, and start hydrating your file.

```
POST <your_url>/hydrate
  file_path: <url-file-to-hydrate>
  callback: <url-to-ping>
```

