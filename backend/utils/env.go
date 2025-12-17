package utils

import (
	"fmt"
	"os"
)

// GetEnvOrDefault 获取环境变量或返回默认值
func GetEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// GetBaseURL 获取基础 URL（用于生成图片和参考图的访问路径）
// 注意：port 参数已废弃，现在使用 config.ActualPort
func GetBaseURL(port string) string {
	baseURL := os.Getenv("BASE_URL")
	if baseURL != "" {
		return baseURL
	}
	
	// 优先使用实际运行端口
	actualPort := os.Getenv("ACTUAL_PORT")
	if actualPort != "" {
		return fmt.Sprintf("http://localhost:%s", actualPort)
	}
	
	// 回退到传入的端口
	return fmt.Sprintf("http://localhost:%s", port)
}
