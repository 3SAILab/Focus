# Requirements Document

## Introduction

本功能为电商图片处理应用添加两个新功能：一键商品图和光影融合。同时重构侧边栏导航，将白底图、换装、一键商品图、光影融合四个功能整合到"电商处理"子菜单中，通过 hover 展开显示，优化导航结构。

## Glossary

- **Focus_System**: 电商图片处理桌面应用系统
- **一键商品图功能**: 用户上传产品图片，填写产品名称和使用场景，系统生成符合透视逻辑的使用场景图
- **光影融合功能**: 用户上传产品图片，填写产品名称，系统增强图片的光影真实性
- **电商处理菜单**: 侧边栏中的可展开菜单项，包含白底图、换装、一键商品图、光影融合四个子功能
- **产品名称**: 用户输入的产品名称，用于生成 prompt
- **使用场景**: 用户输入的产品使用场景描述，用于一键商品图功能的 prompt 生成
- **GenerationType**: 系统中用于区分不同生成类型的枚举值

## Requirements

### Requirement 1: 一键商品图功能

**User Story:** As a 电商用户, I want to 上传产品图并描述使用场景, so that I can 快速生成符合透视逻辑的产品使用场景图。

#### Acceptance Criteria

1. WHEN 用户访问一键商品图页面 THEN Focus_System SHALL 显示产品图上传区域、产品名称输入框和使用场景输入框
2. WHEN 用户未填写产品名称或使用场景 THEN Focus_System SHALL 禁用生成按钮并显示必填提示
3. WHEN 用户填写完整信息并点击生成 THEN Focus_System SHALL 使用模板 "请你给图中{产品名称}，生成{使用场景}的使用场景图，需要符合透视逻辑和使用方法" 构建 prompt
4. WHEN 生成请求发送成功 THEN Focus_System SHALL 显示加载状态并在完成后展示生成结果
5. WHEN 生成完成 THEN Focus_System SHALL 将记录保存到历史记录中
6. WHEN 用户查看一键商品图页面 THEN Focus_System SHALL 显示该功能的历史生成记录

### Requirement 2: 光影融合功能

**User Story:** As a 电商用户, I want to 上传产品图并一键增强光影效果, so that I can 让产品图片的光影更加真实自然。

#### Acceptance Criteria

1. WHEN 用户访问光影融合页面 THEN Focus_System SHALL 显示产品图上传区域和产品名称输入框
2. WHEN 用户未填写产品名称 THEN Focus_System SHALL 禁用生成按钮并显示必填提示
3. WHEN 用户填写产品名称并点击生成 THEN Focus_System SHALL 使用模板 "不要改变画面中其余内容，增加{产品名称}的光影真实性" 构建 prompt
4. WHEN 生成请求发送成功 THEN Focus_System SHALL 显示加载状态并在完成后展示生成结果
5. WHEN 生成完成 THEN Focus_System SHALL 将记录保存到历史记录中
6. WHEN 用户查看光影融合页面 THEN Focus_System SHALL 显示该功能的历史生成记录

### Requirement 3: 侧边栏导航重构

**User Story:** As a 用户, I want to 通过电商处理子菜单访问相关功能, so that I can 在更清晰的导航结构中找到所需功能。

#### Acceptance Criteria

1. WHEN 用户查看侧边栏 THEN Focus_System SHALL 显示创作、电商处理、历史三个主菜单项
2. WHEN 用户 hover 电商处理菜单项 THEN Focus_System SHALL 展开显示白底图、换装、一键商品图、光影融合四个子菜单
3. WHEN 用户点击子菜单项 THEN Focus_System SHALL 导航到对应功能页面
4. WHEN 用户当前在电商处理的任一子功能页面 THEN Focus_System SHALL 高亮显示电商处理菜单项
5. WHEN 用户鼠标离开电商处理菜单区域 THEN Focus_System SHALL 收起子菜单

### Requirement 4: 路由配置

**User Story:** As a 开发者, I want to 配置新功能的路由, so that 用户可以通过 URL 访问新功能页面。

#### Acceptance Criteria

1. WHEN 用户访问 /product-scene 路径 THEN Focus_System SHALL 渲染一键商品图页面
2. WHEN 用户访问 /light-shadow 路径 THEN Focus_System SHALL 渲染光影融合页面
3. WHEN 路由配置完成 THEN Focus_System SHALL 支持页面间的正常导航

### Requirement 5: 后端类型支持

**User Story:** As a 开发者, I want to 在后端添加新的生成类型, so that 系统可以正确区分和处理不同类型的生成请求。

#### Acceptance Criteria

1. WHEN 前端发送一键商品图请求 THEN Focus_System SHALL 使用 "product_scene" 作为 type 参数
2. WHEN 前端发送光影融合请求 THEN Focus_System SHALL 使用 "light_shadow" 作为 type 参数
3. WHEN 后端接收到新类型请求 THEN Focus_System SHALL 正确处理并保存到对应的历史记录分类中

### Requirement 6: UI 一致性

**User Story:** As a 用户, I want to 在新功能页面看到与现有页面一致的 UI 风格, so that I can 获得统一的使用体验。

#### Acceptance Criteria

1. WHEN 用户使用一键商品图或光影融合功能 THEN Focus_System SHALL 使用与白底图、换装页面相同的组件和样式
2. WHEN 页面显示历史记录 THEN Focus_System SHALL 使用统一的 HistorySection 组件
3. WHEN 页面显示错误信息 THEN Focus_System SHALL 使用统一的错误处理和提示组件
