package handlers

import (
	"time"

	"github.com/gin-gonic/gin"
	"sigma/config"
	"sigma/models"
)

// TaskTimeoutDuration 任务超时时间（5分钟）
const TaskTimeoutDuration = 5 * time.Minute

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
	
	// 转换为响应格式
	response := make([]models.TaskResponse, len(tasks))
	for i, task := range tasks {
		response[i] = task.ToResponse()
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
	
	c.JSON(200, task.ToResponse())
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
