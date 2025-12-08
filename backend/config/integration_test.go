package config

import (
	"os"
	"path/filepath"
	"testing"
)

// TestElectronEnvironmentSimulation 模拟 Electron 环境中的路径配置
func TestElectronEnvironmentSimulation(t *testing.T) {
	t.Run("模拟Electron传递的路径", func(t *testing.T) {
		// 创建临时目录模拟用户数据目录
		tempUserData := t.TempDir()
		
		// 模拟 Electron 传递的环境变量
		electronOutputDir := filepath.Join(tempUserData, "output")
		electronUploadDir := filepath.Join(tempUserData, "uploads")
		electronDBDir := filepath.Join(tempUserData, "db")
		electronDBPath := filepath.Join(electronDBDir, "history.db")
		electronTLSCertPath := filepath.Join(tempUserData, "tls", "cert.pem")
		electronTLSKeyPath := filepath.Join(tempUserData, "tls", "key.pem")
		
		// 设置环境变量
		os.Setenv("OUTPUT_DIR", electronOutputDir)
		os.Setenv("UPLOAD_DIR", electronUploadDir)
		os.Setenv("DB_PATH", electronDBPath)
		os.Setenv("PORT", "8080")
		os.Setenv("TLS_CERT_PATH", electronTLSCertPath)
		os.Setenv("TLS_KEY_PATH", electronTLSKeyPath)
		os.Setenv("USE_TLS", "true")
		
		// 初始化配置
		Init()
		
		// 验证配置正确读取
		if OutputDir != electronOutputDir {
			t.Errorf("OutputDir 不匹配: 期望 %s, 实际 %s", electronOutputDir, OutputDir)
		}
		if UploadDir != electronUploadDir {
			t.Errorf("UploadDir 不匹配: 期望 %s, 实际 %s", electronUploadDir, UploadDir)
		}
		if DBPath != electronDBPath {
			t.Errorf("DBPath 不匹配: 期望 %s, 实际 %s", electronDBPath, DBPath)
		}
		if TLSCertPath != electronTLSCertPath {
			t.Errorf("TLSCertPath 不匹配: 期望 %s, 实际 %s", electronTLSCertPath, TLSCertPath)
		}
		if TLSKeyPath != electronTLSKeyPath {
			t.Errorf("TLSKeyPath 不匹配: 期望 %s, 实际 %s", electronTLSKeyPath, TLSKeyPath)
		}
		if !TLSEnabled {
			t.Error("TLS 应该被启用")
		}
		
		// 模拟后端启动时创建目录
		if err := os.MkdirAll(OutputDir, 0755); err != nil {
			t.Fatalf("无法创建输出目录: %v", err)
		}
		if err := os.MkdirAll(UploadDir, 0755); err != nil {
			t.Fatalf("无法创建上传目录: %v", err)
		}
		
		dbDir := filepath.Dir(DBPath)
		if err := os.MkdirAll(dbDir, 0755); err != nil {
			t.Fatalf("无法创建数据库目录: %v", err)
		}
		
		// 验证所有目录都已创建
		if _, err := os.Stat(OutputDir); os.IsNotExist(err) {
			t.Error("输出目录未创建")
		}
		if _, err := os.Stat(UploadDir); os.IsNotExist(err) {
			t.Error("上传目录未创建")
		}
		if _, err := os.Stat(dbDir); os.IsNotExist(err) {
			t.Error("数据库目录未创建")
		}
		
		// 验证路径是绝对路径（在打包环境中很重要）
		if !filepath.IsAbs(OutputDir) {
			t.Error("OutputDir 应该是绝对路径")
		}
		if !filepath.IsAbs(UploadDir) {
			t.Error("UploadDir 应该是绝对路径")
		}
		if !filepath.IsAbs(DBPath) {
			t.Error("DBPath 应该是绝对路径")
		}
		
		t.Logf("✓ 所有路径配置正确")
		t.Logf("  - 输出目录: %s", OutputDir)
		t.Logf("  - 上传目录: %s", UploadDir)
		t.Logf("  - 数据库路径: %s", DBPath)
		t.Logf("  - TLS 证书: %s", TLSCertPath)
		t.Logf("  - TLS 密钥: %s", TLSKeyPath)
	})
	
	t.Run("验证路径在不同操作系统上的兼容性", func(t *testing.T) {
		testCases := []struct {
			name     string
			basePath string
		}{
			{
				name:     "Unix风格路径",
				basePath: "/home/user/.config/sigma",
			},
			{
				name:     "Windows风格路径",
				basePath: "C:\\Users\\User\\AppData\\Roaming\\sigma",
			},
		}
		
		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				outputDir := filepath.Join(tc.basePath, "output")
				uploadDir := filepath.Join(tc.basePath, "uploads")
				dbPath := filepath.Join(tc.basePath, "db", "history.db")
				
				os.Setenv("OUTPUT_DIR", outputDir)
				os.Setenv("UPLOAD_DIR", uploadDir)
				os.Setenv("DB_PATH", dbPath)
				
				Init()
				
				// 验证路径正确设置
				if OutputDir != outputDir {
					t.Errorf("OutputDir 不匹配")
				}
				if UploadDir != uploadDir {
					t.Errorf("UploadDir 不匹配")
				}
				if DBPath != dbPath {
					t.Errorf("DBPath 不匹配")
				}
				
				t.Logf("✓ %s 路径配置正确", tc.name)
			})
		}
	})
}

// TestPathsAreNotHardcoded 验证路径不是硬编码的
func TestPathsAreNotHardcoded(t *testing.T) {
	t.Run("路径应该来自环境变量而不是硬编码", func(t *testing.T) {
		// 设置自定义路径
		customOutput := "/custom/output/path"
		customUpload := "/custom/upload/path"
		customDB := "/custom/db/history.db"
		
		os.Setenv("OUTPUT_DIR", customOutput)
		os.Setenv("UPLOAD_DIR", customUpload)
		os.Setenv("DB_PATH", customDB)
		
		Init()
		
		// 验证配置使用了环境变量而不是默认值
		if OutputDir == "./output" {
			t.Error("OutputDir 使用了硬编码的默认值而不是环境变量")
		}
		if UploadDir == "./uploads" {
			t.Error("UploadDir 使用了硬编码的默认值而不是环境变量")
		}
		if DBPath == "./history.db" {
			t.Error("DBPath 使用了硬编码的默认值而不是环境变量")
		}
		
		// 验证使用了正确的自定义路径
		if OutputDir != customOutput {
			t.Errorf("OutputDir 应该是 %s, 实际是 %s", customOutput, OutputDir)
		}
		if UploadDir != customUpload {
			t.Errorf("UploadDir 应该是 %s, 实际是 %s", customUpload, UploadDir)
		}
		if DBPath != customDB {
			t.Errorf("DBPath 应该是 %s, 实际是 %s", customDB, DBPath)
		}
		
		t.Log("✓ 路径正确使用环境变量，没有硬编码")
	})
}
