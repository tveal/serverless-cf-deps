const {
  difference,
  flatMap,
  groupBy,
  intersection,
  last,
  max,
  merge,
  omit,
  padStart,
  pickBy,
  reduce,
  slice,
  sum,
  sumBy,
  uniq,
} = require('lodash');
const { log } = require('./log');
const DIV = '→';

module.exports = {
  createDeployGroups: (cfnDeps, stacksToDeploy = [], exclusive = false, stacksToIgnore = []) => {
    const dependencies = filteredDependencies(cfnDeps, stacksToDeploy, exclusive);

    const stackNames = [...new Set([
      ...Object.keys(dependencies),
      ...flatMap(Object.values(dependencies)),
      ...stacksToDeploy,
    ])].sort();
    const stackIdsToDeploy = stacksToDeploy.map(n => `${stackNames.indexOf(n)}`);
    const stackIdsToIgnore = stacksToIgnore.map(n => `${stackNames.indexOf(n)}`);

    const directory = stackNames
      .map((name, id) => ({
        [id]: {
          id,
          name,
          parents: (dependencies[name] || []).map(n => stackNames.indexOf(n)),
          isTracked: !!dependencies[name],
        },
      }))
      .reduce(merge, {});

    collectDepPaths(directory);

    const { paths: allPaths = stackIdsToDeploy } = directory[DIV] || {};
    const rankings = {};
    // create maxDepth rankings
    allPaths
      .filter(path => !exclusive || !stackIdsToDeploy.length || intersection(path.split(DIV), stackIdsToDeploy).length)
      .forEach(path => {
        const pathArray = path.split(DIV);
        const key = pathArray[0];
        const lastKey = last(pathArray);
        const dependentsArray = slice(pathArray, 1);
        const { maxDepth = 0, paths = [] } = rankings[key] || {};
        rankings[key] = {
          id: key,
          maxDepth: max([maxDepth, dependentsArray.length]),
          paths: [...paths, dependentsArray.join(DIV)],
        };

        // lastKey
        rankings[lastKey] = {
          id: lastKey,
          maxDepth: 0,
          paths: [],
        };
      });
    // create aggregate depths
    Object.values(rankings).forEach(ranking => {
      const { id, paths } = ranking;
      const aggDepth = sum(uniq(paths.join(DIV).split(DIV).sort())
        .map(id2 => rankings[id2]?.maxDepth || 0));
      rankings[id].aggDepth = aggDepth;
    });
    const groups = groupBy(Object.values(rankings), 'aggDepth');

    // create deploy groups
    const groupDeps = Object.entries(groups)
      .map(([groupId, array]) => {
        const ids = flatMap(array.map(a => a.id)).filter(id => !stackIdsToIgnore.includes(id));
        const uniqDeps = uniq(
          flatMap(array.map(a => a.paths))
            .join(DIV).split(DIV)
            .filter(p => p && !stackIdsToIgnore.includes(p))
            .sort()
        );
        return {
          uniqDeps,
          ids,
          conflicts: intersection(uniqDeps, ids),
        };
      })
      .filter(g => g.ids.length)
      .map((g, index) => ({ ...g, group: index + 1 }));

    return {
      // stackNames,
      DIV,
      groupDeps,
      directory,
      total: Object.keys(omit(directory, [DIV])).length,
      totalUntracked: sumBy(Object.values(directory), i => (i.name && !i.isTracked ? 1 : 0)),
      missedIds: difference(
        Object.keys(directory),
        [...groupDeps.flatMap(i => i.ids), DIV, ...stackIdsToIgnore],
      ),
      excludedIds: intersection(
        Object.keys(directory),
        stackIdsToIgnore,
      ),
      // original inputs
      stacksToDeploy,
      stacksToIgnore,
      exclusive,
    };
  },

  createDeployReport: (deployData) => {
    const {
      directory,
      groupDeps,
      total,
      totalUntracked,
      missedIds,
      excludedIds,
      stacksToDeploy,
      stacksToIgnore,
      exclusive,
    } = deployData;
    const msg = [
      'Deploy Groups based on Serverless CloudFormation Stack Dependencies',
      '===',
      '',
      'Stack Counts:',
      `  - Total: ${total}`,
      `  - Missed: ${missedIds.length}`,
      `  - Untracked: ${totalUntracked}`,
      `  - Excluded: ${excludedIds.length}`,
      '',
      'Inputs',
      `  - Exclusive: ${exclusive}`,
      '  - Stacks to deploy',
      ...(stacksToDeploy.length
        ? stacksToDeploy.map(n => `      - ${n}`)
        : ['      - all']
      ),
      ...(stacksToIgnore.length
        ? ['  - Stacks to exclude', ...stacksToIgnore.map(n => `      - ${n}`)]
        : []
      ),
      '',
      'Stack IDs are relative to the dependencies directory (this report)',
      '',
    ];

    if (missedIds.length) msg.push('Missed Stacks:');
    missedIds.forEach(missedId => {
      msg.push(`  - (id: ${missedId}, MISSED) ${directory[missedId].name}`);
    });

    groupDeps.forEach(i => {

      if (i.conflicts.length) {
        msg.push(`\nGroup ${i.group} -- CONFLICT IDs: [${i.conflicts.join(',')}]`);
      } else {
        msg.push(`\nGroup ${i.group}`);
      }
      msg.push('---\n');

      if (i.uniqDeps.length) {
        msg.push(`${i.ids.length} stacks (dep IDs: [${i.uniqDeps.join(',')}])`);
      } else {
        msg.push(`${i.ids.length} stacks`);
      }

      i.ids.forEach(id => {
        const { name, isTracked } = directory[id];
        const paddedId = padStart(`${id}`, `${total}`.length)
        if (!isTracked) {
          msg.push(`  - (id: ${paddedId}, UNTRACKED) ${name}`);
        } else {
          msg.push(`  - (id: ${paddedId}) ${name}`);
        }
      });
    });

    return [...msg, ''].join('\n');
  },
};

function filteredDependencies(deps, subset, exclusive) {
  if (subset.length < 1) return deps;

  const uniqStackNames = new Set();
  const traverseDeps = (name) => {
    if (uniqStackNames.has(name)) return;
    uniqStackNames.add(name);
    deps[name]?.forEach(depName => {
      // uniqStackNames.add(depName);
      traverseDeps(depName);
    });
  };
  subset.forEach(key => {
    traverseDeps(key);
  });

  return exclusive
    ? Object.entries(pickBy(deps, (val, key) => subset.includes(key)))
      .map(([repo, repoDeps]) => ({
        [repo]: repoDeps.filter(d => subset.includes(d)),
      }))
      .reduce(merge, {})
    : pickBy(deps, (val, key) => uniqStackNames.has(key));
}

function collectDepPaths(directory, parentId, path = '0') {
  // first call: iterate thru entire directory
  if (!directory[parentId]) {
    Object.keys(directory).forEach(firstPath => {
      directory[firstPath].parents.forEach(pId => {
        collectDepPaths(directory, pId, firstPath);
      });
    });
    return;
  }

  const crumbLast = last(path.split(DIV));
  const { paths = [] } = directory[DIV] || {};
  const { parents } = directory[parentId];
  const nextPath = [path, parentId].join(DIV);

  // self dependency
  if (Number(crumbLast) === parentId && parents.includes(parentId)) {
    log.debug('WARN: %s depends on itself.', parentId);
    return;
  }
  
  // indirect circular dependency
  if (uniq(nextPath.split(DIV)).length < nextPath.split(DIV).length) {
    log.debug('WARN: Circular dependency in path: %s', nextPath);
    return;
  }

  // add dependency paths
  directory[DIV] = {
    // paths: [...paths, nextPath].sort(),
    paths: reduce(
      [...paths, nextPath].sort(),
      (res, val, key, orig) => {
        if (!orig[key + 1]?.startsWith(val)) {
          return res.length
            ? `${res}:${val}`
            : val;
        }
        return res;
      },
      '',
    ).split(':'),
  };

  parents.forEach(pId => {
    collectDepPaths(directory, pId, nextPath);
  });
}
