# 数据库迁移指南：移除软删除功能

## 变更说明

从软删除模式迁移到保留记录模式：
- **旧行为**：删除操作会软删除数据库记录（设置 `deleted_at` 字段），同时删除图片文件
- **新行为**：删除操作只删除图片文件，数据库记录永久保留，使用 `image_deleted` 字段标记

## 为什么要这样做？

1. **保留历史记录**：即使图片被删除，用户仍然可以看到生成历史（提示词、时间等）
2. **数据分析**：保留完整的生成记录用于统计和分析
3. **避免数据丢失**：误删除的记录可以通过重新生成恢复

## 迁移步骤

### 1. 停止后端服务

如果后端正在运行，先停止它。

### 2. 运行迁移脚本

在项目根目录执行：

```bash
go run backend/scripts/migrate_to_no_soft_delete.go
```

迁移脚本会：
1. 添加 `image_deleted` 列到数据库
2. 将所有被软删除的记录标记为 `image_deleted = true`
3. 恢复所有被软删除的记录（设置 `deleted_at = NULL`）
4. 显示迁移结果统计

### 3. 重新编译后端

```bash
cd backend
go build -o sigma-backend.exe
```

### 4. 启动后端服务

```bash
cd backend
./sigma-backend.exe
```

或者使用开发模式：

```bash
npm run dev
```

## 迁移后的行为

### 删除操作

当用户删除一条记录时：
- ✅ 图片文件从 `output` 目录删除
- ✅ 数据库记录保留，`image_deleted` 字段设置为 `true`
- ✅ 前端仍然显示该记录，但标记为"图片已删除"

### 查询历史记录

- ✅ 所有记录都会返回（包括图片已删除的）
- ✅ 前端可以根据 `image_deleted` 字段显示不同的 UI

## 验证迁移

迁移完成后，你应该能看到：

1. **前端历史记录**：显示所有历史记录（从 2026-01-03 到今天）
2. **数据库**：所有记录的 `deleted_at` 字段都是 `NULL`
3. **新字段**：所有记录都有 `image_deleted` 字段（0 或 1）

## 回滚（如果需要）

如果需要回滚到软删除模式：

1. 恢复旧的模型文件（使用 git）
2. 重新编译后端
3. 数据库中的 `image_deleted` 字段会被忽略（不影响功能）

## 常见问题

### Q: 迁移后旧的图片文件会怎样？

A: 如果图片文件已经被删除（`deleted_at` 不为 NULL），迁移后记录会被标记为 `image_deleted = true`，但不会恢复图片文件。

### Q: 迁移会影响生成次数统计吗？

A: 不会。生成次数统计独立于历史记录。

### Q: 可以手动删除数据库记录吗？

A: 可以，但不推荐。如果确实需要，可以直接在数据库中执行 `DELETE` 语句。

## 技术细节

### 数据库结构变更

```sql
-- 添加新字段
ALTER TABLE generation_histories ADD COLUMN image_deleted BOOLEAN DEFAULT 0;

-- 迁移数据
UPDATE generation_histories SET image_deleted = 1 WHERE deleted_at IS NOT NULL;
UPDATE generation_histories SET deleted_at = NULL WHERE deleted_at IS NOT NULL;
```

### 模型变更

**旧模型**：
```go
type GenerationHistory struct {
    gorm.Model  // 包含 DeletedAt 字段
    // ...
}
```

**新模型**：
```go
type GenerationHistory struct {
    ID        uint      `gorm:"primarykey"`
    CreatedAt time.Time
    UpdatedAt time.Time
    ImageDeleted bool   `gorm:"default:false"`
    // ...
}
```

### API 响应变更

历史记录 API 响应中新增 `image_deleted` 字段：

```json
{
  "id": 1,
  "prompt": "a dogs",
  "image_url": "http://localhost:51888/images/gen_xxx.png",
  "image_deleted": false,
  "created_at": "2026-01-20T17:39:56Z"
}
```
