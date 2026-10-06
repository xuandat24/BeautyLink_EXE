import { z } from 'zod';

export type FieldErrors = Record<string, string>;

export const vietnamPhoneSchema = z
  .string()
  .trim()
  .regex(/^0(?:3|8|9)[0-9]{8}$/, 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 03, 08 hoặc 09');

export const strongPasswordSchema = z
  .string()
  .min(12, 'Mật khẩu phải có ít nhất 12 ký tự')
  .max(72, 'Mật khẩu tối đa 72 ký tự')
  .regex(/[a-z]/, 'Mật khẩu phải có ít nhất một chữ thường')
  .regex(/[A-Z]/, 'Mật khẩu phải có ít nhất một chữ hoa')
  .regex(/[0-9]/, 'Mật khẩu phải có ít nhất một chữ số')
  .regex(/[^A-Za-z0-9\s]/, 'Mật khẩu phải có ít nhất một ký tự đặc biệt')
  .regex(/^\S+$/, 'Mật khẩu không được chứa khoảng trắng');

const fullNameSchema = z
  .string()
  .trim()
  .min(2, 'Họ tên phải có ít nhất 2 ký tự')
  .max(120, 'Họ tên tối đa 120 ký tự')
  .regex(/^\p{L}+(?:\s+\p{L}+)*$/u, 'Họ tên chỉ được chứa chữ cái và khoảng trắng');

const birthDateSchema = z.string().min(1, 'Vui lòng nhập ngày sinh').refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const today = new Date();
  return year >= 1900 && year <= today.getFullYear()
    && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    && date.getTime() < Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + 1);
}, 'Ngày sinh không hợp lệ hoặc không tồn tại');

export const customerAuthSchema = z
  .object({
    mode: z.enum(['login', 'register']),
    fullName: z.string(),
    identifier: z.string().trim().min(1, 'Vui lòng nhập số điện thoại hoặc email').max(254, 'Thông tin đăng nhập quá dài'),
    email: z.string(),
    password: z.string().min(1, 'Vui lòng nhập mật khẩu').max(72, 'Mật khẩu tối đa 72 ký tự'),
    confirmPassword: z.string(),
    gender: z.string(),
    dateOfBirth: z.string(),
    verificationChannel: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === 'login') {
      const identifier = data.identifier.trim();
      const valid = identifier.includes('@')
        ? z.string().email().safeParse(identifier).success
        : vietnamPhoneSchema.safeParse(identifier).success;
      if (!valid) ctx.addIssue({ code: 'custom', path: ['identifier'], message: 'Nhập email hợp lệ hoặc số điện thoại 10 chữ số bắt đầu bằng 03, 08, 09' });
      return;
    }
    const name = fullNameSchema.safeParse(data.fullName);
    if (!name.success) ctx.addIssue({ code: 'custom', path: ['fullName'], message: name.error.issues[0].message });
    const phone = vietnamPhoneSchema.safeParse(data.identifier);
    if (!phone.success) ctx.addIssue({ code: 'custom', path: ['identifier'], message: phone.error.issues[0].message });
    const parsedEmail = z.string().trim().min(1).email().max(254).safeParse(data.email);
    if (!parsedEmail.success) ctx.addIssue({ code: 'custom', path: ['email'], message: 'Email là bắt buộc và phải đúng định dạng' });
    const parsedPassword = strongPasswordSchema.safeParse(data.password);
    if (!parsedPassword.success) ctx.addIssue({ code: 'custom', path: ['password'], message: parsedPassword.error.issues[0].message });
    if (data.password !== data.confirmPassword) ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Mật khẩu xác nhận chưa khớp' });
    if (!['MALE', 'FEMALE', 'OTHER'].includes(data.gender)) ctx.addIssue({ code: 'custom', path: ['gender'], message: 'Vui lòng chọn giới tính' });
    const birthDate = birthDateSchema.safeParse(data.dateOfBirth);
    if (!birthDate.success) ctx.addIssue({ code: 'custom', path: ['dateOfBirth'], message: birthDate.error.issues[0].message });
    if (!['PHONE', 'EMAIL'].includes(data.verificationChannel)) ctx.addIssue({ code: 'custom', path: ['verificationChannel'], message: 'Vui lòng chọn kênh nhận OTP' });
  });

export const customerProfileSchema = z.object({
  name: z.string().trim().min(2, 'Họ tên phải có ít nhất 2 ký tự').max(120, 'Họ tên tối đa 120 ký tự'),
  phone: vietnamPhoneSchema,
  email: z.string().trim().email('Email không đúng định dạng').max(254, 'Email tối đa 254 ký tự'),
  address: z.string().trim().min(5, 'Địa chỉ phải có ít nhất 5 ký tự').max(255, 'Địa chỉ tối đa 255 ký tự'),
  citizenId: z.string().trim().regex(/^[0-9]{12}$/, 'CCCD phải gồm đúng 12 chữ số'),
  gender: z.enum(['Nam', 'Nữ', 'Others'], { message: 'Giới tính không hợp lệ' }),
  dateOfBirth: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Ngày sinh phải theo định dạng DD/MM/YYYY').refine((value) => {
    const [day, month, year] = value.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day && date < new Date();
  }, 'Ngày sinh không hợp lệ'),
  avatar: z.string().optional(),
});

export const adminReportSchema = z
  .object({
    status: z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED'], { message: 'Trạng thái không hợp lệ' }),
    note: z.string().trim().max(1000, 'Ghi chú xử lý tối đa 1000 ký tự'),
  })
  .superRefine((data, ctx) => {
    if ((data.status === 'RESOLVED' || data.status === 'REJECTED') && !data.note) {
      ctx.addIssue({ code: 'custom', path: ['note'], message: 'Cần nhập ghi chú khi hoàn tất hoặc từ chối báo cáo' });
    }
  });

export const bookingSchema = z.object({
  appointmentDate: z.string().min(1, 'Vui lòng chọn ngày hẹn').refine((value) => {
    const selected = new Date(`${value}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selected >= today;
  }, 'Ngày hẹn không được ở trong quá khứ'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Khung giờ không hợp lệ'),
  note: z.string().trim().max(500, 'Ghi chú tối đa 500 ký tự'),
});

export const supportReportSchema = z.object({
  reason: z.string().trim().min(2, 'Tiêu đề phải có ít nhất 2 ký tự').max(120, 'Tiêu đề tối đa 120 ký tự'),
  details: z.string().trim().min(10, 'Nội dung phải có ít nhất 10 ký tự').max(1500, 'Nội dung tối đa 1500 ký tự'),
});

export const voucherCodeSchema = z
  .string()
  .trim()
  .min(3, 'Mã voucher phải có ít nhất 3 ký tự')
  .max(40, 'Mã voucher tối đa 40 ký tự')
  .regex(/^[A-Za-z0-9_-]+$/, 'Mã voucher chỉ được chứa chữ, số, dấu gạch ngang hoặc gạch dưới')
  .transform((value) => value.toUpperCase());

export const avatarUrlSchema = z
  .string()
  .trim()
  .max(2048, 'Đường dẫn ảnh tối đa 2048 ký tự')
  .url('Đường dẫn ảnh không hợp lệ')
  .refine((value) => /^https?:\/\//i.test(value), 'Ảnh phải dùng đường dẫn HTTP hoặc HTTPS');

export const communityCommentSchema = z
  .string()
  .trim()
  .min(3, 'Nội dung phải có ít nhất 3 ký tự')
  .max(500, 'Nội dung tối đa 500 ký tự');

export const homepageReviewSchema = z.object({
  author: z.string().trim().min(2, 'Họ tên phải có ít nhất 2 ký tự').max(120, 'Họ tên tối đa 120 ký tự'),
  salon: z.string().trim().min(2, 'Vui lòng chọn cơ sở làm đẹp').max(160, 'Tên cơ sở tối đa 160 ký tự'),
  service: z.string().trim().min(2, 'Tên dịch vụ phải có ít nhất 2 ký tự').max(160, 'Tên dịch vụ tối đa 160 ký tự'),
  rating: z.number().int().min(1, 'Vui lòng chọn số sao').max(5, 'Đánh giá tối đa 5 sao'),
  content: z.string().trim().min(10, 'Cảm nhận phải có ít nhất 10 ký tự').max(1500, 'Cảm nhận tối đa 1500 ký tự'),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại').max(72, 'Mật khẩu tối đa 72 ký tự'),
    newPassword: z.string().min(8, 'Mật khẩu mới phải có ít nhất 8 ký tự').max(72, 'Mật khẩu tối đa 72 ký tự'),
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu mới'),
  })
  .superRefine((data, ctx) => {
    if (!/[A-Za-z]/.test(data.newPassword) || !/[0-9]/.test(data.newPassword)) {
      ctx.addIssue({ code: 'custom', path: ['newPassword'], message: 'Mật khẩu mới phải có ít nhất một chữ cái và một chữ số' });
    }
    if (data.currentPassword === data.newPassword) {
      ctx.addIssue({ code: 'custom', path: ['newPassword'], message: 'Mật khẩu mới phải khác mật khẩu hiện tại' });
    }
    if (data.newPassword !== data.confirmPassword) {
      ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Mật khẩu xác nhận chưa khớp' });
    }
  });

export function zodFieldErrors(error: z.ZodError): FieldErrors {
  const fields: FieldErrors = {};
  error.issues.forEach((issue) => {
    const key = issue.path[0]?.toString() || 'form';
    if (!fields[key]) fields[key] = issue.message;
  });
  return fields;
}
