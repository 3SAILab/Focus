package handlers

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"sigma/config"
	"sigma/models"
	"sigma/types"
	"sigma/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ImageResult 单张图片生成结果
type ImageResult struct {
	ImageURL string `json:"image_url,omitempty"`
	Error    string `json:"error,omitempty"`
	Index    int    `json:"index"`
}

// GenerateHandler 生成图片处理函数
func GenerateHandler(c *gin.Context) {
	// 检查并获取当前的 API Key
	currentToken := config.GetAPIToken()

	if currentToken == "" {
		c.JSON(401, gin.H{"error": "请先配置 API Key"})
		return
	}

	prompt := c.PostForm("prompt")
	if prompt == "" {
		prompt = "image"
	}

	aspectRatio := c.PostForm("aspectRatio")
	if aspectRatio == "" || aspectRatio == "智能" {
		aspectRatio = "1:1"
	}
	imageSize := c.PostForm("imageSize")
	if imageSize == "" {
		imageSize = "2K"
	}
	utils.LogAPI("接收到的 imageSize 参数: %s", imageSize)

	// 获取生成类型，默认为创作空间
	generationType := c.PostForm("type")
	if generationType == "" {
		generationType = models.GenerationTypeCreate
	}

	// 8.1: 解析 count 参数 (默认 1，最大 4)
	countStr := c.PostForm("count")
	count := 1
	if countStr != "" {
		if parsedCount, err := strconv.Atoi(countStr); err == nil {
			count = parsedCount
		}
	}
	// 限制 count 范围为 1-4
	if count < 1 {
		count = 1
	}
	if count > 4 {
		count = 4
	}

	parts := []types.Part{{Text: prompt}}
	var savedRefImages []string

	form, err := c.MultipartForm()
	if err == nil {
		for _, file := range form.File["images"] {
			src, err := file.Open()
			if err != nil {
				continue
			}
			fileBytes, _ := io.ReadAll(src)
			src.Close()

			base64Str := base64.StdEncoding.EncodeToString(fileBytes)
			mimeType := "image/jpeg"
			if strings.HasSuffix(strings.ToLower(file.Filename), ".png") {
				mimeType = "image/png"
			}
			parts = append(parts, types.Part{InlineData: &types.InlineData{MimeType: mimeType, Data: base64Str}})

			// 优化：在后台保存文件，不阻塞主流程
			refFileName := fmt.Sprintf("ref_%d_%s", time.Now().UnixNano(), file.Filename)
			savedRefImages = append(savedRefImages, fmt.Sprintf("uploads/%s", refFileName))

			// 复制文件字节，在后台保存（避免在 goroutine 中使用 gin.Context）
			fileBytesCopy := make([]byte, len(fileBytes))
			copy(fileBytesCopy, fileBytes)
			go func(data []byte, fileName string) {
				refFilePath := filepath.Join(config.UploadDir, fileName)
				if err := os.WriteFile(refFilePath, data, 0644); err != nil {
					utils.LogAPI("保存参考图失败: %v", err)
				}
			}(fileBytesCopy, refFileName)
		}
	}

	// 创建任务记录 - 在调用 AI API 之前
	taskID := uuid.New().String()
	refImagesJSON, _ := json.Marshal(savedRefImages)
	task := models.GenerationTask{
		TaskID:     taskID,
		Status:     models.TaskStatusProcessing,
		Type:       generationType,
		Prompt:     prompt,
		RefImages:  string(refImagesJSON),
		StartedAt:  time.Now(),
		ImageCount: count, // 保存请求的图片数量
	}
	if result := config.DB.Create(&task); result.Error != nil {
		c.JSON(500, gin.H{"error": "创建任务失败"})
		return
	}

	// 8.2: count=1 时保持现有逻辑（完全向后兼容）
	if count == 1 {
		generateSingleImage(c, currentToken, prompt, aspectRatio, imageSize, generationType, parts, savedRefImages, refImagesJSON, taskID, &task)
		return
	}

	// 8.3 & 8.4 & 8.5: count>1 时循环调用 AI API，返回 images 数组，存储多条历史记录
	generateMultipleImages(c, currentToken, prompt, aspectRatio, imageSize, generationType, parts, savedRefImages, refImagesJSON, taskID, &task, count)
}

// generateSingleImage 生成单张图片 - 异步模式
// 立即返回 task_id，在后台 goroutine 中处理 AI 请求
func generateSingleImage(c *gin.Context, currentToken, prompt, aspectRatio, imageSize, generationType string, parts []types.Part, savedRefImages []string, refImagesJSON []byte, taskID string, task *models.GenerationTask) {
	// 转换相对路径为完整 URL 返回给前端
	absoluteRefImages := make([]string, len(savedRefImages))
	for i, ref := range savedRefImages {
		absoluteRefImages[i] = utils.ToAbsoluteURL(ref, config.ServerPort)
	}

	// 立即返回 task_id，让前端可以开始轮询
	c.JSON(200, gin.H{
		"status":     "processing",
		"task_id":    taskID,
		"ref_images": absoluteRefImages,
	})

	// 在后台 goroutine 中处理 AI 请求
	go func() {
		processAIGeneration(currentToken, prompt, aspectRatio, imageSize, generationType, parts, refImagesJSON, taskID, task)
	}()
}

// isQuotaError 检查错误消息是否是余额不足错误
func isQuotaError(errorMessage string) bool {
	quotaKeywords := []string{
		"额度已用尽",
		"余额不足",
		"quota",
		"insufficient",
		"RemainQuota",
		"balance",
	}
	lowerMsg := strings.ToLower(errorMessage)
	for _, keyword := range quotaKeywords {
		if strings.Contains(lowerMsg, strings.ToLower(keyword)) {
			return true
		}
	}
	return false
}

// extractImageURLFromMarkdown 从 markdown 文本中提取图片 URL
// 支持格式:
// 1. ![image](https://...) - HTTP/HTTPS URL
// 2. ![image](data:image/jpeg;base64,...) - Base64 data URL
func extractImageURLFromMarkdown(text string) string {
	// 匹配 markdown 图片格式: ![...](URL)
	// 支持 http/https URL 和 data URL
	re := regexp.MustCompile(`!\[.*?\]\(((?:https?://[^\s\)]+|data:image/[^;]+;base64,[^\s\)]+))\)`)
	matches := re.FindStringSubmatch(text)
	if len(matches) > 1 {
		return matches[1]
	}
	return ""
}

// saveBase64Image 保存 base64 图片到本地
func saveBase64Image(dataURL string) (string, error) {
	utils.LogAPI("开始处理 base64 图片")

	// 解析 data URL: data:image/jpeg;base64,/9j/4AAQ...
	re := regexp.MustCompile(`^data:image/([^;]+);base64,(.+)$`)
	matches := re.FindStringSubmatch(dataURL)
	if len(matches) != 3 {
		return "", fmt.Errorf("无效的 base64 data URL 格式")
	}

	mimeType := matches[1] // jpeg, png, etc.
	base64Data := matches[2]

	// 解码 base64
	imgData, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return "", fmt.Errorf("解码 base64 失败: %w", err)
	}

	// 确定文件扩展名
	ext := "." + mimeType
	if mimeType == "jpeg" {
		ext = ".jpg"
	}

	// 保存到本地
	fileName := fmt.Sprintf("gen_%d%s", time.Now().UnixNano(), ext)
	savePath := filepath.Join(config.OutputDir, fileName)
	if err := os.WriteFile(savePath, imgData, 0644); err != nil {
		return "", fmt.Errorf("保存图片失败: %w", err)
	}

	relativeImageURL := fmt.Sprintf("images/%s", fileName)
	utils.LogAPI("base64 图片保存成功: %s (%d bytes)", relativeImageURL, len(imgData))
	return relativeImageURL, nil
}

// downloadAndSaveImage 下载图片并保存到本地
func downloadAndSaveImage(imageURL string) (string, error) {
	utils.LogAPI("开始下载图片: %s", imageURL)

	// 创建 HTTP 客户端
	client := &http.Client{Timeout: 60 * time.Second}

	resp, err := client.Get(imageURL)
	if err != nil {
		return "", fmt.Errorf("下载图片失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("下载图片失败，状态码: %d", resp.StatusCode)
	}

	// 读取图片数据
	imgData, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("读取图片数据失败: %w", err)
	}

	// 确定文件扩展名
	ext := ".jpg"
	contentType := resp.Header.Get("Content-Type")
	if strings.Contains(contentType, "png") {
		ext = ".png"
	} else if strings.Contains(contentType, "webp") {
		ext = ".webp"
	} else if strings.Contains(contentType, "gif") {
		ext = ".gif"
	}

	// 保存到本地
	fileName := fmt.Sprintf("gen_%d%s", time.Now().UnixNano(), ext)
	savePath := filepath.Join(config.OutputDir, fileName)
	if err := os.WriteFile(savePath, imgData, 0644); err != nil {
		return "", fmt.Errorf("保存图片失败: %w", err)
	}

	relativeImageURL := fmt.Sprintf("images/%s", fileName)
	utils.LogAPI("图片下载成功: %s -> %s", imageURL, relativeImageURL)
	return relativeImageURL, nil
}

// AICallResult API 调用结果
type AICallResult struct {
	Success      bool
	ImageURL     string
	ErrorMessage string
	StatusCode   int
	IsQuotaError bool
}

// callAIAPI 执行单次 AI API 调用
func callAIAPI(apiURL, currentToken string, payloadBytes []byte, taskID string) AICallResult {
	req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(payloadBytes))
	if err != nil {
		return AICallResult{Success: false, ErrorMessage: err.Error()}
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+currentToken)

	client := &http.Client{Timeout: 900 * time.Second} // 15 分钟超时，给 AI API 足够的处理时间
	requestStartTime := time.Now()
	utils.LogAPI("开始 AI API 请求 (任务 %s, URL: %s)...", taskID, apiURL)

	resp, err := client.Do(req)
	requestDuration := time.Since(requestStartTime)

	if err != nil {
		utils.LogAPIResponse(0, requestDuration, nil, err)
		return AICallResult{Success: false, ErrorMessage: err.Error()}
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)

	var respMap map[string]interface{}
	if err := json.Unmarshal(respBody, &respMap); err == nil {
		utils.LogAPIResponse(resp.StatusCode, requestDuration, respMap, nil)
		utils.LogJSON("Generate Response", respMap)
		utils.LogResponseStructureWithStatus("Response Structure", respMap, resp.StatusCode)
	} else {
		utils.LogAPI("响应解析失败，原始响应: Status=%d, Body=%s", resp.StatusCode, string(respBody))
	}

	if resp.StatusCode != 200 {
		var apiError struct {
			Error struct {
				Message string `json:"message"`
				Type    string `json:"type"`
			} `json:"error"`
		}
		errorMessage := fmt.Sprintf("API 请求失败，状态码: %d", resp.StatusCode)
		if err := json.Unmarshal(respBody, &apiError); err == nil && apiError.Error.Message != "" {
			errorMessage = apiError.Error.Message
		}
		return AICallResult{
			Success:      false,
			ErrorMessage: errorMessage,
			StatusCode:   resp.StatusCode,
			IsQuotaError: isQuotaError(errorMessage),
		}
	}

	var aiResp types.AIResponse
	json.Unmarshal(respBody, &aiResp)

	if len(aiResp.Candidates) == 0 {
		return AICallResult{Success: false, ErrorMessage: "模型未返回内容"}
	}

	// 提取图片 - 尝试多种方式，只有全部失败才报错
	var lastError error

	for _, part := range aiResp.Candidates[0].Content.Parts {
		// 方式1: 优先处理 inlineData 格式（base64 图片）
		if part.InlineData != nil && part.InlineData.Data != "" {
			imgData, err := base64.StdEncoding.DecodeString(part.InlineData.Data)
			if err != nil {
				lastError = fmt.Errorf("inlineData base64 解码失败: %w", err)
				utils.LogAPI("inlineData base64 解码失败: %v", err)
				continue // 继续尝试其他方式
			}

			fileName := fmt.Sprintf("gen_%d.png", time.Now().UnixNano())
			savePath := filepath.Join(config.OutputDir, fileName)
			if err := os.WriteFile(savePath, imgData, 0644); err != nil {
				lastError = fmt.Errorf("保存 inlineData 图片失败: %w", err)
				utils.LogAPI("保存 inlineData 图片失败: %v", err)
				continue // 继续尝试其他方式
			}

			relativeImageURL := fmt.Sprintf("images/%s", fileName)
			utils.LogAPI("图片生成成功（inlineData 模式）: %s", relativeImageURL)
			return AICallResult{Success: true, ImageURL: relativeImageURL}
		}

		// 方式2: 处理 text 字段中的 markdown 图片 URL（如 ![image](https://...) 或 ![image](data:image/jpeg;base64,...)）
		if part.Text != "" {
			imageURL := extractImageURLFromMarkdown(part.Text)
			if imageURL != "" {
				// 检查是否是 base64 data URL
				if strings.HasPrefix(imageURL, "data:image/") {
					// 保存 base64 图片到本地
					localURL, err := saveBase64Image(imageURL)
					if err != nil {
						lastError = fmt.Errorf("text base64 保存失败: %w", err)
						utils.LogAPI("text base64 保存失败: %v", err)
						continue // 继续尝试其他方式
					}
					utils.LogAPI("图片生成成功（text base64 模式）: %s", localURL)
					return AICallResult{Success: true, ImageURL: localURL}
				} else {
					// 下载 HTTP/HTTPS 图片并保存到本地
					localURL, err := downloadAndSaveImage(imageURL)
					if err != nil {
						lastError = fmt.Errorf("下载 HTTP 图片失败: %w", err)
						utils.LogAPI("下载图片失败: %s, 错误: %v", imageURL, err)
						continue // 继续尝试其他方式
					}
					utils.LogAPI("图片生成成功（HTTP URL 模式）: %s", localURL)
					return AICallResult{Success: true, ImageURL: localURL}
				}
			}
		}
	}

	// 所有方式都失败了
	if lastError != nil {
		return AICallResult{Success: false, ErrorMessage: fmt.Sprintf("请求成功但图片处理失败: %v", lastError)}
	}
	return AICallResult{Success: false, ErrorMessage: "请求成功但未返回图片，请修改提示词后重试"}
}

// processAIGeneration 在后台处理 AI 生成请求
func processAIGeneration(currentToken, prompt, aspectRatio, imageSize, generationType string, parts []types.Part, refImagesJSON []byte, taskID string, task *models.GenerationTask) {
	// 添加 recover 防止 goroutine panic 导致静默失败
	defer func() {
		if r := recover(); r != nil {
			errMsg := fmt.Sprintf("任务处理发生 panic: %v", r)
			utils.LogAPI("任务 %s panic: %v", taskID, r)
			task.FailTask(errMsg)
			config.DB.Save(task)
		}
	}()

	// 构建 ImageConfig
	imageConfig := &types.ImageConfig{
		AspectRatio: aspectRatio,
		ImageSize:   imageSize,
	}
	utils.LogAPI("[单图生成] 构建 ImageConfig: AspectRatio=%s, ImageSize=%s", aspectRatio, imageSize)

	payloadObj := types.AIRequest{
		Contents: []types.Content{{Role: "user", Parts: parts}},
		GenerationConfig: types.GenerationConfig{
			ResponseModalities: []string{"TEXT", "IMAGE"},
			ImageConfig:        imageConfig,
		},
	}

	payloadBytes, _ := json.Marshal(payloadObj)

	// 获取 API URL
	apiURL := config.GetCurrentAIServiceURL()

	utils.LogAPIRequest("POST", apiURL, payloadObj)
	utils.LogJSON("Generate Request", payloadObj)

	// 调用 API
	result := callAIAPI(apiURL, currentToken, payloadBytes, taskID)

	// 处理最终结果
	if result.Success {
		finalImageURL := fmt.Sprintf("%s/%s", utils.GetBaseURL(config.ServerPort), result.ImageURL)

		// 保存历史记录
		newRecord := models.GenerationHistory{
			Prompt:      prompt,
			ImageURL:    result.ImageURL,
			FileName:    extractFileName(result.ImageURL),
			RefImages:   string(refImagesJSON),
			Type:        generationType,
			AspectRatio: aspectRatio,
			ImageSize:   imageSize,
		}
		config.DB.Create(&newRecord)

		// 增加生成计数
		// 4K 图片计为 2 张，2K 图片计为 1 张
		var stats models.GenerationStats
		dbResult := config.DB.First(&stats)

		// 根据图片尺寸计算增加的数量
		incrementCount := 1
		if imageSize == "4K" {
			incrementCount = 2
		}

		if dbResult.Error != nil {
			stats = models.GenerationStats{TotalCount: incrementCount}
			config.DB.Create(&stats)
		} else {
			stats.TotalCount += incrementCount
			config.DB.Save(&stats)
		}

		// 更新任务状态为完成
		task.CompleteTask(finalImageURL)
		config.DB.Save(task)
		utils.LogAPI("任务 %s 完成: %s", taskID, finalImageURL)
	} else {
		// 过滤敏感信息
		filteredMessage := config.FilterSensitiveInfo(result.ErrorMessage)
		task.FailTask(filteredMessage)
		config.DB.Save(task)
		utils.LogAPI("任务 %s 失败: %s", taskID, filteredMessage)

		// 注意：失败的记录不保存到历史记录中
		// 只有成功生成的图片才会出现在历史记录和统计中
	}
}

// generateMultipleImages 生成多张图片（count > 1）- 使用 SSE 流式返回
func generateMultipleImages(c *gin.Context, currentToken, prompt, aspectRatio, imageSize, generationType string, parts []types.Part, savedRefImages []string, refImagesJSON []byte, taskID string, task *models.GenerationTask, count int) {
	// 生成批次 ID
	batchID := uuid.New().String()

	// 转换相对路径为完整 URL 返回给前端
	absoluteRefImages := make([]string, len(savedRefImages))
	for i, ref := range savedRefImages {
		absoluteRefImages[i] = utils.ToAbsoluteURL(ref, config.ServerPort)
	}

	// 设置 SSE 响应头
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Access-Control-Allow-Origin", "*")

	// 发送初始事件，告知前端批次信息
	initialData := gin.H{
		"type":         "start",
		"task_id":      taskID,
		"batch_id":     batchID,
		"count":        count,
		"prompt":       prompt,
		"ref_images":   absoluteRefImages,
		"aspect_ratio": aspectRatio,
		"image_size":   imageSize,
	}
	initialJSON, _ := json.Marshal(initialData)
	c.SSEvent("message", string(initialJSON))
	c.Writer.Flush()

	// 用于存储所有图片的结果
	results := make([]ImageResult, count)
	var wg sync.WaitGroup
	var mu sync.Mutex

	// 成功计数
	successCount := 0
	completedCount := 0

	// 结果通道，用于流式返回
	resultChan := make(chan ImageResult, count)

	// 8.3: 并发调用 AI API
	for i := 0; i < count; i++ {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()

			result := callAIAPIForImage(currentToken, prompt, aspectRatio, imageSize, parts, index)

			mu.Lock()
			results[index] = result

			if result.Error == "" && result.ImageURL != "" {
				successCount++

				// 8.5: 存储历史记录，共享 batch_id
				batchIndex := index
				batchTotal := count
				newRecord := models.GenerationHistory{
					Prompt:      prompt,
					ImageURL:    result.ImageURL,
					FileName:    extractFileName(result.ImageURL),
					RefImages:   string(refImagesJSON),
					Type:        generationType,
					AspectRatio: aspectRatio,
					ImageSize:   imageSize,
					BatchID:     &batchID,
					BatchIndex:  &batchIndex,
					BatchTotal:  &batchTotal,
				}
				config.DB.Create(&newRecord)

				// 增加生成计数
				// 4K 图片计为 2 张，2K 图片计为 1 张
				var stats models.GenerationStats
				dbResult := config.DB.First(&stats)

				// 根据图片尺寸计算增加的数量
				incrementCount := 1
				if imageSize == "4K" {
					incrementCount = 2
				}

				if dbResult.Error != nil {
					stats = models.GenerationStats{TotalCount: incrementCount}
					config.DB.Create(&stats)
				} else {
					stats.TotalCount += incrementCount
					config.DB.Save(&stats)
				}
			}
			mu.Unlock()

			// 发送结果到通道
			resultChan <- result
		}(i)
	}

	// 在另一个 goroutine 中等待所有完成后关闭通道
	go func() {
		wg.Wait()
		close(resultChan)
	}()

	// 流式返回每个完成的图片
	for result := range resultChan {
		completedCount++

		var eventData gin.H
		if result.Error != "" {
			eventData = gin.H{
				"type":      "image",
				"batch_id":  batchID,
				"index":     result.Index,
				"error":     result.Error,
				"completed": completedCount,
				"total":     count,
			}
		} else {
			// 转换相对路径为完整 URL 返回给前端
			absoluteImageURL := utils.ToAbsoluteURL(result.ImageURL, config.ServerPort)
			eventData = gin.H{
				"type":      "image",
				"batch_id":  batchID,
				"index":     result.Index,
				"image_url": absoluteImageURL,
				"completed": completedCount,
				"total":     count,
			}
		}

		eventJSON, _ := json.Marshal(eventData)
		utils.LogAPI("发送 SSE image 事件: index=%d, completed=%d/%d, hasError=%v", result.Index, completedCount, count, result.Error != "")
		c.SSEvent("message", string(eventJSON))
		c.Writer.Flush()
	}

	// 等待所有并发请求完成（实际上已经完成了，因为通道已关闭）
	wg.Wait()

	// 构建最终结果
	images := make([]gin.H, count)
	for i, result := range results {
		if result.Error != "" {
			images[i] = gin.H{
				"error": result.Error,
				"index": result.Index,
			}
		} else {
			// 转换相对路径为完整 URL 返回给前端
			absoluteImageURL := utils.ToAbsoluteURL(result.ImageURL, config.ServerPort)
			images[i] = gin.H{
				"image_url": absoluteImageURL,
				"index":     result.Index,
			}
		}
	}

	// 更新任务状态
	status := "success"
	if successCount == 0 {
		// 全部失败
		task.FailTask("所有图片生成失败")
		status = "failed"
	} else if successCount < count {
		// 部分成功
		status = "partial"
		// 获取第一张成功的图片 URL 作为任务的 image_url
		var firstSuccessURL string
		for _, result := range results {
			if result.Error == "" && result.ImageURL != "" {
				firstSuccessURL = result.ImageURL
				break
			}
		}
		task.CompleteTask(firstSuccessURL)
	} else {
		// 全部成功
		task.CompleteTask(results[0].ImageURL)
	}
	config.DB.Save(task)

	// 发送完成事件
	completeData := gin.H{
		"type":          "complete",
		"status":        status,
		"task_id":       taskID,
		"batch_id":      batchID,
		"images":        images,
		"ref_images":    absoluteRefImages,
		"success_count": successCount,
		"total_count":   count,
	}
	completeJSON, _ := json.Marshal(completeData)
	utils.LogAPI("发送 SSE complete 事件: status=%s, success_count=%d, total_count=%d", status, successCount, count)
	c.SSEvent("message", string(completeJSON))
	c.Writer.Flush()

	// 明确结束 SSE 流 - 多种方式确保连接关闭
	// 1. 发送两个换行符（SSE 协议标准结束方式）
	c.Writer.Write([]byte("\n\n"))
	c.Writer.Flush()

	// 2. 强制 flush
	if flusher, ok := c.Writer.(http.Flusher); ok {
		flusher.Flush()
	}

	// 3. 设置连接关闭头
	c.Header("Connection", "close")

	// 4. 立即返回，让 Gin 关闭连接
	utils.LogAPI("SSE 流已结束，连接即将关闭")
}

// callAIAPIForImage 调用 AI API 生成单张图片
func callAIAPIForImage(currentToken, prompt, aspectRatio, imageSize string, parts []types.Part, index int) ImageResult {
	// 添加 recover 防止 panic 导致静默失败
	defer func() {
		if r := recover(); r != nil {
			utils.LogAPI("图片 %d 生成发生 panic: %v", index+1, r)
		}
	}()

	// 构建 ImageConfig
	imageConfig := &types.ImageConfig{
		AspectRatio: aspectRatio,
		ImageSize:   imageSize,
	}
	utils.LogAPI("[多图生成] 图片 %d - 构建 ImageConfig: AspectRatio=%s, ImageSize=%s", index+1, aspectRatio, imageSize)

	payloadObj := types.AIRequest{
		Contents: []types.Content{{Role: "user", Parts: parts}},
		GenerationConfig: types.GenerationConfig{
			ResponseModalities: []string{"TEXT", "IMAGE"},
			ImageConfig:        imageConfig,
		},
	}

	payloadBytes, _ := json.Marshal(payloadObj)

	// 获取 API URL
	apiURL := config.GetCurrentAIServiceURL()

	utils.LogAPIRequest("POST", apiURL, payloadObj)

	// 调用 API
	result := callAIAPIInternal(apiURL, currentToken, payloadBytes, index)

	return result
}

// callAIAPIInternal 内部 API 调用函数
func callAIAPIInternal(apiURL, currentToken string, payloadBytes []byte, index int) ImageResult {
	req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(payloadBytes))
	if err != nil {
		utils.LogAPI("图片 %d 创建请求失败: %s", index+1, err.Error())
		return ImageResult{Error: err.Error(), Index: index}
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+currentToken)

	client := &http.Client{Timeout: 900 * time.Second} // 15 分钟超时，给 AI API 足够的处理时间

	utils.LogAPI("开始 AI API 请求 (图片 %d, URL: %s)...", index+1, apiURL)
	requestStartTime := time.Now()

	resp, err := client.Do(req)
	requestDuration := time.Since(requestStartTime)

	if err != nil {
		utils.LogAPIResponse(0, requestDuration, nil, err)
		utils.LogAPI("图片 %d 请求失败: %s (耗时: %v)", index+1, err.Error(), requestDuration)
		return ImageResult{Error: err.Error(), Index: index}
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		utils.LogAPI("图片 %d 读取响应失败: %s", index+1, err.Error())
		return ImageResult{Error: "读取响应失败: " + err.Error(), Index: index}
	}

	// 记录响应
	var respMap map[string]interface{}
	if err := json.Unmarshal(respBody, &respMap); err == nil {
		utils.LogAPIResponse(resp.StatusCode, requestDuration, respMap, nil)
	} else {
		utils.LogAPI("图片 %d 响应解析失败: %s", index+1, err.Error())
	}

	// 检查 API 错误
	if resp.StatusCode != 200 {
		var apiError struct {
			Error struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		errorMessage := fmt.Sprintf("API 请求失败，状态码: %d", resp.StatusCode)
		if err := json.Unmarshal(respBody, &apiError); err == nil && apiError.Error.Message != "" {
			errorMessage = apiError.Error.Message
		}
		filteredMessage := config.FilterSensitiveInfo(errorMessage)
		utils.LogAPI("图片 %d API 错误: %s", index+1, filteredMessage)
		return ImageResult{Error: errorMessage, Index: index} // 返回原始错误用于判断是否是余额错误
	}

	var aiResp types.AIResponse
	if err := json.Unmarshal(respBody, &aiResp); err != nil {
		utils.LogAPI("图片 %d 解析 AI 响应失败: %s", index+1, err.Error())
		return ImageResult{Error: "解析响应失败", Index: index}
	}

	if len(aiResp.Candidates) == 0 {
		utils.LogAPI("图片 %d 模型未返回内容", index+1)
		return ImageResult{Error: "模型未返回内容", Index: index}
	}

	// 提取图片 - 尝试多种方式，只有全部失败才报错
	var lastError error

	for _, part := range aiResp.Candidates[0].Content.Parts {
		// 方式1: 优先处理 inlineData 格式（base64 图片）
		if part.InlineData != nil && part.InlineData.Data != "" {
			imgData, err := base64.StdEncoding.DecodeString(part.InlineData.Data)
			if err != nil {
				lastError = fmt.Errorf("inlineData base64 解码失败: %w", err)
				utils.LogAPI("图片 %d inlineData base64 解码失败: %v", index+1, err)
				continue // 继续尝试其他方式
			}

			fileName := fmt.Sprintf("gen_%d.png", time.Now().UnixNano())
			savePath := filepath.Join(config.OutputDir, fileName)
			if err := os.WriteFile(savePath, imgData, 0644); err != nil {
				lastError = fmt.Errorf("保存 inlineData 图片失败: %w", err)
				utils.LogAPI("图片 %d 保存 inlineData 失败: %s", index+1, err.Error())
				continue // 继续尝试其他方式
			}

			relativeImageURL := fmt.Sprintf("images/%s", fileName)
			utils.LogAPI("图片 %d 生成成功（inlineData 模式）: %s (耗时: %v)", index+1, relativeImageURL, requestDuration)
			return ImageResult{ImageURL: relativeImageURL, Index: index}
		}

		// 方式2: 处理 text 字段中的 markdown 图片 URL（如 ![image](https://...) 或 ![image](data:image/jpeg;base64,...)）
		if part.Text != "" {
			imageURL := extractImageURLFromMarkdown(part.Text)
			if imageURL != "" {
				// 检查是否是 base64 data URL
				if strings.HasPrefix(imageURL, "data:image/") {
					// 保存 base64 图片到本地
					localURL, err := saveBase64Image(imageURL)
					if err != nil {
						lastError = fmt.Errorf("text base64 保存失败: %w", err)
						utils.LogAPI("图片 %d text base64 保存失败: %v", index+1, err)
						continue // 继续尝试其他方式
					}
					utils.LogAPI("图片 %d 生成成功（text base64 模式）: %s (耗时: %v)", index+1, localURL, requestDuration)
					return ImageResult{ImageURL: localURL, Index: index}
				} else {
					// 下载 HTTP/HTTPS 图片并保存到本地
					localURL, err := downloadAndSaveImage(imageURL)
					if err != nil {
						lastError = fmt.Errorf("下载 HTTP 图片失败: %w", err)
						utils.LogAPI("图片 %d 下载失败: %s, 错误: %v", index+1, imageURL, err)
						continue // 继续尝试其他方式
					}
					utils.LogAPI("图片 %d 生成成功（HTTP URL 模式）: %s (耗时: %v)", index+1, localURL, requestDuration)
					return ImageResult{ImageURL: localURL, Index: index}
				}
			}
		}
	}

	// 所有方式都失败了
	if lastError != nil {
		utils.LogAPI("图片 %d 所有处理方式都失败，最后错误: %v", index+1, lastError)
		return ImageResult{Error: fmt.Sprintf("图片处理失败: %v", lastError), Index: index}
	}

	utils.LogAPI("图片 %d 未找到图片数据", index+1)
	return ImageResult{Error: "请求成功但未返回图片，请修改提示词后重试", Index: index}
}

// extractFileName 从 URL 中提取文件名
func extractFileName(url string) string {
	parts := strings.Split(url, "/")
	if len(parts) > 0 {
		return parts[len(parts)-1]
	}
	return ""
}
