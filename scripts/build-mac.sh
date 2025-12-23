#!/bin/bash
# Mac 本地打包脚本
# 用法: ./scripts/build-mac.sh [x64|arm64|both]

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Focus Mac 打包脚本${NC}"
echo -e "${GREEN}========================================${NC}"

# 检测当前 Mac 架构
CURRENT_ARCH=$(uname -m)
if [ "$CURRENT_ARCH" = "arm64" ]; then
    DEFAULT_ARCH="arm64"
    echo -e "${YELLOW}检测到 Apple Silicon Mac (M1/M2/M3)${NC}"
else
    DEFAULT_ARCH="x64"
    echo -e "${YELLOW}检测到 Intel Mac${NC}"
fi

# 获取目标架构参数
TARGET_ARCH=${1:-$DEFAULT_ARCH}

echo -e "${YELLOW}目标架构: $TARGET_ARCH${NC}"
echo ""

# 步骤 1: 清理
echo -e "${GREEN}[1/5] 清理旧文件...${NC}"
rm -rf dist release* frontend/dist
mkdir -p dist/backend

# 步骤 2: 构建前端
echo -e "${GREEN}[2/5] 构建前端...${NC}"
cd frontend
npm run build
cd ..

# 步骤 3: 构建后端
echo -e "${GREEN}[3/5] 构建后端...${NC}"
cd backend

if [ "$TARGET_ARCH" = "both" ]; then
    echo "  构建 x64 版本..."
    GOOS=darwin GOARCH=amd64 go build -trimpath -ldflags="-s -w -buildid=" -o ../dist/backend/sigma-backend-x64 .
    echo "  构建 arm64 版本..."
    GOOS=darwin GOARCH=arm64 go build -trimpath -ldflags="-s -w -buildid=" -o ../dist/backend/sigma-backend-arm64 .
    # 默认使用当前架构
    cp ../dist/backend/sigma-backend-$DEFAULT_ARCH ../dist/backend/sigma-backend
elif [ "$TARGET_ARCH" = "arm64" ]; then
    GOOS=darwin GOARCH=arm64 go build -trimpath -ldflags="-s -w -buildid=" -o ../dist/backend/sigma-backend .
else
    GOOS=darwin GOARCH=amd64 go build -trimpath -ldflags="-s -w -buildid=" -o ../dist/backend/sigma-backend .
fi

cd ..

# 设置可执行权限
chmod +x dist/backend/sigma-backend*

# 步骤 4: 验证构建
echo -e "${GREEN}[4/5] 验证构建文件...${NC}"
if [ ! -d "frontend/dist" ]; then
    echo -e "${RED}错误: frontend/dist 不存在${NC}"
    exit 1
fi
if [ ! -f "dist/backend/sigma-backend" ]; then
    echo -e "${RED}错误: dist/backend/sigma-backend 不存在${NC}"
    exit 1
fi
echo "  ✓ 前端构建完成"
echo "  ✓ 后端构建完成"

# 步骤 5: 打包 Electron
echo -e "${GREEN}[5/5] 打包 Electron 应用...${NC}"

if [ "$TARGET_ARCH" = "both" ]; then
    # 打包 x64
    echo "  打包 x64 版本..."
    cp dist/backend/sigma-backend-x64 dist/backend/sigma-backend
    npx electron-builder --mac --x64 --config.directories.output="release-mac-x64"
    
    # 打包 arm64
    echo "  打包 arm64 版本..."
    cp dist/backend/sigma-backend-arm64 dist/backend/sigma-backend
    npx electron-builder --mac --arm64 --config.directories.output="release-mac-arm64"
elif [ "$TARGET_ARCH" = "arm64" ]; then
    npx electron-builder --mac --arm64
else
    npx electron-builder --mac --x64
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  打包完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "输出目录:"
if [ "$TARGET_ARCH" = "both" ]; then
    echo "  - release-mac-x64/ (Intel Mac)"
    echo "  - release-mac-arm64/ (Apple Silicon)"
else
    echo "  - release-dev-test/"
fi
echo ""
ls -la release*/
