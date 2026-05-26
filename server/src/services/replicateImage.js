const { generateImage: vertexGenerateImage } = require('./vertexAI');
const { generateBrandedImage } = require('./brandedImage');
const { applyLogoToImages } = require('./logoBranding');

const CACHOVIVA_STYLE = `Brazilian Black woman 25-35 with loose 3B-3C curly hair blowing in wind, smiling naturally, holding orange 500ml and blue 500ml CachoViva products, tropical beach at golden hour sunset, warm amber sunlight, palm trees background, nude #F0C8AA and copper #6B331E color palette, professional photography, shallow depth of field, natural glowing skin, soft golden backlight, premium beauty editorial style, Canon full-frame, 85mm lens, warm tones, feeling of freedom and natural beauty`;

async function generateImage(prompt, style = 'cachoviva') {
  const p = style === 'cachoviva' ? `${prompt}, ${CACHOVIVA_STYLE}` : prompt;

  // 1. Vertex AI / Gemini API (foto realista)
  try {
    const images = await vertexGenerateImage(p, { sampleCount: 2 });
    if (images && images.length > 0) {
      const result = images.map((img, i) => ({ url: img.imageUrl, imageUrl: img.imageUrl, variant: i }));
      console.log(`[Imagen] ${result.length} foto(s) realista(s)`);
      return await applyLogoToImages(result);
    }
  } catch (err) {
    console.warn('[Imagen] Erro:', err.message);
  }

  // 2. SVG vetorial (fallback)
  console.log('[Imagen] Fallback para SVG vetorial...');
  const results = [];
  for (let i = 0; i < 2; i++) {
    try {
      const variation = i === 0 ? prompt : `${prompt}. Variação de composição.`;
      const img = await generateBrandedImage(variation);
      if (img) results.push({ url: img, imageUrl: img, variant: i });
    } catch (err) {
      console.warn(`[SVG] Erro imagem ${i}: ${err.message}`);
    }
  }
  if (results.length > 0) {
    return await applyLogoToImages(results);
  }

  return [];
}

module.exports = { generateImage };
