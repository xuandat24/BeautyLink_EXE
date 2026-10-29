import { useState } from 'react';
import type { CommunityPost } from '../../types/community';
import { PUBLIC_ORIGIN } from '../../lib/publicSharing';
import { communityPath } from '../../lib/communityNavigation';
import { CommunityDialog } from './communityUi';
export function CommunityShareDialog({ post, onClose }: { post: CommunityPost; onClose: () => void }) {
  const [message, setMessage] = useState('');
  const url = `${PUBLIC_ORIGIN}${communityPath(post.id)}`;
  const copy = async () => { try { if (!navigator.clipboard) throw new Error(); await navigator.clipboard.writeText(url); setMessage('Đã sao chép liên kết.'); } catch { setMessage('Chọn liên kết bên dưới để sao chép thủ công.'); } };
  const native = async () => { if (!navigator.share) { await copy(); return; } try { await navigator.share({ title: 'BeautyLink Community', text: 'Bài chia sẻ trên BeautyLink Community', url }); setMessage('Đã đóng giao diện chia sẻ. BeautyLink không xác nhận việc đăng lên mạng xã hội.'); } catch (e) { if ((e as Error).name !== 'AbortError') setMessage('Chưa mở được chia sẻ. Bạn có thể sao chép liên kết.'); } };
  return <CommunityDialog title="Chia sẻ bài viết" onClose={onClose}><p className="mb-4 text-sm text-slate-600">Chia sẻ liên kết công khai. Người nhận chỉ xem được khi bài viết còn được xuất bản.</p><div className="flex flex-wrap gap-2">
    <button type="button" onClick={() => void native()} className="community-button">Chia sẻ qua thiết bị</button>
    <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" className="community-button-secondary">Facebook</a>
    <a href={`https://t.me/share/url?url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" className="community-button-secondary">Telegram</a>
    <button type="button" onClick={() => void copy()} className="community-button-secondary">Sao chép liên kết</button>
    <button type="button" onClick={() => void copy()} className="community-button-secondary">Messenger / Zalo: sao chép để gửi</button>
  </div><label className="mt-5 block text-xs font-semibold text-slate-600">Liên kết công khai<input readOnly value={url} onFocus={e => e.target.select()} className="community-field mt-2" /></label><p className="mt-3 text-xs text-slate-500">Instagram/TikTok: sao chép liên kết và đăng thủ công. Mở hộp thoại chia sẻ không có nghĩa bài đã được đăng.</p>{message && <p role="status" className="mt-3 text-sm text-pink-700">{message}</p>}</CommunityDialog>;
}
