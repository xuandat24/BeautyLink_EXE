export const sessionToken = (sid = '11111111-1111-4111-8111-111111111111', expires = Date.now() + 3_600_000) =>
  `header.${Buffer.from(JSON.stringify({ sid, exp: Math.floor(expires / 1000) })).toString('base64url')}.test-signature`;
