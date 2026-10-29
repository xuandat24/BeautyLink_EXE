export const PUBLIC_ORIGIN = 'https://beautylink.cloud';
export interface PublicServiceShare { serviceName: string; supplierName: string; serviceId?: number }
/** Explicit allowlist: never serialize a booking object, route, query or check-in code. */
export function publicServiceShare(data: PublicServiceShare) {
  const url = Number.isSafeInteger(data.serviceId) && Number(data.serviceId) > 0
    ? `${PUBLIC_ORIGIN}/?serviceId=${data.serviceId}` : `${PUBLIC_ORIGIN}/#filter-explore`;
  return { url, text: `Tham khảo dịch vụ ${data.serviceName} tại ${data.supplierName} trên BeautyLink.\n${url}` };
}
