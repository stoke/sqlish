
//
// sqlish.js - utility methods for creating SQL statements.
//
// @author: R. S. Doiel, <rsdoiel@gmail.com>
// copyright (c) 2012 all rights reserved
//
// Released under the Simplified BSD License.
// See: http://opensource.org/licenses/bsd-license.php
//
//
/*jslint devel: true, node: true, maxerr: 50, indent: 4, vars: true, sloppy: true */

(function (self) {
    var Dialect = {
            SQL92: "SQL 1992",
            /*
            SQL99: "SQL 1999",
            SQL03: "SQL 2003",
            */
            MySQL55: "MySQL 5.5",
            PostgreSQL92: "PostgreSQL 9.2",
            SQLite3: "SQLite 3"
        },
        Sql;

    Sql = function (config) {
        var sql = {
            dialect: Dialect.SQL92,
            use_UTC: false,
            sql: {},
            eol: ";"
        }, key;

        if (config !== undefined) {
            // Mongo 2.2's shell doesn't support Object.keys()
            for (key in config) {
                if (config.hasOwnProperty(key) && typeof config[key] !== "function") {
					sql[key] = config[key];
                }
            }
        }
    

        // Build an appropriate data string
        // from a JavaScript Date object.
        var sqlDate = function (d, use_UTC) {
            if (d === undefined) {
                d = new Date();
            } else if (typeof d === "string") {
                d = new Date(d);
            }
            
            if (use_UTC === undefined) {
                use_UTC = sql.use_UTC;
            }
            
            if (use_UTC === true) {
                if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 &&
                        d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0) {
                    return [
                        d.getUTCFullYear(),
                        ("0" + (d.getUTCMonth() + 1)).substr(-2),
                        ("0" + d.getUTCDate()).substr(-2)
                    ].join("-");
                }
                return [
                    d.getUTCFullYear(),
                    "-",
                    ("0" + (d.getUTCMonth() + 1)).substr(-2),
                    "-",
                    ("0" + d.getUTCDate()).substr(-2),
                    " ",
                    d.getUTCHours(),
                    ":",
                    d.getUTCMinutes(),
                    ":",
                    d.getUTCSeconds()
                ].join("");
            }

            if (d.getHours() === 0 && d.getMinutes() === 0 &&
                    d.getSeconds() === 0 && d.getMilliseconds() === 0) {
                return [
                    d.getFullYear(),
                    ("0" + (d.getMonth() + 1)).substr(-2),
                    ("0" + d.getDate()).substr(-2)
                ].join("-");
            }
            return [
                d.getFullYear(),
                "-",
                ("0" + (d.getMonth() + 1)).substr(-2),
                "-",
                ("0" + d.getDate()).substr(-2),
                " ",
                ("0" + d.getHours()).substr(-2),
                ":",
                ("0" + d.getMinutes()).substr(-2),
                ":",
                ("0" + d.getSeconds()).substr(-2)
            ].join("");
        };
        
        // Return s as a safe variable, table or coloumn name
        var safeName = function (s, options) {
            var re_terms = ["[", "^a-zA-Z0-9_"], re;
            if (options !== undefined) {
                if (options.period !== undefined &&
                        options.period === true) {
                    re_terms.push("\\.");
                }
                if (options.parenthesis !== undefined &&
                        options.parenthesis === true) {
                    re_terms.push("\\(\\)");
                }
                if (options.asterisk !== undefined &&
                        options.asterisk === true) {
                    re_terms.push("\\*");
                }
                if (options.at_sign !== undefined &&
                        options.at_sign === true) {
                    re_terms.push("@");
                }
                if (options.dollar_sign !== undefined &&
                        options.dollar_sign === true) {
                    re_terms.push("\\$");
                }
            }
            re_terms.push("]");
            re = new RegExp(re_terms.join(""), "g");
            //console.log("DEBUG", re, s);
            return s.replace(new RegExp(re_terms.join(""), "g"), "");
        };

        // Return s as a double quoted string
        // safely escaped.
        var safely = function (s) {
            if (s === undefined || s === null) {
                return 'NULL';
            }

            switch (typeof s) {
            case 'boolean':
                if (s === true) {
                    return 'true';
                } else {
                    return 'false';
                }
            case 'number':
                return s;
            case 'string':
                s = s.trim();
                if (s.substr(0, 1) === '@') {
                    return safeName(s, {at_sign: true}).trim();
                }
                if (s === "" || s === '""') {
                    return '""';
                }
                return [
                    '"',
                    s.replace(/[\0\n\r\b\t\\\'\"\x1a]/g, function (c) {
                        switch (c) {
                        case "\0":
                            return "\\0";
                        case "\n":
                            return "\\n";
                        case "\r":
                            return "\\r";
                        case "\b":
                            return "\\b";
                        case "\t":
                            return "\\t";
                        case "\x1a":
                            return "\\Z";
                        case "'":
                            if (this.dialect === Dialect.SQLite3) {
                                // SQLite single-quote escaping.
                                return "''";
                            }
                            return "\\" + c;
                        default:
                            return "\\" + c;
                        }
                    }).trim(),
                    '"'
                ].join("");
            }

            if (s instanceof Date) {
                return '"' + sqlDate(s) + '"';
            }
            throw ["injection error:", s].join(" ");
        };

        var firstKey = function (obj) {
            var ky;
            if (typeof obj === "object") {
                for (ky in obj) {
                    if (obj.hasOwnProperty(ky)) {
                        return ky;
                    }
                }
            }
            return false;
        };
        
        var re2SQLWildcard = function (re) {
            var s = re.toString();
            // Trim the first and last slash
            s = s.substr(1, s.length - 2);
            // replace * with %
            s = s.replace(/\*/g, '%');
            if (s.indexOf('^') === 0 && s.indexOf('$') === (s.length - 1)) {
                return s.substr(1, s.length - 2);
            } else if (s.indexOf('^') === 0) {
                return s.substr(1).replace(/\s+$/, '') + '%';
            } else if (s.indexOf('$') === (s.length - 1)) {
                return '%' + s.substr(0, s.length - 1).replace(/^\s+/, '');
            } else if (s.indexOf('^') === -1 && s.indexOf('$') === -1) {
                return '%' + s + '%'
            }
            return s;
        };
        
        var expr = function (obj) {
            var options = {
                    period: true,
                    dollar_sign: true
                },
                ky = firstKey(obj), 
                vals;

            if (ky === false || ky !== safeName(ky, options)) {
                throw "injection error: " + obj +
                    " should be an object literal";
            }
             
            // Does key begin with $eq, $ne, $gt, $gte, $lt, $lte,
            // $or, $and
            if (ky.substr(0,1) ===  "$") {
                switch(ky) {
                case '$eq':
                    /* if (typeof obj[ky] === "object") {
                        return ["=", expr(obj[ky])].join(" ");
                    }*/

                    if (Array.isArray(obj[ky])) {
                        return obj[ky].map(function (v) {
                            return safely(v);
                        });
                    } 
                    return ["=", safely(obj[ky])].join(" ");
                case '$ne':
                    if (typeof obj[ky] === "object") {
                        return ["!=", expr(obj[ky])].join(" ");
                    }
                    return ["!=", safely(obj[ky])].join(" ");
                case '$gt':
                    if (typeof obj[ky] === "object") {
                        return [">", expr(obj[ky])].join(" ");
                    }
                    return [">", safely(obj[ky])].join(" ");
                case '$gte':
                    if (typeof obj[ky] === "object") {
                        return [">=", expr(obj[ky])].join(" ");
                    }
                    return [">=", safely(obj[ky])].join(" ");
                case '$lt':
                    if (typeof obj[ky] === "object") {
                        return ["<", expr(obj[ky])].join(" ");
                    }
                    return ["<", safely(obj[ky])].join(" ");
                case '$lte':
                    if (typeof obj[ky] === "object") {
                        return ["<=", expr(obj[ky])].join(" ");
                    }
                    return ["<=", safely(obj[ky])].join(" ");
                case '$or':
                    vals = [];
                    if (obj[ky].length === undefined) {
                        throw "$or takes an array of objects as the value";
                    }
                    for (i = 0; i < obj[ky].length; i += 1) {
                        vals.push(expr(obj[ky][i]));
                    }
                    return vals.join(" OR ");
                case '$and':
                    vals = [];
                    if (obj[ky].length === undefined) {
                        throw "$and takes an array of objects as the value";
                    }
                    for (i = 0; i < obj[ky].length; i += 1) {
                        vals.push(expr(obj[ky][i]));
                    }
                    return vals.join(" AND ");
                case '$like':
                    if (typeof obj[ky] === "object") {
                        if (obj[ky] instanceof RegExp) {
                            return "LIKE " + 
                                safely(re2SQLWildcard(obj[ky]));
                        } else {
                            throw "$like takes a value that is of type string or number";
                        }
                    }

                    return "LIKE " + safely(obj[ky]);
                default:
                    throw [ky, "not supported"].join(" ");
                }
            } else if (typeof obj[ky] === "object") {
                var clause = expr(obj[ky]);

                if (Array.isArray(clause)) {
                    return '(' + clause.map(function (v) {
                      return [ky, v].join(" = "); 
                    }).join(" OR ") + ')';
                }

                return [ky, expr(obj[ky])].join(" ");
            } else {
            }
            return [ky, safely(obj[ky])].join(" = ");
        };

        var P = function (expression) {
            return ["(", expr(expression), ")"].join("");        
        };


        sql.sqlDate = sqlDate;
        sql.safely = safely;
        sql.safeName = safeName;
        sql.expr = expr;
        sql.P = P;

        sql.insert = function (tableName, obj) {
            var fields = [], values = [], ky,
                options = {period: true};

            if (tableName !== safeName(tableName)) {
                tableName = safeName(tableName, options);
            }

 			// Mongo 2.2's shell doesn't support Object.keys()
            for (ky in obj) {
                if (obj.hasOwnProperty(ky) && typeof ky === "string") {
                    if (ky !== safeName(ky, options)) {
                        throw ["injection error:", ky].join(" ");
                    }
                    ky = safeName(ky, options);
                    fields.push(ky);
                    values.push(safely(obj[ky]));
                }
            }

            // Reset this inner sql object since this is a verb
            this.sql = {};
            this.sql.verb = "INSERT INTO " + tableName;
            this.sql.columns = fields.join(", ");
            this.sql.values = values.join(", ");
            return this;
        };
    
        sql.replace = function (tableName, obj) {
            var fields = [], values = [], ky,
                options = {period: true};

            if (this.dialect === Dialect.PostgreSQL92) {
                throw "PostpreSQL 9.2 does not support replace";
            }
            if (tableName !== safeName(tableName)) {
                tableName = safeName(tableName, options);
            }

			// Mongo 2.2's shell doesn't support Object.keys()
            for (ky in obj) {
                if (obj.hasOwnProperty(ky) && typeof ky === "string") {
                    if (ky !== safeName(ky, options)) {
                        throw ["injection error:", ky].join(" ");
                    }
                    ky = safeName(ky, options);
                    fields.push(ky);
	                values.push(safely(obj[ky]));
                }
            }

            // Reset this inner sql object since this is a verb
            this.sql = {};
            this.sql.verb = "REPLACE INTO " + tableName;
            this.sql.columns = fields.join(", ");
            this.sql.values = values.join(", ");
            return this;
        };
        
        // Select options.    
        sql.select = function (fields) {
            var i, s, options = {period: true, parenthesis: true, asterisk: true};
    
            if (fields === undefined) {
                s = "SELECT *";
            } else if (typeof fields === "string") {
                if (safeName(fields, options) !== fields) {
                    throw ["injection error: ", fields].join("");
                }
                s = "SELECT " + safeName(fields, options);
            } else {
                for (i = 0; i < fields.length; i += 1) {
                    if (safeName(fields[i], options) !== fields[i]) {
                        throw "injection error: " + fields[i];
                    }
                    fields[i] = safeName(fields[i], options);
                }
                s = "SELECT " + fields.join(", ");
            }

            // Reset this inner sql object since this is a verb
            this.sql = {};
            this.sql.verb = s;
            return this;
        };
    
        sql.from = function (tables) {
            var i;
            if (typeof tables === "string") {
                if (safeName(tables) !== tables) {
                    throw ["injection error:", tables].join(" ");
                }
                this.sql.from = "FROM " + safeName(tables);
            } else {
                for (i = 0; i < tables.length; i += 1) {
                    if (safeName(tables[i]) !== tables[i]) {
                        throw "injection error: " + tables[i];
                    }
                    tables[i] = safeName(tables[i]);
                }
                this.sql.from = "FROM " + tables.join(", ");
            }
            return this;
        };
    
        sql.joinOn = function (tables, expression) {
            var i;
            if (typeof tables === "string") {
                if (safeName(tables) !== tables) {
                    throw ["injection error:", tables].join(" ");
                }
                this.sql.joinOn = " JOIN " + safeName(tables);
            } else {
                for (i = 0; i < tables.length; i += 1) {
                    if (safeName(tables[i]) !== tables[i]) {
                        throw "injection error: " + tables[i];
                    }
                    tables[i] = safeName(tables[i]);
                }
                this.sql.joinOn = " JOIN " + tables.join(", ");
            }
            this.sql.joinOn += " ON " + expr(expression);
            return this;
        };

        sql.where = function (expression) {
            this.sql.where = "WHERE " + sql.expr(expression);
            return this;
        };

        sql.limit = function (index, count) {
            if (typeof index !== "number") {
                throw ["injection error:", index].join(" ");
            }
            if (count === undefined || count === null) {
                this.sql.limit = "LIMIT " + index;
            } else {
                if (typeof count !== "number") {
                    throw ["injection error:", count].join(" ");
                }
                this.sql.limit = "LIMIT " + index + "," + count;
            }
            return this;
        };

        sql.orderBy = function (fields, direction) {
            var i, options = {period: true};
            if (typeof fields === "string") {
                if (fields !== safeName(fields, options)) {
                    throw ["injection error:", fields].join(" ");
                }
                this.sql.orderBy = "ORDER BY " + fields;
            } else {
                for (i = 0; i < fields.length; i += 1) {
                    if (fields[i] !== safeName(fields[i], options)) {
                        throw ["injection error:", fields].join(" ");
                    }
                    fields[i] = safeName(fields[i], options);
                }
                this.sql.orderBy = "ORDER BY " + fields.join(", ");
            }
            if (direction === undefined || direction === null) {
                return this;
            } else if (direction.toUpperCase() === "ASC" || direction >= 0) {
                this.sql.orderBy += " ASC";
            } else if (direction.toUpperCase() === "DESC" || direction < 0) {
                this.sql.orderBy += " DESC";
            }
            return this;
        };
    
        sql.groupBy = function (fields) {
            var i, options = {period: true};

            if (typeof fields === "string") {
                if (fields !== safeName(fields, options)) {
                    throw ["injection error:", fields].join(" ");
                }
                this.sql.groupBy = "GROUP BY " + fields;
            } else {
                for (i = 0; i < fields.length; i += 1) {
                    if (fields[i] !== safeName(fields[i], options)) {
                        throw ["injection error:", fields].join(" ");
                    }
                    fields[i] = safeName(fields[i], options);
                }
                this.sql.groupBy = "GROUP BY " + fields.join(", ");
            }
            return this;
        };
        
        // Do a MySQL SET, e.g. SET @my_count = 0;
        // Or add a SET pharse to an UPDATE statement.
        sql.set = function (name, value) {
            var ky, i, options = {
                    period: true,
                    at_sign: true,
                };

            if (this.sql.verb.indexOf("UPDATE") === 0) {
                if (typeof name === "string") {
                    this.sql.set = "SET " + safeName(name) +
                        " = " + safely(value);
                } else if (typeof name === "object") {
                    i = 0;
                    this.sql.set = "SET ";
                    for (ky in name) {
                        if (name.hasOwnProperty(ky)) {
                            if (i > 0) {
                                this.sql.set += ", ";
                            }
                            i += 1;
                            this.sql.set += safeName(ky) +
                                " = " + safely(name[ky]);
                        }
                    }
                } else {
                    throw "Cannot add " + name + " to " + this.sql;
                }
            } else {
                if (this.dialect === Dialect.SQLite3) {
                    throw Dialect.SQLite3 + " does not support SET and @varname constructs";
                }
                if (safeName(name))
                this.sql = {};
                if (this.dialect === Dialect.MySQL55) {
                    this.sql.verb = "SET @" + safeName(name);
                } else {
                    this.sql.verb = "SET " + safeName(name);
                }
                if (String(value).toUpperCase() === "LAST_INSERT_ID()") {
                    // FIXME: Need to support other functions
                    this.sql.verb += " = LAST_INSERT_ID()";
                } else {
                    this.sql.verb += " = " + safely(value);
                }
            }
            return this;
        };
        
        sql.into = function (fields) {
            var i, options = {period: true, at_sign: true};
            // support for generating SQLite dialect quoting
            if (this.dialect === Dialect.SQLite3) {
                throw "INTO not supported by " + Dialect.SQLite3;
            }
            if (typeof fields === "string") {
                if (fields !== safeName(fields, options)) {
                    throw ["injection error:", fields].join(" ");
                }
                this.sql.into = "INTO " + fields;
            } else {
                for (i = 0; i < fields.length; i += 1) {
                    if (fields[i] !== safeName(fields[i], options)) {
                        throw ["injection error:", fields].join(" ");
                    }
                    fields[i] = safeName(fields[i], options);
                }
                this.sql.into = "INTO " + fields.join(", ");
            }
            return this;
        };
        
        sql.valueOf = function () {
            return this.sql;
        };
        
        var defColumns = function (column_defs) {
            var ky, src = [], def, clause;
            for (ky in column_defs) {
                if (ky !== safeName(ky)) {
                    throw "injection error: " + column_defs;
                }
                clause = [];
                def = column_defs[ky];
                switch(def.type.toUpperCase()) {
                case 'INTEGER':
                case 'INT':
                    clause = [def.type];
                    if (def.auto_increment === true) {
                        clause.push("AUTO_INCREMENT");
                    }
                    if (def.primary_key === true) {
                        clause.push("PRIMARY KEY");
                    }
                    break;
                case 'VARCHAR':
                case 'CHAR':
                    if (def.length !== undefined) {
                        clause.push(def.type + "(" + def.length + ")");
                    }
                    break;
                case 'DATE':
                case 'TIME':
                case 'DATETIME':
                case 'TIMESTAMP':
                case 'TINYTEXT':
                case 'TEXT':
                case 'MEDIUMTEXT':
                case 'LONGTEXT':
                case 'TINYBLOB':
                case 'BLOB':
                case 'MEDIUMBLOB':
                case 'LONGBLOB':
                    clause = [def.type];
                    break;
                default:
                    throw ky + " of " + def.type + " not supported";
                }
                if (def.default === true) {
                    clause.push("DEFAULT " + safely(def.default));
                }
                if (def.not_null === true) {
                    clsuse.push("NOT NULL");
                }
                src.push(ky + " " + clause.join(" "));
            }
            
            return src.join(", ");
        };
    
        sql.toString = function (eol) {
            var verb, src = [];
        
            if (this.sql.verb === undefined ||
                    this.sql.verb === undefined ||
                    this.sql.verb.indexOf === undefined) {
                console.error("DEBUG", this.sql);
            }

            if (this.sql.verb.indexOf(" ") >= 0) {
                verb = this.sql.verb.substr(0, this.sql.verb.indexOf(" "));
            }

            switch (verb) {
            case 'CREATE':
                src.push(this.sql.verb);
                if (this.sql.verb.indexOf("CREATE TABLE") === 0) {
                    src.push("(" + defColumns(this.sql.columns) + ")");
                } else if (this.sql.verb.indexOf("CREATE INDEX") === 0 ||
                    this.sql.verb.indexOf("CREATE UNIQUE INDEX") === 0) {
                    src.push("ON " + this.sql.table + " (" +
                        this.sql.columns.join(", ") + ")");
                } else if (this.sql.verb.indexOf("CREATE VIEW") === 0) {
                    src.push((this.sql.as).toString(""));
                }
                break;
            case 'DROP':
                src.push(this.sql.verb);
                break;
            case 'SELECT':
                src.push(this.sql.verb);
                if (this.sql.from !== undefined) {
                    src.push(this.sql.from);
                }
                if (this.sql.joinOn !== undefined) {
                    src.push(this.sql.joinOn);
                }
                if (this.sql.where !== undefined) {
                    src.push(this.sql.where);
                }
                if (this.sql.groupBy !== undefined) {
                    src.push(this.sql.groupBy);
                }
                if (this.sql.orderBy !== undefined) {
                    src.push(this.sql.orderBy);
                }
                if (this.sql.limit !== undefined) {
                    src.push(this.sql.limit);
                }
                if (this.sql.offset !== undefined) {
                    src.push(this.sql.offset);
                }
                if (this.sql.into !== undefined) {
                    src.push(this.sql.into);
                }
                break;
            case 'INSERT':
            case 'REPLACE':
                src.push(this.sql.verb);
                src.push("(" + this.sql.columns + ")");
                src.push('VALUES');
                src.push("(" + this.sql.values + ")");
                break;
            case 'UPDATE':
                src.push(this.sql.verb);
                if (this.sql.set !== undefined) {
                    src.push(this.sql.set);
                }
                if (this.sql.where !== undefined) {
                    src.push(this.sql.where)
                }
                break;
            case 'DELETE':
                src.push(this.sql.verb);
                if (this.sql.where !== undefined) {
                    src.push(this.sql.where)
                }
                break;
            case 'SET':
                src.push(this.sql.verb);
                break;
            default:
                throw "Don't know how to assemble SQL statement form " + this.sql;
            }
            if (eol === undefined) {
                return src.join(" ") + this.eol;
            }
            return src.join(" ") + eol;
        };
        
        sql.deleteFrom = function (tableName) {
            this.sql = {};
            this.sql.verb = "DELETE FROM " + tableName;
            return this;
        };

        sql.update = function (tableName) {
            this.sql = {};
            this.sql.verb = "UPDATE " + tableName;
            return this;
        };
        
        sql.createTable = function (tableName, col_defs) {
            var ky, i = 0, options = {};


            if (tableName !== safeName(tableName)) {
                throw "injection error: " + tableName;
            }

            for (ky in col_defs) {
                if (col_defs.hasOwnProperty(ky)) {
                    if (ky !== safeName(ky)) {
                        throw "injection error:" + cal_defs;
                    }
                }
            }

            this.sql = {};
            this.sql.tableName = tableName;
            this.sql.verb = "CREATE TABLE " + tableName;
            this.sql.columns = col_defs;
            return this;
        };
        
        
        sql.createIndex = function (indexName, options) {
            var i;

            if (indexName !== safeName(indexName)) {
                throw "injection error:" + indexName;
            }
            this.sql = {};
            this.sql.index = indexName;

            if (options.unique !== undefined && options.unique === true) {
                this.sql.verb = "CREATE UNIQUE INDEX " + indexName;
            } else {
                this.sql.verb = "CREATE INDEX " + indexName;
            }
            
            if (options.on === undefined) {
                throw "Must define an index on something.";
            } else {
                this.sql.table = options.on.table;
                this.sql.columns = [];
                for (i = 0; i < options.on.columns.length; i += 1) {
                    this.sql.columns.push(options.on.columns[i]);
                }
            }
            
            return this;
        };
        
        sql.createView = function (viewName, sql_obj) {
            if (typeof sql_obj === "string") {
                throw ["injection error:", sql_obj].join(" ");
            }
            this.sql = {};
            this.sql.view = viewName;
            this.sql.sql_view = sql_obj;
            this.sql.verb = "CREATE VIEW " + viewName;
            // FIXME: sql_obj needs to be validated as
            // a sql_obj before calling toString().
            this.sql.as = "AS " + sql_obj.toString("");
            return this;
        };
        
        sql.dropTable = function (tableName) {
            this.sql = {};
            this.sql.verb = "DROP TABLE " + tableName;
            return this;
        };
        sql.dropIndex = function (indexName) {
            this.sql = {};
            this.sql.verb = "DROP INDEX " + indexName;
            return this;
        };
        
        sql.dropView = function (viewName) {
            this.sql = {};
            this.sql.verb = "DROP VIEW " + viewName;
            return this;
        };
 
        return sql;
    };

    // If we're running under NodeJS then export objects
    self.Dialect = Dialect;
    self.Sql = Sql;
    if (exports !== undefined) {
        exports.Dialect = Dialect;
        exports.Sql = Sql;
    }

    return self;
}(this));

