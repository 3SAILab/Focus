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
	"sigma/models"
	"sigma/types"
	"sigma/config"
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

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)

	var respMap map[string]interface{}
	if err := json.Unmarshal(respBody, &respMap); err == nil {
		utils.LogJSON("Generate Response", respMap)
	} else {
		fmt.Printf("\n====== [Generate Response Raw] ======\n%s\n=====================================\n", string(respBody))
	}

	var geminiResp types.GeminiResponse
	json.Unmarshal(respBody, &geminiResp)

	if len(geminiResp.Candidates) == 0 {
		c.JSON(500, gin.H{"error": "模型未返回内容", "raw": string(respBody)})
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

				refImagesJSON, _ := json.Marshal(savedRefImages)

				newRecord := models.GenerationHistory{
					Prompt:    prompt,
					ImageURL:  finalImageURL,
					FileName:  fileName,
					RefImages: string(refImagesJSON),
				}
				config.DB.Create(&newRecord)
			}
		}
	}

	if finalImageURL == "" {
		c.JSON(500, gin.H{"error": "未生成图片", "details": finalExplain})
		return
	}

	c.JSON(200, gin.H{
		"status":     "success",
		"image_url":  finalImageURL,
		"text":       finalExplain,
		"ref_images": savedRefImages,
	})
}

