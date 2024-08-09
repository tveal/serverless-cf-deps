const path = require('path');
const chalk = require('chalk');
const origin = require('remote-origin-url');
const depsBin = 'cf-deps';
const groupsBin = 'cf-groups';
const groupsSaveFile = `${groupsBin}.md`;

const baseYargs = require('yargs')
  .epilog('Work extra hard to masterfully automate today\'s problem so you can fully focus on the next big thing.')
  ;

const options = {
  CF_DEPS_REMOTE_GIT: {
    name: 'remote', alias: 'r',
    type: 'string',
    desc: 'git clone url for cf-deps storage',
    menu: [depsBin, groupsBin],
    reqd: true,
    nargs: 1,
  },
  CF_DEPS_JSON_FILE: {
    name: 'file', alias: 'f',
    type: 'string',
    desc: 'json file for storage',
    menu: [depsBin, groupsBin],
    reqd: true,
    nargs: 1,
  },
  CF_DEPS_GIT_USR_NAME: {
    name: 'username', alias: 'u',
    type: 'string',
    desc: 'git username',
    menu: [depsBin,],
    reqd: true,
    nargs: 1,
  },
  CF_DEPS_GIT_USR_MAIL: {
    name: 'email', alias: 'm',
    type: 'string',
    desc: 'git user email',
    menu: [depsBin,],
    reqd: true,
    nargs: 1,
  },
  CF_DEPS_REMOTE_BRANCH: {
    name: 'branch', alias: 'b',
    type: 'string',
    desc: 'git branch, default: master',
    menu: [depsBin, groupsBin],
    reqd: false,
    nargs: 1,
    func: (cliVal, envVal) => {
      const fromConfig = cliVal || envVal;
      return fromConfig || 'master';
    },
  },
  CF_DEPS_EXCLUDES: {
    name: 'excludes', alias: 'e',
    type: 'string',
    desc: 'comma-delimited stackNames to exclude',
    menu: [depsBin,],
    reqd: false,
    nargs: 1,
    func: (cliVal, envVal) => {
      const fromCli = cliVal ? cliVal.split(',') : [];
      const fromEnv = envVal ? envVal.split(',') : [];
      return fromCli.concat(fromEnv);
    },
  },
  CF_DEPS_FILENAME_PTN: {
    name: 'filename-pattern', alias: 'p',
    type: 'string',
    desc: 'filename pattern to search, default: ".yml$|.yaml$"',
    menu: [depsBin,],
    reqd: false,
    nargs: 1,
    func: (cliVal, envVal) => {
      const fromConfig = cliVal || envVal;
      return fromConfig || '.yml$|.yaml$';
    },
  },
  CF_DEPS_COMMIT_MSG: {
    name: 'commit-msg', alias: 'c',
    type: 'string',
    desc: 'message to add to the commit',
    menu: [depsBin,],
    reqd: false,
    nargs: 1,
  },
  CF_DEPS_DEPLOY_STACKS: {
    name: 'deploy', alias: 'd',
    type: 'string',
    desc: 'comma-delimited stackNames to calculate deploy order; default: all stored stacks',
    menu: [groupsBin,],
    reqd: false,
    nargs: 1,
    func: (cliVal, envVal) => {
      const fromCli = cliVal ? cliVal.split(',') : cliVal;
      const fromEnv = envVal ? envVal.split(',') : envVal;
      return fromCli || fromEnv;
    },
  },
  CF_DEPS_JS_FILTER: {
    name: 'filter',
    type: 'string',
    desc: 'js file in remote with deps filter',
    menu: [groupsBin,],
    reqd: false,
    nargs: 1,
  },
  CF_DEPS_REPO_URL_PTN: {
    name: 'link', alias: 'l',
    type: 'string',
    desc: 'repo url pattern; {slug} is replaced by repo name',
    menu: [groupsBin,],
    reqd: false,
    nargs: 1,
  },
  CF_DEPS_SAVE_GROUPS: {
    name: 'save', alias: 's',
    type: 'boolean',
    desc: `save deploy groups to ${groupsSaveFile}; default: false`,
    menu: [groupsBin],
    reqd: false,
    nargs: 0,
    func: (cliVal, envVal) => (cliVal || envVal ? groupsSaveFile : false),
  },
  CF_DEPS_DEBUG: {
    name: 'debug',
    type: 'boolean',
    desc: 'enable debug logging',
    menu: [depsBin, groupsBin],
    reqd: false,
    nargs: 0,
  },
};

const addOption = (key, yarg, bin) => {
  if (options[key].menu.includes(bin)) {
    const {
      name, alias,
      type,
      desc,
      reqd,
      nargs,
    } = options[key];
    descParts = [];
    if (reqd) {
      descParts.push(chalk.yellow('Required.'));
    }
    descParts.push(`${desc}`);
    descParts.push(chalk.gray(`[alt env: ${key}]`));
    descParts.push(``);

    const settings = {
      alias,
      // type,
      desc: descParts.join('\n'),
      nargs,
    };

    yarg.option(name, settings);
  }
};

const optionsHeader = 'Specify options by command flag or alt env variable';
const depsUsage = `${depsBin}
  Create list of CloudFormation stackName references from yaml/yml files
  and upload them to a central git repo for scalable deploy-dependency
  management. Use this in a CI/CD space to dynamically publish stack
  dependencies.

${optionsHeader}`;
const groupsUsage = `${groupsBin}
  Generate deploy groups based on output of cf-deps

${optionsHeader}`;

const depsEnvExample = `
  export CF_DEPS_JSON_FILE="deps.json";
  export CF_DEPS_REMOTE_GIT="git@here.org/repo.git";
  export CF_DEPS_GIT_USR_NAME="me";
  export CF_DEPS_GIT_USR_MAIL="me@here.org";
  ${depsBin}`;

const groupsEnvExample = `
  export CF_DEPS_JSON_FILE="deps.json";
  export CF_DEPS_REMOTE_GIT="git@here.org/repo.git";
  ${groupsBin}`;

const yargSelector = (bin) => {
  for (const envVar in options) {
    addOption(envVar, baseYargs, bin);
  }
  if (bin === depsBin) {
    return baseYargs
      .example(`${depsBin} -f deps.json -r git@here.org/repo.git -u me -m me@here.org`)
      .example(depsEnvExample)
      .usage(depsUsage)
      ;
  }

  if (bin === groupsBin) {
    return baseYargs
      .example(`${groupsBin} -f deps.json -r git@here.org/repo.git`)
      .example(groupsEnvExample)
      .usage(groupsUsage)
      ;
  }

  return baseYargs;
};

const bin = path.basename(process.argv[1]);
const yargs = yargSelector(bin);
const { argv } = yargs;

const toExport = {
  CURRENT_REPO: path.basename(origin.sync()).replace('.git', ''),
  BIN: bin,
  isGroupsBin: bin === groupsBin,
  isDepsBin: bin === depsBin,
}

for (const envVar in options) {
  const { name, reqd, menu, func } = options[envVar];
  if (menu.includes(bin)) {

    if (func) {
      toExport[envVar] = func(argv[name], process.env[envVar]);
    } else if (reqd) {
      toExport[envVar] = requireOption(argv[name], envVar);
    } else {
      toExport[envVar] = argv[name] || process.env[envVar];
    }

  }
}

module.exports = toExport;

function requireOption(cliValue, envName) {
  const val = cliValue || process.env[envName];
  if (!val) {
    yargs.showHelp();
    throw new Error(`Missing ${envName}, see above for help.`);
  }
  return val;
}
