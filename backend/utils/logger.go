package utils

import (
	"encoding/json"
	"fmt"
)

// RecursivelyMaskBase64 递归清理日志中的 Base64
func RecursivelyMaskBase64(data interface{}) interface{} {
	switch v := data.(type) {
	case map[string]interface{}:
		newMap := make(map[string]interface{})
		for k, val := range v {
			// 核心逻辑：如果 key 是 data/Data/b64_json 且值是长字符串，则屏蔽
			if k == "data" || k == "Data" || k == "b64_json" || k == "base64" {
				if s, ok := val.(string); ok && len(s) > 100 {
					newMap[k] = fmt.Sprintf("[BASE64_IMAGE_PLACEHOLDER length=%d]", len(s))
					continue
				}
			}
			// 递归处理子元素
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

// LogJSON 辅助打印函数
func LogJSON(title string, v interface{}) {
	// 1. 先转成 JSON bytes (如果是 struct)
	b, _ := json.Marshal(v)

	// 2. 反序列化为 map/interface{} 以便进行通用处理
	var genericData interface{}
	json.Unmarshal(b, &genericData)

	// 3. 递归清洗 Base64
	cleanedData := RecursivelyMaskBase64(genericData)

	// 4. 格式化打印
	prettyBytes, _ := json.MarshalIndent(cleanedData, "", "  ")
	fmt.Printf("\n====== [%s] ======\n%s\n================================\n", title, string(prettyBytes))
}



// LogResponseStructure 打印响应的结构（只显示 key 和类型，不显示值）
func LogResponseStructure(title string, data interface{}) {
	structure := getStructure(data, "")
	fmt.Printf("\n====== [%s] ======\n%s\n================================\n", title, structure)
}

// getStructure 递归获取数据结构
func getStructure(data interface{}, prefix string) string {
	result := ""
	switch v := data.(type) {
	case map[string]interface{}:
		for k, val := range v {
			currentPath := prefix + "." + k
			if prefix == "" {
				currentPath = k
			}
			switch innerVal := val.(type) {
			case map[string]interface{}:
				result += fmt.Sprintf("%s: object\n", currentPath)
				result += getStructure(innerVal, currentPath)
			case []interface{}:
				result += fmt.Sprintf("%s: array[%d]\n", currentPath, len(innerVal))
				if len(innerVal) > 0 {
					result += getStructure(innerVal[0], currentPath+"[0]")
				}
			case string:
				if len(innerVal) > 100 {
					result += fmt.Sprintf("%s: string (length=%d)\n", currentPath, len(innerVal))
				} else {
					result += fmt.Sprintf("%s: string = \"%s\"\n", currentPath, innerVal)
				}
			case float64:
				result += fmt.Sprintf("%s: number = %v\n", currentPath, innerVal)
			case bool:
				result += fmt.Sprintf("%s: bool = %v\n", currentPath, innerVal)
			case nil:
				result += fmt.Sprintf("%s: null\n", currentPath)
			default:
				result += fmt.Sprintf("%s: %T\n", currentPath, innerVal)
			}
		}
	case []interface{}:
		if len(v) > 0 {
			result += getStructure(v[0], prefix+"[0]")
		}
	}
	return result
}
