import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { ImagePlus, Search, Trash2 } from 'lucide-react';
import { communityApi } from '../../services/communityApi';
import { prepareImageUpload } from '../../lib/imageUpload';
import { communityCategories, type CommunityCategory, type CommunityIdentityOption, type CommunityMedia, type CommunityPost, type CommunityPostWrite, type CommunityServiceCard } from '../../types/community';
import { CommunityDialog, communityError, useCommunityGuard } from './communityUi';

type Photo = { key: string; preview: string; data?: string; stored?: CommunityMedia };
const identityKey = (i: CommunityIdentityOption) => `${i.identity}:${i.salonId ?? ''}:${i.practitionerId ?? ''}`;
const sameWrite = (a: CommunityPostWrite, b: CommunityPostWrite) => a.content.trim() === b.content && a.category === b.category && a.identity === b.identity && a.salonId === b.salonId && a.practitionerId === b.practitionerId && a.serviceId === b.serviceId && [...a.media].sort().join() === [...b.media].sort().join();

export function CommunityPostComposer({ initial, onSaved, onClose }: { initial?: CommunityPost; onSaved: (p: CommunityPost) => void; onClose: () => void }) {
  const [content, setContent] = useState(initial?.content ?? ''); const [category, setCategory] = useState<CommunityCategory>(initial?.category ?? 'GENERAL');
  const [identities, setIdentities] = useState<CommunityIdentityOption[]>([]); const [identity, setIdentity] = useState('ACCOUNT::');
  const [photos, setPhotos] = useState<Photo[]>(initial?.media.map(m => ({ key: m.id, preview: m.url, stored: m })) ?? []);
  const [service, setService] = useState<CommunityServiceCard | null>(initial?.service ?? null); const [q, setQ] = useState(''); const [services, setServices] = useState<CommunityServiceCard[]>([]);
  const [searching, setSearching] = useState(false); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [preparing, setPreparing] = useState(false);
  const [stage, setStage] = useState(''); const [error, setError] = useState(''); const [uncertain, setUncertain] = useState(false); const [consent, setConsent] = useState(false); const [retry, setRetry] = useState(0);
  const lock = useRef(false); const picking = useRef(false); const attempt = useRef<CommunityPostWrite | null>(null); const revision = useRef(initial?.revision); const searchVersion = useRef(0); const guard = useCommunityGuard();
  useEffect(() => {
    let active = true; const current = guard(); setLoading(true); setError('');
    Promise.all([communityApi.identities(), initial ? communityApi.editInfo(initial.id) : Promise.resolve(null)]).then(([options, editable]) => {
      if (!active || !current()) return; setIdentities(options);
      if (editable) {
        const f = editable.fields; setContent(f.content); setCategory(f.category); revision.current = f.revision; setService(editable.post.service); setPhotos(editable.post.media.map(m => ({ key: m.id, preview: m.url, stored: m })));
        const found = options.find(o => o.identity === f.identity && o.salonId === f.salonId && o.practitionerId === f.practitionerId); setIdentity(found ? identityKey(found) : 'ACCOUNT::');
      }
    }).catch(e => { if (active && current()) setError(communityError(e)); }).finally(() => { if (active && current()) setLoading(false); });
    return () => { active = false; };
  }, [initial?.id, guard, retry]);
  const choosePhotos = async (files: FileList | null) => {
    if (!files || picking.current || lock.current || uncertain) return;
    if (files.length + photos.length > 3) { setError('Mỗi bài tối đa 3 ảnh.'); return; }
    picking.current = true; setPreparing(true); setError(''); const current = guard();
    try {
      const prepared: Photo[] = [];
      for (const file of Array.from(files)) { const data = await prepareImageUpload(file, { maxStoredCharacters: 1_050_000, maxEdge: 1600, quality: 0.85 }); prepared.push({ key: crypto.randomUUID(), data, preview: data }); }
      if (current()) setPhotos(old => [...old, ...prepared]);
    } catch (e) { if (current()) setError(communityError(e)); } finally { picking.current = false; if (current()) setPreparing(false); }
  };
  const searchServices = async () => {
    const version = ++searchVersion.current, current = guard(); setSearching(true); setError('');
    try { const data = await communityApi.services(q.trim()); if (current() && version === searchVersion.current) setServices(data); }
    catch (e) { if (current() && version === searchVersion.current) setError(communityError(e)); }
    finally { if (current() && version === searchVersion.current) setSearching(false); }
  };
  const submit = async () => {
    if (lock.current || preparing || loading || !content.trim()) return;
    const representation = identities.find(i => identityKey(i) === identity); if (!representation) { setError('Vui lòng tải lại tư cách đăng.'); return; }
    if (photos.length && !consent) { setError('Vui lòng xác nhận quyền sử dụng ảnh.'); return; }
    lock.current = true; setBusy(true); setError(''); const current = guard();
    try {
      let body = attempt.current;
      if (!body) {
        const ids: string[] = [];
        for (const [index, photo] of photos.entries()) {
          setStage(`Đang lưu ảnh ${index + 1}/${photos.length}…`);
          const stored = photo.stored ?? await communityApi.upload(photo.data!); if (!current()) return;
          ids.push(stored.id); setPhotos(old => old.map(item => item.key === photo.key ? { ...item, stored, data: undefined, preview: stored.url } : item));
        }
        body = { requestKey: crypto.randomUUID(), content: content.trim(), category, identity: representation.identity, salonId: representation.salonId, practitionerId: representation.practitionerId, serviceId: service?.id ?? null, media: ids, revision: revision.current };
        attempt.current = body;
      }
      setStage('Đang lưu bài viết…');
      const saved = initial ? await communityApi.edit(initial.id, body) : await communityApi.create(body);
      if (!current()) return; attempt.current = null; setUncertain(false); onSaved(saved);
    } catch (e) {
      if (!current()) return;
      const temporary = !axios.isAxiosError(e) || !e.response || e.response.status >= 500;
      if (initial && attempt.current && temporary) {
        try { const observed = await communityApi.editInfo(initial.id); if (current() && sameWrite(attempt.current, observed.fields)) { attempt.current = null; setUncertain(false); onSaved(observed.post); return; } } catch { /* Keep the pending edit and require explicit retry. */ }
      }
      const pending = attempt.current != null && temporary; setUncertain(pending); if (!pending) attempt.current = null;
      setError(pending ? 'Kết quả gửi chưa rõ. Thử lại cùng lần gửi này để kiểm tra, không tạo bài mới.' : communityError(e));
    } finally { lock.current = false; if (current()) { setBusy(false); setStage(''); } }
  };
  const frozen = busy || preparing || uncertain || loading;
  return <CommunityDialog title={initial ? 'Chỉnh sửa bài viết' : 'Chia sẻ cùng BeautyLink'} onClose={onClose} busy={busy || preparing}>
    <form onSubmit={e => { e.preventDefault(); void submit(); }} className="space-y-4">
      {loading && <p role="status" className="text-sm text-slate-500">Đang tải thông tin đăng bài…</p>}
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Tư cách đăng<select value={identity} disabled={frozen} onChange={e => setIdentity(e.target.value)} className="community-field mt-1">{identities.map(i => <option key={identityKey(i)} value={identityKey(i)}>{i.label}</option>)}</select></label><label className="text-sm font-semibold">Chủ đề<select value={category} disabled={frozen} onChange={e => setCategory(e.target.value as CommunityCategory)} className="community-field mt-1">{Object.entries(communityCategories).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label></div>
      <label className="block text-sm font-semibold">Nội dung<textarea required maxLength={5000} value={content} disabled={frozen} onChange={e => setContent(e.target.value)} placeholder="Chia sẻ trải nghiệm, đặt câu hỏi hoặc giới thiệu tác phẩm của bạn…" className="community-field mt-2 min-h-36 resize-y" /></label><p className="text-right text-xs text-slate-500">{content.length}/5.000 ký tự</p>
      <div className="grid grid-cols-3 gap-2">{photos.map((photo, index) => <div key={photo.key} className="relative min-w-0"><img src={photo.preview} alt={`Ảnh bài viết ${index + 1}`} className="aspect-square w-full rounded-xl object-cover" /><button type="button" disabled={frozen} aria-label={`Xóa ảnh ${index + 1}`} onClick={() => setPhotos(old => old.filter(p => p.key !== photo.key))} className="absolute right-1 top-1 rounded-lg bg-white p-2 text-rose-700 shadow"><Trash2 className="h-4 w-4" /></button></div>)}</div>
      <label className="inline-flex min-h-11 max-w-full cursor-pointer focus-within:ring-2 focus-within:ring-pink-600 items-center gap-2 rounded-xl border border-pink-200 px-3 text-sm font-semibold text-pink-700"><ImagePlus className="h-4 w-4 shrink-0" />{preparing ? 'Đang chuẩn bị ảnh…' : 'Thêm ảnh (tối đa 3)'}<input aria-label="Ảnh bài viết" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={frozen || photos.length >= 3} onChange={e => { const files = e.currentTarget.files; void choosePhotos(files); e.currentTarget.value = ''; }} className="w-0 overflow-hidden opacity-0" /></label>
      <p className="text-xs text-slate-500">JPG, PNG, WEBP tối đa 10 MB mỗi tệp; ảnh được nén và kiểm tra trước khi lưu. Không đăng giấy tờ, thông tin khách hay ảnh người khác khi chưa được đồng ý.</p>
      {photos.length > 0 && <label className="flex items-start gap-2 text-xs text-slate-600"><input type="checkbox" checked={consent} disabled={frozen} onChange={e => setConsent(e.target.checked)} className="mt-0.5" />Tôi có quyền sử dụng ảnh và đã được những người trong ảnh đồng ý cho đăng công khai.</label>}
      <fieldset disabled={frozen} className="space-y-2 rounded-2xl border border-pink-100 p-3"><legend className="px-1 text-sm font-semibold">Gắn dịch vụ BeautyLink (tùy chọn)</legend><div className="flex gap-2"><input aria-label="Tìm dịch vụ để gắn" maxLength={100} value={q} onChange={e => setQ(e.target.value)} placeholder="Tên dịch vụ hoặc salon" className="community-field min-w-0 flex-1" /><button type="button" onClick={() => void searchServices()} disabled={searching} aria-label="Tìm dịch vụ" className="community-button-secondary"><Search className="h-4 w-4" /></button></div>{searching && <p role="status" className="text-xs text-slate-500">Đang tìm dịch vụ…</p>}<ul className="max-h-44 space-y-1 overflow-y-auto">{services.map(s => <li key={s.id}><button type="button" onClick={() => { setService(s); setServices([]); }} className="min-h-11 w-full rounded-lg p-2 text-left text-sm hover:bg-pink-50">{s.name}<span className="block text-xs text-slate-500">{s.salonName} · {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(s.price)}</span></button></li>)}</ul>{service && <div className="flex items-center justify-between gap-2 rounded-xl bg-pink-50 p-3 text-sm"><span className="min-w-0 break-words font-semibold">{service.name}<span className="block text-xs font-normal">{service.salonName}</span></span><button type="button" onClick={() => setService(null)} aria-label="Bỏ dịch vụ" className="p-2"><Trash2 className="h-4 w-4" /></button></div>}<p className="text-xs text-slate-500">Đối tác chỉ gắn dịch vụ của mình; khách hàng có thể tham khảo dịch vụ công khai. Giá và quyền đại diện luôn do máy chủ kiểm tra.</p></fieldset>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}{initial && error && !uncertain && <button type="button" disabled={frozen} onClick={() => setRetry(n => n + 1)} className="community-button-secondary">Tải bản mới từ máy chủ (bỏ thay đổi đang nhập)</button>}{!loading && identities.length === 0 && <button type="button" onClick={() => setRetry(n => n + 1)} className="community-button-secondary">Tải lại thông tin đăng</button>}
      {stage && <p role="status" className="text-sm text-pink-700">{stage}</p>}<div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={onClose} disabled={busy || preparing} className="community-button-secondary">{uncertain ? 'Đóng và kiểm tra bảng tin trước khi đăng lại' : 'Hủy'}</button><button disabled={busy || preparing || loading || !identities.length || !content.trim()} className="community-button">{busy ? 'Đang lưu…' : uncertain ? 'Kiểm tra lại cùng lần gửi' : initial ? 'Lưu thay đổi' : 'Đăng bài'}</button></div>
    </form>
  </CommunityDialog>;
}
