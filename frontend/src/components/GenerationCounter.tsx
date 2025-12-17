import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImageIcon } from 'lucide-react';
import { api } from '../api';

interface GenerationCounterProps {
  className?: string;
  refreshTrigger?: number; // 用于触发刷新的计数器
}

export default function GenerationCounter({ 
  className = '',
  refreshTrigger = 0 
}: GenerationCounterProps) {
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadCount();
  }, [refreshTrigger]);

  const loadCount = async () => {
    try {
      const response = await api.getGenerationCount();
      if (response.ok) {
        const data = await response.json();
        setCount(data.total_count);
      }
    } catch (error) {
      console.error('加载生成计数失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = () => {
    navigate('/history');
  };

  return (
    <div 
      className={`flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors ${className}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
    >
      <ImageIcon className="w-4 h-4 text-gray-400" />
      <span className="text-sm text-gray-600">
        {loading ? (
          <span className="inline-block w-8 h-4 bg-gray-200 rounded animate-pulse" />
        ) : (
          <>
            已生成 <span className="font-semibold text-red-600">{count}</span> 张
          </>
        )}
      </span>
    </div>
  );
}
