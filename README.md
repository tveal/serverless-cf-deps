[![Gitpod Ready-to-Code](https://img.shields.io/badge/Gitpod-Ready--to--Code-blue?logo=gitpod)](https://gitpod.io/#https://github.com/tveal/serverless-cf-deps) 

# cf-deps (and cf-groups)

Contains 2 CLI binaries:
1. **cf-deps**: Publishes a list of serverless dependencies on CloudFormation to a centralize repo
2. **cf-groups**: Consumes the published dependency records from _cf-deps_ and generates deploy groups

**Why?**
- To allow you to scale n-number of serverless stacks with minmal effort on tracking deploy dependencies
- Shed light on areas you might have too coupled

**Quick Setup**

Install
```
npm i -g cf-deps
```

Get help
```
cf-deps help
cf-groups help
```

**Tips**
- Use environment variables for configuring options so that both cf-deps and cf-groups use the same settings with minimal effort
- Configure `cf-deps` to run automatically on master (or trunk) for all your related projects in CI/CD
- Use the `--save` or `-s` flag with `cf-groups` to save a local file of deploy groups as a markdown file for "pretty" viewing in a markdown tool; combine this with the option for link pattern to generate clickable links to your repos


# cf-deps
- Finds cf refs (`${cf:stackName.output}`) from yaml (or yml) files
- Makes a list of stackNames (removes duplicates)
- Commit list of stackNames to git repo for aggregated storage of stack dependencies

Sample stack dependency json:
```json
{
    "stack-name-a": [],
    "stack-name-b": [
        "stack-name-a"
    ],
    "stack-name-c": [
        "stack-name-b"
    ],
    "stack-name-d": [
        "stack-name-a",
        "stack-name-c"
    ]
}
```

If you build a new stack, say "stack-name-e", and run cf-deps in it's respective CI/CD build, then it would add `"stack-name-e": [ /** list of cf stackName refs **/ ]` to the json sample above. From the living centralized dependency json, you have a quick one-stop-shop for deployment dependencies. Further automation can be built on top of this to generate deploy groups in order of their dependencies.

## Usage

Be sure to checkout `cf-deps help`

**With ENV Variables** (Useful for CI/CD with n-number of stacks)
```
export CF_DEPS_JSON_FILE="<json file to store deps in>"
export CF_DEPS_REMOTE_GIT="<git clone url for storage repo>"
export CF_DEPS_GIT_USR_NAME="<git user.name>"
export CF_DEPS_GIT_USR_MAIL="<git user.email>"
cf-deps
```

**With CLI Options**
```
cf-deps \
    -f <json file to store deps in> \
    -r <git clone url for storage repo> \
    -u <git user.name> \
    -m <git user.email>
```

## Known Limitations

Sometimes your projects can have complex CloudFormation references that the RegExp
cannot account for; An example, a cf ref to itself in a different region, like so:

```
${cf.${self:custom.replicationRegion}:${self:service}-${opt:stage}.BucketName}
```
In this case, a stackName, "custom" would be collected by `cf-deps`, but this isn't
realistic. Instead, you can add "custom" as an excludes. See `cf-deps help`.

# cf-groups

- Clones the latest commit on the repo branch specified; should be the storage repo specified for _cf-deps_
- Generates ordered deploy groups based on dependencies provided in the storage repo
- Can include all recorded stacks based on dependencies or a subset provided by options
- Creates a list of missed dependencies if deploy set does not include them all
- Has an option to specify a custom filter for dependencies (in case you have stacks that do not record dependencies in yml/yaml files in the `${cf:stackName.output}` format)

**Sample Dependencies Filter**
- Store the custom filter as a *.js file in the storage repo

```js
module.exports = (repoName, deps) => {
  if (repoName !== 'account-resources') {
    // such as a stack that provisions foundational
    // things that must come before anything else
    deps.push('account-resources');
  }
  if (repoName.endsWith('-client')
    || [
      'hello-world-app',
      'idk-poc',
      'tech-debt-thing',
    ].includes(repoName)) {
        
    deps.push('shared-client-resources');
    deps.push('some-important-server');
  }
};
```

---

## Working with the Source Code

Install the things and link cf-deps for CLI use:
```
npm ci
npm link
```

### Local Git Server

This source code includes a simple local git server (requires docker and docker-compose)
which can make testing easier and faster.

#### Build and Run

1. Build the needful
    ```bash
    docker-compose build
    ```
2. Run the needful
    ```bash
    docker-compose up
    ```

With the docker-compose stack running, you can clone the repo(s) that are in the
local git server

```bash
cd /tmp && git clone git://localhost/cf-deps-store
```

On startup (aka, during `docker-compose up`), the git-server initiates git repos
from the folders in the [test/git-server/seed-repos](test/git-server/seed-repos/). You can
then clone the repo(s), change, commit, and push them as needed while the server
is running. Restart the server and start over from the seed-state.

#### Stop/Start

Currently, the **git-server cannot handle start/stop** of the container, so you have
to make sure to remove the container before starting again; simply run:

```bash
docker-compose down
```

Then you can run the needful again:
```bash
docker-compose up
```