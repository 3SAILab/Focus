# Implementation Plan - Electron Packaging Fixes

## 概述

本实施计划针对 SIGMA Electron 应用的打包问题进行修复，基于对 electron-demo-dst 参考项目的分析。主要改进包括：简化后端路径管理、标准化用户数据目录、优化构建流程、增强错误处理。

---

## 任务列表

- [x] 1. 更新路径管理逻辑





  - [ ] 1.1 修改 electron/main.js 使用 app.isPackaged 判断环境
    - 将 `const isDev = process.env.NODE_ENV === 'development'` 改为 `const isDev = !app.isPackaged`
    - 确保在 app.whenReady() 之后使用

    - _Requirements: 4.1, 4.2, 4.3_

  - [ ] 1.2 修改用户数据目录为标准位置
    - 将 `path.join(path.dirname(app.getPath('exe')), 'user-data')` 改为 `app.getPath('userData')`

    - 更新所有引用 userDataPath 的代码
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ] 1.3 简化后端可执行文件路径解析
    - 创建 `getBackendPath()` 函数统一管理路径

    - 开发环境：`path.join(__dirname, '..', 'dist', 'backend', 'sigma-backend.exe')`
    - 生产环境：`path.join(process.resourcesPath, 'backend', 'sigma-backend.exe')`
    - _Requirements: 1.1, 1.2_

  - [x] 1.4 移除后端文件复制逻辑

    - 删除从 resources 复制到 user-data 的代码
    - 直接从 resources 目录运行后端
    - 更新 spawn 的 cwd 参数为后端所在目录



    - _Requirements: 1.1, 1.2, 5.1_

  - [ ] 1.5 添加路径验证函数
    - 创建 `validateBackendPath()` 函数

    - 在启动前验证后端可执行文件存在
    - 记录详细的路径信息用于调试
    - _Requirements: 1.3, 1.4_


- [ ] 2. 改进错误处理和日志
  - [ ] 2.1 移除生产环境的调试对话框
    - 删除 `if (!isDev)` 块中的 dialog.showMessageBox 调用
    - 仅在开发模式记录调试信息到控制台

    - _Requirements: 4.4, 7.5_

  - [-] 2.2 改进启动失败错误提示

    - 更新错误对话框显示有用信息（期望路径、实际路径、日志位置）
    - 提供可操作的建议（重新安装、检查杀毒软件等）
    - _Requirements: 1.4, 7.2, 7.3, 10.1, 10.2_

  - [ ] 2.3 优化日志文件位置
    - 将日志文件移到 `app.getPath('userData')/logs/` 目录
    - 确保日志目录在写入前创建
    - _Requirements: 7.1, 7.4_

  - [ ] 2.4 添加路径信息日志
    - 在启动时记录所有关键路径（仅开发模式或失败时）
    - 包括：isPackaged, resourcesPath, userDataPath, backendPath
    - _Requirements: 7.2, 7.3_

- [x] 3. 优化构建配置


  - [x] 3.1 更新 package.json 构建脚本


    - 将并行执行（`&`）改为顺序执行（`&&`）
    - 添加 `build:sequential` 脚本
    - 添加 `clean` 和 `prebuild` 脚本
    - _Requirements: 6.1, 6.2_

  - [x] 3.2 添加构建验证脚本


    - 创建 `scripts/validate-build.js`
    - 验证必需文件存在：dist/backend/sigma-backend.exe, frontend/dist/index.html
    - 在 electron-builder 之前运行验证
    - _Requirements: 6.3, 6.4_

  - [x] 3.3 优化 electron-builder 配置


    - 更新 files 配置排除更多不必要文件
    - 添加 `requestedExecutionLevel: "asInvoker"` 到 win 配置
    - 确认 extraResources 配置正确
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.4 添加后端构建优化标志

    - 在 Go 构建命令中添加 `-ldflags="-s -w"` 减小文件大小
    - 更新所有平台的构建脚本
    - _Requirements: 6.3_

- [x] 4. 更新测试





  - [x] 4.1 更新 electron/main.test.js


    - 更新路径解析测试使用新的逻辑
    - 测试 `getBackendPath()` 在不同环境下的行为
    - 测试用户数据目录使用标准位置
    - _Requirements: 1.1, 1.2, 3.1_

  - [x] 4.2 更新 electron/e2e.test.js


    - 验证打包后的应用能正确找到后端
    - 验证用户数据目录在标准位置
    - 验证不显示调试对话框
    - _Requirements: 1.1, 3.1, 4.4_

  - [x] 4.3 更新 electron/build-validation.test.js


    - 添加测试验证 resources/backend 目录存在
    - 验证后端可执行文件在正确位置
    - 验证 app.asar 包含前端文件
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 5. 更新文档





  - [x] 5.1 更新 BUILD.md


    - 更新构建步骤反映新的顺序执行方式
    - 添加构建验证说明
    - 更新路径结构说明
    - _Requirements: 6.1, 6.2, 6.5_

  - [x] 5.2 更新 DEVELOPMENT_MODE.md


    - 说明新的环境判断方式（app.isPackaged）
    - 更新路径结构说明
    - 添加调试技巧
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 5.3 创建迁移指南


    - 创建 MIGRATION.md 说明从旧版本迁移的步骤
    - 列出主要变更和影响
    - 提供故障排除建议
    - _Requirements: 所有_

- [x] 6. Checkpoint - 验证开发模式





  - 在开发模式运行应用
  - 验证后端正确启动
  - 验证路径解析正确
  - 验证日志记录正常
  - _Requirements: 1.1, 1.2, 4.1, 7.1_

- [x] 7. Checkpoint - 验证构建和打包





  - 运行完整构建流程
  - 验证所有文件正确打包
  - 安装并运行打包后的应用
  - 验证后端从 resources 正确启动
  - 验证用户数据在标准位置
  - 验证不显示调试对话框
  - _Requirements: 所有_

- [x] 8. Final Checkpoint - 完整测试





  - 在 Windows 上测试完整流程
  - 测试全新安装
  - 测试升级安装
  - 测试卸载
  - 验证不留下孤立进程
  - 检查日志文件位置和内容
  - _Requirements: 所有_

---

## 实施顺序说明

1. **第一阶段（任务 1-2）**：核心路径管理和错误处理改进
   - 这是最关键的改进，解决主要的打包问题
   - 完成后应该能在开发模式正常运行

2. **第二阶段（任务 3）**：构建配置优化
   - 确保构建流程可靠
   - 添加验证步骤防止不完整的构建

3. **第三阶段（任务 4-5）**：测试和文档更新
   - 确保所有改动都有测试覆盖
   - 更新文档反映新的实现

4. **第四阶段（任务 6-8）**：验证和测试
   - 逐步验证每个改进点
   - 确保生产构建正常工作

---

## 注意事项

1. **向后兼容性**：用户数据目录位置变更可能影响现有用户
   - 考虑添加迁移逻辑从旧位置复制数据
   - 或在文档中说明需要重新配置

2. **测试覆盖**：每个改动都应该有对应的测试
   - 路径解析测试
   - 构建验证测试
   - E2E 测试

3. **渐进式改进**：可以分步实施
   - 先修复路径管理（任务 1）
   - 再优化构建（任务 3）
   - 最后完善测试和文档

4. **回滚计划**：保留当前版本的备份
   - 如果新版本有问题可以快速回滚
   - 使用 git 分支管理改动

---

## 预期成果

完成所有任务后，应该达到以下效果：

✅ 后端可执行文件直接从 resources 运行，无需复制
✅ 用户数据存储在操作系统标准位置
✅ 开发和生产环境路径解析逻辑清晰简单
✅ 构建流程可靠，有验证步骤
✅ 错误提示清晰，包含有用的调试信息
✅ 生产环境不显示调试对话框
✅ 所有改动都有测试覆盖
✅ 文档完整准确

