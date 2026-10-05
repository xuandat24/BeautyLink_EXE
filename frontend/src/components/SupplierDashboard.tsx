import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  LayoutDashboard,
  Store,
  Calendar,
  Users,
  Clock,
  LogOut,
  Sparkles,
  MapPin,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Plus,
  Edit2,
  X,
  UploadCloud,
  Save,
  Check,
  Eye,
  EyeOff,
  Trash2,
  Navigation,
} from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import {
  BackendSupplierProfile,
  BackendPractitioner,
  BackendBooking,
  BackendService,
  BackendCategory,
  ScheduleRule,
} from '../types';
import { beautyApi, getApiErrorMessage } from '../services/beautyApi';

interface SupplierDashboardProps {
  onBack: () => void;
  onLogout: () => void;
}

const DAYS_OF_WEEK = [
  { id: 1, name: 'Thứ Hai' },
  { id: 2, name: 'Thứ Ba' },
  { id: 3, name: 'Thứ Tư' },
  { id: 4, name: 'Thứ Năm' },
  { id: 5, name: 'Thứ Sáu' },
  { id: 6, name: 'Thứ Bảy' },
  { id: 7, name: 'Chủ Nhật' },
];

const getDefaultRules = (): ScheduleRule[] =>
  DAYS_OF_WEEK.map((d) => ({
    dayOfWeek: d.id,
    dayName: d.name,
    isWorking: d.id !== 7,
    startTime: '09:00',
    endTime: '18:00',
    breakStartTime: '12:00',
    breakEndTime: '13:00',
    slotDurationMinutes: 30,
  }));

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('vi-VN').format(val) + 'đ';
};

export const SupplierDashboard: React.FC<SupplierDashboardProps> = ({ onBack, onLogout }) => {
  const [currentTab, setCurrentTab] = useState<'overview' | 'store' | 'bookings' | 'team' | 'schedule'>('overview');
  const [profile, setProfile] = useState<BackendSupplierProfile | null>(null);
  const [practitioners, setPractitioners] = useState<BackendPractitioner[]>([]);
  const [bookings, setBookings] = useState<BackendBooking[]>([]);
  const [selectedPractitionerId, setSelectedPractitionerId] = useState<number | null>(null);
  const [rules, setRules] = useState<ScheduleRule[]>(getDefaultRules());

  const [loading, setLoading] = useState<boolean>(true);
  const [loadingSchedule, setLoadingSchedule] = useState<boolean>(false);
  const [savingSchedule, setSavingSchedule] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  const [practitionerModal, setPractitionerModal] = useState<BackendPractitioner | 'new' | null>(null);

  // Load basic supplier data
  useEffect(() => {
    setLoading(true);
    Promise.all([
      beautyApi.supplierProfile(),
      beautyApi.supplierPractitioners(),
      beautyApi.supplierBookings(),
    ])
      .then(([prof, practs, bks]) => {
        setProfile(prof);
        setPractitioners(practs);
        setBookings(bks);
        if (practs.length > 0) {
          setSelectedPractitionerId(practs[0].id);
        }
      })
      .catch((err) => setError(getApiErrorMessage(err, 'Không thể tải dữ liệu đối tác.')))
      .finally(() => setLoading(false));
  }, []);

  // Load practitioner schedule when selecting tab schedule
  useEffect(() => {
    if (!selectedPractitionerId || currentTab !== 'schedule') return;
    setLoadingSchedule(true);
    setError('');
    setMessage('');
    beautyApi
      .practitionerSchedule(selectedPractitionerId)
      .then((serverRules) => {
        if (serverRules && serverRules.length > 0) {
          const ruleMap = new Map(serverRules.map((r) => [r.dayOfWeek, r]));
          setRules(
            getDefaultRules().map((def) => {
              const s = ruleMap.get(def.dayOfWeek);
              return s ? { ...def, ...s } : def;
            })
          );
        } else {
          setRules(getDefaultRules());
        }
      })
      .catch((err) => setError(getApiErrorMessage(err, 'Không thể tải lịch làm việc.')))
      .finally(() => setLoadingSchedule(false));
  }, [selectedPractitionerId, currentTab]);

  const upcomingBookings = useMemo(
    () => bookings.filter((b) => b.status === 'CONFIRMED' || b.status === 'PENDING'),
    [bookings]
  );

  const completedBookings = useMemo(
    () => bookings.filter((b) => b.status === 'COMPLETED'),
    [bookings]
  );

  const cancelledBookings = useMemo(
    () => bookings.filter((b) => b.status === 'CANCELLED'),
    [bookings]
  );

  const totalRevenue = useMemo(
    () => bookings.filter((b) => b.status !== 'CANCELLED').reduce((sum, b) => sum + (b.totalAmount || 0), 0),
    [bookings]
  );

  const completionRate = bookings.length > 0
    ? Math.round((completedBookings.length / bookings.length) * 100)
    : 0;

  const handleUpdateRule = (dayOfWeek: number, field: keyof ScheduleRule, value: any) => {
    setRules((prev) =>
      prev.map((r) => (r.dayOfWeek === dayOfWeek ? { ...r, [field]: value } : r))
    );
  };

  const handleSaveSchedule = async () => {
    if (!selectedPractitionerId) return;
    setSavingSchedule(true);
    setError('');
    setMessage('');
    try {
      const saved = await beautyApi.replaceSchedule(selectedPractitionerId, rules);
      setRules(saved);
      setMessage('Đã lưu lịch. Khung giờ trống cho khách hàng đã được cập nhật.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không thể lưu lịch làm việc.'));
    } finally {
      setSavingSchedule(false);
    }
  };

  const navItems = [
    { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'store', label: 'Gian hàng & dịch vụ', icon: Store },
    { id: 'bookings', label: 'Lịch hẹn', icon: Calendar },
    { id: 'team', label: 'Đội ngũ', icon: Users },
    { id: 'schedule', label: 'Giờ làm việc', icon: Clock },
  ] as const;

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#FFF0F3]">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#EB0F51]" />
          <p className="mt-3 text-sm font-bold text-slate-500">Đang mở không gian đối tác...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-4 sm:px-6">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-600 hover:text-[#EB0F51] transition"
          >
            <ArrowLeft className="h-4 w-4" /> Trang chủ
          </button>
          <span className="text-lg font-black tracking-tight">
            Beauty<span className="text-[#EB0F51]">Link</span>{' '}
            <span className="text-xs text-slate-400 font-semibold uppercase ml-1">Partner</span>
          </span>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-600 transition hover:bg-rose-600 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Đăng xuất</span>
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[250px_1fr]">
        {/* Sidebar */}
        <aside className="border-b border-slate-200 bg-white p-4 lg:min-h-[calc(100vh-65px)] lg:border-b-0 lg:border-r lg:p-5">
          <div className="mb-5 hidden rounded-2xl bg-[#FFF0F3] p-4 lg:block">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[#EB0F51] shadow-sm">
                <Store className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-black">{profile?.name || 'Gian hàng'}</p>
                <p className="truncate text-[11px] text-slate-500">{profile?.businessType}</p>
              </div>
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto lg:block lg:space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm font-extrabold transition lg:w-full ${
                    isActive
                      ? 'bg-[#EB0F51] text-white shadow-md shadow-pink-600/15'
                      : 'text-slate-500 hover:bg-pink-50 hover:text-[#B42D58]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-6 hidden rounded-2xl border border-slate-200 p-4 lg:block">
            <p className="text-xs font-black">Cần hỗ trợ?</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              Đội ngũ BeautyLink sẵn sàng hỗ trợ thiết lập gian hàng.
            </p>
            <button className="mt-3 text-xs font-black text-[#EB0F51] hover:underline">
              Liên hệ hỗ trợ →
            </button>
          </div>
        </aside>

        {/* Tab Content Area */}
        <main className="min-w-0 p-4 sm:p-6 lg:p-9">
          {profile?.verificationStatus === 'PENDING' && (
            <div className="mb-6 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <Clock className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-black">Hồ sơ đang chờ xác minh</p>
                <p className="mt-1 text-xs leading-5 text-amber-800">
                  Bạn có thể thiết lập đội ngũ và lịch ngay. Gian hàng chỉ hiển thị với khách sau khi BeautyLink duyệt hồ sơ.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mb-5 flex items-center justify-between rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700"
            >
              <span>{error}</span>
              <button onClick={() => setError('')}>
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {message && (
            <div className="mb-5 flex items-center justify-between rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
              <span>{message}</span>
              <button onClick={() => setMessage('')}>
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {currentTab === 'overview' && (
            <div>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#EB0F51]">
                    Tổng quan gian hàng
                  </p>
                  <h1 className="mt-2 text-3xl font-black">Xin chào, {profile?.name}</h1>
                  <p className="mt-2 flex items-center gap-1 text-sm text-slate-500">
                    <MapPin className="h-4 w-4 text-[#D28474]" /> {profile?.address}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black ${
                    profile?.verificationStatus === 'VERIFIED'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {profile?.verificationStatus === 'VERIFIED' ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <Clock className="h-4 w-4" />
                  )}
                  {profile?.verificationStatus === 'VERIFIED' ? 'Đã xác minh' : 'Chờ xác minh'}
                </span>
              </div>

              {/* KPI Cards */}
              <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="grid h-10 w-10 place-items-center rounded-xl text-blue-600 bg-blue-50">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <p className="mt-5 text-2xl font-black">{bookings.length}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Tổng lịch hẹn</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="grid h-10 w-10 place-items-center rounded-xl text-violet-600 bg-violet-50">
                    <Clock className="h-5 w-5" />
                  </div>
                  <p className="mt-5 text-2xl font-black">{upcomingBookings.length}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Lịch sắp tới</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="grid h-10 w-10 place-items-center rounded-xl text-amber-600 bg-amber-50">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                  <p className="mt-5 text-2xl font-black">{completionRate}%</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Tỷ lệ hoàn thành</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="grid h-10 w-10 place-items-center rounded-xl text-emerald-600 bg-emerald-50">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <p className="mt-5 text-2xl font-black">{formatCurrency(totalRevenue)}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Giá trị đơn (mô phỏng)</p>
                </div>
              </div>

              {/* Recent Bookings and Status Breakdown */}
              <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-black">Lịch hẹn gần đây</h2>
                      <p className="text-xs text-slate-500">
                        Dữ liệu cập nhật trực tiếp từ lịch khách đã đặt.
                      </p>
                    </div>
                    <button
                      onClick={() => setCurrentTab('bookings')}
                      className="text-xs font-black text-[#EB0F51] hover:underline"
                    >
                      Xem tất cả
                    </button>
                  </div>
                  <div className="mt-4 space-y-2">
                    {bookings.slice(0, 4).map((b) => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between rounded-2xl border border-slate-100 p-3"
                      >
                        <div>
                          <p className="text-xs font-black">{b.serviceName}</p>
                          <p className="text-[11px] text-slate-400">
                            {b.bookingCode} · {b.appointmentDate} ({b.startTime.slice(0, 5)})
                          </p>
                        </div>
                        <span className="rounded-full bg-pink-50 px-2 py-1 text-[10px] font-black text-[#B42D58]">
                          {formatCurrency(b.totalAmount)}
                        </span>
                      </div>
                    ))}
                    {bookings.length === 0 && (
                      <div className="p-8 text-center text-sm text-slate-400">
                        Chưa có lịch hẹn nào.
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-[#EB0F51]" />
                    <h2 className="font-black">Phân bổ trạng thái</h2>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Tổng hợp trên {bookings.length} lịch hẹn hiện có.
                  </p>
                  <div className="mt-6 space-y-4">
                    <div>
                      <div className="mb-1 flex justify-between text-xs font-bold text-slate-600">
                        <span>Sắp tới</span>
                        <strong>{upcomingBookings.length}</strong>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{
                            width: `${bookings.length ? (upcomingBookings.length / bookings.length) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="mb-1 flex justify-between text-xs font-bold text-slate-600">
                        <span>Hoàn thành</span>
                        <strong>{completedBookings.length}</strong>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{
                            width: `${bookings.length ? (completedBookings.length / bookings.length) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="mb-1 flex justify-between text-xs font-bold text-slate-600">
                        <span>Đã hủy</span>
                        <strong>{cancelledBookings.length}</strong>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-rose-400 rounded-full"
                          style={{
                            width: `${bookings.length ? (cancelledBookings.length / bookings.length) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* TAB 2: STORE & SERVICES */}
          {currentTab === 'store' && profile && (
            <SupplierStoreTab
              profile={profile}
              onProfileUpdated={(updated) => setProfile(updated)}
            />
          )}

          {/* TAB 3: BOOKINGS */}
          {currentTab === 'bookings' && (
            <section>
              <div className="mb-6">
                <p className="text-xs font-black uppercase tracking-widest text-[#EB0F51]">
                  Vận hành
                </p>
                <h1 className="mt-1 text-2xl font-black">Quản lý lịch hẹn</h1>
                <p className="mt-1 text-xs text-slate-500">
                  Danh sách lịch hẹn được đặt tại cơ sở của bạn.
                </p>
              </div>

              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                {bookings.length > 0 ? (
                  bookings.map((b) => (
                    <div
                      key={b.id}
                      className="grid gap-3 border-b border-slate-100 p-5 last:border-0 md:grid-cols-[1.3fr_1fr_0.8fr_auto] md:items-center"
                    >
                      <div>
                        <p className="text-sm font-black">{b.serviceName}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {b.bookingCode} · {b.practitionerName}
                        </p>
                      </div>
                      <p className="text-xs font-bold">
                        {b.appointmentDate} · {b.startTime.slice(0, 5)}
                      </p>
                      <p className="text-sm font-black">{formatCurrency(b.totalAmount)}</p>
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-black uppercase text-center ${
                          b.status === 'CANCELLED'
                            ? 'bg-slate-100 text-slate-500'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-12 text-center text-sm text-slate-400">
                    Chưa có lịch hẹn nào từ khách hàng.
                  </div>
                )}
              </div>
            </section>
          )}

          {/* TAB 4: TEAM */}
          {currentTab === 'team' && (
            <section>
              <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-[#EB0F51]">
                    Nhân sự
                  </p>
                  <h1 className="mt-1 text-2xl font-black">Đội ngũ chuyên viên</h1>
                  <p className="mt-1 text-xs text-slate-500">
                    Thêm chuyên viên, tải ảnh đại diện và cấu hình lịch làm việc riêng.
                  </p>
                </div>
                <button
                  onClick={() => setPractitionerModal('new')}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#EB0F51] px-4 py-3 text-xs font-black text-white hover:bg-[#B42D58] transition"
                >
                  <Plus className="h-4 w-4" /> Thêm chuyên viên
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {practitioners.map((p) => (
                  <article
                    key={p.id}
                    className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-center gap-4">
                      <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-2xl bg-pink-50 text-[#EB0F51]">
                        {p.avatarUrl ? (
                          <img
                            src={p.avatarUrl}
                            alt={p.displayName || p.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Users className="h-6 w-6" />
                        )}
                      </span>
                      <div>
                        <h3 className="font-black">{p.displayName || p.name}</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          {p.specialty || 'Chuyên viên làm đẹp'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setPractitionerModal(p)}
                        className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-50"
                      >
                        <Edit2 className="h-4 w-4" /> Hồ sơ
                      </button>
                      <button
                        onClick={() => {
                          setSelectedPractitionerId(p.id);
                          setCurrentTab('schedule');
                        }}
                        className="flex items-center justify-center gap-2 rounded-xl border border-pink-200 py-2.5 text-xs font-black text-[#B42D58] hover:bg-pink-50"
                      >
                        <Clock className="h-4 w-4" /> Lịch làm
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* TAB 5: SCHEDULE */}
          {currentTab === 'schedule' && (
            <section>
              <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-[#EB0F51]">
                    Khả dụng
                  </p>
                  <h1 className="mt-1 text-2xl font-black">Giờ làm việc</h1>
                  <p className="mt-1 text-xs text-slate-500">
                    Thiết lập ngày làm, giờ nghỉ và độ dài mỗi khung đặt lịch.
                  </p>
                </div>
                <button
                  onClick={handleSaveSchedule}
                  disabled={savingSchedule || loadingSchedule || !selectedPractitionerId}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-xs font-black text-white hover:bg-[#B42D58] disabled:opacity-40 transition"
                >
                  {savingSchedule ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Lưu lịch
                </button>
              </div>

              <div className="grid gap-5 xl:grid-cols-[230px_1fr]">
                {/* Practitioner List Sidebar */}
                <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
                  <p className="px-3 pb-2 pt-1 text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Chuyên viên
                  </p>
                  {practitioners.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPractitionerId(p.id)}
                      className={`mb-1 flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${
                        selectedPractitionerId === p.id
                          ? 'bg-pink-50 text-[#B42D58] font-bold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <Users className="h-4 w-4" />
                      <div className="min-w-0">
                        <span className="block text-xs font-black truncate">
                          {p.displayName || p.name}
                        </span>
                        <span className="block text-[10px] text-slate-400 truncate">
                          {p.specialty || 'Chuyên viên'}
                        </span>
                      </div>
                    </button>
                  ))}
                </aside>

                {/* Schedule Rules Table */}
                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                  {loadingSchedule ? (
                    <div className="grid h-64 place-items-center">
                      <Loader2 className="h-7 w-7 animate-spin text-[#EB0F51]" />
                    </div>
                  ) : (
                    <>
                      <div className="mb-3 hidden grid-cols-[125px_repeat(5,1fr)] gap-2 px-3 text-[10px] font-black uppercase tracking-wider text-slate-400 sm:grid">
                        <span>Ngày</span>
                        <span>Bắt đầu</span>
                        <span>Kết thúc</span>
                        <span>Nghỉ từ</span>
                        <span>Nghỉ đến</span>
                        <span>Khung giờ</span>
                      </div>
                      <div className="space-y-2">
                        {rules.map((rule) => {
                          const dayObj = DAYS_OF_WEEK.find((d) => d.id === rule.dayOfWeek);
                          const dayLabel = dayObj?.name || `Thứ ${rule.dayOfWeek}`;
                          return (
                            <div
                              key={rule.dayOfWeek}
                              className={`grid gap-3 rounded-2xl border p-3 sm:grid-cols-[110px_1fr] sm:items-center ${
                                rule.isWorking
                                  ? 'border-slate-200 bg-white'
                                  : 'border-slate-100 bg-slate-50 opacity-60'
                              }`}
                            >
                              <label className="flex items-center gap-2 text-xs font-black">
                                <input
                                  type="checkbox"
                                  checked={rule.isWorking}
                                  onChange={(e) =>
                                    handleUpdateRule(rule.dayOfWeek, 'isWorking', e.target.checked)
                                  }
                                  className="h-4 w-4 accent-[#EB0F51]"
                                />
                                {dayLabel}
                              </label>

                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                                <input
                                  type="time"
                                  disabled={!rule.isWorking}
                                  value={rule.startTime}
                                  onChange={(e) =>
                                    handleUpdateRule(rule.dayOfWeek, 'startTime', e.target.value)
                                  }
                                  className="field text-xs py-2 px-2"
                                />
                                <input
                                  type="time"
                                  disabled={!rule.isWorking}
                                  value={rule.endTime}
                                  onChange={(e) =>
                                    handleUpdateRule(rule.dayOfWeek, 'endTime', e.target.value)
                                  }
                                  className="field text-xs py-2 px-2"
                                />
                                <input
                                  type="time"
                                  disabled={!rule.isWorking}
                                  value={rule.breakStartTime || ''}
                                  onChange={(e) =>
                                    handleUpdateRule(
                                      rule.dayOfWeek,
                                      'breakStartTime',
                                      e.target.value || null
                                    )
                                  }
                                  className="field text-xs py-2 px-2"
                                />
                                <input
                                  type="time"
                                  disabled={!rule.isWorking}
                                  value={rule.breakEndTime || ''}
                                  onChange={(e) =>
                                    handleUpdateRule(
                                      rule.dayOfWeek,
                                      'breakEndTime',
                                      e.target.value || null
                                    )
                                  }
                                  className="field text-xs py-2 px-2"
                                />
                                <select
                                  disabled={!rule.isWorking}
                                  value={rule.slotDurationMinutes}
                                  onChange={(e) =>
                                    handleUpdateRule(
                                      rule.dayOfWeek,
                                      'slotDurationMinutes',
                                      Number(e.target.value)
                                    )
                                  }
                                  className="field text-xs py-2 px-2 bg-white"
                                >
                                  <option value={30}>30 phút</option>
                                  <option value={45}>45 phút</option>
                                  <option value={60}>60 phút</option>
                                  <option value={90}>90 phút</option>
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </section>
          )}
        </main>
      </div>

      {/* Practitioner Modal */}
      {practitionerModal && (
        <SupplierPractitionerModal
          person={practitionerModal === 'new' ? null : practitionerModal}
          onClose={() => setPractitionerModal(null)}
          onSaved={(saved) => {
            if (practitionerModal === 'new') {
              setPractitioners((prev) => [...prev, saved]);
              setSelectedPractitionerId(saved.id);
            } else {
              setPractitioners((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
            }
            setPractitionerModal(null);
            setMessage(
              practitionerModal === 'new'
                ? 'Đã thêm chuyên viên thành công.'
                : 'Đã cập nhật hồ sơ chuyên viên.'
            );
          }}
        />
      )}
    </div>
  );
};

// ==========================================
// SUB-TAB: STORE & SERVICES
// ==========================================
interface SupplierStoreTabProps {
  profile: BackendSupplierProfile;
  onProfileUpdated: (updated: BackendSupplierProfile) => void;
}

const SupplierStoreTab: React.FC<SupplierStoreTabProps> = ({ profile, onProfileUpdated }) => {
  const [categories, setCategories] = useState<BackendCategory[]>([]);
  const [services, setServices] = useState<BackendService[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [serviceModal, setServiceModal] = useState<BackendService | 'new' | null>(null);

  const [storeForm, setStoreForm] = useState({
    name: profile.name,
    businessType: profile.businessType,
    address: profile.address,
    imageUrl: profile.imageUrl || '',
    latitude: profile.latitude ?? 10.7769,
    longitude: profile.longitude ?? 106.7009,
    description: profile.description || '',
  });

  useEffect(() => {
    setLoading(true);
    Promise.all([beautyApi.categories(), beautyApi.supplierServices()])
      .then(([cats, servs]) => {
        setCategories(cats);
        setServices(servs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSaveStoreProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg('');
    try {
      const updated = await beautyApi.updateSupplierProfile(storeForm);
      onProfileUpdated(updated);
      setProfileMsg('Đã lưu thông tin và hình ảnh gian hàng.');
    } catch {
      setProfileMsg('Không thể lưu thông tin gian hàng.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeactivate = async (id: number) => {
    try {
      await beautyApi.deactivateSupplierService(id);
      setServices((prev) => prev.filter((s) => s.id !== id));
    } catch {}
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-[#EB0F51]">Gian hàng</p>
        <h1 className="mt-1 text-2xl font-black">Hồ sơ & dịch vụ</h1>
        <p className="mt-1 text-xs text-slate-500">
          Cập nhật hình ảnh thương hiệu và những dịch vụ khách hàng có thể đặt.
        </p>
      </div>

      {/* Store Profile Form */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-black">Thông tin gian hàng</h2>
        <p className="text-xs text-slate-500">Hiển thị trên thẻ dịch vụ và trang chủ.</p>

        <form onSubmit={handleSaveStoreProfile} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-700">Tên gian hàng *</span>
              <input
                required
                value={storeForm.name}
                onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })}
                className="field"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-700">Loại hình *</span>
              <input
                required
                value={storeForm.businessType}
                onChange={(e) => setStoreForm({ ...storeForm, businessType: e.target.value })}
                className="field"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-bold text-slate-700">Địa chỉ *</span>
            <input
              required
              value={storeForm.address}
              onChange={(e) => setStoreForm({ ...storeForm, address: e.target.value })}
              className="field"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-bold text-slate-700">Ảnh đại diện URL</span>
            <input
              value={storeForm.imageUrl}
              onChange={(e) => setStoreForm({ ...storeForm, imageUrl: e.target.value })}
              className="field"
            />
          </label>

          {profileMsg && (
            <p className="rounded-xl bg-pink-50 p-3 text-xs font-bold text-[#B42D58]">
              {profileMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={savingProfile}
            className="inline-flex items-center gap-2 rounded-xl bg-[#EB0F51] px-5 py-3 text-xs font-black text-white hover:bg-[#B42D58] transition"
          >
            {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Lưu gian hàng
          </button>
        </form>
      </section>

      {/* Services List */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-black">Dịch vụ của bạn</h2>
            <p className="text-xs text-slate-500">{services.length} dịch vụ đang hiển thị</p>
          </div>
          <button
            onClick={() => setServiceModal('new')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#EB0F51] px-4 py-2.5 text-xs font-black text-white hover:bg-[#B42D58] transition"
          >
            <Plus className="h-4 w-4" /> Tạo dịch vụ
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {services.map((s) => (
            <article key={s.id} className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="relative h-40 overflow-hidden bg-slate-100">
                <img src={s.imageUrl} alt={s.name} className="h-full w-full object-cover" />
              </div>
              <div className="p-4">
                <p className="text-[10px] font-black uppercase text-[#EB0F51]">{s.categoryName || s.categorySlug}</p>
                <h3 className="mt-1 font-black truncate">{s.name}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {s.durationMinutes} phút · <strong>{formatCurrency(s.price)}</strong>
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setServiceModal(s)}
                    className="flex-1 rounded-xl border border-pink-200 py-2 text-xs font-bold text-[#B42D58] hover:bg-pink-50"
                  >
                    Chỉnh sửa
                  </button>
                  <button
                    onClick={() => handleDeactivate(s.id)}
                    className="rounded-xl border border-rose-200 px-3 text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
          {services.length === 0 && !loading && (
            <div className="col-span-full p-8 text-center text-sm text-slate-400">
              Chưa có dịch vụ nào. Hãy bấm "Tạo dịch vụ" để bắt đầu nhận lịch.
            </div>
          )}
        </div>
      </section>

      {/* Service Modal */}
      {serviceModal && (
        <SupplierServiceModal
          service={serviceModal === 'new' ? null : serviceModal}
          categories={categories}
          onClose={() => setServiceModal(null)}
          onSave={async (itemData) => {
            if (serviceModal === 'new') {
              const created = await beautyApi.createSupplierService(itemData);
              setServices((prev) => [...prev, created]);
            } else {
              const updated = await beautyApi.updateSupplierService(serviceModal.id, itemData);
              setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
            }
            setServiceModal(null);
          }}
        />
      )}
    </div>
  );
};

// ==========================================
// MODAL: PRACTITIONER ADD/EDIT
// ==========================================
interface SupplierPractitionerModalProps {
  person: BackendPractitioner | null;
  onClose: () => void;
  onSaved: (person: BackendPractitioner) => void;
}

const SupplierPractitionerModal: React.FC<SupplierPractitionerModalProps> = ({
  person,
  onClose,
  onSaved,
}) => {
  const [name, setName] = useState(person?.displayName || person?.name || '');
  const [specialty, setSpecialty] = useState(person?.specialty || '');
  const [avatarUrl, setAvatarUrl] = useState(person?.avatarUrl || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (person) {
        const updated = await beautyApi.updatePractitioner(person.id, {
          name,
          specialty,
          avatarUrl: avatarUrl || undefined,
        });
        onSaved(updated);
      } else {
        const created = await beautyApi.createPractitioner({
          name,
          specialty,
          avatarUrl: avatarUrl || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
        });
        onSaved(created);
      }
    } catch {
      // fallback mock object
      onSaved({
        id: person?.id || Date.now(),
        name,
        displayName: name,
        specialty,
        avatarUrl,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Lock body scroll
  useBodyScrollLock(true);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 overflow-hidden animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-150 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative z-10 w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-pink-100 max-h-[90vh] overflow-y-auto overscroll-contain animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-black">
              {person ? 'Chỉnh sửa chuyên viên' : 'Thêm chuyên viên'}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Cập nhật thông tin hiển thị trên trang đặt lịch.
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-slate-700">Tên chuyên viên *</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="field"
              placeholder="Nguyễn Lan Anh"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-bold text-slate-700">Chuyên môn</span>
            <input
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="field"
              placeholder="Trang điểm cô dâu, chăm sóc da..."
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-bold text-slate-700">Ảnh đại diện URL</span>
            <input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className="field"
              placeholder="https://..."
            />
          </label>

          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[#EB0F51] px-5 py-2.5 text-xs font-black text-white hover:bg-[#B42D58]"
            >
              {submitting ? 'Đang lưu...' : 'Lưu hồ sơ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// MODAL: SERVICE ADD/EDIT
// ==========================================
interface SupplierServiceModalProps {
  service: BackendService | null;
  categories: BackendCategory[];
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}

const SupplierServiceModal: React.FC<SupplierServiceModalProps> = ({
  service,
  categories,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    name: service?.name || '',
    categoryId: service?.categoryId || categories[0]?.id || 1,
    price: service?.price || 200000,
    durationMinutes: service?.durationMinutes || 60,
    description: service?.description || '',
    imageUrl: service?.imageUrl || 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSave(formData);
    } finally {
      setSubmitting(false);
    }
  };

  // Lock body scroll
  useBodyScrollLock(true);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 overflow-hidden animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-150 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative z-10 w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-pink-100 max-h-[90vh] overflow-y-auto overscroll-contain animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-black">{service ? 'Chỉnh sửa dịch vụ' : 'Tạo dịch vụ mới'}</h2>
            <p className="mt-1 text-xs text-slate-500">Khách hàng sẽ thấy dịch vụ này để đặt lịch.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-slate-700">Tên dịch vụ *</span>
            <input
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="field"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-700">Danh mục</span>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: Number(e.target.value) })}
                className="field bg-white"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-700">Thời lượng (phút)</span>
              <input
                type="number"
                min={15}
                step={15}
                value={formData.durationMinutes}
                onChange={(e) => setFormData({ ...formData, durationMinutes: Number(e.target.value) })}
                className="field"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-bold text-slate-700">Giá bán (VNĐ) *</span>
            <input
              type="number"
              min={1000}
              step={10000}
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
              className="field"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-bold text-slate-700">Ảnh dịch vụ URL</span>
            <input
              value={formData.imageUrl}
              onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
              className="field"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-bold text-slate-700">Mô tả chi tiết</span>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="field resize-none"
            />
          </label>

          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[#EB0F51] px-5 py-2.5 text-xs font-black text-white hover:bg-[#B42D58]"
            >
              {submitting ? 'Đang lưu...' : 'Lưu dịch vụ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
