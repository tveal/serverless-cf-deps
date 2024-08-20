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
      isIgnored: false,
      name: 'cfn-global-infra-stage1',
      parents: [],
    },
    '1': {
      id: 1,
      isTracked: true,
      isIgnored: false,
      name: 'cfn-stack-stage1',
      parents: [0],
    },
  },
  exclusive: false,
  excludedIds: [],
  groupDeps: [
    {
      group: 1,
      ids: ['0'],
      uniqDeps: [],
      conflicts: [],
    },
    {
      group: 2,
      ids: ['1'],
      uniqDeps: ['0'],
      conflicts: [],
    },
  ],
  cycles: [],
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
        cycles: [],
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
            isIgnored: false,
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
        directory: {
          ...DEPLOY_DATA_SINGLE_DEP.directory,
          '0': {
            ...DEPLOY_DATA_SINGLE_DEP.directory['0'],
            isIgnored: true,
          },
        },
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
        totalUntracked: 0,
      });
    });
    it('should handle single dependency with stacksToIgnore on all dependencies', () => {
      const stack1 = 'cfn-stack-stage1';
      const stack2 = 'cfn-global-infra-stage1';
      const deployData = createDeployGroups({ [stack1]: [stack2] }, undefined, undefined, [stack1, stack2]);
      expect(deployData).toEqual({
        ...DEPLOY_DATA_SINGLE_DEP,
        directory: {
          ...DEPLOY_DATA_SINGLE_DEP.directory,
          '0': {
            ...DEPLOY_DATA_SINGLE_DEP.directory['0'],
            isIgnored: true,
          },
          '1': {
            ...DEPLOY_DATA_SINGLE_DEP.directory['1'],
            isIgnored: true,
          },
        },
        groupDeps: [],
        excludedIds: ['0', '1'],
        stacksToIgnore: [stack1, stack2],
        totalUntracked: 0,
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
            isIgnored: false,
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
            isIgnored: false,
            name: stack1,
            parents: [1],
          },
          '1': {
            id: 1,
            isTracked: true,
            isIgnored: false,
            name: stack2,
            parents: [2],
          },
          '2': {
            id: 2,
            isTracked: true,
            isIgnored: false,
            name: stack3,
            parents: [0],
          },
        },
        groupDeps: [],
        cycles: ['0→1→2→0'],
        missedIds: ['0', '1', '2'],
        total: 3,
        totalUntracked: 0,
      });
    });
    it('should combine dependency groups with no shared unique dependency IDs', () => {
      const stack1 = 'cfn-stack1-stage1';
      const stack2 = 'cfn-stack2-stage1';
      const stack3 = 'cfn-stack3-stage1';
      const stack4 = 'cfn-stack4-stage1';
      const stack5 = 'cfn-stack5-stage1';
      const stack6 = 'cfn-stack6-stage1';
      const stack7 = 'cfn-stack7-stage1';
      const deployData = createDeployGroups({
        [stack1]: [stack4, stack5, stack6],
        [stack2]: [stack5, stack6],
        [stack3]: [stack6],
        [stack4]: [stack7],
      });

      expect(deployData).toEqual({
        ...DEPLOY_DATA_SINGLE_DEP,
        directory: {
          '→': {
            paths: [
              '0→3→6',
              '0→4',
              '0→5',
              '1→4',
              '1→5',
              '2→5',
              '3→6',
            ],
          },
          '0': {
            id: 0,
            isTracked: true,
            isIgnored: false,
            name: stack1,
            parents: [3, 4, 5],
          },
          '1': {
            id: 1,
            isTracked: true,
            isIgnored: false,
            name: stack2,
            parents: [4, 5],
          },
          '2': {
            id: 2,
            isTracked: true,
            isIgnored: false,
            name: stack3,
            parents: [5],
          },
          '3': {
            id: 3,
            isTracked: true,
            isIgnored: false,
            name: stack4,
            parents: [6],
          },
          '4': {
            id: 4,
            isTracked: false,
            isIgnored: false,
            name: stack5,
            parents: [],
          },
          '5': {
            id: 5,
            isTracked: false,
            isIgnored: false,
            name: stack6,
            parents: [],
          },
          '6': {
            id: 6,
            isTracked: false,
            isIgnored: false,
            name: stack7,
            parents: [],
          },
        },
        groupDeps: [
          {
            group: 1,
            ids: ['6'],
            uniqDeps: [],
            conflicts: [],
          },
          {
            group: 2,
            ids: ['3', '4', '5'],
            uniqDeps: ['6'],
            conflicts: [],
          },
          {
            group: 3,
            ids: ['0', '1', '2'],
            uniqDeps: ['3', '4', '5', '6'],
            conflicts: [],
          },
        ],
        missedIds: [],
        total: 7,
        totalUntracked: 3,
      });
    });
  });
  describe('createDeployReport', () => {
    it('should create report with circular dependencies', () => {
      const stack1 = 'cfn-stack1-stage1';
      const stack2 = 'cfn-stack2-stage1';
      const stack3 = 'cfn-stack3-stage1';
      const stack4 = 'cfn-stack4-stage1';
      const stack5 = 'cfn-stack5-stage1';
      const stack6 = 'cfn-stack6-stage1';
      const deployData = createDeployGroups({
        [stack1]: [stack2],
        [stack2]: [stack3],
        [stack3]: [stack1],
        [stack4]: [stack5],
        [stack6]: [],
      });

      expect(createDeployReport(deployData).split('\n')).toEqual([
        'Deploy Groups based on Serverless CloudFormation Stack Dependencies',
        '===',
        '',
        'Stack Counts:',
        '  - Total: 6',
        '  - Missed: 3',
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
        'WARNING: There are 1 cyclic paths',
        '  - 0→1→2→0',
        '',
        'Missed Stacks:',
        '  - (id: 0, MISSED) cfn-stack1-stage1',
        '  - (id: 1, MISSED) cfn-stack2-stage1',
        '  - (id: 2, MISSED) cfn-stack3-stage1',
        '',
        'Group 1',
        '---',
        '',
        '2 stacks',
        '  - (id: 4, UNTRACKED) cfn-stack5-stage1',
        '  - (id: 5) cfn-stack6-stage1',
        '',
        'Group 2',
        '---',
        '',
        '1 stacks (dep IDs: [4])',
        '  - (id: 3) cfn-stack4-stage1',
        '',
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
        'Group 1',
        '---',
        '',
        '1 stacks',
        '  - (id: 2, UNTRACKED) cfn-stack3-stage1',
        '',
        'Group 2',
        '---',
        '',
        '1 stacks (dep IDs: [2])',
        '  - (id: 1) cfn-stack2-stage1',
        '',
        'Group 3',
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
        'Group 1',
        '---',
        '',
        '1 stacks',
        '  - (id: 1) cfn-stack2-stage1',
        '',
        'Group 2',
        '---',
        '',
        '1 stacks (dep IDs: [1])',
        '  - (id: 0) cfn-stack1-stage1',
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

      expect(createDeployReport(deployData).split('\n')).toEqual([
        'Deploy Groups based on Serverless CloudFormation Stack Dependencies',
        '===',
        '',
        'Stack Counts:',
        '  - Total: 3',
        '  - Missed: 0',
        '  - Untracked: 0',
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
        '',
        'Group 1',
        '---',
        '',
        '2 stacks',
        '  - (id: 0) cfn-stack1-stage1',
        '  - (id: 1) cfn-stack2-stage1',
        ''
      ]);
    });
  });
});
