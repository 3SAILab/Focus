# Quick Start - Manual Testing

This is a condensed guide for quickly performing the essential manual tests. For detailed instructions, see `MANUAL_TESTING_GUIDE.md`.

---

## Prerequisites

- Windows 10/11 machine
- Administrator privileges
- Task Manager or Process Explorer
- 500MB free disk space

---

## Quick Test Sequence (30 minutes)

### 1. Pre-Test Cleanup (2 minutes)

```cmd
REM Kill any running processes
taskkill /F /IM sigma-backend.exe 2>nul
taskkill /F /IM SIGMA.exe 2>nul

REM Check for orphaned processes
tasklist | findstr /I "sigma"
```

**Expected**: No processes found

---

### 2. Fresh Installation Test (5 minutes)

```cmd
REM Run installer
cd dist-electron
SIGMA-1.0.0-x64.exe
```

**Steps**:
1. Complete installation wizard
2. Choose installation directory
3. Create desktop shortcut
4. Launch application

**Verify**:
- [ ] Application starts within 10 seconds
- [ ] No error dialogs
- [ ] Window displays correctly

---

### 3. User Data Verification (2 minutes)

```cmd
REM Open user data directory
explorer %APPDATA%\SIGMA
```

**Verify**:
- [ ] Directory exists
- [ ] Subdirectories: `output`, `uploads`, `certs`, `logs`
- [ ] Log files present in `logs/`

---

### 4. Process Management Test (3 minutes)

**Steps**:
1. Open Task Manager (Ctrl+Shift+Esc)
2. Find SIGMA.exe and sigma-backend.exe
3. Note the PIDs
4. Close application normally
5. Wait 5 seconds
6. Check Task Manager again

**Verify**:
- [ ] Both processes running when app is open
- [ ] Both processes terminated after closing
- [ ] No orphaned processes

---

### 5. Force Kill Test (3 minutes)

**Steps**:
1. Launch application
2. Open Task Manager
3. Force kill SIGMA.exe (End Task)
4. Wait 5 seconds
5. Check if sigma-backend.exe is still running

**Verify**:
- [ ] Backend process also terminates (may take a few seconds)
- [ ] No orphaned processes after 10 seconds

---

### 6. Log File Check (2 minutes)

```cmd
REM View log file
notepad %APPDATA%\SIGMA\logs\app.log
```

**Verify**:
- [ ] Log file exists and is readable
- [ ] Contains startup messages
- [ ] Contains timestamps
- [ ] No sensitive information (API keys, passwords)

---

### 7. Path Verification (2 minutes)

**Check Installation**:
```cmd
REM Check installation directory
dir "C:\Program Files\SIGMA"
dir "C:\Program Files\SIGMA\resources\backend"
```

**Verify**:
- [ ] SIGMA.exe exists
- [ ] resources/backend/sigma-backend.exe exists
- [ ] resources/app.asar exists

---

### 8. Error Handling Test (3 minutes)

**Test 1: Backend Missing**
1. Rename backend executable temporarily
2. Try to launch application
3. Verify error dialog appears with helpful message
4. Restore backend executable

**Test 2: Invalid API Key** (if applicable)
1. Launch application
2. Enter invalid API key
3. Try to generate image
4. Verify error is displayed clearly

**Verify**:
- [ ] Error dialogs are helpful
- [ ] Application doesn't crash
- [ ] Errors are logged

---

### 9. Basic Functionality Test (5 minutes)

**Steps**:
1. Launch application
2. Configure API key (if required)
3. Generate a test image
4. Check output directory

**Verify**:
- [ ] Image generation works
- [ ] Image saved to output directory
- [ ] Application remains stable

---

### 10. Uninstallation Test (3 minutes)

**Steps**:
1. Close application
2. Open Settings → Apps → Installed Apps
3. Find "SIGMA"
4. Uninstall
5. Choose to KEEP user data

**Verify**:
- [ ] Uninstallation completes
- [ ] Application files removed
- [ ] User data preserved in %APPDATA%\SIGMA
- [ ] No orphaned processes

---

## Quick Results Checklist

Mark each test as you complete it:

- [ ] 1. Pre-test cleanup successful
- [ ] 2. Fresh installation successful
- [ ] 3. User data directory correct
- [ ] 4. Process management works
- [ ] 5. Force kill cleanup works
- [ ] 6. Log files are useful
- [ ] 7. Paths are correct
- [ ] 8. Error handling is good
- [ ] 9. Basic functionality works
- [ ] 10. Uninstallation is clean

---

## Quick Issue Report

If you find any issues, note them here:

**Issue 1**:
- Test: _________________
- Problem: _________________
- Severity: ☐ Critical  ☐ Major  ☐ Minor

**Issue 2**:
- Test: _________________
- Problem: _________________
- Severity: ☐ Critical  ☐ Major  ☐ Minor

---

## Final Decision

After completing all tests:

☐ **PASS** - All tests passed, ready for release  
☐ **PASS WITH NOTES** - Minor issues found, document and proceed  
☐ **FAIL** - Critical issues found, must fix before release

---

## Next Steps

### If All Tests Pass:
1. Review `FINAL_CHECKPOINT_SUMMARY.md`
2. Complete `RELEASE_CHECKLIST.md`
3. Create release notes
4. Proceed with release

### If Issues Found:
1. Document issues in detail
2. Prioritize by severity
3. Fix critical issues
4. Re-test after fixes
5. Update documentation

---

## Detailed Testing

For comprehensive testing, see:
- `MANUAL_TESTING_GUIDE.md` - Complete manual testing guide
- `FINAL_CHECKPOINT_REPORT.md` - Automated test results
- `FINAL_CHECKPOINT_SUMMARY.md` - Overall summary

---

**Testing Date**: _________________

**Tester**: _________________

**Result**: ☐ PASS  ☐ FAIL  ☐ NEEDS REVIEW

**Time Taken**: _________ minutes

**Notes**:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
