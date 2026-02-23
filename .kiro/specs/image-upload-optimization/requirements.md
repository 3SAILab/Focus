# Requirements Document

## Introduction

本功能旨在优化图片上传体验，解决用户因网络慢或图片过大导致上传失败的问题。主要包括前端图片压缩、错误提示优化、失败后重新编辑功能，以及测试模拟开关。

## Glossary

- **Image_Compressor**: 图片压缩模块，使用 Canvas API 对图片进行质量压缩
- **Error_Handler**: 错误处理模块，负责解析和展示用户友好的错误信息
- **Image_Upload**: 图片上传组件，负责图片选择、预览和上传
- **Test_Simulator**: 测试模拟模块，用于模拟各种错误场景
- **Reference_Image**: 参考图，用户上传的用于 AI 生成参考的图片
- **Compressed_Image**: 压缩后的图片文件

## Requirements

### Requirement 1: 图片压缩功能

**User Story:** As a user, I want my images to be automatically compressed before upload, so that I can upload images faster and avoid upload failures due to large file sizes.

#### Acceptance Criteria

1. THE Image_Upload SHALL limit the maximum number of reference images to 5
2. WHEN a user selects images for upload, THE Image_Compressor SHALL compress JPEG images using Canvas API with quality 0.92
3. WHEN a user selects PNG images, THE Image_Compressor SHALL preserve the original PNG format without quality compression
4. WHEN the compressed image is larger than the original, THE Image_Compressor SHALL return the original file instead
5. WHEN the total size of all compressed images exceeds 25MB, THE System SHALL display an error message and prevent upload
6. WHEN the total size exceeds 25MB, THE Error_Handler SHALL display the message "图片总大小过大，请减少图片数量或选择较小的图片"

### Requirement 2: 错误提示优化

**User Story:** As a user, I want to see clear and friendly error messages in Chinese, so that I can understand what went wrong and how to fix it.

#### Acceptance Criteria

1. WHEN a network timeout or upload failure occurs, THE Error_Handler SHALL display "网络出了点小差，请稍后重试"
2. WHEN the image count exceeds the limit, THE Error_Handler SHALL display "最多支持上传 5 张参考图"
3. WHEN compressed images still exceed 25MB, THE Error_Handler SHALL display "图片总大小过大，请减少图片数量或选择较小的图片"
4. WHEN AI fails to return images, THE Error_Handler SHALL display "未能生成图片，请尝试修改提示词后重试"
5. WHEN the user has insufficient balance, THE Error_Handler SHALL display "余额不足请联系销售充值"

### Requirement 3: 失败后重新编辑功能

**User Story:** As a user, I want to be able to edit my prompt and reference images after a generation failure, so that I can try again with modified inputs without starting over.

#### Acceptance Criteria

1. WHEN image generation fails, THE System SHALL display both a "重试" button and a "重新编辑" button
2. WHEN the user clicks the "重新编辑" button, THE System SHALL allow the user to modify the prompt and reference images
3. WHEN AI fails to return images, THE System SHALL prominently suggest the user to modify the prompt
4. WHEN the user clicks "重试", THE System SHALL retry with the same parameters
5. WHEN the user clicks "重新编辑", THE System SHALL restore the original input state for editing

### Requirement 4: 测试模拟功能

**User Story:** As a developer, I want to simulate various error scenarios, so that I can test error handling without relying on actual network failures.

#### Acceptance Criteria

1. THE Test_Simulator SHALL provide a configuration switch to enable/disable simulation mode
2. WHEN simulation mode is enabled, THE Test_Simulator SHALL allow simulating network timeout errors
3. WHEN simulation mode is enabled, THE Test_Simulator SHALL allow simulating image count exceeded errors
4. WHEN simulation mode is enabled, THE Test_Simulator SHALL allow simulating AI no image returned errors
5. WHEN simulation mode is enabled, THE Test_Simulator SHALL allow simulating insufficient balance errors
6. THE Test_Simulator SHALL be disabled by default in production builds
