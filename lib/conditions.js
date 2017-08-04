'use strict';

var ipcheck = require('ipcheck');
var bufferEquals = require('./util/bufferequals');

var isString = require('lodash/isString');
var isBoolean = require('lodash/isBoolean');
var isNumber = require('lodash/isNumber');
var isArray = require('lodash/isArray');
var isUndefined = require('lodash/isUndefined');
var isEmpty = require('lodash/isEmpty');
var forEach = require('lodash/forEach');
var every = require('lodash/every');

var equal = function equal(a, b) {
  return a === b;
};
var notEqual = function notEqual(a, b) {
  return a !== b;
};
var lessThan = function lessThan(a, b) {
  return a < b;
};
var lessThanEqual = function lessThanEqual(a, b) {
  return a <= b;
};
var greaterThan = function greaterThan(a, b) {
  return a > b;
};
var greaterThanEqual = function greaterThanEqual(a, b) {
  return a >= b;
};

function dateCondition(compare) {
  return function (a, b) {
    var timeA = Date.parse(a);
    if (!timeA) {
      return false;
    }
    var timeB = Date.parse(b);
    if (!timeB) {
      return false;
    }
    return compare(timeA, timeB);
  };
}

function numericCondition(compare) {
  return function (a, b) {
    return isNumber(a) && isNumber(b) && compare(a, b);
  };
}

function stringLike(a, b) {
  return new RegExp('^' + b.replace(/[\-\[\]\/\{\}\(\)\+\.\\\^\$\|]/g, "\\$&").replace(/\*/g, '.*').replace(/\?/g, '.') + '$').test(a);
}

var conditions = {
  NumericEquals: numericCondition(equal),
  NumericNotEquals: numericCondition(notEqual),
  NumericLessThan: numericCondition(lessThan),
  NumericGreaterThanEquals: numericCondition(greaterThanEqual),
  NumericGreaterThan: numericCondition(greaterThan),
  NumericLessThanEquals: numericCondition(lessThanEqual),
  DateEquals: dateCondition(equal),
  DateNotEquals: dateCondition(notEqual),
  DateLessThan: dateCondition(lessThan),
  DateGreaterThanEquals: dateCondition(greaterThanEqual),
  DateGreaterThan: dateCondition(greaterThan),
  DateLessThanEquals: dateCondition(lessThanEqual),
  BinaryEquals: function BinaryEquals(a, b) {
    return isString(b) && a instanceof Buffer && bufferEquals(a, new Buffer(b, 'base64'));
  },
  BinaryNotEquals: function BinaryNotEquals(a, b) {
    return isString(b) && a instanceof Buffer && !bufferEquals(a, new Buffer(b, 'base64'));
  },

  /*
  ArnEquals
  ArnNotEquals
  ArnLike
  ArnNotLike
  */
  Null: function Null(a, b) {
    if (!isBoolean(b)) return false;
    return b ? isUndefined(a) : !isUndefined(a);
  },
  IpAddress: function IpAddress(a, b) {
    return ipcheck.match(a, b);
  },
  NotIpAddress: function NotIpAddress() {
    return !ipcheck.match(a, b);
  },
  StringEquals: function StringEquals(a, b) {
    return isString(a) && isString(b) && a === b;
  },
  StringNotEquals: function StringNotEquals(a, b) {
    return isString(a) && isString(b) && a !== b;
  },
  StringEqualsIgnoreCase: function StringEqualsIgnoreCase(a, b) {
    return isString(a) && isString(b) && a.toLowerCase() === b.toLowerCase();
  },
  StringNotEqualsIgnoreCase: function StringNotEqualsIgnoreCase(a, b) {
    return isString(a) && isString(b) && a.toLowerCase() !== b.toLowerCase();
  },
  StringLike: function StringLike(a, b) {
    return isString(b) && stringLike(a, b);
  },
  StringNotLike: function StringNotLike(a, b) {
    return isString(b) && !stringLike(a, b);
  },
  Bool: function Bool(a, b) {
    return isBoolean(a) && isBoolean(b) && a === b;
  }
};

forEach(conditions, function (fn, condition) {
  conditions[condition + 'IfExists'] = function (a, b) {
    return isUndefined(a) || fn.apply(this, arguments);
  };
  conditions['ForAllValues:' + condition] = function (a, b) {
    var _this = this;

    if (!isArray(a)) a = [a];
    return every(a, function (value) {
      return b.find(function (key) {
        return fn.call(_this, value, key);
      });
    });
  };
  conditions['ForAnyValue:' + condition] = function (a, b) {
    var _this2 = this;

    if (!isArray(a)) a = [a];
    return a.find(function (value) {
      return b.find(function (key) {
        return fn.call(_this2, value, key);
      });
    });
  };
});

module.exports = conditions;