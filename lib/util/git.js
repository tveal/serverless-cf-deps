const git = require('simple-git/promise');
const chalk = require('chalk');
const {
  CF_DEPS_JSON_FILE,
  CF_DEPS_REMOTE_GIT,
  CF_DEPS_GIT_USR_NAME,
  CF_DEPS_GIT_USR_MAIL,
  CF_DEPS_REMOTE_BRANCH,
  CURRENT_REPO,
  CF_DEPS_COMMIT_MSG,
} = require('./options');
const { log } = require('./log');
const { directoryExists, rmDir } = require('./files');

module.exports = {
  cloneRemoteStore: () => {
    return cloneRepo(CF_DEPS_REMOTE_GIT);
  },

  pushDeps: pushDeps,
}

async function cloneRepo(remote) {
  const localDir = `${process.cwd()}/cf-deps-remote-store`;

  if (directoryExists(localDir)) {
    log.info(`Existing directory found; Deleting ${localDir}...`);
    rmDir(localDir);
  }

  log.info(`Cloning ${remote} ...`);
  await git().silent(false)
    .clone(remote, localDir, ['-b', CF_DEPS_REMOTE_BRANCH, '--single-branch', '--depth', '1'])
    .then(() => {
      log.info(`finished cloning remote: ${remote}`);
      log.info(`local path: ${localDir}`);
    })
    .catch((err) => {
      log.error(chalk.red('Is this a valid repo?', chalk.bold(remote)));
      throw err;
    });

  return {
    localDir: localDir,
    remote: remote
  };
}

async function pushDeps(storage) {
  const { localDir } = storage;
  const gitHere = git(localDir);
  const commitMsgArr = [
    `[cf-deps: ${CURRENT_REPO}]`,
  ];
  if (CF_DEPS_COMMIT_MSG) {
    commitMsgArr.push(CF_DEPS_COMMIT_MSG);
  }

  await gitHere.add(CF_DEPS_JSON_FILE)
    .then(() => gitHere.addConfig('user.name', CF_DEPS_GIT_USR_NAME))
    .then(() => gitHere.addConfig('user.email', CF_DEPS_GIT_USR_MAIL))
    .then(() => gitHere.commit(commitMsgArr.join(' '), CF_DEPS_JSON_FILE))
    // .then(() => {throw new Error('testing negative case')})
    .then(() => gitHere.push('origin', CF_DEPS_REMOTE_BRANCH))
    .then(() => log.info(`Finished pushing: ${localDir} to ${CF_DEPS_REMOTE_GIT} ${CF_DEPS_REMOTE_BRANCH}`))
    .catch(async (err) => {
      log.error(
        chalk.red(`Failed to push to ${CF_DEPS_REMOTE_BRANCH} for ${CF_DEPS_REMOTE_GIT}`),
        err);
      const newBranch = `cf-deps/${CF_DEPS_REMOTE_BRANCH}/${CURRENT_REPO}`
      await gitHere.push('origin', `${CF_DEPS_REMOTE_BRANCH}:${newBranch}`)
        .then(() => log.info(chalk.yellowBright(`Pushed to ${newBranch}`)))
        .then(() => log.info(chalk.yellowBright.bold(`make sure to open a PR from ${newBranch} to ${CF_DEPS_REMOTE_BRANCH}`)));
    });
}