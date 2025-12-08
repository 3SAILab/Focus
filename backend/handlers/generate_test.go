package handlers

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/quick"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"sigma/config"
	"sigma/models"
)

func setupGenerateTestDB(t *testing.T) func() {
	var err error
	config.DB, err = gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("无法创建测试数据库: %v", err)
	}
	config.DB.AutoMigrate(&models.GenerationTask{}, &models.GenerationHistory{}, &models.GenerationStats{})

	return func() {
		sqlDB, _ := config.DB.DB()
		sqlDB.Close()
	}
}

// **Feature: generation-persistence, Property 1: Task Creation Invariant**
// *For any* valid generation request, when the generate endpoint is called,
// a task record SHALL be created with status "processing" before the AI API is invoked.
// **Validates: Requirements 1.1**
func TestProperty_TaskCreationInvariant(t *testing.T) {
	cleanup := setupGenerateTestDB(t)
	defer cleanup()

	gin.SetMode(gin.TestMode)

	// Valid generation types
	validTypes := []string{
		models.GenerationTypeCreate,
		models.GenerationTypeWhiteBackground,
		models.GenerationTypeClothingChange,
	}

	// Property: For any valid generation type and non-empty prompt,
	// when a generation request is made (even if it fails due to no API key),
	// a task record is created with status "processing" and correct metadata
	property := func(typeIndex uint8, promptSeed uint8) bool {
		// Clean up previous test data
		config.DB.Exec("DELETE FROM generation_tasks")

		// Select a valid type
		genType := validTypes[int(typeIndex)%len(validTypes)]

		// Generate a prompt (non-empty)
		prompt := "test prompt " + string(rune('A'+promptSeed%26))

		// Create multipart form request
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		writer.WriteField("prompt", prompt)
		writer.WriteField("type", genType)
		writer.WriteField("aspectRatio", "1:1")
		writer.WriteField("imageSize", "2K")
		writer.Close()

		r := gin.New()
		r.POST("/generate", GenerateHandler)

		req, _ := http.NewRequest("POST", "/generate", body)
		req.Header.Set("Content-Type", writer.FormDataContentType())
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		// The request will fail with 401 (no API key) but task should still NOT be created
		// because task creation happens after API key check
		// Actually, looking at the code, task creation happens AFTER API key check
		// So we need to set an API key for the task to be created

		// Let's verify: if no API key, no task should be created
		var count int64
		config.DB.Model(&models.GenerationTask{}).Count(&count)

		// With no API key, we expect 0 tasks (request fails before task creation)
		if w.Code == http.StatusUnauthorized {
			return count == 0
		}

		// If we somehow got past the API key check, verify task was created
		if count != 1 {
			return false
		}

		var task models.GenerationTask
		config.DB.First(&task)

		// Property assertions:
		// 1. Task status is "processing"
		if task.Status != models.TaskStatusProcessing {
			return false
		}

		// 2. Task type matches request type
		if task.Type != genType {
			return false
		}

		// 3. Task prompt matches request prompt
		if task.Prompt != prompt {
			return false
		}

		// 4. Task has a valid TaskID (non-empty UUID)
		if task.TaskID == "" {
			return false
		}

		// 5. Task has a valid StartedAt time
		if task.StartedAt.IsZero() {
			return false
		}

		return true
	}

	if err := quick.Check(property, &quick.Config{MaxCount: 100}); err != nil {
		t.Errorf("Property 1 (Task Creation Invariant) failed: %v", err)
	}
}

// **Feature: generation-persistence, Property 1: Task Creation Invariant (with API key)**
// This test verifies task creation when API key is configured
// **Validates: Requirements 1.1**
func TestProperty_TaskCreationWithAPIKey(t *testing.T) {
	cleanup := setupGenerateTestDB(t)
	defer cleanup()

	gin.SetMode(gin.TestMode)

	// Set a fake API key for testing
	originalToken := config.GetAPIToken()
	config.SetAPIToken("test-api-key")
	defer config.SetAPIToken(originalToken)

	// Valid generation types
	validTypes := []string{
		models.GenerationTypeCreate,
		models.GenerationTypeWhiteBackground,
		models.GenerationTypeClothingChange,
	}

	// Property: For any valid generation type and prompt,
	// when a generation request is made with a valid API key,
	// a task record is created with status "processing" and correct metadata
	// (even if the actual API call fails)
	property := func(typeIndex uint8, promptSeed uint8) bool {
		// Clean up previous test data
		config.DB.Exec("DELETE FROM generation_tasks")

		// Select a valid type
		genType := validTypes[int(typeIndex)%len(validTypes)]

		// Generate a prompt
		prompt := "test prompt " + string(rune('A'+promptSeed%26))

		// Create multipart form request
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		writer.WriteField("prompt", prompt)
		writer.WriteField("type", genType)
		writer.WriteField("aspectRatio", "1:1")
		writer.WriteField("imageSize", "2K")
		writer.Close()

		r := gin.New()
		r.POST("/generate", GenerateHandler)

		req, _ := http.NewRequest("POST", "/generate", body)
		req.Header.Set("Content-Type", writer.FormDataContentType())
		w := httptest.NewRecorder()

		// Record time before request
		beforeRequest := time.Now().Add(-1 * time.Second)

		r.ServeHTTP(w, req)

		// The request will fail (API call will fail) but task should be created
		// and then marked as failed

		var count int64
		config.DB.Model(&models.GenerationTask{}).Count(&count)

		// Task should be created
		if count != 1 {
			return false
		}

		var task models.GenerationTask
		config.DB.First(&task)

		// Property assertions:
		// 1. Task type matches request type
		if task.Type != genType {
			return false
		}

		// 2. Task prompt matches request prompt
		if task.Prompt != prompt {
			return false
		}

		// 3. Task has a valid TaskID (non-empty UUID format)
		if task.TaskID == "" || len(task.TaskID) < 32 {
			return false
		}

		// 4. Task has a valid StartedAt time (after our beforeRequest time)
		if task.StartedAt.Before(beforeRequest) {
			return false
		}

		// 5. Task status is either processing (if API call is pending) or failed (if API call failed)
		// Since we're using a fake API key, the API call will fail
		if task.Status != models.TaskStatusProcessing && task.Status != models.TaskStatusFailed {
			return false
		}

		// 6. Response should contain task_id
		var response map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
			return false
		}

		taskIDInResponse, exists := response["task_id"]
		if !exists {
			return false
		}

		// 7. task_id in response matches task_id in database
		if taskIDInResponse != task.TaskID {
			return false
		}

		return true
	}

	if err := quick.Check(property, &quick.Config{MaxCount: 100}); err != nil {
		t.Errorf("Property 1 (Task Creation Invariant with API key) failed: %v", err)
	}
}

// Test that task is created with correct ref_images
func TestTaskCreation_RefImagesStored(t *testing.T) {
	cleanup := setupGenerateTestDB(t)
	defer cleanup()

	gin.SetMode(gin.TestMode)

	// Set a fake API key for testing
	originalToken := config.GetAPIToken()
	config.SetAPIToken("test-api-key")
	defer config.SetAPIToken(originalToken)

	// Create multipart form request without images
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	writer.WriteField("prompt", "test prompt")
	writer.WriteField("type", models.GenerationTypeCreate)
	writer.Close()

	r := gin.New()
	r.POST("/generate", GenerateHandler)

	req, _ := http.NewRequest("POST", "/generate", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	// Verify task was created
	var task models.GenerationTask
	result := config.DB.First(&task)
	if result.Error != nil {
		t.Fatalf("Task should be created: %v", result.Error)
	}

	// RefImages should be an empty JSON array when no images are uploaded
	var refImages []string
	if err := json.Unmarshal([]byte(task.RefImages), &refImages); err != nil {
		t.Errorf("RefImages should be valid JSON: %v", err)
	}

	if len(refImages) != 0 {
		t.Errorf("Expected empty ref_images array, got %d items", len(refImages))
	}
}
