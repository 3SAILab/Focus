package handlers

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"sigma/models"
	"sigma/config"
)

// HistoryHandler 获取历史记录处理函数
func HistoryHandler(c *gin.Context) {
	var history []models.GenerationHistory
	query := config.DB.Model(&models.GenerationHistory{})

	dateStr := c.Query("date")
	if dateStr != "" {
		parsedDate, err := time.Parse("2006-01-02", dateStr)
		if err == nil {
			startOfDay := parsedDate
			endOfDay := parsedDate.Add(24 * time.Hour)
			query = query.Where("created_at >= ? AND created_at < ?", startOfDay, endOfDay)
		}
	}

	// 支持按类型筛选
	typeFilter := c.Query("type")
	if typeFilter != "" {
		query = query.Where("type = ?", typeFilter)
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}

	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	switch {
	case pageSize > 100:
		pageSize = 100
	case pageSize <= 0:
		pageSize = 20
	}

	offset := (page - 1) * pageSize

	result := query.Order("created_at desc").
		Offset(offset).
		Limit(pageSize).
		Find(&history)

	if result.Error != nil {
		c.JSON(500, gin.H{"error": "获取历史记录失败"})
		return
	}

	response := make([]models.GenerationHistoryResponse, len(history))
	for i, h := range history {
		response[i] = models.GenerationHistoryResponse{
			ID:             h.ID,
			Prompt:         h.Prompt,
			OriginalPrompt: h.OriginalPrompt,
			ImageURL:       h.ImageURL,
			FileName:       h.FileName,
			RefImages:      h.RefImages,
			Type:           h.Type,
			CreatedAt:      h.CreatedAt,
			UpdatedAt:      h.UpdatedAt,
		}
	}

	c.JSON(200, response)
}

// WhiteBackgroundHistoryHandler 获取白底图历史记录
func WhiteBackgroundHistoryHandler(c *gin.Context) {
	var history []models.GenerationHistory
	query := config.DB.Model(&models.GenerationHistory{}).
		Where("type = ?", models.GenerationTypeWhiteBackground)

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}

	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	switch {
	case pageSize > 100:
		pageSize = 100
	case pageSize <= 0:
		pageSize = 20
	}

	offset := (page - 1) * pageSize

	result := query.Order("created_at desc").
		Offset(offset).
		Limit(pageSize).
		Find(&history)

	if result.Error != nil {
		c.JSON(500, gin.H{"error": "获取白底图历史记录失败"})
		return
	}

	response := make([]models.GenerationHistoryResponse, len(history))
	for i, h := range history {
		response[i] = models.GenerationHistoryResponse{
			ID:             h.ID,
			Prompt:         h.Prompt,
			OriginalPrompt: h.OriginalPrompt,
			ImageURL:       h.ImageURL,
			FileName:       h.FileName,
			RefImages:      h.RefImages,
			Type:           h.Type,
			CreatedAt:      h.CreatedAt,
			UpdatedAt:      h.UpdatedAt,
		}
	}

	c.JSON(200, response)
}



// ClothingChangeHistoryHandler 获取换装历史记录
func ClothingChangeHistoryHandler(c *gin.Context) {
	var history []models.GenerationHistory
	query := config.DB.Model(&models.GenerationHistory{}).
		Where("type = ?", models.GenerationTypeClothingChange)

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}

	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	switch {
	case pageSize > 100:
		pageSize = 100
	case pageSize <= 0:
		pageSize = 20
	}

	offset := (page - 1) * pageSize

	result := query.Order("created_at desc").
		Offset(offset).
		Limit(pageSize).
		Find(&history)

	if result.Error != nil {
		c.JSON(500, gin.H{"error": "获取换装历史记录失败"})
		return
	}

	response := make([]models.GenerationHistoryResponse, len(history))
	for i, h := range history {
		response[i] = models.GenerationHistoryResponse{
			ID:             h.ID,
			Prompt:         h.Prompt,
			OriginalPrompt: h.OriginalPrompt,
			ImageURL:       h.ImageURL,
			FileName:       h.FileName,
			RefImages:      h.RefImages,
			Type:           h.Type,
			CreatedAt:      h.CreatedAt,
			UpdatedAt:      h.UpdatedAt,
		}
	}

	c.JSON(200, response)
}
