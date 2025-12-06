// src/components/Sidebar.tsx

import { useEffect, useState } from 'react';
import { Sparkles, PenTool, Settings } from 'lucide-react';
import type { GenerationHistory } from '../type';
import { formatTime } from '../utils';
import { api } from '../api';
import { useConfig } from '../context/ConfigContext';

interface SidebarProps {
  onSelectHistory: (item: GenerationHistory) => void;
}

export default function Sidebar({ onSelectHistory }: SidebarProps) {
  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  
  // 使用 ConfigContext 中的打开设置方法
  const { openSettings } = useConfig();

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const response = await api.getHistory();
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (error) {
      console.error('加载历史记录失败:', error);
    }
  };

  const handleSelect = (item: GenerationHistory) => {
    setSelectedId(item.id || null);
    onSelectHistory(item);
  };

  return (
    <aside className="w-[80px] h-full bg-white border-r border-gray-100 flex flex-col items-center py-6 z-50 shrink-0 shadow-sm justify-between">
      
      {/* 上半部分：Logo、导航和历史记录 */}
      <div className="w-full flex flex-col items-center flex-1 min-h-0">
        <div className="mb-8 shrink-0">
          <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-200">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
        </div>
        
        <nav className="flex flex-col w-full gap-2 mb-4 shrink-0">
          <button className="w-full py-4 flex flex-col items-center justify-center text-red-600 bg-red-50 border-r-2 border-red-600 transition-all">
            <PenTool className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-medium">创作</span>
          </button>
        </nav>
        
        <div className="flex-1 w-full overflow-y-auto px-2 min-h-0">
          <div className="text-[10px] text-gray-400 font-medium mb-2 px-2 sticky top-0 bg-white pb-1">历史记录</div>
          <div className="space-y-1 pb-2">
            {[...history].reverse().map((item, index) => (
              <div
                key={item.id || `history-${index}`}
                className={`history-item ${selectedId === item.id ? 'active' : ''}`}
                onClick={() => handleSelect(item)}
              >
                <img
                  src={item.image_url}
                  className="history-thumb"
                  alt="历史记录"
                />
                <div className="text-[8px] text-gray-400 mt-1 text-center truncate">
                  {formatTime(item.created_at)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 底部：设置按钮 */}
      <div className="w-full px-4 pt-4 border-t border-gray-100 shrink-0 mt-2">
        <button
          onClick={openSettings}
          className="w-full aspect-square rounded-xl flex flex-col items-center justify-center text-gray-400 hover:text-gray-800 hover:bg-gray-50 transition-all group"
          title="设置 API Key"
        >
          <Settings className="w-5 h-5 mb-1 group-hover:rotate-45 transition-transform duration-300" />
          <span className="text-[9px] font-medium">设置</span>
        </button>
      </div>
    </aside>
  );
}