# Implementation Plan

- [x] 1. 扩展类型定义和 API





  - [x] 1.1 在 frontend/src/type/index.ts 中添加 PRODUCT_SCENE 和 LIGHT_SHADOW 类型


    - 在 GenerationType 对象中添加新的类型常量
    - _Requirements: 5.1, 5.2_

  - [x] 1.2 在 frontend/src/api/index.ts 中添加历史记录 API 方法

    - 添加 getProductSceneHistory 和 getLightShadowHistory 方法
    - _Requirements: 1.6, 2.6_

- [x] 2. 实现 Prompt 构建工具函数





  - [x] 2.1 创建 frontend/src/utils/promptBuilder.ts 文件


    - 实现 buildProductScenePrompt(productName, scene) 函数
    - 实现 buildLightShadowPrompt(productName) 函数
    - _Requirements: 1.3, 2.3_
  - [ ]* 2.2 编写 Prompt 构建属性测试
    - **Property 2: 一键商品图 Prompt 构建**
    - **Property 4: 光影融合 Prompt 构建**
    - **Validates: Requirements 1.3, 2.3**

- [x] 3. 实现一键商品图页面





  - [x] 3.1 创建 frontend/src/views/ProductScene.tsx 组件


    - 实现图片上传区域
    - 实现产品名称输入框（必填）
    - 实现使用场景输入框（必填）
    - 实现生成按钮和结果展示区域
    - 实现历史记录展示
    - 复用 PageHeader, ImageUploadZone, GenerateButton, HistorySection 等组件
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6_
  - [ ]* 3.2 编写一键商品图输入验证属性测试
    - **Property 1: 一键商品图输入验证**
    - **Validates: Requirements 1.2**

- [x] 4. 实现光影融合页面






  - [x] 4.1 创建 frontend/src/views/LightShadow.tsx 组件

    - 实现图片上传区域
    - 实现产品名称输入框（必填）
    - 实现生成按钮和结果展示区域
    - 实现历史记录展示
    - 复用 PageHeader, ImageUploadZone, GenerateButton, HistorySection 等组件
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6_
  - [ ]* 4.2 编写光影融合输入验证属性测试
    - **Property 3: 光影融合输入验证**
    - **Validates: Requirements 2.2**

- [x] 5. 重构侧边栏导航





  - [x] 5.1 修改 frontend/src/layout/Layout.tsx 实现电商处理子菜单


    - 将白底图、换装、一键商品图、光影融合整合到电商处理子菜单
    - 实现 hover 展开/收起子菜单功能
    - 实现子菜单项点击导航
    - 实现电商处理菜单高亮逻辑
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [ ]* 5.2 编写菜单高亮属性测试
    - **Property 5: 电商处理菜单高亮**
    - **Validates: Requirements 3.4**

- [x] 6. 配置路由






  - [x] 6.1 修改 frontend/src/router/index.tsx 添加新路由

    - 添加 /product-scene 路由指向 ProductScene 组件
    - 添加 /light-shadow 路由指向 LightShadow 组件
    - _Requirements: 4.1, 4.2, 4.3_

- [ ] 7. Checkpoint - 确保所有测试通过




  - Ensure all tests pass, ask the user if questions arise.
