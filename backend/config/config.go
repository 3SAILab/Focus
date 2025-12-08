package config

import (
	"fmt"
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
	
	// ServerPort 服务器端口
	ServerPort string
	
	// AutoPortDiscovery 是否启用自动端口发现
	AutoPortDiscovery bool
	
	// MaxPortAttempts 最大端口尝试次数
	MaxPortAttempts int
	
	// PortFileName 端口文件名
	PortFileName string
	
	// TLSCertPath TLS 证书路径
	TLSCertPath string
	
	// TLSKeyPath TLS 密钥路径
	TLSKeyPath string
	
	// TLSEnabled 是否启用 TLS
	TLSEnabled bool
	
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
	
	// 免责声明状态
	disclaimerStr := utils.GetEnvOrDefault("DISCLAIMER_AGREED", "false")
	DisclaimerAgreed = disclaimerStr == "true" || disclaimerStr == "1"
	
	// 自动端口发现配置 (默认启用)
	autoDiscoveryStr := utils.GetEnvOrDefault("AUTO_PORT_DISCOVERY", "true")
	AutoPortDiscovery = autoDiscoveryStr == "true" || autoDiscoveryStr == "1"
	
	MaxPortAttempts = 10
	PortFileName = "sigma-backend.port"
	
	// TLS 配置
	TLSCertPath = os.Getenv("TLS_CERT_PATH")
	TLSKeyPath = os.Getenv("TLS_KEY_PATH")
	TLSEnabled = TLSCertPath != "" && TLSKeyPath != ""
}

// LogConfig 记录配置信息用于调试
func LogConfig() {
	fmt.Println("配置信息:")
	fmt.Println("  - 输出目录:", OutputDir)
	fmt.Println("  - 上传目录:", UploadDir)
	fmt.Println("  - 数据库路径:", DBPath)
	fmt.Println("  - 服务器端口:", ServerPort)
	fmt.Println("  - 自动端口发现:", boolToString(AutoPortDiscovery))
	fmt.Println("  - TLS 启用:", boolToString(TLSEnabled))
	if TLSEnabled {
		fmt.Println("  - TLS 证书路径:", TLSCertPath)
		fmt.Println("  - TLS 密钥路径:", TLSKeyPath)
	}
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

// SetAPIToken 安全设置 API Token
func SetAPIToken(token string) {
	APIMutex.Lock()
	defer APIMutex.Unlock()
	APIToken = token
}

// GetDisclaimerAgreed 安全获取免责声明状态
func GetDisclaimerAgreed() bool {
	DisclaimerMutex.RLock()
	defer DisclaimerMutex.RUnlock()
	return DisclaimerAgreed
}

// SetDisclaimerAgreed 安全设置免责声明状态
func SetDisclaimerAgreed(agreed bool) {
	DisclaimerMutex.Lock()
	defer DisclaimerMutex.Unlock()
	DisclaimerAgreed = agreed
}

