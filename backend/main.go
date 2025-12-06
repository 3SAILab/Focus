package main

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"strconv"
	"syscall"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"sigma/config"
	"sigma/handlers"
	"sigma/models"
	"sigma/utils"
)

func main() {
	_ = godotenv.Load()

	// 初始化配置
	config.Init()

	// 创建必要的目录
	os.MkdirAll(config.OutputDir, 0755)
	os.MkdirAll(config.UploadDir, 0755)

	// 初始化数据库
	var err error
	config.DB, err = gorm.Open(sqlite.Open(config.DBPath), &gorm.Config{})
	if err != nil {
		log.Fatal("无法连接数据库:", err)
	}
	config.DB.AutoMigrate(&models.GenerationHistory{})

	// 创建 Gin 路由
	r := gin.Default()

	// CORS 中间件
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
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
	r.POST("/generate", handlers.GenerateHandler)
	r.GET("/history", handlers.HistoryHandler)

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
	
	// 设置清理处理器
	setupCleanupHandler()
	
	// 启动服务器
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
