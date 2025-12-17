# Design Document: Focus 项目文档系统

## Overview

本设计文档定义了 Focus AI 图片生成桌面应用的完整文档体系。文档系统采用 Markdown 格式，组织在 `docs/` 目录下，涵盖项目概览、前端开发、后端 API、打包部署、UI 布局等方面。

## Architecture

文档系统采用分层结构，按照读者角色和使用场景组织：

```
docs/
├── README.md                    # 项目概览和快速入门
├── ARCHITECTURE.md              # 系统架构详解
├── frontend/
│   ├── README.md               # 前端开发指南
│   ├── COMPONENTS.md           # 组件文档
│   ├── HOOKS.md                # 自定义 Hooks
│   ├── TYPES.md                # 类型定义
│   └── ROUTING.md              # 路由结构
├── backend/
│   ├── README.md               # 后端开发指南
│   ├── API.md                  # API 接口文档
│   ├── MODELS.md               # 数据模型
│   └── CONFIG.md               # 配置说明
├── electron/
│   ├── README.md               # Electron 开发指南
│   └── PACKAGING.md            # 打包部署
└── ui/
    ├── LAYOUT.md               # 布局结构
    └── DESIGN_SYSTEM.md        # 设计规范
```

## Components and Interfaces

### 1. 项目概览文档 (docs/README.md)

包含以下章节：
- 项目简介
- 技术栈概览
- 目录结构
- 快速开始
- 开发命令
- 贡献指南

### 2. 架构文档 (docs/ARCHITECTURE.md)

包含以下章节：
- 三层架构图 (Mermaid)
- Electron 主进程
- React 前端
- Go 后端
- 通信流程
- 数据流

### 3. 前端文档 (docs/frontend/)

#### 3.1 组件文档 (COMPONENTS.md)
- 公共组件 (common/)
- 业务组件
- 视图组件 (views/)
- 布局组件 (layout/)

#### 3.2 Hooks 文档 (HOOKS.md)
- useImageUpload
- useTaskRecovery
- useDragDrop
- useToast

#### 3.3 类型文档 (TYPES.md)
- GenerationHistory
- GenerationTask
- GenerationType
- API 响应类型

#### 3.4 路由文档 (ROUTING.md)
- 路由配置
- 页面导航
- 路由守卫

### 4. 后端文档 (docs/backend/)

#### 4.1 API 文档 (API.md)
按功能分组的接口文档：
- 配置接口 (/config/*)
- 生成接口 (/generate)
- 历史接口 (/history/*)
- 统计接口 (/stats/*)
- 任务接口 (/tasks/*)
- 静态文件 (/images/*, /uploads/*)

#### 4.2 数据模型 (MODELS.md)
- GenerationHistory
- GenerationStats
- GenerationTask

#### 4.3 配置文档 (CONFIG.md)
- 环境变量
- 路径配置
- TLS 配置

### 5. Electron 文档 (docs/electron/)

#### 5.1 开发指南 (README.md)
- 主进程结构
- 预加载脚本
- IPC 通信

#### 5.2 打包文档 (PACKAGING.md)
- 构建流程
- 平台配置
- 签名和公证

### 6. UI 文档 (docs/ui/)

#### 6.1 布局文档 (LAYOUT.md)
- 整体布局结构
- 侧边栏导航
- 页面视图组成

#### 6.2 设计规范 (DESIGN_SYSTEM.md)
- 颜色系统
- 字体规范
- 间距系统
- 组件样式

## Data Models

### 文档元数据结构

```typescript
interface DocumentMetadata {
  title: string;
  description: string;
  lastUpdated: string;
  version: string;
  authors: string[];
}
```

### API 文档条目结构

```typescript
interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  requestParams?: {
    name: string;
    type: string;
    required: boolean;
    description: string;
  }[];
  requestBody?: {
    contentType: string;
    schema: object;
    example: object;
  };
  response: {
    statusCode: number;
    contentType: string;
    schema: object;
    example: object;
  }[];
}
```

### 组件文档条目结构

```typescript
interface ComponentDoc {
  name: string;
  path: string;
  description: string;
  props: {
    name: string;
    type: string;
    required: boolean;
    default?: string;
    description: string;
  }[];
  usage: string; // 代码示例
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: API 文档完整性

*For any* API endpoint defined in `backend/main.go`, the API documentation (`docs/backend/API.md`) should contain an entry with the endpoint's HTTP method, path, request parameters, and response format with JSON examples.

**Validates: Requirements 3.1, 3.2**

### Property 2: 组件文档覆盖率

*For any* React component file in `frontend/src/components/`, the component documentation should contain an entry describing its props, state management, and usage example.

**Validates: Requirements 2.1**

### Property 3: 路由文档一致性

*For any* route defined in `frontend/src/router/index.tsx`, the routing documentation should contain a corresponding entry with path, component, and navigation description.

**Validates: Requirements 2.2**

## Error Handling

文档系统本身不涉及运行时错误处理，但文档内容应包含：

1. **API 错误码文档**：记录所有可能的错误响应
2. **故障排除指南**：常见问题和解决方案
3. **日志说明**：如何查看和分析日志

## Testing Strategy

### 文档验证方法

由于文档是静态内容，测试主要通过以下方式进行：

1. **结构验证**：检查文档文件是否存在且包含必要章节
2. **链接检查**：验证文档内部链接有效性
3. **代码示例验证**：确保代码示例语法正确
4. **一致性检查**：验证文档与实际代码的一致性

### 手动审查清单

- [ ] 所有 API 端点都有文档
- [ ] 所有组件都有 props 说明
- [ ] 所有自定义 Hooks 都有文档
- [ ] 架构图与实际代码一致
- [ ] 配置说明与 .env.template 一致
