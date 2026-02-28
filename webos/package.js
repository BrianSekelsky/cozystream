/**
 * Package the TV Angular build into a webOS-ready directory.
 *
 * Usage:
 *   node webos/package.js
 *
 * This copies the Angular build output and webOS manifest/icons into webos/build/,
 * then (if ares-package is available) creates a .ipk file.
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const webosDir = __dirname
const projectRoot = path.resolve(webosDir, '..')
const tvBuildDir = path.join(projectRoot, 'dist', 'cozystream-tv', 'browser')
const buildDir = path.join(webosDir, 'build')

// Clean previous build
if (fs.existsSync(buildDir)) {
  fs.rmSync(buildDir, { recursive: true })
}
fs.mkdirSync(buildDir, { recursive: true })

// Copy Angular TV build
if (!fs.existsSync(tvBuildDir)) {
  console.error(`TV build not found at ${tvBuildDir}. Run 'npm run build:tv' first.`)
  process.exit(1)
}

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

copyDirSync(tvBuildDir, buildDir)
console.log(`Copied TV build → ${buildDir}`)

// Rename index.tv.html → index.html (Angular outputs the filename from the config)
const tvIndex = path.join(buildDir, 'index.tv.html')
const stdIndex = path.join(buildDir, 'index.html')
if (fs.existsSync(tvIndex)) {
  fs.renameSync(tvIndex, stdIndex)
  console.log('Renamed index.tv.html → index.html')
}

// Copy appinfo.json
fs.copyFileSync(path.join(webosDir, 'appinfo.json'), path.join(buildDir, 'appinfo.json'))
console.log('Copied appinfo.json')

// Copy icons (warn if missing)
for (const icon of ['icon80.png', 'icon130.png']) {
  const iconSrc = path.join(webosDir, icon)
  const iconDest = path.join(buildDir, icon)
  if (fs.existsSync(iconSrc)) {
    fs.copyFileSync(iconSrc, iconDest)
    console.log(`Copied ${icon}`)
  } else {
    console.warn(`Warning: ${icon} not found in webos/. You'll need to add it before submitting.`)
  }
}

// Try to create .ipk using ares-package
try {
  execSync('which ares-package', { stdio: 'pipe' })
  console.log('\nCreating .ipk package...')
  execSync(`ares-package --no-minify "${buildDir}" -o "${webosDir}"`, { stdio: 'inherit' })
  console.log('Done! .ipk file created in webos/')
} catch {
  console.log('\nares-package not found. Install the webOS SDK CLI to create .ipk files.')
  console.log('Build directory ready at: webos/build/')
  console.log('You can manually run: ares-package webos/build/ -o webos/')
}
