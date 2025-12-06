# Requirements Document

## Introduction

本文档定义了自动端口管理功能的需求。该功能允许后端服务器和前端开发服务器在端口被占用时自动查找并使用可用端口，并确保前端能够自动发现后端的实际运行端口，实现无缝通信。

## Glossary

- **Backend Server**: 使用 Go 和 Gin 框架构建的后端 API 服务器
- **Frontend Dev Server**: 使用 Vite 运行的前端开发服务器
- **Port**: 网络端口号，用于服务器监听连接
- **Port File**: 存储实际使用端口号的文件，用于进程间通信

- **Available Port**: 当前未被占用的可用网络端口

## Requirements

### Requirement 1

**User Story:** 作为开发者，我希望后端服务器在默认端口被占用时能自动使用下一个可用端口，这样我就不需要手动更改配置或终止占用端口的进程。

#### Acceptance Criteria

1. WHEN the Backend Server attempts to start on the default port AND that port is occupied THEN the Backend Server SHALL attempt to bind to the next sequential port number
2. WHEN the Backend Server successfully binds to a port THEN the Backend Server SHALL write the actual port number to a Port File
3. WHEN the Backend Server tries multiple ports AND all attempts fail within a reasonable range THEN the Backend Server SHALL log an error message and exit gracefully
4. WHEN the Backend Server starts successfully THEN the Backend Server SHALL log the actual listening address to the console
5. WHERE port auto-discovery is enabled, the Backend Server SHALL attempt up to 10 sequential ports before failing

### Requirement 2

**User Story:** 作为开发者，我希望前端开发服务器也能在端口被占用时自动使用可用端口，这样我可以同时运行多个项目实例而不会冲突。

#### Acceptance Criteria

1. WHEN the Frontend Dev Server attempts to start on the default port AND that port is occupied THEN the Frontend Dev Server SHALL attempt to bind to the next sequential port number
2. WHEN the Frontend Dev Server successfully binds to a port THEN the Frontend Dev Server SHALL write the actual port number to a Port File
3. WHEN the Frontend Dev Server starts successfully THEN the Frontend Dev Server SHALL log the actual listening address to the console
4. WHERE port auto-discovery is enabled, the Frontend Dev Server SHALL attempt up to 10 sequential ports before failing

### Requirement 3

**User Story:** 作为前端应用，我需要能够自动发现后端服务器的实际运行端口，这样即使后端使用了非默认端口，我也能正确连接到 API。

#### Acceptance Criteria

1. WHEN the Frontend Dev Server starts THEN the Frontend Dev Server SHALL read the Backend Server's Port File to determine the backend URL
2. WHEN the Port File does not exist or is invalid THEN the Frontend Dev Server SHALL fall back to the default backend port
3. WHEN the Frontend Dev Server reads the backend port THEN the Frontend Dev Server SHALL inject the backend URL into the application environment
4. WHEN the backend port changes THEN the Frontend Dev Server SHALL detect the change and update the backend URL without requiring a restart

### Requirement 4

**User Story:** 作为系统管理员，我希望端口文件存储在合适的位置，这样不会污染项目目录，并且在不同环境下都能正常工作。

#### Acceptance Criteria

1. WHEN the Backend Server creates a Port File THEN the Backend Server SHALL store it in a temporary directory or application data directory
2. WHEN the Frontend Dev Server creates a Port File THEN the Frontend Dev Server SHALL store it in a temporary directory or application data directory
3. WHEN the application exits normally THEN the system SHALL clean up the Port File
4. WHEN the Port File already exists from a previous crashed process THEN the system SHALL validate or overwrite it with current information

### Requirement 5

**User Story:** 作为开发者，我希望能够通过环境变量禁用自动端口发现功能，这样在生产环境或特定场景下可以强制使用固定端口。

#### Acceptance Criteria

1. WHERE an environment variable disables auto-discovery, the Backend Server SHALL only attempt to bind to the configured port
2. WHERE an environment variable disables auto-discovery, the Frontend Dev Server SHALL only attempt to bind to the configured port
3. WHEN auto-discovery is disabled AND the configured port is occupied THEN the system SHALL fail immediately with a clear error message
4. WHEN auto-discovery is disabled THEN the system SHALL not create or read Port Files
