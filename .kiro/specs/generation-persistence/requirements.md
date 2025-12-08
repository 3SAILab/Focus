# Requirements Document

## Introduction

本功能旨在解决前端图片生成过程中，用户切换页面或刷新网页导致生成任务丢失的问题。系统需要在后端持久化生成任务状态，前端在页面加载时能够恢复正在进行的生成任务，确保用户不会因为页面操作而丢失正在生成的图片。

## Glossary

- **Generation_Task**: 一个图片生成任务，包含任务ID、状态、提示词、参考图等信息
- **Task_Status**: 生成任务的状态，包括 pending（等待中）、processing（处理中）、completed（已完成）、failed（失败）
- **Task_Persistence_Service**: 后端服务，负责持久化和管理生成任务状态
- **Task_Recovery_Service**: 前端服务，负责在页面加载时恢复正在进行的任务
- **Polling_Mechanism**: 轮询机制，前端定期查询后端任务状态

## Requirements

### Requirement 1

**User Story:** As a user, I want my image generation tasks to continue even if I navigate away or refresh the page, so that I do not lose my generation progress.

#### Acceptance Criteria

1. WHEN a user initiates an image generation request THEN THE Task_Persistence_Service SHALL create a Generation_Task record with status "processing" and return a unique task ID
2. WHEN the backend completes image generation THEN THE Task_Persistence_Service SHALL update the Generation_Task status to "completed" and store the generated image URL
3. WHEN the backend fails to generate an image THEN THE Task_Persistence_Service SHALL update the Generation_Task status to "failed" and store the error message
4. WHEN a user loads any generation page THEN THE Task_Recovery_Service SHALL query for any tasks with status "processing" and display them as in-progress
5. WHEN a task transitions from "processing" to "completed" THEN THE frontend SHALL display the generated image and update the history

### Requirement 2

**User Story:** As a user, I want to see the status of my ongoing generation tasks after page refresh, so that I know my tasks are still being processed.

#### Acceptance Criteria

1. WHEN the frontend detects a task with status "processing" THEN THE frontend SHALL display a loading indicator for that task
2. WHEN the frontend is monitoring a processing task THEN THE Polling_Mechanism SHALL query the task status every 2 seconds
3. WHEN a monitored task completes THEN THE frontend SHALL stop polling and display the result
4. WHEN a monitored task fails THEN THE frontend SHALL stop polling and display the error message

### Requirement 3

**User Story:** As a user, I want stale or abandoned generation tasks to be cleaned up automatically, so that the system remains performant.

#### Acceptance Criteria

1. WHEN a Generation_Task has been in "processing" status for more than 5 minutes THEN THE Task_Persistence_Service SHALL mark the task as "failed" with a timeout error
2. WHEN the system starts THEN THE Task_Persistence_Service SHALL clean up any tasks that have been processing for more than 5 minutes

### Requirement 4

**User Story:** As a user, I want generation tasks to be associated with their generation type, so that tasks appear on the correct page after recovery.

#### Acceptance Criteria

1. WHEN a Generation_Task is created THEN THE Task_Persistence_Service SHALL store the generation type (CREATE, WHITE_BACKGROUND, CLOTHING_CHANGE)
2. WHEN the frontend queries for processing tasks THEN THE Task_Recovery_Service SHALL filter tasks by the current page's generation type
3. WHEN displaying recovered tasks THEN THE frontend SHALL show the original prompt and reference images associated with the task
