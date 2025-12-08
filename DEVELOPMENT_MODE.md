# Development Mode Guide

This document explains how to use the development mode for the SIGMA Electron application.

## Overview

The application supports two modes:
- **Development Mode**: Connects to Vite dev server with hot reload and DevTools
- **Production Mode**: Loads packaged frontend files from dist folder

The mode is automatically detected using `app.isPackaged` (Electron's built-in property), which is more reliable than environment variables.

## Running in Development Mode

### Prerequisites

1. Ensure all dependencies are installed:
```cmd
npm install
cd frontend
npm install
cd ..
cd backend
go mod download
cd ..
```

### Starting Development Mode

1. **Start the frontend dev server** (in one terminal):
```cmd
cd frontend
npm run dev
```
This will start Vite on `http://localhost:5174`

2. **Start the Electron app in development mode** (in another terminal):
```cmd
npm run dev
```

This will:
- Set `NODE_ENV=development`
- Start the Electron app
- Automatically start the Go backend with HTTPS
- Connect to the Vite dev server at `http://localhost:5174`
- Open DevTools automatically

### Development Mode Features

✅ **Hot Reload**: Frontend changes are automatically reflected without restarting
✅ **DevTools**: Chrome DevTools are automatically opened for debugging
✅ **Backend Auto-start**: Go backend starts automatically with TLS encryption
✅ **Fast Iteration**: No need to rebuild frontend for every change

## Running in Production Mode

To test the production build locally:

1. **Build everything**:
```cmd
npm run build
```

2. **Start Electron** (without NODE_ENV=development):
```cmd
electron .
```

This will:
- Load packaged frontend from `frontend/dist/index.html`
- NOT open DevTools
- Use production optimizations

## Environment Detection

### New Method: app.isPackaged (Recommended)

The application now uses Electron's built-in `app.isPackaged` property to detect the environment:

```javascript
const { app } = require('electron');

// Reliable environment detection
const isDev = !app.isPackaged;

if (isDev) {
  // Development mode
  mainWindow.loadURL('http://localhost:5174');
  mainWindow.webContents.openDevTools();
} else {
  // Production mode
  mainWindow.loadFile('frontend/dist/index.html');
}
```

**Why app.isPackaged?**
- ✅ More reliable than `NODE_ENV` (which can be accidentally set or unset)
- ✅ Automatically `false` when running from source (`electron .`)
- ✅ Automatically `true` when running from packaged app
- ✅ No need to manually set environment variables
- ✅ Works consistently across all platforms

**When is app.isPackaged true?**
- Running from installed application
- Running from `release/win-unpacked/SIGMA.exe`
- Running from built installer

**When is app.isPackaged false?**
- Running `npm run dev`
- Running `electron .` from project root
- Running from source code directory

### Legacy Method: NODE_ENV (Deprecated)

The old method using `NODE_ENV` is no longer recommended:

```javascript
// ❌ Old method (less reliable)
const isDev = process.env.NODE_ENV === 'development';
```

However, `npm run dev` still sets `NODE_ENV=development` for compatibility with other tools.

## Path Structure

### Development Mode Paths

When running in development mode (`app.isPackaged === false`):

```
project-root/
├── electron/main.js            # Running from here (__dirname = project-root/electron)
├── dist/backend/
│   └── sigma-backend.exe       # Backend runs from here
├── frontend/                   # Vite dev server serves from here
└── (Vite dev server at http://localhost:5174)
```

**Key paths in development:**
- Backend executable: `<project-root>/dist/backend/sigma-backend.exe`
- Frontend: `http://localhost:5174` (Vite dev server)
- User data: `app.getPath('userData')` (standard OS location)
  - Windows: `C:\Users\<user>\AppData\Roaming\SIGMA\`
  - macOS: `~/Library/Application Support/SIGMA/`
  - Linux: `~/.config/SIGMA/`

### Production Mode Paths

When running in production mode (`app.isPackaged === true`):

```
installation-dir/
├── SIGMA.exe                   # Electron main executable
└── resources/
    ├── app.asar                # Packaged app code (electron/ + frontend/dist/)
    └── backend/
        └── sigma-backend.exe   # Backend runs from here
```

**Key paths in production:**
- Backend executable: `process.resourcesPath/backend/sigma-backend.exe`
- Frontend: Loaded from `app.asar`
- User data: Same as development (standard OS location)

**Important:** The backend is NOT copied to user data directory. It runs directly from `resources/backend/`.

## Debugging Tips

### 1. Check Environment Detection

Add this to `electron/main.js` to verify environment detection:

```javascript
console.log('Environment Info:', {
  isPackaged: app.isPackaged,
  isDev: !app.isPackaged,
  nodeEnv: process.env.NODE_ENV,
  __dirname: __dirname,
  resourcesPath: process.resourcesPath,
  userDataPath: app.getPath('userData')
});
```

### 2. Verify Backend Path

Check which backend path is being used:

```javascript
function getBackendPath() {
  const isDev = !app.isPackaged;
  const backendPath = isDev
    ? path.join(__dirname, '..', 'dist', 'backend', 'sigma-backend.exe')
    : path.join(process.resourcesPath, 'backend', 'sigma-backend.exe');
  
  console.log('Backend path:', backendPath);
  console.log('Backend exists:', fs.existsSync(backendPath));
  
  return backendPath;
}
```

### 3. Check User Data Directory

Verify user data directory location:

```javascript
const userDataPath = app.getPath('userData');
console.log('User data path:', userDataPath);
console.log('User data exists:', fs.existsSync(userDataPath));
```

### 4. Enable Verbose Logging

In development mode, all path information is logged to the console. Check the terminal where you ran `npm run dev`.

### 5. Inspect Packaged App

To debug a packaged application:

1. Run the unpacked version:
   ```cmd
   release\win-unpacked\SIGMA.exe
   ```

2. Check the log files:
   - Windows: `%APPDATA%\SIGMA\logs\app.log`
   - macOS: `~/Library/Application Support/SIGMA/logs/app.log`
   - Linux: `~/.config/SIGMA/logs/app.log`

3. Verify backend location:
   ```cmd
   dir release\win-unpacked\resources\backend
   ```

### 6. Test Environment Switching

Test both modes without rebuilding:

```bash
# Development mode
npm run dev

# Production mode (after building)
electron .
```

Note: Running `electron .` from project root will use development paths because `app.isPackaged` will be `false`.

To test true production mode, run from the packaged app:
```cmd
release\win-unpacked\SIGMA.exe
```

## Troubleshooting

### Frontend not loading in development mode

**Problem**: Electron shows blank screen or connection error

**Solution**: 
1. Make sure Vite dev server is running on port 5174
2. Check if another process is using port 5174
3. Verify the URL in `electron/main.js` matches your Vite config
4. Check console for CORS errors

### Backend not starting

**Problem**: Backend health check fails

**Solution**:
1. Backend now auto-discovers available ports (starts from 8080)
2. Verify Go backend builds successfully: `cd backend && go build -o ../dist/backend/sigma-backend.exe`
3. Check backend path exists: `dir dist\backend\sigma-backend.exe` (Windows) or `ls dist/backend/sigma-backend` (macOS/Linux)
4. Check TLS certificate generation in logs
5. Verify user data directory is writable

### DevTools not opening

**Problem**: DevTools don't open automatically

**Solution**:
1. Verify `app.isPackaged === false` (check console logs)
2. Check the console logs for any errors
3. Manually open DevTools: View → Toggle Developer Tools

### Wrong environment detected

**Problem**: App behaves like production when it should be development (or vice versa)

**Solution**:
1. Check `app.isPackaged` value in console
2. Make sure you're running `npm run dev` for development
3. For production testing, run from `release/win-unpacked/SIGMA.exe`
4. Don't rely on `NODE_ENV` - use `app.isPackaged` instead

### Backend not found in production

**Problem**: Packaged app can't find backend executable

**Solution**:
1. Verify backend was built: `dir dist\backend\sigma-backend.exe`
2. Check `release/win-unpacked/resources/backend/` contains the backend
3. Run build validation: `node scripts/validate-build.js`
4. Rebuild with: `npm run build`

### User data directory issues

**Problem**: Can't write to user data directory

**Solution**:
1. Check the path: `app.getPath('userData')`
2. Verify directory permissions
3. On Windows, check if antivirus is blocking access
4. Try running as administrator (for testing only)

## Testing

Run the test suite to verify development mode functionality:

```cmd
npm run test:electron
```

This includes tests for:
- NODE_ENV detection
- Vite dev server URL construction
- DevTools enablement
- Production file loading
- Environment variable handling

## Configuration

### Changing Vite Port

Edit `frontend/vite.config.ts`:

```typescript
export default defineConfig({
  server: {
    port: 5174, // Change this
    strictPort: false,
  },
})
```

Then update `electron/main.js`:

```javascript
const devUrl = 'http://localhost:5174'; // Update to match
```

### Changing Backend Port

Edit the `BACKEND_PORT` constant in `electron/main.js`:

```javascript
const BACKEND_PORT = 8080; // Change this
```

## Configuration

### Changing Vite Port

Edit `frontend/vite.config.ts`:

```typescript
export default defineConfig({
  server: {
    port: 5174, // Change this
    strictPort: false,
  },
})
```

Then update `electron/main.js`:

```javascript
const devUrl = 'http://localhost:5174'; // Update to match
```

### Changing Backend Port

The backend now auto-discovers available ports starting from 8080. To change the starting port, edit `backend/utils/port.go`:

```go
const DefaultPort = 8080 // Change this
```

## Best Practices

### Development Workflow

1. **Start frontend dev server first:**
   ```bash
   cd frontend
   npm run dev
   ```

2. **Then start Electron:**
   ```bash
   npm run dev
   ```

3. **Make changes:**
   - Frontend changes: Auto-reload (Vite HMR)
   - Backend changes: Restart Electron (`Ctrl+C` then `npm run dev`)
   - Electron main process changes: Restart Electron

### Before Committing

1. Run tests:
   ```bash
   npm test
   ```

2. Verify build works:
   ```bash
   npm run build
   ```

3. Test packaged app:
   ```bash
   release\win-unpacked\SIGMA.exe
   ```

### Production Testing

Always test the packaged application before release:

1. Build: `npm run build`
2. Install: Run the installer from `release/`
3. Test all features
4. Check logs for errors
5. Verify uninstall works correctly

## Next Steps

After development is complete:
1. Build the application: `npm run build`
2. Test the packaged application: `release/win-unpacked/SIGMA.exe`
3. Test the installer: `release/SIGMA-1.0.0-x64.exe`
4. Verify all features work in production mode
5. Check log files for any errors

---

## Quick Reference

| Aspect | Development | Production |
|--------|-------------|------------|
| **Environment Detection** | `app.isPackaged === false` | `app.isPackaged === true` |
| **Frontend** | Vite dev server (http://localhost:5174) | Loaded from app.asar |
| **Backend Path** | `<project>/dist/backend/sigma-backend.exe` | `resources/backend/sigma-backend.exe` |
| **User Data** | `app.getPath('userData')` | `app.getPath('userData')` |
| **DevTools** | Auto-open | Closed |
| **Logging** | Verbose console output | File logging only |
| **Hot Reload** | ✅ Enabled | ❌ Disabled |

---

**Last Updated**: 2024-12-07
