package models

import (
	"time"

	"gorm.io/gorm"
)

// TaskStatus 任务状态类型
type TaskStatus string

// 任务状态常量
const (
	TaskStatusProcessing TaskStatus = "processing"
	TaskStatusCompleted  TaskStatus = "completed"
	TaskStatusFailed     TaskStatus = "failed"
)

// GenerationTask 生成任务数据库模型
type GenerationTask struct {
	gorm.Model
	TaskID     string     `json:"task_id" gorm:"uniqueIndex;not null"`
	Status     TaskStatus `json:"status" gorm:"default:processing;not null"`
	Type       string     `json:"type" gorm:"not null"`       // create, white_background, clothing_change
	Prompt     string     `json:"prompt"`
	RefImages  string     `json:"ref_images"`                 // JSON array of ref image URLs
	ImageURL   string     `json:"image_url"`                  // 生成的图片 URL
	ErrorMsg   string     `json:"error_msg"`                  // 错误信息
	StartedAt  time.Time  `json:"started_at" gorm:"not null"`
	ImageCount int        `json:"image_count" gorm:"default:1"` // 请求生成的图片数量 (1-4)
}

// TaskResponse API 响应结构体
type TaskResponse struct {
	ID         uint       `json:"id"`
	TaskID     string     `json:"task_id"`
	Status     TaskStatus `json:"status"`
	Type       string     `json:"type"`
	Prompt     string     `json:"prompt"`
	RefImages  string     `json:"ref_images"`
	ImageURL   string     `json:"image_url"`
	ErrorMsg   string     `json:"error_msg"`
	StartedAt  time.Time  `json:"started_at"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
	ImageCount int        `json:"image_count"`
}

// ToResponse 将 GenerationTask 转换为 TaskResponse
func (t *GenerationTask) ToResponse() TaskResponse {
	return TaskResponse{
		ID:         t.ID,
		TaskID:     t.TaskID,
		Status:     t.Status,
		Type:       t.Type,
		Prompt:     t.Prompt,
		RefImages:  t.RefImages,
		ImageURL:   t.ImageURL,
		ErrorMsg:   t.ErrorMsg,
		StartedAt:  t.StartedAt,
		CreatedAt:  t.CreatedAt,
		UpdatedAt:  t.UpdatedAt,
		ImageCount: t.ImageCount,
	}
}

// IsValidStatus 检查状态是否有效
func IsValidStatus(status TaskStatus) bool {
	return status == TaskStatusProcessing ||
		status == TaskStatusCompleted ||
		status == TaskStatusFailed
}

// CanTransitionTo 检查状态转换是否有效
// 只允许从 processing 转换到 completed 或 failed
func (t *GenerationTask) CanTransitionTo(newStatus TaskStatus) bool {
	if t.Status == TaskStatusProcessing {
		return newStatus == TaskStatusCompleted || newStatus == TaskStatusFailed
	}
	return false
}

// CompleteTask 将任务标记为完成
func (t *GenerationTask) CompleteTask(imageURL string) bool {
	if !t.CanTransitionTo(TaskStatusCompleted) {
		return false
	}
	if imageURL == "" {
		return false
	}
	t.Status = TaskStatusCompleted
	t.ImageURL = imageURL
	return true
}

// FailTask 将任务标记为失败
func (t *GenerationTask) FailTask(errorMsg string) bool {
	if !t.CanTransitionTo(TaskStatusFailed) {
		return false
	}
	if errorMsg == "" {
		return false
	}
	t.Status = TaskStatusFailed
	t.ErrorMsg = errorMsg
	return true
}
