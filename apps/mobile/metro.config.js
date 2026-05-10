const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')
const fs = require('fs')

const projectRoot = __dirname
const monorepoNodeModules = path.resolve(projectRoot, '../../node_modules')

const config = getDefaultConfig(projectRoot)

// In local monorepo dev, packages are hoisted to the workspace root.
// In EAS Build, everything is installed fresh into apps/mobile/node_modules.
if (fs.existsSync(monorepoNodeModules)) {
  config.watchFolders = [monorepoNodeModules]
  config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, 'node_modules'),
    monorepoNodeModules,
  ]
}

module.exports = config
