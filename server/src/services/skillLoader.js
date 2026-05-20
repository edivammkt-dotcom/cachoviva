const fs = require('fs');
const path = require('path');
const axios = require('axios');

const SKILLS_DIR = path.resolve(__dirname, '../../skills');
const SKILL_FILES = [
  'editorial-line.md',
  'tone-of-voice.md',
  'content-pillars.md',
  'platform-rules.md',
  'formats.md'
];

let cachedSkills = null;

function loadLocalSkills() {
  if (!fs.existsSync(SKILLS_DIR)) {
    console.log('[Skills] Diretorio de skills nao encontrado:', SKILLS_DIR);
    return {};
  }

  const skills = {};
  for (const file of SKILL_FILES) {
    const filePath = path.join(SKILLS_DIR, file);
    if (fs.existsSync(filePath)) {
      skills[file.replace('.md', '')] = fs.readFileSync(filePath, 'utf-8');
    }
  }
  return skills;
}

async function loadSkillsFromGitHub(repo, branch = 'main', skillsDir = 'skills') {
  const skills = {};
  for (const file of SKILL_FILES) {
    const url = `https://raw.githubusercontent.com/${repo}/${branch}/${skillsDir}/${file}`;
    try {
      const resp = await axios.get(url, { timeout: 10000 });
      skills[file.replace('.md', '')] = resp.data;
      console.log(`[Skills] Carregado do GitHub: ${file}`);
    } catch (err) {
      console.log(`[Skills] Arquivo ${file} nao encontrado no GitHub (${url}): ${err.message}`);
    }
  }
  return skills;
}

function buildSystemPrompt(skills) {
  const preamble = `VOCÊ É O ESTRATEGISTA DE CONTEÚDO DA CACHOVIVA — marca de cosméticos para cabelos cacheados e crespos.
Sua função é criar conteúdo EXATAMENTE seguindo as diretrizes da marca abaixo.

REGRAS ABSOLUTAS:
1. SIGA a linha editorial abaixo — toda peça deve passar pelo teste: (a) parece premium? (b) resolve uma dor real? (c) é diferente da concorrência?
2. USE o tom de voz especificado para cada plataforma — TikTok = "amiga que entende de cacho", Instagram Feed = "referência de estilo e cuidado"
3. ESCOLHA o pilar de conteúdo adequado: Prova Social (35%), Educação que Vende (25%), Identidade (20%), Bastidor (10%), Conversão (10%)
4. RESPEITE as regras específicas de cada plataforma (limites de caracteres, formatos, frequência)
5. NUNCA use linguagem corporativa fria, superlativos vazios, termos técnicos sem explicação
6. NUNCA finja que o produto resolve tudo — seja honesta, mostre resultado real em cabelo real
7. A marca vende: Creme Cachos Definidos (kit, 2 dias de cacho), Day After Spray (definição instantânea, anti-frizz), Perfume Capilar Lavine
8. Persona principal: 22-38 anos, Nordeste, renda R$1.500-R$3.500

AGORA, SIGA AS DIRETRIZES ABAIXO:

`;
  const parts = [preamble];

  if (skills['editorial-line']) {
    parts.push(`## LINHA EDITORIAL\n${skills['editorial-line']}`);
  }
  if (skills['tone-of-voice']) {
    parts.push(`## TOM DE VOZ\n${skills['tone-of-voice']}`);
  }
  if (skills['content-pillars']) {
    parts.push(`## PILARES DE CONTEUDO\n${skills['content-pillars']}`);
  }
  if (skills['platform-rules']) {
    parts.push(`## REGRAS POR PLATAFORMA\n${skills['platform-rules']}`);
  }
  if (skills['formats']) {
    parts.push(`## FORMATOS\n${skills['formats']}`);
  }

  parts.push(`\n## INSTRUÇÃO FINAL
Ao receber um pedido de conteúdo:
1. Identifique primeiro em qual pilar de conteúdo ele se encaixa
2. Aplique o tom de voz correto para a plataforma
3. Use a abordagem da Regra dos 3 Segundos (contradição, curiosidade, prova visual ou identificação)
4. Gere EXATAMENTE o formato solicitado seguindo as especificações de proporção e layout
5. SEMPRE inclua CTA alinhado ao pilar
6. Retorne o conteúdo no formato JSON especificado, sem explicações adicionais`);

  return parts.join('\n\n');
}

async function loadSkills(options = {}) {
  if (cachedSkills && !options.forceReload) {
    return cachedSkills;
  }

  let skills = {};

  if (options.githubRepo) {
    skills = await loadSkillsFromGitHub(options.githubRepo, options.githubBranch, options.skillsDir);
  }

  const local = loadLocalSkills();
  skills = { ...skills, ...local };

  cachedSkills = {
    data: skills,
    systemPrompt: buildSystemPrompt(skills),
    loadedAt: new Date().toISOString()
  };

  const loadedFiles = Object.keys(skills);
  console.log(`[Skills] ${loadedFiles.length} skills carregadas: ${loadedFiles.join(', ') || 'nenhuma'}`);

  return cachedSkills;
}

function getCachedSkills() {
  return cachedSkills;
}

function clearCache() {
  cachedSkills = null;
}

module.exports = { loadSkills, getCachedSkills, clearCache, buildSystemPrompt };
