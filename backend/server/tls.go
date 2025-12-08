package server

import (
	"crypto/tls"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

// TLSConfig 包含 TLS 服务器配置
type TLSConfig struct {
	CertFile string
	KeyFile  string
	Port     int
}

// LoadTLSCertificate 加载 TLS 证书
func LoadTLSCertificate(certPath, keyPath string) (tls.Certificate, error) {
	// 验证证书文件是否存在
	if _, err := os.Stat(certPath); os.IsNotExist(err) {
		return tls.Certificate{}, fmt.Errorf("证书文件不存在: %s", certPath)
	}
	
	if _, err := os.Stat(keyPath); os.IsNotExist(err) {
		return tls.Certificate{}, fmt.Errorf("密钥文件不存在: %s", keyPath)
	}
	
	// 加载证书和密钥
	cert, err := tls.LoadX509KeyPair(certPath, keyPath)
	if err != nil {
		return tls.Certificate{}, fmt.Errorf("加载 TLS 证书失败: %w", err)
	}
	
	return cert, nil
}

// StartHTTPSServer 启动 HTTPS 服务器
func StartHTTPSServer(router *gin.Engine, config TLSConfig) error {
	// 加载 TLS 证书
	cert, err := LoadTLSCertificate(config.CertFile, config.KeyFile)
	if err != nil {
		return err
	}
	
	// 配置 TLS
	tlsConfig := &tls.Config{
		Certificates: []tls.Certificate{cert},
		MinVersion:   tls.VersionTLS12,
	}
	
	// 创建 HTTPS 服务器
	addr := fmt.Sprintf(":%d", config.Port)
	server := &http.Server{
		Addr:      addr,
		Handler:   router,
		TLSConfig: tlsConfig,
	}
	
	log.Printf("HTTPS 服务器启动在端口 %d", config.Port)
	
	// 启动服务器（使用空字符串因为证书已在 TLSConfig 中配置）
	if err := server.ListenAndServeTLS("", ""); err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("HTTPS 服务器启动失败: %w", err)
	}
	
	return nil
}
