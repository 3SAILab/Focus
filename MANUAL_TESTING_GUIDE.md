# Manual Testing Guide - Final Checkpoint

This guide provides step-by-step instructions for manual testing of the SIGMA Electron application. These tests complement the automated tests and verify real-world installation and usage scenarios.

## Prerequisites

- Windows 10/11 machine
- Administrator privileges (for installation)
- Process Explorer or Task Manager (for process verification)
- At least 500MB free disk space

## Test Environment Setup

1. **Clean Test Environment**
   - Close all running instances of SIGMA
   - Kill any orphaned backend processes:
     ```cmd
     taskkill /F /IM sigma-backend.exe
     taskkill /F /IM SIGMA.exe
     ```

2. **Locate Installation Files**
   - Installer: `dist-electron/SIGMA-1.0.0-x64.exe`
   - Unpacked app: `dist-electron/win-unpacked/SIGMA.exe`

---

## Test 1: Fresh Installation

### Objective
Verify that the application can be installed from scratch on a clean system.

### Steps

1. **Run the Installer**
   ```cmd
   cd dist-electron
   SIGMA-1.0.0-x64.exe
   ```

2. **Installation Wizard**
   - [ ] Verify installer opens without errors
   - [ ] Choose installation directory (or use default)
   - [ ] Verify "Create Desktop Shortcut" option is available
   - [ ] Verify "Create Start Menu Shortcut" option is available
   - [ ] Complete installation

3. **Verify Installation Files**
   - [ ] Check installation directory exists (default: `C:\Program Files\SIGMA`)
   - [ ] Verify SIGMA.exe exists
   - [ ] Verify resources/backend/sigma-backend.exe exists
   - [ ] Verify resources/app.asar exists

4. **Launch Application**
   - [ ] Launch from desktop shortcut (if created)
   - [ ] OR launch from Start Menu
   - [ ] OR launch from installation directory

5. **Verify Application Startup**
   - [ ] Application window opens within 10 seconds
   - [ ] No error dialogs appear
   - [ ] Backend service starts automatically
   - [ ] Frontend loads correctly

6. **Verify User Data Directory**
   - [ ] Navigate to: `%APPDATA%\SIGMA`
   - [ ] Verify subdirectories exist:
     - `output/`
     - `uploads/`
     - `certs/`
     - `logs/`
   - [ ] Check logs/app.log for startup messages
   - [ ] Verify no errors in log file

7. **Test Basic Functionality**
   - [ ] Open API Key modal (if required)
   - [ ] Enter test API key
   - [ ] Generate a test image
   - [ ] Verify image appears in output directory

8. **Verify Process Management**
   - Open Task Manager (Ctrl+Shift+Esc)
   - [ ] Verify SIGMA.exe is running
   - [ ] Verify sigma-backend.exe is running
   - [ ] Note the Process IDs (PIDs)

9. **Close Application**
   - [ ] Close application window
   - [ ] Wait 5 seconds
   - [ ] Verify SIGMA.exe process terminated
   - [ ] Verify sigma-backend.exe process terminated
   - [ ] Confirm no orphaned processes remain

### Expected Results
- ✓ Installation completes without errors
- ✓ All files are in correct locations
- ✓ Application starts successfully
- ✓ User data directory is created at standard location
- ✓ Backend process starts and stops with application
- ✓ No orphaned processes after closing

---

## Test 2: Upgrade Installation

### Objective
Verify that the application can be upgraded from a previous version without losing user data.

### Prerequisites
- Previous version of SIGMA must be installed
- User data should exist in `%APPDATA%\SIGMA`

### Steps

1. **Backup Current Data** (Optional but recommended)
   ```cmd
   xcopy "%APPDATA%\SIGMA" "%APPDATA%\SIGMA_backup" /E /I /H
   ```

2. **Note Current Version**
   - [ ] Launch current version
   - [ ] Note version number (if displayed)
   - [ ] Close application

3. **Run New Installer**
   ```cmd
   cd dist-electron
   SIGMA-1.0.0-x64.exe
   ```

4. **Upgrade Process**
   - [ ] Installer detects existing installation
   - [ ] Verify upgrade option is presented (or automatic)
   - [ ] Complete upgrade installation

5. **Verify Upgraded Installation**
   - [ ] Launch upgraded application
   - [ ] Verify new version number (if displayed)
   - [ ] Check that application starts successfully

6. **Verify Data Preservation**
   - [ ] Navigate to `%APPDATA%\SIGMA`
   - [ ] Verify existing data is preserved:
     - Previous output images
     - Previous uploads
     - Configuration files
     - Log files (may be rotated)

7. **Test Functionality**
   - [ ] Verify API key is still configured
   - [ ] Generate a new test image
   - [ ] Verify new image is saved correctly
   - [ ] Verify previous images are still accessible

8. **Verify Process Management**
   - [ ] Check Task Manager for processes
   - [ ] Close application
   - [ ] Verify clean shutdown

### Expected Results
- ✓ Upgrade completes without errors
- ✓ User data is preserved
- ✓ Application functions correctly after upgrade
- ✓ No data loss or corruption

---

## Test 3: Uninstallation

### Objective
Verify that the application can be cleanly uninstalled and optionally remove user data.

### Steps

1. **Prepare for Uninstallation**
   - [ ] Close all running instances of SIGMA
   - [ ] Note the location of user data: `%APPDATA%\SIGMA`

2. **Uninstall via Control Panel**
   - Open Settings → Apps → Installed Apps
   - [ ] Find "SIGMA" in the list
   - [ ] Click "Uninstall"
   - [ ] Follow uninstallation wizard

3. **Uninstallation Options**
   - [ ] Verify option to keep or remove user data
   - [ ] Choose to KEEP user data (for first test)
   - [ ] Complete uninstallation

4. **Verify Application Removal**
   - [ ] Check installation directory is removed
   - [ ] Verify SIGMA.exe no longer exists
   - [ ] Verify Start Menu shortcut is removed
   - [ ] Verify Desktop shortcut is removed (if created)

5. **Verify User Data Preservation**
   - [ ] Navigate to `%APPDATA%\SIGMA`
   - [ ] Verify user data directory still exists
   - [ ] Verify data files are intact

6. **Verify Process Cleanup**
   - Open Task Manager
   - [ ] Verify no SIGMA.exe processes
   - [ ] Verify no sigma-backend.exe processes

7. **Test Complete Removal** (Optional)
   - Reinstall application
   - Uninstall again, choosing to REMOVE user data
   - [ ] Verify `%APPDATA%\SIGMA` is deleted
   - [ ] Verify no application traces remain

### Expected Results
- ✓ Uninstallation completes without errors
- ✓ Application files are removed
- ✓ User data handling respects user choice
- ✓ No orphaned processes remain
- ✓ No registry entries remain (advanced check)

---

## Test 4: Orphaned Process Detection

### Objective
Verify that no processes are left running after abnormal application termination.

### Steps

1. **Normal Shutdown Test**
   - [ ] Launch application
   - [ ] Note PIDs in Task Manager
   - [ ] Close application normally
   - [ ] Wait 5 seconds
   - [ ] Verify all processes terminated

2. **Force Kill Test**
   - [ ] Launch application
   - [ ] Note backend PID
   - [ ] Force kill SIGMA.exe via Task Manager
   - [ ] Wait 5 seconds
   - [ ] Check if sigma-backend.exe is still running
   - [ ] If running, this is a FAILURE (orphaned process)

3. **Crash Simulation Test**
   - [ ] Launch application
   - [ ] Simulate crash (if possible)
   - [ ] Check for orphaned processes
   - [ ] Verify cleanup

4. **Multiple Instance Test**
   - [ ] Launch application
   - [ ] Try to launch second instance
   - [ ] Verify behavior (should prevent or handle gracefully)
   - [ ] Close all instances
   - [ ] Verify all processes terminated

### Expected Results
- ✓ Normal shutdown cleans up all processes
- ✓ Force kill triggers backend cleanup (may require timeout)
- ✓ No orphaned processes after any termination method
- ✓ Multiple instances handled correctly

---

## Test 5: Log File Verification

### Objective
Verify that log files are created in the correct location and contain useful information.

### Steps

1. **Locate Log Files**
   - [ ] Navigate to `%APPDATA%\SIGMA\logs`
   - [ ] Verify directory exists

2. **Check Log Files**
   - [ ] Verify `app.log` exists
   - [ ] Verify `startup.log` exists (if applicable)
   - [ ] Check file sizes are reasonable (not empty, not huge)

3. **Verify Log Content**
   - Open `app.log` in text editor
   - [ ] Verify timestamps are present
   - [ ] Verify log levels (INFO, ERROR, etc.)
   - [ ] Check for startup messages
   - [ ] Check for backend initialization messages
   - [ ] Verify no sensitive information (API keys, passwords)

4. **Test Error Logging**
   - [ ] Cause an intentional error (e.g., invalid API key)
   - [ ] Check that error is logged
   - [ ] Verify error message is helpful
   - [ ] Verify stack trace is included (if applicable)

5. **Test Log Rotation** (if implemented)
   - [ ] Check if old logs are rotated
   - [ ] Verify log file size limits
   - [ ] Check for archived logs

### Expected Results
- ✓ Logs are created in standard location
- ✓ Log content is useful for debugging
- ✓ No sensitive information in logs
- ✓ Errors are properly logged
- ✓ Log rotation works (if implemented)

---

## Test 6: Path Management Verification

### Objective
Verify that all paths are resolved correctly in both development and production modes.

### Steps

1. **Production Mode Paths**
   - [ ] Launch installed application
   - [ ] Check logs for path information
   - [ ] Verify backend runs from: `resources/backend/sigma-backend.exe`
   - [ ] Verify user data is in: `%APPDATA%\SIGMA`
   - [ ] Verify no file copying occurs

2. **Development Mode Paths** (if testing dev build)
   - [ ] Run `npm run dev`
   - [ ] Check console for path information
   - [ ] Verify backend runs from: `dist/backend/sigma-backend.exe`
   - [ ] Verify paths are relative to project root

3. **Cross-Check Paths**
   - [ ] Verify no hardcoded paths in code
   - [ ] Verify `app.isPackaged` is used correctly
   - [ ] Verify `app.getPath('userData')` is used

### Expected Results
- ✓ Production paths use resources directory
- ✓ Development paths use project directories
- ✓ User data always in standard location
- ✓ No file copying in production

---

## Test 7: Error Handling Verification

### Objective
Verify that errors are handled gracefully with helpful messages.

### Steps

1. **Backend Startup Failure**
   - [ ] Rename backend executable temporarily
   - [ ] Try to launch application
   - [ ] Verify error dialog appears
   - [ ] Verify error message is helpful
   - [ ] Verify log file path is shown
   - [ ] Restore backend executable

2. **Port Conflict Test**
   - [ ] Start application
   - [ ] Try to start second instance (if port conflict occurs)
   - [ ] Verify error handling
   - [ ] Verify helpful error message

3. **TLS Certificate Error**
   - [ ] Delete certificates directory
   - [ ] Launch application
   - [ ] Verify certificates are regenerated
   - [ ] OR verify helpful error message

4. **API Error Handling**
   - [ ] Use invalid API key
   - [ ] Verify error is displayed to user
   - [ ] Verify error is logged
   - [ ] Verify application remains stable

### Expected Results
- ✓ All errors show helpful messages
- ✓ Error dialogs include actionable information
- ✓ Application doesn't crash on errors
- ✓ Errors are properly logged

---

## Test 8: Performance and Stability

### Objective
Verify that the application performs well and remains stable.

### Steps

1. **Startup Performance**
   - [ ] Measure time from launch to ready state
   - [ ] Should be < 10 seconds
   - [ ] Check CPU usage during startup
   - [ ] Check memory usage

2. **Runtime Performance**
   - [ ] Monitor CPU usage during idle
   - [ ] Monitor memory usage during idle
   - [ ] Generate multiple images
   - [ ] Check for memory leaks

3. **Stability Test**
   - [ ] Run application for extended period (30+ minutes)
   - [ ] Perform various operations
   - [ ] Verify no crashes
   - [ ] Verify no performance degradation

4. **Resource Cleanup**
   - [ ] Close application
   - [ ] Verify memory is released
   - [ ] Verify processes are terminated
   - [ ] Verify no file handles remain open

### Expected Results
- ✓ Fast startup time
- ✓ Low resource usage
- ✓ Stable during extended use
- ✓ Clean resource cleanup

---

## Checklist Summary

Use this checklist to track overall testing progress:

### Installation Tests
- [ ] Fresh installation completed successfully
- [ ] Upgrade installation preserves data
- [ ] Uninstallation removes application cleanly
- [ ] User data handling works correctly

### Process Management Tests
- [ ] No orphaned processes after normal shutdown
- [ ] No orphaned processes after force kill
- [ ] Multiple instances handled correctly

### Path Management Tests
- [ ] Production paths are correct
- [ ] Development paths are correct
- [ ] User data in standard location
- [ ] Backend runs from resources (no copying)

### Logging Tests
- [ ] Log files created in correct location
- [ ] Log content is useful
- [ ] Errors are properly logged
- [ ] No sensitive information in logs

### Error Handling Tests
- [ ] Backend failures handled gracefully
- [ ] Port conflicts handled correctly
- [ ] TLS errors handled properly
- [ ] API errors displayed to user

### Performance Tests
- [ ] Startup time acceptable
- [ ] Resource usage reasonable
- [ ] Stable during extended use
- [ ] Clean resource cleanup

---

## Reporting Issues

If any test fails, document the following:

1. **Test Name**: Which test failed
2. **Steps to Reproduce**: Exact steps that caused the failure
3. **Expected Result**: What should have happened
4. **Actual Result**: What actually happened
5. **Screenshots**: If applicable
6. **Log Files**: Attach relevant log files
7. **System Info**: Windows version, hardware specs

Save this information in a file named `TEST_FAILURE_REPORT.md`.

---

## Success Criteria

All tests must pass for the application to be considered ready for release:

- ✓ All automated tests pass (100% pass rate)
- ✓ All manual installation tests pass
- ✓ No orphaned processes detected
- ✓ Logs are in correct location and useful
- ✓ Error handling is robust
- ✓ Performance is acceptable
- ✓ Application is stable

---

## Next Steps

After completing all tests:

1. Review `FINAL_CHECKPOINT_REPORT.md` for automated test results
2. Complete this manual testing guide
3. Document any issues found
4. Fix any critical issues
5. Re-test after fixes
6. Prepare for release

---

**Testing Date**: _________________

**Tester Name**: _________________

**Test Environment**: _________________

**Overall Result**: ☐ PASS  ☐ FAIL  ☐ NEEDS REVIEW
