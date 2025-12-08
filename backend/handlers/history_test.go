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

func setupHistoryTestDB(t *testing.T) func() {
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

func TestWhiteBackgroundHistoryHandler_Empty(t *testing.T) {
	cleanup := setupHistoryTestDB(t)
	defer cleanup()
	
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/history/white-background", WhiteBackgroundHistoryHandler)
	
	req, _ := http.NewRequest("GET", "/history/white-background", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	
	if w.Code != http.StatusOK {
		t.Errorf("期望状态码 200，实际为 %d", w.Code)
	}
	
	var response []models.GenerationHistoryResponse
	json.Unmarshal(w.Body.Bytes(), &response)
	
	if len(response) != 0 {
		t.Errorf("期望空列表，实际有 %d 条记录", len(response))
	}
}

func TestWhiteBackgroundHistoryHandler_FiltersByType(t *testing.T) {
	cleanup := setupHistoryTestDB(t)
	defer cleanup()
	
	// 创建测试数据
	createRecord := models.GenerationHistory{
		Prompt:   "创作测试",
		ImageURL: "http://test.com/create.png",
		FileName: "create.png",
		Type:     models.GenerationTypeCreate,
	}
	config.DB.Create(&createRecord)
	
	whiteBackgroundRecord := models.GenerationHistory{
		Prompt:   "白底图测试",
		ImageURL: "http://test.com/white.png",
		FileName: "white.png",
		Type:     models.GenerationTypeWhiteBackground,
	}
	config.DB.Create(&whiteBackgroundRecord)
	
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/history/white-background", WhiteBackgroundHistoryHandler)
	
	req, _ := http.NewRequest("GET", "/history/white-background", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	
	if w.Code != http.StatusOK {
		t.Errorf("期望状态码 200，实际为 %d", w.Code)
	}
	
	var response []models.GenerationHistoryResponse
	json.Unmarshal(w.Body.Bytes(), &response)
	
	if len(response) != 1 {
		t.Errorf("期望 1 条白底图记录，实际有 %d 条", len(response))
	}
	
	if len(response) > 0 && response[0].Type != models.GenerationTypeWhiteBackground {
		t.Errorf("期望类型为 white_background，实际为 %s", response[0].Type)
	}
}

func TestHistoryHandler_TypeFilter(t *testing.T) {
	cleanup := setupHistoryTestDB(t)
	defer cleanup()
	
	// 创建测试数据
	createRecord := models.GenerationHistory{
		Prompt:   "创作测试",
		ImageURL: "http://test.com/create.png",
		FileName: "create.png",
		Type:     models.GenerationTypeCreate,
	}
	config.DB.Create(&createRecord)
	
	whiteBackgroundRecord := models.GenerationHistory{
		Prompt:   "白底图测试",
		ImageURL: "http://test.com/white.png",
		FileName: "white.png",
		Type:     models.GenerationTypeWhiteBackground,
	}
	config.DB.Create(&whiteBackgroundRecord)
	
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/history", HistoryHandler)
	
	// 测试筛选创作类型
	req1, _ := http.NewRequest("GET", "/history?type=create", nil)
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)
	
	var response1 []models.GenerationHistoryResponse
	json.Unmarshal(w1.Body.Bytes(), &response1)
	
	if len(response1) != 1 {
		t.Errorf("筛选 create 类型期望 1 条记录，实际有 %d 条", len(response1))
	}
	
	// 测试不筛选（返回全部）
	req2, _ := http.NewRequest("GET", "/history", nil)
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)
	
	var response2 []models.GenerationHistoryResponse
	json.Unmarshal(w2.Body.Bytes(), &response2)
	
	if len(response2) != 2 {
		t.Errorf("不筛选期望 2 条记录，实际有 %d 条", len(response2))
	}
}
