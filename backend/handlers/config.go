package handlers

import (
	"log"

	"sigma/config"
	"sigma/utils"

	"github.com/gin-gonic/gin"
)

// CheckConfigHandler 检查配置 Handler
func CheckConfigHandler(c *gin.Context) {
	hasAPIKey := config.GetAPIToken() != ""
	c.JSON(200, gin.H{
		"has_api_key": hasAPIKey,
	})
}

// SetApiKeyHandler 设置 API Key Handler
func SetApiKeyHandler(c *gin.Context) {
	type Request struct {
		ApiKey string `json:"api_key"`
	}
	var req Request
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "参数错误"})
		return
	}

	if req.ApiKey == "" {
		c.JSON(400, gin.H{"error": "API Key 不能为空"})
		return
	}

	// 1. 更新内存
	config.SetAPIToken(req.ApiKey)

	// 2. 更新文件
	if err := utils.UpdateEnvFile("API_KEY", req.ApiKey); err != nil {
		log.Printf("写入 .env 失败: %v", err)
		// 注意：即使写入文件失败，内存已更新，当前会话可用，所以不阻断返回
	}

	c.JSON(200, gin.H{"status": "success"})
}
