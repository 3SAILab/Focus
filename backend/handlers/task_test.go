package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/quick"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"sigma/config"
	"sigma/models"
)

func setupTaskTestDB(t *testing.T) func() {
	var err error
	config.DB, err = gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("无法创建测试数据库: %v", err)
	}
	config.DB.AutoMigrate(&models.GenerationTask{})

	return func() {
		sqlDB, _ := config.DB.DB()
		sqlDB.Close()
	}
}

// **Feature: generation-persistence, Property 4: Processing Task Recovery**
// *For any* page load, querying for processing tasks SHALL return all tasks
// with status "processing" that match the specified generation type.
// **Validates: Requirements 1.4, 4.2**
func TestProperty_ProcessingTaskRecovery(t *testing.T) {
	cleanup := setupTaskTestDB(t)
	defer cleanup()

	gin.SetMode(gin.TestMode)

	// Property: For any set of tasks with mixed statuses and types,
	// querying for processing tasks with a specific type returns exactly
	// those tasks that are both "processing" AND match the type
	property := func(numProcessing, numCompleted, numFailed uint8) bool {
		// Limit to reasonable numbers to avoid slow tests
		numProcessing = numProcessing % 10
		numCompleted = numCompleted % 10
		numFailed = numFailed % 10

		// Clean up previous test data
		config.DB.Exec("DELETE FROM generation_tasks")

		taskTypes := []string{models.GenerationTypeCreate, models.GenerationTypeWhiteBackground, models.GenerationTypeClothingChange}
		targetType := models.GenerationTypeCreate

		// Create processing tasks
		expectedCount := 0
		for i := uint8(0); i < numProcessing; i++ {
			taskType := taskTypes[int(i)%len(taskTypes)]
			task := models.GenerationTask{
				TaskID:    uuid.New().String(),
				Status:    models.TaskStatusProcessing,
				Type:      taskType,
				Prompt:    "test prompt",
				StartedAt: time.Now(),
			}
			config.DB.Create(&task)
			if taskType == targetType {
				expectedCount++
			}
		}

		// Create completed tasks (should not be returned)
		for i := uint8(0); i < numCompleted; i++ {
			taskType := taskTypes[int(i)%len(taskTypes)]
			task := models.GenerationTask{
				TaskID:    uuid.New().String(),
				Status:    models.TaskStatusCompleted,
				Type:      taskType,
				Prompt:    "test prompt",
				ImageURL:  "http://test.com/image.png",
				StartedAt: time.Now(),
			}
			config.DB.Create(&task)
		}

		// Create failed tasks (should not be returned)
		for i := uint8(0); i < numFailed; i++ {
			taskType := taskTypes[int(i)%len(taskTypes)]
			task := models.GenerationTask{
				TaskID:    uuid.New().String(),
				Status:    models.TaskStatusFailed,
				Type:      taskType,
				Prompt:    "test prompt",
				ErrorMsg:  "test error",
				StartedAt: time.Now(),
			}
			config.DB.Create(&task)
		}

		// Query for processing tasks with target type
		r := gin.New()
		r.GET("/tasks/processing", GetProcessingTasks)

		req, _ := http.NewRequest("GET", "/tasks/processing?type="+targetType, nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			return false
		}

		var response []models.TaskResponse
		if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
			return false
		}

		// Property assertions:
		// 1. Count matches expected (only processing tasks of target type)
		if len(response) != expectedCount {
			return false
		}

		// 2. All returned tasks have status "processing"
		// 3. All returned tasks have the target type
		for _, task := range response {
			if task.Status != models.TaskStatusProcessing {
				return false
			}
			if task.Type != targetType {
				return false
			}
		}

		return true
	}

	if err := quick.Check(property, &quick.Config{MaxCount: 100}); err != nil {
		t.Errorf("Property 4 (Processing Task Recovery) failed: %v", err)
	}
}

// Test GetTaskStatus handler
func TestGetTaskStatus_Found(t *testing.T) {
	cleanup := setupTaskTestDB(t)
	defer cleanup()

	gin.SetMode(gin.TestMode)

	// Create a test task
	taskID := uuid.New().String()
	task := models.GenerationTask{
		TaskID:    taskID,
		Status:    models.TaskStatusProcessing,
		Type:      models.GenerationTypeCreate,
		Prompt:    "test prompt",
		StartedAt: time.Now(),
	}
	config.DB.Create(&task)

	r := gin.New()
	r.GET("/tasks/:id", GetTaskStatus)

	req, _ := http.NewRequest("GET", "/tasks/"+taskID, nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("期望状态码 200，实际为 %d", w.Code)
	}

	var response models.TaskResponse
	json.Unmarshal(w.Body.Bytes(), &response)

	if response.TaskID != taskID {
		t.Errorf("期望 TaskID %s，实际为 %s", taskID, response.TaskID)
	}
}

func TestGetTaskStatus_NotFound(t *testing.T) {
	cleanup := setupTaskTestDB(t)
	defer cleanup()

	gin.SetMode(gin.TestMode)

	r := gin.New()
	r.GET("/tasks/:id", GetTaskStatus)

	req, _ := http.NewRequest("GET", "/tasks/non-existent-id", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("期望状态码 404，实际为 %d", w.Code)
	}
}

func TestGetProcessingTasks_Empty(t *testing.T) {
	cleanup := setupTaskTestDB(t)
	defer cleanup()

	gin.SetMode(gin.TestMode)

	r := gin.New()
	r.GET("/tasks/processing", GetProcessingTasks)

	req, _ := http.NewRequest("GET", "/tasks/processing", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("期望状态码 200，实际为 %d", w.Code)
	}

	var response []models.TaskResponse
	json.Unmarshal(w.Body.Bytes(), &response)

	if len(response) != 0 {
		t.Errorf("期望空列表，实际有 %d 条记录", len(response))
	}
}


// **Feature: generation-persistence, Property 6: Task Timeout Cleanup**
// *For any* task that has been in "processing" status for more than 5 minutes,
// the task SHALL be marked as "failed" with a timeout error message.
// **Validates: Requirements 3.1, 3.2**
func TestProperty_TaskTimeoutCleanup(t *testing.T) {
	cleanup := setupTaskTestDB(t)
	defer cleanup()

	// Property: For any set of processing tasks with varying start times,
	// CleanupStaleTasks marks exactly those tasks older than 5 minutes as failed
	property := func(numRecent, numStale uint8) bool {
		// Limit to reasonable numbers
		numRecent = numRecent % 10
		numStale = numStale % 10

		// Clean up previous test data
		config.DB.Exec("DELETE FROM generation_tasks")

		now := time.Now()
		staleTime := now.Add(-6 * time.Minute) // 6 minutes ago (stale)
		recentTime := now.Add(-2 * time.Minute) // 2 minutes ago (recent)

		// Create recent processing tasks (should NOT be cleaned up)
		for i := uint8(0); i < numRecent; i++ {
			task := models.GenerationTask{
				TaskID:    uuid.New().String(),
				Status:    models.TaskStatusProcessing,
				Type:      models.GenerationTypeCreate,
				Prompt:    "recent task",
				StartedAt: recentTime,
			}
			config.DB.Create(&task)
		}

		// Create stale processing tasks (should be cleaned up)
		for i := uint8(0); i < numStale; i++ {
			task := models.GenerationTask{
				TaskID:    uuid.New().String(),
				Status:    models.TaskStatusProcessing,
				Type:      models.GenerationTypeCreate,
				Prompt:    "stale task",
				StartedAt: staleTime,
			}
			config.DB.Create(&task)
		}

		// Run cleanup
		rowsAffected, err := CleanupStaleTasks()
		if err != nil {
			return false
		}

		// Property assertions:
		// 1. Number of affected rows equals number of stale tasks
		if rowsAffected != int64(numStale) {
			return false
		}

		// 2. All stale tasks are now marked as failed with timeout error
		var staleTasks []models.GenerationTask
		config.DB.Where("prompt = ?", "stale task").Find(&staleTasks)
		for _, task := range staleTasks {
			if task.Status != models.TaskStatusFailed {
				return false
			}
			if task.ErrorMsg != "任务超时" {
				return false
			}
		}

		// 3. All recent tasks remain in processing status
		var recentTasks []models.GenerationTask
		config.DB.Where("prompt = ?", "recent task").Find(&recentTasks)
		for _, task := range recentTasks {
			if task.Status != models.TaskStatusProcessing {
				return false
			}
		}

		return true
	}

	if err := quick.Check(property, &quick.Config{MaxCount: 100}); err != nil {
		t.Errorf("Property 6 (Task Timeout Cleanup) failed: %v", err)
	}
}

// Test that completed and failed tasks are not affected by cleanup
func TestCleanupStaleTasks_IgnoresNonProcessingTasks(t *testing.T) {
	cleanup := setupTaskTestDB(t)
	defer cleanup()

	staleTime := time.Now().Add(-10 * time.Minute)

	// Create a stale completed task
	completedTask := models.GenerationTask{
		TaskID:    uuid.New().String(),
		Status:    models.TaskStatusCompleted,
		Type:      models.GenerationTypeCreate,
		Prompt:    "completed task",
		ImageURL:  "http://test.com/image.png",
		StartedAt: staleTime,
	}
	config.DB.Create(&completedTask)

	// Create a stale failed task
	failedTask := models.GenerationTask{
		TaskID:    uuid.New().String(),
		Status:    models.TaskStatusFailed,
		Type:      models.GenerationTypeCreate,
		Prompt:    "failed task",
		ErrorMsg:  "original error",
		StartedAt: staleTime,
	}
	config.DB.Create(&failedTask)

	// Run cleanup
	rowsAffected, err := CleanupStaleTasks()
	if err != nil {
		t.Fatalf("CleanupStaleTasks failed: %v", err)
	}

	// No rows should be affected
	if rowsAffected != 0 {
		t.Errorf("期望 0 行受影响，实际为 %d", rowsAffected)
	}

	// Verify completed task is unchanged
	var verifyCompleted models.GenerationTask
	config.DB.Where("task_id = ?", completedTask.TaskID).First(&verifyCompleted)
	if verifyCompleted.Status != models.TaskStatusCompleted {
		t.Errorf("已完成任务状态不应改变")
	}

	// Verify failed task is unchanged
	var verifyFailed models.GenerationTask
	config.DB.Where("task_id = ?", failedTask.TaskID).First(&verifyFailed)
	if verifyFailed.Status != models.TaskStatusFailed {
		t.Errorf("已失败任务状态不应改变")
	}
	if verifyFailed.ErrorMsg != "original error" {
		t.Errorf("已失败任务错误信息不应改变")
	}
}
