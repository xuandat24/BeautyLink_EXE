import { apiClient } from './beautyApi';
import type { CommunityPost, CommunityCursor, CommunityComment, CommunityMedia, CommunityServiceCard, CommunityIdentityOption, CommunityPostWrite, CommunityCommentWrite, CommunityVisibility, CommunityAction, CommunityReport, CommunityAudit } from '../types/community';
const base = '/v1/community';
let configPending: Promise<{ enabled: boolean; maxImages: number; maxContentLength: number }> | null = null;
export const communityApi = {
  config: () => configPending ??= apiClient.get<{ enabled: boolean; maxImages: number; maxContentLength: number }>(`${base}/config`).then(r => r.data).finally(() => { configPending = null; }),
  feed: async (params: { before?: string; category?: string; q?: string }, signal?: AbortSignal) => (await apiClient.get<CommunityCursor<CommunityPost>>(`${base}/posts`, { params, signal })).data,
  post: async (id: string, signal?: AbortSignal) => (await apiClient.get<CommunityPost>(`${base}/posts/${encodeURIComponent(id)}`, { signal })).data,
  identities: async () => (await apiClient.get<CommunityIdentityOption[]>(`${base}/identities`)).data,
  editInfo: async (id: string) => (await apiClient.get<{ post: CommunityPost; fields: CommunityPostWrite }>(`${base}/posts/${id}/edit`)).data,
  services: async (q: string, signal?: AbortSignal) => (await apiClient.get<CommunityServiceCard[]>(`${base}/services`, { params: { q, size: 20 }, signal })).data,
  upload: async (image: string) => (await apiClient.post<CommunityMedia>(`${base}/media`, { image }, { timeout: 30000 })).data,
  create: async (body: CommunityPostWrite) => (await apiClient.post<CommunityPost>(`${base}/posts`, body)).data,
  edit: async (id: string, body: CommunityPostWrite) => (await apiClient.put<CommunityPost>(`${base}/posts/${id}`, body)).data,
  remove: async (p: CommunityPost) => { await apiClient.delete(`${base}/posts/${p.id}`, { params: { revision: p.revision } }); },
  like: async (id: string, liked: boolean) => (await apiClient.put<CommunityPost>(`${base}/posts/${id}/reaction`, { liked })).data,
  comments: async (id: string, parent?: string, before?: string, signal?: AbortSignal) => (await apiClient.get<CommunityCursor<CommunityComment>>(`${base}/posts/${id}/comments`, { params: { parent, before, size: 20 }, signal })).data,
  comment: async (id: string, body: CommunityCommentWrite, edit?: string) => (await (edit ? apiClient.put<CommunityComment>(`${base}/posts/${id}/comments/${edit}`, body) : apiClient.post<CommunityComment>(`${base}/posts/${id}/comments`, body))).data,
  deleteComment: async (post: string, c: CommunityComment) => (await apiClient.delete<CommunityComment>(`${base}/posts/${post}/comments/${c.id}`, { params: { revision: c.revision } })).data,
  report: async (id: string, reason: string, comment?: string) => (await apiClient.post<{ id: string }>(`${base}/posts/${id}/reports`, { reason, comment })).data,
  moderation: async (visibility: CommunityVisibility, q: string, before?: string, signal?: AbortSignal) => (await apiClient.get<CommunityCursor<CommunityPost>>(`${base}/moderation/posts`, { params: { visibility, q, before }, signal })).data,
  moderationPost: async (id: string) => (await apiClient.get<CommunityPost>(`${base}/moderation/posts/${id}`)).data,
  reports: async (resolved: boolean, before?: string, signal?: AbortSignal) => (await apiClient.get<CommunityCursor<CommunityReport>>(`${base}/moderation/reports`, { params: { resolved, before }, signal })).data,
  moderationComments: async (id: string, parent?: string, before?: string) => (await apiClient.get<CommunityCursor<CommunityComment>>(`${base}/moderation/posts/${id}/comments`, { params: { parent, before } })).data,
  moderate: async (p: CommunityPost, action: CommunityAction, reason: string, comment?: CommunityComment) => (await apiClient.put<CommunityPost>(`${base}/moderation/posts/${p.id}`, { action, reason, comment: comment?.id, revision: comment?.revision ?? p.revision })).data,
  history: async (id: string) => (await apiClient.get<CommunityAudit[]>(`${base}/moderation/posts/${id}/history`)).data,
};
