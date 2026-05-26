const sharp = require('sharp');
const { callVertex } = require('./vertexAI');

const CACHOVIVA_PALETTE = {
  chocolate: '#3D2324',
  chocolateDark: '#2A1A1B',
  cream: '#E8DCC4',
  creamLight: '#F5EFE1',
  creamBg: '#F9F4EA',
  gold: '#C5A55A',
  goldLight: '#E4D49B',
  goldDark: '#A8883E',
  bronze: '#A67C52'
};

async function generateBrandedImage(promptText) {
  const svgPrompt = `Crie um SVG 1080x1080 para post de rede social da marca CachoViva (kit capilar para cabelos cacheados).

Tema: ${promptText.substring(0, 200)}

Paleta de cores obrigatória:
- Fundo: gradiente suave entre #F9F4EA e #E8DCC4
- Texto principal: #3D2324 (chocolate)
- Detalhes/ícones: #C5A55A (dourado)
- Destaques: #A67C52 (bronze)
- Acentos: #E4D49B (dourado claro)

Elementos obrigatórios:
1. Título principal grande e centralizado (máx 3 palavras)
2. Subtítulo ou frase de efeito
3. Um ou mais ícones decorativos (folhas, ondas, círculos) em dourado
4. Moldura sutil com linhas decorativas douradas
5. NOVO: elemento visual representando o tema (pode ser formas abstratas)

Regras:
- Design limpo, moderno, premium
- Texto em português
- Fonte sem serifa (Arial, Helvetica ou sans-serif)
- SEM fotos de pessoas
- APENAS o SVG puro, sem markdown, sem HTML

Retorne APENAS o código SVG puro, sem explicação, sem markdown.`;

  const svgCode = await callVertex(svgPrompt, '', undefined, 1);
  if (!svgCode) return null;

  let cleanSvg = svgCode.replace(/```svg\s*/gi, '').replace(/```\s*$/g, '').trim();
  if (!cleanSvg.startsWith('<svg')) {
    const match = cleanSvg.match(/<svg[\s\S]*<\/svg>/i);
    if (!match) return null;
    cleanSvg = match[0];
  }

  try {
    const pngBuffer = await sharp(Buffer.from(cleanSvg)).resize(1080, 1080).png().toBuffer();
    return `data:image/png;base64,${pngBuffer.toString('base64')}`;
  } catch {
    const pngBuffer = await sharp({
      create: { width: 1080, height: 1080, channels: 4, background: CACHOVIVA_PALETTE.creamBg }
    }).composite([{
      input: Buffer.from(cleanSvg),
      top: 0, left: 0
    }]).png().toBuffer();
    return `data:image/png;base64,${pngBuffer.toString('base64')}`;
  }
}

module.exports = { generateBrandedImage };
