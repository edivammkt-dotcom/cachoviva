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

### Próximos passos sugeridos
- Adicionar tabela de preços com comparação visual (classe `.price-table` já existe no CSS)
- Adicionar sticky CTA bar no mobile
- Melhorar a seção de resultado (remover mais CSS inline remanescente)
- Testar a página em produção (Render)
- Criar entrada no Google Analytics para eventos de conversão
