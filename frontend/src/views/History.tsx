import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import type { GenerationHistory } from '../type';
import { api } from '../api';
import { formatDate } from '../utils';
import { PageHeader } from '../components/common';
import { AlertDialog } from '../components/ui/alert-dialog';
import { useToast } from '../context/ToastContext';

export default function History() {
  const navigate = useNavigate();
  const toast = useToast();
  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [groupedHistory, setGroupedHistory] = useState<Record<string, GenerationHistory[]>>({});
  const [deleteDate, setDeleteDate] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadHistory = async () => {
    try {
      const response = await api.getHistory(1, 1000); // 增加到 1000 以显示所有历史记录
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (error) {
      console.error('加载历史记录失败:', error);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    // 按日期分组
    const grouped: Record<string, GenerationHistory[]> = {};
    history.forEach((item) => {
      try {
        const date = new Date(item.created_at);
        if (isNaN(date.getTime())) {
          console.warn('Invalid date:', item.created_at);
          return;
        }
        const dateStr = date.toISOString().split('T')[0];
        if (!grouped[dateStr]) {
          grouped[dateStr] = [];
        }
        grouped[dateStr].push(item);
      } catch (e) {
        console.warn('Error parsing date:', item.created_at, e);
      }
    });
    // 按日期倒序排序
    const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
    const sortedGrouped: Record<string, GenerationHistory[]> = {};
    sortedDates.forEach((date) => {
      sortedGrouped[date] = grouped[date].reverse(); // 同一天内的图片按时间正序
    });
    setGroupedHistory(sortedGrouped);
  }, [history]);

  const handleDeleteClick = (e: React.MouseEvent, date: string) => {
    e.stopPropagation(); // 阻止点击事件冒泡到父元素
    setDeleteDate(date);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDate) return;
    
    setIsDeleting(true);
    try {
      const response = await api.deleteHistoryByDate(deleteDate);
      if (response.ok) {
        const data = await response.json();
        toast.success(`已删除 ${data.deleted} 条记录`);
        // 从列表中移除已删除的日期
        setHistory(prev => prev.filter(item => {
          const itemDate = new Date(item.created_at).toISOString().split('T')[0];
          return itemDate !== deleteDate;
        }));
      } else {
        const data = await response.json();
        toast.error(data.error || '删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      toast.error('删除失败，请重试');
    } finally {
      setIsDeleting(false);
      setDeleteDate(null);
    }
  };

  return (
    <>
      <PageHeader title="历史记录" statusColor="blue" />

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-8">
        {Object.keys(groupedHistory).length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 pb-20 fade-in-up">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
              <div className="w-10 h-10 bg-gray-300 rounded-full"></div>
            </div>
            <h3 className="text-lg font-medium text-gray-600 mb-2">暂无历史记录</h3>
            <p className="text-sm text-gray-400 max-w-md text-center">
              开始创作你的第一张图片吧！
            </p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {Object.entries(groupedHistory).map(([date, items]) => (
              <div
                key={date}
                className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow group relative"
                onClick={() => navigate(`/history/${date}`)}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-800">
                    {formatDate(date)}
                  </h2>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-400">
                      {items.length} 张图片
                    </span>
                    {/* 删除按钮 */}
                    <button
                      onClick={(e) => handleDeleteClick(e, date)}
                      className="w-8 h-8 bg-gray-100 hover:bg-red-500 text-gray-400 hover:text-white rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
                      title="删除这一天的记录"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {items.slice(0, 4).map((item, index) => (
                    <div key={item.id || `preview-${index}`} className="relative">
                      <img
                        src={item.image_url}
                        className="w-full aspect-square object-cover rounded-lg"
                        alt={item.prompt || '预览图'}
                      />
                      {items.length > 4 && index === 3 && (
                        <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                          <span className="text-white text-sm font-medium">
                            +{items.length - 4}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 删除确认对话框 */}
      <AlertDialog
        isOpen={!!deleteDate}
        onClose={() => setDeleteDate(null)}
        onConfirm={handleDeleteConfirm}
        title="确认删除"
        description={`确定要删除 ${deleteDate ? formatDate(deleteDate) : ''} 的所有记录吗？删除后将无法恢复，图片文件也会被删除，但不会影响生成次数统计。`}
        confirmText="确认删除"
        variant="destructive"
        isLoading={isDeleting}
      />
    </>
  );
}

