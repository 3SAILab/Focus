# 更新说明 - 自动数据库迁移

## 版本更新内容

### 🔧 修复：历史记录显示问题

**问题**：前端只显示今天的历史记录，过往记录无法显示

**原因**：数据库中的旧记录被意外标记为软删除（`deleted_at` 字段有值）

**解决方案**：
1. 移除软删除机制，改为只删除图片文件
2. 后端启动时自动检测并恢复被软删除的记录
3. 使用 `image_deleted` 字段标记图片是否已删除

### ✨ 新特性

#### 1. 自动数据库迁移

后端启动时会自动执行以下操作：
- ✅ 检查并添加 `image_deleted` 列
- ✅ 自动恢复所有被软删除的记录
- ✅ 标记已删除图片的记录

**用户无需任何操作**，更新后启动软件即可自动修复。

#### 2. 保留历史记录

删除操作的新行为：
- ✅ 删除图片文件（释放磁盘空间）
- ✅ 保留数据库记录（用于统计和查看历史）
- ✅ 标记 `image_deleted = true`（前端可以显示"已删除"状态）

#### 3. 完整的历史记录

- ✅ 显示所有历史记录（包括图片已删除的）
- ✅ 支持按日期查看
- ✅ 支持分页加载

## 更新步骤

### 对于开发者

1. **拉取最新代码**：
```bash
git pull
```

2. **重新编译后端**：
```bash
cd backend
go build -o sigma-backend.exe
```

3. **启动服务**：
```bash
npm run dev
```

4. **验证**：
   - 查看启动日志，确认迁移成功
   - 打开前端，检查历史记录是否完整

### 对于最终用户

**无需任何操作！**

只需：
1. 下载并安装新版本
2. 启动软件
3. 软件会自动修复数据库

首次启动时，你会在日志中看到：
```
检查数据库迁移...
  发现 45 条被软删除的记录，正在恢复...
  ✓ 成功恢复 45 条记录
```

## 启动日志示例

### 正常启动（无需迁移）

```
========================================
SIGMA Backend 启动中...
========================================
✓ 输出目录: C:\Users\YourName\sigma_data\output
✓ 上传目录: C:\Users\YourName\sigma_data\uploads
✓ 数据库目录: C:\Users\YourName\sigma_data
✓ 数据库路径: C:\Users\YourName\sigma_data\sigma.db
检查数据库迁移...
  ✓ 数据库已是最新版本
服务启动: http://localhost:51888
```

### 首次更新（需要迁移）

```
========================================
SIGMA Backend 启动中...
========================================
✓ 输出目录: C:\Users\YourName\sigma_data\output
✓ 上传目录: C:\Users\YourName\sigma_data\uploads
✓ 数据库目录: C:\Users\YourName\sigma_data
✓ 数据库路径: C:\Users\YourName\sigma_data\sigma.db
检查数据库迁移...
  添加 image_deleted 列...
  ✓ 已添加 image_deleted 列
  发现 45 条被软删除的记录，正在恢复...
  ✓ 成功恢复 45 条记录
服务启动: http://localhost:51888
```

## 技术细节

### 迁移逻辑

```go
func autoMigrateDatabase() error {
    // 1. 检查 image_deleted 列是否存在
    // 2. 如果不存在，添加它
    // 3. 检查是否有被软删除的记录
    // 4. 将被软删除的记录标记为 image_deleted = true
    // 5. 恢复记录（将 deleted_at 设置为 NULL）
    return nil
}
```

### 数据库变更

**旧结构**：
```sql
CREATE TABLE generation_histories (
    id INTEGER PRIMARY KEY,
    created_at DATETIME,
    updated_at DATETIME,
    deleted_at DATETIME,  -- 软删除字段
    prompt TEXT,
    image_url TEXT,
    ...
);
```

**新结构**：
```sql
CREATE TABLE generation_histories (
    id INTEGER PRIMARY KEY,
    created_at DATETIME,
    updated_at DATETIME,
    deleted_at DATETIME,  -- 保留但不再使用
    image_deleted BOOLEAN DEFAULT 0,  -- 新增字段
    prompt TEXT,
    image_url TEXT,
    ...
);
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

## 兼容性

- ✅ 向后兼容：旧版本的数据库可以无缝升级
- ✅ 自动迁移：无需手动操作
- ✅ 安全迁移：不会丢失任何数据

## 常见问题

### Q: 更新后会丢失数据吗？

A: 不会。迁移过程只是恢复被软删除的记录，不会删除任何数据。

### Q: 迁移需要多长时间？

A: 通常只需要几秒钟。即使有数千条记录，也不会超过 10 秒。

### Q: 如果迁移失败怎么办？

A: 迁移失败不会影响软件启动，只会在日志中显示警告。你可以手动运行迁移脚本：
```bash
go run backend/scripts/migrate_to_no_soft_delete.go
```

### Q: 可以回滚到旧版本吗？

A: 可以，但不推荐。新版本的数据库结构向后兼容，旧版本可以正常读取（会忽略 `image_deleted` 字段）。

### Q: 图片文件会被恢复吗？

A: 不会。迁移只恢复数据库记录，不会恢复已删除的图片文件。

## 反馈

如果遇到任何问题，请：
1. 检查启动日志（`backend/startup.log`）
2. 查看数据库文件（`~/sigma_data/sigma.db`）
3. 提供详细的错误信息

---

**更新日期**：2026-01-21  
**版本**：v1.1.0
