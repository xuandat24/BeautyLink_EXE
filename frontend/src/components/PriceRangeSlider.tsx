import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SlidersHorizontal, Tag, RotateCcw, X, Check } from 'lucide-react';

export interface PriceRange {
  min: number;
  max: number;
}

interface PriceRangeSliderProps {
  minLimit?: number; // Minimum possible price, default 0
  maxLimit?: number; // Maximum possible price, default 1500000
  step?: number;     // Step increments, default 20000
  value: PriceRange;
  onChange: (range: PriceRange) => void;
  itemCount?: number; // Optional number of matching items
  label?: string;
  className?: string;
}

export const formatVNDCompact = (amount: number): string => {
  if (amount >= 1000000) {
    const millions = amount / 1000000;
    return `${millions % 1 === 0 ? millions : millions.toFixed(1)}Tr`;
  }
  if (amount >= 1000) {
    return `${Math.round(amount / 1000)}K`;
  }
  return `${amount}đ`;
};

export const formatVNDFull = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
};

export const PriceRangeSlider: React.FC<PriceRangeSliderProps> = ({
  minLimit = 0,
  maxLimit = 1500000,
  step = 25000,
  value,
  onChange,
  itemCount,
  label = 'Khoảng giá',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Local state for smooth interaction inside dropdown before or while applying
  const [localRange, setLocalRange] = useState<PriceRange>(value);

  // Synchronize when outer value changes
  useEffect(() => {
    setLocalRange(value);
  }, [value]);

  // Close popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const isFiltered = value.min > minLimit || value.max < maxLimit;

  // Handle slider changes
  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMin = Math.min(Number(e.target.value), localRange.max - step);
    const updated = { ...localRange, min: newMin };
    setLocalRange(updated);
    onChange(updated);
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMax = Math.max(Number(e.target.value), localRange.min + step);
    const updated = { ...localRange, max: newMax };
    setLocalRange(updated);
    onChange(updated);
  };

  const handlePresetSelect = (min: number, max: number) => {
    const updated = { min, max };
    setLocalRange(updated);
    onChange(updated);
  };

  const handleReset = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const updated = { min: minLimit, max: maxLimit };
    setLocalRange(updated);
    onChange(updated);
  };

  // Calculate percentage positions for track filling
  const minPercent = Math.min(
    100,
    Math.max(0, ((localRange.min - minLimit) / (maxLimit - minLimit)) * 100)
  );
  const maxPercent = Math.min(
    100,
    Math.max(0, ((localRange.max - minLimit) / (maxLimit - minLimit)) * 100)
  );

  const presets = [
    { label: 'Tất cả', min: minLimit, max: maxLimit },
    { label: '< 200k', min: minLimit, max: 200000 },
    { label: '200k - 500k', min: 200000, max: 500000 },
    { label: '500k - 1Tr', min: 500000, max: 1000000 },
    { label: '> 1 Triệu', min: 1000000, max: maxLimit },
  ];

  const currentDisplayLabel = !isFiltered
    ? 'Tất cả mức giá'
    : `${formatVNDCompact(value.min)} - ${formatVNDCompact(value.max)}`;

  return (
    <div className={`relative inline-block ${className}`} ref={popoverRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all cursor-pointer shadow-xs select-none ${
          isFiltered
            ? 'bg-gradient-to-r from-[#e1146c] to-[#be185d] text-white border-transparent shadow-pink-500/25'
            : 'bg-white text-slate-700 border-pink-200 hover:border-pink-300 hover:bg-pink-50/70'
        }`}
        title="Tùy chỉnh khoảng giá tối thiểu và tối đa"
      >
        <SlidersHorizontal
          className={`w-3.5 h-3.5 ${isFiltered ? 'text-white' : 'text-[#e1146c]'}`}
        />
        <span>{label}:</span>
        <span className={isFiltered ? 'text-pink-100 font-extrabold' : 'text-slate-800'}>
          {currentDisplayLabel}
        </span>

        {isFiltered ? (
          <span
            onClick={handleReset}
            className="ml-1 p-0.5 rounded-full hover:bg-white/20 transition-colors"
            title="Xóa lọc giá"
          >
            <X className="w-3 h-3 text-white" />
          </span>
        ) : (
          <Tag className="w-3 h-3 text-pink-400 ml-0.5" />
        )}
      </button>

      {/* Floating Popover Filter Card */}
      {isOpen && (
        <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-[310px] sm:w-[350px] bg-white rounded-3xl shadow-2xl border border-pink-100 p-5 z-40 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-pink-50">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-pink-50 flex items-center justify-center text-[#e1146c]">
                <Tag className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Bộ Lọc Khoảng Giá
                </h4>
                <p className="text-[11px] text-slate-400">
                  {itemCount !== undefined ? `${itemCount} dịch vụ phù hợp` : 'Kéo để chọn mức giá'}
                </p>
              </div>
            </div>

            {isFiltered && (
              <button
                type="button"
                onClick={handleReset}
                className="text-[11px] font-bold text-[#e1146c] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Đặt lại</span>
              </button>
            )}
          </div>

          {/* Price Range Display Badges */}
          <div className="flex items-center justify-between gap-2 my-4">
            <div className="flex-1 bg-pink-50/80 border border-pink-100/90 rounded-2xl p-2.5 text-center">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">
                Tối thiểu
              </span>
              <span className="text-sm font-black text-[#be185d]">
                {formatVNDFull(localRange.min)}
              </span>
            </div>

            <span className="text-slate-300 font-bold text-xs">—</span>

            <div className="flex-1 bg-pink-50/80 border border-pink-100/90 rounded-2xl p-2.5 text-center">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">
                Tối đa
              </span>
              <span className="text-sm font-black text-[#be185d]">
                {formatVNDFull(localRange.max)}
              </span>
            </div>
          </div>

          {/* Dual Range Track Slider */}
          <div className="relative pt-6 pb-4 px-1">
            {/* Custom Range Track Background */}
            <div className="relative h-2.5 w-full bg-slate-100 rounded-full">
              {/* Highlight Active Range Bar */}
              <div
                className="absolute top-0 bottom-0 bg-gradient-to-r from-[#e1146c] to-[#be185d] rounded-full shadow-sm"
                style={{
                  left: `${minPercent}%`,
                  right: `${100 - maxPercent}%`,
                }}
              />
            </div>

            {/* Native Sliders Layered on Top */}
            <input
              type="range"
              min={minLimit}
              max={maxLimit}
              step={step}
              value={localRange.min}
              onChange={handleMinChange}
              className="absolute top-6 left-0 w-full h-2.5 opacity-0 cursor-pointer pointer-events-auto z-20"
              style={{
                // Ensure proper mouse focus
                pointerEvents: localRange.min > maxLimit - 100000 ? 'none' : 'auto',
              }}
              aria-label="Giá tối thiểu"
            />
            <input
              type="range"
              min={minLimit}
              max={maxLimit}
              step={step}
              value={localRange.max}
              onChange={handleMaxChange}
              className="absolute top-6 left-0 w-full h-2.5 opacity-0 cursor-pointer pointer-events-auto z-20"
              aria-label="Giá tối đa"
            />

            {/* Visual Thumb Handles */}
            <div
              className="absolute top-4 -translate-x-1/2 w-6 h-6 rounded-full bg-white border-2 border-[#e1146c] shadow-md shadow-pink-500/20 flex items-center justify-center pointer-events-none z-10 transition-transform active:scale-110"
              style={{ left: `${minPercent}%` }}
            >
              <div className="w-2 h-2 rounded-full bg-[#e1146c]" />
            </div>

            <div
              className="absolute top-4 -translate-x-1/2 w-6 h-6 rounded-full bg-white border-2 border-[#be185d] shadow-md shadow-pink-500/20 flex items-center justify-center pointer-events-none z-10 transition-transform active:scale-110"
              style={{ left: `${maxPercent}%` }}
            >
              <div className="w-2 h-2 rounded-full bg-[#be185d]" />
            </div>

            {/* Scale Endpoints */}
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mt-3 px-1">
              <span>{formatVNDCompact(minLimit)}</span>
              <span>500K</span>
              <span>1.0Tr</span>
              <span>{formatVNDCompact(maxLimit)}</span>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="mt-2 pt-3 border-t border-pink-50">
            <span className="text-[10px] font-bold text-slate-400 block mb-2 uppercase">
              Mức giá phổ biến
            </span>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((preset, idx) => {
                const isActive =
                  localRange.min === preset.min && localRange.max === preset.max;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handlePresetSelect(preset.min, preset.max)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#e1146c] text-white shadow-xs'
                        : 'bg-pink-50/70 hover:bg-pink-100/70 text-slate-600 hover:text-pink-900 border border-pink-100'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Footer */}
          <div className="mt-4 pt-3 border-t border-pink-50 flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-slate-500">
              {itemCount !== undefined && (
                <>
                  <strong className="text-[#e1146c] font-black">{itemCount}</strong> kết quả
                </>
              )}
            </span>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-1.5 rounded-full bg-gradient-to-r from-[#e1146c] to-[#be185d] text-white text-xs font-bold shadow-md shadow-pink-500/20 hover:opacity-95 transition-opacity cursor-pointer flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Áp dụng</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
