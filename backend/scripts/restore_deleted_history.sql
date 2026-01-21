-- 恢复所有被软删除的历史记录
-- 这个脚本会将所有 deleted_at 不为 NULL 的记录恢复

-- 查看有多少条被软删除的记录
SELECT COUNT(*) as deleted_count FROM generation_histories WHERE deleted_at IS NOT NULL;

-- 恢复所有被软删除的记录
UPDATE generation_histories SET deleted_at = NULL WHERE deleted_at IS NOT NULL;

-- 验证恢复结果
SELECT COUNT(*) as total_count FROM generation_histories;
SELECT COUNT(*) as active_count FROM generation_histories WHERE deleted_at IS NULL;
