# Requirements Document

## Introduction

本规范文档定义了前端代码重构的需求，目标是通过组件复用和代码抽象来减少代码量，同时确保所有现有功能保持不变。重构将聚焦于以下几个方面：模态框组件统一、图片上传逻辑复用、页面布局模式抽象、以及通用 hooks 提取。

## Glossary

- **Modal**: 模态对话框组件，用于显示需要用户交互的弹窗
- **ImageUploadZone**: 图片上传区域组件，支持点击、拖拽、粘贴上传
- **PageHeader**: 页面头部组件，包含标题和计数器
- **GenerationWorkspace**: 生成工作区组件，包含上传区域和结果展示
- **useImageUpload**: 图片上传相关的自定义 Hook
- **useDragDrop**: 拖拽上传相关的自定义 Hook

## Requirements

### Requirement 1: 通用模态框组件

**User Story:** As a developer, I want a reusable modal component, so that I can reduce code duplication across different modal dialogs.

#### Acceptance Criteria

1. WHEN a modal component is created THEN the Modal_Component SHALL provide a consistent backdrop, animation, and close button pattern
2. WHEN the modal is opened THEN the Modal_Component SHALL display with fade-in and zoom-in animation
3. WHEN the modal has a header THEN the Modal_Component SHALL render the header with icon, title, and optional close button
4. WHEN the modal has footer buttons THEN the Modal_Component SHALL render them in a consistent layout
5. WHEN the user clicks outside the modal (if closable) THEN the Modal_Component SHALL close the modal
6. WHEN the user presses Escape key (if closable) THEN the Modal_Component SHALL close the modal

### Requirement 2: 图片上传区域组件

**User Story:** As a developer, I want a reusable image upload zone component, so that I can eliminate duplicate upload logic across WhiteBackground, ClothingChange, and Create views.

#### Acceptance Criteria

1. WHEN an upload zone is rendered THEN the ImageUploadZone_Component SHALL display a clickable area with icon and text
2. WHEN a user drags an image over the zone THEN the ImageUploadZone_Component SHALL show visual feedback with highlight border and bounce animation
3. WHEN a user drops an image file THEN the ImageUploadZone_Component SHALL accept the file and call the onFileSelect callback
4. WHEN a user drops an image URL THEN the ImageUploadZone_Component SHALL load the image from URL and convert it to a File object
5. WHEN an image is selected THEN the ImageUploadZone_Component SHALL display the preview with a clear button
6. WHEN the clear button is clicked THEN the ImageUploadZone_Component SHALL remove the image and reset to empty state
7. WHEN the preview image is right-clicked THEN the ImageUploadZone_Component SHALL show the context menu

### Requirement 3: 页面头部组件

**User Story:** As a developer, I want a reusable page header component, so that I can maintain consistent header styling across all views.

#### Acceptance Criteria

1. WHEN a page header is rendered THEN the PageHeader_Component SHALL display a sticky header with blur backdrop
2. WHEN a title is provided THEN the PageHeader_Component SHALL display the title with a colored status dot
3. WHEN a counter is needed THEN the PageHeader_Component SHALL render the GenerationCounter component
4. WHEN custom right content is provided THEN the PageHeader_Component SHALL render it in the right section

### Requirement 4: 生成工作区布局组件

**User Story:** As a developer, I want a reusable generation workspace layout, so that I can standardize the upload-result grid pattern used in WhiteBackground and ClothingChange views.

#### Acceptance Criteria

1. WHEN a workspace is rendered THEN the GenerationWorkspace_Component SHALL display a responsive grid layout
2. WHEN upload slots are provided THEN the GenerationWorkspace_Component SHALL render them in the left columns
3. WHEN a result slot is provided THEN the GenerationWorkspace_Component SHALL render it in the right column
4. WHEN generating THEN the GenerationWorkspace_Component SHALL display the PlaceholderCard in the result area
5. WHEN a result image exists THEN the GenerationWorkspace_Component SHALL display it with context menu support

### Requirement 5: 图片上传 Hook

**User Story:** As a developer, I want a custom hook for image upload logic, so that I can reuse file handling, preview URL management, and cleanup logic.

#### Acceptance Criteria

1. WHEN useImageUpload is called THEN the Hook SHALL return file state, preview URL, and handler functions
2. WHEN a file is selected THEN the Hook SHALL create a preview URL and update state
3. WHEN the file is cleared THEN the Hook SHALL revoke the preview URL and reset state
4. WHEN the component unmounts THEN the Hook SHALL automatically revoke any active preview URLs
5. WHEN loading from URL THEN the Hook SHALL convert the URL to a File object

### Requirement 6: 拖拽上传 Hook

**User Story:** As a developer, I want a custom hook for drag-and-drop functionality, so that I can reuse drag state management and drop handling logic.

#### Acceptance Criteria

1. WHEN useDragDrop is called THEN the Hook SHALL return isDragging state and event handlers
2. WHEN a user drags over the target THEN the Hook SHALL set isDragging to true
3. WHEN a user drags away from the target THEN the Hook SHALL set isDragging to false
4. WHEN a user drops files THEN the Hook SHALL extract image files and call the onDrop callback
5. WHEN a user drops a URL THEN the Hook SHALL detect and handle image URLs appropriately

### Requirement 7: 错误处理统一

**User Story:** As a developer, I want unified error handling for API responses, so that I can eliminate duplicate error parsing logic.

#### Acceptance Criteria

1. WHEN an API error occurs THEN the ErrorHandler_Utility SHALL parse nested error formats consistently
2. WHEN the error is a quota error THEN the ErrorHandler_Utility SHALL identify it and return isQuotaError flag
3. WHEN displaying errors THEN the ErrorHandler_Utility SHALL provide user-friendly error messages

### Requirement 8: 历史记录区域组件

**User Story:** As a developer, I want a reusable history section component, so that I can standardize the history display pattern across views.

#### Acceptance Criteria

1. WHEN a history section is rendered THEN the HistorySection_Component SHALL display a white card with title and grid
2. WHEN history data is provided THEN the HistorySection_Component SHALL render the HistoryImageGrid
3. WHEN history is empty THEN the HistorySection_Component SHALL display the empty state message

### Requirement 9: 生成按钮组件

**User Story:** As a developer, I want a reusable generation button component, so that I can standardize the generate button pattern with loading state.

#### Acceptance Criteria

1. WHEN a generate button is rendered THEN the GenerateButton_Component SHALL display with consistent styling
2. WHEN generating THEN the GenerateButton_Component SHALL show a loading spinner and disabled state
3. WHEN disabled THEN the GenerateButton_Component SHALL show reduced opacity and prevent clicks
4. WHEN custom text is provided THEN the GenerateButton_Component SHALL display the custom text

### Requirement 10: 配额错误和联系销售组合

**User Story:** As a developer, I want a combined quota error handling component, so that I can eliminate duplicate quota error + contact modal logic.

#### Acceptance Criteria

1. WHEN quota error occurs THEN the QuotaErrorHandler_Component SHALL show the quota error alert
2. WHEN user clicks contact sales THEN the QuotaErrorHandler_Component SHALL transition to contact modal
3. WHEN either modal is closed THEN the QuotaErrorHandler_Component SHALL reset the state appropriately
