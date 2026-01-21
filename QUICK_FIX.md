# 快速修复：恢复历史记录

## 问题描述

前端只显示今天的历史记录，但数据库中有从 2026-01-03 到今天的完整记录（50+ 条）。

**原因**：数据库中所有旧记录的 `deleted_at` 字段都有值（`2026-01-05 10:48:43`），GORM 的软删除机制自动过滤了这些记录。

## 快速解决方案

### 方法 1：使用 Go 脚本（推荐）

1. **停止后端服务**（如果正在运行）

2. **运行恢复脚本**：
```bash
go run backend/scripts/quick_restore.go
```

3. **重新启动后端**：
```bash
npm run dev
```

### 方法 2：使用 SQLite 命令行

1. **停止后端服务**

2. **打开数据库**：
```bash
# Windows
sqlite3 %USERPROFILE%\sigma_data\sigma.db

# Mac/Linux
sqlite3 ~/sigma_data/sigma.db
```

3. **执行恢复命令**：
```sql
-- 查看当前状态
SELECT COUNT(*) as total, 
       SUM(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END) as active,
       SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) as deleted
FROM generation_histories;

-- 恢复所有记录
UPDATE generation_histories SET deleted_at = NULL WHERE deleted_at IS NOT NULL;

-- 验证结果
SELECT COUNT(*) FROM generation_histories WHERE deleted_at IS NULL;
```

4. **退出 SQLite**：
```sql
.quit
```

5. **重新启动后端**

### 方法 3：使用数据库管理工具

如果你有 SQLite 数据库管理工具（如 DB Browser for SQLite）：

1. 打开数据库文件：`%USERPROFILE%\sigma_data\sigma.db`
2. 执行 SQL：`UPDATE generation_histories SET deleted_at = NULL WHERE deleted_at IS NOT NULL;`
3. 保存并关闭
4. 重新启动后端

## 验证修复

修复后，你应该能看到：

1. **前端历史记录**：显示从 2026-01-03 到今天的所有记录
2. **记录数量**：50+ 条记录
3. **日期范围**：最早记录是 2026-01-03，最新记录是今天

## 预防措施

为了避免将来再次出现这个问题，我已经修改了代码：

1. **移除软删除**：删除操作不再设置 `deleted_at` 字段
2. **保留记录**：删除只删除图片文件，数据库记录永久保留
3. **新字段**：使用 `image_deleted` 字段标记图片是否已删除

**下次更新代码后，需要运行完整的迁移脚本**：
```bash
go run backend/scripts/migrate_to_no_soft_delete.go
```

## 常见问题

### Q: 为什么所有旧记录都被标记为删除了？

A: 可能的原因：
- 某个批量操作意外设置了 `deleted_at` 字段
- 数据库迁移或更新时出现了问题
- 测试代码中的批量删除操作

### Q: 恢复后会影响图片文件吗？

A: 不会。恢复操作只修改数据库记录，不会影响 `output` 目录中的图片文件。

### Q: 如果图片文件已经被删除了怎么办？

A: 数据库记录会恢复，但图片文件无法恢复。前端会显示记录，但图片可能无法加载（显示 404）。

### Q: 需要重新编译后端吗？

A: 如果只是恢复记录，不需要重新编译。但建议更新到新版本（移除软删除）以避免将来再次出现问题。

## 技术细节

### 软删除机制

GORM 的软删除机制：
- 使用 `gorm.Model` 时，自动包含 `DeletedAt` 字段
- 调用 `Delete()` 时，设置 `deleted_at` 而不是真正删除记录
- 所有查询自动排除 `deleted_at` 不为 NULL 的记录

### 恢复原理

```sql
-- 软删除的记录有 deleted_at 值
SELECT * FROM generation_histories WHERE deleted_at IS NOT NULL;

-- 恢复：将 deleted_at 设置为 NULL
UPDATE generation_histories SET deleted_at = NULL WHERE deleted_at IS NOT NULL;

-- 恢复后，GORM 查询会包含这些记录
SELECT * FROM generation_histories WHERE deleted_at IS NULL;
```

## 需要帮助？

如果遇到问题，请检查：
1. 数据库文件路径是否正确
2. 后端服务是否已停止
3. 是否有数据库文件的写入权限
