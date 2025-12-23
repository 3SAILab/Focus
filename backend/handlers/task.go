package handlers

import (
	"time"

	"github.com/gin-gonic/gin"
	"sigma/config"
	"sigma/models"
	"sigma/utils"
)

// TaskTimeoutDuration 任务超时时间（15分钟）
const TaskTimeoutDuration = 15 * time.Minute

// GetProcessingTasks 获取正在处理的任务
// GET /tasks/processing?type=create
func GetProcessingTasks(c *gin.Context) {
	taskType := c.Query("type")
	
	var tasks []models.GenerationTask
	query := config.DB.Model(&models.GenerationTask{}).
		Where("status = ?", models.TaskStatusProcessing)
	
	// 按类型筛选
	if taskType != "" {
		query = query.Where("type = ?", taskType)
	}
	
	result := query.Order("created_at desc").Find(&tasks)
	if result.Error != nil {
		c.JSON(500, gin.H{"error": "获取处理中任务失败"})
		return
	}
	
	// 转换为响应格式，同时转换 URL
	response := make([]models.TaskResponse, len(tasks))
	for i, task := range tasks {
		resp := task.ToResponse()
		// 转换 URL 为当前端口的绝对路径（兼容旧数据和新数据）
		resp.ImageURL = utils.ToAbsoluteURL(resp.ImageURL, config.ServerPort)
		resp.RefImages = utils.ConvertRefImagesJSON(resp.RefImages, config.ServerPort, false)
		response[i] = resp
	}
	
	c.JSON(200, response)
}

// GetTaskStatus 获取单个任务状态
// GET /tasks/:id
func GetTaskStatus(c *gin.Context) {
	taskID := c.Param("id")
	if taskID == "" {
		c.JSON(400, gin.H{"error": "任务ID不能为空"})
		return
	}
	
	var task models.GenerationTask
	result := config.DB.Where("task_id = ?", taskID).First(&task)
	if result.Error != nil {
		c.JSON(404, gin.H{"error": "任务不存在"})
		return
	}
	
	// 转换 URL 为当前端口的绝对路径（兼容旧数据和新数据）
	resp := task.ToResponse()
	resp.ImageURL = utils.ToAbsoluteURL(resp.ImageURL, config.ServerPort)
	resp.RefImages = utils.ConvertRefImagesJSON(resp.RefImages, config.ServerPort, false)
	
	c.JSON(200, resp)
}

// CleanupStaleTasks 清理超时的任务
// 将处理超过5分钟的任务标记为失败
func CleanupStaleTasks() (int64, error) {
	timeoutThreshold := time.Now().Add(-TaskTimeoutDuration)
	
	result := config.DB.Model(&models.GenerationTask{}).
		Where("status = ? AND started_at < ?", models.TaskStatusProcessing, timeoutThreshold).
		Updates(map[string]interface{}{
			"status":    models.TaskStatusFailed,
			"error_msg": "任务超时",
		})
	
	return result.RowsAffected, result.Error
}
