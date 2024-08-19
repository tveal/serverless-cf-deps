const {
  difference,
  flatMap,
  intersection,
  last,
  merge,
  omit,
  padStart,
  pickBy,
  reduce,
  sumBy,
  uniq,
  drop,
  reverse,
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
          isIgnored: stacksToIgnore.includes(name),
        },
      }))
      .reduce(merge, {});

    collectDepPaths(directory);

    const { paths: allPaths = stackIdsToDeploy } = directory[DIV] || {};

    const pathsToUse = allPaths
      .filter(path => !exclusive || !stackIdsToDeploy.length || intersection(path.split(DIV), stackIdsToDeploy).length);
    const { graph, inDegree } = buildGraph(pathsToUse);
    const { levels, cycles } = topologicalSortWithLevels(graph, inDegree);

    const groupDeps = reverse(levels)
      // remove empty groups when stack(s) in group are ignored
      .filter(ids => ids.filter(id => !stackIdsToIgnore.includes(id)).length)
      .map((ids, index) => {
        const groupPathsWithoutRoot = pathsToUse
          .filter(p => ids.includes(p.split(DIV)[0]))
          .map(p => drop(p.split(DIV)).join(DIV));
        const uniqDeps = uniq(
          groupPathsWithoutRoot.join(DIV).split(DIV)
            .filter(p => p && !stackIdsToIgnore.includes(p))
            .sort()
        );
        return {
          group: index + 1,
          ids: ids.filter(id => !stackIdsToIgnore.includes(id)),
          uniqDeps,
          conflicts: intersection(uniqDeps, ids),
        };
      });

    const idsInDeployGroups = uniq(groupDeps.flatMap(g => g.ids));
    const zeroDeps = Object.values(directory)
      .filter(i =>
        i.parents
        && !i.parents.length
        && !idsInDeployGroups.includes(`${i.id}`)
        && !stackIdsToIgnore.includes(`${i.id}`)
      )
      .map(i => `${i.id}`);

    if (zeroDeps.length) {
      const { group = 1, ids = [], uniqDeps = [], conflicts = [] } = groupDeps[0] || {};
      groupDeps[0] = {
        group,
        ids: [...ids, ...zeroDeps],
        uniqDeps,
        conflicts,
      };
    }

    return {
      // stackNames,
      DIV,
      groupDeps,
      cycles,
      directory,
      total: Object.keys(omit(directory, [DIV])).length,
      totalUntracked: sumBy(Object.values(directory), i => (i.name && !i.isTracked && !i.isIgnored ? 1 : 0)),
      missedIds: difference(
        Object.keys(directory),
        [
          ...groupDeps.flatMap(i => i.ids),
          DIV,
          ...stackIdsToIgnore,
          ...zeroDeps,
        ],
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
      cycles,
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
      ...(cycles.length
        ? [
          '',
          `WARNING: There are ${cycles.length} cyclic paths`,
          ...cycles.map(cycle => `  - ${cycle}`),
        ]
        : []
      ),
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

function buildGraph(paths) {
  const graph = new Map();
  const inDegree = new Map();

  paths.forEach(path => {
    const nodes = path.split(DIV);
    nodes.forEach(node => {
      if (!graph.has(node)) graph.set(node, []);
      if (!inDegree.has(node)) inDegree.set(node, 0);
    });
    nodes.forEach((node, i) => {
      if (i < nodes.length - 1) {
        graph.get(node).push(nodes[i + 1]);
        inDegree.set(nodes[i + 1], inDegree.get(nodes[i + 1]) + 1);
      }
    });
  });

  return { graph, inDegree };
}

function topologicalSortWithLevels(graph, inDegree) {
  const queue = [];
  const levels = [];

  inDegree.forEach((count, node) => {
    if (count === 0) queue.push(node);
  });

  while (queue.length > 0) {
    const level = [];
    const nextQueue = [];

    queue.forEach(node => {
      level.push(node);
      graph.get(node).forEach(neighbor => {
        inDegree.set(neighbor, inDegree.get(neighbor) - 1);
        if (inDegree.get(neighbor) === 0) nextQueue.push(neighbor);
      });
    });

    levels.push(level);
    queue.length = 0;
    queue.push(...nextQueue);
  }

  return { levels, cycles: detectCycle(graph) };
}

function detectCycle(graph) {
  const visited = new Set();
  const recStack = new Set();
  const cycles = [];

  // Depth-First-Search
  // https://en.wikipedia.org/wiki/Depth-first_search
  function dfs(node) {
    if (recStack.has(node)) return true;
    if (visited.has(node)) return false;

    visited.add(node);
    recStack.add(node);

    (graph.get(node) || []).forEach(neighbor => {
      if (dfs(neighbor)) {
        cycles.push([...visited.values(), neighbor].join(DIV));
      }
    });

    recStack.delete(node);
    return false;
  }

  [...graph.keys()].forEach(node => {
    dfs(node);
  });

  return uniq(cycles);
}
