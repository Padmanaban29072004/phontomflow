import { ComponentType } from 'react'
import {
  HomeIcon,
  ShieldExclamationIcon,
  ChartBarIcon,
  BeakerIcon,
  ShareIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline'
import { DashboardPage } from '../pages/DashboardPage'
import { ThreatsPage } from '../pages/ThreatsPage'
import { AnalyticsPage } from '../pages/AnalyticsPage'
import { DeceptionPage } from '../pages/DeceptionPage'
import { GraphPage } from '../pages/GraphPage'
import { SettingsPage } from '../pages/SettingsPage'

export const APP_BASE = '/app'

export interface AppRoute {
  path: string
  label: string
  icon: ComponentType<{ className?: string }>
  element: ComponentType
  showInNav?: boolean
}

/** All authenticated app pages — URL is `/app/<path>`. */
export const APP_ROUTES: AppRoute[] = [
  { path: 'dashboard', label: 'Dashboard', icon: HomeIcon, element: DashboardPage },
  { path: 'threats', label: 'Threats', icon: ShieldExclamationIcon, element: ThreatsPage },
  { path: 'analytics', label: 'Analytics', icon: ChartBarIcon, element: AnalyticsPage },
  { path: 'deception', label: 'Deception', icon: BeakerIcon, element: DeceptionPage },
  { path: 'graph', label: 'Graph', icon: ShareIcon, element: GraphPage },
  { path: 'settings', label: 'Settings', icon: Cog6ToothIcon, element: SettingsPage },
]

export function appPath(segment: string): string {
  return `${APP_BASE}/${segment.replace(/^\//, '')}`
}

export const DEFAULT_APP_ROUTE = appPath('dashboard')
