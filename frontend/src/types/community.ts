export const communityCategories = { GENERAL: 'Chia sẻ chung', QUESTIONS: 'Hỏi đáp làm đẹp', NAIL_HAIR: 'Nail & Tóc', SKINCARE: 'Chăm sóc da', WELLNESS: 'Spa & Thư giãn', PROFESSIONAL: 'Tác phẩm chuyên môn', RECOMMENDATIONS: 'Gợi ý dịch vụ' } as const;
export type CommunityCategory = keyof typeof communityCategories;
export type CommunityIdentity = 'ACCOUNT' | 'SALON' | 'PRACTITIONER';
export type CommunityVisibility = 'PUBLISHED' | 'HIDDEN' | 'DELETED';
export interface CommunityAuthor { name: string; avatar: string | null; identity: CommunityIdentity; salonName: string | null; salonSlug: string | null; specialty: string | null; verifiedSalon: boolean }
export interface CommunityMedia { id: string; url: string }
export interface CommunityServiceCard { id: number; name: string; salonName: string; image: string | null; price: number; durationMinutes: number; rating: number; reviewCount: number }
export interface CommunityPost { id: string; author: CommunityAuthor; content: string; category: CommunityCategory; visibility: CommunityVisibility; media: CommunityMedia[]; service: CommunityServiceCard | null; likeCount: number; commentCount: number; liked: boolean; owned: boolean; revision: number; createdAt: string; updatedAt: string; canonicalUrl: string }
export interface CommunityComment { id: string; parent: string | null; author: CommunityAuthor | null; content: string | null; visibility: CommunityVisibility; owned: boolean; revision: number; createdAt: string }
export interface CommunityCursor<T> { items: T[]; nextCursor: string | null }
export interface CommunityIdentityOption { identity: CommunityIdentity; salonId: number | null; practitionerId: number | null; label: string }
export interface CommunityPostWrite { requestKey: string; content: string; category: CommunityCategory; identity: CommunityIdentity; salonId: number | null; practitionerId: number | null; serviceId: number | null; media: string[]; revision?: number }
export interface CommunityCommentWrite { requestKey: string; content: string; parent?: string | null; revision?: number }
export type CommunityAction = 'HIDE' | 'RESTORE' | 'REMOVE' | 'DISMISS_REPORT' | 'RESTRICT_AUTHOR' | 'ALLOW_AUTHOR';
export interface CommunityReport { id: string; post: string; comment: string | null; reason: string; resolved: boolean; createdAt: string }
export interface CommunityAudit { action: CommunityAction; comment: string | null; moderator: string; reason: string; createdAt: string }
