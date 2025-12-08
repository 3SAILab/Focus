import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Lightbox from '../components/Lightbox';
import ImageCard from '../components/ImageCard';
import type { GenerationHistory } from '../type';
import { api } from '../api';
import { formatDate } from '../utils';
import { PageHeader } from '../components/common';

export default function HistoryDetail() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [filteredHistory, setFilteredHistory] = useState<GenerationHistory[]>([]);

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

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    if (date && history.length > 0) {
      const filtered = history.filter((item) => {
        try {
          const itemDate = new Date(item.created_at);
          if (isNaN(itemDate.getTime())) {
            return false;
          }
          const itemDateStr = itemDate.toISOString().split('T')[0];
          return itemDateStr === date;
        } catch {
          return false;
        }
      });
      setFilteredHistory(filtered.reverse()); // 最新的在前
    }
  }, [date, history]);

  return (
    <>
      <PageHeader
        title={date ? formatDate(date) : '历史记录'}
        statusColor="blue"
        backButton={{ onClick: () => navigate('/history') }}
      />

      <div className="flex-1 overflow-y-auto">
        {filteredHistory.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 pb-20 fade-in-up min-h-[60vh]">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
              <div className="w-10 h-10 bg-gray-300 rounded-full"></div>
            </div>
            <h3 className="text-lg font-medium text-gray-600 mb-2">暂无记录</h3>
            <p className="text-sm text-gray-400 max-w-md text-center">
              这一天还没有生成任何图片
            </p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
            {filteredHistory.map((item, index) => (
              <div
                key={item.id || `image-${index}`}
                className="flex flex-col items-center w-full"
              >
                <div className="w-full max-w-lg">
                  <ImageCard
                    item={item}
                    onImageClick={setLightboxImage}
                    onRefImageClick={setLightboxImage}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Lightbox imageUrl={lightboxImage} onClose={() => setLightboxImage(null)} />
    </>
  );
}

