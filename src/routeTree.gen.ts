/* eslint-disable */
// @ts-nocheck
import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as DeskRouteImport } from './routes/desk'
import { Route as LoginRouteImport } from './routes/login'
import { Route as BSlugRouteImport } from './routes/b.$slug'
import { Route as ApiAuthSplatRouteImport } from './routes/api/auth/$'

const IndexRoute = IndexRouteImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRouteImport,
} as any)
const DeskRoute = DeskRouteImport.update({
  id: '/desk',
  path: '/desk',
  getParentRoute: () => rootRouteImport,
} as any)
const LoginRoute = LoginRouteImport.update({
  id: '/login',
  path: '/login',
  getParentRoute: () => rootRouteImport,
} as any)
const BSlugRoute = BSlugRouteImport.update({
  id: '/b/$slug',
  path: '/b/$slug',
  getParentRoute: () => rootRouteImport,
} as any)
const ApiAuthSplatRoute = ApiAuthSplatRouteImport.update({
  id: '/api/auth/$',
  path: '/api/auth/$',
  getParentRoute: () => rootRouteImport,
} as any)

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/desk': typeof DeskRoute
  '/login': typeof LoginRoute
  '/b/$slug': typeof BSlugRoute
  '/api/auth/$': typeof ApiAuthSplatRoute
}
export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/desk': typeof DeskRoute
  '/login': typeof LoginRoute
  '/b/$slug': typeof BSlugRoute
  '/api/auth/$': typeof ApiAuthSplatRoute
}
export interface FileRoutesById {
  __root__: typeof rootRouteImport
  '/': typeof IndexRoute
  '/desk': typeof DeskRoute
  '/login': typeof LoginRoute
  '/b/$slug': typeof BSlugRoute
  '/api/auth/$': typeof ApiAuthSplatRoute
}
export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths: '/' | '/desk' | '/login' | '/b/$slug' | '/api/auth/$'
  fileRoutesByTo: FileRoutesByTo
  to: '/' | '/desk' | '/login' | '/b/$slug' | '/api/auth/$'
  id: '__root__' | '/' | '/desk' | '/login' | '/b/$slug' | '/api/auth/$'
  fileRoutesById: FileRoutesById
}
export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  DeskRoute: typeof DeskRoute
  LoginRoute: typeof LoginRoute
  BSlugRoute: typeof BSlugRoute
  ApiAuthSplatRoute: typeof ApiAuthSplatRoute
}

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': { id: '/'; path: '/'; fullPath: '/'; preLoaderRoute: typeof IndexRouteImport; parentRoute: typeof rootRouteImport }
    '/desk': { id: '/desk'; path: '/desk'; fullPath: '/desk'; preLoaderRoute: typeof DeskRouteImport; parentRoute: typeof rootRouteImport }
    '/login': { id: '/login'; path: '/login'; fullPath: '/login'; preLoaderRoute: typeof LoginRouteImport; parentRoute: typeof rootRouteImport }
    '/b/$slug': { id: '/b/$slug'; path: '/b/$slug'; fullPath: '/b/$slug'; preLoaderRoute: typeof BSlugRouteImport; parentRoute: typeof rootRouteImport }
    '/api/auth/$': { id: '/api/auth/$'; path: '/api/auth/$'; fullPath: '/api/auth/$'; preLoaderRoute: typeof ApiAuthSplatRouteImport; parentRoute: typeof rootRouteImport }
  }
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute: IndexRoute,
  DeskRoute: DeskRoute,
  LoginRoute: LoginRoute,
  BSlugRoute: BSlugRoute,
  ApiAuthSplatRoute: ApiAuthSplatRoute,
}
export const routeTree = rootRouteImport
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()

import type { getRouter } from './router.tsx'
import type { createStart } from '@tanstack/react-start'
declare module '@tanstack/react-start' {
  interface Register {
    ssr: true
    router: Awaited<ReturnType<typeof getRouter>>
  }
}
