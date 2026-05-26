# Formatos de Conteúdo CachoViva

## Paleta de Cores (Pipeline de Imagem — Imagen 3 / Gemini API)
| Cor | Hex | Uso |
|-----|:---:|-----|
| Nude | `#F0C8AA` | Fundos, pele, cards, Stories |
| Cobre | `#6B331E` | Textos principais, tons de cabelo, logomarca |
| Verde-floresta | `#3A5020` | Destaques, CTAs, contornos |
| Dourado | `#B8A060` | Acentos, brilho, elementos premium |
| Chocolate | `#3D2324` | Texto principal no SVG |
| Creme | `#E8DCC4` | Fundos de card |
| Bronze | `#A67C52` | Detalhes secundários |

**Evitar:** verde-menta, preto puro, azul, cinza frio

## Paleta de Cores (Landing Page — CSS)
| Cor | Hex | Uso |
|-----|:---:|-----|
| Chocolate | `#3D2324` | Texto principal, fundo hero |
| Chocolate Dark | `#2A1A1B` | Fundo escuro, overlays |
| Cream | `#E8DCC4` | Fundo de cards |
| Cream Light | `#F5EFE1` | Gradiente, variação de fundo |
| Cream BG | `#F9F4EA` | Fundo geral do site |
| Gold | `#C5A55A` | Botões, detalhes dourados |
| Gold Light | `#E4D49B` | Brilho, hover states |
| Gold Dark | `#A8883E` | Borda, sombra |
| Bronze | `#A67C52` | Detalhes secundários |

## Tipografia
- Headlines: Bold sem serifa (Inter, Arial, Helvetica)
- Corpo: Regular sans-serif
- Máximo 3 tamanhos de fonte por peça

## Elementos Visuais (SVG — brandImage.js)
- Fundo: gradiente suave `#F9F4EA` → `#E8DCC4`
- Moldura com linhas decorativas douradas
- Ícones decorativos: folhas, ondas, círculos em `#C5A55A` (gold)
- Título centralizado (máx 3 palavras) em `#3D2324` (chocolate)
- Subtítulo/frase de efeito
- Design limpo, moderno, premium
- Sem fotos de pessoas no SVG

## Elementos Visuais (Imagens Realistas — Imagen 3)
- Persona: mulher negra brasileira 25-35, cachos 3B-3C soltos ao vento
- Sorriso natural, olhos visíveis, pele natural com brilho
- Segurando produtos: frasco laranja 500ml (Creme) + azul 500ml (Day After)
- Cenário: praia tropical ao entardecer (golden hour), palmeiras
- Iluminação: luz âmbar quente, contraluz dourado, soft shadows
- Estilo: fotografia editorial premium, Canon full-frame, 85mm, profundidade de campo rasa
- Sensação: liberdade, beleza natural
- Logomarca: sobreposta no canto inferior direito via sharp (logoBranding.js)

## Proporções (Pipeline)
| Formato | Proporção | Resolução |
|---------|-----------|-----------|
| Feed / Post único | 1:1 | 1080×1080px |
| Carrossel | 1:1 | 1080×1080px |
| Stories / TikTok | 9:16 | 1080×1920px |
| TikTok Cover | 1:1 | 1080×1080px |

## Formatos Suportados pelo Pipeline

### Instagram Feed / Post Único
- 1 imagem 1:1 com copy + hashtags + CTA
- Imagem realista (Imagen 3) ou SVG vetorial (fallback)

### Instagram Carrossel
- 5 slides, cada um 1:1
- Geração: IA cria roteiro dos slides → imagem para cada slide
- Pipeline gera imagens individualmente com logo overlay
- CTA único no último slide

### Reels / TikTok
- Roteiro de vídeo gerado (Squad3 → `roteiro_video`)
- Cenas com script, texto na tela, duração
- Imagem de capa 1:1 ou 9:16
- **Nota:** geração de vídeo real (Veo/Gen3) — pendente

### Stories
- Formato 9:16
- Mínimo 3 frames/dia no calendário editorial
- Pipeline ainda não gera stories automaticamente

## Regras de Composição (Imagens Geradas)
- Logomarca no **canto inferior direito** (aplicada via sharp)
- Padding: 12% do tamanho da imagem
- Respiro entre elementos
- Máximo 1 CTA por peça
- Persona no centro ou topo 1/3
- Cores da paleta CachoViva obrigatórias

## Pipeline de Geração
| Etapa | O que gera | Modelo |
|-------|-----------|--------|
| Squad1 (Pesquisa) | Ganchos, plataforma, formato | Vertex AI (gemini-2.5-flash-lite) |
| Squad2 (Estratégia) | Posts com plano completo | Vertex AI (gemini-2.5-flash-lite) |
| Squad3 (Criação) | Copy, hashtags, prompt_imagem, roteiro_video | Vertex AI (gemini-2.5-flash-lite) |
| Media | Imagens (1:1, 2 por post) | Imagen 3 → Gemini API → SVG |
| Squad4 (QA) | Score, aprovação/rejeição | Vertex AI (gemini-2.5-flash-lite) |

## Aplicação da Logomarca (logoBranding.js)
- `sharp` sobrepõe `logomarca.png` no canto inferior direito
- Logo redimensionada para 12% da largura da imagem
- Padding de 30% do tamanho do logo
- Fallback: retângulo dourado semi-transparente se PNG não existir
- Saída: JPEG data URL base64
