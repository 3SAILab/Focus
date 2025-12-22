# Requirements Document

## Introduction

本功能为 Focus 应用添加强制版本更新检查和余额监控功能。应用启动时必须联网检查版本，如果版本不一致则强制用户下载更新才能使用软件。同时，在每次生成图片时检查用户余额，当余额低于阈值时在界面右下角显示红色警告提示。

## Glossary

- **Version_Checker**: 版本检查模块，负责从 OSS 下载版本信息并与本地版本比对
- **Balance_Checker**: 余额检查模块，负责调用 API 查询用户账户余额
- **Local_Version_Code**: 本地版本码，格式为时间戳 (如 202512201755)
- **Remote_Version_Info**: 远程版本信息 JSON 文件，存放在阿里云 OSS
- **Balance_Warning_Threshold**: 余额警告阈值，设定为 2

## Requirements

### Requirement 1: 网络连接检查

**User Story:** As a 用户, I want 软件启动时检查网络连接, so that 确保软件能正常访问在线服务。

#### Acceptance Criteria

1. WHEN 应用启动 THEN Version_Checker SHALL 首先检测网络连接状态
2. IF 网络连接失败 THEN Version_Checker SHALL 显示"网络连接失败，请检查网络后重试"提示并阻止软件使用
3. WHEN 网络检测失败 THEN Version_Checker SHALL 提供"重试"按钮让用户重新检测

### Requirement 2: 版本信息获取

**User Story:** As a 用户, I want 软件自动获取最新版本信息, so that 我能知道是否需要更新。

#### Acceptance Criteria

1. WHEN 网络连接正常 THEN Version_Checker SHALL 从 OSS 下载 version.json 文件
2. WHEN version.json 下载成功 THEN Version_Checker SHALL 解析版本码和更新内容
3. IF version.json 下载失败 THEN Version_Checker SHALL 显示"获取版本信息失败"提示并阻止软件使用

### Requirement 3: 版本比对与强制更新

**User Story:** As a 用户, I want 软件检测到新版本时提示我更新, so that 我能使用最新功能。

#### Acceptance Criteria

1. WHEN 远程 versionCode 或 versionName 与本地不一致 THEN Version_Checker SHALL 显示更新弹窗
2. WHEN 显示更新弹窗 THEN Version_Checker SHALL 展示更新内容说明
3. WHEN 用户点击"下载更新" THEN Version_Checker SHALL 根据操作系统打开对应下载链接
4. IF 用户关闭更新弹窗而未下载 THEN Version_Checker SHALL 阻止用户进入软件主界面
5. WHEN versionCode 和 versionName 都一致 THEN Version_Checker SHALL 允许用户正常使用软件

### Requirement 4: 余额查询

**User Story:** As a 用户, I want 软件在生成图片时检查我的余额, so that 我能及时知道余额状态。

#### Acceptance Criteria

1. WHEN 用户触发图片生成 THEN Balance_Checker SHALL 调用 API 查询账户余额
2. WHEN 查询余额 THEN Balance_Checker SHALL 计算总额度减去已使用额度得到剩余余额
3. IF 余额查询失败 THEN Balance_Checker SHALL 静默处理不影响生成流程

### Requirement 5: 余额不足警告

**User Story:** As a 用户, I want 余额不足时看到明显提示, so that 我能及时充值。

#### Acceptance Criteria

1. WHEN 剩余余额小于 Balance_Warning_Threshold (2) THEN Balance_Checker SHALL 在界面右下角显示红色警告文字
2. WHEN 显示余额警告 THEN Balance_Checker SHALL 显示"余额即将不足，请联系销售充值"
3. WHILE 余额低于阈值 THEN Balance_Checker SHALL 持续显示警告直到余额恢复
4. WHEN 余额恢复到阈值以上 THEN Balance_Checker SHALL 隐藏警告提示

## Configuration

### 本地预设值

- **Local_Version_Code**: `202512201755`
- **Local_Version_Name**: `1.0.2`
- **Balance_Warning_Threshold**: `2`
- **API_Domain**: `https://api.vectorengine.ai`

### OSS 配置

- **Version_JSON_URL**: `https://sigma-focus.oss-cn-hangzhou.aliyuncs.com/version.json`

### version.json 格式

```json
{
  "versionCode": "202512201755",
  "versionName": "1.0.2",
  "updateContent": "1. 修复了xxx问题\n2. 新增了xxx功能",
  "windowsUrl": "https://sigma-focus.oss-cn-hangzhou.aliyuncs.com/Focus-1.0.2-wkf.zip",
  "macX64Url": "",
  "macArm64Url": ""
}
```

### 下载链接选择逻辑

- Windows 系统 → `windowsUrl`
- Mac Intel 芯片 (x64) → `macX64Url`
- Mac M 芯片 (arm64) → `macArm64Url`
