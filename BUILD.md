# 构建和打包指南

本文档提供了完整的构建和打包流程说明，帮助开发者在不同平台上构建 SIGMA 桌面应用。

## 目录

- [构建前准备](#构建前准备)
- [Windows 构建](#windows-构建)
- [macOS 构建](#macos-构建)
- [Linux 构建](#linux-构建)
- [常见问题](#常见问题)

---

## 构建前准备

### 1. 系统要求

**所有平台通用要求：**
- Node.js 18.x 或更高版本
- npm 9.x 或更高版本
- Git

**Windows 特定要求：**
- Go 1.21 或更高版本
- Windows 10 或更高版本
- 命令提示符 (cmd) 或 PowerShell

**macOS 特定要求：**
- Go 1.21 或更高版本
- macOS 10.15 (Catalina) 或更高版本
- Xcode Command Line Tools

**Linux 特定要求：**
- Go 1.21 或更高版本
- 常见的构建工具 (gcc, make)

### 2. 安装依赖

在项目根目录执行：

```bash
npm install
```

这将安装所有必要的 Node.js 依赖，包括 Electron 和 electron-builder。

### 3. 配置应用信息

编辑根目录的 `package.json` 文件，修改以下字段：

```json
{
  "name": "your-app-name",
  "version": "1.0.0",
  "description": "Your app description",
  "build": {
    "appId": "com.yourcompany.yourapp",
    "productName": "Your App Name"
  }
}
```

### 4. 准备应用图标

参考 [assets/README.md](assets/README.md) 准备不同平台的图标文件：
- Windows: `assets/icon.ico`
- macOS: `assets/icon.icns`
- Linux: `assets/icon.png`

---

## Windows 构建

### 构建步骤

**推荐方式：使用顺序构建脚本**

项目已配置为顺序执行构建步骤，确保每一步成功后才继续下一步：

```cmd
npm run build
```

此命令会自动执行以下步骤：
1. 清理旧的构建产物（`dist/`, `release/`, `frontend/dist/`）
2. 构建前端（输出到 `frontend/dist/`）
3. 构建后端（输出到 `dist/backend/sigma-backend.exe`）
4. 验证构建产物完整性
5. 打包 Electron 应用（输出到 `release/`）

如果任何步骤失败，构建过程会立即停止并显示错误信息。

**手动分步构建（仅用于调试）：**

1. **清理旧构建产物**

   ```cmd
   npm run clean
   ```

2. **构建前端**

   ```cmd
   cd frontend
   npm install
   npm run build
   cd ..
   ```

3. **构建后端**

   ```cmd
   cd backend
   go build -ldflags="-s -w" -o ../dist/backend/sigma-backend.exe
   cd ..
   ```

   注意：`-ldflags="-s -w"` 标志会移除调试信息，减小可执行文件大小。

4. **验证构建产物**

   ```cmd
   node scripts/validate-build.js
   ```

5. **打包 Electron 应用**

   ```cmd
   npm run build:electron
   ```

### 构建产物

构建完成后，产物分布如下：

**中间构建产物：**
```
dist/backend/
  └── sigma-backend.exe        # Go 后端可执行文件（已优化）

frontend/dist/
  ├── index.html               # 前端入口文件
  ├── assets/                  # 前端资源（JS、CSS、图片等）
  └── ...
```

**最终安装包：**
```
release/
  ├── SIGMA-1.0.0-x64.exe      # NSIS 安装程序
  ├── SIGMA-1.0.0-x64.exe.blockmap
  ├── latest.yml               # 自动更新配置
  └── win-unpacked/            # 未打包版本（用于测试）
      ├── SIGMA.exe            # Electron 主程序
      └── resources/
          ├── app.asar         # 打包的应用代码（electron/ + frontend/dist/）
          └── backend/
              └── sigma-backend.exe  # 后端可执行文件
```

### 安装和测试

1. 双击 `SIGMA Setup 1.0.0.exe` 运行安装程序
2. 选择安装目录（默认为 `C:\Program Files\SIGMA`）
3. 完成安装后，从开始菜单或桌面快捷方式启动应用
4. 验证应用功能正常

### Windows 特定注意事项

- **防病毒软件**: 某些防病毒软件可能会阻止安装程序运行或隔离后端可执行文件，需要添加信任
- **管理员权限**: 安装到 Program Files 需要管理员权限，但应用本身使用 `asInvoker` 权限级别运行
- **端口占用**: 后端会自动查找可用端口（默认从 8080 开始），无需手动配置
- **路径长度**: Windows 路径长度限制为 260 字符，避免在深层目录构建
- **用户数据位置**: 应用数据存储在 `%APPDATA%\SIGMA\`（标准 Windows 位置）
- **后端位置**: 后端直接从 `resources/backend/` 运行，不会复制到其他位置

---

## macOS 构建

### 构建步骤

**推荐方式：使用顺序构建脚本**

```bash
npm run build
```

此命令会自动执行以下步骤：
1. 清理旧的构建产物
2. 构建前端
3. 构建后端（Intel 或 Apple Silicon）
4. 验证构建产物
5. 打包 Electron 应用

**手动分步构建（仅用于调试）：**

1. **清理旧构建产物**

   ```bash
   npm run clean
   ```

2. **构建前端**

   ```bash
   cd frontend
   npm install
   npm run build
   cd ..
   ```

3. **构建后端**

   Intel Mac (x64):
   ```bash
   cd backend
   GOOS=darwin GOARCH=amd64 go build -ldflags="-s -w" -o ../dist/backend/sigma-backend
   cd ..
   ```

   Apple Silicon (M1/M2/M3):
   ```bash
   cd backend
   GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w" -o ../dist/backend/sigma-backend
   cd ..
   ```

4. **验证构建产物**

   ```bash
   node scripts/validate-build.js
   ```

5. **打包 Electron 应用**

   ```bash
   npm run build:electron
   ```

### 构建产物

构建完成后，安装包位于 `release` 目录：

```
release/
  └── SIGMA-1.0.0.dmg    # macOS 磁盘镜像
```

### 安装和测试

1. 双击 `SIGMA-1.0.0.dmg` 打开磁盘镜像
2. 将 SIGMA 应用拖拽到 Applications 文件夹
3. 从 Launchpad 或 Applications 文件夹启动应用
4. 首次运行时，可能需要在"系统偏好设置 > 安全性与隐私"中允许运行

### macOS 特定注意事项

- **代码签名**: 未签名的应用在 macOS 10.15+ 上会显示安全警告
  - 开发测试：右键点击应用，选择"打开"可绕过警告
  - 正式发布：需要 Apple Developer 账号进行代码签名和公证
- **Gatekeeper**: 首次运行可能被 Gatekeeper 阻止
- **权限**: 应用可能需要请求文件访问、网络等权限
- **架构**: 确保构建的架构与目标 Mac 匹配（Intel 或 Apple Silicon）

### 代码签名（可选）

如果有 Apple Developer 账号，可以进行代码签名：

```bash
export CSC_LINK=/path/to/certificate.p12
export CSC_KEY_PASSWORD=your_password
npm run build:electron
```

---

## Linux 构建

### 构建步骤

**推荐方式：使用顺序构建脚本**

```bash
npm run build
```

此命令会自动执行以下步骤：
1. 清理旧的构建产物
2. 构建前端
3. 构建后端
4. 验证构建产物
5. 打包 Electron 应用

**手动分步构建（仅用于调试）：**

1. **清理旧构建产物**

   ```bash
   npm run clean
   ```

2. **构建前端**

   ```bash
   cd frontend
   npm install
   npm run build
   cd ..
   ```

3. **构建后端**

   ```bash
   cd backend
   GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o ../dist/backend/sigma-backend
   cd ..
   ```

4. **验证构建产物**

   ```bash
   node scripts/validate-build.js
   ```

5. **打包 Electron 应用**

   ```bash
   npm run build:electron
   ```

### 构建产物

构建完成后，安装包位于 `release` 目录：

```
release/
  └── SIGMA-1.0.0.AppImage    # Linux AppImage
```

### 安装和测试

1. 给 AppImage 添加执行权限：

   ```bash
   chmod +x release/SIGMA-1.0.0.AppImage
   ```

2. 运行应用：

   ```bash
   ./release/SIGMA-1.0.0.AppImage
   ```

3. （可选）集成到系统：

   AppImage 可以直接运行，无需安装。如需集成到应用菜单，可以使用 AppImageLauncher。

### Linux 特定注意事项

- **依赖项**: AppImage 包含大部分依赖，但某些系统库可能需要单独安装
- **FUSE**: 某些 Linux 发行版需要安装 FUSE 才能运行 AppImage
  ```bash
  # Ubuntu/Debian
  sudo apt install fuse libfuse2
  
  # Fedora
  sudo dnf install fuse fuse-libs
  ```
- **沙箱**: 某些发行版的沙箱机制可能影响应用运行
- **权限**: 确保 AppImage 有执行权限

---

## 常见问题

### 1. 构建失败：找不到 Go 命令

**问题**: 执行构建时提示 `'go' is not recognized as an internal or external command`

**解决方案**:
- 确保已安装 Go 并添加到系统 PATH
- Windows: 重启命令提示符或重新登录
- 验证安装: `go version`

### 2. 构建失败：npm install 错误

**问题**: `npm install` 失败或依赖安装不完整

**解决方案**:
```bash
# 清理缓存
npm cache clean --force

# 删除 node_modules 和 lock 文件
rm -rf node_modules package-lock.json

# 重新安装
npm install
```

### 3. 前端构建失败：内存不足

**问题**: Vite 构建时提示内存不足

**解决方案**:
```bash
# 增加 Node.js 内存限制
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

### 4. 后端构建失败：依赖下载超时

**问题**: Go 模块下载超时或失败

**解决方案**:
```bash
# 使用国内镜像（中国大陆）
go env -w GOPROXY=https://goproxy.cn,direct

# 或使用官方代理
go env -w GOPROXY=https://proxy.golang.org,direct

# 清理模块缓存
go clean -modcache
```

### 5. Electron 打包失败：electron-builder 错误

**问题**: electron-builder 打包时失败

**解决方案**:
```bash
# 使用清理脚本清理所有构建产物
npm run clean

# 重新安装依赖
npm install

# 使用详细日志重新构建
DEBUG=electron-builder npm run build

# 如果仍然失败，检查构建验证
node scripts/validate-build.js
```

### 6. Windows: 后端进程未正确终止

**问题**: 关闭应用后，后端进程仍在运行

**解决方案**:
- 检查任务管理器，手动结束 `sigma-backend.exe` 进程
- 确保 `electron/main.js` 中的清理逻辑正确实现
- 使用 `taskkill /F /IM sigma-backend.exe` 强制终止

### 7. macOS: 应用无法打开（已损坏）

**问题**: 提示"应用已损坏，无法打开"

**解决方案**:
```bash
# 移除隔离属性
xattr -cr /Applications/SIGMA.app

# 或在终端中直接运行
open /Applications/SIGMA.app
```

### 8. Linux: AppImage 无法运行

**问题**: 双击 AppImage 无反应

**解决方案**:
```bash
# 确保有执行权限
chmod +x SIGMA-1.0.0.AppImage

# 从终端运行查看错误信息
./SIGMA-1.0.0.AppImage

# 如果提示 FUSE 错误，安装 FUSE
sudo apt install fuse libfuse2
```

### 9. 端口冲突

**问题**: 后端启动失败，提示端口已被占用

**解决方案**:
```bash
# Windows: 查找占用端口的进程
netstat -ano | findstr :8080
taskkill /PID <进程ID> /F

# macOS/Linux: 查找并终止进程
lsof -ti:8080 | xargs kill -9
```

### 10. TLS 证书错误

**问题**: 前端无法连接后端，提示证书错误

**解决方案**:
- 删除旧的证书文件，让应用重新生成
- Windows: `%APPDATA%\SIGMA\certs`
- macOS: `~/Library/Application Support/SIGMA/certs`
- Linux: `~/.config/SIGMA/certs`

### 11. 构建产物过大

**问题**: 安装包体积过大

**解决方案**:
- 检查是否包含了不必要的文件（如 node_modules、源代码）
- 优化前端构建：启用代码分割和压缩
- 后端构建已自动使用 `-ldflags="-s -w"` 优化（在构建脚本中配置）
- 检查 `package.json` 中的 `files` 配置，确保排除测试文件和开发文件
- electron-builder 配置已优化，自动排除不必要的 node_modules 文件

### 12. 跨平台构建

**问题**: 在 Windows 上构建 macOS/Linux 版本

**解决方案**:
- electron-builder 支持跨平台构建，但有限制
- macOS DMG 只能在 macOS 上构建（需要 macOS 特定工具）
- Windows 和 Linux 可以在任何平台上构建
- 建议使用 CI/CD（如 GitHub Actions）在对应平台上构建

---

## 构建验证

### 自动验证

构建过程会自动验证以下内容：

1. **前端构建产物**
   - `frontend/dist/index.html` 存在
   - 前端资源文件完整

2. **后端可执行文件**
   - `dist/backend/sigma-backend.exe`（Windows）或 `dist/backend/sigma-backend`（macOS/Linux）存在
   - 文件大小合理（> 1MB）

3. **资源文件**
   - 图标文件存在（如果配置）

如果验证失败，构建会停止并显示缺失的文件列表。

### 手动验证

可以单独运行验证脚本：

```bash
node scripts/validate-build.js
```

### 验证打包产物

构建完成后，验证最终安装包：

**Windows:**
```cmd
# 检查 release 目录
dir release

# 验证 win-unpacked 结构
dir release\win-unpacked\resources
dir release\win-unpacked\resources\backend
```

**macOS/Linux:**
```bash
# 检查 release 目录
ls -la release

# 验证 unpacked 结构（如果存在）
ls -la release/*/resources/
ls -la release/*/resources/backend/
```

---

## 路径结构说明

### 开发环境路径

```
project-root/
├── backend/                    # Go 后端源代码
├── frontend/                   # React 前端源代码
├── electron/                   # Electron 主进程代码
├── dist/
│   └── backend/
│       └── sigma-backend.exe   # 编译后的后端（开发时从这里运行）
└── frontend/dist/              # 编译后的前端（开发时 Vite 提供）
```

### 生产环境路径

**安装目录结构：**
```
C:\Program Files\SIGMA\          # 或用户选择的安装目录
├── SIGMA.exe                    # Electron 主程序
├── resources/
│   ├── app.asar                 # 打包的应用代码
│   │                            # 包含: electron/ 和 frontend/dist/
│   └── backend/
│       └── sigma-backend.exe    # 后端可执行文件（直接从这里运行）
└── ...（其他 Electron 文件）
```

**用户数据目录：**
```
Windows: C:\Users\<用户名>\AppData\Roaming\SIGMA\
macOS:   ~/Library/Application Support/SIGMA/
Linux:   ~/.config/SIGMA/

目录结构：
├── output/                      # 生成的图片
├── uploads/                     # 上传的文件
├── db/                         # 数据库文件
│   └── history.db
├── temp/                       # 临时文件
├── certs/                      # TLS 证书
│   ├── cert.pem
│   └── key.pem
└── logs/                       # 日志文件
    ├── app.log
    └── backend.log
```

### 关键路径说明

1. **后端可执行文件**
   - 开发环境：`<项目根>/dist/backend/sigma-backend.exe`
   - 生产环境：`<安装目录>/resources/backend/sigma-backend.exe`
   - **不再复制**到用户数据目录，直接从 resources 运行

2. **用户数据**
   - 使用 `app.getPath('userData')` 获取标准位置
   - 符合各操作系统规范
   - 卸载应用时可选择是否删除

3. **前端资源**
   - 开发环境：Vite 开发服务器（http://localhost:5174）
   - 生产环境：从 `app.asar` 加载

---

## 构建脚本参考

### package.json 脚本说明

```json
{
  "scripts": {
    "dev": "开发模式运行 Electron",
    "build": "顺序构建所有组件（推荐）",
    "build:sequential": "顺序执行：前端 → 后端 → 验证 → 打包",
    "build:frontend": "仅构建前端",
    "build:backend:win": "构建 Windows 后端（带优化）",
    "build:backend:mac": "构建 macOS 后端（带优化）",
    "build:backend:linux": "构建 Linux 后端（带优化）",
    "build:electron": "打包 Electron 应用",
    "clean": "清理所有构建产物",
    "prebuild": "构建前自动清理"
  }
}
```

**脚本特点：**
- 使用 `&&` 确保顺序执行，任何步骤失败都会停止
- 后端构建自动使用 `-ldflags="-s -w"` 优化
- 构建前自动清理旧产物
- 打包前自动验证构建产物

### 自定义构建配置

如需自定义构建配置，编辑 `package.json` 中的 `build` 字段：

```json
{
  "build": {
    "appId": "com.yourcompany.sigma",
    "productName": "SIGMA",
    "directories": {
      "output": "release",
      "buildResources": "assets"
    },
    "files": [
      "electron/**/*",
      "frontend/dist/**/*",
      "dist/backend/**/*"
    ],
    "win": {
      "target": "nsis",
      "icon": "assets/icon.ico"
    },
    "mac": {
      "target": "dmg",
      "icon": "assets/icon.icns",
      "category": "public.app-category.productivity"
    },
    "linux": {
      "target": "AppImage",
      "icon": "assets/icon.png",
      "category": "Utility"
    }
  }
}
```

---

## 发布检查清单

在发布应用前，请确保：

- [ ] 已更新版本号（package.json）
- [ ] 已准备所有平台的图标文件
- [ ] 已在目标平台上测试安装和运行
- [ ] 已验证所有核心功能正常工作
- [ ] 已检查日志，无严重错误或警告
- [ ] 已准备发布说明和更新日志
- [ ] （macOS）已完成代码签名和公证（如需分发）
- [ ] 已测试安装和卸载流程
- [ ] 已验证应用在不同系统版本上的兼容性

---

## 获取帮助

如遇到本文档未涵盖的问题：

1. 查看 [electron-builder 文档](https://www.electron.build/)
2. 查看 [Electron 官方文档](https://www.electronjs.org/docs)
3. 检查项目的 GitHub Issues
4. 联系开发团队

---

---

## 更新日志

### 2024-12-07
- 更新为顺序构建流程，确保构建可靠性
- 添加自动构建验证
- 更新路径结构说明（后端直接从 resources 运行）
- 添加用户数据目录标准位置说明
- 优化后端构建（自动使用 -ldflags="-s -w"）

### 2024-12-06
- 初始版本

**最后更新**: 2024-12-07
