import React, { useEffect, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, ImagePlus, LoaderCircle, LocateFixed, MapPin, Pencil, Plus, Save, Store, Trash2, X } from 'lucide-react';
import { getApiErrorMessage } from '../lib/api';
import { prepareImageUpload } from '../lib/imageUpload';
import { platformApi } from '../services/platformApi';
import type { ServiceCategory, SupplierProfile, SupplierService, SupplierServicePayload } from '../types';

interface SupplierStorePageProps {
  profile: SupplierProfile;
  onProfileUpdated: (profile: SupplierProfile) => void;
}

const blankService = (categoryId = 0): SupplierServicePayload => ({
  categoryId,
  name: '',
  description: '',
  price: 0,
  originalPrice: null,
  durationMinutes: 60,
  imageUrl: null,
  active: true,
});

const formatMoney = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

export const SupplierStorePage: React.FC<SupplierStorePageProps> = ({ profile, onProfileUpdated }) => {
  const [profileForm, setProfileForm] = useState({
    name: profile.name,
    businessType: profile.businessType,
    description: profile.description || '',
    addressLine: profile.addressLine,
    imageUrl: profile.imageUrl || null as string | null,
    latitude: profile.latitude ?? null as number | null,
    longitude: profile.longitude ?? null as number | null,
  });
  const [services, setServices] = useState<SupplierService[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [locating, setLocating] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<SupplierService | 'new' | null>(null);

  useEffect(() => {
    setLoading(true);
    platformApi.supplierServices()
      .then(setServices)
      .catch((requestError) => setError(`${getApiErrorMessage(requestError)} Hãy khởi động lại backend nếu bạn vừa cập nhật mã nguồn.`))
      .finally(() => setLoading(false));
    setLoadingCategories(true);
    platformApi.categories()
      .then(setCategories)
      .catch((requestError) => setError(getApiErrorMessage(requestError, 'Không thể tải danh mục dịch vụ.')))
      .finally(() => setLoadingCategories(false));
  }, []);

  const openServiceCreator = async () => {
    if (categories.length) { setEditor('new'); return; }
    setLoadingCategories(true); setError('');
    try {
      const items = await platformApi.categories();
      setCategories(items);
      if (items.length) setEditor('new');
      else setError('Cơ sở dữ liệu chưa có danh mục dịch vụ. Hãy khởi động lại backend để chạy dữ liệu mẫu.');
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Không thể tải danh mục dịch vụ.'));
    } finally {
      setLoadingCategories(false);
    }
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profileForm.imageUrl) {
      setError('Vui lòng tải ảnh đại diện hoặc ảnh bìa của cơ sở trước khi lưu.');
      return;
    }
    if (profileForm.latitude == null || profileForm.longitude == null) {
      setError('Vui lòng xác định GPS của cơ sở trước khi lưu.');
      return;
    }
    setSavingProfile(true); setError(''); setProfileMessage('');
    try {
      const updated = await platformApi.updateSupplierProfile(profileForm);
      onProfileUpdated(updated);
      setProfileMessage('Đã lưu thông tin và hình ảnh gian hàng.');
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setSavingProfile(false);
    }
  };

  const detectLocation = () => {
    if (!navigator.geolocation) { setError('Trình duyệt này không hỗ trợ định vị GPS.'); return; }
    setLocating(true); setError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setProfileForm((current) => ({ ...current, latitude: Number(coords.latitude.toFixed(7)), longitude: Number(coords.longitude.toFixed(7)) }));
        setProfileMessage('Đã cập nhật vị trí GPS của cơ sở.');
        setLocating(false);
      },
      () => { setError('Không thể lấy vị trí. Hãy cho phép quyền định vị và thử lại ngay tại cơ sở.'); setLocating(false); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  };

  const saveService = async (payload: SupplierServicePayload) => {
    const saved = editor === 'new'
      ? await platformApi.createSupplierService(payload)
      : await platformApi.updateSupplierService(editor!.id, payload);
    setServices((current) => editor === 'new' ? [saved, ...current] : current.map((item) => item.id === saved.id ? saved : item));
    setEditor(null);
  };

  const deactivate = async (service: SupplierService) => {
    if (!window.confirm(`Ẩn dịch vụ “${service.name}” khỏi khách hàng?`)) return;
    try {
      await platformApi.deactivateSupplierService(service.id);
      setServices((current) => current.map((item) => item.id === service.id ? { ...item, active: false } : item));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    }
  };

  return <section>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#EB0F51]">Gian hàng</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">Hồ sơ & dịch vụ</h1><p className="mt-2 text-sm text-slate-500">Cập nhật hình ảnh thương hiệu và những dịch vụ khách hàng có thể đặt.</p></div>
      <button onClick={openServiceCreator} disabled={loadingCategories} className="inline-flex items-center gap-2 rounded-xl bg-[#EB0F51] px-4 py-3 text-xs font-black text-white shadow-md shadow-pink-600/15 hover:bg-[#B42D58] disabled:opacity-40">{loadingCategories ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {loadingCategories ? 'Đang tải danh mục...' : 'Tạo dịch vụ'}</button>
    </div>

    {error && <div role="alert" className="mt-5 flex items-center justify-between rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700"><span>{error}</span><button onClick={() => setError('')} aria-label="Đóng thông báo"><X className="h-4 w-4" /></button></div>}

    <div className="mt-7 grid gap-6 xl:grid-cols-[380px_1fr]">
      <form onSubmit={saveProfile} className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-pink-50 text-[#EB0F51]"><Store className="h-5 w-5" /></span><div><h2 className="font-black">Thông tin gian hàng</h2><p className="text-[11px] text-slate-500">Hiển thị trên thẻ dịch vụ và trang chủ.</p></div></div>
        <div className="mt-5"><ImagePicker label="Ảnh đại diện / ảnh bìa" value={profileForm.imageUrl} onChange={(imageUrl) => setProfileForm((current) => ({ ...current, imageUrl }))} /></div>
        <div className="mt-5 space-y-4">
          <Field label="Tên gian hàng *"><input required maxLength={160} value={profileForm.name} onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })} className="field" /></Field>
          <Field label="Loại hình kinh doanh *"><input required maxLength={120} value={profileForm.businessType} onChange={(event) => setProfileForm({ ...profileForm, businessType: event.target.value })} className="field" /></Field>
          <Field label="Địa chỉ *"><input required maxLength={255} value={profileForm.addressLine} onChange={(event) => setProfileForm({ ...profileForm, addressLine: event.target.value })} className="field" /></Field>
          <div className="rounded-2xl border border-pink-100 bg-pink-50/50 p-4">
            <div className="flex items-start gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#EB0F51]" /><div className="min-w-0 flex-1"><p className="text-xs font-black text-slate-800">Vị trí GPS của cơ sở *</p><p className="mt-1 text-[11px] leading-4 text-slate-500">Dùng để tính khoảng cách thật trong mục “Gần bạn”. Chỉ tọa độ cửa hàng được hiển thị, không phải vị trí cá nhân.</p></div></div>
            <button type="button" onClick={detectLocation} disabled={locating} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-pink-200 bg-white px-3 py-2.5 text-xs font-black text-[#B42D58] hover:bg-pink-100 disabled:opacity-50">{locating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : profileForm.latitude != null ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <LocateFixed className="h-4 w-4" />}{locating ? 'Đang định vị...' : profileForm.latitude != null ? `Đã định vị · ${profileForm.latitude.toFixed(5)}, ${profileForm.longitude?.toFixed(5)}` : 'Lấy vị trí hiện tại'}</button>
          </div>
          <Field label="Giới thiệu"><textarea rows={4} maxLength={1500} value={profileForm.description} onChange={(event) => setProfileForm({ ...profileForm, description: event.target.value })} className="field resize-none" /></Field>
        </div>
        {profileMessage && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-700">{profileMessage}</p>}
        <button disabled={savingProfile} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-xs font-black text-white hover:bg-[#B42D58] disabled:opacity-50">{savingProfile ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Lưu gian hàng</button>
      </form>

      <div className="min-w-0">
        <div className="mb-4 flex items-center justify-between"><div><h2 className="font-black">Dịch vụ của bạn</h2><p className="mt-1 text-xs text-slate-500">{services.filter((item) => item.active).length} dịch vụ đang hiển thị</p></div></div>
        {loading ? <div className="grid h-64 place-items-center rounded-3xl border border-slate-200 bg-white"><LoaderCircle className="h-7 w-7 animate-spin text-[#EB0F51]" /></div> : services.length ? <div className="grid gap-4 md:grid-cols-2">{services.map((service) => <article key={service.id} className={`overflow-hidden rounded-3xl border bg-white shadow-sm ${service.active ? 'border-slate-200' : 'border-slate-200 opacity-65'}`}>
          <div className="relative h-40 bg-slate-100">{service.imageUrl ? <img src={service.imageUrl} alt={service.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-slate-300"><ImagePlus className="h-8 w-8" /></div>}<span className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black shadow ${service.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-800 text-white'}`}>{service.active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}{service.active ? 'Đang hiển thị' : 'Đã ẩn'}</span></div>
          <div className="p-4"><p className="text-[10px] font-black uppercase tracking-wider text-[#EB0F51]">{service.categoryName}</p><h3 className="mt-1 line-clamp-2 font-black">{service.name}</h3><p className="mt-2 text-xs text-slate-500">{service.durationMinutes} phút · <strong className="text-slate-800">{formatMoney(service.price)}</strong></p><div className="mt-4 flex gap-2"><button onClick={() => setEditor(service)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-pink-200 py-2.5 text-xs font-black text-[#B42D58] hover:bg-pink-50"><Pencil className="h-3.5 w-3.5" /> Chỉnh sửa</button>{service.active && <button onClick={() => deactivate(service)} aria-label={`Ẩn ${service.name}`} className="grid w-10 place-items-center rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>}</div></div>
        </article>)}</div> : <div className="rounded-3xl border border-dashed border-pink-200 bg-white px-6 py-16 text-center"><ImagePlus className="mx-auto h-9 w-9 text-pink-300" /><h3 className="mt-4 font-black">Chưa có dịch vụ</h3><p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-slate-500">Tạo dịch vụ đầu tiên để khách hàng thấy gian hàng và có thể đặt lịch.</p><button onClick={openServiceCreator} disabled={loadingCategories} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#EB0F51] px-4 py-3 text-xs font-black text-white disabled:opacity-40">{loadingCategories ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {loadingCategories ? 'Đang tải danh mục...' : 'Tạo dịch vụ đầu tiên'}</button></div>}
      </div>
    </div>

    {editor && <ServiceEditor service={editor === 'new' ? null : editor} categories={categories} onClose={() => setEditor(null)} onSave={saveService} />}
  </section>;
};

function ServiceEditor({ service, categories, onClose, onSave }: { service: SupplierService | null; categories: ServiceCategory[]; onClose: () => void; onSave: (payload: SupplierServicePayload) => Promise<void> }) {
  const [form, setForm] = useState<SupplierServicePayload>(service ? {
    categoryId: service.categoryId,
    name: service.name,
    description: service.description || '',
    price: service.price,
    originalPrice: service.originalPrice || null,
    durationMinutes: service.durationMinutes,
    imageUrl: service.imageUrl || null,
    active: service.active,
  } : blankService(categories[0]?.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError('');
    try { await onSave(form); }
    catch (requestError) { setError(getApiErrorMessage(requestError)); }
    finally { setSaving(false); }
  };

  return <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
    <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-[#EB0F51]">Dịch vụ</p><h2 className="mt-1 text-xl font-black">{service ? 'Chỉnh sửa dịch vụ' : 'Tạo dịch vụ mới'}</h2><p className="mt-1 text-xs text-slate-500">Dịch vụ đang bật sẽ xuất hiện cho khách hàng sau khi lưu.</p></div><button onClick={onClose} aria-label="Đóng" className="rounded-full p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
      <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><ImagePicker label="Ảnh dịch vụ" value={form.imageUrl || null} onChange={(imageUrl) => setForm({ ...form, imageUrl })} /></div>
        <Field label="Danh mục *"><select required value={form.categoryId || ''} onChange={(event) => setForm({ ...form, categoryId: Number(event.target.value) })} className="field"><option value="" disabled>Chọn danh mục</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>
        <Field label="Tên dịch vụ *"><input required maxLength={160} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="field" /></Field>
        <Field label="Giá bán (VNĐ) *"><input required min={1000} step={1000} type="number" value={form.price || ''} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} className="field" /></Field>
        <Field label="Giá gốc (không bắt buộc)"><input min={1000} step={1000} type="number" value={form.originalPrice || ''} onChange={(event) => setForm({ ...form, originalPrice: event.target.value ? Number(event.target.value) : null })} className="field" /></Field>
        <Field label="Thời lượng *"><select value={form.durationMinutes} onChange={(event) => setForm({ ...form, durationMinutes: Number(event.target.value) })} className="field">{[30, 45, 60, 75, 90, 120, 150, 180].map((minutes) => <option key={minutes} value={minutes}>{minutes} phút</option>)}</select></Field>
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-xs font-black"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} className="h-4 w-4 accent-[#EB0F51]" /> Hiển thị với khách hàng</label>
        <div className="sm:col-span-2"><Field label="Mô tả"><textarea rows={4} maxLength={1500} value={form.description || ''} onChange={(event) => setForm({ ...form, description: event.target.value })} className="field resize-none" /></Field></div>
        {error && <p className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700 sm:col-span-2">{error}</p>}
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-5 sm:col-span-2"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-3 text-xs font-black text-slate-600">Hủy</button><button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#EB0F51] px-5 py-3 text-xs font-black text-white disabled:opacity-50">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Lưu dịch vụ</button></div>
      </form>
    </div>
  </div>;
}

function ImagePicker({ label, value, onChange }: { label: string; value: string | null; onChange: (value: string | null) => void }) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setProcessing(true); setError('');
    try { onChange(await prepareImageUpload(file)); }
    catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : 'Không thể xử lý ảnh.'); }
    finally { setProcessing(false); }
  };
  return <div><span className="mb-2 block text-xs font-black">{label}</span><div className="flex items-center gap-4 rounded-2xl border border-dashed border-pink-200 bg-pink-50/40 p-3"><div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-white shadow-sm">{value ? <img src={value} alt="Xem trước ảnh tải lên" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-pink-300"><ImagePlus className="h-6 w-6" /></div>}</div><div className="min-w-0"><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-[#B42D58] shadow-sm hover:bg-pink-100">{processing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}{processing ? 'Đang tối ưu...' : 'Tải ảnh lên'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} disabled={processing} className="sr-only" /></label>{value && <button type="button" onClick={() => onChange(null)} className="ml-2 text-[11px] font-bold text-slate-400 hover:text-rose-600">Xóa ảnh</button>}<p className="mt-2 text-[10px] leading-4 text-slate-400">JPG, PNG hoặc WEBP · tối đa 10 MB · tự động thu nhỏ.</p></div></div>{error && <p className="mt-2 text-xs font-bold text-rose-600">{error}</p>}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-black text-slate-700">{label}</span>{children}</label>;
}
