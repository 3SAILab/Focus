# Implementation Plan

## 1. 后端数据模型和接口扩展

- [x] 1.1 扩展 GenerationHistory 模型添加 type 字段
  - 修改 `backend/models/generation_history.go`，添加 Type 字段
  - 更新数据库迁移逻辑
  - _Requirements: 2.2_

- [x] 1.2 创建生成统计模型和接口
  - 创建 `backend/models/generation_stats.go`
  - 添加 GET `/stats/generation-count` 接口
  - 添加 POST `/stats/increment-count` 接口
  - _Requirements: 3.1, 3.2_

- [x] 1.3 创建白底图历史记录接口
  - 添加 GET `/history/white-background` 接口，筛选 type="white_background" 的记录
  - _Requirements: 2.1, 2.2_

- [x] 1.4 修改现有生成接口支持 type 参数
  - 修改 `backend/handlers/generate.go`，接收并保存 type 参数
  - 生成成功后调用计数增加逻辑
  - _Requirements: 2.2, 3.1_

- [x] 1.5 编写后端接口单元测试
  - 测试生成统计接口
  - 测试白底图历史筛选接口
  - _Requirements: 1.2, 1.3_

## 2. 前端类型定义和 API 扩展

- [x] 2.1 扩展前端类型定义
  - 修改 `frontend/src/type/index.ts`，添加 type 字段和 GenerationStats 类型
  - _Requirements: 2.2, 3.1_

- [x] 2.2 扩展 API 服务
  - 修改 `frontend/src/api/index.ts`，添加生成计数和白底图历史接口
  - _Requirements: 3.1, 3.2, 2.1_

## 3. 核心组件开发

- [x] 3.1 创建光影选项对话框组件
  - 创建 `frontend/src/components/ShadowOptionDialog.tsx`
  - 实现两个选项：保留光影 / 去除光影
  - 实现确认和取消按钮
  - _Requirements: 1.4, 6.1, 6.2_

- [x] 3.2 编写提示词构造属性测试
  - **Property 1: 提示词构造正确性**
  - **Validates: Requirements 1.5, 6.1, 6.2**

- [x] 3.3 创建生成计数器组件
  - 创建 `frontend/src/components/GenerationCounter.tsx`
  - 显示已生成图片数量
  - 支持实时更新
  - _Requirements: 3.2, 3.3_

- [x] 3.4 创建免责声明弹窗组件
  - 创建 `frontend/src/components/DisclaimerModal.tsx`
  - 包含软件使用说明
  - 包含 AI 生图内容免责说明
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 3.5 创建联系我们弹窗组件
  - 创建 `frontend/src/components/ContactModal.tsx`
  - 显示联系人手机号
  - 显示微信二维码图片占位
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

## 4. 白底图页面开发

- [x] 4.1 创建白底图页面基础结构
  - 创建 `frontend/src/views/WhiteBackground.tsx`
  - 实现左右分栏布局（左侧上传，右侧输出）
  - 添加页面标题和生成计数器
  - _Requirements: 1.2_

- [x] 4.2 实现图片上传功能
  - 复用 ImageUpload 组件或创建简化版本
  - 在左侧区域显示上传预览
  - _Requirements: 1.3_

- [x] 4.3 实现生成功能和动画
  - 集成光影选项对话框
  - 实现提示词构造逻辑
  - 复用 PlaceholderCard 显示生成动画
  - 显示生成结果
  - _Requirements: 1.4, 1.5, 1.6, 1.7, 6.1, 6.2_

- [x] 4.4 实现白底图历史记录展示
  - 在页面底部显示白底图历史
  - 点击历史记录在右侧显示图片
  - _Requirements: 2.1, 2.3_

- [x] 4.5 编写历史记录类型属性测试
  - **Property 3: 历史记录类型标记正确性**
  - **Validates: Requirements 2.2**

## 5. 侧边栏和路由更新

- [x] 5.1 更新 Layout 组件侧边栏
  - 添加白底图导航按钮
  - 添加免责声明按钮（左下角）
  - 添加联系我们按钮（左下角）
  - _Requirements: 1.1, 4.1, 5.1_

- [x] 5.2 更新路由配置
  - 修改 `frontend/src/router/index.tsx`，添加白底图路由
  - _Requirements: 1.1_

## 6. 生成计数集成

- [x] 6.1 在创作页面集成生成计数
  - 修改 `frontend/src/views/Create.tsx`，生成成功后调用计数增加接口
  - 在 header 添加生成计数器显示
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 6.2 编写生成计数属性测试
  - **Property 2: 生成计数一致性**
  - **Validates: Requirements 3.1**

## 7. Checkpoint - 确保所有测试通过

- [x] 7. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## 8. 样式和交互优化

- [x] 8.1 统一组件样式
  - 确保新组件与现有风格一致
  - 添加过渡动画效果
  - _Requirements: 1.6_

- [x] 8.2 添加错误处理和 Toast 提示
  - 未上传图片时提示
  - 生成失败时提示
  - _Requirements: 1.3, 1.5_

## 9. Final Checkpoint - 确保所有测试通过

- [x] 9. Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.
