package utils

import (
	"encoding/json"
	"fmt"
	"os"
	"regexp"
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
// 优先级：BASE_URL 环境变量 > ACTUAL_PORT > config.ActualPort > 传入的 port 参数
func GetBaseURL(port string) string {
	baseURL := os.Getenv("BASE_URL")
	if baseURL != "" {
		return baseURL
	}

	// 优先使用实际运行端口（环境变量）
	actualPort := os.Getenv("ACTUAL_PORT")
	if actualPort != "" {
		return fmt.Sprintf("http://localhost:%s", actualPort)
	}

	// 回退到传入的端口
	return fmt.Sprintf("http://localhost:%s", port)
}

// ToRelativePath 将完整 URL 转换为相对路径
// 例如: http://localhost:8080/images/gen_123.png -> images/gen_123.png
// 例如: https://localhost:8080/uploads/ref_123.png -> uploads/ref_123.png
// 如果已经是相对路径，则直接返回
func ToRelativePath(url string) string {
	if url == "" {
		return ""
	}

	// 如果已经是相对路径（不以 http 开头），直接返回
	if !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") {
		return url
	}

	// 使用正则匹配 http(s)://host:port/路径 或 http(s)://host/路径
	re := regexp.MustCompile(`^https?://[^/]+/(.+)$`)
	matches := re.FindStringSubmatch(url)
	if len(matches) >= 2 {
		return matches[1]
	}

	return url
}

// ToAbsoluteURL 将相对路径转换为完整 URL（使用当前端口和协议）
// 例如: images/gen_123.png -> http://localhost:8080/images/gen_123.png
// 如果已经是完整 URL，则转换为当前配置的协议和端口
func ToAbsoluteURL(path string, port string) string {
	if path == "" {
		return ""
	}

	baseURL := GetBaseURL(port)

	// 如果已经是完整 URL，先转换为相对路径，再用当前 baseURL 重新拼接
	// 这样可以确保协议（http/https）和端口都是正确的
	if strings.HasPrefix(path, "http://") || strings.HasPrefix(path, "https://") {
		relativePath := ToRelativePath(path)
		if relativePath != path {
			// 成功提取了相对路径，使用当前 baseURL 重新拼接
			return fmt.Sprintf("%s/%s", baseURL, relativePath)
		}
		// 无法提取相对路径，返回原始 URL
		return path
	}

	// 相对路径，拼接 baseURL
	return fmt.Sprintf("%s/%s", baseURL, path)
}

// ConvertRefImagesJSON 转换 ref_images JSON 字符串中的 URL
// toRelative=true: 转换为相对路径（存储时使用）
// toRelative=false: 转换为绝对 URL（读取时使用）
func ConvertRefImagesJSON(refImagesJSON string, port string, toRelative bool) string {
	if refImagesJSON == "" || refImagesJSON == "null" || refImagesJSON == "[]" {
		return refImagesJSON
	}

	var urls []string
	if err := json.Unmarshal([]byte(refImagesJSON), &urls); err != nil {
		// 如果解析失败，可能是单个 URL 字符串
		return refImagesJSON
	}

	convertedURLs := make([]string, len(urls))
	for i, url := range urls {
		if toRelative {
			convertedURLs[i] = ToRelativePath(url)
		} else {
			convertedURLs[i] = ToAbsoluteURL(url, port)
		}
	}

	result, _ := json.Marshal(convertedURLs)
	return string(result)
}
