package main

import (
	"fmt"
	"io"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"

	"sigma/config"
	"sigma/handlers"
	"sigma/models"
	"sigma/utils"
)

func main() {
	// 初始化配置（配置通过环境变量和 config.json 加载）
	config.Init()

	// 生产环境禁用日志输出
	if config.IsProduction {
		log.SetOutput(io.Discard)
		gin.SetMode(gin.ReleaseMode)
	} else {
		// 开发环境：创建启动日志文件用于调试
		startupLogPath := "startup.log"
		if logDir := os.Getenv("LOG_DIR"); logDir != "" {
			startupLogPath = filepath.Join(logDir, "startup.log")
		}
		startupLog, logErr := os.OpenFile(startupLogPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
		if logErr == nil {
			defer startupLog.Close()
			log.SetOutput(startupLog)
			log.Println("========================================")
			log.Println("Backend starting at:", time.Now())
			if wd, wdErr := os.Getwd(); wdErr == nil {
				log.Println("Working directory:", wd)
			}
			log.Println("========================================")
		}

		// 记录配置信息
		log.Println("========================================")
		log.Println("SIGMA Backend 启动中...")
		log.Println("========================================")
	}

	config.LogConfig()

	// 创建必要的目录
	log.Println("创建必要的目录结构...")
	if err := os.MkdirAll(config.OutputDir, 0755); err != nil {
		log.Fatalf("无法创建输出目录 %s: %v", config.OutputDir, err)
	}
	log.Printf("✓ 输出目录: %s", config.OutputDir)

	if err := os.MkdirAll(config.UploadDir, 0755); err != nil {
		log.Fatalf("无法创建上传目录 %s: %v", config.UploadDir, err)
	}
	log.Printf("✓ 上传目录: %s", config.UploadDir)

	// 验证数据库路径的父目录存在
	dbDir := filepath.Dir(config.DBPath)
	if dbDir != "" && dbDir != "." {
		if err := os.MkdirAll(dbDir, 0755); err != nil {
			log.Fatalf("无法创建数据库目录 %s: %v", dbDir, err)
		}
		log.Printf("✓ 数据库目录: %s", dbDir)
	}
	log.Printf("✓ 数据库路径: %s", config.DBPath)

	// 初始化数据库
	var err error
	config.DB, err = gorm.Open(sqlite.Open(config.DBPath), &gorm.Config{})
	if err != nil {
		log.Fatal("无法连接数据库:", err)
	}
	config.DB.AutoMigrate(&models.GenerationHistory{}, &models.GenerationStats{}, &models.GenerationTask{}, &config.AppConfig{})

	// 数据库初始化后，重新加载配置（从数据库加载）
	if err := config.LoadPersistentConfig(); err != nil {
		log.Printf("警告: 从数据库加载配置失败: %v", err)
	}

	// 如果有 API Key 但平台是默认值，尝试自动检测平台
	// 这处理老版本迁移过来没有平台信息的情况
	if config.GetAPIToken() != "" && config.GetAPIPlatform() == config.PlatformVectorEngine {
		log.Println("检测到 API Key，正在自动检测平台...")
		handlers.AutoDetectAndSetPlatform(config.GetAPIToken())
	}

	// 启动时清理超时的任务
	cleanedCount, cleanErr := handlers.CleanupStaleTasks()
	if cleanErr != nil {
		log.Printf("警告: 清理超时任务失败: %v", cleanErr)
	} else if cleanedCount > 0 {
		log.Printf("✓ 已清理 %d 个超时任务", cleanedCount)
	}

	// 创建 Gin 路由
	r := gin.Default()

	// CORS 中间件 - 支持 HTTPS
	r.Use(func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}
		c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "*")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// 静态文件服务
	r.Static("/images", config.OutputDir)
	r.Static("/uploads", config.UploadDir)

	// API 路由
	r.GET("/config/check", handlers.CheckConfigHandler)
	r.POST("/config/apikey", handlers.SetApiKeyHandler)
	r.POST("/config/apikey/validate", handlers.ValidateApiKeyHandler)
	r.POST("/config/disclaimer", handlers.SetDisclaimerHandler)
	r.POST("/generate", handlers.GenerateHandler)
	r.GET("/history", handlers.HistoryHandler)

	// 统计接口
	r.GET("/stats/generation-count", handlers.GetGenerationCountHandler)
	r.POST("/stats/increment-count", handlers.IncrementGenerationCountHandler)

	// 白底图历史接口
	r.GET("/history/white-background", handlers.WhiteBackgroundHistoryHandler)

	// 换装历史接口
	r.GET("/history/clothing-change", handlers.ClothingChangeHistoryHandler)

	// 一键商品图历史接口
	r.GET("/history/product-scene", handlers.ProductSceneHistoryHandler)

	// 光影融合历史接口
	r.GET("/history/light-shadow", handlers.LightShadowHistoryHandler)

	// 历史记录删除接口
	r.DELETE("/history/:id", handlers.DeleteHistoryHandler)
	r.POST("/history/batch-delete", handlers.BatchDeleteHistoryHandler)
	r.DELETE("/history/batch/:batch_id", handlers.DeleteHistoryByBatchHandler)
	r.DELETE("/history/date/:date", handlers.DeleteHistoryByDateHandler)

	// 任务管理接口
	r.GET("/tasks/processing", handlers.GetProcessingTasks)
	r.GET("/tasks/:id", handlers.GetTaskStatus)

	// 确定实际使用的端口
	var actualPort int
	defaultPort, _ := strconv.Atoi(config.ServerPort)

	if config.AutoPortDiscovery {
		// 启用自动端口发现
		foundPort, err := utils.FindAvailablePort(defaultPort, config.MaxPortAttempts)
		if err != nil {
			log.Fatalf("无法找到可用端口: %v", err)
		}
		actualPort = foundPort

		// 写入端口文件
		if err := utils.WritePortFile(actualPort, config.PortFileName); err != nil {
			log.Printf("警告: 无法写入端口文件: %v", err)
		}
	} else {
		// 禁用自动端口发现，只尝试配置的端口
		if !utils.IsPortAvailable(defaultPort) {
			log.Fatalf("端口 %d 已被占用，且自动端口发现已禁用", defaultPort)
		}
		actualPort = defaultPort
	}

	// 保存实际端口到配置和环境变量（供 GetBaseURL 使用）
	config.ActualPort = actualPort
	os.Setenv("ACTUAL_PORT", strconv.Itoa(actualPort))

	// 设置清理处理器
	setupCleanupHandler()

	// 使用 HTTP 启动服务器（本地通信不需要 HTTPS）
	addr := fmt.Sprintf(":%d", actualPort)
	fmt.Printf("服务启动: http://localhost:%d\n", actualPort)
	if err := r.Run(addr); err != nil {
		log.Fatalf("服务器启动失败: %v", err)
	}
}

// setupCleanupHandler 设置优雅退出的清理处理器
func setupCleanupHandler() {
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-c
		// 清理端口文件
		if config.AutoPortDiscovery {
			portFilePath := utils.GetPortFilePath(config.PortFileName)
			if err := os.Remove(portFilePath); err != nil {
				log.Printf("警告: 无法删除端口文件: %v", err)
			}
		}
		os.Exit(0)
	}()
}
