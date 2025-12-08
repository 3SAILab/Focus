# Testing Guide

This document describes the testing strategy for the SIGMA Electron application, including unit tests, E2E tests, and build validation tests.

## Test Structure

The project includes three types of tests:

1. **Unit Tests** - Test individual components and functions
2. **E2E Tests** - Test complete application lifecycle
3. **Build Validation Tests** - Verify build artifacts and packaging

## Running Tests

### All Tests

```bash
npm test
```

### Unit Tests Only

```bash
npm run test:unit
```

### E2E Tests

```bash
npm run test:e2e
```

### Build Validation Tests

```bash
npm run test:build
```

### Electron Tests

```bash
npm run test:electron
```

## Test Files

### Unit Tests

- `electron/main.test.js` - Tests for Electron main process
- `electron/tls-manager.test.js` - Tests for TLS certificate manager
- `backend/server/tls_test.go` - Tests for backend TLS server
- `backend/config/config_test.go` - Tests for backend configuration
- `backend/utils/port_test.go` - Tests for port management
- `frontend/src/api/index.test.ts` - Tests for frontend API client
- `frontend/src/utils/portDiscovery.test.ts` - Tests for port discovery
- `frontend/vite-plugin-port-discovery.test.ts` - Tests for Vite plugin

### E2E Tests

- `electron/e2e.test.js` - End-to-end application lifecycle tests

**Test Coverage:**
- Application startup flow
- Backend process management with TLS
- Frontend-backend HTTPS communication
- Certificate generation and validation
- Application shutdown and cleanup
- Process termination (Windows and Unix)

**Requirements Validated:**
- 3.1: Automatic backend process startup
- 3.2: Health check mechanism
- 3.3: Process cleanup on exit
- 8.1: HTTPS communication
- 8.2: Encrypted data transmission
- 8.3: TLS certificate generation
- 8.4: Self-signed certificate trust

### Build Validation Tests

- `electron/build-validation.test.js` - Build artifact validation tests

**Test Coverage:**
- Pre-build validation (frontend dist, backend executable, assets)
- Windows NSIS installer validation
- macOS DMG validation
- Linux AppImage validation
- Package contents validation
- Build scripts validation
- Artifact naming conventions
- Resource packaging
- Installation configuration

**Requirements Validated:**
- 2.2: Windows cmd compatibility
- 5.1: Windows NSIS installer
- 5.2: macOS DMG
- 5.3: Linux AppImage
- 5.4: Custom installation directory
- 5.5: Desktop and start menu shortcuts
- 6.3: Complete file packaging

## E2E Test Prerequisites

Before running E2E tests, ensure:

1. **Go is installed** - Backend requires Go 1.25+
2. **Backend can be built** - Run `npm run build:backend:win`
3. **TLS certificates can be generated** - Requires Node.js crypto module

### Expected E2E Test Behavior

Some E2E tests may show warnings if the backend is not running:
- "Backend not running, skipping health check test"
- "Backend not running, skipping HTTPS connection test"

This is expected behavior when running tests without a full backend setup.

## Build Validation Prerequisites

Before running build validation tests:

1. **Build frontend** (optional):
   ```bash
   npm run build:frontend
   ```

2. **Build backend** (optional):
   ```bash
   npm run build:backend:win
   ```

3. **Create release packages** (optional):
   ```bash
   npm run dist:win    # Windows
   npm run dist:mac    # macOS
   npm run dist:linux  # Linux
   ```

### Expected Build Validation Behavior

Build validation tests will show warnings if artifacts are not built:
- "Frontend dist not found. Run 'npm run build:frontend' first."
- "Backend dist not found. Run 'npm run build:backend:win' first."
- "Release directory not found. Run 'npm run dist:win' first."

These warnings are informational and do not cause test failures. The tests validate the configuration even without built artifacts.

## Test Configuration

### Jest Configuration

The project uses Jest for JavaScript/TypeScript testing:

```javascript
// jest.config.js
{
  testEnvironment: 'node',
  testMatch: ['**/electron/**/*.test.js'],
  testTimeout: 60000, // 60 seconds for E2E tests
  verbose: true
}
```

### Vitest Configuration

Frontend tests use Vitest:

```typescript
// frontend/vitest.config.ts
{
  test: {
    environment: 'jsdom',
    globals: true
  }
}
```

## Writing New Tests

### Unit Test Example

```javascript
describe('Component Name', () => {
  test('should do something', () => {
    const result = myFunction();
    expect(result).toBe(expected);
  });
});
```

### E2E Test Example

```javascript
describe('E2E: Feature Name', () => {
  test('should complete workflow', async () => {
    // Setup
    const process = startProcess();
    
    // Execute
    await waitForReady();
    
    // Verify
    expect(process.isRunning()).toBe(true);
    
    // Cleanup
    process.kill();
  }, 60000); // 60 second timeout
});
```

### Build Validation Test Example

```javascript
describe('Build Artifact', () => {
  test('should exist', () => {
    const artifactPath = path.join(__dirname, 'artifact');
    expect(fs.existsSync(artifactPath)).toBe(true);
  });
});
```

## Continuous Integration

For CI/CD pipelines:

```bash
# Run all tests
npm test

# Run only unit tests (fast)
npm run test:unit

# Run build validation (requires build artifacts)
npm run build:all
npm run test:build
```

## Troubleshooting

### Tests Timeout

If E2E tests timeout:
- Increase timeout in jest.config.js
- Check if backend can start successfully
- Verify TLS certificates can be generated

### Build Validation Fails

If build validation fails:
- Ensure all build scripts are run first
- Check that assets directory contains icon files
- Verify package.json build configuration

### Backend Tests Fail

If backend tests fail:
- Ensure Go is installed and in PATH
- Run `go mod tidy` in backend directory
- Check that backend dependencies are installed

## Test Coverage

To generate test coverage reports:

```bash
npm test -- --coverage
```

Coverage reports will be generated in the `coverage` directory.

## Requirements Traceability

Each test includes comments indicating which requirements it validates:

```javascript
test('should do something', () => {
  // Validates: Requirements 3.1, 3.2
  // ...
});
```

This ensures all requirements are covered by tests.
