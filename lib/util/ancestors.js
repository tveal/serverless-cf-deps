const { merge, flatMap, last, reduce } = require('lodash');
const { log } = require('./log');
const DIV = '→';

module.exports = {
  createDeployGroups: (dependencies) => {

    const stackNames = [...new Set([
      ...Object.keys(dependencies),
      ...flatMap(Object.values(dependencies)),
    ])].sort();

    const directory = stackNames
      .map((name, id) => ({
        [id]: {
          id,
          name,
          parents: (dependencies[name] || []).map(n => stackNames.indexOf(n)),
        },
      }))
      .reduce(merge, {});

    adornDepPaths(directory);
    console.log(directory);
    // console.log(stackNames);
    return {};
  },
};

function adornDepPaths(directory, parentId, path = '0') {
  // first call: iterate thru entire directory
  if (!directory[parentId]) {
    Object.keys(directory).forEach(firstPath => {
      directory[firstPath].parents.forEach(pId => {
        adornDepPaths(directory, pId, firstPath);
      });
    });
    return;
  }

  const crumbLast = last(path.split(DIV));
  const { parents, paths = [] } = directory[parentId];
  
  // self dependency
  if (Number(crumbLast) === parentId && parents.includes(parentId)) {
    // todo: change to debug
    log.info('WARN: %s depends on itself.', parentId);
    return;
  }
  
  // circular dependency
  if (paths.includes(path)) {
    // todo: change to debug
    log.info('WARN: %s to %s is circular.', path, parentId);
    return;
  }
  
  const crumbFirst = path.split(DIV)[0];
  const nextPath = [path, parentId].join(DIV);
  const { paths: pathsFirst = [] } = directory[crumbFirst];
  const newPaths = [...pathsFirst, nextPath].sort();
  directory[crumbFirst].paths = reduce(
    newPaths,
    (res, val, key, orig) => {
      if (!orig[key+1]?.startsWith(val)) {
        return res.length
          ? `${res}:${val}`
          : val;
      }
      return '';
    },
    '',
  ).split(':');
  parents.forEach(pId => {
    adornDepPaths(directory, pId, nextPath);
  });
}
