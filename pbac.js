'use strict';
const policySchema = require('./schema.json');
const conditions = require('./conditions');
const ZSchema = require('z-schema');
const util = require('util');

const isPlainObject = require('lodash/isPlainObject');
const isBoolean = require('lodash/isBoolean');
const isArray = require('lodash/isArray');
const isUndefined = require('lodash/isUndefined');
const isEmpty = require('lodash/isEmpty');
const forEach = require('lodash/forEach');
const every = require('lodash/every');
const get = require('lodash/get');

const flow = require('lodash/fp/flow');
const map = require('lodash/fp/map');
const flatten = require('lodash/fp/flatten');
const find = require('lodash/fp/find');

const PBAC = function constructor(policies, options) {
  options = isPlainObject(options) ? options : {};
  const myconditions = isPlainObject(options.conditions) ? Object.assign(options.conditions, conditions) : conditions;

  this.policies = [];
  this.validateSchema = isBoolean(options.validateSchema) ? options.validateSchema : true;
  this.validatePolicies = isBoolean(options.validatePolicies) ? options.validatePolicies : true;
  this.schema = isPlainObject(options.schema) ? options.schema : policySchema;
  this.conditions = myconditions;

  this.addConditionsToSchema();
  if (this.validateSchema) this._validateSchema();
  this.add(policies);
};

Object.assign(PBAC.prototype, {
  add: function add(policies) {
    policies = isArray(policies) ? policies : [policies];
    if (this.validatePolicies) this.validate(policies);
    this.policies.push.apply(this.policies, policies);
  },
  addConditionsToSchema: function addConditionsToSchema() {
    const definition = get(this.schema, 'definitions.Condition');
    if (!definition) return;
    const props = definition.properties = {};
    forEach(this.conditions, function(condition, name) {
      props[name] = {
        type: 'object'
      };
    }, this);
  },
  _validateSchema() {
    const validator = new ZSchema();
    if (!validator.validateSchema(this.schema))
      this.throw('schema validation failed with', validator.getLastError());
  },
  validate(policies) {
    policies = isArray(policies) ? policies : [policies];
    const validator = new ZSchema({
      noExtraKeywords: true,
    });
    return every(policies, policy => {
      const result = validator.validate(policy, this.schema);
      if (!result)
        this.throw('policy validation failed with', validator.getLastError());
      return result;
    });
  },
  evaluate(options) {
    options = Object.assign({
      action: '',
      resource: '',
      principal: {},
      variables: {},
    }, options || {});
    if (this.filterPoliciesBy({
        effect: 'Deny',
        resource: options.resource,
        action: options.action,
        variables: options.variables,
        principal: options.principal,
      })) return false;
    return this.filterPoliciesBy({
      effect: 'Allow',
      resource: options.resource,
      action: options.action,
      variables: options.variables,
      principal: options.principal,
    });
  },
  filterPoliciesBy(options) {
    return flow(
      map('Statement'),
      flatten,
      find(statement => {
        if (statement.Effect !== options.effect) return false;
        if (statement.Principal && !this.evaluatePrincipal(statement.Principal, options.principal, options.variables))
          return false;
        if (statement.NotPrincipal && this.evaluateNotPrincipal(statement.NotPrincipal, options.principal, options.variables))
          return false;
        if (statement.Resource && !this.evaluateResource(statement.Resource, options.resource, options.variables))
          return false;
        if (statement.NotResource && this.evaluateResource(statement.NotResource, options.resource, options.variables))
          return false;
        if (statement.Action && !this.evaluateAction(statement.Action, options.action))
          return false;
        if (statement.NotAction && this.evaluateAction(statement.NotAction, options.action))
          return false;
        return this.evaluateCondition(statement.Condition, options.variables);
      })
    )(this.policies);
  },
  interpolateValue(value, variables) {
    return value.replace(/\${(.+?)}/g, (match, variable) => {
      return this.getVariableValue(variable, variables);
    });
  },
  getVariableValue(variable, variables) {
    const parts = variable.split(':');
    if (isPlainObject(variables[parts[0]]) && !isUndefined(variables[parts[0]][parts[1]]))
      return variables[parts[0]][parts[1]];
    else return variable;
  },
  evaluateNotPrincipal(principals, reference) {
    return Object.keys(reference).find(key => {
      return this.conditions['ForAllValues:StringEquals'].call(this, principals[key], reference[key]);
    });
  },
  evaluatePrincipal(principals, reference) {
    return Object.keys(reference).find(key => {
      if(isEmpty(reference[key])) return false;
      return this.conditions['ForAnyValue:StringEquals'].call(this, principals[key], reference[key]);
    });
  },
  evaluateAction(actions, reference) {
    return actions.find(action => {
      return this.conditions.StringLike.call(this, reference, action);
    });
  },
  evaluateResource(resources, reference, variables) {
    resources = isArray(resources) ? resources : [resources];
    return resources.find(resource => {
      const value = this.interpolateValue(resource, variables);
      return this.conditions.StringLike.call(this, reference, value);
    });
  },
  evaluateCondition(condition, variables) {
    if (!isPlainObject(condition)) return true;
    const conditions = this.conditions;
    return every(Object.keys(condition), key => {
      const expression = condition[key];
      const variable = Object.keys(expression)[0];
      let values = expression[variable];
      values = isArray(values) ? values : [values];

      let prefix;
      if (key.indexOf(':') !== -1) {
        prefix = key.substr(0, key.indexOf(':'));
      }
      if (prefix === 'ForAnyValue' || prefix === 'ForAllValues') {
        return conditions[key].call(this, this.getVariableValue(variable, variables), values);
      } else {
        return values.find(value => {
          return conditions[key].call(this, this.getVariableValue(variable, variables), value);
        });
      }
    });
  },
  throw(name, message) {
    const args = [].slice.call(arguments, 2);
    args.unshift(message);
    const e = new Error();
    e.name = name;
    e.message = util.format.apply(util, args);
    throw e;
  },
});

module.exports = PBAC;
