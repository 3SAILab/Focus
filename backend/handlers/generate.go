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
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"sigma/config"
	"sigma/models"
	"sigma/types"
	"sigma/utils"
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

			refFileName := fmt.Sprintf("ref_%d_%s", time.Now().UnixNano(), file.Filename)
			refFilePath := filepath.Join(config.UploadDir, refFileName)
			if err := c.SaveUploadedFile(file, refFilePath); err == nil {
				// 存储相对路径，读取时动态拼接当前端口
				savedRefImages = append(savedRefImages, fmt.Sprintf("uploads/%s", refFileName))
			}
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

// processAIGeneration 在后台处理 AI 生成请求
func processAIGeneration(currentToken, prompt, aspectRatio, imageSize, generationType string, parts []types.Part, refImagesJSON []byte, taskID string, task *models.GenerationTask) {
	// 构建 ImageConfig（开发和生产环境都使用 gemini-3-pro-image-preview，支持 imageSize）
	imageConfig := &types.ImageConfig{
		AspectRatio: aspectRatio,
		ImageSize:   imageSize,
	}
	
	payloadObj := types.AIRequest{
		Contents: []types.Content{{Role: "user", Parts: parts}},
		GenerationConfig: types.GenerationConfig{
			ResponseModalities: []string{"TEXT", "IMAGE"},
			ImageConfig:        imageConfig,
		},
	}

	// 记录 API 请求（始终记录到 api.log）
	utils.LogAPIRequest("POST", config.GetAIServiceURL(), payloadObj)
	utils.LogJSON("Generate Request", payloadObj)

	payloadBytes, _ := json.Marshal(payloadObj)
	req, _ := http.NewRequest("POST", config.GetAIServiceURL(), bytes.NewBuffer(payloadBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+currentToken)

	// 设置超时时间为 270 秒（4.5分钟）
	client := &http.Client{Timeout: 270 * time.Second}
	
	// 记录请求开始时间
	requestStartTime := time.Now()
	utils.LogAPI("开始 AI API 请求 (任务 %s)...", taskID)
	
	resp, err := client.Do(req)
	
	// 计算请求耗时
	requestDuration := time.Since(requestStartTime)
	
	if err != nil {
		// 记录错误响应
		utils.LogAPIResponse(0, requestDuration, nil, err)
		// 更新任务状态为失败
		task.FailTask(err.Error())
		config.DB.Save(task)
		utils.LogAPI("任务 %s 失败: %s", taskID, err.Error())
		return
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)

	var respMap map[string]interface{}
	if err := json.Unmarshal(respBody, &respMap); err == nil {
		// 记录 API 响应（始终记录到 api.log）
		utils.LogAPIResponse(resp.StatusCode, requestDuration, respMap, nil)
		// 先打印结构（不含 base64 数据）
		utils.LogJSON("Generate Response", respMap)
		// 打印原始结构的 key 路径，帮助调试（包含状态码）
		utils.LogResponseStructureWithStatus("Response Structure", respMap, resp.StatusCode)
	} else {
		utils.LogAPI("响应解析失败，原始响应: Status=%d, Body=%s", resp.StatusCode, string(respBody))
		fmt.Printf("\n====== [Generate Response Raw] ======\nStatus Code: %d\n%s\n=====================================\n", resp.StatusCode, string(respBody))
	}

	// 首先检查是否是 API 错误响应（非 200 状态码）
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
		// 过滤敏感信息
		filteredMessage := config.FilterSensitiveInfo(errorMessage)
		// API 返回了错误，更新任务状态为失败
		task.FailTask(filteredMessage)
		config.DB.Save(task)
		utils.LogAPI("任务 %s 失败: %s", taskID, filteredMessage)
		return
	}

	var aiResp types.AIResponse
	json.Unmarshal(respBody, &aiResp)

	if len(aiResp.Candidates) == 0 {
		// 更新任务状态为失败
		task.FailTask("模型未返回内容")
		config.DB.Save(task)
		utils.LogAPI("任务 %s 失败: 模型未返回内容", taskID)
		return
	}

	var finalImageURL string

	// 只取第一张图片（AI 有时会返回多张图片，我们只需要第一张）
	for _, part := range aiResp.Candidates[0].Content.Parts {
		// 只处理第一张图片
		if part.InlineData != nil && finalImageURL == "" {
			imgData, err := base64.StdEncoding.DecodeString(part.InlineData.Data)
			if err == nil {
				fileName := fmt.Sprintf("gen_%d.png", time.Now().UnixNano())
				savePath := filepath.Join(config.OutputDir, fileName)
				os.WriteFile(savePath, imgData, 0644)

				// 存储相对路径，读取时动态拼接当前端口
				relativeImageURL := fmt.Sprintf("images/%s", fileName)
				finalImageURL = fmt.Sprintf("%s/%s", utils.GetBaseURL(config.ServerPort), relativeImageURL)

				newRecord := models.GenerationHistory{
					Prompt:    prompt,
					ImageURL:  relativeImageURL, // 存储相对路径
					FileName:  fileName,
					RefImages: string(refImagesJSON),
					Type:      generationType,
				}
				config.DB.Create(&newRecord)
				
				// 增加生成计数
				var stats models.GenerationStats
				result := config.DB.First(&stats)
				if result.Error != nil {
					stats = models.GenerationStats{TotalCount: 1}
					config.DB.Create(&stats)
				} else {
					stats.TotalCount++
					config.DB.Save(&stats)
				}
			}
		}
	}

	if finalImageURL == "" {
		// 更新任务状态为失败
		errorMsg := "图片生成失败，请重试"
		task.FailTask(errorMsg)
		config.DB.Save(task)
		utils.LogAPI("任务 %s 失败: %s", taskID, errorMsg)
		
		// 保存失败记录到历史（用于刷新后显示）
		failedRecord := models.GenerationHistory{
			Prompt:    prompt,
			RefImages: string(refImagesJSON),
			Type:      generationType,
			ErrorMsg:  errorMsg,
		}
		config.DB.Create(&failedRecord)
		return
	}

	// 更新任务状态为完成
	task.CompleteTask(finalImageURL)
	config.DB.Save(task)
	utils.LogAPI("任务 %s 完成: %s", taskID, finalImageURL)
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
		"type":       "start",
		"task_id":    taskID,
		"batch_id":   batchID,
		"count":      count,
		"prompt":     prompt,
		"ref_images": absoluteRefImages,
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
					Prompt:     prompt,
					ImageURL:   result.ImageURL,
					FileName:   extractFileName(result.ImageURL),
					RefImages:  string(refImagesJSON),
					Type:       generationType,
					BatchID:    &batchID,
					BatchIndex: &batchIndex,
					BatchTotal: &batchTotal,
				}
				config.DB.Create(&newRecord)
				
				// 增加生成计数
				var stats models.GenerationStats
				dbResult := config.DB.First(&stats)
				if dbResult.Error != nil {
					stats = models.GenerationStats{TotalCount: 1}
					config.DB.Create(&stats)
				} else {
					stats.TotalCount++
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
				"index":     result.Index,
				"image_url": absoluteImageURL,
				"completed": completedCount,
				"total":     count,
			}
		}
		
		eventJSON, _ := json.Marshal(eventData)
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
	c.SSEvent("message", string(completeJSON))
	c.Writer.Flush()
}

// callAIAPIForImage 调用 AI API 生成单张图片
func callAIAPIForImage(currentToken, prompt, aspectRatio, imageSize string, parts []types.Part, index int) ImageResult {
	// 构建 ImageConfig（开发和生产环境都使用 gemini-3-pro-image-preview，支持 imageSize）
	imageConfig := &types.ImageConfig{
		AspectRatio: aspectRatio,
		ImageSize:   imageSize,
	}
	
	payloadObj := types.AIRequest{
		Contents: []types.Content{{Role: "user", Parts: parts}},
		GenerationConfig: types.GenerationConfig{
			ResponseModalities: []string{"TEXT", "IMAGE"},
			ImageConfig:        imageConfig,
		},
	}

	// 记录 API 请求（始终记录到 api.log）
	utils.LogAPIRequest("POST", config.GetAIServiceURL(), payloadObj)

	payloadBytes, _ := json.Marshal(payloadObj)
	req, _ := http.NewRequest("POST", config.GetAIServiceURL(), bytes.NewBuffer(payloadBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+currentToken)

	// 设置超时时间为 270 秒
	client := &http.Client{Timeout: 270 * time.Second}
	
	utils.LogAPI("开始 AI API 请求 (图片 %d)...", index+1)
	requestStartTime := time.Now()
	
	resp, err := client.Do(req)
	requestDuration := time.Since(requestStartTime)
	
	if err != nil {
		utils.LogAPIResponse(0, requestDuration, nil, err)
		return ImageResult{Error: err.Error(), Index: index}
	}
	defer resp.Body.Close()
	
	respBody, _ := io.ReadAll(resp.Body)
	
	// 记录响应
	var respMap map[string]interface{}
	if err := json.Unmarshal(respBody, &respMap); err == nil {
		utils.LogAPIResponse(resp.StatusCode, requestDuration, respMap, nil)
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
		return ImageResult{Error: filteredMessage, Index: index}
	}
	
	var aiResp types.AIResponse
	json.Unmarshal(respBody, &aiResp)
	
	if len(aiResp.Candidates) == 0 {
		return ImageResult{Error: "模型未返回内容", Index: index}
	}
	
	// 提取图片
	for _, part := range aiResp.Candidates[0].Content.Parts {
		if part.InlineData != nil {
			imgData, err := base64.StdEncoding.DecodeString(part.InlineData.Data)
			if err == nil {
				fileName := fmt.Sprintf("gen_%d.png", time.Now().UnixNano())
				savePath := filepath.Join(config.OutputDir, fileName)
				os.WriteFile(savePath, imgData, 0644)
				
				// 存储相对路径，读取时动态拼接当前端口
				relativeImageURL := fmt.Sprintf("images/%s", fileName)
				return ImageResult{ImageURL: relativeImageURL, Index: index}
			}
		}
	}
	
	return ImageResult{Error: "图片生成失败", Index: index}
}

// extractFileName 从 URL 中提取文件名
func extractFileName(url string) string {
	parts := strings.Split(url, "/")
	if len(parts) > 0 {
		return parts[len(parts)-1]
	}
	return ""
}

