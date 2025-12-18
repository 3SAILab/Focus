package handlers

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"sigma/config"
	"sigma/models"
	"sigma/utils"
)

// convertHistoryToResponse 将历史记录转换为响应格式，同时转换 URL
func convertHistoryToResponse(history []models.GenerationHistory) []models.GenerationHistoryResponse {
	response := make([]models.GenerationHistoryResponse, len(history))
	for i, h := range history {
		// 转换 URL 为当前端口的绝对路径（兼容旧数据和新数据）
		imageURL := utils.ToAbsoluteURL(h.ImageURL, config.ServerPort)
		refImages := utils.ConvertRefImagesJSON(h.RefImages, config.ServerPort, false)
		
		response[i] = models.GenerationHistoryResponse{
			ID:             h.ID,
			Prompt:         h.Prompt,
			OriginalPrompt: h.OriginalPrompt,
			ImageURL:       imageURL,
			FileName:       h.FileName,
			RefImages:      refImages,
			Type:           h.Type,
			CreatedAt:      h.CreatedAt,
			UpdatedAt:      h.UpdatedAt,
			BatchID:        h.BatchID,
			BatchIndex:     h.BatchIndex,
			BatchTotal:     h.BatchTotal,
		}
	}
	return response
}

// parsePageParams 解析分页参数
func parsePageParams(c *gin.Context) (int, int) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}

	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "100"))
	switch {
	case pageSize > 10000:
		pageSize = 10000 // 最大允许 10000 条
	case pageSize <= 0:
		pageSize = 100 // 默认 100 条
	}

	return page, pageSize
}

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

	page, pageSize := parsePageParams(c)
	offset := (page - 1) * pageSize

	result := query.Order("created_at desc").
		Offset(offset).
		Limit(pageSize).
		Find(&history)

	if result.Error != nil {
		c.JSON(500, gin.H{"error": "获取历史记录失败"})
		return
	}

	c.JSON(200, convertHistoryToResponse(history))
}


// WhiteBackgroundHistoryHandler 获取白底图历史记录
func WhiteBackgroundHistoryHandler(c *gin.Context) {
	var history []models.GenerationHistory
	query := config.DB.Model(&models.GenerationHistory{}).
		Where("type = ?", models.GenerationTypeWhiteBackground)

	page, pageSize := parsePageParams(c)
	offset := (page - 1) * pageSize

	result := query.Order("created_at desc").
		Offset(offset).
		Limit(pageSize).
		Find(&history)

	if result.Error != nil {
		c.JSON(500, gin.H{"error": "获取白底图历史记录失败"})
		return
	}

	c.JSON(200, convertHistoryToResponse(history))
}

// ClothingChangeHistoryHandler 获取换装历史记录
func ClothingChangeHistoryHandler(c *gin.Context) {
	var history []models.GenerationHistory
	query := config.DB.Model(&models.GenerationHistory{}).
		Where("type = ?", models.GenerationTypeClothingChange)

	page, pageSize := parsePageParams(c)
	offset := (page - 1) * pageSize

	result := query.Order("created_at desc").
		Offset(offset).
		Limit(pageSize).
		Find(&history)

	if result.Error != nil {
		c.JSON(500, gin.H{"error": "获取换装历史记录失败"})
		return
	}

	c.JSON(200, convertHistoryToResponse(history))
}

// ProductSceneHistoryHandler 获取一键商品图历史记录
func ProductSceneHistoryHandler(c *gin.Context) {
	var history []models.GenerationHistory
	query := config.DB.Model(&models.GenerationHistory{}).
		Where("type = ?", models.GenerationTypeProductScene)

	page, pageSize := parsePageParams(c)
	offset := (page - 1) * pageSize

	result := query.Order("created_at desc").
		Offset(offset).
		Limit(pageSize).
		Find(&history)

	if result.Error != nil {
		c.JSON(500, gin.H{"error": "获取商品图历史记录失败"})
		return
	}

	c.JSON(200, convertHistoryToResponse(history))
}

// LightShadowHistoryHandler 获取光影融合历史记录
func LightShadowHistoryHandler(c *gin.Context) {
	var history []models.GenerationHistory
	query := config.DB.Model(&models.GenerationHistory{}).
		Where("type = ?", models.GenerationTypeLightShadow)

	page, pageSize := parsePageParams(c)
	offset := (page - 1) * pageSize

	result := query.Order("created_at desc").
		Offset(offset).
		Limit(pageSize).
		Find(&history)

	if result.Error != nil {
		c.JSON(500, gin.H{"error": "获取光影融合历史记录失败"})
		return
	}

	c.JSON(200, convertHistoryToResponse(history))
}
