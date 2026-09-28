import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Eye, EyeOff, FileCheck2, ImagePlus, LoaderCircle, LocateFixed, LockKeyhole, MapPin, ShieldCheck, Sparkles, X } from 'lucide-react';
import { getApiErrorMessage } from '../lib/api';
import { prepareImageUpload } from '../lib/imageUpload';
import { getBrowserCoordinates, getLocationFailureMessage } from '../lib/geolocation';
import { platformApi } from '../services/platformApi';
import type { CurrentUser, LocationOption } from '../types';

interface SupplierRegisterPageProps {
  onBack: () => void;
  onSuccess: (user: CurrentUser) => void;
  onLogin: () => void;
}

const businessTypes = ['Makeup Studio', 'Spa & Dưỡng sinh', 'Thẩm mỹ viện & Clinic', 'Nail & Mi', 'Salon tóc'];

export const SupplierRegisterPage: React.FC<SupplierRegisterPageProps> = ({ onBack, onSuccess, onLogin }) => {
  const [cities, setCities] = useState<LocationOption[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationSource, setLocationSource] = useState<'device' | 'network' | null>(null);
  const [locationMessage, setLocationMessage] = useState('');
  const [form, setForm] = useState({
    ownerName: '', phone: '', email: '', password: '', confirmPassword: '',
    businessName: '', businessType: businessTypes[0], locationId: '', addressLine: '',
    description: '', specialty: '', cccdNumber: '', cccdFrontImage: '', cccdBackImage: '',
    imageUrl: '', latitude: null as number | null, longitude: null as number | null,
  });

  useEffect(() => {
    platformApi.locations().then(setCities).catch((requestError) => setError(getApiErrorMessage(requestError)));
  }, []);

  const canSubmit = useMemo(() => Boolean(
    form.ownerName.trim() && form.phone.trim() && form.email.trim() && form.password.length >= 8 &&
    form.password === form.confirmPassword && form.businessName.trim() && form.locationId &&
    form.addressLine.trim() && /^\d{12}$/.test(form.cccdNumber) && form.cccdFrontImage &&
    form.cccdBackImage && form.imageUrl && form.latitude != null && form.longitude != null && accepted
  ), [form, accepted]);

  const update = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [field]: value }));

  const detectLocation = async () => {
    setLocating(true); setError(''); setLocationMessage('');
    try {
      const coordinates = await getBrowserCoordinates();
      setForm((current) => ({ ...current, latitude: coordinates.latitude, longitude: coordinates.longitude }));
      setLocationSource(coordinates.source);
      setLocationMessage(coordinates.source === 'device'
        ? `Đã lấy GPS thiết bị${coordinates.accuracy != null ? `, sai số khoảng ${coordinates.accuracy} m` : ''}.`
        : `GPS phản hồi chậm nên đã dùng vị trí gần đúng theo mạng${coordinates.label ? ` (${coordinates.label})` : ''}. Hãy kiểm tra lại tọa độ cửa hàng trước khi đăng ký.`);
    } catch (locationError) {
      setError(getLocationFailureMessage(locationError));
    } finally {
      setLocating(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Mật khẩu xác nhận chưa khớp.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await platformApi.registerSupplier({
        ownerName: form.ownerName.trim(), phone: form.phone.trim(), email: form.email.trim(), password: form.password,
        businessName: form.businessName.trim(), businessType: form.businessType,
        locationId: Number(form.locationId), addressLine: form.addressLine.trim(),
        description: form.description.trim() || undefined, specialty: form.specialty.trim() || undefined,
        cccdNumber: form.cccdNumber, cccdFrontImage: form.cccdFrontImage, cccdBackImage: form.cccdBackImage,
        imageUrl: form.imageUrl, latitude: form.latitude!, longitude: form.longitude!,
      });
      onSuccess({
        id: result.auth.user.id, name: result.auth.user.fullName, phone: result.auth.user.phone,
        email: result.auth.user.email || undefined, role: result.auth.user.role,
        loyaltyPoints: result.auth.user.loyaltyPoints,
      });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF0F3] text-slate-900">
      <header className="border-b border-pink-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-[#EB0F51]"><ArrowLeft className="h-4 w-4" /> Trang chủ</button>
          <span className="text-xl font-black tracking-tight">Beauty<span className="text-[#EB0F51]">Link</span> <span className="text-sm text-slate-400">Partner</span></span>
          <button onClick={onLogin} className="text-sm font-extrabold text-[#B42D58] hover:text-[#EB0F51]">Đăng nhập đối tác</button>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:py-14">
        <section className="rounded-[2rem] bg-gradient-to-br from-[#B42D58] via-[#EB0F51] to-[#D28474] p-8 text-white shadow-xl shadow-pink-900/10 lg:sticky lg:top-8 lg:h-fit lg:p-10">
          <div className="mb-8 grid h-14 w-14 place-items-center rounded-2xl bg-white/15"><Building2 className="h-7 w-7" /></div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-pink-100">BeautyLink for Business</p>
          <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">Đưa dịch vụ của bạn đến đúng khách hàng.</h1>
          <p className="mt-4 text-sm leading-6 text-pink-50/90">Tạo gian hàng, quản lý đội ngũ và chủ động giờ nhận lịch trong một nơi. Đăng ký hoàn toàn miễn phí.</p>
          <div className="mt-8 space-y-4">
            {[
              ['Tài khoản vận hành ngay', 'Dashboard và lịch làm việc được tạo ngay sau đăng ký.'],
              ['Lịch thông minh', 'Thiết lập giờ làm, giờ nghỉ và độ dài khung giờ cho từng chuyên viên.'],
              ['Duyệt trước khi hiển thị', 'Hồ sơ ở trạng thái chờ duyệt và chưa xuất hiện công khai.'],
            ].map(([title, text]) => <div key={title} className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="text-sm font-black">{title}</p><p className="mt-0.5 text-xs leading-5 text-pink-50/80">{text}</p></div></div>)}
          </div>
          <div className="mt-9 flex items-center gap-2 rounded-2xl bg-white/10 p-4 text-xs font-semibold"><ShieldCheck className="h-5 w-5 shrink-0" />Thông tin của bạn được bảo vệ và chỉ dùng để vận hành gian hàng.</div>
        </section>

        <section className="rounded-[2rem] border border-pink-100 bg-white p-5 shadow-sm sm:p-8 lg:p-10">
          <div className="mb-7"><div className="flex items-center gap-2 text-[#EB0F51]"><Sparkles className="h-4 w-4" /><span className="text-xs font-black uppercase tracking-widest">Đăng ký nhà cung cấp</span></div><h2 className="mt-2 text-2xl font-black sm:text-3xl">Tạo hồ sơ đối tác</h2><p className="mt-2 text-sm text-slate-500">Mất khoảng 3 phút. Các trường có dấu * là bắt buộc.</p></div>
          <form onSubmit={submit} className="space-y-7">
            <FormSection number="01" title="Thông tin người đại diện">
              <Field label="Họ và tên *"><input required value={form.ownerName} onChange={(e) => update('ownerName', e.target.value)} placeholder="Nguyễn Minh Anh" className="field" /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Số điện thoại *"><input required type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="09xxxxxxxx" className="field" /></Field>
                <Field label="Email *"><input required type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="partner@example.com" className="field" /></Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Mật khẩu *"><div className="relative"><input required minLength={8} type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => update('password', e.target.value)} placeholder="Ít nhất 8 ký tự" className="field pr-11" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></Field>
                <Field label="Xác nhận mật khẩu *"><input required minLength={8} type={showPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={(e) => update('confirmPassword', e.target.value)} className="field" /></Field>
              </div>
            </FormSection>

            <FormSection number="02" title="Xác minh danh tính">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 shadow-sm"><LockKeyhole className="h-5 w-5" /></span><div><p className="text-sm font-black text-emerald-900">Cam kết bảo mật hồ sơ định danh</p><p className="mt-1 text-xs leading-5 text-emerald-800">Số và ảnh CCCD được mã hóa AES-256-GCM trước khi lưu, tách khỏi hồ sơ công khai và chỉ dùng cho quy trình xác minh đối tác. BeautyLink không hiển thị giấy tờ này cho khách hàng hay nhà cung cấp khác.</p></div></div>
              </div>
              <Field label="Số CCCD *"><div className="relative"><FileCheck2 className="absolute left-3 top-3.5 h-4 w-4 text-[#D28474]" /><input required inputMode="numeric" pattern="[0-9]{12}" maxLength={12} value={form.cccdNumber} onChange={(e) => update('cccdNumber', e.target.value.replace(/\D/g, ''))} placeholder="12 chữ số trên CCCD" className="field pl-10" /></div></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <IdentityImagePicker label="Mặt trước CCCD *" value={form.cccdFrontImage} onChange={(value) => update('cccdFrontImage', value)} />
                <IdentityImagePicker label="Mặt sau CCCD *" value={form.cccdBackImage} onChange={(value) => update('cccdBackImage', value)} />
              </div>
            </FormSection>

            <FormSection number="03" title="Thông tin cơ sở">
              <Field label="Tên cơ sở / thương hiệu *"><input required value={form.businessName} onChange={(e) => update('businessName', e.target.value)} placeholder="Ví dụ: Mây Beauty Studio" className="field" /></Field>
              <IdentityImagePicker label="Ảnh đại diện / ảnh bìa cơ sở *" value={form.imageUrl} onChange={(value) => update('imageUrl', value)} storeImage />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Mô hình kinh doanh *"><select value={form.businessType} onChange={(e) => update('businessType', e.target.value)} className="field bg-white">{businessTypes.map((type) => <option key={type}>{type}</option>)}</select></Field>
                <Field label="Thành phố *"><select required value={form.locationId} onChange={(e) => update('locationId', e.target.value)} className="field bg-white"><option value="">Chọn thành phố</option>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></Field>
              </div>
              <Field label="Địa chỉ cơ sở *"><div className="relative"><MapPin className="absolute left-3 top-3.5 h-4 w-4 text-[#D28474]" /><input required value={form.addressLine} onChange={(e) => update('addressLine', e.target.value)} placeholder="Số nhà, tên đường, phường/quận" className="field pl-10" /></div></Field>
              <div className="rounded-2xl border border-pink-100 bg-pink-50/50 p-4">
                <div className="flex items-start gap-3"><LocateFixed className="mt-0.5 h-5 w-5 shrink-0 text-[#EB0F51]" /><div><p className="text-xs font-black text-slate-800">Tọa độ cửa hàng *</p><p className="mt-1 text-[11px] leading-4 text-slate-500">Giúp khách tìm thấy cơ sở trong “Gần bạn”. Hãy thao tác tại địa chỉ kinh doanh để khoảng cách chính xác.</p></div></div>
                <button type="button" onClick={detectLocation} disabled={locating} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-black text-[#B42D58] shadow-sm ring-1 ring-pink-200 hover:bg-pink-100 disabled:opacity-50">{locating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : form.latitude != null ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <LocateFixed className="h-4 w-4" />}{locating ? 'Đang lấy vị trí...' : locationSource === 'device' ? 'Đã lấy GPS thiết bị' : locationSource === 'network' ? 'Đã lấy vị trí gần đúng' : form.latitude != null ? 'Đã nhập tọa độ' : 'Dùng vị trí hiện tại'}</button>
                {locationMessage && <p className={`mt-2 rounded-xl px-3 py-2 text-[10px] font-semibold leading-4 ${locationSource === 'network' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{locationMessage}</p>}
                <div className="mt-3 grid grid-cols-2 gap-3"><Field label="Vĩ độ"><input required type="number" step="any" min={-90} max={90} value={form.latitude ?? ''} onChange={(e) => { update('latitude', e.target.value === '' ? null : Number(e.target.value)); setLocationSource(null); setLocationMessage(''); }} placeholder="10.7769" className="field bg-white" /></Field><Field label="Kinh độ"><input required type="number" step="any" min={-180} max={180} value={form.longitude ?? ''} onChange={(e) => { update('longitude', e.target.value === '' ? null : Number(e.target.value)); setLocationSource(null); setLocationMessage(''); }} placeholder="106.7009" className="field bg-white" /></Field></div>
                <p className="mt-2 text-[10px] leading-4 text-slate-500">Nếu GPS vẫn bị chặn: mở Google Maps, nhấp chuột phải vào vị trí cửa hàng, sao chép cặp tọa độ rồi dán vào hai ô trên.</p>
              </div>
              <Field label="Chuyên môn chính"><input value={form.specialty} onChange={(e) => update('specialty', e.target.value)} placeholder="Ví dụ: Trang điểm cô dâu, chăm sóc da" className="field" /></Field>
              <Field label="Giới thiệu ngắn"><textarea rows={4} value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Điểm nổi bật, kinh nghiệm và phong cách phục vụ..." className="field resize-none" /></Field>
            </FormSection>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-pink-50 p-4 text-xs leading-5 text-slate-600"><input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#EB0F51]" /><span>Tôi xác nhận thông tin là chính xác và đồng ý với điều khoản dành cho đối tác BeautyLink.</span></label>
            {error && <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</p>}
            <button disabled={!canSubmit || submitting} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#EB0F51] px-6 py-4 text-sm font-black text-white shadow-lg shadow-pink-600/20 transition hover:bg-[#B42D58] disabled:cursor-not-allowed disabled:opacity-45">{submitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <>Tạo tài khoản đối tác <ArrowRight className="h-4 w-4" /></>}</button>
          </form>
        </section>
      </main>
    </div>
  );
};

function FormSection({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return <fieldset className="space-y-4"><legend className="mb-4 flex items-center gap-3 text-sm font-black"><span className="grid h-8 w-8 place-items-center rounded-xl bg-pink-50 text-xs text-[#EB0F51]">{number}</span>{title}</legend>{children}</fieldset>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-extrabold text-slate-700">{label}</span>{children}</label>;
}

function IdentityImagePicker({ label, value, onChange, storeImage = false }: { label: string; value: string; onChange: (value: string) => void; storeImage?: boolean }) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setProcessing(true); setError('');
    try {
      onChange(await prepareImageUpload(file, storeImage ? {} : { maxEdge: 1200, quality: 0.76, maxStoredCharacters: 1_150_000 }));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Không thể xử lý ảnh.');
    } finally { setProcessing(false); }
  };
  return <div><span className="mb-1.5 block text-xs font-extrabold text-slate-700">{label}</span><div className="relative overflow-hidden rounded-2xl border border-dashed border-pink-200 bg-pink-50/40"><div className={`${storeImage ? 'aspect-[16/7]' : 'aspect-[1.58/1]'} grid place-items-center overflow-hidden`}>{value ? <img src={value} alt={`Xem trước ${label}`} className="h-full w-full object-cover" /> : <div className="text-center text-pink-300"><ImagePlus className="mx-auto h-7 w-7" /><p className="mt-2 text-[10px] font-bold text-slate-400">JPG, PNG, WEBP · tối đa 10 MB</p></div>}</div><label className="absolute inset-x-3 bottom-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-white/95 px-3 py-2 text-xs font-black text-[#B42D58] shadow-md backdrop-blur hover:bg-pink-100">{processing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}{processing ? 'Đang bảo vệ ảnh...' : value ? 'Thay ảnh' : 'Chọn ảnh'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} disabled={processing} className="sr-only" /></label>{value && <button type="button" onClick={() => onChange('')} aria-label={`Xóa ${label}`} className="absolute right-2 top-2 rounded-full bg-slate-900/75 p-1.5 text-white"><X className="h-3.5 w-3.5" /></button>}</div>{error && <p className="mt-2 text-xs font-bold text-rose-600">{error}</p>}</div>;
}
