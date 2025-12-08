package utils

import (
	"encoding/json"
	"fmt"
	"os"
)

// isProduction 检查是否为生产环境
func isProduction() bool {
	// 通过环境变量判断
	prod := os.Getenv("PRODUCTION")
	if prod == "true" || prod == "1" {
		return true
	}
	// 如果启用了 TLS，也认为是生产环境
	if os.Getenv("TLS_CERT_PATH") != "" && os.Getenv("TLS_KEY_PATH") != "" {
		return true
	}
	return false
}

// RecursivelyMaskBase64 递归清理日志中的 Base64 (保持你原有的逻辑不变)
func RecursivelyMaskBase64(data interface{}) interface{} {
	switch v := data.(type) {
	case map[string]interface{}:
		newMap := make(map[string]interface{})
		for k, val := range v {
			if k == "data" || k == "Data" || k == "b64_json" || k == "base64" {
				if s, ok := val.(string); ok && len(s) > 100 {
					newMap[k] = fmt.Sprintf("[BASE64_IMAGE_PLACEHOLDER length=%d]", len(s))
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