# Implementation Plan

- [x] 1. Implement Go port discovery utilities





  - Create `backend/utils/port.go` with port detection and file I/O functions
  - Implement `IsPortAvailable` to check if a port is free
  - Implement `FindAvailablePort` to search for available ports sequentially
  - Implement `WritePortFile` and `ReadPortFile` for port file operations
  - Implement `GetPortFilePath` to determine correct temp directory based on OS
  - _Requirements: 1.1, 1.2, 4.1, 4.2_

- [x] 1.1 Write property test for port conflict auto-switching


  - **Property 1: Port conflict auto-switching**
  - **Validates: Requirements 1.1, 2.1**



- [x] 1.2 Write property test for port file round-trip

  - **Property 2: Port file creation on successful binding**

  - **Validates: Requirements 1.2, 2.2**

- [x] 1.3 Write property test for attempt limit enforcement

  - **Property 3: Attempt limit enforcement**
  - **Validates: Requirements 1.5, 2.4**



- [x] 1.4 Write property test for port file location consistency

  - **Property 8: Port file location consistency**
  - **Validates: Requirements 4.1, 4.2**

- [x] 2. Integrate port discovery into backend server startup





  - Modify `backend/config/config.go` to add auto-discovery configuration
  - Add `AUTO_PORT_DISCOVERY` environment variable support (default: true)
  - Update `backend/main.go` to use `FindAvailablePort` instead of direct binding
  - Write actual port to port file after successful binding
  - Add cleanup handler to remove port file on graceful shutdown
  - Log the actual listening address to console
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.3, 5.1, 5.3, 5.4_

- [x] 2.1 Write property test for disabled auto-discovery behavior


  - **Property 10: Disabled auto-discovery behavior**
  - **Validates: Requirements 5.1, 5.2, 5.4**

- [x] 2.2 Write property test for immediate failure when auto-discovery disabled


  - **Property 11: Immediate failure when auto-discovery disabled**
  - **Validates: Requirements 5.3**

- [x] 3. Checkpoint - Verify backend port discovery





  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement TypeScript port discovery utilities





  - Create `frontend/src/utils/portDiscovery.ts`
  - Implement `getPortFilePath` to determine temp directory based on OS
  - Implement `readBackendPort` to read backend port from file
  - Implement `getBackendURL` to construct backend URL with fallback to default
  - Handle file read errors gracefully with fallback to default port (8080)
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 4.1 Write unit tests for TypeScript port discovery utilities


  - Test `readBackendPort` with valid and invalid port files
  - Test `getBackendURL` with various port values
  - Test fallback behavior when port file doesn't exist
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 5. Create Vite plugin for port discovery and injection





  - Create `frontend/vite-plugin-port-discovery.ts`
  - Implement plugin that reads backend port on Vite startup
  - Inject backend URL into `import.meta.env.VITE_BACKEND_URL`
  - Add file watcher to detect backend port file changes
  - Trigger HMR (Hot Module Replacement) when backend port changes
  - Log backend URL to console on startup and changes
  - _Requirements: 3.1, 3.3, 3.4_


- [x] 5.1 Write property test for frontend reads backend port file

  - **Property 5: Frontend reads backend port file**
  - **Validates: Requirements 3.1**

- [x] 5.2 Write property test for backend URL injection


  - **Property 6: Backend URL injection**
  - **Validates: Requirements 3.3**

- [x] 5.3 Write property test for port file change detection


  - **Property 7: Port file change detection**
  - **Validates: Requirements 3.4**

- [x] 6. Integrate Vite plugin into frontend configuration





  - Update `frontend/vite.config.ts` to use the port discovery plugin
  - Configure plugin with backend port file path
  - Set default backend port to 8080 for fallback
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 7. Update frontend API client to use dynamic backend URL

  - Locate frontend API client code (likely in `frontend/src/`)
  - Replace hardcoded backend URL with `import.meta.env.VITE_BACKEND_URL`
  - Ensure all API calls use the dynamic URL
  - _Requirements: 3.3_

- [x] 8. Add frontend port auto-discovery (optional enhancement)





  - Modify Vite config to attempt multiple ports if default is occupied
  - Write frontend port to port file after successful binding
  - This allows running multiple frontend instances simultaneously
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 8.1 Write property test for console logging on successful start


  - **Property 4: Console logging on successful start**
  - **Validates: Requirements 1.4, 2.3**

- [x] 8.2 Write property test for port file cleanup on exit


  - **Property 9: Port file cleanup on exit**
  - **Validates: Requirements 4.3**




- [ ] 9. Final checkpoint - Integration testing



  - Ensure all tests pass, ask the user if questions arise.
