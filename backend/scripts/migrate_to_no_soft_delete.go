// 迁移数据库：从软删除模式迁移到保留记录模式
// 使用方法：go run backend/scripts/migrate_to_no_soft_delete.go
package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func main() {
	// 获取数据库路径
	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Fatal("无法获取用户主目录:", err)
	}

	dbPath := filepath.Join(homeDir, "sigma_data", "sigma.db")
	fmt.Printf("数据库路径: %s\n", dbPath)

	// 连接数据库
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		log.Fatal("连接数据库失败:", err)
	}

	fmt.Println("\n=== 开始数据库迁移 ===\n")

	// 1. 添加 image_deleted 列（如果不存在）
	fmt.Println("步骤 1: 添加 image_deleted 列...")
	result := db.Exec("ALTER TABLE generation_histories ADD COLUMN image_deleted BOOLEAN DEFAULT 0")
	if result.Error != nil {
		// 列可能已存在，忽略错误
		fmt.Println("  image_deleted 列已存在或添加失败（可能已存在）")
	} else {
		fmt.Println("  ✓ 成功添加 image_deleted 列")
	}

	// 2. 查询被软删除的记录数量
	var deletedCount int64
	db.Raw("SELECT COUNT(*) FROM generation_histories WHERE deleted_at IS NOT NULL").Scan(&deletedCount)
	fmt.Printf("\n步骤 2: 发现 %d 条被软删除的记录\n", deletedCount)

	if deletedCount > 0 {
		// 3. 将被软删除的记录标记为 image_deleted = true
		fmt.Println("\n步骤 3: 标记被软删除的记录为图片已删除...")
		result := db.Exec("UPDATE generation_histories SET image_deleted = 1 WHERE deleted_at IS NOT NULL")
		if result.Error != nil {
			log.Fatal("  ✗ 标记记录失败:", result.Error)
		}
		fmt.Printf("  ✓ 已标记 %d 条记录\n", result.RowsAffected)

		// 4. 恢复记录（将 deleted_at 设置为 NULL）
		fmt.Println("\n步骤 4: 恢复被软删除的记录...")
		result = db.Exec("UPDATE generation_histories SET deleted_at = NULL WHERE deleted_at IS NOT NULL")
		if result.Error != nil {
			log.Fatal("  ✗ 恢复记录失败:", result.Error)
		}
		fmt.Printf("  ✓ 成功恢复 %d 条记录\n", result.RowsAffected)
	} else {
		fmt.Println("  没有需要恢复的记录")
	}

	// 5. 验证结果
	fmt.Println("\n=== 迁移完成 ===\n")

	var totalCount int64
	db.Raw("SELECT COUNT(*) FROM generation_histories").Scan(&totalCount)
	fmt.Printf("记录总数: %d\n", totalCount)

	var deletedImageCount int64
	db.Raw("SELECT COUNT(*) FROM generation_histories WHERE image_deleted = 1").Scan(&deletedImageCount)
	fmt.Printf("图片已删除的记录: %d\n", deletedImageCount)

	var activeImageCount int64
	db.Raw("SELECT COUNT(*) FROM generation_histories WHERE image_deleted = 0 OR image_deleted IS NULL").Scan(&activeImageCount)
	fmt.Printf("图片未删除的记录: %d\n", activeImageCount)

	fmt.Println("\n迁移成功！现在可以重新启动后端服务。")
}
