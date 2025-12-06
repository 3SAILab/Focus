package types

// GeminiRequest Gemini API 请求结构体
type GeminiRequest struct {
	Contents         []Content        `json:"contents"`
	GenerationConfig GenerationConfig `json:"generationConfig"`
}

// Content 内容结构体
type Content struct {
	Role  string `json:"role"`
	Parts []Part `json:"parts"`
}

// Part 部分结构体
type Part struct {
	Text       string      `json:"text,omitempty"`
	InlineData *InlineData `json:"inlineData,omitempty"`
}

// InlineData 内联数据结构体
type InlineData struct {
	MimeType string `json:"mimeType"`
	Data     string `json:"data"`
}

// GenerationConfig 生成配置
type GenerationConfig struct {
	ResponseModalities []string     `json:"responseModalities"`
	ImageConfig        *ImageConfig `json:"imageConfig,omitempty"`
}

// ImageConfig 图片配置
type ImageConfig struct {
	AspectRatio string `json:"aspectRatio"`
	ImageSize   string `json:"imageSize,omitempty"`
}

// GeminiResponse Gemini API 响应结构体
type GeminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []Part `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
}

// TargetAPIURL Gemini API 地址
const TargetAPIURL = "https://api.vectorengine.ai/v1beta/models/gemini-3-pro-image-preview:generateContent"

