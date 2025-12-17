# GitHub Actions 自动化打包指南

本项目使用 GitHub Actions 实现跨平台自动化打包，无需本地 Mac 电脑即可构建 macOS 版本。

## 工作流说明

### 1. `build-release.yml` - 批量打包所有销售版本

**触发方式：**
- 推送 tag（如 `v1.0.2`）时自动触发
- 手动触发（Actions → Build and Release → Run workflow）

**功能：**
- 自动扫描 `frontend/public` 中的所有 `*_wxchat.jpg` 文件
- 为每个销售构建 Windows (x64+ia32) 和 Mac (x64+arm64) 版本
- 推送 tag 时自动创建 GitHub Release（草稿状态）
- 手动触发时上传到 Artifacts

**手动触发参数：**
- `sales_list`: 指定销售列表（逗号分隔），留空则打包所有
- `version`: 指定版本号，留空使用 package.json 中的版本

### 2. `build-single.yml` - 单个销售快速打包

**触发方式：**
- 仅支持手动触发

**功能：**
- 为单个销售快速构建安装包
- 可选择只构建 Windows 或 Mac 版本

**参数：**
- `sales_name`: 销售名称（必填，如 `dyf`）
- `platforms`: 目标平台（`all`/`windows`/`mac`）

## 使用方法

### 方法一：推送 Tag 自动发布

```bash
# 确保代码已提交
git add .
git commit -m "Release v1.0.2"

# 创建并推送 tag
git tag v1.0.2
git push origin v1.0.2
```

GitHub Actions 会自动：
1. 构建所有销售的 Windows 和 Mac 版本
2. 创建 GitHub Release（草稿状态）
3. 上传所有安装包到 Release

### 方法二：手动触发批量打包

1. 进入 GitHub 仓库 → Actions
2. 选择 "Build and Release"
3. 点击 "Run workflow"
4. 可选填写参数后点击 "Run workflow"
5. 等待构建完成后，在 Artifacts 中下载

### 方法三：快速打包单个销售

1. 进入 GitHub 仓库 → Actions
2. 选择 "Build Single Sales Package"
3. 点击 "Run workflow"
4. 填写销售名称和目标平台
5. 等待构建完成后下载

## 输出文件命名

- Windows: `Focus-{版本}-{销售名}.exe`
- Mac Intel: `Focus-{版本}-{销售名}-mac-x64.dmg`
- Mac Apple Silicon: `Focus-{版本}-{销售名}-mac-arm64.dmg`

## 注意事项

1. **销售微信图片**：确保 `frontend/public/{销售名}_wxchat.jpg` 文件存在
2. **Mac 图标**：确保 `assets/icon.icns` 文件存在
3. **构建时间**：完整批量打包约需 15-30 分钟
4. **Artifacts 保留**：默认保留 7 天（Release 永久保留）

## 本地测试

如果需要在本地测试打包脚本：

```bash
# Windows 批量打包
node scripts/batch-build.js

# 指定单个销售
node scripts/batch-build.js --sales=dyf
```

## 故障排除

### 构建失败
- 检查 Actions 日志中的错误信息
- 确保所有依赖文件存在
- 验证 package.json 配置正确

### Mac 签名问题
- 当前配置未启用代码签名
- 用户首次打开可能需要在"系统偏好设置 → 安全性与隐私"中允许

### 下载速度慢
- 使用 GitHub Release 下载（有 CDN 加速）
- 或使用代理/镜像
