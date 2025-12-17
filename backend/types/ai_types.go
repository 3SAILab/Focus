package types

// AIRequest AI API 请求结构体
type AIRequest struct {
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

// AIResponse AI API 响应结构体
type AIResponse struct {
	Candidates []struct {
		Content struct {
			Parts []Part `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
}

