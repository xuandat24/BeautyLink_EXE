// Local test double derived from backend/src/test/resources/cloudinary-upload.openapi.yaml.
// No external calls, no real credentials, no request/body logging.
const http = require('http');
const { createHash, timingSafeEqual } = require('crypto');
const secret = 'fake-test-secret-not-a-real-provider-secret';
const hash = (value, algorithm = 'sha256') => createHash(algorithm).update(value).digest('hex');
const parseMultipart = raw => {
  const fields = {};
  const expression = /name="([^"]+)"[^]*?\r\n\r\n([^]*?)(?=\r\n--)/g;
  let match;
  while ((match = expression.exec(raw))) fields[match[1]] = match[2];
  return fields;
};
http.createServer((req, res) => {
  const respond = (code, value) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(value));
  };
  const handle = raw => {
    const route = /^\/v1_1\/test-cloud\/image\/(upload|destroy)$/.exec((req.url || '').split('?')[0]);
    if (req.method !== 'POST' || !route) return respond(501, { error: 'Route not implemented by dependency contract' });
    const fields = typeof raw === 'object' && !Buffer.isBuffer(raw) ? raw : parseMultipart(String(raw));
    const { signature, api_key, file, ...signed } = fields;
    const expected = hash(Object.keys(signed).sort().map(key => `${key}=${signed[key]}`).join('&') + secret);
    if (api_key !== 'fake-api-key' || typeof signature !== 'string' || signature.length !== expected.length
        || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return respond(401, { error: 'Invalid signature' });
    if (!/^beautylink\/public\/[0-9a-f-]{36}$/.test(signed.public_id || '') || !/^\d+$/.test(signed.timestamp || '')) {
      return respond(400, { error: 'Invalid identity' });
    }
    if (route[1] === 'destroy') return respond(200, { result: 'ok' });
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(file || '') || signed.overwrite !== 'false'
        || signed.allowed_formats !== 'jpg,png,webp' || signed.transformation !== 'c_limit,w_2048,h_2048/f_webp') {
      return respond(400, { error: 'Invalid public image request' });
    }
    const publicId = signed.public_id;
    respond(200, { public_id: publicId, version: 123, bytes: 42, format: 'webp', resource_type: 'image', type: 'upload',
      signature: hash(`public_id=${publicId}&version=123${secret}`, 'sha1'),
      secure_url: `https://res.cloudinary.com/test-cloud/image/upload/v123/${publicId}.webp` });
  };
  if (req.body !== undefined) return handle(req.body);
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => handle(Buffer.concat(chunks).toString('utf8')));
}).listen(process.env.PORT || 4900);
