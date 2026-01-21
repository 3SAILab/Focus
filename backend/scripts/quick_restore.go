// 快速恢复被软删除的历史记录
// 使用方法：go run backend/scripts/quick_restore.go
package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

func main() {
	// 获取数据库路径
	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Fatal("无法获取用户主目录:", err)
	}

	dbPath := filepath.Join(homeDir, "sigma_data", "sigma.db")
	fmt.Printf("数据库路径: %s\n\n", dbPath)

	// 检查数据库文件是否存在
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		log.Fatal("数据库文件不存在:", dbPath)
	}

	// 连接数据库
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		log.Fatal("连接数据库失败:", err)
	}
	defer db.Close()

	fmt.Println("=== 开始恢复被软删除的记录 ===\n")

	// 1. 查看当前状态
	fmt.Println("步骤 1: 检查当前状态...")
	var totalRecords, activeRecords, deletedRecords int
	err = db.QueryRow(`
		SELECT 
			COUNT(*) as total,
			SUM(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END) as active,
			SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) as deleted
		FROM generation_histories
	`).Scan(&totalRecords, &activeRecords, &deletedRecords)

	if err != nil {
		log.Fatal("查询失败:", err)
	}

	fmt.Printf("  总记录数: %d\n", totalRecords)
	fmt.Printf("  活跃记录: %d\n", activeRecords)
	fmt.Printf("  被删除记录: %d\n\n", deletedRecords)

	if deletedRecords == 0 {
		fmt.Println("没有需要恢复的记录！")
		return
	}

	// 2. 恢复记录
	fmt.Printf("步骤 2: 恢复 %d 条被删除的记录...\n", deletedRecords)
	result, err := db.Exec("UPDATE generation_histories SET deleted_at = NULL WHERE deleted_at IS NOT NULL")
	if err != nil {
		log.Fatal("恢复失败:", err)
	}

	rowsAffected, _ := result.RowsAffected()
	fmt.Printf("  ✓ 成功恢复 %d 条记录\n\n", rowsAffected)

	// 3. 验证结果
	fmt.Println("步骤 3: 验证恢复结果...")
	err = db.QueryRow(`
		SELECT 
			COUNT(*) as total,
			SUM(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END) as active,
			SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) as deleted
		FROM generation_histories
	`).Scan(&totalRecords, &activeRecords, &deletedRecords)

	if err != nil {
		log.Fatal("验证失败:", err)
	}

	fmt.Printf("  总记录数: %d\n", totalRecords)
	fmt.Printf("  活跃记录: %d\n", activeRecords)
	fmt.Printf("  被删除记录: %d\n\n", deletedRecords)

	// 4. 显示日期范围
	fmt.Println("步骤 4: 检查记录日期范围...")
	var earliestDate, latestDate string
	var recordCount int
	err = db.QueryRow(`
		SELECT 
			MIN(created_at) as earliest,
			MAX(created_at) as latest,
			COUNT(*) as count
		FROM generation_histories
	`).Scan(&earliestDate, &latestDate, &recordCount)

	if err != nil {
		log.Fatal("查询日期范围失败:", err)
	}

	fmt.Printf("  最早记录: %s\n", earliestDate)
	fmt.Printf("  最新记录: %s\n", latestDate)
	fmt.Printf("  记录总数: %d\n\n", recordCount)

	fmt.Println("=== 恢复完成 ===")
	fmt.Println("\n现在可以重新启动后端服务，前端应该能看到所有历史记录了。")
}
