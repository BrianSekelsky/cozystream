import type { ForgeConfig } from '@electron-forge/shared-types'
import { MakerDMG } from '@electron-forge/maker-dmg'
import { MakerZIP } from '@electron-forge/maker-zip'
import * as fs from 'fs'
import * as pathMod from 'path'

const config: ForgeConfig = {
  packagerConfig: {
    name: 'CozyStream',
    executableName: 'cozystream',
    appBundleId: 'com.cozystream.app',
    icon: './assets/icon',
    asar: true,
    extraResource: [
      './server/dist',
      './dist/cozystream-angular/browser',
      './assets',
    ],
    darwinDarkModeSupport: true,
    // Allowlist: only include files the Electron main process needs in the asar.
    // Everything else (server, frontend, assets) is in extraResource.
    ignore: (path: string) => {
      if (!path) return false
      // Always include package.json (Electron needs it for "main" entry)
      if (path === '/package.json') return false
      // Include the compiled Electron code
      if (path === '/electron' || path === '/electron/dist' || path.startsWith('/electron/dist/')) return false
      // Exclude everything else
      return true
    },
  },
  hooks: {
    postPackage: async (_config, result) => {
      for (const outputPath of result.outputPaths) {
        const resourcesDir = pathMod.join(outputPath, 'CozyStream.app', 'Contents', 'Resources')
        // External packages are inside dist/node_modules (copied by esbuild.config.mjs)
        const nodeModulesDir = pathMod.join(resourcesDir, 'dist', 'node_modules')

        if (!fs.existsSync(nodeModulesDir)) continue

        // 1. Strip non-current-platform binaries from ffprobe-static
        const ffprobeBase = pathMod.join(nodeModulesDir, 'ffprobe-static', 'bin')
        if (fs.existsSync(ffprobeBase)) {
          for (const dir of fs.readdirSync(ffprobeBase)) {
            if (dir !== process.platform) {
              fs.rmSync(pathMod.join(ffprobeBase, dir), { recursive: true, force: true })
              console.log(`  [cleanup] Removed ffprobe-static/bin/${dir}`)
            }
          }
          const platformDir = pathMod.join(ffprobeBase, process.platform)
          if (fs.existsSync(platformDir)) {
            for (const dir of fs.readdirSync(platformDir)) {
              if (dir !== process.arch) {
                fs.rmSync(pathMod.join(platformDir, dir), { recursive: true, force: true })
                console.log(`  [cleanup] Removed ffprobe-static/bin/${process.platform}/${dir}`)
              }
            }
          }
        }

        // 2. Strip non-current-platform binaries from ffmpeg-static
        const ffmpegPkg = pathMod.join(nodeModulesDir, 'ffmpeg-static')
        if (fs.existsSync(ffmpegPkg)) {
          // ffmpeg-static stores the binary directly in the package root
          // Remove platform-specific download cache and unnecessary files
          for (const entry of fs.readdirSync(ffmpegPkg)) {
            if (entry === 'bin' || entry === 'scripts' || entry === 'test') {
              fs.rmSync(pathMod.join(ffmpegPkg, entry), { recursive: true, force: true })
              console.log(`  [cleanup] Removed ffmpeg-static/${entry}`)
            }
          }
        }

        // 3. Remove prebuild-install (only needed at install time, not runtime)
        const prebuildInstall = pathMod.join(nodeModulesDir, 'prebuild-install')
        if (fs.existsSync(prebuildInstall)) {
          fs.rmSync(prebuildInstall, { recursive: true, force: true })
          console.log('  [cleanup] Removed prebuild-install')
        }

        // 4. Remove .d.ts and .map files
        const removeGlob = (dir: string, pattern: RegExp) => {
          if (!fs.existsSync(dir)) return
          for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
            if (entry.isFile() && pattern.test(entry.name)) {
              const fullPath = pathMod.join(entry.parentPath || entry.path, entry.name)
              fs.unlinkSync(fullPath)
            }
          }
        }
        removeGlob(nodeModulesDir, /\.d\.ts$/)
        removeGlob(nodeModulesDir, /\.map$/)
        console.log('  [cleanup] Removed .d.ts and .map files from node_modules')
      }
    },
  },
  makers: [
    new MakerDMG({
      format: 'ULFO',
    }),
    new MakerZIP({}, ['darwin', 'linux']),
  ],
}

export default config
