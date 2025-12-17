# Requirements Document

## Introduction

本功能为 Focus 应用提供批量打包能力，允许开发者一次性为多个销售人员生成独立的安装包。每个安装包包含对应销售的微信二维码图片，用户扫码后可联系对应的销售顾问。

## Glossary

- **Batch_Packaging_System**: 批量打包系统，负责扫描销售二维码图片并为每个销售生成独立安装包
- **Sales_QR_Image**: 销售二维码图片，以 `{销售名}_wxchat.jpg` 格式命名的图片文件
- **Standard_QR_Name**: 标准二维码文件名，即 `sales_wxchat.jpg`，应用代码中引用的固定文件名
- **Release_Directory**: 发布目录，存放生成的安装包，以销售名命名（如 `release-dyf/`）

## Requirements

### Requirement 1

**User Story:** As a developer, I want to automatically package the application for all sales representatives, so that I can distribute customized versions without manual intervention.

#### Acceptance Criteria

1. WHEN the batch packaging script is executed THEN the Batch_Packaging_System SHALL scan the `frontend/dist` directory for all files matching the pattern `*_wxchat.jpg`
2. WHEN Sales_QR_Images are found THEN the Batch_Packaging_System SHALL extract the sales name from each filename (the part before `_wxchat.jpg`)
3. WHEN processing each sales representative THEN the Batch_Packaging_System SHALL copy the Sales_QR_Image to Standard_QR_Name (`sales_wxchat.jpg`) in the `frontend/dist` directory

### Requirement 2

**User Story:** As a developer, I want each sales package to be output to a separate directory, so that I can easily identify and distribute the correct version.

#### Acceptance Criteria

1. WHEN packaging for a sales representative THEN the Batch_Packaging_System SHALL configure the output directory as `release-{sales_name}/`
2. WHEN the packaging process completes THEN the Batch_Packaging_System SHALL generate an installer file named with the sales identifier
3. WHEN all sales packages are built THEN the Batch_Packaging_System SHALL restore the original `sales_wxchat.jpg` file if one existed

### Requirement 3

**User Story:** As a developer, I want to see progress and status during batch packaging, so that I can monitor the build process.

#### Acceptance Criteria

1. WHEN the batch packaging starts THEN the Batch_Packaging_System SHALL display the total number of sales representatives to be processed
2. WHEN processing each sales representative THEN the Batch_Packaging_System SHALL display the current progress (e.g., "Building 2/6: lyq")
3. WHEN a packaging error occurs THEN the Batch_Packaging_System SHALL log the error and continue with the next sales representative
4. WHEN all packaging completes THEN the Batch_Packaging_System SHALL display a summary of successful and failed builds

### Requirement 4

**User Story:** As a developer, I want to optionally build for a single sales representative, so that I can quickly test or rebuild a specific version.

#### Acceptance Criteria

1. WHEN a sales name parameter is provided THEN the Batch_Packaging_System SHALL only build the package for that specific sales representative
2. WHEN the specified sales name does not have a corresponding QR image THEN the Batch_Packaging_System SHALL display an error message listing available sales names
