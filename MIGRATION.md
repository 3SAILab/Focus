# Migration Guide - Electron Packaging Improvements

This document guides you through migrating from the old packaging implementation to the improved version with simplified path management and better reliability.

## Overview

The new implementation includes several key improvements:

1. **Simplified Backend Path Management**: Backend runs directly from `resources/backend/`, no copying required
2. **Standard User Data Directory**: Uses `app.getPath('userData')` for OS-standard locations
3. **Reliable Environment Detection**: Uses `app.isPackaged` instead of `NODE_ENV`
4. **Sequential Build Process**: Ensures reliable builds with automatic validation
5. **Improved Error Handling**: Better error messages with actionable information
6. **Removed Debug Dialogs**: No more debug popups in production

## Breaking Changes

### 1. User Data Directory Location Changed

**Old Location:**
```
Windows: <installation-dir>\user-data\
macOS: <installation-dir>/user-data/
Linux: <installation-dir>/user-data/
```

**New Location (OS Standard):**
```
Windows: C:\Users\<user>\AppData\Roaming\SIGMA\
macOS: ~/Library/Application Support/SIGMA/
Linux: ~/.config/SIGMA/
```

**Impact:** Existing user data (database, uploads, outputs) will not be automatically migrated.

**Migration Steps:**
1. Locate old user data directory (next to the installed application)
2. Copy contents to new location:
   - Windows: `%APPDATA%\SIGMA\`
   - macOS: `~/Library/Application Support/SIGMA/`
   - Linux: `~/.config/SIGMA/`
3. Restart the application

**Automated Migration (Optional):**

Add this code to `electron/main.js` for one-time migration:

```javascript
async function migrateUserData() {
  const oldPath = path.join(path.dirname(app.getPath('exe')), 'user-data');
  const newPath = app.getPath('userData');
  
  // Check if old data exists and new location is empty
  if (fs.existsSync(oldPath) && !fs.existsSync(path.join(newPath, 'db'))) {
    console.log('Migrating user data from old location...');
    try {
      // Copy directories
      const dirs = ['db', 'uploads', 'output', 'certs'];
      for (const dir of dirs) {
        const oldDir = path.join(oldPath, dir);
        const newDir = path.join(newPath, dir);
        if (fs.existsSync(oldDir)) {
          fs.cpSync(oldDir, newDir, { recursive: true });
          console.log(`Migrated ${dir}/`);
        }
      }
      console.log('Migration complete!');
    } catch (error) {
      console.error('Migration failed:', error);
    }
  }
}

// Call before starting backend
app.whenReady().then(async () => {
  await migrateUserData();
  // ... rest of initialization
});
```

### 2. Backend No Longer Copied

**Old Behavior:**
- Backend copied from `resources/backend/` to `user-data/backend/`
- Backend run from `user-data/backend/`

**New Behavior:**
- Backend runs directly from `resources/backend/`
- No copying required

**Impact:** Faster startup, simpler code, no leftover files in user data directory.

**Migration Steps:** None required - this is an internal change.

### 3. Environment Detection Changed

**Old Method:**
```javascript
const isDev = process.env.NODE_ENV === 'development';
```

**New Method:**
```javascript
const isDev = !app.isPackaged;
```

**Impact:** More reliable environment detection, no need to set `NODE_ENV` manually.

**Migration Steps:**
1. Update all `process.env.NODE_ENV === 'development'` checks to `!app.isPackaged`
2. Ensure `app.isPackaged` is only accessed after `app.whenReady()`
3. Remove manual `NODE_ENV` settings (except in npm scripts for compatibility)

### 4. Build Process Changed

**Old Process:**
```bash
# Parallel execution (unreliable)
npm run build:frontend & npm run build:backend:win & npm run build:electron
```

**New Process:**
```bash
# Sequential execution (reliable)
npm run build
# Runs: clean → frontend → backend → validate → electron
```

**Impact:** More reliable builds, automatic validation, clearer error messages.

**Migration Steps:**
1. Use `npm run build` instead of individual build commands
2. Remove any custom build scripts that run steps in parallel
3. Add `scripts/validate-build.js` if not present

## Step-by-Step Migration

### For Developers

#### 1. Update Electron Main Process

**File: `electron/main.js`**

Replace environment detection:
```javascript
// OLD
const isDev = process.env.NODE_ENV === 'development';

// NEW
const isDev = !app.isPackaged;
```

Replace user data path:
```javascript
// OLD
const userDataPath = path.join(path.dirname(app.getPath('exe')), 'user-data');

// NEW
const userDataPath = app.getPath('userData');
```

Replace backend path resolution:
```javascript
// OLD
function getBackendPath() {
  if (isDev) {
    return path.join(__dirname, '..', 'dist', 'backend', 'sigma-backend.exe');
  } else {
    // Copy from resources to user-data
    const sourcePath = path.join(process.resourcesPath, 'backend');
    const targetPath = path.join(userDataPath, 'backend');
    // ... copying logic ...
    return path.join(targetPath, 'sigma-backend.exe');
  }
}

// NEW
function getBackendPath() {
  if (isDev) {
    return path.join(__dirname, '..', 'dist', 'backend', 'sigma-backend.exe');
  } else {
    return path.join(process.resourcesPath, 'backend', 'sigma-backend.exe');
  }
}
```

Remove debug dialogs in production:
```javascript
// OLD - Remove this
if (!isDev) {
  await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '调试信息',
    message: `路径信息: ${JSON.stringify(pathInfo)}`
  });
}

// NEW - Only log in development
if (isDev) {
  console.log('[Debug] Path Information:', pathInfo);
}
```

#### 2. Update Build Scripts

**File: `package.json`**

```json
{
  "scripts": {
    "dev": "cross-env NODE_ENV=development electron .",
    "build": "npm run build:sequential",
    "build:sequential": "npm run build:frontend && npm run build:backend:win && npm run build:electron",
    "build:frontend": "cd frontend && npm run build && cd ..",
    "build:backend:win": "cd backend && go build -ldflags=\"-s -w\" -o ../dist/backend/sigma-backend.exe . && cd ..",
    "build:backend:mac": "cd backend && GOOS=darwin GOARCH=amd64 go build -ldflags=\"-s -w\" -o ../dist/backend/sigma-backend . && cd ..",
    "build:backend:linux": "cd backend && GOOS=linux GOARCH=amd64 go build -ldflags=\"-s -w\" -o ../dist/backend/sigma-backend . && cd ..",
    "build:electron": "electron-builder",
    "clean": "rimraf dist release* frontend/dist",
    "prebuild": "npm run clean"
  }
}
```

Key changes:
- Use `&&` for sequential execution
- Add `-ldflags="-s -w"` to reduce binary size
- Add `clean` and `prebuild` scripts
- Use `rimraf` for cross-platform file deletion

#### 3. Add Build Validation

**File: `scripts/validate-build.js`**

Create this file if it doesn't exist:

```javascript
const fs = require('fs');
const path = require('path');

function validateBuild() {
  console.log('Validating build artifacts...');
  
  const requiredFiles = [
    'dist/backend/sigma-backend.exe',
    'frontend/dist/index.html'
  ];
  
  const missing = [];
  
  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      missing.push(file);
    } else {
      const stats = fs.statSync(file);
      console.log(`✓ ${file} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    }
  }
  
  if (missing.length > 0) {
    console.error('\n❌ Build validation failed. Missing files:');
    missing.forEach(f => console.error(`  - ${f}`));
    process.exit(1);
  }
  
  console.log('\n✅ Build validation passed!');
}

validateBuild();
```

#### 4. Update electron-builder Configuration

**File: `package.json`**

Ensure these settings are present:

```json
{
  "build": {
    "files": [
      "electron/**/*",
      "frontend/dist/**/*",
      "!electron/**/*.test.js",
      "!electron/**/*.test.ts",
      "!**/.DS_Store",
      "!**/.git*"
    ],
    "extraResources": [
      {
        "from": "dist/backend",
        "to": "backend",
        "filter": ["**/*"]
      }
    ],
    "win": {
      "requestedExecutionLevel": "asInvoker"
    }
  }
}
```

Key changes:
- Exclude test files
- Ensure backend goes to `extraResources`
- Use `asInvoker` to avoid unnecessary admin prompts

#### 5. Update Tests

Update any tests that check paths or environment detection:

```javascript
// OLD
expect(process.env.NODE_ENV).toBe('development');

// NEW
expect(app.isPackaged).toBe(false);
```

```javascript
// OLD
const userDataPath = path.join(path.dirname(app.getPath('exe')), 'user-data');

// NEW
const userDataPath = app.getPath('userData');
```

#### 6. Update Documentation

Update any documentation that references:
- User data directory location
- Build process
- Environment detection
- Backend path management

### For End Users

#### Upgrading from Old Version

1. **Backup your data** (optional but recommended):
   - Locate the old installation directory
   - Copy the `user-data` folder to a safe location

2. **Uninstall the old version**:
   - Use Windows "Add or Remove Programs"
   - Or run the uninstaller from the installation directory

3. **Install the new version**:
   - Run the new installer
   - Choose installation directory

4. **Migrate data** (if needed):
   - Old data location: `<old-installation-dir>\user-data\`
   - New data location: `%APPDATA%\SIGMA\`
   - Copy contents from old to new location

5. **Verify installation**:
   - Launch SIGMA
   - Check that your history/data is present
   - Test core functionality

#### Clean Installation

If you prefer a clean start:

1. Uninstall old version
2. Delete old user data: `<old-installation-dir>\user-data\`
3. Delete new user data (if exists): `%APPDATA%\SIGMA\`
4. Install new version
5. Reconfigure application (API keys, settings, etc.)

## Verification Checklist

After migration, verify:

- [ ] Application starts successfully
- [ ] Backend starts and responds to requests
- [ ] Frontend loads correctly
- [ ] User data is accessible (history, uploads, outputs)
- [ ] TLS certificates are generated correctly
- [ ] No debug dialogs appear in production
- [ ] Logs are written to correct location
- [ ] Application closes cleanly (no orphaned processes)
- [ ] Build process completes without errors
- [ ] Tests pass

## Troubleshooting

### Issue: Application can't find backend

**Symptoms:** Error message "Backend executable not found"

**Solution:**
1. Verify backend was built: `dir dist\backend\sigma-backend.exe`
2. Check packaged app: `dir release\win-unpacked\resources\backend\`
3. Rebuild: `npm run build`

### Issue: User data not found

**Symptoms:** Application starts fresh, no history

**Solution:**
1. Check new location: `%APPDATA%\SIGMA\`
2. Migrate from old location if needed
3. Verify directory permissions

### Issue: Build fails

**Symptoms:** Build process stops with errors

**Solution:**
1. Clean build artifacts: `npm run clean`
2. Reinstall dependencies: `npm install`
3. Build step by step:
   ```bash
   npm run build:frontend
   npm run build:backend:win
   node scripts/validate-build.js
   npm run build:electron
   ```

### Issue: Environment detection wrong

**Symptoms:** App behaves like production in development (or vice versa)

**Solution:**
1. Verify you're using `app.isPackaged` not `NODE_ENV`
2. Check console logs for environment info
3. For development: run `npm run dev`
4. For production: run from `release/win-unpacked/SIGMA.exe`

### Issue: Tests failing

**Symptoms:** Tests fail after migration

**Solution:**
1. Update test expectations for new paths
2. Update environment detection checks
3. Mock `app.isPackaged` instead of `NODE_ENV`
4. Run tests: `npm test`

## Rollback Plan

If you need to rollback to the old version:

1. **Keep a backup** of the old version before migrating
2. **Document your changes** so you can revert them
3. **Use git branches** for the migration:
   ```bash
   git checkout -b migration-packaging-improvements
   # Make changes
   git commit -m "Migrate to new packaging system"
   
   # If rollback needed:
   git checkout main
   ```

4. **Backup user data** before testing new version

## Timeline

Recommended migration timeline:

1. **Week 1**: Update code, test in development
2. **Week 2**: Build and test packaged version
3. **Week 3**: Beta testing with select users
4. **Week 4**: Full rollout

## Support

If you encounter issues during migration:

1. Check this migration guide
2. Review the updated documentation (BUILD.md, DEVELOPMENT_MODE.md)
3. Check the design document (.kiro/specs/electron-packaging/design.md)
4. Review test results and logs
5. Contact the development team

## Benefits After Migration

After completing the migration, you'll benefit from:

✅ **Simpler codebase**: Less path management complexity
✅ **More reliable builds**: Sequential execution with validation
✅ **Better user experience**: Standard OS locations for data
✅ **Easier debugging**: Clear error messages and logging
✅ **Faster startup**: No backend copying required
✅ **Better compliance**: Follows OS conventions
✅ **Cleaner uninstall**: No leftover files in installation directory

---

**Last Updated**: 2024-12-07
**Migration Version**: 1.0.0 → 2.0.0
