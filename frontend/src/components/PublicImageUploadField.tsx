import { useEffect, useId, useRef, useState } from 'react';
import { prepareImageUpload } from '../lib/imageUpload';

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBusyChange: (busy: boolean) => void;
  disabled?: boolean;
}

/** Public marketing images only. File preparation is local; upload happens when the form is saved. */
export function PublicImageUploadField({ label, value, onChange, onBusyChange, disabled = false }: Props) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  useEffect(() => () => { sequence.current += 1; }, []);

  const choose = async (file?: File) => {
    if (!file) return;
    const request = ++sequence.current;
    setBusy(true);
    setError('');
    onBusyChange(true);
    try {
      const image = await prepareImageUpload(file, { maxStoredCharacters: 1_100_000, maxEdge: 1600, quality: 0.86 });
      if (sequence.current === request) onChange(image);
    } catch (failure) {
      if (sequence.current === request) setError(failure instanceof Error ? failure.message : 'Không thể xử lý ảnh.');
    } finally {
      if (sequence.current === request) {
        setBusy(false);
        onBusyChange(false);
      }
    }
  };

  return (
    <div className="space-y-2">
      <span id={`${id}-label`} className="block text-xs font-bold text-slate-700">{label}</span>
      {value && <img src={value} alt={`Xem trước ${label.toLowerCase()}`} className="h-28 w-40 rounded-xl object-cover" />}
      <label htmlFor={`${id}-file`} className={`inline-flex min-h-11 items-center rounded-xl border border-pink-200 bg-pink-50 px-4 text-sm font-bold text-pink-700 focus-within:ring-2 focus-within:ring-pink-600 ${disabled || busy ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-pink-100'}`}>
        <input id={`${id}-file`} type="file" accept="image/jpeg,image/png,image/webp"
          disabled={disabled || busy} aria-labelledby={`${id}-label ${id}-choose`} aria-describedby={`${id}-help ${id}-error`}
          onChange={event => {
            const file = event.target.files?.[0];
            event.target.value = '';
            void choose(file);
          }} className="sr-only" />
        <span id={`${id}-choose`}>{value ? 'Chọn ảnh khác' : 'Chọn ảnh từ thiết bị'}</span>
      </label>
      <label htmlFor={`${id}-url`} className="block text-xs text-slate-500">Hoặc dùng URL ảnh hiện có</label>
      <input id={`${id}-url`} className="field" placeholder="https://..." disabled={disabled || busy}
        value={value.startsWith('data:') ? '' : value}
        onChange={event => { setError(''); onChange(event.target.value); }} />
      <p id={`${id}-help`} className="text-xs text-slate-500" aria-live="polite">
        {busy ? 'Đang chuẩn bị ảnh...' : 'JPG, PNG, WEBP tối đa 10 MB. Ảnh được tải lên khi bạn lưu biểu mẫu. Không tải giấy tờ cá nhân tại đây.'}
      </p>
      <p id={`${id}-error`} role={error ? 'alert' : undefined} className="text-xs text-red-600">{error}</p>
    </div>
  );
}
