// Official v2 create/get response subset. Synthetic keys/accounts only; never forwards requests.
const http = require('http');
const crypto = require('crypto');
const records = new Map();
const key = 'local-payos-checksum-only';
function reply(res, data) {
  const canonical = Object.keys(data).sort().map(k => `${k}=${data[k] ?? ''}`).join('&');
  const signature = crypto.createHmac('sha256', key).update(canonical).digest('hex');
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ code: '00', desc: 'synthetic only', data, signature }));
}
function qr(amount) {
  const field = (tag, text) => tag + String(Buffer.byteLength(text)).padStart(2, '0') + text;
  const value = field('00', '01') + field('01', '12') + field('38', field('00', 'A000000727') + field('01', field('00', '970422') + field('01', '0000000000')) + field('02', 'QRIBFTTA')) + field('53', '704') + field('54', String(amount)) + field('58', 'VN') + '6304';
  let crc = 0xffff;
  for (const b of Buffer.from(value)) { crc ^= b << 8; for (let i = 0; i < 8; i++) crc = ((crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff; }
  return value + crc.toString(16).toUpperCase().padStart(4, '0');
}
http.createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (req.method === 'POST' && path === '/v2/payment-requests') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const input = JSON.parse(Buffer.concat(chunks).toString());
      if (records.has(input.orderCode)) { res.writeHead(409); res.end('Duplicate test POST'); return; }
      const data = { id: `local-${input.orderCode}`, orderCode: input.orderCode, amount: input.amount, amountPaid: 0, status: 'PENDING' };
      records.set(input.orderCode, data);
      if (input.orderCode === 102) { res.destroy(); return; } // provider accepted; acknowledgement lost
      reply(res, { bin: '970422', accountNumber: '0000000000', accountName: 'LOCAL TEST ONLY', amount: input.amount, description: input.description, orderCode: input.orderCode, currency: 'VND', paymentLinkId: data.id, status: 'PENDING', checkoutUrl: `https://pay.payos.vn/web/${data.id}`, qrCode: qr(input.amount) });
    });
  } else if (req.method === 'GET' && /^\/v2\/payment-requests\/\d+$/.test(path)) {
    const data = records.get(Number(path.split('/').at(-1)));
    if (!data) { res.writeHead(404); res.end(); return; }
    reply(res, data); // actual GET contract has no replacement QR/bank instructions
  } else { res.writeHead(501); res.end('Not implemented by this isolated contract'); }
}).listen(process.env.PORT);
