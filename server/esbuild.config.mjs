import * as esbuild from 'esbuild'
import * as fs from 'fs'
import * as path from 'path'

// --- 1. Bundle the server ---

const externalPackages = [
  'better-sqlite3',
  'ffmpeg-static',
  'ffprobe-static',
  // Pino uses worker threads that resolve files relative to their own package
  'pino',
  'pino-pretty',
  'pino-abstract-transport',
  'pino-std-serializers',
  'sonic-boom',
  'thread-stream',
]

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: 'dist/index.js',
  sourcemap: true,
  external: [
    ...externalPackages,
    'pino-*', // catch any pino sub-packages
  ],
})

// --- 2. Copy external packages + transitive deps into dist/node_modules ---

const srcModules = path.resolve('node_modules')
const destModules = path.resolve('dist', 'node_modules')

// Clean previous copy
if (fs.existsSync(destModules)) {
  fs.rmSync(destModules, { recursive: true })
}
fs.mkdirSync(destModules, { recursive: true })

// Packages that are only needed at install/build time, not runtime
const buildOnlyPackages = new Set([
  'prebuild-install', 'node-abi', 'napi-build-utils', 'detect-libc',
  'expand-template', 'github-from-package', 'mkdirp-classic', 'rc',
  'deep-extend', 'ini', 'simple-get', 'simple-concat', 'decompress-response',
  'mimic-response', 'tar-fs', 'tar-stream', 'bl', 'fs-constants',
  'chownr', 'tunnel-agent', '@types/node', 'undici-types',
  // ffmpeg-static install-time deps (downloads binary during npm install)
  '@derhuerst/http-basic', 'caseless', 'concat-stream', 'http-response-object',
  'parse-cache-control', 'https-proxy-agent', 'agent-base', 'debug', 'ms',
  'progress', 'env-paths', 'buffer-from', 'typedarray',
])

// Recursively collect all transitive dependencies
function collectDeps(pkgName, visited = new Set()) {
  if (visited.has(pkgName)) return
  if (buildOnlyPackages.has(pkgName)) return
  visited.add(pkgName)

  const pkgDir = path.join(srcModules, pkgName)
  if (!fs.existsSync(pkgDir)) return

  const pkgJsonPath = path.join(pkgDir, 'package.json')
  if (!fs.existsSync(pkgJsonPath)) return

  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))
  const deps = pkgJson.dependencies || {}
  for (const dep of Object.keys(deps)) {
    collectDeps(dep, visited)
  }

  return visited
}

const allPackages = new Set()
for (const pkg of externalPackages) {
  collectDeps(pkg, allPackages)
}

// Copy each package
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

let copiedCount = 0
for (const pkg of [...allPackages].sort()) {
  const src = path.join(srcModules, pkg)
  const dest = path.join(destModules, pkg)
  if (fs.existsSync(src)) {
    copyDirSync(src, dest)
    copiedCount++
  } else {
    console.warn(`  [warn] External package not found: ${pkg}`)
  }
}

console.log(`Bundled server → dist/index.js`)
console.log(`Copied ${copiedCount} external packages → dist/node_modules/`)
