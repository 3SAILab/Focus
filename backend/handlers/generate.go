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
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"sigma/config"
	"sigma/models"
	"sigma/types"
	"sigma/utils"
)

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
				savedRefImages = append(savedRefImages, fmt.Sprintf("%s/uploads/%s", utils.GetBaseURL(config.ServerPort), refFileName))
			}
		}
	}

	// 创建任务记录 - 在调用 AI API 之前
	taskID := uuid.New().String()
	refImagesJSON, _ := json.Marshal(savedRefImages)
	task := models.GenerationTask{
		TaskID:    taskID,
		Status:    models.TaskStatusProcessing,
		Type:      generationType,
		Prompt:    prompt,
		RefImages: string(refImagesJSON),
		StartedAt: time.Now(),
	}
	if result := config.DB.Create(&task); result.Error != nil {
		c.JSON(500, gin.H{"error": "创建任务失败"})
		return
	}

	payloadObj := types.GeminiRequest{
		Contents: []types.Content{{Role: "user", Parts: parts}},
		GenerationConfig: types.GenerationConfig{
			ResponseModalities: []string{"TEXT", "IMAGE"},
			ImageConfig: &types.ImageConfig{
				AspectRatio: aspectRatio,
				ImageSize:   imageSize,
			},
		},
	}

	utils.LogJSON("Generate Request", payloadObj)

	payloadBytes, _ := json.Marshal(payloadObj)
	req, _ := http.NewRequest("POST", types.TargetAPIURL, bytes.NewBuffer(payloadBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+currentToken)

	// 增加超时时间到 120 秒，因为 AI 图片生成可能需要较长时间
	client := &http.Client{Timeout: 300 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		// 更新任务状态为失败
		task.FailTask(err.Error())
		config.DB.Save(&task)
		c.JSON(500, gin.H{"error": err.Error(), "task_id": taskID})
		return
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)

	var respMap map[string]interface{}
	if err := json.Unmarshal(respBody, &respMap); err == nil {
		// 先打印结构（不含 base64 数据）
		utils.LogJSON("Generate Response", respMap)
		// 打印原始结构的 key 路径，帮助调试（包含状态码）
		utils.LogResponseStructureWithStatus("Response Structure", respMap, resp.StatusCode)
	} else {
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
		// API 返回了错误，更新任务状态为失败
		task.FailTask(errorMessage)
		config.DB.Save(&task)
		// 返回上游 API 的状态码，让前端可以根据状态码显示不同提示
		c.JSON(resp.StatusCode, gin.H{
			"error":       errorMessage,
			"task_id":     taskID,
			"status_code": resp.StatusCode,
		})
		return
	}

	var geminiResp types.GeminiResponse
	json.Unmarshal(respBody, &geminiResp)

	if len(geminiResp.Candidates) == 0 {
		// 更新任务状态为失败
		task.FailTask("模型未返回内容")
		config.DB.Save(&task)
		c.JSON(500, gin.H{"error": "模型未返回内容", "raw": string(respBody), "task_id": taskID})
		return
	}

	var finalImageURL string
	var finalExplain string

	for _, part := range geminiResp.Candidates[0].Content.Parts {
		if part.Text != "" {
			finalExplain += part.Text
		}
		if part.InlineData != nil {
			imgData, err := base64.StdEncoding.DecodeString(part.InlineData.Data)
			if err == nil {
				fileName := fmt.Sprintf("gen_%d.png", time.Now().UnixNano())
				savePath := filepath.Join(config.OutputDir, fileName)
				os.WriteFile(savePath, imgData, 0644)

				finalImageURL = fmt.Sprintf("%s/images/%s", utils.GetBaseURL(config.ServerPort), fileName)

				newRecord := models.GenerationHistory{
					Prompt:    prompt,
					ImageURL:  finalImageURL,
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
		config.DB.Save(&task)
		c.JSON(500, gin.H{"error": errorMsg, "details": finalExplain, "task_id": taskID})
		return
	}

	// 更新任务状态为完成
	task.CompleteTask(finalImageURL)
	config.DB.Save(&task)

	c.JSON(200, gin.H{
		"status":     "success",
		"task_id":    taskID,
		"image_url":  finalImageURL,
		"text":       finalExplain,
		"ref_images": savedRefImages,
	})
}

