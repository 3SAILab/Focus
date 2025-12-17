# Implementation Plan

- [x] 1. Create batch build script with Scanner module






  - [x] 1.1 Create `scripts/batch-build.js` with file scanning logic

    - Implement `findSalesQRImages()` to scan `frontend/dist` for `*_wxchat.jpg` files
    - Implement `extractSalesName()` to parse sales name from filename
    - _Requirements: 1.1, 1.2_
  - [ ]* 1.2 Write property test for QR image scanning and name extraction
    - **Property 1: QR Image Scanning and Name Extraction**
    - **Validates: Requirements 1.1, 1.2**

- [x] 2. Implement Builder module





  - [x] 2.1 Implement file preparation functions


    - Create `prepareBuild()` to copy sales QR to `sales_wxchat.jpg`
    - Create `backupOriginal()` to backup existing `sales_wxchat.jpg` if present
    - Create `restoreOriginal()` to restore backup after all builds
    - _Requirements: 1.3, 2.3_
  - [x] 2.2 Implement build execution with dynamic output directory


    - Create `runBuild()` to execute electron-builder with custom output directory
    - Configure output directory as `release-{salesName}/`
    - _Requirements: 2.1, 2.2_
  - [ ]* 2.3 Write property test for output directory formatting
    - **Property 2: Output Directory Formatting**
    - **Validates: Requirements 2.1**

- [x] 3. Implement Progress Logger and main orchestration






  - [x] 3.1 Implement progress logging functions

    - Create `logStart()` to display total count
    - Create `logProgress()` to display current progress
    - Create `logSummary()` to display final summary
    - _Requirements: 3.1, 3.2, 3.4_
  - [ ]* 3.2 Write property test for progress message formatting
    - **Property 3: Progress Message Formatting**
    - **Validates: Requirements 3.2**


  - [ ] 3.3 Implement main batch build orchestration
    - Create main function to coordinate scanning, building, and logging
    - Implement error handling to continue on failure
    - _Requirements: 3.3_

- [x] 4. Add single sales filtering and CLI interface






  - [x] 4.1 Implement command line argument parsing

    - Parse optional `--sales=<name>` argument
    - Validate sales name exists in scanned list
    - Display available sales names on invalid input
    - _Requirements: 4.1, 4.2_
  - [ ]* 4.2 Write property test for single sales filtering
    - **Property 4: Single Sales Filtering**
    - **Validates: Requirements 4.1**

- [x] 5. Add npm scripts and documentation






  - [x] 5.1 Add npm scripts to package.json

    - Add `build:all-sales` script for batch building
    - Add `build:sales` script for single sales building
    - _Requirements: 1.1, 4.1_
  - [x] 5.2 Update BUILD.md with batch packaging instructions


    - Document how to run batch build
    - Document how to build for single sales
    - _Requirements: 3.1_

- [x] 6. Checkpoint - Make sure all tests pass





  - Ensure all tests pass, ask the user if questions arise.
