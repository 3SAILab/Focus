package config

import (
	"os"
	"sync"
	"gorm.io/gorm"
	"sigma/utils"
)

var (
	// APIToken API 密钥
	APIToken string
	
	// APIMutex 用于安全读写 API Token
	APIMutex sync.RWMutex
	
	// OutputDir 输出目录
	OutputDir string
	
	// UploadDir 上传目录
	UploadDir string
	
	// DBPath 数据库路径
	DBPath string
	
	// ServerPort 服务器端口
	ServerPort string
	
	// AutoPortDiscovery 是否启用自动端口发现
	AutoPortDiscovery bool
	
	// MaxPortAttempts 最大端口尝试次数
	MaxPortAttempts int
	
	// PortFileName 端口文件名
	PortFileName string
	
	// DB 数据库实例
	DB *gorm.DB
)

// Init 初始化配置
func Init() {
	OutputDir = utils.GetEnvOrDefault("OUTPUT_DIR", "./output")
	UploadDir = utils.GetEnvOrDefault("UPLOAD_DIR", "./uploads")
	DBPath = utils.GetEnvOrDefault("DB_PATH", "./history.db")
	ServerPort = utils.GetEnvOrDefault("PORT", "8080")
	APIToken = os.Getenv("API_KEY")
	
	// 自动端口发现配置 (默认启用)
	autoDiscoveryStr := utils.GetEnvOrDefault("AUTO_PORT_DISCOVERY", "true")
	AutoPortDiscovery = autoDiscoveryStr == "true" || autoDiscoveryStr == "1"
	
	MaxPortAttempts = 10
	PortFileName = "sigma-backend.port"
}

// GetAPIToken 安全获取 API Token
func GetAPIToken() string {
	APIMutex.RLock()
	defer APIMutex.RUnlock()
	return APIToken
}

// SetAPIToken 安全设置 API Token
func SetAPIToken(token string) {
	APIMutex.Lock()
	defer APIMutex.Unlock()
	APIToken = token
}

