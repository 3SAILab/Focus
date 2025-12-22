# Implementation Plan

- [x] 1. 添加版本配置到 package.json









  - 在根目录 package.json 中添加 `versionCode` 字段
  - 值设置为 `"202512201755"`
  - _Requirements: 3.1, 3.5_

- [x] 2. 实现 Electron 版本检查模块






  - [x] 2.1 创建版本检查工具函数

    - 在 `electron/` 目录创建 `versionChecker.js`
    - 实现 `checkNetworkConnection()` 函数
    - 实现 `fetchVersionInfo()` 函数从 OSS 下载 version.json
    - 实现 `compareVersion(local, remote)` 函数比对版本
    - 实现 `getDownloadUrl(versionInfo)` 函数根据平台选择下载链接
    - _Requirements: 1.1, 2.1, 2.2, 3.1, 3.3_

  - [ ]* 2.2 编写版本比对属性测试
    - **Property 1: Version comparison detects any mismatch**
    - **Validates: Requirements 3.1**

  - [ ]* 2.3 编写下载链接选择属性测试
    - **Property 2: Download URL selection by platform**
    - **Validates: Requirements 3.3**


  - [x] 2.4 集成版本检查到 Electron 主进程

    - 修改 `electron/main.js`
    - 在 `app.whenReady()` 中添加版本检查逻辑
    - 添加 IPC 通道: `get-version-info`, `check-update`, `open-download-url`
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_


  - [x] 2.5 更新 preload.js 暴露版本检查 API

    - 添加 `getVersionInfo()`, `checkUpdate()`, `openDownloadUrl()` 方法
    - _Requirements: 3.3_

- [x] 3. 实现前端版本检查 UI





  - [x] 3.1 创建 UpdateModal 组件


    - 创建 `frontend/src/components/UpdateModal.tsx`
    - 显示更新内容说明
    - 提供"下载更新"按钮
    - 不允许关闭（强制更新）
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 创建 NetworkErrorModal 组件


    - 创建 `frontend/src/components/NetworkErrorModal.tsx`
    - 显示网络错误信息
    - 提供"重试"按钮
    - _Requirements: 1.2, 1.3, 2.3_

  - [x] 3.3 创建 VersionContext 管理版本状态


    - 创建 `frontend/src/context/VersionContext.tsx`
    - 管理版本检查状态和结果
    - _Requirements: 1.1, 3.1, 3.5_

  - [x] 3.4 集成版本检查到应用入口


    - 修改 `frontend/src/App.tsx` 或路由入口
    - 在应用启动时进行版本检查
    - 根据检查结果显示对应弹窗或允许进入
    - _Requirements: 1.1, 1.2, 3.1, 3.4, 3.5_

- [x] 4. Checkpoint - 确保版本检查功能正常





  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. 实现后端余额查询模块






  - [x] 5.1 创建余额查询 handler

    - 创建 `backend/handlers/balance.go`
    - 实现 `GET /api/balance` 端点
    - 调用 VectorEngine API 获取订阅和使用量信息
    - 计算剩余余额并判断是否低于阈值
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 5.2 编写余额计算属性测试
    - **Property 3: Balance calculation accuracy**
    - **Validates: Requirements 4.2**

  - [ ]* 5.3 编写阈值检测属性测试
    - **Property 4: Low balance threshold detection**
    - **Validates: Requirements 5.1**

  - [x] 5.4 注册余额查询路由


    - 修改 `backend/main.go` 注册 `/api/balance` 路由
    - _Requirements: 4.1_

- [x] 6. 实现前端余额警告 UI





  - [x] 6.1 创建 BalanceWarning 组件


    - 创建 `frontend/src/components/BalanceWarning.tsx`
    - 固定在右下角显示
    - 红色文字显示"余额即将不足，请联系销售充值"
    - _Requirements: 5.1, 5.2_

  - [x] 6.2 添加余额查询 API 调用


    - 修改 `frontend/src/api/index.ts` 添加 `checkBalance()` 方法
    - _Requirements: 4.1_

  - [x] 6.3 集成余额检查到生成流程


    - 修改 `frontend/src/views/Create.tsx`
    - 在触发生成时调用余额查询
    - 根据结果显示或隐藏警告组件
    - _Requirements: 4.1, 5.1, 5.3, 5.4_

  - [ ]* 6.4 编写余额警告持久性属性测试
    - **Property 5: Balance warning persistence**
    - **Validates: Requirements 5.3**

- [x] 7. Final Checkpoint - 确保所有功能正常





  - Ensure all tests pass, ask the user if questions arise.
