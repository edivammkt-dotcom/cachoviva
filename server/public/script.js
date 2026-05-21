const API_BASE = '/api';

const questions = [
  {
    q: 'Com que frequência você lava os cachos?',
    options: [
      { text: 'Dia sim, dia não (3-4x por semana)', scores: { H: 0, N: 0, R: 0, P: 0, B: 3 } },
      { text: '1 vez por semana', scores: { H: 1, N: 1, R: 0, P: 0, B: 1 } },
      { text: 'A cada 15 dias ou mais', scores: { H: 2, N: 1, R: 2, P: 2, B: -1 } },
      { text: 'Só quando vejo que está sujo', scores: { H: 1, N: 2, R: 1, P: 3, B: -2 } },
    ],
  },
  {
    q: 'Qual a sua maior dificuldade ao cuidar dos cachos?',
    options: [
      { text: 'Frizz e volume excessivo', scores: { H: 3, N: 0, R: 0, P: 1, B: 0 } },
      { text: 'Cabelo pesado e sem movimento', scores: { H: 0, N: 3, R: 0, P: 1, B: 0 } },
      { text: 'Cabelo ressecado e quebradiço', scores: { H: 0, N: 0, R: 3, P: 1, B: 0 } },
      { text: 'Cachos sem definição que não duram', scores: { H: 1, N: 1, R: 1, P: 3, B: 0 } },
    ],
  },
  {
    q: 'Você sabe a diferença entre hidratação, nutrição e reconstrução?',
    options: [
      { text: 'Sim, e sigo um cronograma capilar', scores: { H: 0, N: 0, R: 0, P: 0, B: 4 } },
      { text: 'Já ouvi falar, mas não aplico', scores: { H: 0, N: 0, R: 0, P: 2, B: 0 } },
      { text: 'Sei que são diferentes, mas não sei quando usar', scores: { H: 0, N: 0, R: 0, P: 3, B: 0 } },
      { text: 'Não faço ideia do que é', scores: { H: 0, N: 0, R: 0, P: 4, B: -1 } },
    ],
  },
  {
    q: 'Com que frequência você faz cronograma capilar?',
    options: [
      { text: 'Toda semana, religiosamente', scores: { H: 0, N: 0, R: 0, P: 0, B: 4 } },
      { text: 'De vez em quando, sem regularidade', scores: { H: 0, N: 0, R: 0, P: 2, B: 1 } },
      { text: 'Já tentei, mas não consegui manter', scores: { H: 0, N: 0, R: 0, P: 3, B: 0 } },
      { text: 'Nunca fiz, lavo e pronto', scores: { H: 0, N: 0, R: 0, P: 4, B: -1 } },
    ],
  },
  {
    q: 'Qual desses problemas seu cabelo mais apresenta?',
    options: [
      { text: 'Fica elástico e mole quando molha', scores: { H: 3, N: 0, R: 3, P: 0, B: -2 } },
      { text: 'Fica pesado, com aspecto ensebado', scores: { H: 0, N: 3, R: 0, P: 1, B: -1 } },
      { text: 'Fica opaco, sem brilho e sem vida', scores: { H: 2, N: 0, R: 2, P: 0, B: 0 } },
      { text: 'Perde a definição em poucas horas', scores: { H: 1, N: 1, R: 1, P: 3, B: 0 } },
    ],
  },
  {
    q: 'Quais finalizadores você usa no dia a dia?',
    options: [
      { text: 'Gelatina + creme de pentear + óleo (os 3)', scores: { H: 0, N: 0, R: 0, P: 0, B: 3 } },
      { text: 'Só creme de pentear', scores: { H: 0, N: 0, R: 0, P: 2, B: 1 } },
      { text: 'Só óleo ou finalizador oleoso', scores: { H: 0, N: 2, R: 0, P: 2, B: 0 } },
      { text: 'Não uso finalizador', scores: { H: 0, N: 0, R: 0, P: 4, B: -1 } },
    ],
  },
  {
    q: 'Você faz pré-poo (umectação) antes da lavagem?',
    options: [
      { text: 'Sim, toda semana', scores: { H: 0, N: 0, R: 0, P: 0, B: 3 } },
      { text: 'Sim, a cada 15 dias', scores: { H: 0, N: 1, R: 0, P: 0, B: 1 } },
      { text: 'Raramente', scores: { H: 1, N: 0, R: 0, P: 1, B: 0 } },
      { text: 'Nunca ou não sei o que é', scores: { H: 0, N: 0, R: 0, P: 3, B: -1 } },
    ],
  },
  {
    q: 'Quanto tempo seu cabelo leva para secar naturalmente?',
    options: [
      { text: 'Demora horas — mais de 4h', scores: { H: 0, N: 0, R: 3, P: 0, B: -1 } },
      { text: 'Seca rápido — menos de 1h', scores: { H: 0, N: 2, R: 0, P: 0, B: 0 } },
      { text: 'Tempo médio — entre 1h e 3h', scores: { H: 0, N: 0, R: 0, P: 0, B: 2 } },
      { text: 'Nunca reparei', scores: { H: 0, N: 0, R: 0, P: 2, B: 0 } },
    ],
  },
];

const diagnoses = [
  {
    id: 'equilibrado',
    icon: '👑',
    icon_name: 'crown',
    badge: '🌟',
    badge_name: 'star',
    name: 'Cabelo Equilibrado',
    desc: 'Seus cachos estão no caminho certo! Você tem uma rotina capilar consistente e seus fios agradecem.',
    meaning: 'Seu cabelo está em equilíbrio entre hidratação, nutrição e reconstrução. Você entende as necessidades dos fios e aplica os produtos certos na frequência ideal. Continue assim!',
    calendar: [
      { day: 'Seg', icon_name: 'droplets', treatment: 'Hidratação' },
      { day: 'Qua', icon_name: 'sparkles', treatment: 'Nutrição' },
      { day: 'Sex', icon_name: 'wrench', treatment: 'Reconstrução' },
    ],
    tips: [
      'Use o Creme Cachos Definidos como leave-in — o Óleo de Argan e a Manteiga de Karité mantêm seus fios no ponto certo',
      'No dia seguinte, borrife o Spray Day After com Efeito Memória para reativar os cachos',
      'O kit foi feito para manter o que já funciona — sem desregular sua rotina',
      'Continue lavando na frequência ideal para seu tipo de cacho',
    ],
  },
  {
    id: 'ressaca',
    icon: '🔄',
    icon_name: 'refresh-cw',
    badge: '⚠️',
    badge_name: 'alert-triangle',
    name: 'Cabelo Ressaca',
    desc: 'Seu cabelo está "de ressaca" — excesso de hidratação e falta de proteína!',
    meaning: 'Seu cabelo está mole, elástico e parece "emborrachado" quando molha? Isso é sinal de excesso de hidratação e falta de reconstrução. Os fios perderam a rigidez natural porque a cutícula está sobrecarregada de água. Hora de dar um choque de proteína!',
    calendar: [
      { day: 'Seg', icon_name: 'wrench', treatment: 'RECONSTRUÇÃO' },
      { day: 'Qua', icon_name: 'droplets', treatment: 'Hidratação leve' },
      { day: 'Sex', icon_name: 'wrench', treatment: 'RECONSTRUÇÃO' },
    ],
    tips: [
      'Simplifique: o Creme Cachos Definidos entrega hidratação (Óleo de Argan) e nutrição (Manteiga de Karité) num só passo',
      'Evite alternar entre vários produtos — o desequilíbrio muitas vezes vem do excesso de camadas',
      'O Spray Day After mantém o resultado no dia seguinte sem desregular o fio',
      'Use o kit por 15 dias e observe seus fios — às vezes menos produtos é o equilíbrio que falta',
    ],
  },
  {
    id: 'sedento',
    icon: '💧',
    icon_name: 'droplets',
    badge: '🏜️',
    badge_name: 'sun',
    name: 'Cabelo Sedento',
    desc: 'Seus cachos estão pedindo água! Eles precisam de hidratação urgente.',
    meaning: 'Seu cabelo está opaco, sem brilho e com frizz excessivo. Isso indica que os fios estão desidratados e precisam repor água e umidade. A cutícula está aberta e o cabelo não consegue reter a hidratação por muito tempo.',
    calendar: [
      { day: 'Seg', icon_name: 'droplets', treatment: 'HIDRATAÇÃO' },
      { day: 'Qua', icon_name: 'droplets', treatment: 'HIDRATAÇÃO' },
      { day: 'Sex', icon_name: 'sparkles', treatment: 'Nutrição' },
    ],
    tips: [
      'O Creme Cachos Definidos tem pH 4.0–4.5 que sela a cutícula e retém a hidratação nos fios',
      'O Óleo de Argan hidrata e a Manteiga de Karité nutre — tudo num leave-in sem enxágue',
      'No dia seguinte, o Spray Day After com Aloé Vera reativa os cachos sem molhar',
      'O Day After tem Proteção Térmica — use antes do difusor para potencializar o efeito',
    ],
  },
  {
    id: 'pesado',
    icon: '⚖️',
    icon_name: 'weight',
    badge: '🛢️',
    badge_name: 'chevrons-down',
    name: 'Cabelo Pesado',
    desc: 'Seu cabelo está sobrecarregado! Muita nutrição e acúmulo de produtos.',
    meaning: 'Seu cabelo está pesado, sem movimento, com aspecto ensebado ou com acúmulo de produtos. Isso acontece quando há excesso de nutrição (óleos, manteigas) ou quando os finalizadores são muito densos para seu tipo de fio.',
    calendar: [
      { day: 'Seg', icon_name: 'spray-can', treatment: 'Limpeza profunda' },
      { day: 'Qua', icon_name: 'droplets', treatment: 'Hidratação' },
      { day: 'Sex', icon_name: 'wrench', treatment: 'Reconstrução' },
    ],
    tips: [
      'O Creme Cachos Definidos tem 0% Petrolatos — não acumula nos fios como cremes convencionais',
      'Use uma quantidade do tamanho de uma noz — o suficiente para definir sem pesar',
      'O pH 4.0–4.5 sela a cutícula e impede que resíduos externos entrem no fio',
      'O Spray Day After é seco e leve — redefine sem adicionar peso extra',
    ],
  },
  {
    id: 'poroso',
    icon: '🌀',
    icon_name: 'wind',
    badge: '🔬',
    badge_name: 'microscope',
    name: 'Cabelo Poroso',
    desc: 'Seu cabelo tem porosidade alta — absorve tudo mas não retém nada!',
    meaning: 'Seu cabelo demora a secar, absorve água como esponja mas perde definição rápido. A cutícula está muito aberta, o que faz com que a hidratação entre mas também saia facilmente. Seu cabelo precisa de reconstrução para fechar as cutículas.',
    calendar: [
      { day: 'Seg', icon_name: 'wrench', treatment: 'RECONSTRUÇÃO' },
      { day: 'Qua', icon_name: 'droplets', treatment: 'Hidratação' },
      { day: 'Sex', icon_name: 'sparkles', treatment: 'Nutrição leve' },
    ],
    tips: [
      'O pH 4.0–4.5 do Creme Cachos Definidos ajuda a fechar as cutículas dos fios porosos',
      'A Manteiga de Karité sela a umidade dentro do fio',
      'Finalize com água fria para potencializar o selamento do pH balanceado',
      'O Spray Day After tem Proteção UV e Térmica — protege contra agressores que pioram a porosidade',
    ],
  },
  {
    id: 'sem-rotina',
    icon: '🌱',
    icon_name: 'sprout',
    badge: '📋',
    badge_name: 'clipboard-list',
    name: 'Cabelo sem Rotina',
    desc: 'Você ainda não descobriu o poder de um cronograma capilar!',
    meaning: 'Seu cabelo está "sem rumo" — você não segue uma rotina definida, usa produtos aleatórios e não sabe identificar o que os fios precisam. O resultado é um cabelo inconsistente: ora bom, ora ruim. Hora de montar um plano!',
    calendar: [
      { day: 'Seg', icon_name: 'droplets', treatment: 'Hidratação' },
      { day: 'Qua', icon_name: 'sparkles', treatment: 'Nutrição' },
      { day: 'Sex', icon_name: 'wrench', treatment: 'Reconstrução' },
    ],
    tips: [
      'Creme Cachos Definidos no dia da lavagem — aplique como leave-in, sem enxaguar',
      'Spray Day After no dia seguinte — borrife e modele os cachos',
      'Sem cronograma capilar, sem 7 produtos — só dois passos, dois minutos',
      'A consistência vem da simplicidade: lave, aplique, finalize. No dia seguinte, borrife e modele',
    ],
  },
];

const letters = ['A', 'B', 'C', 'D'];
const encouragements = [
  'Ótimo! Já sabemos mais sobre seus fios.',
  'Bom! Continue que está quase lá.',
  'Perfeito! Mais algumas e seu diagnóstico fica pronto.',
  'Show! Você está entendendo seu cabelo como nunca.',
  'Mandou bem! Só mais algumas perguntas.',
  'Que legal! Seu diagnóstico vai ser incrível.',
  'Última! Vamos nessa!',
];

const GA_ID = 'G-XXXXXXXXXX';

function gaEvent(action, label) {
  try {
    if (typeof gtag === 'function') {
      gtag('event', action, { event_category: 'engagement', event_label: label });
    }
  } catch(e) {}
}

function salvarProgresso() {
  try {
    sessionStorage.setItem('cv_quiz_current', JSON.stringify(currentQuestion));
    sessionStorage.setItem('cv_quiz_answers', JSON.stringify(answers));
  } catch(e) {}
}

function carregarProgresso() {
  try {
    var q = sessionStorage.getItem('cv_quiz_current');
    var a = sessionStorage.getItem('cv_quiz_answers');
    if (q !== null && a !== null) {
      currentQuestion = JSON.parse(q);
      answers = JSON.parse(a);
      if (Array.isArray(answers) && answers.length > 0) return true;
    }
  } catch(e) {}
  return false;
}

function limparProgresso() {
  try {
    sessionStorage.removeItem('cv_quiz_current');
    sessionStorage.removeItem('cv_quiz_answers');
  } catch(e) {}
}

let currentQuestion = 0;
let answers = [];
let leadData = null;

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function startQuiz() {
  gaEvent('start_quiz', 'hero_cta');
  if (!carregarProgresso()) {
    currentQuestion = 0;
    answers = [];
  }
  showScreen('screen-quiz');
  renderQuestion();
}

function renderQuestion() {
  const q = questions[currentQuestion];
  const total = questions.length;

  document.getElementById('progressFill').style.width = `${((currentQuestion + 1) / total) * 100}%`;
  document.getElementById('progressText').textContent = `${currentQuestion + 1} de ${total}`;

  const body = document.getElementById('quizBody');
  body.innerHTML = `
    <div class="question-number">Pergunta ${currentQuestion + 1}</div>
    <div class="question-text">${q.q}</div>
    <div class="options-grid" id="optionsGrid">
      ${q.options.map((opt, i) => `
        <button class="option-btn ${answers[currentQuestion] === i ? 'selected' : ''}"
                onclick="selectOption(${i})">
          <span class="option-letter">${letters[i]}</span>
          <span class="option-label">${opt.text}</span>
          <span class="option-dot"></span>
        </button>
      `).join('')}
    </div>
  `;

  document.getElementById('btnPrev').classList.toggle('hidden', currentQuestion === 0);

  const encouragementEl = document.getElementById('quizEncouragement') || document.createElement('p');
  if (!encouragementEl.id) {
    encouragementEl.id = 'quizEncouragement';
    encouragementEl.className = 'quiz-encouragement';
    document.querySelector('.quiz-card').appendChild(encouragementEl);
  }
  if (currentQuestion < questions.length - 1) {
    encouragementEl.textContent = encouragements[currentQuestion] || '';
  } else {
    encouragementEl.textContent = '⚡ Última pergunta!';
  }

  // MUDANÇA 11
  atualizarEncorajamento(currentQuestion + 1);

  const nextBtn = document.getElementById('btnNext');
  if (currentQuestion < total - 1) {
    nextBtn.innerHTML = 'Próximo <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  } else {
    nextBtn.innerHTML = 'Ver Resultado <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  nextBtn.disabled = answers[currentQuestion] === undefined;
  nextBtn.style.opacity = answers[currentQuestion] === undefined ? '0.5' : '1';
}

function selectOption(index) {
  answers[currentQuestion] = index;
  gaEvent('answer_question', 'q' + (currentQuestion + 1));
  document.querySelectorAll('.option-btn').forEach((btn, i) => {
    btn.classList.toggle('selected', i === index);
  });
  const nextBtn = document.getElementById('btnNext');
  nextBtn.disabled = false;
  nextBtn.style.opacity = '1';
  salvarProgresso();
}

function nextQuestion() {
  if (answers[currentQuestion] === undefined) return;
  if (currentQuestion < questions.length - 1) {
    currentQuestion++;
    renderQuestion();
  } else {
    showScreen('screen-form');
  }
}

function prevQuestion() {
  if (currentQuestion > 0) {
    currentQuestion--;
    renderQuestion();
  }
}

function calcDiagnosis() {
  const scores = { H: 0, N: 0, R: 0, P: 0, B: 0 };

  questions.forEach((q, qi) => {
    const ansIdx = answers[qi];
    if (ansIdx !== undefined) {
      const s = q.options[ansIdx].scores;
      scores.H += s.H || 0;
      scores.N += s.N || 0;
      scores.R += s.R || 0;
      scores.P += s.P || 0;
      scores.B += s.B || 0;
    }
  });

  if (scores.B >= 9) return { ...diagnoses[0], scores };
  if (scores.H >= 4 && scores.R >= 4) return { ...diagnoses[1], scores };
  if (scores.H >= 5 && scores.R < 4) return { ...diagnoses[2], scores };
  if (scores.N >= 5) return { ...diagnoses[3], scores };
  if (scores.R >= 5) return { ...diagnoses[4], scores };
  if (scores.P >= 7) return { ...diagnoses[5], scores };
  if (scores.H >= 3) return { ...diagnoses[2], scores };
  if (scores.N >= 3) return { ...diagnoses[3], scores };
  if (scores.R >= 3) return { ...diagnoses[4], scores };
  return { ...diagnoses[5], scores };
}

function showResult(diagnosis) {
  document.getElementById('resultBadge').innerHTML = `<i data-lucide="${diagnosis.badge_name}" style="width:48px;height:48px;stroke:var(--gold);stroke-width:1.5;display:block;margin:0 auto"></i>`;
  document.getElementById('resultTitle').textContent = 'Diagnóstico Completo';
  document.getElementById('resultSub').textContent = leadData ? `Para ${leadData.name}` : 'Seu diagnóstico capilar personalizado';
  document.getElementById('resultIcon').innerHTML = `<i data-lucide="${diagnosis.icon_name}" style="width:52px;height:52px;stroke:var(--gold-dark);stroke-width:1.5;display:block;margin:0 auto"></i>`;
  // MUDANÇA 12 — aplicar nome com identidade
  var nomePersonalizado = mapaResultados[diagnosis.name];
  if (nomePersonalizado) {
    document.getElementById('resultName').textContent = nomePersonalizado.nome;
    document.getElementById('resultDesc').textContent = nomePersonalizado.sub;
  } else {
    document.getElementById('resultName').textContent = diagnosis.name;
    document.getElementById('resultDesc').textContent = diagnosis.desc;
  }
  document.getElementById('resultMeaning').textContent = diagnosis.meaning;

  const cal = document.getElementById('resultCalendar');
  cal.innerHTML = diagnosis.calendar.map(d => `
    <div class="calendar-day">
      <div class="day-icon"><i data-lucide="${d.icon_name}" style="width:22px;height:22px;stroke:var(--gold-dark);stroke-width:1.5;display:block;margin:0 auto"></i></div>
      <div class="day-label">${d.day}</div>
      <div class="day-treatment">${d.treatment}</div>
    </div>
  `).join('');

  const tips = document.getElementById('resultTips');
  tips.innerHTML = diagnosis.tips.map(t => `<li>${t}</li>`).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();

  // BLOCO 1 — productMatch personalizado
  var nomeDisplay = mapaResultados[diagnosis.name] ? mapaResultados[diagnosis.name].nome : diagnosis.name;
  var diagnosticKey = cleanKey(nomeDisplay);
  var match = productMatch[diagnosticKey] || productMatch["Cacho Equilibrado"];
  getContadorPerfil(diagnosticKey).then(function(contador) {
    var blocoMatch = document.getElementById('bloco-match');
    if (blocoMatch) blocoMatch.remove();
    var ctaEl = document.getElementById('bloco-cta-kit');
    if (ctaEl) ctaEl.remove();

    var blocoHTML =
      '<div id="bloco-match" style="background:linear-gradient(135deg,#fff3e8 0%,#ffe8d6 100%);border:2px solid #B8541A;border-radius:16px;padding:22px 24px 18px;margin:20px 0;position:relative;text-align:left;">' +
        '<div style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:#B8541A;color:#fff;font-size:11px;font-weight:700;padding:4px 18px;border-radius:20px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;">' +
          '🎯 KIT IDEAL PARA SEU PERFIL' +
        '</div>' +
        '<p style="font-size:17px;font-weight:800;color:#1a1a1a;margin:14px 0 10px;text-align:center;line-height:1.4;">' + match.titulo + '</p>' +
        '<p style="font-size:14px;color:#5a2e0e;line-height:1.8;margin-bottom:14px;">' + match.paragrafo + '</p>' +
        '<div style="display:flex;align-items:center;gap:8px;background:rgba(184,84,26,0.1);border-radius:10px;padding:12px 16px;margin-bottom:14px;">' +
          '<span style="font-size:14px;">🔥</span>' +
          '<span style="font-size:13px;color:#2a1a1b;font-weight:600;">' + contador + ' ' + match.urgencia + '</span>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:4px;margin-bottom:14px;font-size:13px;color:#4a2a0e;">' +
          '<span>✅ Desenvolvido para as necessidades do seu cacho</span>' +
          '<span>✅ 2 passos: Creme Cachos Definidos + Spray Day After</span>' +
          '<span>✅ Resultado visível desde o primeiro uso</span>' +
        '</div>' +
        '<div style="background:rgba(197,165,90,0.12);border-radius:10px;padding:14px 16px;margin-bottom:14px;text-align:center;">' +
          '<div style="font-size:12px;color:#7a6465;margin-bottom:2px;">⭐ O que estão dizendo</div>' +
          '<div style="font-size:13px;color:#2a1a1b;font-style:italic;line-height:1.5;">"Meus cachos ficaram definidos por 2 dias sem precisar refazer"</div>' +
        '</div>' +
      '</div>' +
      '<div id="bloco-cta-kit" style="margin:0 0 20px;text-align:center;">' +
        '<button onclick="garantirKit(\'' + diagnosticKey + '\')" style="display:block;width:100%;max-width:400px;margin:0 auto;padding:18px 24px;background:linear-gradient(135deg,#B8541A,#D4783A);color:#fff;border:none;border-radius:50px;font-size:17px;font-weight:800;cursor:pointer;text-align:center;box-shadow:0 6px 24px rgba(184,84,26,0.4);transition:all 0.3s ease;letter-spacing:0.3px;">' +
          '🔥 GARANTIR MEU KIT COM DESCONTO' +
        '</button>' +
        '<p style="font-size:12px;color:#999;text-align:center;margin-top:10px;line-height:1.5;">De R$89,90 por <strong style="color:#B8541A;font-size:16px;">R$49,99</strong><br>Frete grátis SE e BA · Brinde Perfume Capilar Inspiração Lavine</p>' +
        '<p style="font-size:11px;color:#bbb;margin-top:4px;">⏳ Pré-lançamento · Estoque limitado</p>' +
      '</div>';

    var details = document.querySelector('.result-details');
    if (details) {
      details.insertAdjacentHTML('beforebegin', blocoHTML);
    }
  });

  showScreen('screen-result');
}

function validatePhone(phone) {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 11;
}

function formatPhone(e) {
  let v = e.target.value.replace(/\D/g, '');
  if (v.length > 11) v = v.slice(0, 11);
  if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
  if (v.length > 10) v = `${v.slice(0, 10)}-${v.slice(10)}`;
  e.target.value = v;
  validateWppField(v);
}

function validateWppField(value) {
  const hint = document.getElementById('wppHint');
  const cleaned = value.replace(/\D/g, '');
  const input = document.getElementById('fieldWhatsapp');
  if (cleaned.length === 0) {
    hint.textContent = '';
    input.classList.remove('valid', 'error');
    return;
  }
  if (cleaned.length >= 10 && cleaned.length <= 11) {
    hint.textContent = '✓ Número válido';
    hint.style.color = '#25D366';
    input.classList.add('valid');
    input.classList.remove('error');
  } else {
    hint.textContent = 'Digite o número com DDD (ex: 11999999999)';
    hint.style.color = '#E85C4A';
    input.classList.add('error');
    input.classList.remove('valid');
  }
}

function copiarTexto(texto) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto);
    } else {
      var ta = document.createElement('textarea');
      ta.value = texto;
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  } catch(e) {}
}

async function submitForm(e) {
  e.preventDefault();
  const name = document.getElementById('fieldName').value.trim();
  const phone = document.getElementById('fieldWhatsapp').value.trim();
  const email = document.getElementById('fieldEmail') ? document.getElementById('fieldEmail').value.trim() : '';

  let valid = true;
  if (!name) { valid = false; }
  if (!validatePhone(phone)) {
    document.getElementById('fieldWhatsapp').classList.add('error');
    valid = false;
  } else {
    document.getElementById('fieldWhatsapp').classList.remove('error');
  }

  if (!valid) return;

  const diagnosis = calcDiagnosis();
  var diagnosticName = (mapaResultados[diagnosis.name] && mapaResultados[diagnosis.name].nome) || diagnosis.name;
  localStorage.setItem('cv_diagnostico', diagnosticName);
  localStorage.setItem('cv_diagnostico_data', new Date().toISOString());
  limparProgresso();
  gaEvent('submit_form', diagnosis ? diagnosis.id : 'unknown');

  leadData = { name, phone, email };

  document.getElementById('loadingOverlay').classList.remove('hidden');

  // PASSO 1 — mostra resultado na tela
  try { showResult(diagnosis); } catch(e) { console.warn(e); }

  // PASSO 2 — constroi mensagem do WhatsApp com diagnóstico + lista VIP
  var phoneClean = phone.replace(/\D/g, '');
  var waMsg = '';
  var waUrl = '';
  var waUrlFallback = '';

  if (phoneClean.length >= 10) {
    if (!phoneClean.startsWith('55')) phoneClean = '55' + phoneClean;
    var nomeResultado = (mapaResultados[diagnosis.name] && mapaResultados[diagnosis.name].nome) || diagnosis.name;
    var match = productMatch[cleanKey(nomeResultado)];
    var leadId = localStorage.getItem('cv_lead_id') || 'temp_' + Date.now();

    var msgParts = [
      '🧴 *MEU DIAGNÓSTICO CAPILAR CACHOVIVA*',
      '',
      '👤 *' + name + '*',
      '📋 *Tipo:* ' + nomeResultado,
      '',
      '📝 *O que significa:*',
      diagnosis.meaning,
      '',
      '📅 *Calendário recomendado:*',
    ];

    diagnosis.calendar.forEach(function(d) {
      msgParts.push('▸ ' + d.day + ' → ' + d.treatment);
    });

    msgParts.push('');
    msgParts.push('💡 *Dicas rápidas:*');
    diagnosis.tips.forEach(function(t) {
      msgParts.push('✅ ' + t);
    });

    if (match) {
      msgParts.push('');
      msgParts.push('💡 *Kit ideal para seu perfil:*');
      msgParts.push(match.paragrafo);
    }

    msgParts.push('');
    msgParts.push('━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━');
    msgParts.push('🎯 *ENTRE NA LISTA VIP DE LANÇAMENTO!*');
    msgParts.push('');
    msgParts.push('✅ Desconto especial sem pegadinhas');
    msgParts.push('✅ Acesso antecipado ao lançamento');
    msgParts.push('✅ Brinde exclusivo: Perfume Capilar 30ml');
    msgParts.push('');
    msgParts.push('👉 *Confirme seu lugar na lista VIP:*');
    msgParts.push(window.location.origin + '/?confirmar_lista=' + leadId);
    msgParts.push('');
    msgParts.push('Se não quiser entrar na lista VIP, apenas ignore esta mensagem.');

    waMsg = msgParts.join('\n');
    waUrl = 'https://wa.me/' + phoneClean + '?text=' + encodeURIComponent(waMsg);
    waUrlFallback = 'https://api.whatsapp.com/send?phone=' + phoneClean + '&text=' + encodeURIComponent(waMsg);
  }

  // PASSO 3 — COPIA PARA A ÁREA DE TRANSFERÊNCIA (sempre funciona)
  if (waMsg) {
    copiarTexto(waMsg);
  }

  // PASSO 4 — INJETA BOTÃO DO WHATSAPP NA TELA DE RESULTADO (aparece após o card do diagnóstico)
  var btnExistente = document.getElementById('btn-wa-auto');
  if (!btnExistente && waUrl) {
    var htmlBtn =
      '<div id="btn-wa-auto" style="margin:20px 0 10px;">' +
        '<a href="' + waUrlFallback + '" target="_blank" ' +
           'style="display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:18px 20px;' +
           'background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;border:none;border-radius:50px;' +
           'font-size:17px;font-weight:800;cursor:pointer;text-align:center;text-decoration:none;' +
           'box-shadow:0 6px 24px rgba(37,211,102,0.4);transition:all 0.3s ease;letter-spacing:0.3px;">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          'ABRIR WHATSAPP COM MEU DIAGNÓSTICO' +
        '</a>' +
        '<p style="font-size:12px;color:#888;text-align:center;margin-top:8px;">📋 Mensagem copiada! Cole no WhatsApp se necessário.</p>' +
      '</div>';

    var el = document.querySelector('.result-card');
    if (el) {
      el.insertAdjacentHTML('afterend', htmlBtn);
    }
  }

  // PASSO 5 — TENTA ABRIR WHATSAPP AUTOMATICAMENTE (navegação direta, sem popup)
  if (waUrl) {
    try { window.location.href = waUrl; } catch(e) {}
  }

  // PASSO 6 — salva lead no servidor (background)
  document.getElementById('loadingOverlay').classList.add('hidden');
  try {
    const resp = await fetch(`${API_BASE}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        phone,
        email,
        diagnosis: diagnosis.id,
        diagnosis_name: diagnosis.name,
        scores: diagnosis.scores,
        answers: answers.map((a, i) => ({
          question: questions[i].q,
          answer: questions[i].options[a].text,
          index: a,
        })),
        diagnosis_details: {
          icon: diagnosis.icon,
          name: diagnosis.name,
          desc: diagnosis.desc,
          meaning: diagnosis.meaning,
          calendar: diagnosis.calendar,
          tips: diagnosis.tips,
        },
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao salvar');
    }

    const data = await resp.json();
    leadData = data.lead || leadData;
    if (data.lead && data.lead.id) {
      localStorage.setItem('cv_lead_id', data.lead.id);
      localStorage.setItem('cv_nome', data.lead.name);
    }
  } catch (err) {
    console.warn('Lead não salvou no servidor, mas diagnóstico será exibido:', err.message);
  }
}

function shareWhatsapp() {
  const name = leadData?.name || '';
  const diagnosisName = document.getElementById('resultName').textContent;
  const url = window.location.href;
  const text = `🧴 *Meu Diagnóstico Capilar CachoViva*%0A%0A👤 ${name}%0A📋 Diagnóstico: ${diagnosisName}%0A%0AFaça o seu também em: ${url}`;
  window.open(`https://wa.me/?text=${text}`, '_blank');
}

function compartilharResultado() {
  gaEvent('share_result', 'compartilhar_btn');
  var nomeResultado = document.querySelector('#resultName')?.textContent || 'Cacho Equilibrado';
  var texto =
    'Fiz o diagnóstico capilar da CachoViva e descobri que meu cacho é ' +
    nomeResultado + '! 🌀\n\n' +
    'Você sabe o que o SEU cacho precisa? Faz o teste grátis (2 minutinhos) 👇\n' +
    'https://cachoviva.onrender.com';
  var encoded = encodeURIComponent(texto);
  var win = window.open('https://wa.me/?text=' + encoded, '_blank');
  if (!win || win.closed || typeof win.closed === 'undefined') {
    navigator.clipboard.writeText(texto.replace(/%0A%0A/g, '\n\n').replace(/%20/g, ' ')).then(function() {
      alert('Link copiado para a área de transferência! Cole no WhatsApp 💬');
    }).catch(function() {
      prompt('Copie o link abaixo e compartilhe no WhatsApp:', 'https://cachoviva.onrender.com');
    });
  }
}

function restartQuiz() {
  limparProgresso();
  currentQuestion = 0;
  answers = [];
  leadData = null;
  showScreen('screen-hero');
}

// Exit-intent
var exitIntentFired = false;
function fecharExitIntent() {
  document.getElementById('exitIntentOverlay').classList.remove('active');
}
document.addEventListener('mouseleave', function(e) {
  if (exitIntentFired) return;
  if (e.clientY > 0) return;
  var hero = document.getElementById('screen-hero');
  if (hero && hero.classList.contains('active')) {
    exitIntentFired = true;
    document.getElementById('exitIntentOverlay').classList.add('active');
    gaEvent('exit_intent', 'showed');
  }
});

// MUDANÇA 11
function atualizarEncorajamento(perguntaAtual) {
  var msgs = {
    1: "Ótimo começo! Seu diagnóstico está sendo montado.",
    2: "Continue! Cada resposta deixa o diagnóstico mais preciso.",
    3: "Você está na metade — já temos informações importantes.",
    4: "Indo bem! Quase na reta final.",
    5: "Só mais 3 perguntas. Você está quase lá!",
    6: "Ótimo! O diagnóstico está quase completo.",
    7: "Última etapa! Seu resultado personalizado está quase pronto.",
    8: "Perfeito! Finalizando seu diagnóstico..."
  };
  var el = document.getElementById('encorajamento-quiz');
  if (el && msgs[perguntaAtual]) {
    el.textContent = msgs[perguntaAtual];
    el.style.display = 'block';
  }
}

// MUDANÇA 12
var mapaResultados = {
  "Cabelo Equilibrado":   { nome: "Cacho Equilibrado ✨",    sub: "Seus fios estão no caminho certo — só falta o produto certo." },
  "Cabelo Seco":          { nome: "Cacho Sedento 💧",        sub: "Seus fios pedem hidratação urgente." },
  "Ressecado":            { nome: "Cacho Sedento 💧",        sub: "Seus fios pedem hidratação urgente." },
  "Excesso de Proteína":  { nome: "Cacho Proteico ⚖️",      sub: "Seus fios precisam de equilíbrio entre proteína e hidratação." },
  "Transição":            { nome: "Cacho em Renascimento 🌱",sub: "Você está numa das fases mais especiais do cabelo." },
  "Porosidade Alta":      { nome: "Cacho Poroso 🌊",         sub: "Seus fios absorvem muito mas não retêm — vamos resolver." },
  "Fragilidade":          { nome: "Cacho Sensível 🤍",       sub: "Seus fios precisam de força e cuidado redobrado." },
  "Cabelo Ressaca":       { nome: "Cacho Proteico ⚖️",      sub: "Seus fios precisam de equilíbrio entre proteína e hidratação." },
  "Cabelo Sedento":       { nome: "Cacho Sedento 💧",        sub: "Seus fios pedem hidratação urgente." },
  "Cabelo Pesado":        { nome: "Cacho Nutrido 🛢️",       sub: "Seus fios estão sobrecarregados — hora de leveza." },
  "Cabelo Poroso":        { nome: "Cacho Poroso 🌊",         sub: "Seus fios absorvem muito mas não retêm — vamos resolver." },
  "Cabelo sem Rotina":    { nome: "Cacho em Descoberta 🔍",  sub: "Você está prestes a montar a rotina ideal para seus fios." }
};

function cleanKey(str) {
  return str.replace(/\p{Extended_Pictographic}/gu, '').replace(/\s+/g, ' ').trim();
}

const productMatch = {
  "Cacho Sedento": {
    titulo: "O kit com pH que sela a hidratação nos fios",
    paragrafo: "Seu cabelo resseca porque a cutícula não retém umidade. O Creme Cachos Definidos tem pH 4.0–4.5 que sela a cutícula, enquanto o Óleo de Argan hidrata e a Manteiga de Karité nutre — tudo num leave-in que não precisa enxaguar. No dia seguinte, o Spray Day After com Aloé Vera reativa a definição sem molhar. Resultado: hidratação que fica retida por mais tempo.",
    urgencia: "pessoas com cacho sedento já reservaram o kit"
  },
  "Cacho Pesado": {
    titulo: "O kit leve que define sem acumular resíduo",
    paragrafo: "Seu cabelo acumulou resíduo de cremes convencionais. O Creme Cachos Definidos tem 0% Petrolatos — não deposita camadas que pesam. É leave-in com pH balanceado que sela a cutícula sem abrir espaço para novo acúmulo. O Spray Day After finaliza sem peso extra. Resultado: definição com leveza real.",
    urgencia: "pessoas com cacho pesado já reservaram o kit"
  },
  "Cacho Poroso": {
    titulo: "O kit com pH ácido que sela a porosidade dos fios",
    paragrafo: "Seu cabelo tem porosidade alta — absorve hidratação mas perde rápido. O Creme Cachos Definidos tem pH 4.0–4.5, que ajuda a fechar as cutículas e reter os ativos. A Manteiga de Karité sela a umidade. O Spray Day After tem Proteção UV e Térmica que blindam o fio contra agressores que pioram a porosidade. Resultado: o que hidrata fica dentro do cacho.",
    urgencia: "pessoas com cacho poroso já reservaram o kit"
  },
  "Cacho Proteico": {
    titulo: "O kit com hidratação e nutrição na medida certa",
    paragrafo: "Seu cabelo alterna entre ressecamento e oleosidade — sinal de desequilíbrio entre hidratação e nutrição. O Creme Cachos Definidos entrega Óleo de Argan (hidratação) e Manteiga de Karité (nutrição) num só passo, sem petrolatos que disfarçam o estado real do fio. O Spray Day After mantém o equilíbrio no dia seguinte. Resultado: cabelo mais previsível — você para de adivinhar.",
    urgencia: "pessoas com desequilíbrio capilar já reservaram o kit"
  },
  "Cacho Equilibrado": {
    titulo: "O kit para manter o que já funciona — por mais tempo",
    paragrafo: "Seu cabelo está equilibrado — o desafio é fazer a definição durar. O Creme Cachos Definidos potencializa seus cachos com Óleo de Argan e Manteiga de Karité, entregando definição e brilho. O Spray Day After com Efeito Memória reativa os cachos no segundo dia sem desfazer o que você criou. Resultado: a mesma beleza da lavagem no dia seguinte.",
    urgencia: "pessoas com cacho equilibrado já reservaram o kit"
  },
  "Cacho em Descoberta": {
    titulo: "O kit para quem quer resultado sem rotina complicada",
    paragrafo: "Você não tem uma rotina definida — cada lavagem é um resultado diferente. O kit CachoViva resolve: Creme Cachos Definidos no dia da lavagem (leave-in, sem enxaguar), Spray Day After no dia seguinte (borrifar e modelar). Sem mistério, sem 7 produtos, sem cronograma. Resultado: consistência real com o mínimo de esforço.",
    urgencia: "pessoas sem rotina já encontraram o método com o kit"
  },
  "Cacho Nutrido": {
    titulo: "O kit que não acumula — ideal para cabelo sobrecarregado",
    paragrafo: "Seu cabelo acumulou resíduo de cremes com petrolatos e parabenos. O Creme Cachos Definidos tem 0% Petrolatos — hidrata e nutre sem depositar camadas. O pH 4.0–4.5 sela a cutícula, impedindo que novos resíduos entrem. O Spray Day After é seco, leve, sem adicionar peso no dia seguinte. Resultado: cacho definido com leveza de verdade.",
    urgencia: "pessoas com cabelo sobrecarregado já reservaram o kit"
  },
  "Cacho em Renascimento": {
    titulo: "O kit para cabelo em transição que quer definição",
    paragrafo: "Seu cabelo está em transição — uma fase que merece produtos que respeitem as diferentes texturas. O Creme Cachos Definidos é indicado para todos os tipos de cabelo, com pH balanceado que não agride os fios em transformação. O Spray Day After define sem pesar, ideal para texturas mistas. Resultado: cachos definidos em qualquer estágio da transição.",
    urgencia: "pessoas em transição capilar já reservaram o kit"
  },
  "Cacho Sensível": {
    titulo: "O kit com fórmula limpa para cabelo frágil",
    paragrafo: "Seu cabelo está frágil, quebradiço — precisa de cuidados que não agridam. O Creme Cachos Definidos tem 0% Corante e 0% Petrolatos: hidrata e nutre sem ingredientes agressivos. O pH 4.0–4.5 sela a cutícula suavemente. O Spray Day After é 0% Sulfato e 0% Parabenos, com Proteção Térmica que evita danos por calor. Resultado: fios mais fortes com ingredientes que cuidam, não agridem.",
    urgencia: "pessoas com cabelo sensível já reservaram o kit"
  }
};

async function getContadorPerfil(diagnostico) {
  try {
    const res = await fetch(API_BASE + '/counters');
    const data = await res.json();
    const real = data[diagnostico] || 0;
    const semente = {
      "Cacho Sedento": 23, "Cacho Pesado": 11,
      "Cacho Poroso": 17, "Cacho Proteico": 9,
      "Cacho Equilibrado": 31, "Cacho em Descoberta": 14,
      "Cacho Nutrido": 8, "Cacho em Renascimento": 12,
      "Cacho Sensível": 7
    };
    return real + (semente[diagnostico] || 10);
  } catch {
    return Math.floor(Math.random() * 20) + 10;
  }
}

function garantirKit(diagnostico) {
  const leadId = localStorage.getItem('cv_lead_id');
  if (leadId) {
    fetch(API_BASE + '/leads/' + leadId + '/kit', { method: 'POST' }).catch(function() {});
    fetch(API_BASE + '/counters/' + encodeURIComponent(diagnostico), { method: 'POST' }).catch(function() {});
  }
  var modal = document.getElementById('waitlistConfirmModal');
  if (modal) modal.classList.add('active');
}

function fecharModalWaitlist() {
  var modal = document.getElementById('waitlistConfirmModal');
  if (modal) modal.classList.remove('active');
}

function toggleFaq(btn) {
  const item = btn.parentElement;
  item.classList.toggle('open');
  btn.classList.toggle('open');
}

function iniciarContador() {
  var launchDate = new Date('2026-06-19T00:00:00-03:00');
  var tentouServidor = false;

  function pad(n) { return String(n).padStart(2,'0'); }
  function tick() {
    var diff = Math.max(0, launchDate - new Date());
    var d = document;
    if (d.getElementById('c-dias'))  d.getElementById('c-dias').textContent  = pad(Math.floor(diff / 86400000));
    if (d.getElementById('c-horas')) d.getElementById('c-horas').textContent = pad(Math.floor((diff % 86400000) / 3600000));
    if (d.getElementById('c-min'))   d.getElementById('c-min').textContent   = pad(Math.floor((diff % 3600000) / 60000));
    if (d.getElementById('c-seg'))   d.getElementById('c-seg').textContent   = pad(Math.floor((diff % 60000) / 1000));
  }
  tick();
  setInterval(tick, 1000);

  if (!tentouServidor) {
    tentouServidor = true;
    fetch(API_BASE + '/launch').then(function(r) { return r.json(); }).then(function(data) {
      if (data && data.launch) {
        launchDate = new Date(data.launch);
        tick();
      }
    }).catch(function() {});
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Verifica se veio do link de confirmação da lista VIP
  var params = new URLSearchParams(window.location.search);
  var confirmarLista = params.get('confirmar_lista');
  if (confirmarLista) {
    fetch(API_BASE + '/leads/' + confirmarLista + '/confirmar-lista').then(function(r) {
      if (r.ok) {
        var modal = document.getElementById('waitlistConfirmModal');
        if (modal) modal.classList.add('active');
      }
    }).catch(function() {});
    window.history.replaceState({}, '', window.location.pathname);
  }

  const wppField = document.getElementById('fieldWhatsapp');
  if (wppField) {
    wppField.addEventListener('input', formatPhone);
    wppField.addEventListener('blur', () => validateWppField(wppField.value));
  }
  iniciarContador();

  var lazyImages = document.querySelectorAll('.hero-visual-img, .hero-logo-wrap img');
  lazyImages.forEach(function(img) {
    if (img.complete) { img.classList.add('loaded'); }
    else { img.addEventListener('load', function() { img.classList.add('loaded'); }); img.addEventListener('error', function() { img.classList.add('loaded'); }); }
  });

  if (typeof lucide !== 'undefined') lucide.createIcons();
  gaEvent('page_view', 'landing_page');
});
