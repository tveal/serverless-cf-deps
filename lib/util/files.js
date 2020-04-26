const {
  writeFileSync,
  statSync,
} = require('fs');
const rimraf = require('rimraf');
const {
  CF_DEPS_JSON_FILE,
  CF_DEPS_JS_FILTER,
  isGroupsBin,
} = require('./options');
const { log } = require('./log');

module.exports = {
  saveDeps: (newDeps, localDir) => {
    const jsonFilePath = `${localDir}/${CF_DEPS_JSON_FILE}`;
    const existingDeps = loadExistingDeps(localDir).existingDeps;
    existingDeps[newDeps.repoName] = newDeps.cfDeps;
    writeFileSync(jsonFilePath, JSON.stringify(existingDeps, null, 2));
  },

  loadDeps: (localDir) => {
    return loadExistingDeps(localDir);
  },

  saveGroups: (docFileName, docContent) => {
    const docFile = `${process.cwd()}/${docFileName}`;
    writeFileSync(docFile, docContent);
    log.info(`Saved deploy groups to ${docFile}`);
  },

  directoryExists: (filePath) => {
    try {
      return statSync(filePath).isDirectory();
    } catch (err) {
      return false;
    }
  },

  fileExists: fileExists,

  rmDir: (dir) => {
    rimraf.sync(dir);
  },
}

function loadExistingDeps(localDir) {
  const jsonFilePath = `${localDir}/${CF_DEPS_JSON_FILE}`;

  let existingDeps = {};
  if (fileExists(jsonFilePath)) {
    existingDeps = require(jsonFilePath);
  } else if (isGroupsBin) {
    log.error(`Could not find ${jsonFilePath}`);
    throw new Error(`Required ${CF_DEPS_JSON_FILE} not found.`);
  }
  
  let filter = (repo, deps) => { /* do nothing by default */ };
  // get custom dep filter
  if (CF_DEPS_JS_FILTER) {
    const jsFilterPath = `${localDir}/${CF_DEPS_JS_FILTER}`;
    if (fileExists(jsFilterPath)) {
      filter = require(jsFilterPath);
    }
  }
  
  const get = (repo) => {
    if (!existingDeps[repo]) {
      existingDeps[repo] = [];
    }
    let deps = existingDeps[repo];
    filter(repo, deps);
    // remove duplicates
    deps = [...new Set(deps)];
    existingDeps[repo] = deps;
    return deps;
  };
  const getKeys = () => Object.keys(existingDeps);

  return {
    existingDeps,
    get,
    getKeys,
  };
}

function fileExists(filePath) {
  try {
    return statSync(filePath).isFile();
  } catch (err) {
    return false;
  }
}