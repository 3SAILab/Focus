package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"sigma/config"
	"sigma/utils"
)

// BalanceWarningThreshold 余额警告阈值
const BalanceWarningThreshold = 2.0

// SubscriptionResponse VectorEngine 订阅 API 响应
type SubscriptionResponse struct {
	HardLimitUSD float64 `json:"hard_limit_usd"`
}

// UsageResponse VectorEngine 使用量 API 响应
type UsageResponse struct {
	TotalUsage float64 `json:"total_usage"`
}

// BalanceResponse 余额查询响应
type BalanceResponse struct {
	LowBalance bool `json:"lowBalance"`
}

// CalculateBalance 计算余额
// balance = hard_limit_usd - (total_usage / 100)
func CalculateBalance(hardLimitUSD, totalUsage float64) float64 {
	return hardLimitUSD - (totalUsage / 100)
}

// IsLowBalance 判断是否低于阈值
func IsLowBalance(balance float64) bool {
	return balance < BalanceWarningThreshold
}

// CheckBalanceHandler 余额查询 Handler
// GET /api/balance
func CheckBalanceHandler(c *gin.Context) {
	// 获取 API Token
	apiToken := config.GetAPIToken()
	if apiToken == "" {
		// 没有配置 API Key，静默返回非低余额状态
		c.JSON(200, BalanceResponse{LowBalance: false})
		return
	}

	// API 基础 URL
	apiDomain := "https://api.vectorengine.ai"

	// 获取订阅信息
	hardLimitUSD, err := fetchSubscription(apiDomain, apiToken)
	if err != nil {
		// 查询失败，静默处理，返回非低余额状态
		utils.LogAPI("余额查询 - 获取订阅信息失败: %v", err)
		c.JSON(200, BalanceResponse{LowBalance: false})
		return
	}

	// 获取使用量信息
	totalUsage, err := fetchUsage(apiDomain, apiToken)
	if err != nil {
		// 查询失败，静默处理，返回非低余额状态
		utils.LogAPI("余额查询 - 获取使用量失败: %v", err)
		c.JSON(200, BalanceResponse{LowBalance: false})
		return
	}

	// 计算余额
	balance := CalculateBalance(hardLimitUSD, totalUsage)
	lowBalance := IsLowBalance(balance)

	utils.LogAPI("余额查询 - 总额度: %.2f, 已使用: %.2f, 剩余: %.2f, 低余额: %v",
		hardLimitUSD, totalUsage/100, balance, lowBalance)

	c.JSON(200, BalanceResponse{LowBalance: lowBalance})
}

// fetchSubscription 获取订阅信息
func fetchSubscription(apiDomain, apiToken string) (float64, error) {
	url := fmt.Sprintf("%s/v1/dashboard/billing/subscription", apiDomain)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return 0, fmt.Errorf("创建请求失败: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+apiToken)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return 0, fmt.Errorf("请求失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return 0, fmt.Errorf("API 返回错误状态码: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, fmt.Errorf("读取响应失败: %w", err)
	}

	var subResp SubscriptionResponse
	if err := json.Unmarshal(body, &subResp); err != nil {
		return 0, fmt.Errorf("解析响应失败: %w", err)
	}

	return subResp.HardLimitUSD, nil
}

// fetchUsage 获取使用量信息
func fetchUsage(apiDomain, apiToken string) (float64, error) {
	// 计算日期范围：从 2023-01-01 到明天
	tomorrow := time.Now().AddDate(0, 0, 1).Format("2006-01-02")
	url := fmt.Sprintf("%s/v1/dashboard/billing/usage?start_date=2023-01-01&end_date=%s", apiDomain, tomorrow)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return 0, fmt.Errorf("创建请求失败: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+apiToken)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return 0, fmt.Errorf("请求失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return 0, fmt.Errorf("API 返回错误状态码: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, fmt.Errorf("读取响应失败: %w", err)
	}

	var usageResp UsageResponse
	if err := json.Unmarshal(body, &usageResp); err != nil {
		return 0, fmt.Errorf("解析响应失败: %w", err)
	}

	return usageResp.TotalUsage, nil
}
