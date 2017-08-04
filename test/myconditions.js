var assert = require('assert'),
  _ = require('lodash'),
  Engine = require('../src/pbac');

var policies = [{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowUsersToDeactivateDeleteTheirOwnVirtualMFADevice",
    "Effect": "Allow",
    "Action": [
      "iam:DeactivateMFADevice",
      "iam:DeleteVirtualMFADevice"
    ],
    "Resource": [
      "arn:aws:iam:::mfa/${aws:username}",
      "arn:aws:iam:::user/${aws:username}"
    ],
    "Condition": {
      "EqualsFoo": {
        "aws:username": true
      }
    }
  }]
}];

var engine = new Engine(policies, {
  conditions: {
    EqualsFoo: function EqualsFoo(a, b) {
      return b && a === 'foo';
    }
  },
});

describe('custom condition', function() {

  it('username is foo', function() {
    assert.ok(engine.evaluate({
      action: 'iam:DeactivateMFADevice',
      resource: 'arn:aws:iam:::mfa/foo',
      variables: {
        aws: {
          CurrentTime: new Date(),
          MultiFactorAuthPresent: true,
          username: 'foo',
        }
      }
    }));
  });

  it('username is bar', function() {
    assert.ok(!engine.evaluate({
      action: 'iam:DeactivateMFADevice',
      resource: 'arn:aws:iam:::mfa/bar',
      variables: {
        aws: {
          CurrentTime: new Date(),
          MultiFactorAuthPresent: true,
          username: 'bar',
        }
      }
    }));
  });
});
