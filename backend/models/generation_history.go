package models

import (
	"time"
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
// 不使用软删除，删除操作只删除图片文件，数据库记录永久保留
type GenerationHistory struct {
	ID             uint      `json:"id" gorm:"primarykey"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
	Prompt         string    `json:"prompt"`
	OriginalPrompt string    `json:"original_prompt"`
	ImageURL       string    `json:"image_url"`
	FileName       string    `json:"file_name"`
	RefImages      string    `json:"ref_images"`
	Type           string    `json:"type" gorm:"default:create"`         // 生成类型: create | white_background
	ErrorMsg       string    `json:"error_msg,omitempty"`                // 错误信息（失败时保存）
	ImageDeleted   bool      `json:"image_deleted" gorm:"default:false"` // 图片是否已被删除
	// 多图生成批次字段（可空，用于安全迁移）
	BatchID    *string `json:"batch_id,omitempty" gorm:"index"` // 批次 ID，关联同一次生成的多张图片
	BatchIndex *int    `json:"batch_index,omitempty"`           // 批次内序号 (0-3)
	BatchTotal *int    `json:"batch_total,omitempty"`           // 批次总数 (1-4)
}

// Note: 不再使用 gorm.Model，移除了 DeletedAt 字段
// 删除操作只删除 output 目录中的图片文件，数据库记录永久保留
// 使用 ImageDeleted 字段标记图片是否已被删除

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
	ImageDeleted   bool      `json:"image_deleted"` // 图片是否已被删除
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
	// 多图生成批次字段
	BatchID    *string `json:"batch_id,omitempty"`
	BatchIndex *int    `json:"batch_index,omitempty"`
	BatchTotal *int    `json:"batch_total,omitempty"`
}
