package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"sigma/config"
	"sigma/models"
)

func setupTestDB(t *testing.T) func() {
	var err error
	config.DB, err = gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("无法创建测试数据库: %v", err)
	}
	config.DB.AutoMigrate(&models.GenerationHistory{}, &models.GenerationStats{})
	
	return func() {
		sqlDB, _ := config.DB.DB()
		sqlDB.Close()
	}
}

func TestGetGenerationCountHandler_Empty(t *testing.T) {
	cleanup := setupTestDB(t)
	defer cleanup()
	
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/stats/generation-count", GetGenerationCountHandler)
	
	req, _ := http.NewRequest("GET", "/stats/generation-count", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	
	if w.Code != http.StatusOK {
		t.Errorf("期望状态码 200，实际为 %d", w.Code)
	}
	
	var response models.GenerationStatsResponse
	json.Unmarshal(w.Body.Bytes(), &response)
	
	if response.TotalCount != 0 {
		t.Errorf("期望计数为 0，实际为 %d", response.TotalCount)
	}
}

func TestIncrementGenerationCountHandler(t *testing.T) {
	cleanup := setupTestDB(t)
	defer cleanup()
	
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/stats/increment-count", IncrementGenerationCountHandler)
	r.GET("/stats/generation-count", GetGenerationCountHandler)
	
	// 第一次增加
	req1, _ := http.NewRequest("POST", "/stats/increment-count", nil)
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)
	
	if w1.Code != http.StatusOK {
		t.Errorf("期望状态码 200，实际为 %d", w1.Code)
	}
	
	var response1 models.GenerationStatsResponse
	json.Unmarshal(w1.Body.Bytes(), &response1)
	
	if response1.TotalCount != 1 {
		t.Errorf("第一次增加后期望计数为 1，实际为 %d", response1.TotalCount)
	}
	
	// 第二次增加
	req2, _ := http.NewRequest("POST", "/stats/increment-count", nil)
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)
	
	var response2 models.GenerationStatsResponse
	json.Unmarshal(w2.Body.Bytes(), &response2)
	
	if response2.TotalCount != 2 {
		t.Errorf("第二次增加后期望计数为 2，实际为 %d", response2.TotalCount)
	}
	
	// 验证 GET 接口返回正确计数
	req3, _ := http.NewRequest("GET", "/stats/generation-count", nil)
	w3 := httptest.NewRecorder()
	r.ServeHTTP(w3, req3)
	
	var response3 models.GenerationStatsResponse
	json.Unmarshal(w3.Body.Bytes(), &response3)
	
	if response3.TotalCount != 2 {
		t.Errorf("GET 接口期望计数为 2，实际为 %d", response3.TotalCount)
	}
}
