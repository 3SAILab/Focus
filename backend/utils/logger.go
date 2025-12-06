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
			// 核心逻辑：如果 key 是 data 且值是长字符串，则屏蔽
			if k == "data" {
				if s, ok := val.(string); ok && len(s) > 100 {
					newMap[k] = fmt.Sprintf("[BASE64_DATA_MASKED_LENGTH_%d]", len(s))
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

