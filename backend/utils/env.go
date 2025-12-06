package utils

import (
	"fmt"
	"os"
	"strings"
)

// GetEnvOrDefault 获取环境变量或返回默认值
func GetEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// GetBaseURL 获取基础 URL（用于生成图片和参考图的访问路径）
func GetBaseURL(port string) string {
	baseURL := os.Getenv("BASE_URL")
	if baseURL == "" {
		return fmt.Sprintf("http://localhost:%s", port)
	}
	return baseURL
}

// UpdateEnvFile 更新 .env 文件的辅助函数
func UpdateEnvFile(key, value string) error {
	content, err := os.ReadFile(".env")
	if err != nil {
		// 如果文件不存在，直接创建
		return os.WriteFile(".env", []byte(fmt.Sprintf("%s=%s", key, value)), 0644)
	}

	lines := strings.Split(string(content), "\n")
	found := false
	for i, line := range lines {
		if strings.HasPrefix(strings.TrimSpace(line), key+"=") {
			lines[i] = fmt.Sprintf("%s=%s", key, value)
			found = true
			break
		}
	}

	if !found {
		lines = append(lines, fmt.Sprintf("%s=%s", key, value))
	}

	output := strings.Join(lines, "\n")
	return os.WriteFile(".env", []byte(output), 0644)
}

