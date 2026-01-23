package handlers

import (
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"sigma/config"
	"sigma/models"
	"sigma/utils"

	"github.com/gin-gonic/gin"
)

// convertHistoryToResponse 将历史记录转换为响应格式，同时转换 URL
func convertHistoryToResponse(history []models.GenerationHistory) []models.GenerationHistoryResponse {
	response := make([]models.GenerationHistoryResponse, len(history))
	for i, h := range history {
		// 转换 URL 为当前端口的绝对路径（兼容旧数据和新数据）
		imageURL := utils.ToAbsoluteURL(h.ImageURL, config.ServerPort)
		refImages := utils.ConvertRefImagesJSON(h.RefImages, config.ServerPort, false)

		// 兼容旧数据：如果没有 aspect_ratio 或 image_size，使用默认值
		aspectRatio := h.AspectRatio
		if aspectRatio == "" {
			aspectRatio = "1:1"
		}
		imageSize := h.ImageSize
		if imageSize == "" {
			imageSize = "2K"
		}

		response[i] = models.GenerationHistoryResponse{
			ID:             h.ID,
			Prompt:         h.Prompt,
			OriginalPrompt: h.OriginalPrompt,
			ImageURL:       imageURL,
			FileName:       h.FileName,
			RefImages:      refImages,
			Type:           h.Type,
			ImageDeleted:   h.ImageDeleted,
			AspectRatio:    aspectRatio,
			ImageSize:      imageSize,
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
// 只返回成功生成的记录（有 image_url 的），不包含失败记录和已删除的图片
func HistoryHandler(c *gin.Context) {
	var history []models.GenerationHistory
	// 只过滤有效的图片记录
	// 注意：不再使用 deleted_at 字段，因为新版本已移除软删除功能
	// 使用 image_deleted 字段来标记图片是否已被删除
	// 过滤条件：有图片URL + 图片未被删除
	query := config.DB.Model(&models.GenerationHistory{}).
		Where("image_url != '' AND image_url IS NOT NULL").
		Where("image_deleted = ? OR image_deleted IS NULL", false)

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
// 只返回成功生成的记录，不包含已删除的图片
func WhiteBackgroundHistoryHandler(c *gin.Context) {
	var history []models.GenerationHistory
	query := config.DB.Model(&models.GenerationHistory{}).
		Where("type = ?", models.GenerationTypeWhiteBackground).
		Where("image_url != '' AND image_url IS NOT NULL").
		Where("image_deleted = ? OR image_deleted IS NULL", false)

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
// 只返回成功生成的记录，不包含已删除的图片
func ClothingChangeHistoryHandler(c *gin.Context) {
	var history []models.GenerationHistory
	query := config.DB.Model(&models.GenerationHistory{}).
		Where("type = ?", models.GenerationTypeClothingChange).
		Where("image_url != '' AND image_url IS NOT NULL").
		Where("image_deleted = ? OR image_deleted IS NULL", false)

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
// 只返回成功生成的记录，不包含已删除的图片
func ProductSceneHistoryHandler(c *gin.Context) {
	var history []models.GenerationHistory
	query := config.DB.Model(&models.GenerationHistory{}).
		Where("type = ?", models.GenerationTypeProductScene).
		Where("image_url != '' AND image_url IS NOT NULL").
		Where("image_deleted = ? OR image_deleted IS NULL", false)

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
// 只返回成功生成的记录，不包含已删除的图片
func LightShadowHistoryHandler(c *gin.Context) {
	var history []models.GenerationHistory
	query := config.DB.Model(&models.GenerationHistory{}).
		Where("type = ?", models.GenerationTypeLightShadow).
		Where("image_url != '' AND image_url IS NOT NULL").
		Where("image_deleted = ? OR image_deleted IS NULL", false)

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

// deleteImageFile 删除图片文件
func deleteImageFile(imageURL string) {
	if imageURL == "" {
		return
	}

	if !config.IsProduction {
		log.Printf("尝试删除图片文件，URL: %s", imageURL)
	}

	// 从 URL 中提取文件名
	// 数据库中存储的格式可能是:
	// 1. 相对路径: images/xxx.png
	// 2. 完整 URL: http://localhost:8080/images/xxx.png
	// 3. 带斜杠的路径: /images/xxx.png
	var fileName string

	if strings.HasPrefix(imageURL, "images/") {
		// 相对路径格式: images/xxx.png
		fileName = strings.TrimPrefix(imageURL, "images/")
	} else if strings.Contains(imageURL, "/images/") {
		// URL 格式: http://localhost:8080/images/xxx.png 或 /images/xxx.png
		parts := strings.Split(imageURL, "/images/")
		if len(parts) > 1 {
			fileName = parts[len(parts)-1]
		}
	}

	if fileName == "" {
		if !config.IsProduction {
			log.Printf("无法从 URL 提取文件名: %s", imageURL)
		}
		return
	}

	// 构建完整文件路径
	filePath := filepath.Join(config.OutputDir, fileName)
	if !config.IsProduction {
		log.Printf("准备删除文件: %s", filePath)
	}

	// 删除文件
	if err := os.Remove(filePath); err != nil {
		if os.IsNotExist(err) {
			if !config.IsProduction {
				log.Printf("文件不存在，跳过删除: %s", filePath)
			}
		} else {
			if !config.IsProduction {
				log.Printf("删除图片文件失败: %s, 错误: %v", filePath, err)
			}
		}
	} else {
		if !config.IsProduction {
			log.Printf("成功删除文件: %s", filePath)
		}
	}
}

// DeleteHistoryHandler 删除历史记录
// 只删除 output 目录中的图片文件，数据库记录保留并标记为已删除
// 不影响生成次数统计
func DeleteHistoryHandler(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(400, gin.H{"error": "无效的记录 ID"})
		return
	}

	// 查找记录是否存在
	var history models.GenerationHistory
	if err := config.DB.First(&history, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "记录不存在"})
		return
	}

	// 删除图片文件
	deleteImageFile(history.ImageURL)

	// 标记记录为已删除（保留数据库记录）
	if err := config.DB.Model(&history).Update("image_deleted", true).Error; err != nil {
		c.JSON(500, gin.H{"error": "更新记录失败"})
		return
	}

	c.JSON(200, gin.H{"message": "删除成功"})
}

// BatchDeleteHistoryHandler 批量删除历史记录
// 只删除图片文件，数据库记录保留并标记为已删除
func BatchDeleteHistoryHandler(c *gin.Context) {
	var req struct {
		IDs []uint `json:"ids" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "无效的请求参数"})
		return
	}

	if len(req.IDs) == 0 {
		c.JSON(400, gin.H{"error": "请选择要删除的记录"})
		return
	}

	// 先查询要删除的记录，获取图片 URL
	var histories []models.GenerationHistory
	config.DB.Where("id IN ?", req.IDs).Find(&histories)

	// 删除图片文件
	for _, h := range histories {
		deleteImageFile(h.ImageURL)
	}

	// 批量标记为已删除（保留数据库记录）
	result := config.DB.Model(&models.GenerationHistory{}).Where("id IN ?", req.IDs).Update("image_deleted", true)
	if result.Error != nil {
		c.JSON(500, gin.H{"error": "更新记录失败"})
		return
	}

	c.JSON(200, gin.H{
		"message": "删除成功",
		"deleted": result.RowsAffected,
	})
}

// DeleteHistoryByBatchHandler 按批次 ID 删除历史记录
// 只删除图片文件，数据库记录保留并标记为已删除
func DeleteHistoryByBatchHandler(c *gin.Context) {
	batchID := c.Param("batch_id")
	if batchID == "" {
		c.JSON(400, gin.H{"error": "无效的批次 ID"})
		return
	}

	// 查询该批次的所有记录
	var histories []models.GenerationHistory
	result := config.DB.Where("batch_id = ?", batchID).Find(&histories)
	if result.Error != nil {
		c.JSON(500, gin.H{"error": "查询批次记录失败"})
		return
	}

	if len(histories) == 0 {
		c.JSON(404, gin.H{"error": "批次不存在"})
		return
	}

	// 删除图片文件
	for _, h := range histories {
		deleteImageFile(h.ImageURL)
	}

	// 批量标记为已删除（保留数据库记录）
	deleteResult := config.DB.Model(&models.GenerationHistory{}).Where("batch_id = ?", batchID).Update("image_deleted", true)
	if deleteResult.Error != nil {
		c.JSON(500, gin.H{"error": "更新批次记录失败"})
		return
	}

	c.JSON(200, gin.H{
		"message": "删除成功",
		"deleted": deleteResult.RowsAffected,
	})
}

// DeleteHistoryByDateHandler 按日期删除历史记录
// 只删除图片文件，数据库记录保留并标记为已删除
func DeleteHistoryByDateHandler(c *gin.Context) {
	dateStr := c.Param("date")

	// 解析日期
	parsedDate, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		c.JSON(400, gin.H{"error": "无效的日期格式，请使用 YYYY-MM-DD"})
		return
	}

	startOfDay := parsedDate
	endOfDay := parsedDate.Add(24 * time.Hour)

	// 先查询要删除的记录，获取图片 URL
	var histories []models.GenerationHistory
	config.DB.Where("created_at >= ? AND created_at < ?", startOfDay, endOfDay).Find(&histories)

	if len(histories) == 0 {
		c.JSON(404, gin.H{"error": "该日期没有记录"})
		return
	}

	// 删除图片文件
	for _, h := range histories {
		deleteImageFile(h.ImageURL)
	}

	// 批量标记为已删除（保留数据库记录）
	result := config.DB.Model(&models.GenerationHistory{}).
		Where("created_at >= ? AND created_at < ?", startOfDay, endOfDay).
		Update("image_deleted", true)

	if result.Error != nil {
		c.JSON(500, gin.H{"error": "更新记录失败"})
		return
	}

	c.JSON(200, gin.H{
		"message": "删除成功",
		"deleted": result.RowsAffected,
	})
}
