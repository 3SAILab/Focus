package config

import (
	"encoding/base64"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"gorm.io/gorm"
	"sigma/utils"
)

var (
	// ConfigLogger 配置专用日志记录器（始终写入文件）
	ConfigLogger *log.Logger
)

var (
	// APIToken API 密钥
	APIToken string
	
	// APIMutex 用于安全读写 API Token
	APIMutex sync.RWMutex
	
	// DisclaimerAgreed 免责声明是否已同意
	DisclaimerAgreed bool
	
	// DisclaimerMutex 用于安全读写免责声明状态
	DisclaimerMutex sync.RWMutex
	
	// OutputDir 输出目录
	OutputDir string
	
	// UploadDir 上传目录
	UploadDir string
	
	// DBPath 数据库路径
	DBPath string
	
	// ServerPort 服务器端口（配置值）
	ServerPort string
	
	// ActualPort 实际使用的端口（运行时确定）
	ActualPort int
	
	// AutoPortDiscovery 是否启用自动端口发现
	AutoPortDiscovery bool
	
	// MaxPortAttempts 最大端口尝试次数
	MaxPortAttempts int
	
	// PortFileName 端口文件名
	PortFileName string
	
	// IsProduction 是否为生产环境
	IsProduction bool
	
	// DB 数据库实例
	DB *gorm.DB
	
	// AIServiceURL AI 服务 API 地址
	AIServiceURL string
	
	// SensitiveKeywords 敏感关键词列表（用于过滤错误信息）
	SensitiveKeywords []string
)

// AppConfig 应用配置数据库模型
type AppConfig struct {
	ID               uint   `gorm:"primaryKey"`
	ConfigKey        string `gorm:"uniqueIndex;size:100"`
	ConfigValue      string `gorm:"size:500"`
	EncryptedValue   string `gorm:"size:1000"` // 用于存储加密的敏感数据
}

// ServiceConfig 服务配置（从环境变量或内置配置加载）
type ServiceConfig struct {
	APIURL            string   `json:"api_url"`
	SensitiveKeywords []string `json:"sensitive_keywords"`
}

// 默认服务配置（编译时内置，base64 编码以增加逆向难度）
var defaultServiceConfig = ServiceConfig{
	// API URL 通过环境变量覆盖，这里设置默认值
	// 生产环境使用高清模型（支持 2K/4K 清晰度）
	APIURL: decodeConfig("aHR0cHM6Ly9hcGkudmVjdG9yZW5naW5lLmFpL3YxYmV0YS9tb2RlbHMvZ2VtaW5pLTMtcHJvLWltYWdlLXByZXZpZXc6Z2VuZXJhdGVDb250ZW50"),
	// 敏感关键词列表
	SensitiveKeywords: []string{
		"gemini", "gemini-3", "gemini3", "gemini-pro", 
		"gemini3pro", "gemini-3-pro", "image-preview",
		"gemini-3-pro-image-preview", "models/", "vectorengine",
	},
}

// 开发环境服务配置
// 使用 gemini-2.5-image-preview 模型（测试用，便宜）
var devServiceConfig = ServiceConfig{
	// 开发环境 API URL（base64 编码）
	APIURL: decodeConfig("aHR0cHM6Ly9hcGkudmVjdG9yZW5naW5lLmFpL3YxYmV0YS9tb2RlbHMvZ2VtaW5pLTIuNS1pbWFnZS1wcmV2aWV3OmdlbmVyYXRlQ29udGVudA=="),
	SensitiveKeywords: []string{
		"gemini", "gemini-2.5", "gemini2.5", "image-preview",
		"gemini-2.5-image-preview", "models/", "vectorengine",
	},
}

// decodeConfig 解码 base64 配置
func decodeConfig(encoded string) string {
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return ""
	}
	return string(decoded)
}

// initConfigLogger 初始化配置日志记录器
func initConfigLogger() {
	logDir := os.Getenv("LOG_DIR")
	if logDir == "" {
		logDir = "./logs"
	}
	
	// 确保日志目录存在
	os.MkdirAll(logDir, 0755)
	
	logPath := filepath.Join(logDir, "config.log")
	logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		// 如果无法创建日志文件，使用标准输出
		ConfigLogger = log.New(os.Stdout, "[Config] ", log.LstdFlags)
		return
	}
	
	ConfigLogger = log.New(logFile, "[Config] ", log.LstdFlags)
}

// configLog 记录配置日志（仅在非生产环境记录）
func configLog(format string, args ...interface{}) {
	// 生产环境下禁用配置日志
	if IsProduction {
		return
	}
	if ConfigLogger == nil {
		initConfigLogger()
	}
	ConfigLogger.Printf(format, args...)
}

// Init 初始化配置
func Init() {
	// 检测生产环境
	prodStr := utils.GetEnvOrDefault("PRODUCTION", "false")
	IsProduction = prodStr == "true" || prodStr == "1"
	
	// 生产环境下不初始化配置日志
	if !IsProduction {
		initConfigLogger()
		configLog("========================================")
		configLog("配置初始化开始 - %s", time.Now().Format("2006-01-02 15:04:05"))
		configLog("========================================")
		
		// 记录当前工作目录
		if wd, err := os.Getwd(); err == nil {
			configLog("当前工作目录: %s", wd)
		}
		
		// 记录可执行文件路径
		if exePath, err := os.Executable(); err == nil {
			configLog("可执行文件路径: %s", exePath)
		}
	}
	
	OutputDir = utils.GetEnvOrDefault("OUTPUT_DIR", "./output")
	UploadDir = utils.GetEnvOrDefault("UPLOAD_DIR", "./uploads")
	DBPath = utils.GetEnvOrDefault("DB_PATH", "./history.db")
	ServerPort = utils.GetEnvOrDefault("PORT", "8080")
	
	configLog("环境变量配置:")
	configLog("  OUTPUT_DIR: %s (env: %s)", OutputDir, os.Getenv("OUTPUT_DIR"))
	configLog("  UPLOAD_DIR: %s (env: %s)", UploadDir, os.Getenv("UPLOAD_DIR"))
	configLog("  DB_PATH: %s (env: %s)", DBPath, os.Getenv("DB_PATH"))
	configLog("  PORT: %s (env: %s)", ServerPort, os.Getenv("PORT"))
	
	// 先从环境变量读取（作为默认值）
	envAPIKey := os.Getenv("API_KEY")
	APIToken = envAPIKey
	configLog("环境变量 API_KEY: %s", maskAPIKey(envAPIKey))
	
	// 免责声明状态
	disclaimerStr := utils.GetEnvOrDefault("DISCLAIMER_AGREED", "false")
	DisclaimerAgreed = disclaimerStr == "true" || disclaimerStr == "1"
	configLog("环境变量 DISCLAIMER_AGREED: %s -> %v", disclaimerStr, DisclaimerAgreed)
	
	// 注意：配置将在数据库初始化后从数据库加载
	configLog("配置将在数据库初始化后加载")
	
	// 自动端口发现配置 (默认启用)
	autoDiscoveryStr := utils.GetEnvOrDefault("AUTO_PORT_DISCOVERY", "true")
	AutoPortDiscovery = autoDiscoveryStr == "true" || autoDiscoveryStr == "1"
	
	MaxPortAttempts = 10
	PortFileName = "sigma-backend.port"
	
	configLog("生产环境: %v (env PRODUCTION=%s)", IsProduction, prodStr)
	
	// AI 服务配置（优先从环境变量读取，否则根据环境使用不同默认值）
	AIServiceURL = os.Getenv("AI_SERVICE_URL")
	if AIServiceURL == "" {
		if IsProduction {
			// 生产环境使用高清模型（支持 2K/4K 清晰度）
			AIServiceURL = defaultServiceConfig.APIURL
			SensitiveKeywords = defaultServiceConfig.SensitiveKeywords
			configLog("使用生产环境 AI 模型: sigma-image")
		} else {
			// 开发/测试环境使用快速模型（便宜、1K 分辨率）
			AIServiceURL = devServiceConfig.APIURL
			SensitiveKeywords = devServiceConfig.SensitiveKeywords
			configLog("使用开发环境 AI 模型: sigma-flash-image")
		}
	} else {
		SensitiveKeywords = defaultServiceConfig.SensitiveKeywords
	}
	
	configLog("========================================")
	configLog("配置初始化完成")
	configLog("========================================")
}

// maskAPIKey 遮蔽 API Key 用于日志显示
func maskAPIKey(key string) string {
	if key == "" {
		return "(空)"
	}
	if len(key) <= 8 {
		return "****"
	}
	return key[:4] + "****" + key[len(key)-4:]
}

// GetAIServiceURL 获取 AI 服务 URL
func GetAIServiceURL() string {
	return AIServiceURL
}

// FilterSensitiveInfo 过滤错误信息中的敏感关键词
func FilterSensitiveInfo(message string) string {
	lowerMessage := strings.ToLower(message)
	
	for _, keyword := range SensitiveKeywords {
		if strings.Contains(lowerMessage, strings.ToLower(keyword)) {
			return "服务器负载异常，不会消耗次数，请重试，多次出现请联系销售获取帮助"
		}
	}
	
	return message
}

// InitConfigTable 初始化配置表
func InitConfigTable(db *gorm.DB) error {
	if db == nil {
		return fmt.Errorf("数据库连接为空")
	}
	
	// 自动迁移配置表
	if err := db.AutoMigrate(&AppConfig{}); err != nil {
		return fmt.Errorf("创建配置表失败: %w", err)
	}
	
	configLog("配置表初始化成功")
	return nil
}

// getConfigFromDB 从数据库获取配置值
func getConfigFromDB(key string) (string, bool) {
	if DB == nil {
		return "", false
	}
	
	var cfg AppConfig
	result := DB.Where("config_key = ?", key).First(&cfg)
	if result.Error != nil {
		return "", false
	}
	
	// 如果有加密值，优先返回加密值（API Key 等敏感数据）
	if cfg.EncryptedValue != "" {
		return cfg.EncryptedValue, true
	}
	return cfg.ConfigValue, true
}

// setConfigInDB 设置数据库配置值
func setConfigInDB(key, value string, encrypted bool) error {
	if DB == nil {
		return fmt.Errorf("数据库连接为空")
	}
	
	var cfg AppConfig
	result := DB.Where("config_key = ?", key).First(&cfg)
	
	if result.Error != nil {
		// 不存在，创建新记录
		cfg = AppConfig{ConfigKey: key}
		if encrypted {
			cfg.EncryptedValue = value
		} else {
			cfg.ConfigValue = value
		}
		return DB.Create(&cfg).Error
	}
	
	// 存在，更新记录
	if encrypted {
		cfg.EncryptedValue = value
		cfg.ConfigValue = ""
	} else {
		cfg.ConfigValue = value
		cfg.EncryptedValue = ""
	}
	return DB.Save(&cfg).Error
}

// LoadPersistentConfig 从数据库加载持久化配置
func LoadPersistentConfig() error {
	configLog("从数据库加载配置...")
	
	// 数据库必须已初始化
	if DB == nil {
		configLog("数据库未初始化，跳过配置加载")
		return fmt.Errorf("数据库未初始化")
	}
	
	// 初始化配置表
	if err := InitConfigTable(DB); err != nil {
		configLog("初始化配置表失败: %v", err)
		return err
	}
	
	// 加载 API Key
	if apiKey, found := getConfigFromDB("api_key"); found && apiKey != "" {
		APIMutex.Lock()
		APIToken = apiKey
		APIMutex.Unlock()
		configLog("从数据库加载 API Key: %s", maskAPIKey(apiKey))
	} else {
		configLog("数据库中无 API Key 配置")
	}
	
	// 加载免责声明状态
	if disclaimerStr, found := getConfigFromDB("disclaimer_agreed"); found {
		DisclaimerMutex.Lock()
		DisclaimerAgreed = disclaimerStr == "true" || disclaimerStr == "1"
		DisclaimerMutex.Unlock()
		configLog("从数据库加载免责声明状态: %v", DisclaimerAgreed)
	} else {
		configLog("数据库中无免责声明配置")
	}
	
	configLog("数据库配置加载完成")
	return nil
}

// SavePersistentConfig 保存持久化配置到数据库
func SavePersistentConfig() error {
	configLog("保存配置到数据库...")
	
	// 数据库必须已初始化
	if DB == nil {
		configLog("数据库未初始化，无法保存配置")
		return fmt.Errorf("数据库未初始化")
	}
	
	apiKey := GetAPIToken()
	disclaimerAgreed := GetDisclaimerAgreed()
	
	configLog("保存配置内容:")
	configLog("  api_key: %s", maskAPIKey(apiKey))
	configLog("  disclaimer_agreed: %v", disclaimerAgreed)
	
	// 保存 API Key（作为敏感数据）
	if err := setConfigInDB("api_key", apiKey, true); err != nil {
		configLog("保存 API Key 到数据库失败: %v", err)
		return fmt.Errorf("保存 API Key 失败: %w", err)
	}
	
	// 保存免责声明状态
	disclaimerStr := "false"
	if disclaimerAgreed {
		disclaimerStr = "true"
	}
	if err := setConfigInDB("disclaimer_agreed", disclaimerStr, false); err != nil {
		configLog("保存免责声明状态到数据库失败: %v", err)
		return fmt.Errorf("保存免责声明状态失败: %w", err)
	}
	
	configLog("配置保存到数据库成功")
	return nil
}

// LogConfig 记录配置信息用于调试 (仅在非生产环境输出)
func LogConfig() {
	if IsProduction {
		return
	}
	fmt.Println("配置信息:")
	fmt.Println("  - 输出目录:", OutputDir)
	fmt.Println("  - 上传目录:", UploadDir)
	fmt.Println("  - 数据库路径:", DBPath)
	fmt.Println("  - 服务器端口:", ServerPort)
	fmt.Println("  - 自动端口发现:", boolToString(AutoPortDiscovery))
}

func boolToString(b bool) string {
	if b {
		return "是"
	}
	return "否"
}

// GetAPIToken 安全获取 API Token
func GetAPIToken() string {
	APIMutex.RLock()
	defer APIMutex.RUnlock()
	return APIToken
}

// SetAPIToken 安全设置 API Token 并持久化
func SetAPIToken(token string) {
	APIMutex.Lock()
	APIToken = token
	APIMutex.Unlock()
	
	// 保存到配置文件
	if err := SavePersistentConfig(); err != nil {
		fmt.Println("[Config] 保存 API Token 失败:", err)
	}
}

// GetDisclaimerAgreed 安全获取免责声明状态
func GetDisclaimerAgreed() bool {
	DisclaimerMutex.RLock()
	defer DisclaimerMutex.RUnlock()
	return DisclaimerAgreed
}

// SetDisclaimerAgreed 安全设置免责声明状态并持久化
func SetDisclaimerAgreed(agreed bool) {
	DisclaimerMutex.Lock()
	DisclaimerAgreed = agreed
	DisclaimerMutex.Unlock()
	
	// 保存到配置文件
	if err := SavePersistentConfig(); err != nil {
		fmt.Println("[Config] 保存免责声明状态失败:", err)
	}
}

