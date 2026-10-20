import React, { useState, useEffect } from 'react';
import {
  User,
  Phone,
  Mail,
  ShieldCheck,
  Gift,
  Calendar,
  Star,
  ArrowLeft,
  CheckCircle2,
  Clock,
  MapPin,
  Award,
  Check,
  Share2,
  Copy,
  Tag,
  CreditCard,
  Lock,
  Ticket,
  CalendarCheck,
  FileText,
  BadgeCheck,
  ChevronRight,
  ExternalLink,
  Edit3,
  Save,
  QrCode,
  Camera,
} from 'lucide-react';
import { CurrentUser } from '../types';
import { useBeautyStore } from '../store/beautyStore';
import { AppointmentShareModal } from './AppointmentShareModal';
import { AvatarPickerModal } from './AvatarPickerModal';
import { BookingsPage } from './BookingsPage';
import { customerProfileSchema, FieldErrors, passwordChangeSchema, zodFieldErrors } from '../lib/validation';
import { FieldError } from './FieldError';
import { beautyApi, getApiErrorMessage } from '../services/beautyApi';
import { mapBackendUser } from '../lib/authUser';

interface AccountPageProps {
  currentUser: CurrentUser | null;
  onBackToHome: () => void;
  onLogoutConfirm?: () => void;
  onNavigateLogin: () => void;
  onOpenAppointments?: () => void;
  onOpenVouchers?: () => void;
}

interface UserProfileData {
  name: string;
  phone: string;
  email: string;
  address: string;
  citizenId: string;
  gender: string;
  dateOfBirth: string;
  avatar?: string;
}

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('vi-VN').format(val) + 'đ';
};

const displayBirthDate = (value?: string) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
};

export const AccountPage: React.FC<AccountPageProps> = ({
  currentUser,
  onBackToHome,
  onOpenVouchers,
}) => {
  const { setCurrentUser } = useBeautyStore();

  // Active tab: 'profile' | 'bookings' | 'vouchers' | 'security'
  // (ví voucher là một thành phần bấm TRƯỚC bảo mật và mật khẩu, bỏ tab đăng xuất tài khoản)
  const [activeTab, setActiveTab] = useState<'profile' | 'bookings' | 'vouchers' | 'security'>('profile');

  // Sharing modal state (Chia sẻ booking khi hôm đó bận)
  const [sharingBooking, setSharingBooking] = useState<any | null>(null);

  // Avatar picker modal state
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  // Copied code feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const handleCopyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Personal Info State with persistence
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileErrors, setProfileErrors] = useState<FieldErrors>({});
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordErrors, setPasswordErrors] = useState<FieldErrors>({});

  const [profile, setProfile] = useState<UserProfileData>(() => {
    return {
      name: currentUser?.name || '',
      phone: currentUser?.phone || '',
      email: currentUser?.email || '',
      address: currentUser?.address || '',
      citizenId: currentUser?.citizenId || '',
      gender: currentUser?.gender || '',
      dateOfBirth: displayBirthDate(currentUser?.dateOfBirth),
      avatar:
        currentUser?.avatar ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    };
  });

  const [profileForm, setProfileForm] = useState<UserProfileData>(profile);

  const handlePasswordValidation = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = passwordChangeSchema.safeParse(passwordForm);
    if (!validation.success) {
      setPasswordErrors(zodFieldErrors(validation.error));
      setProfileSuccessMsg('');
      return;
    }
    setPasswordErrors({});
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setProfileSuccessMsg('Dữ liệu mật khẩu hợp lệ. Chức năng đổi mật khẩu trên máy chủ đang được hoàn thiện.');
    setTimeout(() => setProfileSuccessMsg(''), 4000);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = customerProfileSchema.safeParse(profileForm);
    if (!validation.success) {
      setProfileErrors(zodFieldErrors(validation.error));
      setProfileSuccessMsg('');
      return;
    }
    setProfileErrors({});
    const normalizedProfile = validation.data as UserProfileData;
    const [day, month, year] = normalizedProfile.dateOfBirth ? normalizedProfile.dateOfBirth.split('/') : [];
    const gender = normalizedProfile.gender === 'Nam' ? 'MALE' : normalizedProfile.gender === 'Nữ' ? 'FEMALE' : normalizedProfile.gender === 'Others' ? 'OTHER' : undefined;
    setProfileSaving(true);
    try {
      const response = await beautyApi.updateCustomerProfile({
        fullName: normalizedProfile.name,
        phone: normalizedProfile.phone,
        gender,
        dateOfBirth: year ? `${year}-${month}-${day}` : undefined,
        confirmBookingContact: false,
      });
      const savedUser = currentUser
        ? { ...currentUser, ...mapBackendUser(response.user), avatar: normalizedProfile.avatar }
        : mapBackendUser(response.user);
      setCurrentUser(savedUser);
      const savedProfile = { ...normalizedProfile, email: savedUser.email || normalizedProfile.email };
      setProfile(savedProfile);
      setProfileForm(savedProfile);
      setIsEditingProfile(false);
      setProfileSuccessMsg('Thông tin hồ sơ đã được lưu vào tài khoản BeautyLink.');
      setTimeout(() => setProfileSuccessMsg(''), 3000);
    } catch (saveError) {
      setProfileSuccessMsg(getApiErrorMessage(saveError, 'Không thể lưu hồ sơ. Vui lòng thử lại.'));
    } finally {
      setProfileSaving(false);
    }
  };

  const handleUpdateAvatar = (newAvatarUrl: string) => {
    const updated = { ...profile, avatar: newAvatarUrl };
    setProfile(updated);
    setProfileForm({ ...profileForm, avatar: newAvatarUrl });
    if (currentUser) {
      setCurrentUser({
        ...currentUser,
        avatar: newAvatarUrl,
      });
    }
    setProfileSuccessMsg('Cập nhật ảnh đại diện thành công!');
    setTimeout(() => setProfileSuccessMsg(''), 3000);
  };

  // Vouchers list for the Voucher Wallet tab
  const VOUCHERS = [
    {
      code: 'BEAUTY50',
      title: 'Giảm 50.000đ cho đơn đầu tiên',
      desc: 'Áp dụng cho mọi dịch vụ spa & thẩm mỹ từ 200.000đ',
      expiry: '31/12/2026',
      badge: 'Hot nhất',
    },
    {
      code: 'BEAUTY100',
      title: 'Giảm 100.000đ liệu trình cao cấp',
      desc: 'Áp dụng cho đơn dịch vụ từ 500.000đ',
      expiry: '15/12/2026',
      badge: 'Tiết kiệm',
    },
    {
      code: 'PINK15',
      title: 'Giảm 15% tối đa 150.000đ',
      desc: 'Dành riêng cho khách hàng đặt lịch trực tuyến BeautyPass',
      expiry: '30/11/2026',
      badge: 'Độc quyền',
    },
    {
      code: 'VIPGOLD200',
      title: 'Giảm 200.000đ Hội viên Vàng VIP',
      desc: 'Đặc quyền thành viên VIP tích lũy từ 200 điểm trở lên',
      expiry: '31/12/2026',
      badge: 'VIP Member',
    },
  ];

  return (
    <div className="min-h-screen bg-[#FFF8F9] text-slate-900 pb-16 flex flex-col justify-between">
      {/* 1. Header Bar */}
      <header className="w-full bg-white/95 backdrop-blur-md border-b border-pink-100 py-3.5 px-4 sm:px-8 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToHome}
            className="flex items-center gap-2.5 group cursor-pointer text-left"
          >
            <div className="flex flex-col">
              <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 group-hover:text-[#e1146c] transition-colors leading-none">
                Beauty<span className="text-[#e1146c]">Link</span>
              </span>
              <span className="text-[11px] text-pink-600 font-semibold tracking-wide mt-0.5">
                Hồ sơ cá nhân & Quản lý lịch hẹn
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={onBackToHome}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-slate-700 hover:text-[#be185d] bg-pink-50/80 hover:bg-pink-100 border border-pink-200 transition-all cursor-pointer shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quay lại trang chủ</span>
          </button>
        </div>
      </header>

      {/* 2. Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 md:p-8">
        {/* Profile Hero Header Card */}
        <div className="bg-gradient-to-r from-[#831843] via-[#be185d] to-[#e1146c] rounded-3xl p-6 sm:p-7 text-white shadow-xl mb-6 relative overflow-hidden">
          <div className="absolute -right-16 -top-16 w-60 h-60 rounded-full bg-white/10 blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-5">
            <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              {/* Avatar with Verified checkmark and change button */}
              <div className="relative group/avatar">
                {profile.avatar ? (
                  <img
                    src={profile.avatar}
                    alt={profile.name}
                    className="w-20 h-20 rounded-3xl object-cover border-4 border-white/40 shadow-xl"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-3xl bg-white text-[#be185d] flex items-center justify-center font-black text-3xl shadow-xl border-4 border-white/30">
                    {profile.name.charAt(0).toUpperCase()}
                  </div>
                )}
                {/* Verified checkmark badge */}
                <div
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-black shadow-md border-2 border-white"
                  title="Tài khoản đã xác thực thông tin"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                {/* Quick overlay change avatar */}
                <button
                  type="button"
                  onClick={() => setIsAvatarModalOpen(true)}
                  className="absolute inset-0 rounded-3xl bg-black/45 text-white opacity-0 group-hover/avatar:opacity-100 flex flex-col items-center justify-center transition cursor-pointer backdrop-blur-[2px]"
                  title="Đổi ảnh đại diện"
                >
                  <Camera className="w-5 h-5 mb-0.5 text-amber-200" />
                  <span className="text-[10px] font-bold">Đổi ảnh</span>
                </button>
              </div>

              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-bold text-amber-200 mb-1">
                  <Award className="w-3.5 h-3.5" />
                  <span>Hội viên Vàng VIP</span>
                  <span>·</span>
                  <span className="text-emerald-300 flex items-center gap-0.5">
                    <BadgeCheck className="w-3 h-3" />
                    <span>Đã xác thực CCCD</span>
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2 justify-center sm:justify-start">
                  <span>{profile.name}</span>
                  <button
                    type="button"
                    onClick={() => setIsAvatarModalOpen(true)}
                    className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition cursor-pointer"
                    title="Cập nhật ảnh đại diện"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                </h1>
                <p className="text-xs text-pink-100 font-medium mt-0.5">
                  {profile.phone} · {profile.email}
                </p>
              </div>
            </div>

            {/* Loyalty points widget */}
            <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-4 text-center sm:text-right shrink-0">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-pink-200 block">
                Điểm thưởng PinkPoints
              </span>
              <div className="text-2xl font-black text-amber-300 tracking-tight my-0.5">
                {currentUser?.points ?? 250} <span className="text-xs font-bold text-white">xu</span>
              </div>
              <p className="text-[11px] text-pink-100/90">Đổi ngay 250.000đ dịch vụ làm đẹp</p>
            </div>
          </div>
        </div>

        {/* Success Alert */}
        {profileSuccessMsg && (
          <div className="mb-5 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{profileSuccessMsg}</span>
          </div>
        )}

        {/* 3. Navigation Tabs (Ví voucher trước bảo mật & mật khẩu, KHÔNG có tab đăng xuất) */}
        <div className="flex border-b border-pink-100 gap-2 mb-6 overflow-x-auto no-scrollbar">
          {/* Tab 1: Thông tin cá nhân */}
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'profile'
                ? 'border-[#e1146c] text-[#be185d]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Thông tin cá nhân</span>
          </button>

          {/* Tab 2: Lịch hẹn & Lịch sử Booking */}
          <button
            type="button"
            onClick={() => setActiveTab('bookings')}
            className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'bookings'
                ? 'border-[#e1146c] text-[#be185d]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Ticket className="w-4 h-4" />
            <span>Lịch hẹn & Lịch sử Booking</span>
          </button>

          {/* Tab 3: Ví Voucher & Ưu đãi (Nằm trước Bảo mật & Mật khẩu) */}
          <button
            type="button"
            onClick={() => setActiveTab('vouchers')}
            className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'vouchers'
                ? 'border-[#e1146c] text-[#be185d]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Gift className="w-4 h-4" />
            <span>Ví Voucher & Ưu đãi ({VOUCHERS.length})</span>
          </button>

          {/* Tab 4: Bảo mật & Mật khẩu */}
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'security'
                ? 'border-[#e1146c] text-[#be185d]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Bảo mật & Mật khẩu</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: THÔNG TIN CÁ NHÂN (HỌ TÊN, SĐT, EMAIL, ĐỊA CHỈ, CCCD, GIỚI TÍNH, NGÀY SINH) */}
        {/* ========================================================================= */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-3xl border border-pink-100 p-6 sm:p-8 shadow-xs animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-pink-50 mb-6">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#e1146c]">
                  Hồ sơ hội viên
                </span>
                <h2 className="text-lg font-black text-slate-900 mt-0.5">
                  Thông tin cá nhân & Định danh
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dữ liệu được mã hóa chuẩn y tế, tự động điền khi đặt lịch làm đẹp
                </p>
              </div>

              {!isEditingProfile ? (
                <button
                  type="button"
                  onClick={() => {
                    setProfileForm(profile);
                    setIsEditingProfile(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-pink-50 hover:bg-pink-100 text-[#be185d] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-pink-200"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Chỉnh sửa thông tin</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
              )}
            </div>

            {/* Read / Edit Form */}
            <form onSubmit={handleSaveProfile}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* 1. Họ và tên */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Họ và tên
                  </label>
                  {isEditingProfile ? (
                    <input
                      type="text"
                      required
                      value={profileForm.name}
                      onChange={(e) => { setProfileForm({ ...profileForm, name: e.target.value }); setProfileErrors((prev) => ({ ...prev, name: '' })); }}
                      minLength={2}
                      maxLength={120}
                      aria-invalid={Boolean(profileErrors.name)}
                      className="w-full px-4 py-2.5 rounded-xl border border-pink-200 bg-pink-50/20 text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:border-[#e1146c]"
                    />
                  ) : (
                    <div className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs sm:text-sm font-bold text-slate-900 flex items-center justify-between">
                      <span>{profile.name}</span>
                      <span className="text-[10px] text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
                        Đã xác thực
                      </span>
                    </div>
                  )}
                  <FieldError message={profileErrors.name} />
                </div>

                {/* 2. Số điện thoại */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Số điện thoại
                  </label>
                  {isEditingProfile ? (
                    <input
                      type="tel"
                      required
                      value={profileForm.phone}
                      onChange={(e) => { setProfileForm({ ...profileForm, phone: e.target.value }); setProfileErrors((prev) => ({ ...prev, phone: '' })); }}
                      maxLength={15}
                      aria-invalid={Boolean(profileErrors.phone)}
                      className="w-full px-4 py-2.5 rounded-xl border border-pink-200 bg-pink-50/20 text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:border-[#e1146c]"
                    />
                  ) : (
                    <div className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs sm:text-sm font-bold text-slate-900 flex items-center justify-between">
                      <span>{profile.phone}</span>
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  )}
                  <FieldError message={profileErrors.phone} />
                </div>

                {/* 3. Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Email liên hệ
                  </label>
                  {isEditingProfile ? (
                    <input
                      type="email"
                      disabled
                      title="Email đăng nhập không thể thay đổi tại đây"
                      required
                      value={profileForm.email}
                      onChange={(e) => { setProfileForm({ ...profileForm, email: e.target.value }); setProfileErrors((prev) => ({ ...prev, email: '' })); }}
                      maxLength={254}
                      aria-invalid={Boolean(profileErrors.email)}
                      className="w-full px-4 py-2.5 rounded-xl border border-pink-200 bg-pink-50/20 text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:border-[#e1146c]"
                    />
                  ) : (
                    <div className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs sm:text-sm font-bold text-slate-900 flex items-center justify-between">
                      <span className="truncate">{profile.email}</span>
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </div>
                  )}
                  <FieldError message={profileErrors.email} />
                </div>

                {/* 4. Giới tính */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Giới tính
                  </label>
                  {isEditingProfile ? (
                    <select
                      value={profileForm.gender}
                      onChange={(e) => { setProfileForm({ ...profileForm, gender: e.target.value }); setProfileErrors((prev) => ({ ...prev, gender: '' })); }}
                      aria-invalid={Boolean(profileErrors.gender)}
                      className="w-full px-4 py-2.5 rounded-xl border border-pink-200 bg-pink-50/20 text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:border-[#e1146c]"
                    >
                      <option value="Nam">Nam</option>
                      <option value="Nữ">Nữ</option>
                      <option value="Others">Others</option>
                    </select>
                  ) : (
                    <div className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs sm:text-sm font-bold text-slate-900">
                      <span>{profile.gender || 'Nam'}</span>
                    </div>
                  )}
                  <FieldError message={profileErrors.gender} />
                </div>

                {/* 5. Ngày sinh */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Ngày sinh (DD/MM/YYYY)
                  </label>
                  {isEditingProfile ? (
                    <input
                      type="text"
                      placeholder="17/10/2001"
                      value={profileForm.dateOfBirth}
                      onChange={(e) => { setProfileForm({ ...profileForm, dateOfBirth: e.target.value }); setProfileErrors((prev) => ({ ...prev, dateOfBirth: '' })); }}
                      maxLength={10}
                      aria-invalid={Boolean(profileErrors.dateOfBirth)}
                      className="w-full px-4 py-2.5 rounded-xl border border-pink-200 bg-pink-50/20 text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:border-[#e1146c]"
                    />
                  ) : (
                    <div className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs sm:text-sm font-bold text-slate-900 flex items-center justify-between">
                      <span>{profile.dateOfBirth || '17/10/2001'}</span>
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  )}
                  <FieldError message={profileErrors.dateOfBirth} />
                </div>

                {/* 6. Số CCCD / CMND */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Số CCCD / CMND định danh
                  </label>
                  {isEditingProfile ? (
                    <input
                      type="text"
                      maxLength={12}
                      placeholder="079201018923"
                      value={profileForm.citizenId}
                      onChange={(e) => { setProfileForm({ ...profileForm, citizenId: e.target.value.replace(/\D/g, '').slice(0, 12) }); setProfileErrors((prev) => ({ ...prev, citizenId: '' })); }}
                      inputMode="numeric"
                      aria-invalid={Boolean(profileErrors.citizenId)}
                      className="w-full px-4 py-2.5 rounded-xl border border-pink-200 bg-pink-50/20 text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:border-[#e1146c]"
                    />
                  ) : (
                    <div className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs sm:text-sm font-bold text-slate-900 flex items-center justify-between">
                      <span className="font-mono tracking-wider">{profile.citizenId || 'Chưa cập nhật'}</span>
                      <span className="text-[10px] text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
                        Đã khớp CSDL
                      </span>
                    </div>
                  )}
                  <FieldError message={profileErrors.citizenId} />
                </div>

                {/* 7. Địa chỉ cư trú (Chiếm 2 cột) */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Địa chỉ cư trú / Liên hệ
                  </label>
                  {isEditingProfile ? (
                    <input
                      type="text"
                      value={profileForm.address}
                      onChange={(e) => { setProfileForm({ ...profileForm, address: e.target.value }); setProfileErrors((prev) => ({ ...prev, address: '' })); }}
                      minLength={5}
                      maxLength={255}
                      aria-invalid={Boolean(profileErrors.address)}
                      className="w-full px-4 py-2.5 rounded-xl border border-pink-200 bg-pink-50/20 text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:border-[#e1146c]"
                    />
                  ) : (
                    <div className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs sm:text-sm font-medium text-slate-900 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#e1146c] shrink-0" />
                      <span>{profile.address || '123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh'}</span>
                    </div>
                  )}
                  <FieldError message={profileErrors.address} />
                </div>
              </div>

              {/* Edit Save Button */}
              {isEditingProfile && (
                <div className="mt-6 pt-5 border-t border-pink-100 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="py-2.5 px-5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="py-2.5 px-6 rounded-full bg-gradient-to-r from-[#e1146c] to-[#be185d] text-white text-xs font-bold shadow-md hover:opacity-95 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{profileSaving ? 'Đang lưu…' : 'Lưu thay đổi hồ sơ'}</span>
                  </button>
                </div>
              )}
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: LỊCH HẸN & LỊCH SỬ BOOKING (DẠNG TICKET FILM & THỜI GIAN THANH TOÁN DƯỚI GIÁ) */}
        {/* ========================================================================= */}
        {activeTab === 'bookings' && (
          <BookingsPage embedded onBack={onBackToHome} onBookNew={onBackToHome} />
        )}

        {/* ========================================================================= */}
        {/* TAB 3: VÍ VOUCHER & ƯU ĐÃI (THÀNH PHẦN BẤM TRƯỚC BẢO MẬT & MẬT KHẨU) */}
        {/* ========================================================================= */}
        {activeTab === 'vouchers' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="pb-3 border-b border-pink-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#e1146c]">
                  Voucher Wallet
                </span>
                <h2 className="text-lg font-black text-slate-900 mt-0.5">
                  Ví Voucher & Mã giảm giá ({VOUCHERS.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Mã ưu đãi độc quyền sẵn sàng áp dụng khi thanh toán đặt chỗ
                </p>
              </div>

              <button
                type="button"
                onClick={onBackToHome}
                className="px-4 py-2 rounded-full bg-gradient-to-r from-[#e1146c] to-[#be185d] text-white text-xs font-bold shadow-xs hover:opacity-95 transition cursor-pointer"
              >
                Đặt dịch vụ & Dùng mã
              </button>
            </div>

            {/* Grid of Vouchers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {VOUCHERS.map((v) => (
                <div
                  key={v.code}
                  className="relative bg-white rounded-2xl border border-pink-200 p-4 shadow-xs flex items-center justify-between gap-4 overflow-hidden group hover:border-[#e1146c] transition-all"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-pink-100 text-[#e1146c] flex items-center justify-center shrink-0">
                      <Gift className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-[#be185d]">
                          {v.code}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-pink-100 text-[#e1146c]">
                          {v.badge}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 mt-0.5 truncate">
                        {v.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">{v.desc}</p>
                      <span className="text-[10px] text-slate-400 block mt-1">HSD: {v.expiry}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyCode(v.code)}
                    className="py-2 px-3 rounded-xl bg-pink-50 hover:bg-[#e1146c] text-[#be185d] hover:text-white border border-pink-200 text-xs font-bold transition cursor-pointer shrink-0"
                  >
                    {copiedCode === v.code ? 'Đã sao chép' : 'Sao chép'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: BẢO MẬT & MẬT KHẨU (GỌN GÀNG, KHÔNG THỪA THÃI, BỎ NÚT ĐĂNG XUẤT) */}
        {/* ========================================================================= */}
        {activeTab === 'security' && (
          <div className="bg-white rounded-3xl border border-pink-100 p-6 sm:p-8 shadow-xs max-w-2xl animate-in fade-in duration-200">
            <div className="pb-4 border-b border-pink-50 mb-5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#e1146c]">
                Bảo vệ tài khoản
              </span>
              <h2 className="text-lg font-black text-slate-900 mt-0.5">
                Bảo mật & Mật khẩu
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Quản lý mật khẩu đăng nhập và thông tin xác thực an toàn
              </p>
            </div>

            <form className="space-y-4" onSubmit={handlePasswordValidation} noValidate>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Mật khẩu hiện tại</label>
                <input
                  type="password"
                  name="currentPassword"
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={passwordForm.currentPassword}
                  onChange={(e) => { setPasswordForm((value) => ({ ...value, currentPassword: e.target.value })); setPasswordErrors((value) => ({ ...value, currentPassword: '' })); }}
                  maxLength={72}
                  aria-invalid={Boolean(passwordErrors.currentPassword)}
                  aria-describedby="current-password-error"
                  placeholder="••••••••••••"
                  className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-xl border border-pink-200 bg-pink-50/20 font-semibold focus:outline-none focus:border-[#e1146c]"
                />
                <FieldError id="current-password-error" message={passwordErrors.currentPassword} />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Mật khẩu mới</label>
                <input
                  type="password"
                  name="newPassword"
                  autoComplete="new-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={passwordForm.newPassword}
                  onChange={(e) => { setPasswordForm((value) => ({ ...value, newPassword: e.target.value })); setPasswordErrors((value) => ({ ...value, newPassword: '' })); }}
                  maxLength={72}
                  aria-invalid={Boolean(passwordErrors.newPassword)}
                  aria-describedby="new-password-error"
                  placeholder="Nhập mật khẩu mới (tối thiểu 8 ký tự)..."
                  className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-xl border border-pink-200 bg-pink-50/20 font-semibold focus:outline-none focus:border-[#e1146c]"
                />
                <FieldError id="new-password-error" message={passwordErrors.newPassword} />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Xác nhận mật khẩu mới</label>
                <input
                  type="password"
                  name="confirmPassword"
                  autoComplete="new-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => { setPasswordForm((value) => ({ ...value, confirmPassword: e.target.value })); setPasswordErrors((value) => ({ ...value, confirmPassword: '' })); }}
                  maxLength={72}
                  aria-invalid={Boolean(passwordErrors.confirmPassword)}
                  aria-describedby="confirm-password-error"
                  placeholder="Nhập lại mật khẩu mới..."
                  className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-xl border border-pink-200 bg-pink-50/20 font-semibold focus:outline-none focus:border-[#e1146c]"
                />
                <FieldError id="confirm-password-error" message={passwordErrors.confirmPassword} />
              </div>

              {/* Security features preview */}
              <div className="pt-2 space-y-2">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50/60 border border-emerald-100 text-xs">
                  <div className="flex items-center gap-2 text-emerald-800">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold">Xác thực 2 lớp (2FA qua SMS)</span>
                  </div>
                  <span className="text-emerald-700 font-extrabold text-[11px]">Đang bật</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Lock className="w-4 h-4 text-slate-400" />
                    <span>Mã hóa đường truyền SSL 256-bit chuẩn PCI-DSS</span>
                  </div>
                  <span className="text-slate-500 font-bold text-[11px]">An toàn</span>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  className="py-2.5 px-6 rounded-full bg-gradient-to-r from-[#e1146c] to-[#be185d] text-white text-xs font-bold shadow-md hover:opacity-95 transition cursor-pointer"
                >
                  Lưu mật khẩu mới
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* 4. Modal Chia Sẻ Booking */}
      {sharingBooking && (
        <AppointmentShareModal
          isOpen={Boolean(sharingBooking)}
          onClose={() => setSharingBooking(null)}
          data={sharingBooking}
          onViewMyBookings={() => {
            setSharingBooking(null);
            setActiveTab('bookings');
          }}
        />
      )}

      {/* 5. Modal Cập Nhật Avatar Profile */}
      <AvatarPickerModal
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
        currentAvatar={profile.avatar}
        onSaveAvatar={handleUpdateAvatar}
      />

      {/* 7. Minimal Clean Footer */}
      <footer className="py-4 px-4 text-center text-xs text-slate-400 border-t border-pink-100/60 bg-white/60">
        © 2026 BeautyLink · Toàn bộ thông tin cá nhân và vé làm đẹp được bảo mật theo tiêu chuẩn y tế.
      </footer>
    </div>
  );
};
