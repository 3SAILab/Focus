package server

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

// 生成测试用的自签名证书
func generateTestCertificate(certPath, keyPath string) error {
	// 生成私钥
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return err
	}

	// 创建证书模板
	template := x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject: pkix.Name{
			Organization: []string{"Test Organization"},
			CommonName:   "localhost",
		},
		NotBefore:             time.Now(),
		NotAfter:              time.Now().Add(24 * time.Hour),
		KeyUsage:              x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
		DNSNames:              []string{"localhost"},
	}

	// 创建证书
	certDER, err := x509.CreateCertificate(rand.Reader, &template, &template, &privateKey.PublicKey, privateKey)
	if err != nil {
		return err
	}

	// 保存证书
	certOut, err := os.Create(certPath)
	if err != nil {
		return err
	}
	defer certOut.Close()
	pem.Encode(certOut, &pem.Block{Type: "CERTIFICATE", Bytes: certDER})

	// 保存私钥
	keyOut, err := os.Create(keyPath)
	if err != nil {
		return err
	}
	defer keyOut.Close()
	pem.Encode(keyOut, &pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(privateKey)})

	return nil
}

// TestLoadTLSCertificate 测试证书加载功能
func TestLoadTLSCertificate(t *testing.T) {
	// 创建临时目录
	tempDir := t.TempDir()
	certPath := filepath.Join(tempDir, "test-cert.pem")
	keyPath := filepath.Join(tempDir, "test-key.pem")

	// 生成测试证书
	if err := generateTestCertificate(certPath, keyPath); err != nil {
		t.Fatalf("生成测试证书失败: %v", err)
	}

	// 测试加载证书
	cert, err := LoadTLSCertificate(certPath, keyPath)
	if err != nil {
		t.Fatalf("加载证书失败: %v", err)
	}

	// 验证证书不为空
	if len(cert.Certificate) == 0 {
		t.Error("证书为空")
	}
}

// TestLoadTLSCertificate_MissingCertFile 测试证书文件不存在的情况
func TestLoadTLSCertificate_MissingCertFile(t *testing.T) {
	tempDir := t.TempDir()
	certPath := filepath.Join(tempDir, "nonexistent-cert.pem")
	keyPath := filepath.Join(tempDir, "test-key.pem")

	// 创建密钥文件
	os.WriteFile(keyPath, []byte("dummy key"), 0644)

	// 尝试加载不存在的证书
	_, err := LoadTLSCertificate(certPath, keyPath)
	if err == nil {
		t.Error("期望加载不存在的证书文件时返回错误")
	}
}

// TestLoadTLSCertificate_MissingKeyFile 测试密钥文件不存在的情况
func TestLoadTLSCertificate_MissingKeyFile(t *testing.T) {
	tempDir := t.TempDir()
	certPath := filepath.Join(tempDir, "test-cert.pem")
	keyPath := filepath.Join(tempDir, "nonexistent-key.pem")

	// 创建证书文件
	os.WriteFile(certPath, []byte("dummy cert"), 0644)

	// 尝试加载不存在的密钥
	_, err := LoadTLSCertificate(certPath, keyPath)
	if err == nil {
		t.Error("期望加载不存在的密钥文件时返回错误")
	}
}

// TestStartHTTPSServer 测试 HTTPS 服务器启动
func TestStartHTTPSServer(t *testing.T) {
	// 创建临时目录
	tempDir := t.TempDir()
	certPath := filepath.Join(tempDir, "test-cert.pem")
	keyPath := filepath.Join(tempDir, "test-key.pem")

	// 生成测试证书
	if err := generateTestCertificate(certPath, keyPath); err != nil {
		t.Fatalf("生成测试证书失败: %v", err)
	}

	// 创建测试路由
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/test", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "success"})
	})

	// 配置 TLS
	config := TLSConfig{
		CertFile: certPath,
		KeyFile:  keyPath,
		Port:     0, // 使用随机端口
	}

	// 在 goroutine 中启动服务器
	serverErr := make(chan error, 1)
	go func() {
		serverErr <- StartHTTPSServer(router, config)
	}()

	// 等待一小段时间让服务器启动
	time.Sleep(100 * time.Millisecond)

	// 检查是否有启动错误
	select {
	case err := <-serverErr:
		if err != nil && err != http.ErrServerClosed {
			t.Fatalf("服务器启动失败: %v", err)
		}
	default:
		// 服务器正在运行，这是预期的
	}
}

// TestHTTPSCommunication 测试加密通信
func TestHTTPSCommunication(t *testing.T) {
	// 创建临时目录
	tempDir := t.TempDir()
	certPath := filepath.Join(tempDir, "test-cert.pem")
	keyPath := filepath.Join(tempDir, "test-key.pem")

	// 生成测试证书
	if err := generateTestCertificate(certPath, keyPath); err != nil {
		t.Fatalf("生成测试证书失败: %v", err)
	}

	// 创建测试路由
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "pong"})
	})

	// 找一个可用端口
	port := 18443

	// 配置 TLS
	config := TLSConfig{
		CertFile: certPath,
		KeyFile:  keyPath,
		Port:     port,
	}

	// 在 goroutine 中启动服务器
	go func() {
		StartHTTPSServer(router, config)
	}()

	// 等待服务器启动
	time.Sleep(200 * time.Millisecond)

	// 创建 HTTPS 客户端（信任自签名证书）
	client := &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: true,
			},
		},
		Timeout: 5 * time.Second,
	}

	// 发送 HTTPS 请求
	resp, err := client.Get(fmt.Sprintf("https://localhost:%d/ping", port))
	if err != nil {
		t.Fatalf("HTTPS 请求失败: %v", err)
	}
	defer resp.Body.Close()

	// 验证响应
	if resp.StatusCode != 200 {
		t.Errorf("期望状态码 200，得到 %d", resp.StatusCode)
	}

	// 读取响应体
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("读取响应失败: %v", err)
	}

	// 验证响应内容
	if len(body) == 0 {
		t.Error("响应体为空")
	}
}
