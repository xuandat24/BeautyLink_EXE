import { z } from 'zod';

export type FieldErrors = Record<string, string>;

export const vietnamPhoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s.-]/g, ''))
  .pipe(z.string().regex(/^(0|\+84)(3|5|7|8|9)[0-9]{8}$/, 'Số điện thoại Việt Nam không hợp lệ'));

export const customerAuthSchema = z
  .object({
    mode: z.enum(['login', 'register']),
    fullName: z.string().trim().max(120, 'Họ tên tối đa 120 ký tự'),
    identifier: z.string().trim().min(1, 'Vui lòng nhập số điện thoại hoặc email').max(254, 'Thông tin đăng nhập quá dài'),
    email: z.string().trim().max(254, 'Email tối đa 254 ký tự'),
    password: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự').max(72, 'Mật khẩu tối đa 72 ký tự'),
    confirmPassword: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === 'login') return;
    if (data.fullName.length < 2) ctx.addIssue({ code: 'custom', path: ['fullName'], message: 'Họ tên phải có ít nhất 2 ký tự' });
    const phone = vietnamPhoneSchema.safeParse(data.identifier);
    if (!phone.success) ctx.addIssue({ code: 'custom', path: ['identifier'], message: phone.error.issues[0].message });
    if (data.email && !z.string().email().safeParse(data.email).success) ctx.addIssue({ code: 'custom', path: ['email'], message: 'Email không đúng định dạng' });
    if (!/[A-Za-z]/.test(data.password) || !/[0-9]/.test(data.password)) {
      ctx.addIssue({ code: 'custom', path: ['password'], message: 'Mật khẩu phải có ít nhất một chữ cái và một chữ số' });
    }
    if (data.password !== data.confirmPassword) ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Mật khẩu xác nhận chưa khớp' });
  });

export const customerProfileSchema = z.object({
  name: z.string().trim().min(2, 'Họ tên phải có ít nhất 2 ký tự').max(120, 'Họ tên tối đa 120 ký tự'),
  phone: vietnamPhoneSchema,
  email: z.string().trim().email('Email không đúng định dạng').max(254, 'Email tối đa 254 ký tự'),
  address: z.string().trim().min(5, 'Địa chỉ phải có ít nhất 5 ký tự').max(255, 'Địa chỉ tối đa 255 ký tự'),
  citizenId: z.string().trim().regex(/^[0-9]{12}$/, 'CCCD phải gồm đúng 12 chữ số'),
  gender: z.enum(['Nam', 'Nữ', 'Khác'], { message: 'Giới tính không hợp lệ' }),
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
