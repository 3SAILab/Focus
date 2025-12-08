package models

import (
	"gorm.io/gorm"
)

// GenerationStats 生成统计模型
type GenerationStats struct {
	gorm.Model
	TotalCount int `json:"total_count" gorm:"default:0"`
}

// GenerationStatsResponse 响应结构体
type GenerationStatsResponse struct {
	TotalCount int `json:"total_count"`
}
