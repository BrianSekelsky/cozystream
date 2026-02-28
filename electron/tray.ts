import { Tray, Menu, nativeImage, app, shell } from 'electron'
import * as path from 'path'

let tray: Tray | null = null

export function createTray(port: number, triggerScan: () => void): void {
  const IS_DEV = !app.isPackaged

  const iconName = process.platform === 'darwin' ? 'tray-iconTemplate.png' : 'tray-icon.png'
  const iconPath = IS_DEV
    ? path.join(__dirname, '..', 'assets', iconName)
    : path.join(process.resourcesPath!, 'assets', iconName)

  const icon = nativeImage.createFromPath(iconPath)
  tray = new Tray(icon)

  const url = IS_DEV ? 'http://localhost:4200' : `http://localhost:${port}`

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open CozyStream',
      click: () => shell.openExternal(url),
    },
    { type: 'separator' },
    {
      label: 'Check for Library Updates',
      click: () => triggerScan(),
    },
    {
      label: 'Preferences...',
      click: () => shell.openExternal(`${url}/settings`),
    },
    { type: 'separator' },
    {
      label: 'Quit CozyStream',
      click: () => app.quit(),
    },
  ])

  tray.setContextMenu(contextMenu)
  tray.setToolTip('CozyStream Media Server')
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
