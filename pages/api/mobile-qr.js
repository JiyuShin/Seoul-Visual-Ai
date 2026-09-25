import QRCode from 'qrcode';

/** QR PNG (브라우저 qrcode 번들 이슈 회피) */
export default async function handler(req, res) {
  const raw = req.query.url;
  const url = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';
  if (!url || url.length > 2048) {
    res.status(400).json({ error: 'missing url' });
    return;
  }

  try {
    const buffer = await QRCode.toBuffer(url, {
      type: 'png',
      width: 512,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.status(200).send(buffer);
  } catch (err) {
    res.status(500).json({ error: err?.message || 'qr failed' });
  }
}
