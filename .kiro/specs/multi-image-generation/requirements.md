# Requirements Document

## Introduction

本功能允许用户在一次生成请求中选择生成 1-4 张图片，提高创作效率。系统将支持批量生成、网格布局展示，并保持与现有单图生成的兼容性。

## Glossary

- **Multi_Image_Generation**: 多图生成系统，支持一次请求生成多张图片
- **Image_Count**: 用户选择的生成数量（1-4）
- **Image_Grid**: 图片网格布局组件，根据图片数量自适应展示
- **Batch_ID**: 批次标识，用于关联同一次生成的多张图片

## Requirements

### Requirement 1

**User Story:** As a user, I want to select how many images to generate (1-4), so that I can get multiple variations in one request.

#### Acceptance Criteria

1. WHEN the user opens the PromptBar THEN the Multi_Image_Generation system SHALL display a count selector with options 1, 2, 3, 4
2. WHEN the user selects a count THEN the Multi_Image_Generation system SHALL remember the selection for the current session
3. WHEN the count selector is not interacted with THEN the Multi_Image_Generation system SHALL default to generating 1 image

### Requirement 2

**User Story:** As a user, I want to see multiple generated images in a grid layout, so that I can compare and choose the best one.

#### Acceptance Criteria

1. WHEN 1 image is generated THEN the Image_Grid SHALL display the image at full width (current behavior)
2. WHEN 2 images are generated THEN the Image_Grid SHALL display images in a 2-column layout
3. WHEN 3 or 4 images are generated THEN the Image_Grid SHALL display images in a 2x2 grid layout
4. WHEN images have different aspect ratios THEN the Image_Grid SHALL maintain consistent cell sizes while preserving image proportions

### Requirement 3

**User Story:** As a user, I want each image in the grid to have individual actions, so that I can interact with them separately.

#### Acceptance Criteria

1. WHEN hovering over an image in the grid THEN the Multi_Image_Generation system SHALL show action buttons (download, reference, regenerate)
2. WHEN clicking an image in the grid THEN the Multi_Image_Generation system SHALL open the lightbox for that specific image
3. WHEN using "reference" on a grid image THEN the Multi_Image_Generation system SHALL add only that image to the reference list

### Requirement 4

**User Story:** As a developer, I want the backend to support batch generation, so that multiple images can be generated efficiently.

#### Acceptance Criteria

1. WHEN receiving a generate request with count > 1 THEN the backend SHALL call the AI API sequentially for each image
2. WHEN all images are generated successfully THEN the backend SHALL return an array of image URLs
3. WHEN any image generation fails THEN the backend SHALL return partial results with error information for failed items
4. WHEN storing batch results THEN the backend SHALL create separate history records linked by a common Batch_ID

### Requirement 5

**User Story:** As a user, I want to see generation progress for multiple images, so that I know how many are completed.

#### Acceptance Criteria

1. WHEN generating multiple images THEN the Multi_Image_Generation system SHALL show placeholder cards for each pending image
2. WHEN an image completes THEN the Multi_Image_Generation system SHALL replace its placeholder with the actual image
3. WHEN generation fails for an image THEN the Multi_Image_Generation system SHALL show an ErrorCard in that position

### Requirement 6

**User Story:** As a user, I want failed images to show in the correct grid position, so that I can retry specific failures.

#### Acceptance Criteria

1. WHEN an image in a batch fails THEN the ErrorCard SHALL appear in the correct grid position
2. WHEN retrying a failed image THEN the Multi_Image_Generation system SHALL only regenerate that specific image
3. WHEN all images in a batch fail THEN the Multi_Image_Generation system SHALL show a full grid of ErrorCards
