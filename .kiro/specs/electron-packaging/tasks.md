# Implementation Plan

- [x] 1. 设置项目结构和依赖





  - 在根目录创建 package.json 配置 Electron 和 electron-builder
  - 安装必要的依赖（electron, electron-builder, cross-env）
  - 创建 assets 目录用于存放图标文件
  - 配置 .gitignore 忽略构建产物
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 实现 TLS 证书管理器






  - [x] 2.1 创建 TLS 证书生成模块

    - 在 electron 目录创建 tls-manager.js
    - 实现自签名证书生成功能（使用 Node.js crypto 模块）
    - 实现证书保存到用户数据目录
    - 实现证书加载和验证功能
    - _Requirements: 8.3_


  - [x] 2.2 编写 TLS 管理器单元测试


    - 测试证书生成功能
    - 测试证书保存和加载
    - 测试证书有效性验证
    - _Requirements: 8.3_

- [x] 3. 更新 Electron 主进程







  - [x] 3.1 重构 main.js 添加 TLS 支持





    - 集成 TLS 证书管理器
    - 在后端启动前生成/加载 TLS 证书
    - 将证书路径通过环境变量传递给后端
    - 更新后端 URL 为 HTTPS
    - 改进错误处理和日志记录


    - _Requirements: 3.1, 3.2, 8.3_

  - [x] 3.2 实现健康检查机制




    - 使用 HTTPS 进行健康检查


    - 配置信任自签名证书
    - 实现重试逻辑
    - _Requirements: 3.2_



  - [x] 3.3 改进进程清理逻辑





    - 确保 Windows 上正确终止后端进程
    - 清理临时文件和证书
    - 处理异常退出情况
    - _Requirements: 3.3_


  - [x] 3.4 编写主进程单元测试




    - 测试后端进程启动和终止
    - 测试健康检查逻辑
    - 测试 IPC 处理器
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 4. 更新 Preload 脚本




  - [x] 4.1 增强 preload.js 的 API


    - 添加后端就绪事件监听
    - 添加后端错误事件监听
    - 确保 contextBridge 正确隔离
    - _Requirements: 4.1, 4.2, 4.3_



  - [x] 4.2 创建 TypeScript 类型定义







    - 在 frontend/src/types 创建 electron.d.ts
    - 定义 ElectronAPI 接口
    - _Requirements: 4.1_

- [x] 5. 实现后端 HTTPS 支持




  - [x] 5.1 创建 TLS 配置模块


    - 在 backend/server 目录创建 tls.go
    - 实现 TLS 证书加载功能
    - 实现 HTTPS 服务器启动函数
    - _Requirements: 8.1, 8.2, 8.3_




  - [x] 5.2 更新 backend/main.go




    - 从环境变量读取 TLS 证书路径
    - 使用 HTTPS 启动服务器而不是 HTTP
    - 更新 CORS 配置支持 HTTPS


    - _Requirements: 8.1, 8.2_

  - [x] 5.3 更新 backend/config/config.go


    - 添加 TLS 相关配置项
    - 添加证书路径配置
    - _Requirements: 8.3_

  - [x] 5.4 编写后端 TLS 单元测试





    - 测试证书加载功能
    - 测试 HTTPS 服务器启动
    - 测试加密通信
    - _Requirements: 8.1, 8.2, 8.3_


- [x] 6. 更新前端 API 客户端




  - [x] 6.1 修改 frontend/src/api/index.ts


    - 将 HTTP URL 改为 HTTPS
    - 更新 getApiBaseUrl 函数返回 HTTPS URL
    - 确保在 Electron 环境中正确获取后端 URL
    - _Requirements: 8.1, 8.2_

  - [x] 6.2 编写前端 API 客户端测试


    - 测试 HTTPS URL 生成
    - 测试 Electron API 集成
    - 模拟 HTTPS 请求
    - _Requirements: 8.1, 8.2_


- [x] 7. 配置构建系统



  - [x] 7.1 更新根目录 package.json


    - 配置 Windows cmd 兼容的构建脚本（使用 & 而不是 &&）
    - 添加前端构建脚本
    - 添加后端构建脚本（Windows/macOS/Linux）
    - 添加 Electron 打包脚本
    - 配置 electron-builder
    - _Requirements: 2.1, 2.2, 2.3, 5.1, 5.2, 5.3_

  - [x] 7.2 配置 electron-builder


    - 设置应用 ID、名称、版本
    - 配置文件包含规则
    - 配置 extraResources（后端可执行文件）
    - 配置 Windows NSIS 安装程序
    - 配置 macOS DMG
    - 配置 Linux AppImage
    - _Requirements: 1.1, 1.2, 5.1, 5.2, 5.3, 5.4, 5.5, 9.1, 9.2_

  - [x] 7.3 创建图标占位符


    - 在 assets 目录创建图标文件占位符
    - 添加 README 说明如何替换图标
    - _Requirements: 1.2, 1.5_

- [x] 8. 实现路径管理




  - [x] 8.1 更新 Electron 主进程路径处理


    - 使用 app.getPath('userData') 获取用户数据目录
    - 为数据库、上传、输出创建子目录
    - 通过环境变量传递路径给后端
    - _Requirements: 6.1, 6.2, 6.6_

  - [x] 8.2 验证后端路径配置


    - 确认后端正确使用环境变量中的路径
    - 测试路径在打包后的应用中正确解析
    - _Requirements: 6.1, 6.2_

- [x] 9. 实现开发模式支持




  - [x] 9.1 配置开发环境


    - 添加 NODE_ENV 环境变量检测
    - 在开发模式下连接 Vite 开发服务器
    - 在开发模式下启用 DevTools
    - _Requirements: 7.1, 7.2_

  - [x] 9.2 配置生产环境


    - 在生产模式下加载打包后的前端文件
    - 禁用 DevTools
    - _Requirements: 7.5_


- [x] 10. Checkpoint - 确保所有测试通过




  - 运行所有单元测试
  - 运行集成测试
  - 修复任何失败的测试
  - 确保代码质量

- [x] 11. 创建构建和打包文档





  - [x] 11.1 创建 BUILD.md 文档


    - 记录构建前的准备工作
    - 记录 Windows 构建步骤
    - 记录 macOS 构建步骤
    - 记录 Linux 构建步骤
    - 记录常见问题和解决方案
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_


  - [x] 11.2 创建图标替换指南

    - 说明如何准备不同平台的图标
    - 说明图标文件的命名和位置
    - 提供图标转换工具推荐
    - _Requirements: 1.2, 1.5_



  - [ ] 11.3 更新 README.md
    - 添加 Electron 打包说明
    - 添加开发模式运行说明
    - 添加构建命令说明
    - _Requirements: 7.1, 7.3, 7.4_


- [x] 12. 端到端测试




  - [x] 12.1 编写 E2E 测试脚本


    - 测试应用启动流程
    - 测试前后端通信
    - 测试 HTTPS 加密
    - 测试应用关闭和清理
    - _Requirements: 3.1, 3.2, 3.3, 8.1, 8.2_

  - [x] 12.2 测试构建产物


    - 测试 Windows 安装程序
    - 测试 macOS DMG
    - 测试 Linux AppImage
    - 验证所有文件正确打包
    - _Requirements: 5.1, 5.2, 5.3, 6.3_


- [x] 13. Final Checkpoint - 最终验证





  - 在 Windows 上测试完整构建流程
  - 验证所有功能正常工作
  - 检查日志和错误处理
  - 确认安装和卸载正常
  - 准备发布
