/**
 * Symlinks expo-router from apps/mobile into the root node_modules so that
 * babel-preset-expo (installed at root) can detect it via hasModule('expo-router').
 * Without this, expoRouterBabelPlugin is never added and process.env.EXPO_ROUTER_APP_ROOT
 * is not replaced, causing Metro to crash on _ctx.android.js.
 */
const { existsSync, symlinkSync, lstatSync } = require('fs')
const { join } = require('path')

const root = __dirname.replace(/[\\/]scripts$/, '')
const src  = join(root, 'apps', 'mobile', 'node_modules', 'expo-router')
const dest = join(root, 'node_modules', 'expo-router')

if (!existsSync(src)) {
  // expo-router not installed yet (e.g. first install before workspace packages exist)
  process.exit(0)
}

if (existsSync(dest)) {
  // Already there — either hoisted or a previous symlink
  process.exit(0)
}

try {
  symlinkSync(src, dest, 'dir')
  console.log('✓ Symlinked expo-router into root node_modules for babel-preset-expo')
} catch (e) {
  console.warn('Could not symlink expo-router:', e.message)
}
