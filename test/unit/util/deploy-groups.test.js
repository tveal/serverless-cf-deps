const { expect, it, describe } = require('@jest/globals');
const { createDeployGroups, createDeployReport } = require('../../../lib/util/deploy-groups');

const DEPLOY_DATA_SINGLE_DEP = {
  DIV: '→',
  directory: {
    '→': {
      paths: ['1→0'],
    },
    '0': {
      id: 0,
      isTracked: false,
      name: 'cfn-global-infra-stage1',
      parents: [],
    },
    '1': {
      id: 1,
      isTracked: true,
      name: 'cfn-stack-stage1',
      parents: [0],
    },
  },
  exclusive: false,
  excludedIds: [],
  groupDeps: [
    {
      group: 1,
      ids: ['0', '1'],
      uniqDeps: ['0'],
      conflicts: ['0'],
    },
  ],
  missedIds: [],
  stacksToDeploy: [],
  stacksToIgnore: [],
  total: 2,
  totalUntracked: 1,
};

describe('util/deploy-groups', () => {
  describe('createDeployGroups', () => {
    it('should not break on empty deploy groups', () => {
      const deployData = createDeployGroups({});
      expect(deployData).toEqual({
        DIV: '→',
        directory: {},
        exclusive: false,
        excludedIds: [],
        groupDeps: [],
        missedIds: [],
        stacksToDeploy: [],
        stacksToIgnore: [],
        total: 0,
        totalUntracked: 0,
      });
    });
    it('should handle single dependency', () => {
      const stack1 = 'cfn-stack-stage1';
      const stack2 = 'cfn-global-infra-stage1';
      const deployData = createDeployGroups({ [stack1]: [stack2] });
      expect(deployData).toEqual(DEPLOY_DATA_SINGLE_DEP);
    });
    it('should handle stacks to deploy', () => {
      const stack1 = 'cfn-stack-stage1';
      const stack2 = 'cfn-global-infra-stage1';
      const deployData = createDeployGroups({ [stack1]: [stack2] }, [stack1]);
      expect(deployData).toEqual({
        ...DEPLOY_DATA_SINGLE_DEP,
        stacksToDeploy: [stack1],
      });
    });
    it('should handle exclusive stacks to deploy', () => {
      const stack1 = 'cfn-stack-stage1';
      const stack2 = 'cfn-global-infra-stage1';
      const deployData = createDeployGroups({ [stack1]: [stack2] }, [stack1], true);
      expect(deployData).toEqual({
        ...DEPLOY_DATA_SINGLE_DEP,
        stacksToDeploy: [stack1],
        directory: {
          '0': {
            id: 0,
            name: stack1,
            parents: [],
            isTracked: true,
          },
        },
        groupDeps: [
          {
            group: 1,
            ids: ['0'],
            uniqDeps: [],
            conflicts: [],
          },
        ],
        exclusive: true,
        total: 1,
        totalUntracked: 0,
      });
    });
    it('should handle single dependency with stacksToIgnore on untracked dependency', () => {
      const stack1 = 'cfn-stack-stage1';
      const stack2 = 'cfn-global-infra-stage1';
      const deployData = createDeployGroups({ [stack1]: [stack2] }, undefined, undefined, [stack2]);
      expect(deployData).toEqual({
        ...DEPLOY_DATA_SINGLE_DEP,
        groupDeps: [
          {
            group: 1,
            ids: ['1'],
            uniqDeps: [],
            conflicts: [],
          },
        ],
        excludedIds: ['0'],
        stacksToIgnore: [stack2],
      });
    });
    it('should handle single dependency with stacksToIgnore on all dependencies', () => {
      const stack1 = 'cfn-stack-stage1';
      const stack2 = 'cfn-global-infra-stage1';
      const deployData = createDeployGroups({ [stack1]: [stack2] }, undefined, undefined, [stack1, stack2]);
      expect(deployData).toEqual({
        ...DEPLOY_DATA_SINGLE_DEP,
        groupDeps: [],
        excludedIds: ['0', '1'],
        stacksToIgnore: [stack1, stack2],
      });
    });
    it('should handle direct circular dependency', () => {
      const stack1 = 'cfn-stack-stage1';
      const deployData = createDeployGroups({ [stack1]: [stack1] });
      expect(deployData).toEqual({
        ...DEPLOY_DATA_SINGLE_DEP,
        directory: {
          '0': {
            id: 0,
            isTracked: true,
            name: stack1,
            parents: [0],
          },
        },
        groupDeps: [],
        missedIds: ['0'],
        total: 1,
        totalUntracked: 0,
      });
    });
    it('should handle indirect circular dependency', () => {
      const stack1 = 'cfn-stack1-stage1';
      const stack2 = 'cfn-stack2-stage1';
      const stack3 = 'cfn-stack3-stage1';
      const deployData = createDeployGroups({
        [stack1]: [stack2],
        [stack2]: [stack3],
        [stack3]: [stack1],
      });
      expect(deployData).toEqual({
        ...DEPLOY_DATA_SINGLE_DEP,
        directory: {
          '→': {
            paths: [
              '0→1→2',
              '1→2→0',
              '2→0→1',
            ],
          },
          '0': {
            id: 0,
            isTracked: true,
            name: stack1,
            parents: [1],
          },
          '1': {
            id: 1,
            isTracked: true,
            name: stack2,
            parents: [2],
          },
          '2': {
            id: 2,
            isTracked: true,
            name: stack3,
            parents: [0],
          },
        },
        groupDeps: [
          {
            group: 1,
            ids: ['0', '1', '2'],
            uniqDeps: ['0', '1'],
            conflicts: ['0', '1'],
          },
        ],
        missedIds: [],
        total: 3,
        totalUntracked: 0,
      });
    });
  });
  describe('createDeployReport', () => {
    it('should create report with circular dependencies', () => {
      const stack1 = 'cfn-stack1-stage1';
      const stack2 = 'cfn-stack2-stage1';
      const stack3 = 'cfn-stack3-stage1';
      const deployData = createDeployGroups({
        [stack1]: [stack2],
        [stack2]: [stack3],
        [stack3]: [stack1],
      });

      expect(createDeployReport(deployData).split('\n')).toEqual([
        'Deploy Groups based on Serverless CloudFormation Stack Dependencies',
        '===',
        '',
        'Stack Counts:',
        '  - Total: 3',
        '  - Missed: 0',
        '  - Untracked: 0',
        '  - Excluded: 0',
        '',
        'Inputs',
        '  - Exclusive: false',
        '  - Stacks to deploy',
        '      - all',
        '',
        'Stack IDs are relative to the dependencies directory (this report)',
        '',
        '',
        'Group 1 -- CONFLICT IDs: [0,1]',
        '---',
        '',
        '3 stacks (dep IDs: [0,1])',
        '  - (id: 0) cfn-stack1-stage1',
        '  - (id: 1) cfn-stack2-stage1',
        '  - (id: 2) cfn-stack3-stage1',
        ''
      ]);
    });
    it('should create report with provided stacks to deploy', () => {
      const stack1 = 'cfn-stack1-stage1';
      const stack2 = 'cfn-stack2-stage1';
      const stack3 = 'cfn-stack3-stage1';
      const deployData = createDeployGroups({
        [stack1]: [stack2, stack3],
        [stack2]: [stack3],
      }, [stack1, stack2]);

      // console.log(JSON.stringify(createDeployReport(deployData).split('\n'), null, 2));
      expect(createDeployReport(deployData).split('\n')).toEqual([
        'Deploy Groups based on Serverless CloudFormation Stack Dependencies',
        '===',
        '',
        'Stack Counts:',
        '  - Total: 3',
        '  - Missed: 0',
        '  - Untracked: 1',
        '  - Excluded: 0',
        '',
        'Inputs',
        '  - Exclusive: false',
        '  - Stacks to deploy',
        '      - cfn-stack1-stage1',
        '      - cfn-stack2-stage1',
        '',
        'Stack IDs are relative to the dependencies directory (this report)',
        '',
        '',
        'Group 1 -- CONFLICT IDs: [2]',
        '---',
        '',
        '2 stacks (dep IDs: [2])',
        '  - (id: 1) cfn-stack2-stage1',
        '  - (id: 2, UNTRACKED) cfn-stack3-stage1',
        '',
        'Group 2',
        '---',
        '',
        '1 stacks (dep IDs: [1,2])',
        '  - (id: 0) cfn-stack1-stage1',
        ''
      ]);
    });
    it('should create report with exclusive provided stacks to deploy', () => {
      const stack1 = 'cfn-stack1-stage1';
      const stack2 = 'cfn-stack2-stage1';
      const stack3 = 'cfn-stack3-stage1';
      const deployData = createDeployGroups({
        [stack1]: [stack2, stack3],
        [stack2]: [stack3],
      }, [stack1, stack2], true);

      // console.log(JSON.stringify(createDeployReport(deployData).split('\n'), null, 2));
      expect(createDeployReport(deployData).split('\n')).toEqual([
        'Deploy Groups based on Serverless CloudFormation Stack Dependencies',
        '===',
        '',
        'Stack Counts:',
        '  - Total: 2',
        '  - Missed: 0',
        '  - Untracked: 0',
        '  - Excluded: 0',
        '',
        'Inputs',
        '  - Exclusive: true',
        '  - Stacks to deploy',
        '      - cfn-stack1-stage1',
        '      - cfn-stack2-stage1',
        '',
        'Stack IDs are relative to the dependencies directory (this report)',
        '',
        '',
        'Group 1 -- CONFLICT IDs: [1]',
        '---',
        '',
        '2 stacks (dep IDs: [1])',
        '  - (id: 0) cfn-stack1-stage1',
        '  - (id: 1) cfn-stack2-stage1',
        ''
      ]);
    });
    it('should create report with missed stacks', () => {
      const stack1 = 'cfn-stack1-stage1';
      const stack2 = 'cfn-stack2-stage1';
      const stack3 = 'cfn-stack3-stage1';
      const deployData = createDeployGroups({
        [stack1]: [stack3],
        [stack2]: [],
      });

      // console.log(JSON.stringify(createDeployReport(deployData).split('\n'), null, 2));
      expect(createDeployReport(deployData).split('\n')).toEqual([
        'Deploy Groups based on Serverless CloudFormation Stack Dependencies',
        '===',
        '',
        'Stack Counts:',
        '  - Total: 3',
        '  - Missed: 1',
        '  - Untracked: 1',
        '  - Excluded: 0',
        '',
        'Inputs',
        '  - Exclusive: false',
        '  - Stacks to deploy',
        '      - all',
        '',
        'Stack IDs are relative to the dependencies directory (this report)',
        '',
        'Missed Stacks:',
        '  - (id: 1, MISSED) cfn-stack2-stage1',
        '',
        'Group 1 -- CONFLICT IDs: [2]',
        '---',
        '',
        '2 stacks (dep IDs: [2])',
        '  - (id: 0) cfn-stack1-stage1',
        '  - (id: 2, UNTRACKED) cfn-stack3-stage1',
        ''
      ]);
    });
    it('should create report with stacks to ignore and no dependency section', () => {
      const stack1 = 'cfn-stack1-stage1';
      const stack2 = 'cfn-stack2-stage1';
      const stack3 = 'cfn-stack3-stage1';
      const deployData = createDeployGroups({
        [stack1]: [stack3],
        [stack2]: [],
      }, undefined, false, [stack3]);

      // console.log(JSON.stringify(createDeployReport(deployData).split('\n'), null, 2));
      expect(createDeployReport(deployData).split('\n')).toEqual([
        'Deploy Groups based on Serverless CloudFormation Stack Dependencies',
        '===',
        '',
        'Stack Counts:',
        '  - Total: 3',
        '  - Missed: 1',
        '  - Untracked: 1',
        '  - Excluded: 1',
        '',
        'Inputs',
        '  - Exclusive: false',
        '  - Stacks to deploy',
        '      - all',
        '  - Stacks to exclude',
        '      - cfn-stack3-stage1',
        '',
        'Stack IDs are relative to the dependencies directory (this report)',
        '',
        'Missed Stacks:',
        '  - (id: 1, MISSED) cfn-stack2-stage1',
        '',
        'Group 1',
        '---',
        '',
        '1 stacks',
        '  - (id: 0) cfn-stack1-stage1',
        ''
      ]);
    });
  });
});
