const API_BASE = 'http://localhost:3001/api';

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
      'Mantenha a frequência de lavagem ideal para seu tipo de cacho',
      'Continue alternando hidratação, nutrição e reconstrução semanalmente',
      'Faça um cronograma capilar a cada 3 meses para reavaliar as necessidades',
      'Use finalizadores com proteção térmica se usar calor',
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
      'URGENTE: Faça uma reconstrução com queratina ou aminoácidos',
      'Reduza hidratações para 1x por semana durante 1 mês',
      'Invista em produtos com proteínas (queratina, colágeno, argenina)',
      'Evite banhos muito quentes e selamento com água fria',
      'Após 1 mês, reavalie e monte um cronograma equilibrado',
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
      'Invista em máscaras de hidratação com aloe vera, glicerina, pantenol',
      'Faça hidratação 2x por semana nas primeiras 3 semanas',
      'Use leave-in com agentes umectantes no dia a dia',
      'Técnica de umidade: borrifar água + leave-in diariamente',
      'Finalize com gelatina para selar a cutícula',
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
      'Faça uma limpeza profunda com shampoo antirresíduos já na próxima lavagem',
      'Reduza a frequência de nutrição — no máximo 1x a cada 15 dias',
      'Prefira finalizadores leves (gelatina, spray, mousse) em vez de cremes densos',
      'Evite óleos pesados (óleo de rícino, manteiga de karité) por enquanto',
      'Aumente a frequência de lavagem para evitar acúmulo',
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
      'Priorize reconstrução com queratina a cada 15 dias',
      'Finalize sempre com água fria para selar as cutículas',
      'Use finalizadores com filmógenos (gelatina, linhaça)',
      'Evite químicas e calor excessivo até a cutícula se recuperar',
      'Invista em um cronograma: reconstrução → hidratação → nutrição',
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
      'Comece com um cronograma capilar simples: H → N → R a cada semana',
      'Identifique seu tipo de cacho (2A a 4C) e porosidade',
      'Invista em 3 máscaras: uma de hidratação, uma nutrição, uma reconstrução',
      'Crie o hábito de lavar o cabelo com frequência regular',
      'Use finalizador adequado para seu tipo de cacho',
    ],
  },
];

const letters = ['A', 'B', 'C', 'D'];
let currentQuestion = 0;
let answers = [];
let leadData = null;

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function startQuiz() {
  currentQuestion = 0;
  answers = [];
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
  document.querySelectorAll('.option-btn').forEach((btn, i) => {
    btn.classList.toggle('selected', i === index);
  });
  const nextBtn = document.getElementById('btnNext');
  nextBtn.disabled = false;
  nextBtn.style.opacity = '1';
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
  document.getElementById('resultName').textContent = diagnosis.name;
  document.getElementById('resultDesc').textContent = diagnosis.desc;
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

  showScreen('screen-result');
}

function validatePhone(phone) {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 11;
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatPhone(e) {
  let v = e.target.value.replace(/\D/g, '');
  if (v.length > 11) v = v.slice(0, 11);
  if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
  if (v.length > 10) v = `${v.slice(0, 10)}-${v.slice(10)}`;
  e.target.value = v;
}

async function submitForm(e) {
  e.preventDefault();
  const name = document.getElementById('fieldName').value.trim();
  const phone = document.getElementById('fieldWhatsapp').value.trim();
  const email = document.getElementById('fieldEmail').value.trim();

  let valid = true;
  if (!name) { valid = false; }
  if (!validatePhone(phone)) {
    document.getElementById('fieldWhatsapp').classList.add('error');
    valid = false;
  } else {
    document.getElementById('fieldWhatsapp').classList.remove('error');
  }
  if (!validateEmail(email)) {
    document.getElementById('fieldEmail').classList.add('error');
    valid = false;
  } else {
    document.getElementById('fieldEmail').classList.remove('error');
  }

  if (!valid) return;

  leadData = { name, phone, email };
  const diagnosis = calcDiagnosis();

  document.getElementById('loadingOverlay').classList.remove('hidden');

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
  } catch (err) {
    console.warn('Lead não salvou no servidor, mas diagnóstico será exibido:', err.message);
  }

  document.getElementById('loadingOverlay').classList.add('hidden');
  showResult(diagnosis);
}

function shareWhatsapp() {
  const name = leadData?.name || '';
  const diagnosisName = document.getElementById('resultName').textContent;
  const url = window.location.href;
  const text = `🧴 *Meu Diagnóstico Capilar CachoViva*%0A%0A👤 ${name}%0A📋 Diagnóstico: ${diagnosisName}%0A%0AFaça o seu também em: ${url}`;
  window.open(`https://wa.me/?text=${text}`, '_blank');
}

function restartQuiz() {
  currentQuestion = 0;
  answers = [];
  leadData = null;
  showScreen('screen-hero');
}

function toggleFaq(btn) {
  const item = btn.parentElement;
  item.classList.toggle('open');
  btn.classList.toggle('open');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('fieldWhatsapp').addEventListener('input', formatPhone);
  if (typeof lucide !== 'undefined') lucide.createIcons();
});
