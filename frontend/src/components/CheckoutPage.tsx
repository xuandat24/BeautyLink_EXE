import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Calendar,
  QrCode,
  Wallet,
  Tag,
  Check,
  Sparkles,
  Lock,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Store,
  Layers,
  Percent,
} from 'lucide-react';
import { useBeautyStore } from '../store/beautyStore';
import { CurrentUser, BackendService, CartItem } from '../types';
import { beautyApi, getApiErrorMessage } from '../services/beautyApi';
import { OptimizedImage } from './OptimizedImage';
import { bookingSchema, FieldErrors, voucherCodeSchema, zodFieldErrors } from '../lib/validation';
import { FieldError } from './FieldError';

interface CheckoutPageProps {
  currentUser: CurrentUser | null;
  onBack: () => void;
  onViewBookings: () => void;
  onNeedLogin: () => void;
  directService?: BackendService | null;
  preselectedDate?: string;
  preselectedTime?: string;
}

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('vi-VN').format(val) + 'đ';
};

const getInitials = (str: string) =>
  str
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();

// Available vouchers
const AVAILABLE_VOUCHERS = [
  { code: 'BEAUTY50', label: 'Giảm 50.000đ cho đơn từ 200k', minOrder: 200000, discount: 50000, type: 'fixed' },
  { code: 'BEAUTY100', label: 'Giảm 100.000đ cho đơn từ 500k', minOrder: 500000, discount: 100000, type: 'fixed' },
  { code: 'PINK15', label: 'Giảm 15% tối đa 150k cho thành viên', minOrder: 0, discount: 0.15, maxDiscount: 150000, type: 'percent' },
];

export const CheckoutPage: React.FC<CheckoutPageProps> = ({
  currentUser,
  onBack,
  onViewBookings,
  onNeedLogin,
  directService,
  preselectedDate,
  preselectedTime,
}) => {
  const { cartItems, updateCartQuantity } = useBeautyStore();

  // If there's a direct service passed, create synthetic cart list, else use store cart
  const items: CartItem[] = useMemo(() => {
    if (directService) {
      return [
        {
          deal: {
            id: String(directService.id),
            title: directService.name,
            brandName: directService.supplierName,
            brandLogo: directService.supplierName.slice(0, 2).toUpperCase(),
            highlightText: directService.highlightText || 'Dịch vụ chọn nhanh',
            originalPrice: directService.originalPrice || directService.price,
            salePrice: directService.price,
            discountPercent:
              directService.originalPrice && directService.originalPrice > directService.price
                ? Math.round(((directService.originalPrice - directService.price) / directService.originalPrice) * 100)
                : 0,
            rating: directService.rating,
            reviewsCount: directService.supplierReviewCount,
            image: directService.imageUrl,
            category: directService.categorySlug,
            duration: `${directService.durationMinutes} phút`,
            serviceId: directService.id,
          },
          quantity: 1,
        },
      ];
    }
    return cartItems;
  }, [directService, cartItems]);

  // Stepper state: 1 = Lịch hẹn & Hồ sơ, 2 = Hình thức thanh toán (50% / 100%), 3 = Tóm tắt dịch vụ & Voucher
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Check if date & slot were preselected from beauty service page (Trường hợp 2)
  const isPreselected = Boolean(preselectedDate || preselectedTime);
  const [isChangingSchedule, setIsChangingSchedule] = useState(!isPreselected);

  // Default Tomorrow's date
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(
    preselectedDate || tomorrow
  );
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>(
    preselectedTime || '10:00'
  );
  const [scheduleErrors, setScheduleErrors] = useState<FieldErrors>({});

  // If preselected props change, sync state
  useEffect(() => {
    if (preselectedDate) setSelectedDate(preselectedDate);
    if (preselectedTime) setSelectedTimeSlot(preselectedTime);
    if (preselectedDate || preselectedTime) {
      setIsChangingSchedule(false);
    }
  }, [preselectedDate, preselectedTime]);

  // Payment Deposit Option: 50% deposit or 100% full
  const [depositOption, setDepositOption] = useState<'deposit50' | 'full100'>('deposit50');

  // Voucher state
  const [voucherCodeInput, setVoucherCodeInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<{
    code: string;
    discountAmount: number;
    description: string;
  } | null>(null);
  const [voucherError, setVoucherError] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  // Calculations
  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.deal.salePrice * item.quantity, 0);
  }, [items]);

  const discountAmount = useMemo(() => {
    if (!appliedVoucher) return 0;
    return appliedVoucher.discountAmount;
  }, [appliedVoucher]);

  const discountedTotal = useMemo(
    () => Math.max(0, subtotal - discountAmount),
    [subtotal, discountAmount]
  );

  // The deposit option is calculated from the discounted business total:
  // exactly 50% now + 50% at the salon, or 100% now.
  const amountDueNow = useMemo(() => {
    if (depositOption === 'deposit50') {
      return Math.round(discountedTotal * 0.5);
    }
    return discountedTotal;
  }, [depositOption, discountedTotal]);

  const remainingAtSalon = useMemo(() => {
    if (depositOption === 'deposit50') {
      return discountedTotal - amountDueNow;
    }
    return 0;
  }, [depositOption, discountedTotal, amountDueNow]);

  const totalBillAfterDiscount = discountedTotal;

  // Apply Voucher
  const handleApplyVoucher = (codeToApply?: string) => {
    const validation = voucherCodeSchema.safeParse(codeToApply || voucherCodeInput);
    if (!validation.success) {
      setVoucherError(validation.error.issues[0].message);
      return;
    }
    const code = validation.data;
    const found = AVAILABLE_VOUCHERS.find((v) => v.code === code);
    if (!found) {
      setVoucherError('Mã voucher không hợp lệ hoặc đã hết hạn.');
      return;
    }
    if (subtotal < found.minOrder) {
      setVoucherError(`Đơn hàng tối thiểu ${formatCurrency(found.minOrder)} để áp dụng mã này.`);
      return;
    }

    let calculatedDiscount = 0;
    if (found.type === 'fixed') {
      calculatedDiscount = found.discount as number;
    } else {
      calculatedDiscount = Math.min(
        Math.round(subtotal * (found.discount as number)),
        found.maxDiscount || 150000
      );
    }

    setAppliedVoucher({
      code: found.code,
      discountAmount: calculatedDiscount,
      description: found.label,
    });
    setVoucherCodeInput('');
    setVoucherError('');
  };

  const handleRemoveVoucher = () => {
    setAppliedVoucher(null);
    setVoucherError('');
  };

  const handleContinueFromSchedule = () => {
    const validation = bookingSchema.safeParse({ appointmentDate: selectedDate, startTime: selectedTimeSlot, note: '' });
    if (!validation.success) {
      setScheduleErrors(zodFieldErrors(validation.error));
      return;
    }
    setScheduleErrors({});
    setCurrentStep(2);
  };

  // Submit & Complete Booking
  const handleFinalSubmit = async () => {
    setErrorMsg('');
    if (!currentUser) {
      onNeedLogin();
      return;
    }
    if (currentUser.role !== 'CUSTOMER') {
      setErrorMsg('Chỉ tài khoản khách hàng có thể thực hiện thanh toán.');
      return;
    }
    if (items.length === 0) {
      setErrorMsg('Giỏ dịch vụ của bạn đang trống.');
      return;
    }
    if (items.length > 1) {
      setErrorMsg('Mỗi giao dịch chỉ áp dụng cho một lịch hẹn. Vui lòng thanh toán từng dịch vụ.');
      return;
    }
    const validation = bookingSchema.safeParse({
      appointmentDate: selectedDate,
      startTime: selectedTimeSlot,
      note: '',
    });
    if (!validation.success) {
      setErrorMsg(validation.error.issues[0].message);
      return;
    }

    setSubmitting(true);

    try {
      const firstItem = items[0];
      if (!firstItem?.deal.serviceId) {
        throw new Error('Dịch vụ chưa được đồng bộ với hệ thống. Vui lòng chọn lại từ trang dịch vụ.');
      }
      const booking = await beautyApi.createBooking({
        serviceId: firstItem.deal.serviceId,
        practitionerId: directService?.practitioners?.[0]?.id,
        appointmentDate: selectedDate,
        startTime: selectedTimeSlot,
        note: `Thanh toán ${depositOption === 'deposit50' ? 'cọc 50%' : '100%'} qua PayOS`,
      });
      const payment = await beautyApi.createPayOSPayment(booking.id, {
        paymentOption: depositOption === 'deposit50' ? 'DEPOSIT_50' : 'FULL_100',
        voucherCode: appliedVoucher?.code,
      });
      if (!payment.checkoutUrl) {
        throw new Error('PayOS không trả về đường dẫn thanh toán hợp lệ.');
      }
      sessionStorage.setItem('beautylink_payos_order_code', String(payment.orderCode));
      window.location.assign(payment.checkoutUrl);
    } catch (err: any) {
      setErrorMsg(getApiErrorMessage(err, 'Có lỗi xảy ra khi tạo giao dịch PayOS. Vui lòng thử lại.'));
    } finally {
      setSubmitting(false);
    }
  };

  // =========================================================================
  // VIEW: EMPTY CART
  // =========================================================================
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[#FFF8F9] py-12 px-4 sm:px-6">
        <div className="max-w-md mx-auto text-center bg-white rounded-3xl border border-pink-100 p-8 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-pink-50 text-[#e1146c] flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Chưa có dịch vụ nào để thanh toán</h2>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            Bạn chưa chọn dịch vụ làm đẹp nào. Hãy khám phá và chọn dịch vụ ưng ý nhé!
          </p>
          <button
            type="button"
            onClick={onBack}
            className="mt-6 w-full py-3 rounded-full bg-gradient-to-r from-[#e1146c] to-[#be185d] text-white text-xs font-bold shadow-md hover:opacity-95 transition cursor-pointer flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Khám phá dịch vụ sắc đẹp</span>
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW: REDESIGNED STEPPER CHECKOUT FLOW
  // =========================================================================
  return (
    <div className="min-h-screen bg-[#FFF8F9] text-slate-900 pb-16">
      {/* Top Bar with Navigation */}
      <section className="bg-white border-b border-pink-100 shadow-2xs">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:px-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              if (currentStep > 1) {
                setCurrentStep((prev) => (prev - 1) as any);
              } else {
                onBack();
              }
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#e1146c] transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{currentStep > 1 ? 'Quay lại bước trước' : 'Quay lại'}</span>
          </button>

          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Thanh toán bảo mật tức thì</span>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 py-6 sm:px-6">
        {/* Step Progress Header */}
        <div className="mb-7">
          <div className="flex items-center justify-between max-w-xl mx-auto mb-3">
            {/* Step 1 */}
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="flex items-center gap-2 text-left cursor-pointer group"
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition ${
                  currentStep === 1
                    ? 'bg-[#e1146c] text-white shadow-sm shadow-pink-500/30'
                    : currentStep > 1
                    ? 'bg-emerald-500 text-white'
                    : 'bg-pink-100 text-[#be185d]'
                }`}
              >
                {currentStep > 1 ? <Check className="w-4 h-4" /> : '1'}
              </div>
              <div className="hidden sm:block">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Bước 1</span>
                <span className={`text-xs font-bold ${currentStep === 1 ? 'text-[#e1146c]' : 'text-slate-700'}`}>
                  Lịch hẹn & Hồ sơ
                </span>
              </div>
            </button>

            <div className={`h-0.5 flex-1 mx-3 transition-colors ${currentStep >= 2 ? 'bg-pink-500' : 'bg-pink-200'}`} />

            {/* Step 2 */}
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="flex items-center gap-2 text-left cursor-pointer group"
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition ${
                  currentStep === 2
                    ? 'bg-[#e1146c] text-white shadow-sm shadow-pink-500/30'
                    : currentStep > 2
                    ? 'bg-emerald-500 text-white'
                    : 'bg-pink-100 text-slate-500'
                }`}
              >
                {currentStep > 2 ? <Check className="w-4 h-4" /> : '2'}
              </div>
              <div className="hidden sm:block">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Bước 2</span>
                <span className={`text-xs font-bold ${currentStep === 2 ? 'text-[#e1146c]' : 'text-slate-700'}`}>
                  Hình thức thanh toán
                </span>
              </div>
            </button>

            <div className={`h-0.5 flex-1 mx-3 transition-colors ${currentStep === 3 ? 'bg-pink-500' : 'bg-pink-200'}`} />

            {/* Step 3 */}
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="flex items-center gap-2 text-left cursor-pointer group"
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition ${
                  currentStep === 3
                    ? 'bg-[#e1146c] text-white shadow-sm shadow-pink-500/30'
                    : 'bg-pink-100 text-slate-500'
                }`}
              >
                3
              </div>
              <div className="hidden sm:block">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Bước 3</span>
                <span className={`text-xs font-bold ${currentStep === 3 ? 'text-[#e1146c]' : 'text-slate-700'}`}>
                  Tóm tắt & Giảm giá
                </span>
              </div>
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs sm:text-sm font-semibold text-rose-700 flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 1: HỒ SƠ XÁC THỰC & CHỌN NGÀY / KHUNG GIỜ */}
        {/* ========================================================================= */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* 1. Verified Customer Card - NO INPUT REQUIRED */}
            <div className="bg-white rounded-3xl border border-pink-100 p-5 sm:p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#e1146c] to-[#be185d] text-white flex items-center justify-center font-black text-base shadow-sm shrink-0">
                    {currentUser?.name ? getInitials(currentUser.name) : 'BL'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base sm:text-lg font-black text-slate-900">
                        {currentUser?.name || 'Khách hàng BeautyPass'}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 fill-emerald-100" />
                        <span>Đã xác thực danh tính</span>
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                      <span>SĐT: <strong className="text-slate-700">{currentUser?.phone || '0988 888 888'}</strong></span>
                      <span>·</span>
                      <span>Email: <strong className="text-slate-700">{currentUser?.email || 'verified.member@beautylink.vn'}</strong></span>
                    </p>
                  </div>
                </div>

                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200/80 shrink-0 self-start sm:self-auto">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Dữ liệu đã tự động đồng bộ</span>
                </div>
              </div>
            </div>

            {/* 2. Schedule: Date & Time Slot (Handled 2 Cases) */}
            <div className="bg-white rounded-3xl border border-pink-100 p-6 sm:p-7 shadow-xs">
              <div className="pb-4 border-b border-pink-50 mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#e1146c]" />
                    <span>Ngày & Khung giờ đến làm đẹp</span>
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Khóa lịch riêng không phải xếp hàng chờ đợi
                  </p>
                </div>

                {/* If preselected, allow toggling edit */}
                {isPreselected && !isChangingSchedule && (
                  <button
                    type="button"
                    onClick={() => setIsChangingSchedule(true)}
                    className="text-xs font-bold text-[#e1146c] hover:underline cursor-pointer"
                  >
                    Chọn lại giờ khác
                  </button>
                )}
              </div>

              {/* CASE 2: Preselected from Beauty Service Page -> Display directly locked */}
              {isPreselected && !isChangingSchedule ? (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-pink-50/90 via-rose-50/50 to-pink-50/90 border border-pink-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-white text-[#e1146c] border border-pink-200 flex items-center justify-center font-bold shrink-0 shadow-2xs">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-black uppercase text-[#be185d]">
                            Lịch hẹn đã chọn trước tại dịch vụ
                          </span>
                          <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.2 rounded-full">
                            ✓ Sẵn sàng
                          </span>
                        </div>
                        <div className="text-sm sm:text-base font-black text-slate-900 mt-0.5 flex items-center gap-3 flex-wrap">
                          <span>📅 Ngày hẹn: <strong className="text-[#e1146c]">{selectedDate}</strong></span>
                          <span>⏰ Khung giờ: <strong className="text-[#e1146c]">{selectedTimeSlot}</strong></span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsChangingSchedule(true)}
                      className="px-3 py-1.5 rounded-xl bg-white border border-pink-200 hover:border-[#e1146c] text-xs font-bold text-slate-700 hover:text-[#e1146c] transition cursor-pointer self-start sm:self-auto shadow-2xs"
                    >
                      Đổi ngày/giờ
                    </button>
                  </div>
                </div>
              ) : (
                /* CASE 1: Selecting inside Checkout Page */
                <div className="space-y-5 text-xs">
                  <div>
                    <label className="block font-bold text-slate-800 mb-2">
                      Chọn ngày làm dịch vụ:
                    </label>
                    <div className="flex gap-2 flex-wrap mb-2.5">
                      {[
                        { label: 'Hôm nay', val: new Date().toISOString().split('T')[0] },
                        { label: 'Ngày mai', val: tomorrow },
                        {
                          label: 'Ngày kia',
                          val: (() => {
                            const d = new Date();
                            d.setDate(d.getDate() + 2);
                            return d.toISOString().split('T')[0];
                          })(),
                        },
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => { setSelectedDate(item.val); setScheduleErrors((value) => ({ ...value, appointmentDate: '' })); }}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                            selectedDate === item.val
                              ? 'bg-[#e1146c] text-white border-[#e1146c] shadow-xs'
                              : 'bg-pink-50/50 text-slate-700 border-pink-200 hover:bg-pink-100'
                          }`}
                        >
                          {item.label} ({item.val.split('-').slice(1).reverse().join('/')})
                        </button>
                      ))}
                    </div>

                    <input
                      type="date"
                      min={new Date().toISOString().split('T')[0]}
                      value={selectedDate}
                      onChange={(e) => { setSelectedDate(e.target.value); setScheduleErrors((value) => ({ ...value, appointmentDate: '' })); }}
                      aria-invalid={Boolean(scheduleErrors.appointmentDate)}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-pink-200 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:border-[#e1146c]"
                    />
                    <FieldError message={scheduleErrors.appointmentDate} />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-2">
                      Chọn khung giờ hẹn phù hợp:
                    </label>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {['09:00', '10:00', '11:30', '13:30', '14:30', '15:30', '16:30', '17:30', '18:30', '19:30', '20:00'].map(
                        (slot) => {
                          const isSelected = selectedTimeSlot === slot;
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => { setSelectedTimeSlot(slot); setScheduleErrors((value) => ({ ...value, startTime: '' })); }}
                              className={`py-2 px-1 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                                isSelected
                                  ? 'bg-[#e1146c] text-white border-[#e1146c] shadow-xs'
                                  : 'bg-pink-50/30 text-slate-700 border-pink-200 hover:bg-pink-50'
                              }`}
                            >
                              {slot}
                            </button>
                          );
                        }
                      )}
                    </div>
                    <FieldError message={scheduleErrors.startTime} />
                  </div>
                </div>
              )}
            </div>

            {/* Step 1 Next Button */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleContinueFromSchedule}
                className="py-3.5 px-6 rounded-full bg-gradient-to-r from-[#e1146c] to-[#be185d] text-white text-xs sm:text-sm font-black shadow-md hover:opacity-95 transition flex items-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                <span>Tiếp tục: Chọn hình thức thanh toán</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: HÌNH THỨC THANH TOÁN (CỌC 50% HOẶC 100%) & PHƯƠNG THỨC */}
        {/* ========================================================================= */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* 1. Deposit Option Selection (Bắt buộc chọn cọc 50% hoặc toàn bộ) */}
            <div className="bg-white rounded-3xl border border-pink-100 p-6 sm:p-7 shadow-xs">
              <div className="pb-4 border-b border-pink-50 mb-5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#e1146c]">
                  Chính sách thanh toán giữ chỗ
                </span>
                <h2 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                  Bạn muốn đặt cọc 50% hay thanh toán toàn bộ 100%?
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Chọn hình thức phù hợp với kế hoạch chi tiêu của bạn
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Option 1: Cọc 50% */}
                <div
                  onClick={() => setDepositOption('deposit50')}
                  className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                    depositOption === 'deposit50'
                      ? 'border-[#e1146c] bg-pink-50/40 shadow-sm'
                      : 'border-pink-200 bg-white hover:bg-pink-50/20'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black uppercase text-[#be185d] bg-pink-100 px-2.5 py-0.5 rounded-full">
                        Khuyên dùng
                      </span>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          depositOption === 'deposit50' ? 'border-[#e1146c] bg-[#e1146c]' : 'border-slate-300'
                        }`}
                      >
                        {depositOption === 'deposit50' && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </div>

                    <h3 className="text-base font-black text-slate-900">
                      Đặt cọc 50% giữ chỗ
                    </h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Thanh toán trước 50% để giữ lịch hẹn và phòng dịch vụ. 50% còn lại thanh toán tại cơ sở khi trải nghiệm.
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-pink-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Cần trả hôm nay:</span>
                    <strong className="text-base font-black text-[#e1146c]">
                      {formatCurrency(amountDueNow)}
                    </strong>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 flex justify-between">
                    <span>Còn lại tại salon:</span>
                    <span className="font-bold text-slate-700">{formatCurrency(remainingAtSalon)} (50% sau giảm giá)</span>
                  </div>
                </div>

                {/* Option 2: Thanh toán 100% */}
                <div
                  onClick={() => setDepositOption('full100')}
                  className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                    depositOption === 'full100'
                      ? 'border-[#e1146c] bg-pink-50/40 shadow-sm'
                      : 'border-pink-200 bg-white hover:bg-pink-50/20'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black uppercase text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                        Trọn gói tiện lợi
                      </span>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          depositOption === 'full100' ? 'border-[#e1146c] bg-[#e1146c]' : 'border-slate-300'
                        }`}
                      >
                        {depositOption === 'full100' && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </div>

                    <h3 className="text-base font-black text-slate-900">
                      Thanh toán toàn bộ 100%
                    </h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Thanh toán trọn gói không lo phát sinh. Đến chỉ cần đọc mã check-in thư giãn trọn vẹn liệu trình.
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-pink-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Cần trả hôm nay:</span>
                    <strong className="text-base font-black text-[#e1146c]">
                      {formatCurrency(totalBillAfterDiscount)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Digital Payment Methods Selection */}
            <div className="bg-white rounded-3xl border border-pink-100 p-6 sm:p-7 shadow-xs">
              <div className="pb-4 border-b border-pink-50 mb-5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#e1146c]">
                  Kênh thanh toán trực tuyến
                </span>
                <h2 className="text-base font-bold text-slate-900 mt-0.5">
                  Phương thức thanh toán
                </h2>
              </div>

              <div className="space-y-3">
                <div className="w-full p-4 rounded-2xl border border-[#e1146c] bg-pink-50/40 ring-1 ring-[#e1146c] text-left">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
                        <QrCode className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-bold text-slate-900">Thanh toán qua PayOS</span>
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            Khuyên dùng
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">VietQR / chuyển khoản ngân hàng trên trang thanh toán PayOS.</p>
                      </div>
                    </div>
                    <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 border-[#e1146c] bg-[#e1146c]">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  </div>
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800">
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>BeautyLink không lưu thông tin ngân hàng. Trạng thái được xác thực tự động bằng webhook có chữ ký và đối soát trực tiếp với PayOS.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2 Actions */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="py-3 px-5 rounded-full bg-white border border-pink-200 text-slate-700 text-xs font-bold hover:bg-pink-50 transition cursor-pointer flex items-center gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Quay lại</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="py-3.5 px-6 rounded-full bg-gradient-to-r from-[#e1146c] to-[#be185d] text-white text-xs sm:text-sm font-black shadow-md hover:opacity-95 transition flex items-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                <span>Tiếp tục: Tóm tắt dịch vụ & Mã giảm giá</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: TÓM TẮT DỊCH VỤ & MÃ GIẢM GIÁ (TÁCH RIÊNG KHÔNG GỘP CHUNG) */}
        {/* ========================================================================= */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* 1. Services Summary List Card */}
            <div className="bg-white rounded-3xl border border-pink-100 p-6 sm:p-7 shadow-xs">
              <div className="pb-4 border-b border-pink-50 mb-4 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#e1146c]">
                    Danh sách đơn đặt
                  </span>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                    Tóm tắt dịch vụ đã chọn ({items.length})
                  </h2>
                </div>
                <span className="text-xs font-bold text-slate-500">
                  Lịch: {selectedDate} lúc {selectedTimeSlot}
                </span>
              </div>

              <div className="divide-y divide-pink-50">
                {items.map((it) => (
                  <div key={it.deal.id} className="py-3.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 bg-pink-50 border border-pink-100 shadow-2xs">
                        <OptimizedImage
                          src={it.deal.image}
                          alt={it.deal.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {it.deal.title}
                        </h4>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <Store className="w-3.5 h-3.5 text-[#e1146c] shrink-0" />
                          <span className="truncate font-semibold">{it.deal.brandName}</span>
                          <span>·</span>
                          <span>{it.deal.duration}</span>
                        </p>
                        <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                          Đã xếp chuyên viên & phòng dịch vụ
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm sm:text-base font-black text-[#e1146c]">
                        {formatCurrency(it.deal.salePrice * it.quantity)}
                      </div>
                      {it.quantity > 1 && (
                        <span className="text-[11px] text-slate-400 font-semibold">
                          Số lượng: x{it.quantity}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Voucher & Promo Code Card */}
            <div className="bg-white rounded-3xl border border-pink-100 p-6 sm:p-7 shadow-xs">
              <div className="pb-3 border-b border-pink-50 mb-4">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-[#e1146c]" />
                  <span>Mã giảm giá & Khuyến mãi (Voucher)</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Áp dụng coupon để trừ trực tiếp vào tổng bill
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={voucherCodeInput}
                  onChange={(e) => { setVoucherCodeInput(e.target.value.toUpperCase()); setVoucherError(''); }}
                  maxLength={40}
                  aria-invalid={Boolean(voucherError)}
                  aria-describedby="checkout-voucher-error"
                  placeholder="Nhập mã voucher (VD: BEAUTY50)"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-pink-200 bg-pink-50/20 text-xs sm:text-sm uppercase font-black text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#e1146c]"
                />
                <button
                  type="button"
                  onClick={() => handleApplyVoucher()}
                  className="px-5 py-2.5 rounded-xl bg-pink-100 hover:bg-pink-200 text-[#be185d] text-xs font-bold transition cursor-pointer"
                >
                  Áp dụng
                </button>
              </div>

              {voucherError && (
                <p id="checkout-voucher-error" role="alert" className="text-[11px] font-semibold text-rose-500 mt-2">{voucherError}</p>
              )}

              {/* Applied Voucher banner */}
              {appliedVoucher && (
                <div className="mt-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <div>
                      <strong className="font-bold">{appliedVoucher.code}</strong>
                      <span className="text-[11px] ml-2 text-emerald-700">({appliedVoucher.description})</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-[#e1146c]">
                      -{formatCurrency(appliedVoucher.discountAmount)}
                    </span>
                    <button
                      type="button"
                      onClick={handleRemoveVoucher}
                      className="text-rose-500 hover:text-rose-700 text-xs font-bold cursor-pointer underline ml-2"
                    >
                      Bỏ
                    </button>
                  </div>
                </div>
              )}

              {/* Quick voucher chips */}
              <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-pink-50">
                <span className="text-[11px] font-bold text-slate-400 self-center">Mã hot:</span>
                {AVAILABLE_VOUCHERS.map((v) => (
                  <button
                    key={v.code}
                    type="button"
                    onClick={() => handleApplyVoucher(v.code)}
                    className="px-2.5 py-1 rounded-lg bg-pink-50 hover:bg-pink-100 text-[11px] font-bold text-[#be185d] border border-pink-200 transition cursor-pointer"
                  >
                    +{v.code} ({v.type === 'fixed' ? `-${formatCurrency(v.discount as number)}` : '-15%'})
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Final Bill Breakdown Card */}
            <div className="bg-white rounded-3xl border border-pink-100 p-6 sm:p-7 shadow-xs">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 pb-3 border-b border-pink-50">
                Bảng tính số tiền thanh toán
              </h3>

              <div className="space-y-2.5 text-xs text-slate-600 pt-3">
                <div className="flex justify-between">
                  <span>Tổng giá gốc dịch vụ ({items.length} dịch vụ):</span>
                  <span className="font-bold text-slate-800">{formatCurrency(subtotal)}</span>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between text-[#e1146c] font-semibold">
                    <span>Voucher giảm giá ({appliedVoucher?.code}):</span>
                    <span className="font-bold">-{formatCurrency(discountAmount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-slate-600">
                  <span>Tổng sau giảm giá:</span>
                  <span className="font-bold text-slate-800">{formatCurrency(discountedTotal)}</span>
                </div>

                <div className="flex justify-between pb-2 border-b border-pink-50">
                  <span>Hình thức đã chọn:</span>
                  <span className="font-bold text-slate-800">
                    {depositOption === 'deposit50' ? 'Đặt cọc 50% giữ chỗ' : 'Thanh toán trọn gói 100%'}
                  </span>
                </div>

                {/* Amount Due Now */}
                <div className="p-4 rounded-2xl bg-pink-50/70 border border-pink-100 flex items-center justify-between text-slate-900">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider font-bold text-[#be185d] block">
                      Số tiền cần thanh toán ngay hôm nay
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-[#e1146c]">
                      {formatCurrency(amountDueNow)}
                    </span>
                  </div>

                  {depositOption === 'deposit50' && (
                    <div className="text-right">
                      <span className="text-[11px] text-slate-500 block">Thanh toán tại salon sau (gốc 50%):</span>
                      <strong className="text-sm text-slate-800 font-black">
                        {formatCurrency(remainingAtSalon)}
                      </strong>
                      <span className="text-[10px] text-slate-400 block font-medium">
                        (không áp dụng giảm giá)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Guarantees */}
              <div className="mt-4 pt-3 border-t border-pink-50 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-500">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Đổi dời lịch miễn phí trước 2 tiếng</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Trạng thái được xác thực trực tiếp với PayOS</span>
                </div>
              </div>

              {/* Final Submit Button */}
              <div className="mt-6 pt-4 border-t border-pink-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="w-full sm:w-auto py-3 px-5 rounded-full bg-white border border-pink-200 text-slate-700 text-xs font-bold hover:bg-pink-50 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Sửa phương thức</span>
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleFinalSubmit}
                  className="w-full sm:flex-1 py-3.5 px-6 rounded-full bg-gradient-to-r from-[#e1146c] via-[#db2777] to-[#be185d] text-white text-xs sm:text-sm font-black shadow-lg shadow-pink-600/30 hover:opacity-95 active:scale-98 transition flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer disabled:opacity-50"
                >
                  <Lock className="w-4 h-4" />
                  <span>
                    {submitting
                      ? 'Đang tiến hành xử lý...'
                      : `Xác nhận thanh toán ${formatCurrency(amountDueNow)}`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
