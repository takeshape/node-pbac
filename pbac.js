'use strict';
const conditions = require('./conditions');

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

function getVariableValue(variable, variables) {
  const parts = variable.split(':');
  if (isPlainObject(variables[parts[0]]) && !isUndefined(variables[parts[0]][parts[1]]))
    return variables[parts[0]][parts[1]];
  else return variable;
}


class PBAC {
  constructor(policies, options) {
    options = isPlainObject(options) ? options : {};

    this.policies = [];
    this.conditions = isPlainObject(options.conditions) ? Object.assign(options.conditions, conditions) : conditions;
    this.add(policies);
  }

  add(policies) {
    policies = isArray(policies) ? policies : [policies];
    this.policies.push.apply(this.policies, policies);
  }

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
  }

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
  }

  interpolateValue(value, variables) {
    return value.replace(/\${(.+?)}/g, (match, variable) => {
      return getVariableValue(variable, variables);
    });
  }

  evaluateNotPrincipal(principals, reference) {
    return Object.keys(reference).find(key => {
      return this.conditions['ForAllValues:StringEquals'].call(this, principals[key], reference[key]);
    });
  }

  evaluatePrincipal(principals, reference) {
    return Object.keys(reference).find(key => {
      if(isEmpty(reference[key])) return false;
      return this.conditions['ForAnyValue:StringEquals'].call(this, principals[key], reference[key]);
    });
  }

  evaluateAction(actions, reference) {
    return actions.find(action => {
      return this.conditions.StringLike.call(this, reference, action);
    });
  }

  evaluateResource(resources, reference, variables) {
    resources = isArray(resources) ? resources : [resources];
    return resources.find(resource => {
      const value = this.interpolateValue(resource, variables);
      return this.conditions.StringLike.call(this, reference, value);
    });
  }

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
        return conditions[key].call(this, getVariableValue(variable, variables), values);
      } else {
        return values.find(value => {
          return conditions[key].call(this, getVariableValue(variable, variables), value);
        });
      }
    });
  }


}


module.exports = PBAC;
