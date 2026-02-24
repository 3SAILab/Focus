# Tasks: Code Structure Refactor

## Task 1: Extract Process Manager Module
- [x] 1.1 Create `electron/processManager.js` with `createProcessManager` factory function that accepts `{ userDataPath, isDev, mainWindow }` config
- [x] 1.2 Move `getBackendPath`, `validateBackendPath`, `ensureDirectories` functions from `main.js` into the process manager, parameterized by config
- [x] 1.3 Move `startBackend` function into the process manager, replacing global variable references (`isDev`, `userDataPath`, `mainWindow`, `backendProcess`) with config/local state
- [x] 1.4 Move `getPortFilePath`, `readPortFromFile`, `checkBackendHealth` functions into the process manager, with `actualBackendPort` as internal state
- [x] 1.5 Move `cleanup` function into the process manager with `isCleaningUp`/`cleanupComplete` guard flags as internal state
- [x] 1.6 Export the public API: `{ startBackend, cleanup, getBackendPath, validateBackendPath, ensureDirectories, checkBackendHealth, readPortFromFile, getPortFilePath, getActualPort }`

## Task 2: Extract Window Manager Module
- [x] 2.1 Create `electron/windowManager.js` with `createWindow` function accepting `{ isDev, ENABLE_PROD_LOG, createChineseMenu }` config
- [x] 2.2 Move BrowserWindow creation logic (1400x900, context isolation, preload, icon, webSecurity) from `main.js` into `createWindow`
- [x] 2.3 Move dev/production URL loading logic (Vite dev server vs packaged index.html) and missing file error dialog into `createWindow`
- [x] 2.4 Move menu setup (`createChineseMenu` call with `isDev || ENABLE_PROD_LOG`) into `createWindow`, return the created `BrowserWindow` instance

## Task 3: Extract IPC Handlers Module
- [x] 3.1 Create `electron/ipcHandlers.js` with `registerHandlers` function accepting `{ mainWindow, userDataPath, readPortFromFile, getActualPort }` dependencies
- [x] 3.2 Move all `ipcMain.handle` registrations from `main.js` into `registerHandlers`: `get-backend-url`, `get-app-version`, `get-user-data-path`, `get-paths`, `save-image`, `get-version-info`, `check-update`, `open-download-url`
- [x] 3.3 Replace global variable references in handlers with dependency parameters (e.g., `readPortFromFile()` from deps instead of module scope)

## Task 4: Refactor main.js as Thin Orchestrator
- [x] 4.1 Rewrite `main.js` to import `createProcessManager`, `createWindow`, and `registerHandlers` from the extracted modules
- [x] 4.2 Retain inline: environment detection (`isDev`), logging initialization (`initializeLogging`, `shouldEnableLog`), `createChineseMenu`, `migrateOldData`, and constants (`DEFAULT_BACKEND_PORT`, etc.)
- [x] 4.3 Update `app.whenReady` to: detect env → init logging → migrateOldData → createWindow → createProcessManager + startBackend → registerHandlers
- [x] 4.4 Update signal handlers (`SIGINT`, `SIGTERM`), `uncaughtException`, `unhandledRejection`, `before-quit`, `will-quit` to delegate to `processManager.cleanup()`

## Task 5: Extract useGenerationState Hook
- [x] 5.1 Create `frontend/src/hooks/useGenerationState.ts` with `UseGenerationStateParams` and `UseGenerationStateResult` interfaces following `useSSEGeneration.ts` conventions (JSDoc, TypeScript interfaces)
- [x] 5.2 Implement `useGenerationState` hook with `useState` for `pendingTasks`, `batchResults`, `failedGenerations` and `useCallback` for `removePendingTask`, `updatePendingTaskBatchId`, `batchHasFailedImages`
- [x] 5.3 Update `Create.tsx` to import and use `useGenerationState`, removing the extracted `useState` declarations and callback definitions

## Task 6: Update Existing Tests
- [x] 6.1 Update `electron/main.test.js` to test the refactored module structure (import from new modules, adjust mocks)
- [x] 6.2 Create `electron/processManager.test.js` with unit tests for process manager API surface, env var configuration, platform cleanup, and cleanup idempotence
- [x] 6.3 Create `electron/ipcHandlers.test.js` with unit tests for channel registration and handler behavior
- [x] 6.4 Create `frontend/src/hooks/useGenerationState.test.ts` with unit tests for hook interface, initial state, and callback behavior

## Task 7: Property-Based Tests
- [x] 7.1 Add fast-check dependency to the project
- [x] 7.2 Write property tests for processManager: API surface (Property 1), env vars (Property 2), platform cleanup (Property 3), abnormal exit notification (Property 4), health check retry (Property 5), cleanup idempotence (Property 6)
- [x] 7.3 Write property tests for windowManager: menu DevTools flag (Property 7)
- [x] 7.4 Write property tests for ipcHandlers: channel registration (Property 8), backend URL from port (Property 9), image data format detection (Property 10)
- [x] 7.5 Write property tests for useGenerationState: removePendingTask filtering (Property 11), updatePendingTaskBatchId (Property 12), batchHasFailedImages (Property 13), hook interface completeness (Property 14)

## Task 8: Verify Functional Equivalence
- [x] 8.1 Run all existing tests (`electron/main.test.js`) and verify they pass with the refactored structure
- [x] 8.2 Verify `electron/preload.js` is unmodified
- [x] 8.3 Manually verify application startup: window creation, backend start, health check, IPC responses
