export interface CategoryShortcut {
  label: string;
  caption: string;
  icon: string;
}

const defaultShortcuts: CategoryShortcut[] = [
  { label: 'Dịch vụ nổi bật', caption: 'Được yêu thích nhất', icon: '🌷' },
  { label: 'Gói trải nghiệm', caption: 'Dành cho khách mới', icon: '🎁' },
  { label: 'Chăm sóc chuyên sâu', caption: 'Tư vấn theo nhu cầu', icon: '🌷' },
  { label: 'Ưu đãi hôm nay', caption: 'Đặt lịch giá tốt', icon: '🏷️' },
];

export const categoryShortcuts: Record<string, CategoryShortcut[]> = {
  makeup: [
    { label: 'Trang điểm cô dâu', caption: 'Rạng rỡ ngày trọng đại', icon: '👰' },
    { label: 'Trang điểm sự kiện', caption: 'Tiệc, lễ và sân khấu', icon: '💄' },
    { label: 'Makeup cá nhân', caption: 'Phong cách riêng của bạn', icon: '💄' },
    { label: 'Makeup chụp ảnh', caption: 'Lên hình thật nổi bật', icon: '📸' },
  ],
  hair: [
    { label: 'Cắt & tạo kiểu', caption: 'Kiểu tóc hợp khuôn mặt', icon: '✂️' },
    { label: 'Nhuộm thời trang', caption: 'Màu tóc mới, chuẩn gu', icon: '🎨' },
    { label: 'Uốn & duỗi', caption: 'Tạo nếp bền đẹp', icon: '〰️' },
    { label: 'Phục hồi tóc', caption: 'Mềm mượt và chắc khỏe', icon: '🌿' },
  ],
  spa: [
    { label: 'Massage toàn thân', caption: 'Thả lỏng và thư giãn', icon: '💆' },
    { label: 'Gội đầu dưỡng sinh', caption: 'Nhẹ đầu, khỏe tóc', icon: '🫧' },
    { label: 'Chăm sóc body', caption: 'Tái tạo năng lượng', icon: '🧖' },
    { label: 'Spa thảo dược', caption: 'Liệu pháp từ thiên nhiên', icon: '🌿' },
  ],
  nails: [
    { label: 'Sơn gel', caption: 'Bền màu, bóng đẹp', icon: '💅' },
    { label: 'Nail art', caption: 'Thiết kế theo phong cách', icon: '🎨' },
    { label: 'Chăm sóc móng', caption: 'Móng khỏe và gọn đẹp', icon: '🌸' },
    { label: 'Nối mi', caption: 'Ánh nhìn tự nhiên', icon: '👁️' },
  ],
  skincare: [
    { label: 'Điều trị mụn', caption: 'Phác đồ theo tình trạng da', icon: '🫧' },
    { label: 'Phục hồi da', caption: 'Củng cố hàng rào bảo vệ', icon: '🛡️' },
    { label: 'Làm sáng da', caption: 'Đều màu và rạng rỡ', icon: '☀️' },
    { label: 'Trẻ hóa da', caption: 'Săn chắc và tươi mới', icon: '🌷' },
  ],
};

export const getCategoryShortcuts = (slug: string) => categoryShortcuts[slug] || defaultShortcuts;

export const popularBeautyNeeds = ['Cô dâu', 'Thư giãn', 'Điều trị mụn', 'Tạo kiểu tóc', 'Sơn gel', 'Chăm sóc tại nhà'];
