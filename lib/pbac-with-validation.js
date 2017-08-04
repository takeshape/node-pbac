'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var policySchema = require('./schema.json');
var conditions = require('./conditions');
var ZSchema = require('z-schema');
var PBAC = require('./pbac');

var util = require('util');
var forEach = require('lodash/forEach');
var ensureArray = require('./util/ensure-array');

function throwError(name, message) {
  var args = [].slice.call(arguments, 2);
  args.unshift(message);
  var e = new Error();
  e.name = name;
  e.message = util.format.apply(util, args);
  throw e;
}

var PBACWithValidation = function (_PBAC) {
  _inherits(PBACWithValidation, _PBAC);

  function PBACWithValidation(policies, options) {
    _classCallCheck(this, PBACWithValidation);

    var _this = _possibleConstructorReturn(this, (PBACWithValidation.__proto__ || Object.getPrototypeOf(PBACWithValidation)).call(this, [], options));

    _this.schema = options.schema || policySchema;

    _this.addConditionsToSchema();
    _this.validateSchema();
    _this.add(policies);
    return _this;
  }

  _createClass(PBACWithValidation, [{
    key: 'add',
    value: function add(policies) {
      policies = ensureArray(policies);
      this.validate(policies);
      _get(PBACWithValidation.prototype.__proto__ || Object.getPrototypeOf(PBACWithValidation.prototype), 'add', this).call(this, policies);
    }
  }, {
    key: 'addConditionsToSchema',
    value: function addConditionsToSchema() {
      var definition = get(this.schema, 'definitions.Condition');
      if (definition) {
        var props = definition.properties = {};
        forEach(this.conditions, function (_, name) {
          props[name] = {
            type: 'object'
          };
        });
      }
    }
  }, {
    key: 'validateSchema',
    value: function validateSchema() {
      var validator = new ZSchema();
      if (!validator.validateSchema(this.schema)) {
        throwError('schema validation failed with', validator.getLastError());
      }
    }
  }, {
    key: 'validate',
    value: function validate(policies) {
      var _this2 = this;

      policies = ensureArray(policies);
      var validator = new ZSchema({
        noExtraKeywords: true
      });

      policies.forEach(function (policy) {
        if (!validator.validate(policy, _this2.schema)) {
          throwError('policy validation failed with', validator.getLastError());
        }
      });

      return true;
    }
  }]);

  return PBACWithValidation;
}(PBAC);

module.exports = PBACWithValidation;