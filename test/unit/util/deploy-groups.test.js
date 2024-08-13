const { expect, it, describe } = require('@jest/globals');
const CFN_DEPS = require('../../fixtures');
const { createDeployGroups } = require('../../../lib/util/ancestors');

describe('util/logLevels', () => {
  it('dummy', () => {
    // expect(createDeployGroups({
    //   service1: [
    //     'service2',
    //   ],
    //   service2: [
    //     'service3',
    //   ],
    //   service3: [],
    //   service4: [
    //     'service3',
    //   ],
    //   service5: [
    //     'service1',
    //     'service4',
    //   ],
    // })).toEqual({});
    expect(createDeployGroups(CFN_DEPS)).toEqual({});
  });
});
