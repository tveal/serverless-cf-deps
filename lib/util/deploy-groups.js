const { CF_DEPS_REPO_URL_PTN } = require('./options');

module.exports = {
  createDeployGroups: (uow) => createDeployGroups(uow),
};

function createDeployGroups(uow) {
  const { stacks } = uow;
  let deployGroups = {};
  for (let stack of stacks) {
    const weight = getDeployGroup(uow, stack);
    if (!deployGroups[weight]) {
      deployGroups[weight] = [];
    }
    deployGroups[weight].push(stack);
  }

  let missedDeps = [];
  for (const dep of uow.allDeps) {
    if (!stacks.includes(dep)) {
      missedDeps.push(dep);
    }
  }

  return {
    ...uow,
    deployGroups,
    deployDoc: generateDoc({ ...uow, deployGroups, missedDeps }),
    missedDeps,
  };
};

function getDeployGroup(uow, repo) {
  const uniqueDependencyLines = getUniqueDependencyLines(uow, repo);
  const maxDepLine = uniqueDependencyLines.depLines.reduce(function (a, b) { return a.length > b.length ? a : b; });
  return maxDepLine.length;
};

function getUniqueDependencyLines(uow, repo, depLines, coord) {
  const { stackDeps } = uow;
  depLines = depLines || [];
  coord = coord || "0";
  const repoDeps = stackDeps.get(repo) || [];
  
  let allDeps = repoDeps;

  if (repoDeps.length > 0) {
    for (var i = 0; i < repoDeps.length; i++) {
      const newCoord = coord + (i + 1);
      if (!depLines.includes(newCoord)) {
        allDeps = new Set([
          ...(uow.allDeps || []),
          ...allDeps,
          ...getUniqueDependencyLines(uow, repoDeps[i], depLines, newCoord).allDeps,
        ]);
      }
    }
  } else {
    depLines.push(coord);
  }
  uow.allDeps = allDeps;
  return { depLines, allDeps };
};

function generateDoc(uow) {
  const {
    deployGroups,
    missedDeps,
    deployHeader,
  } = uow;

  let output = [];
  let repoCount = 0;
  for (const group in deployGroups) {
    const repos = deployGroups[group];
    output.push(`\n**Group ${group}** _--> ${repos.length} repos_\n`);
    repoCount = repoCount + repos.length;
    for (const repo of repos) {
      output.push(`- ${createRepoLink(repo)}`);
    }
  }
  if (missedDeps.length > 0) {
    output.push(`\n### MISSED DEPENDENCIES\n`);
    for (const missed of missedDeps) {
      output.push(`- ${createRepoLink(missed)}`);
    }
  }
  return [
    `## ${deployHeader} _--> ${repoCount} repos_`,
    output.join('\n')
  ].join('\n');
}

function createRepoLink(slug) {
  let link = slug;
  if (CF_DEPS_REPO_URL_PTN) {
    link = `[${slug}](${CF_DEPS_REPO_URL_PTN.replace('{slug}', slug)})`;
  }
  return link;
}