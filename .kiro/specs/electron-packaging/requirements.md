# Requirements Document

## Introduction

本需求文档针对 SIGMA Electron 应用的打包问题进行分析和改进。通过参考 electron-demo-dst 项目的最佳实践，识别当前打包配置中的问题并提出解决方案。主要问题包括：后端可执行文件路径管理、资源文件打包、开发/生产环境路径差异、以及 electron-builder 配置优化。

## Glossary

- **Electron Main Process**: Electron 应用的主进程，负责窗口管理和系统级操作
- **Backend Executable**: Go 编译的后端服务可执行文件（sigma-backend.exe）
- **Resources Path**: Electron 打包后的资源目录，通常为 process.resourcesPath
- **User Data Path**: 应用的用户数据存储目录
- **ASAR**: Electron 的归档格式，用于打包应用文件
- **extraResources**: electron-builder 配置项，用于指定需要复制到 resources 目录的额外文件
- **asarUnpack**: electron-builder 配置项，用于指定不应打包进 ASAR 的文件

## Requirements

### Requirement 1: 后端可执行文件路径管理

**User Story:** 作为应用开发者，我希望后端可执行文件在开发和生产环境中都能正确定位，以便应用能够正常启动后端服务。

#### Acceptance Criteria

1. WHEN the application runs in development mode THEN the system SHALL locate the backend executable at `dist/backend/sigma-backend.exe` relative to project root
2. WHEN the application runs in production mode THEN the system SHALL locate the backend executable at `process.resourcesPath/backend/sigma-backend.exe`
3. WHEN the backend executable path is resolved THEN the system SHALL verify the file exists before attempting to spawn the process
4. WHEN the backend executable is not found THEN the system SHALL log detailed path information and display a user-friendly error message
5. WHEN copying the backend executable to user-data directory THEN the system SHALL preserve file permissions and verify successful copy

### Requirement 2: Electron Builder 配置优化

**User Story:** 作为构建工程师，我希望 electron-builder 配置能够正确打包所有必需文件，以便生成的安装包包含完整的应用资源。

#### Acceptance Criteria

1. WHEN building the application THEN the system SHALL include frontend dist files in the ASAR archive
2. WHEN building the application THEN the system SHALL copy the backend executable to extraResources/backend directory
3. WHEN building the application THEN the system SHALL exclude test files, source maps, and development files from the package
4. WHEN building the application THEN the system SHALL set correct file patterns in the files configuration
5. WHEN building for Windows THEN the system SHALL generate NSIS installer with proper configuration

### Requirement 3: 资源文件路径解析

**User Story:** 作为应用用户，我希望应用能够正确访问所有资源文件，以便应用功能完整可用。

#### Acceptance Criteria

1. WHEN the application accesses frontend files THEN the system SHALL resolve paths relative to app.asar or unpacked directory
2. WHEN the application accesses backend executable THEN the system SHALL resolve path from process.resourcesPath
3. WHEN the application accesses user data THEN the system SHALL use platform-specific user data directory
4. WHEN resolving any resource path THEN the system SHALL handle both packed and unpacked scenarios
5. WHEN a resource file is missing THEN the system SHALL log the expected and actual paths for debugging

### Requirement 4: 开发与生产环境隔离

**User Story:** 作为开发者，我希望开发和生产环境使用不同的路径配置，以便在开发时能够快速迭代而不影响生产构建。

#### Acceptance Criteria

1. WHEN NODE_ENV is "development" THEN the system SHALL use project-relative paths for all resources
2. WHEN NODE_ENV is not "development" THEN the system SHALL use production paths based on process.resourcesPath
3. WHEN switching between environments THEN the system SHALL not require code changes
4. WHEN in development mode THEN the system SHALL enable additional logging and debugging features
5. WHEN in production mode THEN the system SHALL optimize for performance and minimize logging

### Requirement 5: 后端进程生命周期管理

**User Story:** 作为应用用户，我希望后端进程能够随应用启动和关闭，以便不会留下孤立进程占用系统资源。

#### Acceptance Criteria

1. WHEN the application starts THEN the system SHALL spawn the backend process with correct environment variables
2. WHEN the backend process starts THEN the system SHALL verify it reaches healthy state within timeout period
3. WHEN the application closes THEN the system SHALL terminate the backend process gracefully
4. WHEN graceful termination fails THEN the system SHALL force kill the backend process
5. WHEN the backend process crashes THEN the system SHALL detect the crash and notify the user

### Requirement 6: 构建脚本改进

**User Story:** 作为构建工程师，我希望构建脚本能够可靠地构建所有组件，以便生成完整的可分发应用包。

#### Acceptance Criteria

1. WHEN running build script THEN the system SHALL build frontend, backend, and electron in correct order
2. WHEN any build step fails THEN the system SHALL stop the build process and report the error
3. WHEN building backend THEN the system SHALL output executable to dist/backend directory
4. WHEN building frontend THEN the system SHALL output to frontend/dist directory
5. WHEN building electron THEN the system SHALL package all built artifacts into installer

### Requirement 7: 日志和调试支持

**User Story:** 作为技术支持人员，我希望应用能够记录详细的运行日志，以便诊断用户报告的问题。

#### Acceptance Criteria

1. WHEN the application runs THEN the system SHALL write logs to user data directory
2. WHEN logging path information THEN the system SHALL include both expected and actual paths
3. WHEN an error occurs THEN the system SHALL log stack traces and context information
4. WHEN the backend process outputs THEN the system SHALL capture and log stdout and stderr
5. WHEN debugging is needed THEN the system SHALL provide a way to access log files easily

### Requirement 8: 图标和资源文件管理

**User Story:** 作为应用用户，我希望应用显示正确的图标和品牌元素，以便获得专业的用户体验。

#### Acceptance Criteria

1. WHEN building for Windows THEN the system SHALL use icon.ico for application icon
2. WHEN building for macOS THEN the system SHALL use icon.icns for application icon
3. WHEN building for Linux THEN the system SHALL use icon.png for application icon
4. WHEN icon files are missing THEN the system SHALL warn during build but not fail
5. WHEN the application window is created THEN the system SHALL set the window icon if available

### Requirement 9: 依赖项打包

**User Story:** 作为应用开发者，我希望所有运行时依赖都被正确打包，以便应用能够在没有开发环境的机器上运行。

#### Acceptance Criteria

1. WHEN building the application THEN the system SHALL include all Node.js dependencies in the package
2. WHEN using native modules THEN the system SHALL rebuild them for the target platform
3. WHEN using node-forge THEN the system SHALL unpack it from ASAR for native module access
4. WHEN the backend has dependencies THEN the system SHALL compile them statically into the executable
5. WHEN the application runs THEN the system SHALL not require any external dependencies to be installed

### Requirement 10: 错误恢复和用户反馈

**User Story:** 作为应用用户，我希望在出现错误时能够获得清晰的提示和恢复选项，以便知道如何解决问题。

#### Acceptance Criteria

1. WHEN backend startup fails THEN the system SHALL display error dialog with actionable information
2. WHEN file paths are incorrect THEN the system SHALL suggest checking installation integrity
3. WHEN port is occupied THEN the system SHALL suggest closing conflicting applications
4. WHEN TLS certificate generation fails THEN the system SHALL offer to retry or continue without HTTPS
5. WHEN critical errors occur THEN the system SHALL offer options to restart or exit the application
