-- 快速恢复所有被软删除的历史记录
-- 在 SQLite 数据库中执行此脚本

-- 1. 查看当前状态
SELECT 
    COUNT(*) as total_records,
    SUM(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END) as active_records,
    SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) as deleted_records
FROM generation_histories;

-- 2. 恢复所有被软删除的记录
UPDATE generation_histories 
SET deleted_at = NULL 
WHERE deleted_at IS NOT NULL;

-- 3. 验证结果
SELECT 
    COUNT(*) as total_records,
    SUM(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END) as active_records,
    SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) as deleted_records
FROM generation_histories;

-- 4. 查看最早和最新的记录
SELECT 
    MIN(created_at) as earliest_record,
    MAX(created_at) as latest_record,
    COUNT(*) as total_count
FROM generation_histories;
