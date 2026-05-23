const axios = require('axios');

const UZAPI_BASE = process.env.UZAPI_BASE_URL || 'https://api.uzapi.com.br';
const UZAPI_TOKEN = process.env.UZAPI_TOKEN || '';
const UZAPI_INSTANCE = process.env.UZAPI_INSTANCE || '';

async function send(phone, message) {
  if (!UZAPI_TOKEN) {
    console.log('[WhatsApp] Token não configurado. Mensagem não enviada.');
    console.log('[WhatsApp] Destino:', phone, '| Mensagem:', message.slice(0, 80) + '...');
    return;
  }
  try {
    const url = `${UZAPI_BASE}/message/send`;
    const payload = {
      number: phone,
      text: message,
      instance: UZAPI_INSTANCE,
    };
    await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${UZAPI_TOKEN}`,
      },
      timeout: 8000,
    });
  } catch (err) {
    console.error('[WhatsApp] Erro ao enviar:', err.message);
  }
}

const MESSAGES = {
  equilibrado: (name) =>
    `Oi, ${name}! ❤️\n\nDescobrimos aqui que seu cacho está *equilibrado* — que notícia boa! Seus fios já estão saudáveis e bonitos.\n\nSabe o que seu cacho merece agora? Um *upgrade*.\n\nO Kit CachoViva foi feito pra manter essa saúde e ainda dar mais definição, brilho e perfume. E olha que legal: você pode levar o Kit + Reparador de Pontas por apenas R$ 64,99 (em vez de R$ 74,90 separado).\n\nQuer garantir o seu? 👇\nResponder SIM aqui que eu te mando o link.`,

  sedento: (name) =>
    `Oi, ${name}! ❤️\n\nPelo seu diagnóstico, seu cacho está *sedento* — ele pede hidratação e definição na medida certa.\n\nO Kit CachoViva tem exatamente o que ele precisa:\n• Passo 1: hidratação intensa que define sem pesar\n• Passo 2: recupera o cacho no day after\n• Brinde: perfume capilar Lavine pra sair cheirosa\n\nTudo por R$ 49,99 (de R$ 89,90). Quer testar? 👇\nÉ só responder SIM que eu mando o link.`,

  proteico: (name) =>
    `Oi, ${name}! ❤️\n\nSeu diagnóstico mostrou que seu cacho está *precisando de proteína* — os fios estão fragilizados e pedindo reforço.\n\nA boa notícia: o Kit CachoViva tem o Passo 1 (Definição Intensa) que ajuda a fortalecer enquanto define. E o Passo 2 garante que seu cacho acorde bonito no outro dia.\n\nPreço especial de lançamento: R$ 49,99. Quer garantir? 👇\nSó responder SIM aqui.`,

  pesado: (name) =>
    `Oi, ${name}! ❤️\n\nSeu diagnóstico: *cacho nutrido* — seus fios têm bastante massa, mas podem estar pesados.\n\nO Kit CachoViva foi pensado pra dar definição sem pesar: o Passo 1 é leve e o Passo 2 renova o cacho no dia seguinte. Perfeito pro seu tipo de fio.\n\nLançamento por R$ 49,99 (de R$ 89,90). Quer experimentar? 👇\nResponda SIM e eu te mando o link.`,

  poroso: (name) =>
    `Oi, ${name}! ❤️\n\nSeu cacho é *poroso* — isso significa que ele absorve tudo, mas também perde umidade fácil. A chave é usar produtos que vedem as cutículas e segurem a definição.\n\nO Kit CachoViva foi feito pra isso: o Passo 1 sela e define, o Passo 2 prolonga o resultado. Resultado: cacho definido por *2 dias*.\n\nTá por R$ 49,99 no lançamento. Quer testar? 👇\nSó responder SIM.`,

  'sem-rotina': (name) =>
    `Oi, ${name}! ❤️\n\nSeu cacho está *em descoberta* — e que fase boa! É hora de encontrar os produtos certos pro seu cabelo.\n\nO Kit CachoViva é o ponto de partida ideal: 3 passos simples que dão conta do essencial — definir, recuperar e perfumar. Sem complicação.\n\nPreço de lançamento: R$ 49,99 (de R$ 89,90). Quer começar essa jornada? 👇\nResponda SIM que eu mando o link.`,

  upsell_equilibrado: (name) =>
    `Oi, ${name}! ❤️\n\nSeu cabelo já está saudável — seu diagnóstico mostrou isso! Que tal dar um upgrade?\n\nO Kit CachoViva + Reparador de Pontas é a combinação perfeita pra manter os fios fortes, definidos e cheirosos. E você leva os dois por R$ 64,99 (em vez de R$ 74,90).\n\nQuer garantir esse combo? 👇\nResponda SIM e eu te mando o link especial.`,

  upsell_followup: (name) =>
    `${name}, ainda dá tempo de garantir o combo com o precinho especial de R$ 64,99. ⏳\n\nÉ só responder SIM aqui que eu mando o link. Oferta válida só no lançamento!`,

  followup_48h: (name) =>
    `Oi, ${name}! Ainda pensando no Kit CachoViva? 😊\n\nSó pra lembrar: o preço de lançamento é R$ 49,99 (de R$ 89,90) e os kits estão saindo rápido.\n\nSe quiser garantir o seu, é só responder SIM aqui que eu mando o link direto.\n\nBeijo e cacho definido! 💁🏾‍♀️`,

  vip_welcome: (name) =>
    `${name}, bem-vinda à lista VIP da CachoViva! 🎉\n\nVocê vai receber novidades, ofertas exclusivas e avisar primeiro quando o lançamento chegar.\n\nEnquanto isso, quer garantir seu kit com antecedência? Responda SIM aqui que eu te mando o link exclusivo da pré-venda.`,

  kit_offer: (name) =>
    `${name}, que bom que você tem interesse no Kit CachoViva! 💁🏾‍♀️\n\nEle está em pré-venda por R$ 49,99 (de R$ 89,90) e você leva:\n✅ Passo 1 — Definição Intensa 500ml\n✅ Passo 2 — Day After 250ml\n✅ Brinde: Perfume Capilar Lavine 30ml\n\nQuer comprar agora? 👇\nÉ só responder SIM que eu mando o link.`,
};

module.exports = { send, MESSAGES };
