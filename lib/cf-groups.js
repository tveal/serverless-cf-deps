#!/usr/bin/env node
const { log } = require('./util/log');
const options = require('./util/options');
const { cloneRemoteStore } = require('./util/git');
const { loadDeps, saveGroups } = require('./util/files');
const { createDeployGroups, createDeployReport } = require('./util/deploy-groups');

const main = async () => {
  log.debug('options:', options);

  const storage = await cloneRemoteStore();
  log.debug(storage);
  const { existingDeps } = loadDeps(storage.localDir);

  const deployData = createDeployGroups(
    existingDeps,
    options.CF_DEPS_DEPLOY_STACKS,
    options.CF_DEPS_EXCLUSIVE_DEPLOY,
  );
  const report = createDeployReport(deployData);

  if (options.CF_DEPS_SAVE_GROUPS) {
    saveGroups(options.CF_DEPS_SAVE_GROUPS, report);
  } else {
    log.info('deployDoc:\n\n%s', report);
  }
};

main();
