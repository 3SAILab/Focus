package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"regexp"
	"strings"

	_ "github.com/mattn/go-sqlite3"
)

// 修复图片 URL 的脚本
// 将数据库中的完整 URL 转换为相对路径，避免端口变化导致的问题
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

	fmt.Println("=== 图片 URL 修复工具 ===")
	fmt.Println("数据库路径:", dbPath)
	fmt.Println()

	// 开始事务
	tx, err := db.Begin()
	if err != nil {
		log.Fatal("开始事务失败:", err)
	}

	// 查询所有需要修复的记录
	rows, err := tx.Query(`
		SELECT id, image_url, ref_images 
		FROM generation_history 
		WHERE (image_url LIKE 'http://%' OR image_url LIKE 'https://%')
		   OR (ref_images LIKE '%http://%' OR ref_images LIKE '%https://%')
	`)
	if err != nil {
		tx.Rollback()
		log.Fatal("查询失败:", err)
	}

	// 准备更新语句
	updateStmt, err := tx.Prepare(`
		UPDATE generation_history 
		SET image_url = ?, ref_images = ? 
		WHERE id = ?
	`)
	if err != nil {
		tx.Rollback()
		log.Fatal("准备更新语句失败:", err)
	}
	defer updateStmt.Close()

	count := 0
	for rows.Next() {
		var id int
		var imageURL, refImages string

		if err := rows.Scan(&id, &imageURL, &refImages); err != nil {
			log.Printf("读取记录失败: %v", err)
			continue
		}

		// 转换 image_url
		newImageURL := toRelativePath(imageURL)

		// 转换 ref_images
		newRefImages := convertRefImagesJSON(refImages)

		// 只有当 URL 发生变化时才更新
		if newImageURL != imageURL || newRefImages != refImages {
			_, err := updateStmt.Exec(newImageURL, newRefImages, id)
			if err != nil {
				log.Printf("更新记录 %d 失败: %v", id, err)
				continue
			}

			count++
			fmt.Printf("✓ 记录 #%d 已修复\n", id)
			if newImageURL != imageURL {
				fmt.Printf("  image_url: %s -> %s\n", imageURL, newImageURL)
			}
			if newRefImages != refImages {
				fmt.Printf("  ref_images: %s -> %s\n", truncate(refImages, 50), truncate(newRefImages, 50))
			}
		}
	}
	rows.Close()

	// 提交事务
	if err := tx.Commit(); err != nil {
		log.Fatal("提交事务失败:", err)
	}

	fmt.Println()
	fmt.Printf("修复完成！共修复 %d 条记录\n", count)
	fmt.Println("\n注意：修复后需要重启后端服务才能生效")
}

// toRelativePath 将完整 URL 转换为相对路径
func toRelativePath(url string) string {
	if url == "" {
		return ""
	}

	// 如果已经是相对路径，直接返回
	if !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") {
		return url
	}

	// 使用正则匹配 http(s)://host:port/路径 或 http(s)://host/路径
	re := regexp.MustCompile(`^https?://[^/]+/(.+)`)
	matches := re.FindStringSubmatch(url)
	if len(matches) >= 2 {
		return matches[1]
	}

	return url
}

// convertRefImagesJSON 转换 ref_images JSON 字符串中的 URL
func convertRefImagesJSON(refImagesJSON string) string {
	if refImagesJSON == "" || refImagesJSON == "null" || refImagesJSON == "[]" {
		return refImagesJSON
	}

	// 简单的字符串替换方式（适用于 JSON 数组）
	// 匹配 "http://..." 或 "https://..." 格式的 URL
	re := regexp.MustCompile(`"(https?://[^/]+/([^"]+))"`)
	result := re.ReplaceAllString(refImagesJSON, `"$2"`)

	return result
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}
