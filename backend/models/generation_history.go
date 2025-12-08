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
type GenerationHistory struct {
	gorm.Model
	Prompt         string `json:"prompt"`
	OriginalPrompt string `json:"original_prompt"`
	ImageURL       string `json:"image_url"`
	FileName       string `json:"file_name"`
	RefImages      string `json:"ref_images"`
	Type           string `json:"type" gorm:"default:create"` // 生成类型: create | white_background
}

// GenerationHistoryResponse 响应结构体
type GenerationHistoryResponse struct {
	ID             uint      `json:"id"`
	Prompt         string    `json:"prompt"`
	OriginalPrompt string    `json:"original_prompt"`
	ImageURL       string    `json:"image_url"`
	FileName       string    `json:"file_name"`
	RefImages      string    `json:"ref_images"`
	Type           string    `json:"type"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}
