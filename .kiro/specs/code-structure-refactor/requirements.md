# Requirements Document

## Introduction

This specification covers the structural refactoring of two large files in the Focus desktop application: `electron/main.js` (1287 lines) and `frontend/src/views/Create.tsx` (1022 lines). The goal is to decompose these monolithic files into well-bounded modules while preserving all existing functionality with zero regressions. The refactor addresses code review findings from Issue #6 (Electron main.js) and Issue #8 (Create.tsx state management).

## Glossary

- **Main_Process**: The Electron main process entry point (`electron/main.js`) responsible for application lifecycle, backend process management, window creation, IPC handling, logging, and menu building
- **Process_Manager**: The proposed module (`electron/processManager.js`) responsible for Go backend process lifecycle: spawning, health checking, port discovery, and cleanup
- **Window_Manager**: The proposed module (`electron/windowManager.js`) responsible for BrowserWindow creation, configuration, and frontend loading
- **IPC_Handlers**: The proposed module (`electron/ipcHandlers.js`) responsible for registering and handling all `ipcMain.handle` channels
- **Create_View**: The React component (`frontend/src/views/Create.tsx`) that provides the image generation creation interface
- **Generation_State_Hook**: The proposed custom React hook (`frontend/src/hooks/useGenerationState.ts`) that encapsulates `pendingTasks`, `batchResults`, and `failedGenerations` state and their associated mutation logic
- **Preload_Bridge**: The preload script (`electron/preload.js`) that exposes IPC channels to the renderer process via `contextBridge`
- **SSE_Generation_Hook**: The existing custom hook (`frontend/src/hooks/useSSEGeneration.ts`) that manages SSE streaming state, used as a pattern reference for the new hook

## Requirements

### Requirement 1: Extract Process Manager Module

**User Story:** As a developer, I want backend process lifecycle management extracted into a dedicated `processManager.js` module, so that process spawning, health checking, and cleanup logic is isolated and independently testable.

#### Acceptance Criteria

1. THE Process_Manager SHALL export functions for `startBackend`, `cleanup`, `getBackendPath`, `validateBackendPath`, `ensureDirectories`, `checkBackendHealth`, `readPortFromFile`, and `getPortFilePath`
2. THE Process_Manager SHALL accept configuration parameters (userDataPath, isDev, mainWindow reference) rather than relying on module-level globals from Main_Process
3. WHEN `startBackend` is called, THE Process_Manager SHALL spawn the Go backend process, configure environment variables, attach stdout/stderr listeners, and initiate health checking, identical to the current `main.js` implementation
4. WHEN `cleanup` is called, THE Process_Manager SHALL terminate the backend process using platform-appropriate methods (taskkill on Windows, SIGTERM/SIGKILL on Unix) and clean temporary files, identical to the current `main.js` cleanup function
5. IF the backend process exits abnormally, THEN THE Process_Manager SHALL notify the main window via `backend-error` IPC event and offer a restart dialog, identical to current behavior
6. THE Process_Manager SHALL maintain the same health check retry logic with port file discovery that exists in the current `main.js`
7. WHEN `cleanup` is called multiple times, THE Process_Manager SHALL execute cleanup only once using the existing guard flags (`isCleaningUp`, `cleanupComplete`)

### Requirement 2: Extract Window Manager Module

**User Story:** As a developer, I want window creation and management extracted into a dedicated `windowManager.js` module, so that window configuration is separated from process management and IPC handling.

#### Acceptance Criteria

1. THE Window_Manager SHALL export a `createWindow` function that creates and configures the main BrowserWindow with the same options as the current implementation (1400x900, context isolation, preload script, icon)
2. WHEN running in development mode, THE Window_Manager SHALL load the Vite dev server URL (`http://localhost:5174`) and open DevTools
3. WHEN running in production mode, THE Window_Manager SHALL load the packaged `frontend/dist/index.html` from `app.getAppPath()`
4. IF the frontend index.html file does not exist in production, THEN THE Window_Manager SHALL display an error dialog with the missing file path and list directory contents for debugging
5. THE Window_Manager SHALL apply the Chinese menu (from `createChineseMenu`) with DevTools visibility controlled by `isDev` or `ENABLE_PROD_LOG`
6. THE Window_Manager SHALL accept configuration parameters (isDev, ENABLE_PROD_LOG) rather than relying on module-level globals from Main_Process

### Requirement 3: Extract IPC Handlers Module

**User Story:** As a developer, I want all IPC handler registrations extracted into a dedicated `ipcHandlers.js` module, so that the communication contract between main and renderer processes is centralized and easy to audit.

#### Acceptance Criteria

1. THE IPC_Handlers SHALL export a `registerHandlers` function that registers all `ipcMain.handle` channels currently defined in `main.js`
2. THE IPC_Handlers SHALL register handlers for channels: `get-backend-url`, `get-app-version`, `get-user-data-path`, `get-paths`, `save-image`, `get-version-info`, `check-update`, and `open-download-url`
3. THE IPC_Handlers SHALL accept dependencies (mainWindow, userDataPath, readPortFromFile, actualBackendPort) as parameters rather than relying on module-level globals
4. WHEN `get-backend-url` is invoked, THE IPC_Handlers SHALL read the latest port from the port file and return the backend URL, identical to current behavior
5. WHEN `save-image` is invoked, THE IPC_Handlers SHALL handle base64 data URLs, remote HTTP/HTTPS URLs, and raw base64 strings, converting them to file buffers and saving via a system save dialog, identical to current behavior
6. THE Preload_Bridge SHALL continue to function without modification after the IPC handler extraction

### Requirement 4: Orchestrate Refactored Modules in Main Process

**User Story:** As a developer, I want `main.js` to serve as a thin orchestration layer that imports and coordinates the extracted modules, so that the entry point is concise and the application startup sequence remains unchanged.

#### Acceptance Criteria

1. THE Main_Process SHALL import Process_Manager, Window_Manager, and IPC_Handlers and coordinate them in the `app.whenReady` lifecycle
2. THE Main_Process SHALL maintain the same startup sequence: initialize environment detection, set up logging, create window, start backend, register IPC handlers
3. THE Main_Process SHALL maintain the same signal handlers (SIGINT, SIGTERM), uncaught exception handler, and unhandled rejection handler that delegate to Process_Manager cleanup
4. THE Main_Process SHALL maintain the `migrateOldData` function call and data migration logic in the startup sequence
5. THE Main_Process SHALL retain the logging initialization (`initializeLogging`, `shouldEnableLog`) and menu creation (`createChineseMenu`) either inline or as a separate logging/menu module
6. WHEN the refactored Main_Process starts, THE application SHALL exhibit identical behavior to the pre-refactor version from the user's perspective

### Requirement 5: Extract Generation State Hook from Create View

**User Story:** As a developer, I want `pendingTasks`, `batchResults`, and `failedGenerations` state extracted into a `useGenerationState` custom hook, so that generation-related state management is encapsulated and the Create component is simplified.

#### Acceptance Criteria

1. THE Generation_State_Hook SHALL manage `pendingTasks` (type `PendingTask[]`), `batchResults` (type `BatchResult[]`), and `failedGenerations` (type `FailedGeneration[]`) state using `useState`
2. THE Generation_State_Hook SHALL export the state values and their setter functions: `pendingTasks`, `setPendingTasks`, `batchResults`, `setBatchResults`, `failedGenerations`, `setFailedGenerations`
3. THE Generation_State_Hook SHALL export the `removePendingTask` callback that filters pending tasks by `tempId`, `taskId`, or `batchId`, identical to the current implementation in Create_View
4. THE Generation_State_Hook SHALL export the `updatePendingTaskBatchId` callback that updates a pending task's `batchId` by `tempId`, identical to the current implementation in Create_View
5. THE Generation_State_Hook SHALL export the `batchHasFailedImages` utility callback that checks whether a batch contains images with errors
6. THE Generation_State_Hook SHALL follow the same hook conventions as SSE_Generation_Hook: TypeScript interface for params and return type, JSDoc comments on exported members, `useCallback` for memoized functions
7. WHEN the Generation_State_Hook is integrated into Create_View, THE Create_View SHALL remove the extracted `useState` declarations and callbacks, replacing them with the hook's return values

### Requirement 6: Preserve Functional Equivalence

**User Story:** As a developer, I want the refactored code to produce identical runtime behavior, so that no regressions are introduced.

#### Acceptance Criteria

1. WHEN the Electron application starts after refactoring, THE application SHALL create the main window, start the backend, register IPC handlers, and complete health checks identically to the pre-refactor version
2. WHEN the renderer process calls any IPC channel via Preload_Bridge, THE response SHALL be identical to the pre-refactor version
3. WHEN the Create_View renders after refactoring, THE component SHALL manage pending tasks, batch results, and failed generations identically to the pre-refactor version
4. THE existing test file `electron/main.test.js` SHALL continue to pass after the refactor, with test updates only to accommodate the new module structure
5. IF any existing hook (useSSEGeneration, useTaskRecovery, useAsyncGeneration) interacts with the extracted generation state, THEN THE interaction SHALL remain functionally identical after refactoring
