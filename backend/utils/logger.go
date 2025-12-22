package utils

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"
)

var (
	// APILogger 专用于 API 日志的记录器
	APILogger     *log.Logger
	apiLoggerOnce sync.Once
	apiLogFile    *os.File
	// apiLogEnabled 控制是否启用 API 日志（默认禁用）
	apiLogEnabled = false
)

// isProduction 检查是否为生产环境
func isProduction() bool {
	// 通过环境变量判断
	prod := os.Getenv("PRODUCTION")
	return prod == "true" || prod == "1"
}

// initAPILogger 初始化 API 日志记录器（默认禁用）
func initAPILogger() {
	apiLoggerOnce.Do(func() {
		// 检查是否启用 API 日志
		enableLog := os.Getenv("ENABLE_API_LOG")
		if enableLog == "true" || enableLog == "1" {
			apiLogEnabled = true
		}
		
		if !apiLogEnabled {
			return
		}
		
		logDir := os.Getenv("LOG_DIR")
		if logDir == "" {
			logDir = "./logs"
		}
		
		// 确保日志目录存在
		os.MkdirAll(logDir, 0755)
		
		logPath := filepath.Join(logDir, "api.log")
		var err error
		apiLogFile, err = os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
		if err != nil {
			// 如果无法创建日志文件，使用标准输出
			APILogger = log.New(os.Stdout, "[API] ", log.LstdFlags|log.Lmicroseconds)
			return
		}
		
		APILogger = log.New(apiLogFile, "[API] ", log.LstdFlags|log.Lmicroseconds)
	})
}

// LogAPI 记录 API 日志（默认禁用，通过 ENABLE_API_LOG=true 启用）
func LogAPI(format string, args ...interface{}) {
	initAPILogger()
	if apiLogEnabled && APILogger != nil {
		APILogger.Printf(format, args...)
	}
}

// maskSensitiveURL 将敏感 URL 替换为伪装 URL（用于日志显示）
func maskSensitiveURL(url string) string {
	// 替换真实 API 地址为伪装地址
	// 注意：顺序很重要，长字符串要先替换
	sensitiveURLs := []struct {
		sensitive string
		masked    string
	}{
		// 完整 URL 替换（将真实 API 地址替换为伪装地址）
		{"https://api.vectorengine.ai/v1beta/models/gemini-3-pro-image-preview:generateContent", "https://api.sigma.ai/v1beta/models/sigma-image:generateContent"},
		{"https://api.vectorengine.ai/v1beta/models/gemini-2.5-image-preview:generateContent", "https://api.sigma.ai/v1beta/models/sigma-dev-image:generateContent"},
		// 域名替换
		{"api.vectorengine.ai", "api.sigma.ai"},
		// 模型名称替换（用于响应中的 modelVersion 字段，将真实模型名替换为伪装名）
		{"gemini-3-pro-image-preview", "sigma-image"},
		{"gemini-2.5-image-preview", "sigma-dev-image"},
		// 通用敏感词替换
		{"gemini", "sigma"},
	}
	
	result := url
	for _, item := range sensitiveURLs {
		if len(item.sensitive) > 0 {
			result = replaceAll(result, item.sensitive, item.masked)
		}
	}
	return result
}

// replaceAll 替换字符串中所有匹配项
func replaceAll(s, old, new string) string {
	for {
		idx := indexOf(s, old)
		if idx == -1 {
			break
		}
		s = s[:idx] + new + s[idx+len(old):]
	}
	return s
}

// indexOf 查找子字符串位置
func indexOf(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}

// LogAPIRequest 记录 API 请求详情（默认禁用）
func LogAPIRequest(method, url string, body interface{}) {
	initAPILogger()
	if !apiLogEnabled || APILogger == nil {
		return
	}
	
	// 伪装敏感 URL
	maskedURL := maskSensitiveURL(url)
	
	APILogger.Printf("========== API REQUEST ==========")
	APILogger.Printf("Time: %s", time.Now().Format("2006-01-02 15:04:05.000"))
	APILogger.Printf("Method: %s", method)
	APILogger.Printf("URL: %s", maskedURL)
	
	if body != nil {
		// 序列化并清理敏感数据
		b, _ := json.Marshal(body)
		var genericData interface{}
		json.Unmarshal(b, &genericData)
		cleanedData := RecursivelyMaskBase64(genericData)
		prettyBytes, _ := json.MarshalIndent(cleanedData, "", "  ")
		APILogger.Printf("Body:\n%s", string(prettyBytes))
	}
	APILogger.Printf("=================================")
}

// LogAPIResponse 记录 API 响应详情（默认禁用）
func LogAPIResponse(statusCode int, duration time.Duration, body interface{}, err error) {
	initAPILogger()
	if !apiLogEnabled || APILogger == nil {
		return
	}
	
	APILogger.Printf("========== API RESPONSE ==========")
	APILogger.Printf("Time: %s", time.Now().Format("2006-01-02 15:04:05.000"))
	APILogger.Printf("Status Code: %d", statusCode)
	APILogger.Printf("Duration: %v", duration)
	
	if err != nil {
		// 伪装错误信息中的敏感 URL
		maskedErr := maskSensitiveURL(err.Error())
		APILogger.Printf("Error: %s", maskedErr)
	}
	
	if body != nil {
		// 序列化并清理敏感数据
		b, _ := json.Marshal(body)
		var genericData interface{}
		json.Unmarshal(b, &genericData)
		cleanedData := RecursivelyMaskBase64(genericData)
		prettyBytes, _ := json.MarshalIndent(cleanedData, "", "  ")
		APILogger.Printf("Body:\n%s", string(prettyBytes))
	}
	APILogger.Printf("==================================")
}

// CloseAPILogger 关闭 API 日志文件
func CloseAPILogger() {
	if apiLogFile != nil {
		apiLogFile.Close()
	}
}

// RecursivelyMaskBase64 递归清理日志中的 Base64 数据和敏感模型名称
func RecursivelyMaskBase64(data interface{}) interface{} {
	switch v := data.(type) {
	case map[string]interface{}:
		newMap := make(map[string]interface{})
		for k, val := range v {
			// 处理 base64 图片数据字段
			if k == "data" || k == "Data" || k == "b64_json" || k == "base64" {
				if s, ok := val.(string); ok && len(s) > 100 {
					newMap[k] = fmt.Sprintf("[BASE64_IMAGE_PLACEHOLDER length=%d]", len(s))
					continue
				}
			}
			// 处理 thoughtSignature 字段（也是 base64 编码的长字符串）
			if k == "thoughtSignature" {
				if s, ok := val.(string); ok && len(s) > 100 {
					newMap[k] = fmt.Sprintf("[THOUGHT_SIGNATURE_PLACEHOLDER length=%d]", len(s))
					continue
				}
			}
			// 处理 modelVersion 字段（替换敏感模型名称）
			if k == "modelVersion" {
				if s, ok := val.(string); ok {
					newMap[k] = maskSensitiveURL(s)
					continue
				}
			}
			newMap[k] = RecursivelyMaskBase64(val)
		}
		return newMap
	case []interface{}:
		newSlice := make([]interface{}, len(v))
		for i, val := range v {
			newSlice[i] = RecursivelyMaskBase64(val)
		}
		return newSlice
	case string:
		// 对字符串值也进行敏感词替换
		return maskSensitiveURL(v)
	default:
		return v
	}
}

// LogJSON 辅助打印函数 (生产环境不输出)
func LogJSON(title string, v interface{}) {
	if isProduction() {
		return
	}
	b, _ := json.Marshal(v)
	var genericData interface{}
	json.Unmarshal(b, &genericData)
	cleanedData := RecursivelyMaskBase64(genericData)
	prettyBytes, _ := json.MarshalIndent(cleanedData, "", "  ")
	fmt.Printf("\n====== [%s] ======\n%s\n================================\n", title, string(prettyBytes))
}

// ---------------------------------------------------------------------------
// 以下是修改后的结构打印逻辑
// ---------------------------------------------------------------------------

// LogResponseStructure 打印响应的结构（生产环境不输出）
func LogResponseStructure(title string, data interface{}) {
	if isProduction() {
		return
	}
	// 1. 标准化为 interface{} (处理 struct 等情况)
	b, _ := json.Marshal(data)
	var genericData interface{}
	json.Unmarshal(b, &genericData)

	// 2. 转换为仅包含类型的结构
	structureData := mapToTypeStructure(genericData)

	// 3. 格式化打印
	prettyBytes, _ := json.MarshalIndent(structureData, "", "  ")
	fmt.Printf("\n====== [%s (Structure Only)] ======\n%s\n================================\n", title, string(prettyBytes))
}

// LogResponseStructureWithStatus 打印响应的结构（生产环境不输出）
func LogResponseStructureWithStatus(title string, data interface{}, statusCode int) {
	if isProduction() {
		return
	}
	// 1. 标准化
	b, _ := json.Marshal(data)
	var genericData interface{}
	json.Unmarshal(b, &genericData)

	// 2. 转换结构
	structureData := mapToTypeStructure(genericData)

	// 3. 格式化打印
	prettyBytes, _ := json.MarshalIndent(structureData, "", "  ")
	fmt.Printf("\n====== [%s (Structure Only)] ======\nHTTP Status Code: %d\n%s\n================================\n", title, statusCode, string(prettyBytes))
}

// mapToTypeStructure 递归将值转换为类型描述
// parentKey 用于判断特殊字段
func mapToTypeStructure(data interface{}) interface{} {
	return mapToTypeStructureWithKey(data, "")
}

// mapToTypeStructureWithKey 递归将值转换为类型描述，带有父级 key 信息
func mapToTypeStructureWithKey(data interface{}, key string) interface{} {
	switch v := data.(type) {
	case map[string]interface{}:
		newMap := make(map[string]interface{})
		for k, val := range v {
			newMap[k] = mapToTypeStructureWithKey(val, k)
		}
		return newMap
	case []interface{}:
		// 数组处理策略：
		// 如果数组为空，返回 "Array(Empty)" 或空数组
		// 如果数组有内容，只提取第 0 个元素的结构，代表 Array<Type>，减少日志体积
		if len(v) > 0 {
			return []interface{}{mapToTypeStructureWithKey(v[0], "")}
		}
		return []interface{}{"empty_array"}
	case string:
		// 对特殊字段使用占位符
		if key == "text" {
			return "[TEXT_CONTENT]"
		}
		return "string"
	case float64:
		// JSON 中的数字在 Go interface{} 中通常是 float64
		return "number"
	case bool:
		// 对 thought 字段使用占位符
		if key == "thought" {
			return "[THOUGHT_FLAG]"
		}
		return "boolean"
	case nil:
		return "null"
	default:
		// 处理未知类型
		return fmt.Sprintf("unknown_type(%T)", v)
	}
}