# Implementation Plan

- [x] 1. 增强 GenerationCounter 组件实现点击跳转






  - [x] 1.1 添加 useNavigate hook 和点击事件处理

    - 导入 `useNavigate` from `react-router-dom`
    - 添加 `onClick` 处理函数，调用 `navigate('/history')`
    - 添加 `cursor-pointer` 和 `hover:bg-gray-100` 样式
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 增强 Lightbox 组件支持右键菜单





  - [x] 2.1 添加右键菜单状态和事件处理

    - 添加 `contextMenuPosition` 状态
    - 添加 `onContextMenu` 事件处理，阻止默认菜单并设置位置
    - 集成 `ImageContextMenu` 组件
    - 添加点击背景关闭菜单的逻辑
    - _Requirements: 2.1, 2.5, 2.6_

- [x] 3. 统一图片保存成功的 Toast 消息






  - [x] 3.1 更新 ImageContextMenu 组件的 Toast 消息

    - 将"图片下载成功"改为"图片保存成功"
    - _Requirements: 3.1, 3.2_

  - [x] 3.2 更新 ImageCard 组件的 Toast 消息
    - 将"图片下载成功"改为"图片保存成功"
    - _Requirements: 3.1, 3.3_

- [x] 4. 构建和打包






  - [x] 4.1 构建前端

    - 运行 `npm run build:frontend` 构建前端资源

  - [x] 4.2 构建后端

    - 运行 `npm run build:backend` 构建后端可执行文件

  - [x] 4.3 打包 Electron 应用

    - 运行 `npm run package` 打包完整应用
