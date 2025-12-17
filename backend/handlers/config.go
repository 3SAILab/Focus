package handlers

import (
	"sigma/config"

	"github.com/gin-gonic/gin"
)

// CheckConfigHandler 检查配置 Handler
func CheckConfigHandler(c *gin.Context) {
	apiKey := config.GetAPIToken()
	hasAPIKey := apiKey != ""
	maskedKey := ""
	if hasAPIKey && len(apiKey) > 8 {
		// 显示前4位和后4位，中间用 * 替代
		maskedKey = apiKey[:4] + "****" + apiKey[len(apiKey)-4:]
	} else if hasAPIKey {
		maskedKey = "****"
	}
	c.JSON(200, gin.H{
		"has_api_key":        hasAPIKey,
		"masked_key":         maskedKey,
		"disclaimer_agreed":  config.GetDisclaimerAgreed(),
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

	// 更新内存并持久化到 config.json
	config.SetAPIToken(req.ApiKey)

	c.JSON(200, gin.H{"status": "success"})
}

// SetDisclaimerHandler 设置免责声明同意状态 Handler
func SetDisclaimerHandler(c *gin.Context) {
	type Request struct {
		Agreed bool `json:"agreed"`
	}
	var req Request
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "参数错误"})
		return
	}

	// 更新内存并持久化到 config.json
	config.SetDisclaimerAgreed(req.Agreed)

	c.JSON(200, gin.H{"status": "success", "agreed": req.Agreed})
}
