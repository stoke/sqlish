//
// load-sqlish.js - A shim for JavaScript shells that are missing various features
// (e.g. Mongo's JavaScript shell is missing Object.keys())
//
// This code is derived from the documentation at the Mozilla Project
// It is included/covered under Mozilla's documentation license.
//
// See: [Object.keys()](https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/keys)
//

/*jslint devel: true, node: true, maxerr: 50, indent: 4, vars: true, sloppy: true */
if (load === undefined) {
    (function (self) {
        self.load = null;
    }(this));
}
if (exports === undefined) {
    (function (self) {
        self.exports = {};
    }(this));
}

// Mongo's shell doesn't have a keys function on object.
if (Object.keys === undefined) {
    Object.keys = (function () {
        var hasOwnProperty = Object.prototype.hasOwnProperty,
            hasDontEnumBug = !({toString: null}).propertyIsEnumerable('toString'),
            dontEnums = [
                'toString',
                'toLocaleString',
                'valueOf',
                'hasOwnProperty',
                'isPrototypeOf',
                'propertyIsEnumerable',
                'constructor'
            ],
            dontEnumsLength = dontEnums.length;
 
        return function (obj) {
            var result = [], i, prop;

            if ((typeof obj !== 'object' && typeof obj !== 'function')) {
                throw new TypeError('Object.keys called on non-object');
            }
            
            for (prop in obj) {
                if (typeof obj[prop] === "function" && hasOwnProperty.call(obj, prop)) {
                    result.push(prop);
                }
            }
                            
            if (hasDontEnumBug) {
                for (i = 0; i < dontEnumsLength; i += 1) {
                    if (hasOwnProperty.call(obj, dontEnums[i])) {
                        result.push(dontEnums[i]);
                    }
                }
            }
            return result;
        };
    }());
}

// Now that we have the objects methods we need, load sqlish
if (typeof load === "function") {
    load("./sqlish.js");
} else {
    throw "load() not a function.";
}