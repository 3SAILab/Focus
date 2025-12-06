interface QualitySelectorProps {
  value: string;
  onChange: (quality: string) => void;
}

export default function QualitySelector({
  value,
  onChange,
}: QualitySelectorProps) {
  return (
    <div className="quality-selector">
      <span className="text-xs text-gray-500 mr-2">清晰度:</span>
      <div
        className={`quality-option ${value === '2K' ? 'active' : ''}`}
        onClick={() => onChange('2K')}
      >
        2K
      </div>
    </div>
  );
}

