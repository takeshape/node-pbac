'use strict';
const ipcheck = require('ipcheck');
const bufferEquals = require('./util/bufferequals');

const isString = require('lodash/isString');
const isBoolean = require('lodash/isBoolean');
const isNumber = require('lodash/isNumber');
const isArray = require('lodash/isArray');
const isUndefined = require('lodash/isUndefined');
const isEmpty = require('lodash/isEmpty');
const forEach = require('lodash/forEach');
const every = require('lodash/every');

const equal = (a, b) => a === b;
const notEqual = (a, b) => a !== b;
const lessThan = (a, b) => a < b;
const lessThanEqual = (a, b) => a <= b;
const greaterThan = (a, b) => a > b;
const greaterThanEqual = (a, b) => a >= b;

function dateCondition(compare) {
  return (a, b) => {
    const timeA = Date.parse(a);
    if (!timeA) {
      return false;
    }
    const timeB = Date.parse(b);
    if (!timeB) {
      return false;
    }
    return compare(timeA, timeB);
  };
}

function numericCondition(compare) {
  return (a, b) => isNumber(a) && isNumber(b) && compare(a, b);
}

function stringLike(a, b) {
  return new RegExp('^' +
    b.replace(/[\-\[\]\/\{\}\(\)\+\.\\\^\$\|]/g, "\\$&")
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.') + '$')
    .test(a);
}

const conditions = {
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
  BinaryEquals(a, b) {
    return isString(b) && a instanceof Buffer && bufferEquals(a, new Buffer(b, 'base64'));
  },
  BinaryNotEquals(a, b) {
    return isString(b) && a instanceof Buffer && !bufferEquals(a, new Buffer(b, 'base64'));
  },
  /*
  ArnEquals
  ArnNotEquals
  ArnLike
  ArnNotLike
  */
  Null(a, b) {
    if (!isBoolean(b)) return false;
    return b ? isUndefined(a) : !isUndefined(a);
  },
  IpAddress(a, b) {
    return ipcheck.match(a, b);
  },
  NotIpAddress() {
    return !ipcheck.match(a, b);
  },
  StringEquals(a, b) {
    return isString(a) && isString(b) && a === b;
  },
  StringNotEquals(a, b) {
    return isString(a) && isString(b) && a !== b;
  },
  StringEqualsIgnoreCase(a, b) {
    return isString(a) && isString(b) && a.toLowerCase() === b.toLowerCase();
  },
  StringNotEqualsIgnoreCase(a, b) {
    return isString(a) && isString(b) && a.toLowerCase() !== b.toLowerCase();

  },
  StringLike(a, b) {
    return isString(b) && stringLike(a, b);
  },
  StringNotLike(a, b) {
    return isString(b) && !stringLike(a, b);
  },
  Bool(a, b) {
    return isBoolean(a) && isBoolean(b) && a === b;
  },
};

forEach(conditions, function(fn, condition) {
  conditions[condition + 'IfExists'] = function(a, b) {
    return isUndefined(a) || fn.apply(this, arguments);
  };
  conditions['ForAllValues:' + condition] = function(a, b) {
    if (!isArray(a)) a = [a];
    return every(a, value => {
      return b.find(key => {
        return fn.call(this, value, key);
      });
    });
  };
  conditions['ForAnyValue:' + condition] = function(a, b) {
    if (!isArray(a)) a = [a];
    return a.find(value => {
      return b.find(key => {
        return fn.call(this, value, key);
      });
    });
  };

});

module.exports = conditions;
