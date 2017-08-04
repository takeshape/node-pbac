'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var conditions = require('./conditions');
var ensureArray = require('./util/ensure-array');

var isPlainObject = require('lodash/isPlainObject');
var isBoolean = require('lodash/isBoolean');
var isUndefined = require('lodash/isUndefined');
var isEmpty = require('lodash/isEmpty');
var forEach = require('lodash/forEach');
var every = require('lodash/every');
var get = require('lodash/get');

var flow = require('lodash/fp/flow');
var map = require('lodash/fp/map');
var flatten = require('lodash/fp/flatten');
var find = require('lodash/fp/find');

function getVariableValue(variable, variables) {
  var parts = variable.split(':');
  if (isPlainObject(variables[parts[0]]) && !isUndefined(variables[parts[0]][parts[1]])) return variables[parts[0]][parts[1]];else return variable;
}

var PBAC = function () {
  function PBAC(policies, options) {
    _classCallCheck(this, PBAC);

    options = isPlainObject(options) ? options : {};

    this.policies = [];
    this.conditions = isPlainObject(options.conditions) ? Object.assign(options.conditions, conditions) : conditions;
    this.add(policies);
  }

  _createClass(PBAC, [{
    key: 'add',
    value: function add(policies) {
      this.policies.push.apply(this.policies, ensureArray(policies));
    }
  }, {
    key: 'evaluate',
    value: function evaluate(options) {
      options = Object.assign({
        action: '',
        resource: '',
        principal: {},
        variables: {}
      }, options || {});
      if (this.filterPoliciesBy({
        effect: 'Deny',
        resource: options.resource,
        action: options.action,
        variables: options.variables,
        principal: options.principal
      })) return false;
      return this.filterPoliciesBy({
        effect: 'Allow',
        resource: options.resource,
        action: options.action,
        variables: options.variables,
        principal: options.principal
      });
    }
  }, {
    key: 'filterPoliciesBy',
    value: function filterPoliciesBy(options) {
      var _this = this;

      return flow(map('Statement'), flatten, find(function (statement) {
        if (statement.Effect !== options.effect) return false;
        if (statement.Principal && !_this.evaluatePrincipal(statement.Principal, options.principal, options.variables)) return false;
        if (statement.NotPrincipal && _this.evaluateNotPrincipal(statement.NotPrincipal, options.principal, options.variables)) return false;
        if (statement.Resource && !_this.evaluateResource(statement.Resource, options.resource, options.variables)) return false;
        if (statement.NotResource && _this.evaluateResource(statement.NotResource, options.resource, options.variables)) return false;
        if (statement.Action && !_this.evaluateAction(statement.Action, options.action)) return false;
        if (statement.NotAction && _this.evaluateAction(statement.NotAction, options.action)) return false;
        return _this.evaluateCondition(statement.Condition, options.variables);
      }))(this.policies);
    }
  }, {
    key: 'interpolateValue',
    value: function interpolateValue(value, variables) {
      return value.replace(/\${(.+?)}/g, function (match, variable) {
        return getVariableValue(variable, variables);
      });
    }
  }, {
    key: 'evaluateNotPrincipal',
    value: function evaluateNotPrincipal(principals, reference) {
      var _this2 = this;

      return Object.keys(reference).find(function (key) {
        return _this2.conditions['ForAllValues:StringEquals'].call(_this2, principals[key], reference[key]);
      });
    }
  }, {
    key: 'evaluatePrincipal',
    value: function evaluatePrincipal(principals, reference) {
      var _this3 = this;

      return Object.keys(reference).find(function (key) {
        if (isEmpty(reference[key])) return false;
        return _this3.conditions['ForAnyValue:StringEquals'].call(_this3, principals[key], reference[key]);
      });
    }
  }, {
    key: 'evaluateAction',
    value: function evaluateAction(actions, reference) {
      var _this4 = this;

      return actions.find(function (action) {
        return _this4.conditions.StringLike.call(_this4, reference, action);
      });
    }
  }, {
    key: 'evaluateResource',
    value: function evaluateResource(resources, reference, variables) {
      var _this5 = this;

      return ensureArray(resources).find(function (resource) {
        var value = _this5.interpolateValue(resource, variables);
        return _this5.conditions.StringLike.call(_this5, reference, value);
      });
    }
  }, {
    key: 'evaluateCondition',
    value: function evaluateCondition(condition, variables) {
      var _this6 = this;

      if (!isPlainObject(condition)) return true;
      var conditions = this.conditions;
      return every(Object.keys(condition), function (key) {
        var expression = condition[key];
        var variable = Object.keys(expression)[0];
        var values = ensureArray(expression[variable]);

        var prefix = void 0;
        if (key.indexOf(':') !== -1) {
          prefix = key.substr(0, key.indexOf(':'));
        }
        if (prefix === 'ForAnyValue' || prefix === 'ForAllValues') {
          return conditions[key].call(_this6, getVariableValue(variable, variables), values);
        } else {
          return values.find(function (value) {
            return conditions[key].call(_this6, getVariableValue(variable, variables), value);
          });
        }
      });
    }
  }]);

  return PBAC;
}();

module.exports = PBAC;