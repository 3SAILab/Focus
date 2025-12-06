# Design Document: Auto Port Management

## Overview

自动端口管理功能通过端口探测和文件共享机制，实现后端和前端服务器在端口冲突时自动切换到可用端口，并确保各组件能够自动发现彼此的实际运行端口。该设计采用轻量级的文件系统通信方式，避免引入额外的依赖。

核心设计理念：
- 最小侵入性：不改变现有的服务器启动逻辑，仅在端口绑定层面增强
- 自动发现：通过端口文件实现跨进程通信
- 优雅降级：在端口文件不可用时回退到默认配置
- 环境可控：支持通过环境变量控制行为

## Architecture

系统采用双层架构：

```
┌──────────────────────────────┐  ┌──────────────────────────────┐
│      Backend Server (Go)     │  │  Frontend Dev Server (Vite)  │
│  - 端口自动发现              │  │  - 端口自动发现              │
│  - 写入端口文件              │  │  - 读取后端端口文件          │
│  - 提供 API 服务             │  │  - 写入前端端口文件          │
└──────────────────────────────┘  └──────────────────────────────┘
                           │                 │
                           └────────┬────────┘
                                    ↓
                        ┌───────────────────────┐
                        │   Port Files (FS)     │
                        │  - backend.port       │
                        │  - frontend.port      │
                        └───────────────────────┘
```

## Components and Interfaces

### 1. Port Discovery Module (Go)

**Location**: `backend/utils/port.go`

**Responsibilities**:
- 检测端口是否可用
- 从起始端口开始顺序查找可用端口
- 将实际使用的端口写入文件

**Interface**:
```go
// FindAvailablePort 从 startPort 开始查找可用端口
// maxAttempts: 最大尝试次数
// 返回: 可用端口号, 错误
func FindAvailablePort(startPort int, maxAttempts int) (int, error)

// IsPortAvailable 检查指定端口是否可用
func IsPortAvailable(port int) bool

// WritePortFile 将端口号写入文件
func WritePortFile(port int, filename string) error

// ReadPortFile 从文件读取端口号
func ReadPortFile(filename string) (int, error)

// GetPortFilePath 获取端口文件的完整路径
func GetPortFilePath(filename string) string
```

### 2. Port Discovery Module (TypeScript)

**Location**: `frontend/src/utils/portDiscovery.ts`

**Responsibilities**:
- 读取后端端口文件
- 构建后端 API URL
- 提供环境变量注入

**Interface**:
```typescript
// 读取后端端口文件
export function readBackendPort(): number | null

// 获取后端 URL
export function getBackendURL(): string

// 获取端口文件路径
export function getPortFilePath(filename: string): string
```

### 3. Vite Plugin for Port Discovery

**Location**: `frontend/vite-plugin-port-discovery.ts`

**Responsibilities**:
- 在 Vite 启动时读取后端端口
- 将后端 URL 注入到环境变量
- 监听端口文件变化

**Interface**:
```typescript
export default function portDiscoveryPlugin(options?: {
  backendPortFile?: string
  defaultBackendPort?: number
}): Plugin
```



## Data Models

### Port File Format

端口文件采用简单的文本格式，每个文件包含一个整数端口号：

```
8080
```

**文件位置**:
- Linux/macOS: `/tmp/sigma-backend.port`, `/tmp/sigma-frontend.port`
- Windows: `%TEMP%\sigma-backend.port`, `%TEMP%\sigma-frontend.port`

### Configuration Model

```go
type PortConfig struct {
    DefaultPort      int  // 默认端口
    MaxAttempts      int  // 最大尝试次数
    AutoDiscovery    bool // 是否启用自动发现
    PortFileName     string // 端口文件名
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Acceptance Criteria Testing Prework

1.1 WHEN the Backend Server attempts to start on the default port AND that port is occupied THEN the Backend Server SHALL attempt to bind to the next sequential port number
  Thoughts: 这是一个关于所有端口冲突场景的通用规则。我们可以生成随机的占用端口列表，然后验证服务器是否正确地跳过这些端口并找到下一个可用端口。
  Testable: yes - property

1.2 WHEN the Backend Server successfully binds to a port THEN the Backend Server SHALL write the actual port number to a Port File
  Thoughts: 这是关于所有成功绑定场景的规则。对于任何成功绑定的端口，端口文件应该包含该端口号。
  Testable: yes - property

1.3 WHEN the Backend Server tries multiple ports AND all attempts fail within a reasonable range THEN the Backend Server SHALL log an error message and exit gracefully
  Thoughts: 这是一个边界情况，当所有端口都被占用时的行为。
  Testable: yes - edge case

1.4 WHEN the Backend Server starts successfully THEN the Backend Server SHALL log the actual listening address to the console
  Thoughts: 这是关于日志输出的要求，对于任何成功启动的情况都应该有日志。
  Testable: yes - property

1.5 WHERE port auto-discovery is enabled, the Backend Server SHALL attempt up to 10 sequential ports before failing
  Thoughts: 这是一个配置约束，验证尝试次数不超过限制。
  Testable: yes - property

2.1 WHEN the Frontend Dev Server attempts to start on the default port AND that port is occupied THEN the Frontend Dev Server SHALL attempt to bind to the next sequential port number
  Thoughts: 与后端相同的逻辑，适用于所有前端端口冲突场景。
  Testable: yes - property

2.2 WHEN the Frontend Dev Server successfully binds to a port THEN the Frontend Dev Server SHALL write the actual port number to a Port File
  Thoughts: 与后端相同，任何成功绑定都应写入端口文件。
  Testable: yes - property

2.3 WHEN the Frontend Dev Server starts successfully THEN the Frontend Dev Server SHALL log the actual listening address to the console
  Thoughts: 日志输出要求，适用于所有成功启动场景。
  Testable: yes - property

2.4 WHERE port auto-discovery is enabled, the Frontend Dev Server SHALL attempt up to 10 sequential ports before failing
  Thoughts: 配置约束验证。
  Testable: yes - property

3.1 WHEN the Frontend Dev Server starts THEN the Frontend Dev Server SHALL read the Backend Server's Port File to determine the backend URL
  Thoughts: 这是关于前端启动时的行为，适用于所有启动场景。
  Testable: yes - property

3.2 WHEN the Port File does not exist or is invalid THEN the Frontend Dev Server SHALL fall back to the default backend port
  Thoughts: 这是错误处理的边界情况。
  Testable: yes - edge case

3.3 WHEN the Frontend Dev Server reads the backend port THEN the Frontend Dev Server SHALL inject the backend URL into the application environment
  Thoughts: 对于任何成功读取的端口，都应该正确注入环境变量。
  Testable: yes - property

3.4 WHEN the backend port changes THEN the Frontend Dev Server SHALL detect the change and update the backend URL without requiring a restart
  Thoughts: 这是关于文件监听和热更新的功能，适用于所有端口变化场景。
  Testable: yes - property

4.1 WHEN the Backend Server creates a Port File THEN the Backend Server SHALL store it in a temporary directory or application data directory
  Thoughts: 这是关于文件位置的要求，适用于所有端口文件创建场景。
  Testable: yes - property

4.2 WHEN the Frontend Dev Server creates a Port File THEN the Frontend Dev Server SHALL store it in a temporary directory or application data directory
  Thoughts: 与后端相同的文件位置要求。
  Testable: yes - property

4.3 WHEN the application exits normally THEN the system SHALL clean up the Port File
  Thoughts: 这是资源清理的要求，适用于所有正常退出场景。
  Testable: yes - property

4.4 WHEN the Port File already exists from a previous crashed process THEN the system SHALL validate or overwrite it with current information
  Thoughts: 这是处理遗留文件的边界情况。
  Testable: yes - edge case

5.1 WHERE an environment variable disables auto-discovery, the Backend Server SHALL only attempt to bind to the configured port
  Thoughts: 这是配置控制的要求，当禁用自动发现时的行为。
  Testable: yes - property

5.2 WHERE an environment variable disables auto-discovery, the Frontend Dev Server SHALL only attempt to bind to the configured port
  Thoughts: 与后端相同的配置控制。
  Testable: yes - property

5.3 WHEN auto-discovery is disabled AND the configured port is occupied THEN the system SHALL fail immediately with a clear error message
  Thoughts: 这是禁用自动发现时的错误处理。
  Testable: yes - property

5.4 WHEN auto-discovery is disabled THEN the system SHALL not create or read Port Files
  Thoughts: 配置控制下的文件操作行为。
  Testable: yes - property

### Property Reflection

审查所有属性后，发现以下可以合并或简化的情况：

- **属性 1.1 和 2.1** 可以合并为一个通用的"端口冲突自动切换"属性，因为后端和前端的逻辑相同
- **属性 1.2 和 2.2** 可以合并为"成功绑定写入文件"属性
- **属性 1.5 和 2.4** 可以合并为"尝试次数限制"属性
- **属性 4.1 和 4.2** 可以合并为"端口文件位置"属性
- **属性 5.1 和 5.2** 可以合并为"禁用自动发现时的行为"属性

合并后，我们将有更精简的属性集合。

### Property 1: Port conflict auto-switching
*For any* server (backend or frontend) and any occupied port, when the server attempts to start on that port, the server should automatically try the next sequential port until finding an available one.
**Validates: Requirements 1.1, 2.1**

### Property 2: Port file creation on successful binding
*For any* server that successfully binds to a port, the actual port number should be written to the corresponding port file.
**Validates: Requirements 1.2, 2.2**

### Property 3: Attempt limit enforcement
*For any* server with auto-discovery enabled, the number of port binding attempts should not exceed the configured maximum (10 by default).
**Validates: Requirements 1.5, 2.4**

### Property 4: Console logging on successful start
*For any* server that starts successfully, the actual listening address should be logged to the console.
**Validates: Requirements 1.4, 2.3**

### Property 5: Frontend reads backend port file
*For any* frontend server startup, if the backend port file exists and is valid, the frontend should use the port number from that file to construct the backend URL.
**Validates: Requirements 3.1**

### Property 6: Backend URL injection
*For any* backend port read by the frontend, the corresponding backend URL should be injected into the application environment variables.
**Validates: Requirements 3.3**

### Property 7: Port file change detection
*For any* change to the backend port file, the frontend should detect the change and update the backend URL without requiring a restart.
**Validates: Requirements 3.4**

### Property 8: Port file location consistency
*For any* port file created by the system, the file should be stored in the appropriate temporary or application data directory based on the runtime environment.
**Validates: Requirements 4.1, 4.2**

### Property 9: Port file cleanup on exit
*For any* normal application exit, the system should remove the corresponding port file.
**Validates: Requirements 4.3**

### Property 10: Disabled auto-discovery behavior
*For any* server with auto-discovery disabled via environment variable, the server should only attempt to bind to the configured port and should not create or read port files.
**Validates: Requirements 5.1, 5.2, 5.4**

### Property 11: Immediate failure when auto-discovery disabled
*For any* server with auto-discovery disabled, if the configured port is occupied, the server should fail immediately with a clear error message.
**Validates: Requirements 5.3**

## Error Handling

### Port Discovery Errors

1. **All ports occupied**: 当尝试了最大次数后仍无可用端口
   - 记录详细错误日志，包括尝试的端口范围
   - 返回明确的错误信息
   - 优雅退出，不留下僵尸进程

2. **Port file write failure**: 无法写入端口文件
   - 记录警告日志
   - 继续运行服务器（端口文件是辅助功能）
   - 在日志中提示可能影响其他组件的端口发现

3. **Port file read failure**: 无法读取端口文件
   - 回退到默认端口配置
   - 记录警告日志
   - 不阻塞应用启动

### Network Errors

1. **Port binding failure**: 端口绑定失败但检测显示可用
   - 可能是权限问题或临时占用
   - 继续尝试下一个端口
   - 记录详细错误信息

## Testing Strategy

### Unit Testing

使用 Go 的标准测试框架和 Vitest 进行单元测试：

**Go Backend Tests** (`backend/utils/port_test.go`):
- `TestIsPortAvailable`: 测试端口可用性检测
- `TestFindAvailablePort`: 测试端口查找逻辑
- `TestWritePortFile`: 测试端口文件写入
- `TestReadPortFile`: 测试端口文件读取
- `TestGetPortFilePath`: 测试端口文件路径生成

**TypeScript Frontend Tests** (`frontend/src/utils/portDiscovery.test.ts`):
- `testReadBackendPort`: 测试读取后端端口
- `testGetBackendURL`: 测试 URL 构建
- `testGetPortFilePath`: 测试路径生成

### Property-Based Testing

使用 Go 的 `testing/quick` 包和 JavaScript 的 `fast-check` 库进行属性测试：

**配置要求**:
- 每个属性测试至少运行 100 次迭代
- 使用随机端口号（1024-65535 范围）
- 使用随机文件路径和内容

**测试标注格式**:
每个属性测试必须包含注释，格式为：
```go
// Feature: auto-port-management, Property 1: Port conflict auto-switching
```

**Go Property Tests**:
- Property 1: 生成随机占用端口列表，验证自动切换逻辑
- Property 2: 生成随机端口号，验证文件写入和读取的一致性
- Property 3: 生成随机起始端口，验证尝试次数不超过限制
- Property 8: 生成随机环境配置，验证文件路径的正确性
- Property 9: 验证文件清理的幂等性
- Property 10: 生成随机配置，验证禁用自动发现时的行为

**JavaScript Property Tests**:
- Property 5: 生成随机端口文件内容，验证读取和 URL 构建
- Property 6: 生成随机端口号，验证环境变量注入
- Property 7: 模拟文件变化，验证热更新机制

### Integration Testing

**Backend-Frontend Integration**:
1. 启动后端服务器，占用默认端口
2. 启动第二个后端实例，验证自动切换到下一个端口
3. 启动前端服务器，验证能读取后端实际端口
4. 修改后端端口文件，验证前端能检测到变化

### Edge Case Testing

重点测试以下边界情况：
- 端口文件被其他进程锁定
- 端口文件包含非数字内容
- 临时目录不存在或无写权限
- 所有端口都被占用
- 端口文件在读取过程中被删除

## Implementation Notes

### Go Implementation

使用 `net.Listen` 进行端口探测：
```go
func IsPortAvailable(port int) bool {
    addr := fmt.Sprintf(":%d", port)
    listener, err := net.Listen("tcp", addr)
    if err != nil {
        return false
    }
    listener.Close()
    return true
}
```

### Vite Plugin Implementation

使用 Vite 的 `configResolved` 和 `configureServer` 钩子：
```typescript
export default function portDiscoveryPlugin(): Plugin {
    return {
        name: 'port-discovery',
        configResolved(config) {
            // 读取后端端口并注入环境变量
        },
        configureServer(server) {
            // 监听端口文件变化
        }
    }
}
```

### File System Considerations

- 使用原子写入避免竞态条件
- 在 Windows 上处理文件锁定问题
- 使用文件监听器（fsnotify）实现热更新
- 在应用退出时注册清理钩子

## Performance Considerations

- 端口探测应该快速失败（设置短超时）
- 文件读写使用缓冲 I/O
- 避免频繁的文件系统操作
- 端口文件变化检测使用防抖机制

## Security Considerations

- 端口文件应该只包含端口号，不包含敏感信息
- 验证从文件读取的端口号在有效范围内（1-65535）
- 防止路径遍历攻击（验证文件路径）
- 在多用户系统上使用用户特定的临时目录
