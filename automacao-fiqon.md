# Automação CachoViva — Servidor Direto (sem FiqOn)

> **Nota:** Substituímos o FiqOn por automação direta no servidor Node.js.
> Zero custo, zero dependência externa, mais rápido e confiável.

## Como configurar

1. Acesse sua conta **[Uzapi](https://uzapi.com.br)** e copie o token de API
2. Edite o arquivo `server/.env` e preencha:

```
UZAPI_TOKEN=seu_token_aqui
UZAPI_INSTANCE=sua_instancia_aqui
```

3. No Render, vá em Environment e adicione as mesmas variáveis:
   - `UZAPI_TOKEN` (valor do token)
   - `UZAPI_INSTANCE` (ID da instância)
4. Reinicie o servidor

**Pronto.** A automação já está rodando. Cada lead que preencher o diagnóstico vai receber o WhatsApp automaticamente.

---

## Fluxos implementados no servidor

Todos os fluxos abaixo rodam **dentro do seu servidor Node.js**, sem necessidade de ferramenta externa:

| # | Fluxo | Arquivo | Linha | Gatilho |
|---|---|---|---|---|
| 1 | Novo lead → WhatsApp personalizado por diagnóstico | `routes/leads.js` | 108-123 | `POST /api/leads` |
| 2 | Upsell automático (B ≥ 9) → WhatsApp oferta combo | `routes/leads.js` | 110-117 | `POST /api/leads` + `bScore >= 9` |
| 3 | Follow-up upsell 24h → WhatsApp lembrete | `routes/leads.js` | 24-31 | `setTimeout` 24h |
| 4 | Follow-up 48h → WhatsApp lembrete | `routes/leads.js` | 12-22 | `setTimeout` 48h |
| 5 | Lista VIP → WhatsApp boas-vindas | `routes/leads.js` | 194-197 | `GET /:id/confirmar-lista` |
| 6 | Interesse no kit → WhatsApp oferta | `routes/leads.js` | 217-220 | `POST /:id/kit` |

### Lógica do Fluxo 1 (novo lead):

```
POST /api/leads
  │
  ├─ Salva lead no SQLite
  ├─ Notifica Telegram (admin)
  ├─ Envia e-mail diagnóstico (se tiver email)
  │
  └─ WHATSAPP:
       ├─ Mapeia diagnóstico → mensagem específica
       │  (equilibrado/sedento/proteico/pesado/poroso/sem-rotina)
       │
       ├─ Se B ≥ 9 + Equilibrado:
       │    ├─ Envia mensagem de UPSELL (kit + reparador R$ 64,99)
       │    └─ Agenda FOLLOW-UP UPSELL (24h)
       │
       └─ Agenda FOLLOW-UP 48h
            └─ Só envia se NÃO comprou e NÃO teve interesse no kit
```

### Mensagens de WhatsApp (editáveis em `services/whatsapp.js`)

**Mensagem A — Cacho Equilibrado:**
```
Oi, {{body.name}}! ❤️

Descobrimos aqui que seu cacho está *equilibrado* — que notícia boa! Seus fios já estão saudáveis e bonitos.

Sabe o que seu cacho merece agora? Um *upgrade*.

O Kit CachoViva foi feito pra manter essa saúde e ainda dar mais definição, brilho e perfume. E olha que legal: você pode levar o Kit + Reparador de Pontas por apenas R$ 64,99 (em vez de R$ 74,90 separado).

Quer garantir o seu? 👇
Responder SIM aqui que eu te mando o link.
```

**Mensagem B — Cacho Sedento:**
```
Oi, {{body.name}}! ❤️

Pelo seu diagnóstico, seu cacho está *sedento* — ele pede hidratação e definição na medida certa.

O Kit CachoViva tem exatamente o que ele precisa:
- Passo 1: hidratação intensa que define sem pesar
- Passo 2: recupera o cacho no day after
- Brinde: perfume capilar Lavine pra sair cheirosa

Tudo por R$ 49,99 (de R$ 89,90). Quer testar? 👇
É só responder SIM que eu mando o link.
```

**Mensagem C — Cacho Proteico:**
```
Oi, {{body.name}}! ❤️

Seu diagnóstico mostrou que seu cacho está *precisando de proteína* — os fios estão fragilizados e pedindo reforço.

A boa notícia: o Kit CachoViva tem o Passo 1 (Definição Intensa) que ajuda a fortalecer enquanto define. E o Passo 2 garante que seu cacho acorde bonito no outro dia.

Preço especial de lançamento: R$ 49,99. Quer garantir? 👇
Só responder SIM aqui.
```

**Mensagem D — Cacho Nutrido:**
```
Oi, {{body.name}}! ❤️

Seu diagnóstico: *cacho nutrido* — seus fios têm bastante massa, mas podem estar pesados.

O Kit CachoViva foi pensado pra dar definição sem pesar: o Passo 1 é leve e o Passo 2 renova o cacho no dia seguinte. Perfeito pro seu tipo de fio.

Lançamento por R$ 49,99 (de R$ 89,90). Quer experimentar? 👇
Responda SIM e eu te mando o link.
```

**Mensagem E — Cacho Poroso:**
```
Oi, {{body.name}}! ❤️

Seu cacho é *poroso* — isso significa que ele absorve tudo, mas também perde umidade fácil. A chave é usar produtos que vedem as cutículas e segurem a definição.

O Kit CachoViva foi feito pra isso: o Passo 1 sela e define, o Passo 2 prolonga o resultado. Resultado: cacho definido por *2 dias*.

Tá por R$ 49,99 no lançamento. Quer testar? 👇
Só responder SIM.
```

**Mensagem F — Cacho em Descoberta:**
```
Oi, {{body.name}}! ❤️

Seu cacho está *em descoberta* — e que fase boa! É hora de encontrar os produtos certos pro seu cabelo.

O Kit CachoViva é o ponto de partida ideal: 3 passos simples que dão conta do essencial — definir, recuperar e perfumar. Sem complicação.

Preço de lançamento: R$ 49,99 (de R$ 89,90). Quer começar essa jornada? 👇
Responda SIM que eu mando o link.
```

---

## Fluxo 2 — Upsell Automático (B ≥ 9)

**Gatilho:** Webhook recebido com `event = "new_lead"` E `body.has_upsell = true`

### Configuração no FiqOn

Reaproveite o mesmo **Webhook Trigger** do Fluxo 1 e adicione mais rotas no Router.

**Condição específica:** `{{body.b_score}}` maior ou igual a 9

Se verdadeiro, em vez da mensagem padrão do Cacho Equilibrado, envie a **Mensagem de Upsell**:

```
Oi, {{body.name}}! ❤️

Seu cabelo já está saudável — seu diagnóstico mostrou isso! Que tal dar um upgrade?

O Kit CachoViva + Reparador de Pontas é a combinação perfeita pra manter os fios fortes, definidos e cheirosos. E você leva os dois por R$ 64,99 (em vez de R$ 74,90).

Quer garantir esse combo? 👇
Responda SIM e eu te mando o link especial.
```

Depois, crie um **Delay** de 24 horas + **HTTP Request** para segunda mensagem:

```
{{body.name}}, ainda dá tempo de garantir o combo com o precinho especial de R$ 64,99. ⏳

É só responder SIM aqui que eu mando o link. Oferta válida só no lançamento!
```

---

## Fluxo 3 — Follow-up 48h (quem não comprou)

**Gatilho:** Webhook recebido com `event = "new_lead"` (reaproveitar o mesmo trigger)

### Configuração no FiqOn

Após o bloco de envio do WhatsApp (Fluxo 1), adicione:

1. **Salvar lead no banco interno do FiqOn** — use o bloco "Database" ou "Google Sheets" para registrar: `lead_id`, `phone`, `event`, `status=aguardando_compra`, `created_at`

2. **Delay** — 48 horas (use o bloco "Delay" ou "Agendamento")

3. **HTTP Request** — Consultar status no seu servidor:
   - URL: `https://cachoviva-api.onrender.com/api/leads/{{lead_id}}/check-purchase`
   - (ou crie um endpoint simples que retorna se a lead já comprou)

4. **Filter** — Se NÃO comprou:

5. **HTTP Request** — Enviar WhatsApp de follow-up via Uzapi:

```json
{
  "phone": "{{body.phone}}",
  "message": "Oi, {{body.name}}! Ainda pensando no Kit CachoViva? 😊

Só pra lembrar: o preço de lançamento é R$ 49,99 (de R$ 89,90) e os kits estão saindo rápido.

Se quiser garantir o seu, é só responder SIM aqui que eu mando o link direto.

Beijo e cacho definido! 💁🏾‍♀️"
}
```

### Endpoint de verificação de compra (adicione no servidor)

No arquivo `server/src/routes/leads.js`, adicione:

```javascript
router.get('/:id/check-purchase', (req, res) => {
  const { id } = req.params;
  const lead = db.queryOne('SELECT kit_interest, purchased FROM leads WHERE id = ?', [id]);
  if (!lead) return res.json({ purchased: false });
  res.json({ purchased: !!lead.purchased || !!lead.kit_interest });
});
```

Se preferir simplificar, em vez de consultar o servidor, use o próprio FiqOn para marcar a lead como "comprou" quando ela clicar no link (crie um webhook de callback de clique).

---

## Fluxo 4 — Lista VIP → WhatsApp Boas-Vindas

**Gatilho:** Webhook recebido com `event = "vip_confirmed"`

### Configuração no FiqOn

1. **Webhook Trigger** (pode ser o mesmo — filtre por evento)
2. **Filter:** `{{body.event}}` igual a `vip_confirmed`
3. **HTTP Request** — WhatsApp via Uzapi:

```json
{
  "phone": "{{body.phone}}",
  "message": "{{body.name}}, bem-vinda à lista VIP da CachoViva! 🎉

Você vai receber novidades, ofertas exclusivas e avisar primeiro quando o lançamento chegar.

Enquanto isso, quer garantir seu kit com antecedência? Responda SIM aqui que eu te mando o link exclusivo da pré-venda."
}
```

---

## Fluxo 5 — Kit Interest → WhatsApp Oferta

**Gatilho:** Webhook recebido com `event = "kit_interest"`

### Configuração no FiqOn

1. **Filter:** `{{body.event}}` igual a `kit_interest`
2. **HTTP Request** — WhatsApp via Uzapi:

```json
{
  "phone": "{{body.phone}}",
  "message": "{{body.name}}, que bom que você tem interesse no Kit CachoViva! 💁🏾‍♀️

Ele está em pré-venda por R$ 49,99 (de R$ 89,90) e você leva:
✅ Passo 1 — Definição Intensa 500ml
✅ Passo 2 — Day After 250ml
✅ Brinde: Perfume Capilar Lavine 30ml

Quer comprar agora? 👇
É só responder SIM que eu mando o link."
}
```

---

## Estrutura geral no FiqOn (visão dos blocos)

```
┌────────────────────────────────────────────────────┐
│  WEBHOOK (único — recebe todos os eventos)          │
│  URL: https://hook.fiqon.com/xxxxxxxx               │
└────────────────────┬───────────────────────────────┘
                     │
              ┌──────┴──────┐
              │   FILTER    │
              │ event tipo? │
              └──┬───┬───┬──┘
                 │   │   │
   ┌─────────────┘   │   └──────────────┐
   ▼                  ▼                  ▼
┌──────────┐   ┌──────────┐   ┌──────────────┐
│ new_lead │   │ vip_     │   │ kit_interest  │
│          │   │ confirmed│   │              │
└────┬─────┘   └────┬─────┘   └──────┬───────┘
     │              │                │
     ▼              ▼                ▼
┌──────────┐   ┌──────────┐   ┌──────────────┐
│  ROUTER  │   │ WHATSAPP │   │  WHATSAPP    │
│diagnóstico│  │ boas-vindas│  │  oferta      │
├──────────┤   └──────────┘   └──────────────┘
│6 rotas → │
│WHATSAPP  │
│ + UPSEL  │
│ (B≥9)    │
└────┬─────┘
     │
     ▼
┌──────────┐
│  DELAY   │
│  48h     │
└────┬─────┘
     │
     ▼
┌──────────┐
│ CHECK    │
│ comprou? │
├──────────┤
│ se não → │
│ WHATSAPP │
│ follow-up│
└──────────┘
```

---

## Testando

1. No FiqOn, ative cada fluxo com o botão "Ativar"
2. Preencha o diagnóstico no site CachoViva
3. Veja se o WhatsApp disparou
4. Verifique os logs no FiqOn (menu "Execuções")

## Variáveis que seu servidor envia no webhook

| Campo | Tipo | Exemplo |
|---|---|---|
| `event` | string | `new_lead` |
| `lead_id` | string | `uuid-v4` |
| `name` | string | `Maria Silva` |
| `phone` | string | `+5579988123456` |
| `email` | string | `maria@email.com` |
| `diagnosis` | string | `equilibrado` |
| `diagnosis_name` | string | `Cacho Equilibrado` |
| `scores` | object | `{"H":8,"N":5,"R":3,"P":4,"B":9}` |
| `b_score` | number | `9` |
| `has_upsell` | boolean | `true` (quando B≥9) |
| `created_at` | timestamp | `1747891234` |
