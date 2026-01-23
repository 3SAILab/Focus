package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	_ "github.com/mattn/go-sqlite3"
)

// 诊断图片 URL 问题的脚本
func main() {
	// 打开数据库
	dbPath := "./history.db"
	if len(os.Args) > 1 {
		dbPath = os.Args[1]
	}

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		log.Fatal("打开数据库失败:", err)
	}
	defer db.Close()

	fmt.Println("=== 图片 URL 诊断工具 ===")
	fmt.Println("数据库路径:", dbPath)
	fmt.Println()

	// 查询所有历史记录
	rows, err := db.Query(`
		SELECT id, prompt, image_url, created_at 
		FROM generation_histories 
		WHERE image_url != '' AND image_url IS NOT NULL 
		ORDER BY created_at DESC 
		LIMIT 10
	`)
	if err != nil {
		log.Fatal("查询失败:", err)
	}
	defer rows.Close()

	fmt.Println("最近 10 条记录的图片 URL 分析：")
	fmt.Println(strings.Repeat("-", 80))

	count := 0
	for rows.Scan() {
		var id int
		var prompt, imageURL, createdAt string

		if err := rows.Scan(&id, &prompt, &imageURL, &createdAt); err != nil {
			log.Printf("读取记录失败: %v", err)
			continue
		}

		count++
		fmt.Printf("\n记录 #%d (ID: %d)\n", count, id)
		fmt.Printf("  提示词: %s\n", truncate(prompt, 50))
		fmt.Printf("  创建时间: %s\n", createdAt)
		fmt.Printf("  图片 URL: %s\n", imageURL)

		// 分析 URL 类型
		if strings.HasPrefix(imageURL, "http://") || strings.HasPrefix(imageURL, "https://") {
			fmt.Printf("  URL 类型: 完整 URL\n")

			// 提取端口
			if strings.Contains(imageURL, "localhost:") {
				parts := strings.Split(imageURL, "localhost:")
				if len(parts) > 1 {
					portPart := strings.Split(parts[1], "/")[0]
					fmt.Printf("  端口: %s\n", portPart)
				}
			}
		} else {
			fmt.Printf("  URL 类型: 相对路径\n")
		}

		// 检查文件是否存在
		var filePath string
		if strings.HasPrefix(imageURL, "http://") || strings.HasPrefix(imageURL, "https://") {
			// 从完整 URL 提取相对路径
			parts := strings.SplitN(imageURL, "/", 4)
			if len(parts) >= 4 {
				filePath = parts[3]
			}
		} else {
			filePath = imageURL
		}

		if filePath != "" {
			// 检查 output 目录
			outputPath := filepath.Join("./output", filepath.Base(filePath))
			if _, err := os.Stat(outputPath); err == nil {
				fmt.Printf("  文件状态: ✓ 存在 (%s)\n", outputPath)
			} else {
				fmt.Printf("  文件状态: ✗ 不存在 (%s)\n", outputPath)
			}
		}
	}

	if count == 0 {
		fmt.Println("没有找到历史记录")
	}

	fmt.Println()
	fmt.Println(strings.Repeat("-", 80))
	fmt.Println("\n诊断建议：")
	fmt.Println("1. 如果 URL 中的端口与当前后端端口不一致，图片将无法显示")
	fmt.Println("2. 如果文件不存在，说明图片文件被删除了")
	fmt.Println("3. 建议使用相对路径存储图片 URL，避免端口变化导致的问题")
	fmt.Println("\n当前环境变量：")
	fmt.Printf("  ACTUAL_PORT: %s\n", os.Getenv("ACTUAL_PORT"))
	fmt.Printf("  PORT: %s\n", os.Getenv("PORT"))
	fmt.Printf("  BASE_URL: %s\n", os.Getenv("BASE_URL"))
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}
