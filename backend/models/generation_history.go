package models

import (
	"time"

	"gorm.io/gorm"
)

// GenerationHistory 数据库模型
type GenerationHistory struct {
	gorm.Model
	Prompt         string `json:"prompt"`
	OriginalPrompt string `json:"original_prompt"`
	ImageURL       string `json:"image_url"`
	FileName       string `json:"file_name"`
	RefImages      string `json:"ref_images"`
}

// GenerationHistoryResponse 响应结构体
type GenerationHistoryResponse struct {
	ID             uint      `json:"id"`
	Prompt         string    `json:"prompt"`
	OriginalPrompt string    `json:"original_prompt"`
	ImageURL       string    `json:"image_url"`
	FileName       string    `json:"file_name"`
	RefImages      string    `json:"ref_images"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}
