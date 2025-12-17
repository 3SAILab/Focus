# Requirements Document

## Introduction

本功能规格定义了两个用户体验增强功能：
1. 生成计数器点击跳转 - 用户点击右上角显示"已生成 X 张"的计数器时，可以直接跳转到历史记录页面
2. 灯箱右键菜单 - 用户在图片放大查看（Lightbox）时，可以通过右键菜单复制或保存图片，保存成功后显示 Toast 提醒

## Glossary

- **GenerationCounter**: 生成计数器组件，显示在页面右上角，展示用户已生成的图片总数
- **Lightbox**: 灯箱组件，用于全屏放大查看图片
- **ImageContextMenu**: 图片右键菜单组件，提供复制、下载等操作
- **Toast**: 轻量级消息提示组件，用于显示操作结果反馈

## Requirements

### Requirement 1

**User Story:** As a user, I want to click on the generation counter to navigate to the history page, so that I can quickly view all my generated images.

#### Acceptance Criteria

1. WHEN a user clicks on the GenerationCounter component THEN the System SHALL navigate to the history page (/history)
2. WHEN the GenerationCounter is rendered THEN the System SHALL display a cursor pointer to indicate clickability
3. WHEN the GenerationCounter is hovered THEN the System SHALL provide visual feedback through background color change

### Requirement 2

**User Story:** As a user, I want to right-click on an enlarged image in the Lightbox to access copy and save options, so that I can easily save images I like.

#### Acceptance Criteria

1. WHEN a user right-clicks on an image in the Lightbox THEN the System SHALL display a context menu with copy and save options
2. WHEN a user selects "复制图片" from the context menu THEN the System SHALL copy the image to the clipboard and display a success Toast
3. WHEN a user selects "保存图片" from the context menu THEN the System SHALL download the image to the user's device and display a success Toast with message "图片保存成功"
4. WHEN the copy or save operation fails THEN the System SHALL display an error Toast with appropriate error message
5. WHEN a user clicks outside the context menu or presses Escape THEN the System SHALL close the context menu
6. WHEN the context menu is displayed THEN the System SHALL prevent the default browser context menu from appearing

### Requirement 3

**User Story:** As a user, I want to see a Toast notification whenever I save an image anywhere in the application, so that I receive consistent feedback for all save operations.

#### Acceptance Criteria

1. WHEN a user saves an image from any location in the application THEN the System SHALL display a success Toast with message "图片保存成功"
2. WHEN a user saves an image from the ImageContextMenu component THEN the System SHALL display a success Toast with message "图片保存成功"
3. WHEN a user saves an image from the ImageCard component THEN the System SHALL display a success Toast with message "图片保存成功"
4. WHEN any image save operation fails THEN the System SHALL display an error Toast with message "保存失败，请稍后重试"

Note: 现有代码中使用"图片下载成功"的消息需要统一更改为"图片保存成功"
