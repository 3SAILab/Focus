package models

import (
	"time"

	"gorm.io/gorm"
)

// GenerationType 生成类型常量
const (
	GenerationTypeCreate          = "create"           // 创作空间生成
	GenerationTypeWhiteBackground = "white_background" // 白底图生成
	GenerationTypeClothingChange  = "clothing_change"  // 换装生成
	GenerationTypeProductScene    = "product_scene"    // 一键商品图生成
	GenerationTypeLightShadow     = "light_shadow"     // 光影融合生成
)

// GenerationHistory 数据库模型
// 使用 GORM 的软删除功能，删除时只设置 deleted_at 字段
type GenerationHistory struct {
	gorm.Model
	Prompt         string `json:"prompt"`
	OriginalPrompt string `json:"original_prompt"`
	ImageURL       string `json:"image_url"`
	FileName       string `json:"file_name"`
	RefImages      string `json:"ref_images"`
	Type           string `json:"type" gorm:"default:create"` // 生成类型: create | white_background
	ErrorMsg       string `json:"error_msg,omitempty"`        // 错误信息（失败时保存）
	// 多图生成批次字段（可空，用于安全迁移）
	BatchID    *string `json:"batch_id,omitempty" gorm:"index"`    // 批次 ID，关联同一次生成的多张图片
	BatchIndex *int    `json:"batch_index,omitempty"`              // 批次内序号 (0-3)
	BatchTotal *int    `json:"batch_total,omitempty"`              // 批次总数 (1-4)
}

// Note: GORM's gorm.Model already includes DeletedAt field for soft delete
// When Delete() is called, it sets deleted_at instead of actually deleting the record
// All queries automatically exclude soft-deleted records

// GenerationHistoryResponse 响应结构体
type GenerationHistoryResponse struct {
	ID             uint      `json:"id"`
	Prompt         string    `json:"prompt"`
	OriginalPrompt string    `json:"original_prompt"`
	ImageURL       string    `json:"image_url"`
	FileName       string    `json:"file_name"`
	RefImages      string    `json:"ref_images"`
	Type           string    `json:"type"`
	ErrorMsg       string    `json:"error_msg,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
	// 多图生成批次字段
	BatchID    *string `json:"batch_id,omitempty"`
	BatchIndex *int    `json:"batch_index,omitempty"`
	BatchTotal *int    `json:"batch_total,omitempty"`
}
