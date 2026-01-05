package handlers

import (
	"crypto/tls"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"sigma/config"
	"time"

	"github.com/gin-gonic/gin"
)

// 平台配置（加密存储）
type platformConfig struct {
	BaseURL string
	User    string
	Key     string
}

// VectorEngine 平台配置
var vectorEngineConfig = platformConfig{
	BaseURL: "https://api.vectorengine.ai",
	User:    decodeHex("313432353338"),
	Key:     decodeHex("5378704f347473773035676e356963454b7942623469534b66452f593354456a"),
}

// Aiaimi 平台配置
var aiaimiConfig = platformConfig{
	BaseURL: "https://aiaimi.cc",
	User:    decodeHex("33"),                                                       // "3"
	Key:     decodeHex("77485a584d356f6e63674a6e6d444f7776473842696a58756e42584d"), // "wHZXM5oncgJnmDOwvG8BijXunBXM"
}

// decodeHex 解码十六进制字符串
func decodeHex(hexStr string) string {
	bytes, err := hex.DecodeString(hexStr)
	if err != nil {
		return ""
	}
	return string(bytes)
}

// TokenValidationResult 验证结果
type TokenValidationResult struct {
	Valid    bool
	Name     string
	Remain   float64
	Used     float64
	Platform string // 内部使用，不暴露给前端
}

// CheckConfigHandler 检查配置 Handler
func CheckConfigHandler(c *gin.Context) {
	apiKey := config.GetAPIToken()
	hasAPIKey := apiKey != ""
	maskedKey := ""
	fullMaskedKey := "" // 显示更多字符的版本
	if hasAPIKey && len(apiKey) > 8 {
		// 显示前8位和后8位，中间用 * 替代
		maskedKey = apiKey[:8] + "****" + apiKey[len(apiKey)-8:]
		// 完整显示版本（只遮蔽中间4位）
		if len(apiKey) > 12 {
			// 计算中间遮蔽的位置
			midStart := len(apiKey)/2 - 2
			midEnd := len(apiKey)/2 + 2
			fullMaskedKey = apiKey[:midStart] + "****" + apiKey[midEnd:]
		} else {
			fullMaskedKey = apiKey // 如果 Key 很短，直接显示完整
		}
	} else if hasAPIKey {
		maskedKey = "****"
		fullMaskedKey = apiKey
	}

	// 获取当前 Key 的余额信息
	var remain float64 = 0
	var used float64 = 0
	var tokenName string = ""
	if hasAPIKey {
		result := validateApiKeyAllPlatforms(apiKey)
		if result.Valid {
			remain = result.Remain
			used = result.Used
			tokenName = result.Name
		}
	}

	c.JSON(200, gin.H{
		"has_api_key":       hasAPIKey,
		"masked_key":        maskedKey,
		"full_masked_key":   fullMaskedKey,
		"raw_key":           apiKey, // 完整 key，用于复制功能
		"disclaimer_agreed": config.GetDisclaimerAgreed(),
		"remain":            remain,
		"used":              used,
		"token_name":        tokenName,
	})
}

// ValidateApiKeyHandler 验证 API Key 是否有效
func ValidateApiKeyHandler(c *gin.Context) {
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

	// 调用验证服务检查 Key 是否有效（自动尝试所有平台）
	result := validateApiKeyAllPlatforms(req.ApiKey)
	if !result.Valid {
		c.JSON(400, gin.H{
			"valid": false,
			"error": "无效的 API Key 或未找到数据",
		})
		return
	}

	c.JSON(200, gin.H{
		"valid":  true,
		"name":   result.Name,
		"remain": result.Remain,
		"used":   result.Used,
	})
}

// validateApiKeyAllPlatforms 自动尝试所有平台验证 API Key
func validateApiKeyAllPlatforms(apiKey string) TokenValidationResult {
	// 1. 尝试 VectorEngine
	result := checkVectorEngine(apiKey)
	if result.Valid {
		return result
	}

	// 2. 如果失败，尝试 Aiaimi
	result = checkAiaimi(apiKey)
	if result.Valid {
		return result
	}

	// 3. 都失败了
	return TokenValidationResult{Valid: false}
}

// checkVectorEngine 验证 VectorEngine 平台的 API Key
func checkVectorEngine(apiKey string) TokenValidationResult {
	url := fmt.Sprintf("%s/api/token/search?keyword=&token=%s", vectorEngineConfig.BaseURL, apiKey)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return TokenValidationResult{Valid: false}
	}

	// 设置验证头
	req.Header.Set("new-api-user", vectorEngineConfig.User)
	req.Header.Set("Authorization", vectorEngineConfig.Key)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return TokenValidationResult{Valid: false}
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return TokenValidationResult{Valid: false}
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return TokenValidationResult{Valid: false}
	}

	// 解析响应
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return TokenValidationResult{Valid: false}
	}

	if result["success"] != true {
		return TokenValidationResult{Valid: false}
	}

	dataList, ok := result["data"].([]interface{})
	if !ok || len(dataList) == 0 {
		return TokenValidationResult{Valid: false}
	}

	info := dataList[0].(map[string]interface{})

	// VectorEngine 算法
	remainQuota := 0.0
	usedQuota := 0.0
	if v, ok := info["remain_quota"].(float64); ok {
		remainQuota = v
	}
	if v, ok := info["used_quota"].(float64); ok {
		usedQuota = v
	}

	remainSheets := math.Round(remainQuota / 1000000.0 / 0.265)
	usedSheets := math.Round(usedQuota / 1000000.0 / 0.265)

	name := "未命名"
	if n, ok := info["name"].(string); ok && n != "" {
		name = n
	}

	return TokenValidationResult{
		Valid:    true,
		Name:     name,
		Remain:   remainSheets,
		Used:     usedSheets,
		Platform: "vectorengine",
	}
}

// checkAiaimi 验证 Aiaimi 平台的 API Key
func checkAiaimi(apiKey string) TokenValidationResult {
	url := fmt.Sprintf("%s/api/token/search?keyword=&token=%s", aiaimiConfig.BaseURL, apiKey)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return TokenValidationResult{Valid: false}
	}

	// 设置验证头
	req.Header.Set("New-Api-User", aiaimiConfig.User)
	req.Header.Set("Authorization", aiaimiConfig.Key)

	// Aiaimi 需要跳过 TLS 验证
	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	client := &http.Client{
		Transport: tr,
		Timeout:   8 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return TokenValidationResult{Valid: false}
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return TokenValidationResult{Valid: false}
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return TokenValidationResult{Valid: false}
	}

	// 解析响应
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return TokenValidationResult{Valid: false}
	}

	if result["success"] != true {
		return TokenValidationResult{Valid: false}
	}

	dataList, ok := result["data"].([]interface{})
	if !ok || len(dataList) == 0 {
		return TokenValidationResult{Valid: false}
	}

	info := dataList[0].(map[string]interface{})

	// Aiaimi 算法
	remainQuota := 0.0
	usedQuota := 0.0
	if v, ok := info["remain_quota"].(float64); ok {
		remainQuota = v
	}
	if v, ok := info["used_quota"].(float64); ok {
		usedQuota = v
	}

	remainSheets := (remainQuota / 500000.0) / 1.5
	usedSheets := (usedQuota / 500000.0) / 1.5

	name := "未命名"
	if n, ok := info["name"].(string); ok && n != "" {
		name = n
	}

	return TokenValidationResult{
		Valid:    true,
		Name:     name,
		Remain:   remainSheets,
		Used:     usedSheets,
		Platform: "aiaimi",
	}
}

// SetApiKeyHandler 设置 API Key Handler
func SetApiKeyHandler(c *gin.Context) {
	type Request struct {
		ApiKey       string `json:"api_key"`
		SkipValidate bool   `json:"skip_validate"` // 是否跳过验证（用于已验证过的情况）
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

	// 验证 Key 并获取平台信息
	var platform config.PlatformType = config.PlatformVectorEngine

	if !req.SkipValidate {
		result := validateApiKeyAllPlatforms(req.ApiKey)
		if !result.Valid {
			c.JSON(400, gin.H{"error": "无效的 API Key"})
			return
		}
		// 根据验证结果设置平台
		platform = config.PlatformType(result.Platform)
		if !config.IsProduction {
			fmt.Printf("[SetApiKey] 验证模式 - 检测到平台: %s\n", platform)
		}
	} else {
		// 跳过验证时，仍然需要检测平台
		result := validateApiKeyAllPlatforms(req.ApiKey)
		if result.Valid {
			platform = config.PlatformType(result.Platform)
			if !config.IsProduction {
				fmt.Printf("[SetApiKey] 跳过验证模式 - 检测到平台: %s\n", platform)
			}
		} else {
			if !config.IsProduction {
				fmt.Printf("[SetApiKey] 跳过验证模式 - 平台检测失败，使用默认: %s\n", platform)
			}
		}
	}

	// 更新内存并持久化到数据库（包含平台信息）
	config.SetAPITokenWithPlatform(req.ApiKey, platform)
	if !config.IsProduction {
		fmt.Printf("[SetApiKey] API Key 已保存，平台: %s, 当前 AI URL: %s\n", platform, config.GetCurrentAIServiceURL())
	}

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

// AutoDetectAndSetPlatform 自动检测 API Key 的平台并设置
// 用于老版本迁移后自动识别平台
func AutoDetectAndSetPlatform(apiKey string) {
	if apiKey == "" {
		return
	}

	result := validateApiKeyAllPlatforms(apiKey)
	if result.Valid && result.Platform != "" {
		platform := config.PlatformType(result.Platform)
		if platform != config.GetAPIPlatform() {
			if !config.IsProduction {
				fmt.Printf("[AutoDetect] 检测到平台: %s，更新配置\n", platform)
			}
			config.SetAPIPlatform(platform)
			// 保存到数据库
			config.SavePersistentConfig()
		} else {
			if !config.IsProduction {
				fmt.Printf("[AutoDetect] 平台已正确设置: %s\n", platform)
			}
		}
	} else {
		if !config.IsProduction {
			fmt.Println("[AutoDetect] 无法检测平台，保持默认设置")
		}
	}
}
