# 数据库维护脚本

本目录包含用于维护和修复数据库的实用脚本。

## 脚本列表

### 1. migrate_to_no_soft_delete.go
将数据库从软删除模式迁移到硬删除模式。

### 2. quick_restore.go / quick_restore.sql
快速恢复被软删除的历史记录。

### 3. restore_deleted_history.sql
SQL 脚本，用于恢复被删除的历史记录。

### 4. diagnose_image_urls.go ⭐ 新增
诊断图片 URL 问题的工具。

**用途**：
- 检查数据库中的图片 URL 格式
- 分析 URL 中的端口是否正确
- 检查图片文件是否存在
- 帮助排查"生图不显示图片"的问题

**使用方法**：
```bash
cd backend
go run scripts/diagnose_image_urls.go [数据库路径]

# 示例
go run scripts/diagnose_image_urls.go ./history.db
```

**输出示例**：
```
=== 图片 URL 诊断工具 ===
数据库路径: ./history.db

最近 10 条记录的图片 URL 分析：
--------------------------------------------------------------------------------

记录 #1 (ID: 123)
  提示词: a beautiful sunset
  创建时间: 2024-01-20 10:30:00
  图片 URL: http://localhost:8080/images/gen_123.png
  URL 类型: 完整 URL
  端口: 8080
  文件状态: ✓ 存在 (./output/gen_123.png)
```

### 5. fix_image_urls.go ⭐ 新增
修复图片 URL 的工具，将完整 URL 转换为相对路径。

**用途**：
- 将数据库中的完整 URL（如 `http://localhost:8080/images/xxx.png`）转换为相对路径（如 `images/xxx.png`）
- 避免端口变化导致图片无法显示的问题
- 提高数据库的可移植性

**使用方法**：
```bash
cd backend

# 1. 先备份数据库（重要！）
cp history.db history.db.backup

# 2. 运行修复脚本
go run scripts/fix_image_urls.go [数据库路径]

# 示例
go run scripts/fix_image_urls.go ./history.db

# 3. 重启后端服务
```

**输出示例**：
```
=== 图片 URL 修复工具 ===
数据库路径: ./history.db

✓ 记录 #123 已修复
  image_url: http://localhost:8080/images/gen_123.png -> images/gen_123.png
✓ 记录 #124 已修复
  ref_images: ["http://localhost:8080/uploads/ref_456.png"] -> ["uploads/ref_456.png"]

修复完成！共修复 2 条记录

注意：修复后需要重启后端服务才能生效
```

## 常见问题

### Q: 新用户生图后看不到图片，但数据库有记录，output 目录也有图片文件？

**原因**：数据库中存储的图片 URL 使用了旧的端口号，与当前后端运行的端口不一致。

**解决方案**：
1. 使用 `diagnose_image_urls.go` 诊断问题
2. 使用 `fix_image_urls.go` 修复 URL
3. 重启后端服务

**预防措施**：
- 后端已经实现了自动端口转换功能（`ToAbsoluteURL`）
- 但如果环境变量 `ACTUAL_PORT` 未正确设置，可能导致转换失败
- 建议使用相对路径存储图片 URL（修复脚本会自动转换）

### Q: 修复脚本会删除数据吗？

**不会**。修复脚本只会更新 `image_url` 和 `ref_images` 字段，不会删除任何记录或文件。

但为了安全起见，建议在运行修复脚本前备份数据库：
```bash
cp history.db history.db.backup
```

### Q: 修复后还是看不到图片？

可能的原因：
1. 图片文件确实不存在（被删除了）
2. 后端服务未重启
3. 前端缓存问题（刷新页面）
4. 文件权限问题

排查步骤：
1. 运行 `diagnose_image_urls.go` 检查文件是否存在
2. 检查 `output` 目录权限
3. 查看后端日志是否有错误
4. 清除浏览器缓存并刷新

## 注意事项

1. **备份数据库**：运行任何修改数据库的脚本前，务必备份数据库
2. **停止服务**：修改数据库时，建议先停止后端服务
3. **重启服务**：修改数据库后，需要重启后端服务才能生效
4. **测试环境**：建议先在测试环境验证脚本效果
