#!/usr/bin/env node
/**
 * Fábrica de Apps MCP Server
 * Orquestrador central que coordena todos os agentes
 * Cria repositórios GitHub, gera PROJECT.md e direciona para cada agente
 */

const fs       = require('fs');
const path     = require('path');
const readline = require('readline');
const https    = require('https');

// ─── Configuração ─────────────────────────────────────────────────────────────
const GITHUB_TOKEN  = process.env.GITHUB_TOKEN  || '';
const GITHUB_USER   = process.env.GITHUB_USER   || '';
const FABRICA_PATH  = process.env.FABRICA_PATH  || path.join(__dirname);
const CLAUDE_MD     = fs.readFileSync(path.join(FABRICA_PATH, 'CLAUDE.md'), 'utf-8');

// ─── Helpers HTTP ─────────────────────────────────────────────────────────────
function githubRequest(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.github.com',
      path: endpoint,
      method,
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept':        'application/vnd.github+json',
        'User-Agent':    'fabrica-apps-mcp/1.0',
        'Content-Type':  'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(chunks) });
        } catch {
          resolve({ status: res.statusCode, body: chunks });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ─── Funções de negócio ───────────────────────────────────────────────────────

async function criarRepositorio(nomeApp, descricao, privado = false) {
  const nomeRepo = nomeApp
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  const res = await githubRequest('POST', '/user/repos', {
    name:        nomeRepo,
    description: descricao,
    private:     privado,
    auto_init:   true,
    gitignore_template: 'Node',
  });

  if (res.status !== 201) {
    throw new Error(`Erro ao criar repositório: ${JSON.stringify(res.body)}`);
  }

  return {
    nomeRepo,
    url:      res.body.html_url,
    cloneUrl: res.body.clone_url,
    full_name: res.body.full_name,
  };
}

async function criarArquivoNoRepo(fullName, filePath, conteudo, mensagem) {
  const encoded = Buffer.from(conteudo).toString('base64');
  const res = await githubRequest(
    'PUT',
    `/repos/${fullName}/contents/${filePath}`,
    { message: mensagem, content: encoded }
  );
  return res.status === 201 || res.status === 200;
}

function gerarProjectMd(dados) {
  const {
    nomeApp, descricao, publicoAlvo,
    cores, telas, schema, regrasNegocio, integracoes
  } = dados;

  return `# PROJECT.md — ${nomeApp}
> Contexto específico deste projeto. Leia junto com o CLAUDE.md.

## 1. Visão geral
- **Nome:** ${nomeApp}
- **Descrição:** ${descricao}
- **Público-alvo:** ${publicoAlvo || 'A definir'}
- **Stack:** React Native + Expo Router + Firebase + twrnc

---

## 2. Paleta de cores
\`\`\`typescript
const COLORS = {
  primary:    '${cores?.primary    || '#D63384'}',
  background: '${cores?.background || '#000000'}',
  surface:    '${cores?.surface    || '#1a1a1a'}',
  border:     '${cores?.border     || '#333333'}',
  text:       '${cores?.text       || '#FFFFFF'}',
  textMuted:  '${cores?.textMuted  || '#9e9e9e'}',
  error:      '${cores?.error      || '#ff4d4d'}',
  success:    '${cores?.success    || '#4ade80'}',
};
\`\`\`

---

## 3. Telas do app
${telas || `| Tela | Rota | Descrição |
|------|------|-----------|
| Splash/Auth | /index | Verifica login, redireciona |
| Login | /Login | Auth com Firebase |
| Home | /(tabs)/index | Tela principal |`}

---

## 4. Schema Firestore
\`\`\`
${schema || `usuarios/{uid}
  - nome: string
  - email: string
  - criadoEm: Timestamp`}
\`\`\`

---

## 5. Navegação
- Stack raiz: index → Login → (tabs)
- Tabs: definir conforme telas

---

## 6. Regras de negócio
${regrasNegocio || '- A definir com o Orquestrador'}

---

## 7. Integrações externas
${integracoes || '- Nenhuma por enquanto'}
`;
}

function gerarCursorRules(nomeApp) {
  return `# .cursorrules — ${nomeApp}
Você é um dev React Native especialista no projeto ${nomeApp}.

Antes de gerar qualquer código:
1. Use a ferramenta checar_padrao_lashmatch do MCP
2. Leia o PROJECT.md deste projeto
3. Siga obrigatoriamente os padrões da Seção 18 do CLAUDE.md

Regras obrigatórias:
- Firebase: após alterar firestore.rules ou índices, fazer deploy (CLAUDE.md Seção 0)
- Importar auth/firestore SOMENTE de utils/firebaseConfig.ts
- Cores sempre do PROJECT.md — nunca hardcoded
- tw() para layouts, StyleSheet para componentes complexos
- Fundo preto (#000) em todas as telas
- SafeAreaView como wrapper principal
- useFocusEffect para recarregar dados ao voltar
- Após login: router.replace('/(tabs)') — nunca router.push
`;
}

function gerarPromptAgente(tipo, nomeApp, projectMd) {
  const prompts = {
    ux: `# Agente UX — ${nomeApp}

Você é um designer UX especialista em apps mobile.
Leia o PROJECT.md abaixo e defina:

1. **Paleta de cores** — primária, fundo, superfície, texto
2. **Tipografia** — tamanhos para título, subtítulo, corpo, caption
3. **Componentes** — lista de componentes reutilizáveis necessários
4. **Fluxo de navegação** — diagrama em texto das telas e transições
5. **Estados de UI** — loading, erro, vazio, sucesso para cada tela

Padrão visual: dark mode, minimalista, profissional.
Cores devem ser coerentes com o público-alvo.

PROJECT.md:
${projectMd}

Retorne em formato Markdown estruturado.`,

    firebase: `# Agente Firebase — ${nomeApp}

Você é engenheiro Firebase sênior.
Leia o PROJECT.md e o CLAUDE.md (Seções 3-6) antes de responder.

Gere:
1. **firebaseConfig.ts** — configuração completa com variáveis de ambiente
2. **Schema Firestore** — todas as coleções com campos e tipos
3. **firestore.rules** — regras de segurança por usuário
4. **Índices** — índices compostos necessários
5. **.env.example** — variáveis de ambiente necessárias

**Obrigatório ao finalizar:** rodar deploy no projeto Firebase (regras/índices) — ver Seção 0 do CLAUDE.md. Ex.: \`npx firebase-tools deploy --only firestore:rules --project <PROJECT_ID>\`. Sem deploy, o app continua com regras antigas (ex.: permission-denied).

Regras obrigatórias (Seção 18 do CLAUDE.md):
- Exportar auth, firestore, storage centralizados
- Path: artifacts/\${app.options.appId}/users/\${uid}/...
- Nunca chamar getAuth(app) em componentes

PROJECT.md:
${projectMd}`,

    frontend: `# Agente Frontend (React Native) — ${nomeApp}

Você é dev React Native especialista em Expo.
Leia o PROJECT.md e CLAUDE.md antes de gerar código.

Para cada tela listada no PROJECT.md, gere:
1. O arquivo .tsx completo
2. Seguindo os padrões da Seção 18 do CLAUDE.md
3. Integrado com Firebase (auth + firestore)
4. Com tratamento de loading, erro e estado vazio

Ordem de geração:
1. app/_layout.tsx (Stack raiz com tema dark)
2. app/index.tsx (splash com onAuthStateChanged)
3. app/Login.tsx
4. app/(tabs)/_layout.tsx
5. Demais telas do PROJECT.md

Gere UMA tela por vez e aguarde aprovação antes da próxima.

PROJECT.md:
${projectMd}`,

    qa: `# Agente QA — ${nomeApp}

Você é QA Mobile especialista em React Native.
Revise cada tela gerada e identifique:

1. **Touch targets < 44px** — acessibilidade
2. **Memory leaks** — useEffect sem cleanup
3. **Anti-padrões Firebase** — getAuth(app) em componentes
4. **FlatList dentro de ScrollView** — bug de rolagem
5. **Diferenças iOS/Android** — não tratadas
6. **Campos sem validação** — antes de salvar no Firestore
7. **Cores fora da paleta** — do PROJECT.md
8. **Imports incorretos** — não usando utils/firebaseConfig.ts

Para cada problema encontrado:
- Classifique: 🔴 crítico / 🟡 médio / 🟢 baixo
- Explique o problema
- Mostre a correção exata

PROJECT.md:
${projectMd}`,
  };

  return prompts[tipo] || `Prompt para agente ${tipo} não encontrado.`;
}

function extrairSecao(numero) {
  const linhas = CLAUDE_MD.split('\n');
  const inicio = linhas.findIndex(l => l.match(new RegExp(`^## ${numero}\\.`)));
  if (inicio === -1) return `Seção ${numero} não encontrada.`;
  const fim = linhas.findIndex((l, i) => i > inicio && l.match(/^## \d+\./));
  return linhas.slice(inicio, fim === -1 ? undefined : fim).join('\n');
}

// ─── Ferramentas MCP ──────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: 'criar_projeto_completo',
    description: 'Cria um novo projeto completo: repositório GitHub + PROJECT.md + CLAUDE.md + .cursorrules. Use quando o usuário descrever uma ideia de app.',
    inputSchema: {
      type: 'object',
      properties: {
        nomeApp:      { type: 'string', description: 'Nome do app (ex: PetShop Manager)' },
        descricao:    { type: 'string', description: 'O que o app faz em 1-2 frases' },
        publicoAlvo:  { type: 'string', description: 'Quem vai usar o app' },
        privado:      { type: 'boolean', description: 'Repositório privado? (default: false)' },
        cores:        { type: 'object', description: 'Paleta de cores { primary, background, surface }' },
        telas:        { type: 'string', description: 'Tabela markdown com as telas do app' },
        schema:       { type: 'string', description: 'Schema Firestore em texto' },
        regrasNegocio:{ type: 'string', description: 'Regras de negócio principais' },
        integracoes:  { type: 'string', description: 'Integrações externas necessárias' },
      },
      required: ['nomeApp', 'descricao'],
    },
  },
  {
    name: 'obter_prompt_agente',
    description: 'Retorna o prompt completo para um agente específico. Use para direcionar o trabalho para o agente certo.',
    inputSchema: {
      type: 'object',
      properties: {
        tipo:     { type: 'string', enum: ['ux', 'firebase', 'frontend', 'qa'], description: 'Tipo do agente' },
        nomeApp:  { type: 'string', description: 'Nome do app' },
        projectMd:{ type: 'string', description: 'Conteúdo do PROJECT.md' },
      },
      required: ['tipo', 'nomeApp'],
    },
  },
  {
    name: 'listar_repos_github',
    description: 'Lista os repositórios GitHub do usuário para ver projetos existentes.',
    inputSchema: {
      type: 'object',
      properties: {
        limite: { type: 'number', description: 'Quantidade de repos (default: 10)' },
      },
      required: [],
    },
  },
  {
    name: 'criar_branch',
    description: 'Cria uma branch no repositório para um agente trabalhar.',
    inputSchema: {
      type: 'object',
      properties: {
        fullName: { type: 'string', description: 'user/repo' },
        branch:   { type: 'string', description: 'Nome da branch (ex: feature/tela-login)' },
      },
      required: ['fullName', 'branch'],
    },
  },
  {
    name: 'ler_secao_claude',
    description: 'Lê uma seção específica do CLAUDE.md para o agente usar como referência.',
    inputSchema: {
      type: 'object',
      properties: {
        numero: { type: 'number', description: 'Número da seção' },
      },
      required: ['numero'],
    },
  },
  {
    name: 'checar_padrao_lashmatch',
    description: 'Retorna os padrões obrigatórios do projeto (Seção 18). Chamar antes de gerar qualquer código.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'gerar_project_md',
    description: 'Gera o conteúdo de um PROJECT.md completo a partir dos dados do app.',
    inputSchema: {
      type: 'object',
      properties: {
        nomeApp:      { type: 'string' },
        descricao:    { type: 'string' },
        publicoAlvo:  { type: 'string' },
        cores:        { type: 'object' },
        telas:        { type: 'string' },
        schema:       { type: 'string' },
        regrasNegocio:{ type: 'string' },
        integracoes:  { type: 'string' },
      },
      required: ['nomeApp', 'descricao'],
    },
  },
  {
    name: 'status_fabrica',
    description: 'Mostra o status da fábrica: configuração, GitHub conectado, CLAUDE.md carregado.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

// ─── Executor ─────────────────────────────────────────────────────────────────
async function executar(nome, args) {
  switch (nome) {

    case 'criar_projeto_completo': {
      const repo = await criarRepositorio(
        args.nomeApp,
        args.descricao,
        args.privado || false
      );

      const projectMd = gerarProjectMd(args);
      const cursorrules = gerarCursorRules(args.nomeApp);

      await criarArquivoNoRepo(repo.full_name, 'PROJECT.md',   projectMd,   'chore: add PROJECT.md');
      await criarArquivoNoRepo(repo.full_name, '.cursorrules', cursorrules,  'chore: add .cursorrules');
      await criarArquivoNoRepo(
        repo.full_name, 'CLAUDE.md', CLAUDE_MD,
        'chore: add CLAUDE.md base de conhecimento'
      );

      return `✅ Projeto criado com sucesso!

📦 Repositório: ${repo.url}
🔗 Clone: ${repo.cloneUrl}

Arquivos criados:
- CLAUDE.md (base de conhecimento dos agentes)
- PROJECT.md (contexto do ${args.nomeApp})
- .cursorrules (instruções para o Cursor)

Próximos passos:
1. Clone o repositório: git clone ${repo.cloneUrl}
2. Abra no Cursor
3. Peça o prompt do Agente UX: obter_prompt_agente({ tipo: 'ux', nomeApp: '${args.nomeApp}' })
4. Depois Firebase, Frontend e QA em sequência`;
    }

    case 'obter_prompt_agente': {
      const projectMd = args.projectMd || '';
      return gerarPromptAgente(args.tipo, args.nomeApp, projectMd);
    }

    case 'listar_repos_github': {
      const limite = args.limite || 10;
      const res = await githubRequest('GET', `/user/repos?per_page=${limite}&sort=updated`);
      if (res.status !== 200) throw new Error('Erro ao listar repositórios');
      return res.body
        .map(r => `• ${r.full_name} — ${r.description || 'sem descrição'} [${r.private ? '🔒 privado' : '🌐 público'}]`)
        .join('\n');
    }

    case 'criar_branch': {
      // Pegar SHA do main
      const refRes = await githubRequest('GET', `/repos/${args.fullName}/git/ref/heads/main`);
      if (refRes.status !== 200) throw new Error('Branch main não encontrada');
      const sha = refRes.body.object.sha;

      const branchRes = await githubRequest('POST', `/repos/${args.fullName}/git/refs`, {
        ref: `refs/heads/${args.branch}`,
        sha,
      });

      if (branchRes.status !== 201) throw new Error(`Erro ao criar branch: ${JSON.stringify(branchRes.body)}`);
      return `✅ Branch "${args.branch}" criada em ${args.fullName}`;
    }

    case 'ler_secao_claude':
      return extrairSecao(args.numero);

    case 'checar_padrao_lashmatch':
      return extrairSecao(18);

    case 'gerar_project_md':
      return gerarProjectMd(args);

    case 'status_fabrica':
      return `🏭 Status da Fábrica de Apps

GitHub:
  - Usuário: ${GITHUB_USER || '❌ não configurado'}
  - Token: ${GITHUB_TOKEN ? '✅ configurado' : '❌ não configurado'}

CLAUDE.md:
  - ${CLAUDE_MD.length > 0 ? `✅ carregado (${CLAUDE_MD.length} caracteres)` : '❌ não encontrado'}

Ferramentas disponíveis: ${TOOLS.length}

Agentes disponíveis: UX, Firebase, Frontend, QA`;

    default:
      throw new Error(`Ferramenta desconhecida: ${nome}`);
  }
}

// ─── Protocolo MCP STDIO ──────────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, terminal: false });

function enviar(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

rl.on('line', async (linha) => {
  let msg;
  try { msg = JSON.parse(linha); } catch { return; }

  const { id, method, params } = msg;

  if (method === 'initialize') {
    return enviar({
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'fabrica-apps-mcp', version: '1.0.0' },
      },
    });
  }

  if (method === 'tools/list') {
    return enviar({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params;
    try {
      const resultado = await executar(name, args || {});
      return enviar({
        jsonrpc: '2.0', id,
        result: { content: [{ type: 'text', text: String(resultado) }] },
      });
    } catch (e) {
      return enviar({
        jsonrpc: '2.0', id,
        error: { code: -32603, message: e.message },
      });
    }
  }

  if (method === 'notifications/initialized') return;

  enviar({
    jsonrpc: '2.0', id,
    error: { code: -32601, message: `Método não encontrado: ${method}` },
  });
});
