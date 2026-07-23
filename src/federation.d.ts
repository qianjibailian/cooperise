declare module 'qianjisanWWW/SideDrawer' {
  import type { ComponentType } from 'react'
  interface SideDrawerProps {
    open: boolean
    onClose: () => void
    selectedKey?: string
    onMenuClick?: (key: string) => void
    menuPath?: string
    menuKey?: string
    forceOpen?: boolean
  }
  const SideDrawer: ComponentType<SideDrawerProps>
  export default SideDrawer
}

declare module 'qianjisanWWW/Header' {
  import type { ComponentType } from 'react'
  const Header: ComponentType<{ onMenuClick: () => void; drawerOpen?: boolean }>
  export default Header
}

declare module 'qianjisanWWW/api/menu' {
  export interface MenuItem {
    id: number
    name: string
    code: string
    position: number
    parentId: number
    path: string
    url: string
    icon: string
    sortOrder: number
    status: number
    type: number
    description: string
    createdAt: string
    updatedAt: string
    children: MenuItem[] | null
  }
  export function getTopMenu(): Promise<{ data: MenuItem[] }>
  export function getSideMenu(path: string, menuKey: string): Promise<{ success: boolean; message: string; data: MenuItem[] }>
}
