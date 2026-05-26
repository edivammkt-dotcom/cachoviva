# Contexto do Projeto — CachoViva

## Landing Page de Diagnóstico Capilar

### Estrutura
- `landing/` — Versão standalone (aponta para `localhost:3001/api`, usa `config.js`)
- `server/public/` — Versão servida pelo backend (aponta para `/api`)

### O que já foi feito (23/05/2026)

**Profissionalização do layout — inspirado em lp.myhub.ia.br:**
1. **CSS inline removido do JS** — Blocos de produto (`product-match-card`, `cta-kit-btn`, `btn-wa-injected`) agora usam classes CSS
2. **Depoimentos em grid** — Substituído scroll horizontal por `grid-template-columns: repeat(3, 1fr)` com fallback 2-col em 900px e 1-col em 640px
3. **Selos de confiança** — Adicionado `.trust-badges` com badges LGPD, pré-lançamento, avaliações
4. **Countdown refinado** — Fundo com blur, borda sutil, tipografia melhorada
5. **Launch teaser refinado** — Borda, sombra, linha decorativa no topo
6. **Hover states** — Cards, botões e seções com transições suaves
7. **Emotional bridge refinado** — Gradient, border-radius, sombra
8. **Form refinado** — Inputs com background white, foco com ring
9. **Seções com padding consistente** — Classes `.section-padding` e `.section-padding-sm`

### Paleta de Cores
```css
--chocolate: #3D2324
--chocolate-dark: #2A1A1B
--cream: #E8DCC4
--cream-light: #F5EFE1
--cream-bg: #F9F4EA
--gold: #C5A55A
--gold-light: #E4D49B
--gold-dark: #A8883E
--bronze: #A67C52
```

### O que já foi feito (24/05/2026)

**Correção: página voltava à tela inicial ao recarregar:**
1. **Persistência do resultado em `localStorage`** — `submitForm()` agora salva o diagnóstico completo (`cv_diagnostico_full`, `cv_diagnostico_id`) no `localStorage`
2. **Restauração automática** — No `DOMContentLoaded`, se o usuário já completou o diagnóstico, a tela de resultado é restaurada automaticamente (com nome do lead)
3. **`restartQuiz()`** — Agora limpa todos os dados de diagnóstico do `localStorage` ao refazer

**Correção: "tela do Render" (spin-down do free tier):**
1. **Novo Static Site** criado no Render com `runtime: static` (CDN sem spin-down)
2. **`render.yaml`** — corrigido `env: static` → `runtime: static`
3. **Rewrite rule** `/*` → `/index.html` adicionada
4. Serviço antigo (`cachoviva-landing`, web service) deletado
5. `cachoviva-api` mantido como web service (spin-down normal, sem tela para o usuário)

**Pipeline Squad Automático — Arquivos criados/editados:**
1. **`server/src/routes/squad-pipeline.js`** — Orquestrador do pipeline automático
2. **`server/src/services/logoBranding.js`** — Overlay de logomarca com `sharp`
3. **`server/public/squad.html`** — Dashboard 4 abas
4. **`server/public/squad.css`** — Estilo
5. **`server/public/squad.js`** — Lógica frontend
6. **`server/src/index.js`** — Rota `/api/squad` + CRON
7. **`server/src/services/telegram.js`** — Handlers `/sq_ok_<code>` / `/sq_no_<code>`
8. **`server/src/database.js`** — Tabela `squad_config` + migração `purchased`

**Migração para Vertex AI (política da organização obriga service account):**
1. **`server/src/cachoviva-sa.json`** — Service account GCP
2. **`server/src/services/vertexAI.js`** — Wrapper Vertex AI com JWT auth + cache de token + suporte a modelos texto e imagem (Imagen + Gemini)

### Pipeline em produção (localhost:3001)

**Status Atual (25/05/2026):**

| Componente | Status | Modelo | Custo |
|------------|--------|--------|-------|
| Texto (Squad 1-4) | ✅ Funcionando | `gemini-2.5-flash-lite` via Vertex AI | GCP (PIX) |
| **Imagem realista** | ✅ **Funcionando** | **`imagen-3.0-generate-001` via Vertex AI** | **$0.04/imagem** |
| Fallback imagem | ✅ SVG vetorial | Vertex AI + `brandedImage.js` + Sharp | Grátis |
| Dashboard | ✅ Funcionando | `squad.html` | - |
| Pipeline completo | ✅ 3 posts/ciclo, score ≥85 | SquadManager 6 estágios | - |
| Telegram | ⚠️ Token configurado, bot pode estar desativado | - | - |

### Cadeia de Fallback de Imagem (replicateImage.js → vertexAI.js)

1. **Vertex AI Gemini (`generateContent`)** — `gemini-2.0-flash-001`, `gemini-2.0-flash`, `gemini-2.0-flash-exp` com `responseModalities: ['Text', 'Image']` → não suportam imagem no projeto
2. **Vertex AI Imagen (`predict`)** — `imagen-3.0-generate-001` ✅ **funcionando!** → 2 imagens/post
3. **Gemini API (chave AIza)** — `gemini-3.1-flash-image-preview` → se billing estiver ativo
4. **SVG vetorial** — `brandedImage.js` → Vertex AI texto → SVG → Sharp

### Pipeline Atual de Geração de Vídeo (25/05/2026)

**Status:** ⛔ Veo via Vertex AI → `predictLongRunning` cria operação mas polling quebrado (UUID rejeitado)
**Alternativa:** ✅ Veo via Gemini API → endpoint `predictLongRunning` funciona, mas precisa de **paid tier**

**Cadeia atual em `videoGenerator.js`:**
1. `POST /v1beta/models/veo-3.1-generate-preview:predictLongRunning` (Gemini API, chave AIza)
2. Polling: `GET /v1beta/{operationName}` até `done=true`
3. Resposta: `response.generateVideoResponse.generatedSamples[0].video.uri`

**Erro atual:** 429 quota exceeded — chave AIza está no free tier, Veo não tem free tier

### Preços Veo 3.1 via Gemini API (paid tier, por segundo)

| Modelo | 720p | 1080p | 4K | 8s clip 720p |
|--------|------|-------|-----|--------------|
| **Lite** | $0.05 | $0.08 | — | ~$0.40 |
| **Fast** | $0.10 | $0.12 | $0.30 | ~$0.80 |
| **Standard** | $0.40 | $0.40 | $0.60 | ~$3.20 |

Rate limit: 50 RPM (production), 10 RPM (preview)

### ⚠️ PONTO DE RETOMADA — 25/05/2026 (17h)

**Status atual — Vídeo:**
- ✅ Vertex AI Veo: testado → **erro 403** (fatura GCP inadimplente — "Lightning dunning decision is deny")
- ✅ Gemini API Veo: testado → **erro 429** (quota free tier excedida)
- ✅ **Runway ML integrado** como 3º fallback em `videoGenerator.js`
  - Endpoint de teste: `POST /api/squad/test-runway`
  - **Precisa de chave da API Runway** (trial grátis em runwayml.com)

**Decisão pendente — Migrar do GCP para OpenAI + Runway:**
- Substituir **Vertex AI (texto)** → **OpenAI API (GPT-4o mini)**
- Substituir **Imagen 3 (imagem)** → **DALL-E 3** (mesmo preço, $0.04/imagem)
- Manter **Runway** para vídeo (trial grátis, depois $12-28/mês)
- ⚠️ OpenAI permite **hard limit de gastos** no dashboard (GCP não tem)
- **Ação:** criar conta OpenAI, configurar billing, gerar API key

**Arquivos alterados nesta sessão:**
1. `server/src/services/videoGenerator.js` — Adicionado Runway ML como 3ª tentativa
2. `server/src/routes/squad-pipeline.js` — Adicionado `POST /api/squad/test-runway`
3. `server/.env` — Adicionado `RUNWAY_API_KEY=`
4. `AGENTS.md` — Adicionada seção "Lições Aprendidas"

### APIs de Vídeo Pesquisadas

| API | Modelo | Preço | Polling |
|-----|--------|-------|---------|
| **Gemini API (Veo 3.1)** 🎯 | veo-3.1-generate-preview | $0.05-0.40/s | ✅ |
| OpenAI Sora | sora-2-pro | — | ✅ |
| Runway | Gen-4.5, Gen-4 Turbo | $0.05-0.15/s | ✅ |
| Pika (via fal.ai) | Pika 2.5 | — | ✅ |
| xAI Grok Imagine | grok-imagine-video | — | ✅ |
| UlazAI (agregador) | Veo, Sora 2, Kling | varia | ✅ |

### APIs de Imagem Testadas (falhas documentadas)

| Serviço | Erro | Motivo |
|---------|------|--------|
| Replicate (flux-dev) | 401 | Token inválido |
| Replicate (2º token) | 402/429 | Precisa de cartão de crédito |
| Pollinations.ai | 402 Paywall | Agora é pago |
| Gemini API Flash | Não suporta | Modelos Flash não geram imagem |

### Bloqueios Atuais

- ~~Chave da API Gemini~~ ✅ **Vertex AI com service account**
- ~~Geração de imagem realista~~ ✅ **Imagen 3 funcionando**
- Telegram: bot pode estar desativado — recriar no @BotFather
- ElevenLabs: locução natural não integrada
- Deploy do backend atualizado no Render pendente
- ~~Vídeo~~ ⚠️ **PENDENTE — ver "PONTO DE RETOMADA" abaixo**

### Próximos Passos

**Imediatos:**
1. **Testar Vertex AI Veo** — `curl POST /api/squad/test-veo` e acompanhar logs `[VertexAI-Veo]`
2. Pipeline rodando com Imagen 3 — verificar qualidade no dashboard
3. Deploy no Render do backend atualizado (`cachoviva-api`)
4. Testar Gemini API (`gemini-3.1-flash-image-preview`) como alternativa via chave AIza com billing

**Evolução das Imagens:**
1. **Prompt engineering** — refinar o prompt visual do Imagen 3 para fotos mais realistas (referências, iluminação, composição)
2. **Imagen 4** ($0.04/imagem, melhor qualidade de texto) — ativar no Model Garden quando disponível
3. **Gemini 3.1 Flash Image** ($0.067/imagem, batch $0.034) — testar via chave AIza com billing
4. **Batch API** — usar batch para reduzir custo em 50% em pipelines noturnos

**Infra:**
- Recriar bot Telegram no @BotFather
- Integrar ElevenLabs para locução natural
- Google Analytics para eventos de conversão
- Landing: remover CSS inline remanescente

**Migração para OpenAI + Runway (ver "PONTO DE RETOMADA"):**
1. Criar conta OpenAI, ativar billing, hard limit de $20
2. Gerar API key OpenAI
3. Migrar texto (GPT-4o mini) e imagem (DALL-E 3) nos serviços
4. Gerar API key Runway (trial grátis)
5. Testar `/api/squad/test-runway`

### Credenciais

```
GCP Project: grand-fx-483721-m5
Vertex AI region: us-central1
```
> ⚠️ Chaves e tokens estão no arquivo `.env` local (não commitado).

### Arquivos Relevantes (Atualizado)

- `server/src/services/vertexAI.js` — Todo texto + imagem + vídeo via Vertex AI (Imagen 3 + Gemini + Veo + fallbacks)
- `server/src/services/replicateImage.js` — Orquestrador de imagem (tenta Imagen → Gemini API → SVG)
- `server/src/services/brandedImage.js` — SVG vetorial com paleta CachoViva
- `server/src/services/logoBranding.js` — Overlay de logomarca (sharp)
- `server/src/services/squadManager.js` — 6 squads + callGemini via Vertex AI
- `server/src/services/ai.js` — ContentAI class com fallbacks
- `server/src/routes/squad-pipeline.js` — Orquestrador + endpoints REST
- `server/src/services/telegram.js` — Bot Telegram
- `server/src/database.js` — SQLite + migrações
- `server/src/index.js` — Express + CRONs
- `server/public/squad.html` — Dashboard
- `server/public/squad.css` — Estilo
- `server/public/squad.js` — Lógica frontend
- `server/src/services/videoGenerator.js` — Veo via Gemini API + Runway ML (3ª tentativa)
- `server/.env` — Config (GEMINI_API_KEY, Telegram, etc.)
- `AGENTS.md` — Este arquivo

### 🧠 Lições Aprendidas

1. **Nunca fazer testes pagos em API sem limite de gastos.** Sempre configurar *billing cap* / orçamento no provedor (GCP, AWS, etc.) antes de ativar. Caso contrário, o consumo contínuo (ex: Imagen 3 a $0.04/imagem no pipeline) gera fatura inesperada. Preferir serviços com trial grátis (Runway, Luma) para prova de conceito antes de ativar planos pagos.
