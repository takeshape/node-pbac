'use strict';
const policySchema = require('./schema.json');
const conditions = require('./conditions');
const ZSchema = require('z-schema');
const PBAC = require('./pbac');

const util = require('util');
const forEach = require('lodash/forEach');
const ensureArray = require('./lib/ensure-array');

function throwError(name, message) {
  const args = [].slice.call(arguments, 2);
  args.unshift(message);
  const e = new Error();
  e.name = name;
  e.message = util.format.apply(util, args);
  throw e;
}

class PBACWithValidation extends PBAC{
  constructor(policies, options) {
    super([], options);

    this.schema = options.schema || policySchema;
    
    this.addConditionsToSchema();
    this.validateSchema();
    this.add(policies);
  }


  add(policies) {
    policies = ensureArray(policies);
    this.validate(policies);
    super.add(policies);
  }

  addConditionsToSchema() {
    const definition = get(this.schema, 'definitions.Condition');
    if (definition) {
      const props = definition.properties = {};
      forEach(this.conditions, (_, name) => {
        props[name] = {
          type: 'object'
        };
      });
    }
  }

  validateSchema() {
    const validator = new ZSchema();
    if (!validator.validateSchema(this.schema)) {
      throwError('schema validation failed with', validator.getLastError());
    }
  }

  validate(policies) {
    policies = ensureArray(policies);
    const validator = new ZSchema({
      noExtraKeywords: true,
    });

    policies.forEach(policy => {
      if (!validator.validate(policy, this.schema)) {
        throwError('policy validation failed with', validator.getLastError());
      }
    });

    return true;
  }

}

module.exports = PBACWithValidation;
