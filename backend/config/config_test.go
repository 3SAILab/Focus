package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestInit(t *testing.T) {
	// 保存原始环境变量
	originalOutputDir := os.Getenv("OUTPUT_DIR")
	originalUploadDir := os.Getenv("UPLOAD_DIR")
	originalDBPath := os.Getenv("DB_PATH")
	originalPort := os.Getenv("PORT")
	
	// 清理函数
	defer func() {
		os.Setenv("OUTPUT_DIR", originalOutputDir)
		os.Setenv("UPLOAD_DIR", originalUploadDir)
		os.Setenv("DB_PATH", originalDBPath)
		os.Setenv("PORT", originalPort)
	}()
	
	t.Run("使用默认值", func(t *testing.T) {
		// 清除环境变量
		os.Unsetenv("OUTPUT_DIR")
		os.Unsetenv("UPLOAD_DIR")
		os.Unsetenv("DB_PATH")
		os.Unsetenv("PORT")
		
		Init()
		
		if OutputDir != "./output" {
			t.Errorf("期望 OutputDir 为 './output'，实际为 '%s'", OutputDir)
		}
		if UploadDir != "./uploads" {
			t.Errorf("期望 UploadDir 为 './uploads'，实际为 '%s'", UploadDir)
		}
		if DBPath != "./history.db" {
			t.Errorf("期望 DBPath 为 './history.db'，实际为 '%s'", DBPath)
		}
		if ServerPort != "8080" {
			t.Errorf("期望 ServerPort 为 '8080'，实际为 '%s'", ServerPort)
		}
	})
	
	t.Run("使用环境变量", func(t *testing.T) {
		// 设置环境变量
		testOutputDir := "/tmp/test-output"
		testUploadDir := "/tmp/test-uploads"
		testDBPath := "/tmp/test-db/history.db"
		testPort := "9090"
		
		os.Setenv("OUTPUT_DIR", testOutputDir)
		os.Setenv("UPLOAD_DIR", testUploadDir)
		os.Setenv("DB_PATH", testDBPath)
		os.Setenv("PORT", testPort)
		
		Init()
		
		if OutputDir != testOutputDir {
			t.Errorf("期望 OutputDir 为 '%s'，实际为 '%s'", testOutputDir, OutputDir)
		}
		if UploadDir != testUploadDir {
			t.Errorf("期望 UploadDir 为 '%s'，实际为 '%s'", testUploadDir, UploadDir)
		}
		if DBPath != testDBPath {
			t.Errorf("期望 DBPath 为 '%s'，实际为 '%s'", testDBPath, DBPath)
		}
		if ServerPort != testPort {
			t.Errorf("期望 ServerPort 为 '%s'，实际为 '%s'", testPort, ServerPort)
		}
	})
	

}

func TestPathResolution(t *testing.T) {
	t.Run("路径应该正确解析", func(t *testing.T) {
		testCases := []struct {
			name     string
			envVar   string
			envValue string
			expected string
		}{
			{
				name:     "绝对路径",
				envVar:   "OUTPUT_DIR",
				envValue: "/absolute/path/output",
				expected: "/absolute/path/output",
			},
			{
				name:     "相对路径",
				envVar:   "OUTPUT_DIR",
				envValue: "./relative/output",
				expected: "./relative/output",
			},
			{
				name:     "Windows路径",
				envVar:   "OUTPUT_DIR",
				envValue: "C:\\Users\\Test\\output",
				expected: "C:\\Users\\Test\\output",
			},
		}
		
		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				os.Setenv(tc.envVar, tc.envValue)
				Init()
				
				if OutputDir != tc.expected {
					t.Errorf("期望 OutputDir 为 '%s'，实际为 '%s'", tc.expected, OutputDir)
				}
			})
		}
	})
}

func TestDirectoryCreation(t *testing.T) {
	t.Run("应该能够创建配置的目录", func(t *testing.T) {
		// 创建临时目录
		tempDir := t.TempDir()
		
		testOutputDir := filepath.Join(tempDir, "output")
		testUploadDir := filepath.Join(tempDir, "uploads")
		testDBDir := filepath.Join(tempDir, "db")
		testDBPath := filepath.Join(testDBDir, "history.db")
		
		os.Setenv("OUTPUT_DIR", testOutputDir)
		os.Setenv("UPLOAD_DIR", testUploadDir)
		os.Setenv("DB_PATH", testDBPath)
		
		Init()
		
		// 尝试创建目录
		if err := os.MkdirAll(OutputDir, 0755); err != nil {
			t.Errorf("无法创建输出目录: %v", err)
		}
		if err := os.MkdirAll(UploadDir, 0755); err != nil {
			t.Errorf("无法创建上传目录: %v", err)
		}
		
		dbDir := filepath.Dir(DBPath)
		if err := os.MkdirAll(dbDir, 0755); err != nil {
			t.Errorf("无法创建数据库目录: %v", err)
		}
		
		// 验证目录存在
		if _, err := os.Stat(OutputDir); os.IsNotExist(err) {
			t.Error("输出目录不存在")
		}
		if _, err := os.Stat(UploadDir); os.IsNotExist(err) {
			t.Error("上传目录不存在")
		}
		if _, err := os.Stat(dbDir); os.IsNotExist(err) {
			t.Error("数据库目录不存在")
		}
	})
}
