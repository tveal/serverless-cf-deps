#!/usr/bin/env node
const { log } = require('./util/log');
const options = require('./util/options');
const { cloneRemoteStore } = require('./util/git');
const { loadDeps, saveGroups } = require('./util/files');
const { createDeployGroups } = require('./util/deploy-groups');

log.info('Aloha Honua!');

const main = async () => {
  log.debug('options:', options);

  const storage = await cloneRemoteStore();
  log.debug(storage);
  const stackDeps = loadDeps(storage.localDir);

  const depGroups = await createDeployGroups({
    deployHeader: 'cf-deps deploy groups',
    stackDeps,
    stacks: options.CF_DEPS_DEPLOY_STACKS || stackDeps.getKeys(),
  });

  if (options.CF_DEPS_SAVE_GROUPS) {
    saveGroups(options.CF_DEPS_SAVE_GROUPS, depGroups.deployDoc);
  } else {
    log.info('deployDoc:', depGroups.deployDoc);
  }
};

main();