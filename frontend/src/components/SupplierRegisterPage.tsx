import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  MapPin,
  Navigation,
  CheckCircle,
  Loader2,
  ArrowRight,
  UploadCloud,
  Trash2,
  Store,
  Award,
  Users,
  TrendingUp,
  FileCheck,
  Phone,
  Mail,
  User,
  Check,
  HelpCircle,
} from 'lucide-react';
import { BackendLocation, CurrentUser } from '../types';
import { beautyApi, getApiErrorMessage } from '../services/beautyApi';
import { prepareImageUpload } from '../lib/imageUpload';

interface SupplierRegisterPageProps {
  onBack: () => void;
  onSuccess: (user: CurrentUser) => void;
  onLogin: () => void;
}

const BUSINESS_TYPES = [
  'Spa & Massage trị liệu',
  'Thẩm mỹ viện & Clinic da liễu',
  'Salon tóc chuyên nghiệp',
  'Tiệm Nail & Nối mi nghệ thuật',
  'Makeup Studio & Cô dâu',
  'Gội đầu dưỡng sinh Đông y',
];

interface ImageUploadFieldProps {
  label: string;
  subLabel?: string;
  value: string;
  onChange: (val: string) => void;
  placeholderText?: string;
}

const ImageUploadField: React.FC<ImageUploadFieldProps> = ({
  label,
  subLabel,
  value,
  onChange,
  placeholderText = 'Chọn ảnh JPG, PNG hoặc WEBP',
}) => {
  const [loading, setLoading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const optimized = await prepareImageUpload(file, { maxStoredCharacters: 1_100_000, maxEdge: 1600, quality: 0.86 });
      onChange(optimized);
    } catch (err) {
      onChange('');
      window.alert(err instanceof Error ? err.message : 'Không thể xử lý ảnh này.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="block">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-slate-800">{label}</span>
        {subLabel && <span className="text-[10px] text-slate-400">{subLabel}</span>}
      </div>

      {value ? (
        <div className="relative overflow-hidden rounded-2xl border border-pink-200 group">
          <img src={value} alt="Preview" className="h-36 w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-950/50 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => onChange('')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-rose-600 shadow hover:bg-rose-50 transition cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" /> Xóa ảnh & chọn lại
            </button>
          </div>
        </div>
      ) : (
        <label className="flex h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-pink-200 bg-pink-50/30 p-4 text-center transition hover:border-[#e1146c] hover:bg-pink-50/70">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin text-[#e1146c]" />
          ) : (
            <>
              <UploadCloud className="h-6 w-6 text-[#e1146c]" />
              <span className="mt-1.5 text-xs font-bold text-slate-700">{placeholderText}</span>
              <span className="mt-0.5 text-[10px] text-slate-400">Ảnh được tối ưu và kiểm tra trước khi gửi</span>
            </>
          )}
        </label>
      )}
    </div>
  );
};

export const SupplierRegisterPage: React.FC<SupplierRegisterPageProps> = ({
  onBack,
  onSuccess,
  onLogin,
}) => {
  const [locations, setLocations] = useState<BackendLocation[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(1);
  const [verificationChallengeId, setVerificationChallengeId] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [emailCode, setEmailCode] = useState('');

  const [formData, setFormData] = useState({
    ownerName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    cccdNumber: '',
    cccdFrontImage: '',
    cccdBackImage: '',
    certificateImage: '',
    businessName: '',
    imageUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80',
    businessType: BUSINESS_TYPES[0],
    locationId: '',
    addressLine: '',
    latitude: null as number | null,
    longitude: null as number | null,
    specialty: '',
    description: '',
  });

  useEffect(() => {
    beautyApi
      .locations()
      .then((data) => {
        setLocations(data);
        if (data.length > 0) {
          setFormData((prev) => ({ ...prev, locationId: String(data[0].id) }));
        }
      })
      .catch(() => {});
  }, []);

  const updateField = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (key === 'phone' || key === 'email') {
      setVerificationChallengeId('');
      setPhoneCode('');
      setEmailCode('');
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Trình duyệt này không hỗ trợ định vị GPS.');
      return;
    }
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData((prev) => ({
          ...prev,
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
        }));
        setLocating(false);
      },
      () => {
        setError('Không thể lấy GPS tự động. Vui lòng kiểm tra quyền truy cập vị trí trên trình duyệt.');
        setLocating(false);
      },
      { timeout: 10000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu xác nhận chưa khớp. Vui lòng kiểm tra lại.');
      return;
    }

    if (!/^\d{12}$/.test(formData.cccdNumber.trim())) {
      setError('Số CCCD phải gồm đúng 12 chữ số.');
      return;
    }

    if (!formData.cccdFrontImage.startsWith('data:image/') || !formData.cccdBackImage.startsWith('data:image/')) {
      setError('Vui lòng tải lên đầy đủ ảnh CCCD mặt trước và mặt sau.');
      return;
    }

    if (!termsAccepted) {
      setError('Vui lòng đồng ý với Điều khoản hợp tác dành cho đối tác BeautyLink.');
      return;
    }

    setSubmitting(true);
    try {
      const cleanPhone = formData.phone.replace(/[\s.-]/g, '');
      const payload = {
        ownerName: formData.ownerName.trim(),
        phone: cleanPhone,
        email: formData.email.trim(),
        password: formData.password,
        cccdNumber: formData.cccdNumber.trim(),
        cccdFrontImage: formData.cccdFrontImage,
        cccdBackImage: formData.cccdBackImage,
        businessName: formData.businessName.trim(),
        imageUrl: formData.imageUrl,
        businessType: formData.businessType,
        locationId: Number(formData.locationId) || 1,
        addressLine: formData.addressLine.trim(),
        latitude: formData.latitude ?? 10.7769,
        longitude: formData.longitude ?? 106.7009,
        specialty: formData.specialty.trim() || undefined,
        description: formData.description.trim() || undefined,
      };

      if (!verificationChallengeId) {
        const challenge = await beautyApi.startRegistrationVerification({ phone: cleanPhone, email: formData.email.trim() });
        setVerificationChallengeId(challenge.challengeId);
        setError('Mã OTP đã được gửi đến số điện thoại và email. Vui lòng nhập đủ hai mã để tiếp tục.');
        return;
      }
      const verification = await beautyApi.confirmRegistrationVerification({
        challengeId: verificationChallengeId,
        phoneCode,
        emailCode,
      });
      const res = await beautyApi.registerSupplier({ ...payload, verificationToken: verification.registrationToken });
      const mappedUser: CurrentUser = {
        id: res.user?.id || res.supplier?.userId,
        name: res.supplier?.name || formData.businessName,
        phone: cleanPhone,
        email: formData.email,
        role: 'SUPPLIER',
        memberTier: 'VIP Partner',
      };
      onSuccess(mappedUser);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không thể đăng ký đối tác. Vui lòng kiểm tra lại thông tin.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFF5F7] via-white to-[#FDF2F8] py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Top Header Bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-extrabold text-slate-600 hover:text-[#be185d] transition cursor-pointer px-3 py-1.5 rounded-xl hover:bg-white"
          >
            <ArrowLeft className="h-4 w-4" /> Quay lại trang chủ
          </button>
          <button
            onClick={onLogin}
            className="inline-flex items-center gap-1.5 text-xs font-black text-[#be185d] hover:text-[#9d174d] hover:underline cursor-pointer px-3 py-1.5 rounded-xl bg-pink-50 hover:bg-pink-100"
          >
            <span>Đã có tài khoản đối tác? Đăng nhập ngay</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Hero Banner Showcase */}
        <div className="relative mb-8 overflow-hidden rounded-3xl bg-slate-950 p-6 sm:p-10 text-white shadow-xl">
          <img
            src="https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1600&q=80"
            alt="Đối tác làm đẹp BeautyLink"
            className="absolute inset-0 h-full w-full object-cover opacity-30 mix-blend-luminosity scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-[#630f36]/90 to-[#e1146c]/60" />

          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur text-pink-200 text-xs font-bold border border-white/20">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span>BeautyLink for Business · Cổng Đăng Ký Đối Tác</span>
            </div>

            <h1 className="mt-3 text-2xl sm:text-4xl font-black tracking-tight leading-tight">
              Đưa dịch vụ làm đẹp của bạn đến với{' '}
              <span className="bg-gradient-to-r from-amber-200 via-pink-200 to-white bg-clip-text text-transparent">
                hàng chục ngàn khách hàng
              </span>
            </h1>

            <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-pink-100/90 font-medium max-w-2xl">
              Tạo gian hàng thẩm mỹ chuẩn Y khoa, chủ động nhận lịch hẹn 24/7 và gia tăng 45% doanh số mà không tốn chi phí khởi tạo.
            </p>

            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
              <div className="p-3 rounded-2xl bg-white/10 backdrop-blur border border-white/15">
                <div className="text-xl sm:text-2xl font-black text-amber-300">50K+</div>
                <p className="text-[11px] text-pink-200 font-bold mt-0.5">Khách tìm dịch vụ/tháng</p>
              </div>
              <div className="p-3 rounded-2xl bg-white/10 backdrop-blur border border-white/15">
                <div className="text-xl sm:text-2xl font-black text-emerald-300">0đ</div>
                <p className="text-[11px] text-pink-200 font-bold mt-0.5">Phí duy trì & mở tiệm</p>
              </div>
              <div className="p-3 rounded-2xl bg-white/10 backdrop-blur border border-white/15">
                <div className="text-xl sm:text-2xl font-black text-rose-300">+45%</div>
                <p className="text-[11px] text-pink-200 font-bold mt-0.5">Tăng trưởng doanh thu</p>
              </div>
              <div className="p-3 rounded-2xl bg-white/10 backdrop-blur border border-white/15">
                <div className="text-xl sm:text-2xl font-black text-blue-300">24/7</div>
                <p className="text-[11px] text-pink-200 font-bold mt-0.5">Quản lý lịch tự động</p>
              </div>
            </div>
          </div>
        </div>

        {/* Form Container with Stepper */}
        <section className="rounded-3xl border border-pink-100 bg-white p-6 sm:p-10 shadow-lg shadow-pink-900/5">
          {/* Header Title */}
          <div className="mb-8 border-b border-pink-100 pb-5">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Store className="w-6 h-6 text-[#be185d]" />
              <span>Hồ sơ đăng ký Gian hàng Đối tác</span>
            </h2>
            <p className="mt-1 text-xs text-slate-500 font-medium">
              Vui lòng điền đầy đủ và chính xác các thông tin dưới đây để ban chuyên môn BeautyLink thẩm định và kích hoạt gian hàng của bạn trong vòng 24 giờ.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Step 1: Representative & Account Info */}
            <div className="space-y-4 rounded-3xl border border-pink-100 bg-[#FFF8F9] p-5 sm:p-7">
              <div className="flex items-center gap-3 border-b border-pink-100 pb-3">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-tr from-[#be185d] to-[#e1146c] text-xs font-black text-white shadow-xs">
                  01
                </span>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    Thông tin Người đại diện & Tài khoản Quản trị
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Dùng để đăng nhập vào trang Quản lý gian hàng (Supplier Dashboard)
                  </span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Họ và tên người đại diện *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      required
                      value={formData.ownerName}
                      onChange={(e) => updateField('ownerName', e.target.value)}
                      placeholder="Ví dụ: Bác sĩ Nguyễn Thùy Trang"
                      className="w-full rounded-xl border border-pink-200 bg-white py-2.5 pl-10 pr-4 text-xs sm:text-sm font-semibold text-slate-900 outline-none transition focus:border-[#e1146c] focus:ring-2 focus:ring-pink-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Số điện thoại đăng nhập & nhận mã OTP *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      required
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                      placeholder="09xxxxxxxx (10 chữ số)"
                      className="w-full rounded-xl border border-pink-200 bg-white py-2.5 pl-10 pr-4 text-xs sm:text-sm font-semibold text-slate-900 outline-none transition focus:border-[#e1146c] focus:ring-2 focus:ring-pink-100"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email liên hệ công việc *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      required
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      placeholder="contact@ten-spa.vn"
                      className="w-full rounded-xl border border-pink-200 bg-white py-2.5 pl-10 pr-4 text-xs sm:text-sm font-semibold text-slate-900 outline-none transition focus:border-[#e1146c] focus:ring-2 focus:ring-pink-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mật khẩu quản trị (ít nhất 6 ký tự) *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      required
                      minLength={6}
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => updateField('password', e.target.value)}
                      placeholder="Mật khẩu bảo mật"
                      className="w-full rounded-xl border border-pink-200 bg-white py-2.5 pl-10 pr-10 text-xs sm:text-sm font-semibold text-slate-900 outline-none transition focus:border-[#e1146c] focus:ring-2 focus:ring-pink-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Xác nhận lại mật khẩu *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    required
                    minLength={6}
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => updateField('confirmPassword', e.target.value)}
                    placeholder="Nhập lại mật khẩu giống bên trên"
                    className="w-full rounded-xl border border-pink-200 bg-white py-2.5 pl-10 pr-4 text-xs sm:text-sm font-semibold text-slate-900 outline-none transition focus:border-[#e1146c] focus:ring-2 focus:ring-pink-100"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Business Brand & Category */}
            <div className="space-y-4 rounded-3xl border border-pink-100 bg-[#FFF8F9] p-5 sm:p-7">
              <div className="flex items-center gap-3 border-b border-pink-100 pb-3">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-tr from-[#be185d] to-[#e1146c] text-xs font-black text-white shadow-xs">
                  02
                </span>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    Thông tin Cơ sở, Salon, Clinic hoặc Spa
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Tên thương hiệu và lĩnh vực chuyên môn hiển thị trên ứng dụng
                  </span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tên cơ sở / Tiệm làm đẹp *
                  </label>
                  <input
                    required
                    value={formData.businessName}
                    onChange={(e) => updateField('businessName', e.target.value)}
                    placeholder="Ví dụ: Viện Thẩm Mỹ Chuẩn Y Khoa Hana Beauty"
                    className="w-full rounded-xl border border-pink-200 bg-white py-2.5 px-4 text-xs sm:text-sm font-semibold text-slate-900 outline-none transition focus:border-[#e1146c] focus:ring-2 focus:ring-pink-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Loại hình dịch vụ chính *
                  </label>
                  <select
                    value={formData.businessType}
                    onChange={(e) => updateField('businessType', e.target.value)}
                    className="w-full rounded-xl border border-pink-200 bg-white py-2.5 px-4 text-xs sm:text-sm font-semibold text-slate-900 outline-none transition focus:border-[#e1146c] focus:ring-2 focus:ring-pink-100"
                  >
                    {BUSINESS_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Dịch vụ mũi nhọn / Điểm nổi bật nhất
                  </label>
                  <input
                    value={formData.specialty}
                    onChange={(e) => updateField('specialty', e.target.value)}
                    placeholder="Ví dụ: Trị mụn chuẩn Y khoa & Phục hồi da nhạy cảm"
                    className="w-full rounded-xl border border-pink-200 bg-white py-2.5 px-4 text-xs sm:text-sm font-semibold text-slate-900 outline-none transition focus:border-[#e1146c] focus:ring-2 focus:ring-pink-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tỉnh / Thành phố hoạt động *
                  </label>
                  <select
                    value={formData.locationId}
                    onChange={(e) => updateField('locationId', e.target.value)}
                    className="w-full rounded-xl border border-pink-200 bg-white py-2.5 px-4 text-xs sm:text-sm font-semibold text-slate-900 outline-none transition focus:border-[#e1146c] focus:ring-2 focus:ring-pink-100"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={String(loc.id)}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mô tả giới thiệu ngắn về cơ sở (triết lý, công nghệ, tiện ích)
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="Giới thiệu không gian, đội ngũ kỹ thuật viên, trang thiết bị máy móc công nghệ cao..."
                  className="w-full rounded-xl border border-pink-200 bg-white py-2 px-3 text-xs sm:text-sm font-medium text-slate-900 outline-none transition focus:border-[#e1146c] focus:ring-2 focus:ring-pink-100"
                />
              </div>

              {/* Cover Photo / Storefront */}
              <div>
                <ImageUploadField
                  label="Ảnh mặt tiền hoặc Không gian sảnh chính của cơ sở"
                  subLabel="Ảnh đẹp giúp tăng 60% tỷ lệ khách đặt lịch"
                  value={formData.imageUrl}
                  onChange={(val) =>
                    updateField(
                      'imageUrl',
                      val || 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80'
                    )
                  }
                  placeholderText="Tải lên ảnh không gian tiệm / banner cơ sở"
                />
              </div>
            </div>

            {/* Step 3: Address & Exact GPS Coordinates */}
            <div className="space-y-4 rounded-3xl border border-pink-100 bg-[#FFF8F9] p-5 sm:p-7">
              <div className="flex items-center gap-3 border-b border-pink-100 pb-3">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-tr from-[#be185d] to-[#e1146c] text-xs font-black text-white shadow-xs">
                  03
                </span>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    Địa chỉ và Định vị GPS chính xác
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Giúp hệ thống hiển thị khoảng cách "Gần bạn" chính xác tới khách hàng
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Địa chỉ số nhà, tên đường, phường/xã, quận/huyện *
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    required
                    value={formData.addressLine}
                    onChange={(e) => updateField('addressLine', e.target.value)}
                    placeholder="Ví dụ: 128 Nguyễn Trãi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh"
                    className="w-full rounded-xl border border-pink-200 bg-white py-2.5 pl-10 pr-4 text-xs sm:text-sm font-semibold text-slate-900 outline-none transition focus:border-[#e1146c] focus:ring-2 focus:ring-pink-100"
                  />
                </div>
              </div>

              {/* GPS button */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-white border border-pink-200/80">
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-[#e1146c]" />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Tọa độ bản đồ: {formData.latitude ? `${formData.latitude}, ${formData.longitude}` : 'Chưa định vị'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Tự động tính khoảng cách km khi khách hàng tìm kiếm
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGetCurrentLocation}
                  disabled={locating}
                  className="px-3.5 py-2 rounded-xl bg-pink-50 hover:bg-pink-100 border border-pink-200 text-xs font-bold text-[#be185d] transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                  <span>{locating ? 'Đang lấy GPS...' : 'Lấy vị trí hiện tại'}</span>
                </button>
              </div>
            </div>

            {/* Step 4: Certificates & Verification */}
            <div className="space-y-4 rounded-3xl border border-pink-100 bg-[#FFF8F9] p-5 sm:p-7">
              <div className="flex items-center gap-3 border-b border-pink-100 pb-3">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-tr from-[#be185d] to-[#e1146c] text-xs font-black text-white shadow-xs">
                  04
                </span>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    Hồ sơ Thẩm định Y tế & Chứng chỉ Nghề nghiệp
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Giúp cơ sở của bạn đạt huy hiệu "Đã xác minh chuẩn Y khoa" uy tín
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số CCCD / Mã số định danh người đại diện *
                </label>
                <input
                  required
                  value={formData.cccdNumber}
                  onChange={(e) => updateField('cccdNumber', e.target.value)}
                  placeholder="Ví dụ: 079198000123 (12 số)"
                  className="w-full rounded-xl border border-pink-200 bg-white py-2.5 px-4 text-xs sm:text-sm font-semibold text-slate-900 outline-none transition focus:border-[#e1146c] focus:ring-2 focus:ring-pink-100"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <ImageUploadField
                  label="Ảnh CCCD mặt trước"
                  value={formData.cccdFrontImage}
                  onChange={(val) => updateField('cccdFrontImage', val)}
                  placeholderText="Tải lên ảnh CCCD mặt trước"
                />
                <ImageUploadField
                  label="Ảnh CCCD mặt sau"
                  value={formData.cccdBackImage}
                  onChange={(val) => updateField('cccdBackImage', val)}
                  placeholderText="Tải lên ảnh CCCD mặt sau"
                />
              </div>

              <div>
                <ImageUploadField
                  label="Chứng chỉ hành nghề / Giấy phép kinh doanh cơ sở (tùy chọn)"
                  subLabel="Nhận tích xanh thẩm định y tế ngay khi duyệt"
                  value={formData.certificateImage}
                  onChange={(val) => updateField('certificateImage', val)}
                  placeholderText="Tải lên Bằng Master, Chứng chỉ thẩm mỹ, hoặc Giấy phép hoạt động"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 animate-in fade-in">
                {error}
              </div>
            )}

            {verificationChallengeId && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                <div>
                  <label className="mb-1 block text-xs font-black text-slate-700">OTP số điện thoại</label>
                  <input inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6}
                    value={phoneCode} onChange={(event) => setPhoneCode(event.target.value.replace(/\D/g, ''))}
                    placeholder="000000" className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-3 text-sm font-black tracking-[0.35em] outline-hidden focus:ring-2 focus:ring-emerald-200" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-black text-slate-700">OTP email</label>
                  <input inputMode="numeric" required pattern="[0-9]{6}" maxLength={6}
                    value={emailCode} onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, ''))}
                    placeholder="000000" className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-3 text-sm font-black tracking-[0.35em] outline-hidden focus:ring-2 focus:ring-emerald-200" />
                </div>
              </div>
            )}

            {/* Terms and Agreements */}
            <div className="p-4 rounded-2xl bg-pink-50/70 border border-pink-100 flex items-start gap-3">
              <input
                type="checkbox"
                id="terms"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded text-[#e1146c] focus:ring-pink-200"
              />
              <label htmlFor="terms" className="text-xs text-slate-700 leading-relaxed cursor-pointer select-none">
                Tôi cam kết thông tin cơ sở cung cấp là hoàn toàn chính xác. Tôi đồng ý với{' '}
                <span className="font-bold text-[#be185d]">Quy chế hoạt động</span> và{' '}
                <span className="font-bold text-[#be185d]">Chính sách dành cho Nhà Cung Cấp Dịch Vụ</span> trên nền tảng BeautyLink.
              </label>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-500 via-[#db2777] to-[#be185d] text-white text-sm sm:text-base font-black shadow-lg shadow-pink-500/25 hover:opacity-95 hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Đang khởi tạo gian hàng đối tác...</span>
                  </>
                ) : (
                  <>
                    <Store className="h-5 w-5" />
                    <span>{verificationChallengeId ? 'Xác minh OTP & Đăng ký Gian Hàng' : 'Gửi mã OTP xác minh liên hệ'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Bottom Testimonial & Support */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-3xl bg-white border border-pink-100 shadow-xs flex items-start gap-3.5">
            <img
              src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80"
              alt="Chủ Spa Đối tác"
              className="w-12 h-12 rounded-2xl object-cover border border-pink-200 shrink-0"
            />
            <div>
              <div className="flex items-center gap-1 text-amber-400 mb-1">
                {[...Array(5)].map((_, i) => (
                  <span key={i}>★</span>
                ))}
              </div>
              <p className="text-xs text-slate-600 italic leading-relaxed">
                "Từ ngày đăng ký mở gian hàng trên BeautyLink, lượng khách mới của spa tăng hơn 50%. Khách đặt lịch qua app rất văn minh, hầu như không có tình trạng bỏ hẹn."
              </p>
              <span className="text-[11px] font-bold text-slate-800 block mt-1.5">
                — Master Thu Hằng (Chủ sáng lập Hằng Spa & Beauty)
              </span>
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-white border border-pink-100 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-[#be185d] mb-1">
                <HelpCircle className="w-4 h-4" />
                <span>Cần tư vấn hỗ trợ đăng ký gian hàng?</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Đội ngũ chuyên viên phát triển đối tác BeautyLink sẵn sàng hỗ trợ bạn hoàn thiện hồ sơ và chụp ảnh không gian tiệm miễn phí.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-pink-50 flex items-center justify-between text-xs font-bold">
              <span className="text-slate-700">Hotline Đối tác 24/7:</span>
              <span className="text-[#be185d]">1900 8899 (Nhánh 2)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
