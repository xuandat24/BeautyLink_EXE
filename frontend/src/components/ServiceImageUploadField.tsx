import { useEffect, useId, useRef, useState } from 'react';
import { prepareImageUpload } from '../lib/imageUpload';

export function ServiceImageUploadField({ value, onChange, onBusyChange, disabled = false }: {
  value: string[]; onChange: (images: string[]) => void; onBusyChange: (busy: boolean) => void; disabled?: boolean;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const sequence = useRef(0);
  useEffect(() => () => { sequence.current += 1; }, []);
  const choose = async (files: File[]) => {
    if (!files.length || busy || disabled) return;
    if (value.length + files.length > 6) { setError('Mỗi dịch vụ có tối đa 6 ảnh.'); return; }
    const request = ++sequence.current;
    setBusy(true); onBusyChange(true); setError('');
    try {
      // Prepare sequentially to bound decoded image memory; commit the batch only if every image succeeds.
      const images: string[] = [];
      for (const file of files) images.push(await prepareImageUpload(file, { maxStoredCharacters: 1_100_000, maxEdge: 1600, quality: 0.86 }));
      if (sequence.current === request) onChange([...new Set([...value, ...images])]);
    } catch (failure) {
      if (sequence.current === request) setError(failure instanceof Error ? failure.message : 'Không thể xử lý ảnh.');
    } finally {
      if (sequence.current === request) { setBusy(false); onBusyChange(false); }
    }
  };
  return <fieldset className="space-y-2" disabled={disabled || busy}>
    <legend className="text-xs font-bold text-slate-700">Ảnh dịch vụ ({value.length}/6)</legend>
    {value.length === 0 && <p className="text-xs text-slate-500">Chưa chọn ảnh dịch vụ.</p>}
    <div className="grid grid-cols-2 gap-3">
      {value.map((image, index) => <div key={image} className="space-y-1">
        <img src={image} alt={`Ảnh dịch vụ ${index + 1}`} className="h-28 w-full rounded-xl object-cover" />
        <div className="flex gap-3 text-xs">
          <button type="button" disabled={index === 0 || disabled || busy}
            onClick={() => onChange([image, ...value.filter((_, i) => i !== index)])}>
            {index === 0 ? 'Ảnh bìa' : 'Đặt làm ảnh bìa'}
          </button>
          <button type="button" aria-label={`Xóa ảnh ${index + 1}`} onClick={() => onChange(value.filter((_, i) => i !== index))}>Xóa</button>
        </div>
      </div>)}
    </div>
    <label htmlFor={`${id}-files`} className="block text-xs font-bold">Chọn một hoặc nhiều ảnh</label>
    <input id={`${id}-files`} type="file" multiple accept="image/jpeg,image/png,image/webp" className="block w-full text-xs"
      aria-describedby={`${id}-help`} onChange={event => {
        const files = Array.from(event.target.files ?? []); event.target.value = ''; void choose(files);
      }} />
    <label htmlFor={`${id}-url`} className="block text-xs text-slate-500">Hoặc thêm URL ảnh hiện có</label>
    <input id={`${id}-url`} className="field" value={url} placeholder="https://..." onChange={event => setUrl(event.target.value)} />
    <button type="button" className="text-xs font-bold text-pink-700" onClick={() => {
      try {
        const parsed = new URL(url.trim());
        if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error();
        if (value.length >= 6) { setError('Mỗi dịch vụ có tối đa 6 ảnh.'); return; }
        onChange([...new Set([...value, url.trim()])]); setUrl(''); setError('');
      } catch { setError('Vui lòng nhập URL ảnh HTTP/HTTPS hợp lệ.'); }
    }}>Thêm URL ảnh</button>
    <p id={`${id}-help`} className="text-xs text-slate-500" aria-live="polite">
      {busy ? 'Đang chuẩn bị ảnh...' : 'Tối đa 6 ảnh JPG, PNG, WEBP; mỗi tệp tối đa 10 MB. Ảnh đầu tiên là ảnh bìa. Ảnh được tải lên khi lưu dịch vụ. Không tải giấy tờ cá nhân.'}
    </p>
    {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
  </fieldset>;
}
