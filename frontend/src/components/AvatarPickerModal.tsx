import React, { useState } from 'react';
import {
  X,
  Upload,
  Camera,
  Check,
  Sparkles,
  Link as LinkIcon,
  Trash2,
  User,
} from 'lucide-react';
import { avatarUrlSchema } from '../lib/validation';
import { FieldError } from './FieldError';

interface AvatarPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAvatar?: string;
  onSaveAvatar: (newAvatarUrl: string) => void;
}

const CURATED_AVATARS = [
  {
    id: 'av-1',
    name: 'Nữ tính thanh lịch',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'av-2',
    name: 'Ngọt ngào trong trẻo',
    url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'av-3',
    name: 'Tự tin rạng rỡ',
    url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'av-4',
    name: 'Hiện đại phong cách',
    url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'av-5',
    name: 'Quyến rũ sắc sảo',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'av-6',
    name: 'Tự nhiên tỏa sáng',
    url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'av-7',
    name: 'Năng động cá tính',
    url: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'av-8',
    name: 'Tối giản sang trọng',
    url: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=300&q=80',
  },
];

export const AvatarPickerModal: React.FC<AvatarPickerModalProps> = ({
  isOpen,
  onClose,
  currentAvatar,
  onSaveAvatar,
}) => {
  const [selectedAvatar, setSelectedAvatar] = useState<string>(currentAvatar || '');
  const [customUrl, setCustomUrl] = useState<string>('');
  const [tab, setTab] = useState<'upload' | 'curated' | 'link'>('curated');
  const [validationError, setValidationError] = useState('');

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setValidationError('Chỉ chấp nhận ảnh JPG, PNG, WEBP hoặc GIF.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setValidationError('Ảnh đại diện không được vượt quá 5 MB.');
      return;
    }
    setValidationError('');

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result && typeof reader.result === 'string') {
        setSelectedAvatar(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyLink = () => {
    const validation = avatarUrlSchema.safeParse(customUrl);
    if (!validation.success) {
      setValidationError(validation.error.issues[0].message);
      return;
    }
    setValidationError('');
    setSelectedAvatar(validation.data);
    setCustomUrl('');
  };

  const handleSave = () => {
    if (!selectedAvatar) {
      setValidationError('Vui lòng chọn hoặc tải lên một ảnh đại diện.');
      return;
    }
    setValidationError('');
    onSaveAvatar(selectedAvatar);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-pink-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 pb-4 bg-gradient-to-r from-pink-500 via-[#db2777] to-[#be185d] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center">
              <Camera className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-pink-200 block">
                Cập nhật ảnh đại diện
              </span>
              <h3 className="text-base font-black">Thay đổi Avatar</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Avatar Preview Box */}
          <div className="flex flex-col items-center justify-center gap-2 text-center pb-4 border-b border-pink-50">
            <div className="relative">
              {selectedAvatar ? (
                <img
                  src={selectedAvatar}
                  alt="Avatar Preview"
                  className="w-24 h-24 rounded-3xl object-cover border-4 border-pink-200 shadow-md"
                />
              ) : (
                <div className="w-24 h-24 rounded-3xl bg-pink-100 text-[#be185d] border-4 border-pink-200 flex items-center justify-center text-3xl font-black shadow-md">
                  <User className="w-10 h-10 text-pink-400" />
                </div>
              )}
              {selectedAvatar && (
                <button
                  type="button"
                  onClick={() => setSelectedAvatar('')}
                  className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center text-xs shadow cursor-pointer transition"
                  title="Xóa avatar"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Ảnh đại diện sẽ hiển thị trên thông tin cá nhân, đánh giá và vé lịch hẹn của bạn.
            </p>
          </div>

          {/* Sub tabs */}
          <div className="flex p-1 bg-pink-50 rounded-2xl gap-1 text-xs font-bold text-slate-600">
            <button
              type="button"
              onClick={() => setTab('curated')}
              className={`flex-1 py-1.5 rounded-xl transition cursor-pointer text-center ${
                tab === 'curated'
                  ? 'bg-white text-[#be185d] shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              Bộ sưu tập gợi ý
            </button>
            <button
              type="button"
              onClick={() => setTab('upload')}
              className={`flex-1 py-1.5 rounded-xl transition cursor-pointer text-center ${
                tab === 'upload'
                  ? 'bg-white text-[#be185d] shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              Tải từ thiết bị
            </button>
            <button
              type="button"
              onClick={() => setTab('link')}
              className={`flex-1 py-1.5 rounded-xl transition cursor-pointer text-center ${
                tab === 'link'
                  ? 'bg-white text-[#be185d] shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              Dán URL
            </button>
          </div>

          {/* Tab 1: Curated Avatars */}
          {tab === 'curated' && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-600 block">
                Chọn mẫu ảnh đại diện thẩm mỹ phong cách:
              </span>
              <div className="grid grid-cols-4 gap-2.5 max-h-48 overflow-y-auto p-1">
                {CURATED_AVATARS.map((item) => {
                  const isSelected = selectedAvatar === item.url;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => { setSelectedAvatar(item.url); setValidationError(''); }}
                      className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition hover:scale-105 cursor-pointer ${
                        isSelected
                          ? 'border-[#be185d] ring-2 ring-pink-400'
                          : 'border-pink-100 hover:border-pink-300'
                      }`}
                      title={item.name}
                    >
                      <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                      {isSelected && (
                        <div className="absolute inset-0 bg-[#be185d]/40 flex items-center justify-center text-white">
                          <Check className="w-5 h-5 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 2: Upload from Device */}
          {tab === 'upload' && (
            <div className="space-y-3">
              <label className="border-2 border-dashed border-pink-300 hover:border-pink-500 rounded-3xl p-6 flex flex-col items-center justify-center gap-2 bg-pink-50/40 hover:bg-pink-50 transition cursor-pointer text-center">
                <div className="w-12 h-12 rounded-2xl bg-white shadow-xs text-[#e1146c] flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-black text-slate-800 block">
                    Bấm để chọn ảnh từ máy tính hoặc điện thoại
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Hỗ trợ định dạng JPG, PNG, WEBP, GIF
                  </span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* Tab 3: Link URL */}
          {tab === 'link' && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 block">
                Dán đường dẫn trực tiếp tới ảnh:
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="url"
                    value={customUrl}
                    onChange={(e) => { setCustomUrl(e.target.value); setValidationError(''); }}
                    maxLength={2048}
                    aria-invalid={Boolean(validationError)}
                    aria-describedby="avatar-error"
                    placeholder="https://example.com/avatar.jpg"
                    className="w-full px-3.5 py-2.5 pl-9 rounded-xl border border-pink-200 text-xs text-slate-800 focus:outline-none focus:border-[#e1146c]"
                  />
                  <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
                <button
                  type="button"
                  onClick={handleApplyLink}
                  className="px-3.5 py-2.5 rounded-xl bg-pink-100 text-[#be185d] text-xs font-bold hover:bg-pink-200 transition cursor-pointer"
                >
                  Áp dụng
                </button>
              </div>
            </div>
          )}

          <FieldError id="avatar-error" message={validationError} />

          {/* Action buttons */}
          <div className="pt-3 border-t border-pink-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-pink-200 text-slate-600 hover:bg-pink-50 text-xs font-bold transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 via-[#db2777] to-[#be185d] text-white text-xs font-black shadow-md hover:opacity-95 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Lưu ảnh đại diện</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
