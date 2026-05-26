const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const LOGO_PATH = path.join(__dirname, '..', '..', '..', 'landing', 'assets', 'logomarca.png');

async function applyLogo(imageBufferOrUrl) {
  try {
    let image;
    if (Buffer.isBuffer(imageBufferOrUrl)) {
      image = sharp(imageBufferOrUrl);
    } else if (typeof imageBufferOrUrl === 'string' && imageBufferOrUrl.startsWith('http')) {
      const resp = await require('axios').get(imageBufferOrUrl, { responseType: 'arraybuffer' });
      image = sharp(Buffer.from(resp.data));
    } else if (typeof imageBufferOrUrl === 'string' && imageBufferOrUrl.startsWith('data:')) {
      const base64 = imageBufferOrUrl.replace(/^data:image\/\w+;base64,/, '');
      image = sharp(Buffer.from(base64, 'base64'));
    } else {
      return imageBufferOrUrl;
    }

    const meta = await image.metadata();
    const logoSize = Math.round(Math.min(meta.width, meta.height) * 0.12);
    const padding = Math.round(logoSize * 0.3);

    let logoBuffer;
    if (fs.existsSync(LOGO_PATH)) {
      logoBuffer = fs.readFileSync(LOGO_PATH);
    } else {
      const logoFallback = sharp({
        create: {
          width: logoSize,
          height: Math.round(logoSize * 0.3),
          channels: 4,
          background: { r: 197, g: 165, b: 90, alpha: 0.85 }
        }
      }).png();
      logoBuffer = await logoFallback.toBuffer();
    }

    const logoResized = await sharp(logoBuffer)
      .resize(logoSize, null, { fit: 'inside', withoutEnlargement: true })
      .png({ quality: 100 })
      .toBuffer();

    const result = await image
      .composite([{
        input: logoResized,
        top: Math.round(meta.height - logoSize - padding),
        left: Math.round(meta.width - logoSize - padding),
      }])
      .jpeg({ quality: 92 })
      .toBuffer();

    return `data:image/jpeg;base64,${result.toString('base64')}`;
  } catch (err) {
    console.warn('[LogoBranding] Erro ao aplicar logo:', err.message);
    return imageBufferOrUrl;
  }
}

async function applyLogoToImages(images) {
  if (!images || images.length === 0) return images;
  const results = [];
  for (const img of images) {
    const branded = await applyLogo(img.url || img.imageUrl || img);
    results.push(typeof img === 'string' ? branded : { ...img, url: branded, imageUrl: branded });
  }
  return results;
}

module.exports = { applyLogo, applyLogoToImages };
