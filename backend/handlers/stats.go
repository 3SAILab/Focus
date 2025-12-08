package handlers

import (
	"github.com/gin-gonic/gin"
	"sigma/config"
	"sigma/models"
)

// GetGenerationCountHandler 获取生成计数
func GetGenerationCountHandler(c *gin.Context) {
	var stats models.GenerationStats
	
	// 尝试获取统计记录，如果不存在则创建
	result := config.DB.First(&stats)
	if result.Error != nil {
		// 记录不存在，创建新记录
		stats = models.GenerationStats{TotalCount: 0}
		config.DB.Create(&stats)
	}
	
	c.JSON(200, models.GenerationStatsResponse{
		TotalCount: stats.TotalCount,
	})
}

// IncrementGenerationCountHandler 增加生成计数
func IncrementGenerationCountHandler(c *gin.Context) {
	var stats models.GenerationStats
	
	// 尝试获取统计记录
	result := config.DB.First(&stats)
	if result.Error != nil {
		// 记录不存在，创建新记录并设置计数为1
		stats = models.GenerationStats{TotalCount: 1}
		config.DB.Create(&stats)
	} else {
		// 记录存在，增加计数
		stats.TotalCount++
		config.DB.Save(&stats)
	}
	
	c.JSON(200, models.GenerationStatsResponse{
		TotalCount: stats.TotalCount,
	})
}
