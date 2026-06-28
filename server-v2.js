#!/usr/bin/env node
/**
 * Fábrica de Apps MCP Server v2
 * Node 12 compatível — sem optional chaining, sem nullish coalescing
 * Ferramentas: criar projeto, PR, RAG, agentes
 */

var fs       = require('fs');
var path     = require('path');
var readline = require('readline');
var https    = require('https');
var execSync = require('child_process').execSync;
var reindexarRagObsidian = require('./rag-reindex.js').reindexarRagObsidian;

// ─── Config ───────────────────────────────────────────────────────────────────
var GITHUB_TOKEN  = process.env.GITHUB_TOKEN  || '';
var GITHUB_USER   = process.env.GITHUB_USER   || '';
var FABRICA_PATH       = process.env.FABRICA_PATH  || __dirname;
var PROJETOS_PATH      = process.env.FABRICA_PROJETOS_PATH || 'C:/Users/gusta/projetos';
var CLAUDE_MD          = '';
var RAG_SERVER_OFFLINE =
  'Servidor RAG offline. Rode: python C:/Users/gusta/obsidian/indexar_obsidian_chroma.py --server';

try {
  CLAUDE_MD = fs.readFileSync(path.join(FABRICA_PATH, 'CLAUDE.md'), 'utf-8');
} catch(e) {
  CLAUDE_MD = '# CLAUDE.md nao encontrado em ' + FABRICA_PATH;
}

// ─── GitHub API ───────────────────────────────────────────────────────────────
function githubRequest(method, endpoint, body) {
  return new Promise(function(resolve, reject) {
    var data = body ? JSON.stringify(body) : null;
    var headers = {
      'Authorization': 'Bearer ' + GITHUB_TOKEN,
      'Accept':        'application/vnd.github+json',
      'User-Agent':    'fabrica-apps-mcp/2.0',
      'Content-Type':  'application/json',
    };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);

    var req = https.request({
      hostname: 'api.github.com',
      path:     endpoint,
      method:   method,
      headers:  headers,
    }, function(res) {
      var chunks = '';
      res.on('data', function(c) { chunks += c; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, body: JSON.parse(chunks) }); }
        catch(e) { resolve({ status: res.statusCode, body: chunks }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ─── Funções GitHub ───────────────────────────────────────────────────────────
function criarRepo(nomeApp, descricao, privado) {
  var nomeRepo = nomeApp.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  return githubRequest('POST', '/user/repos', {
    name:        nomeRepo,
    description: descricao,
    private:     privado || false,
    auto_init:   true,
    gitignore_template: 'Node',
  }).then(function(res) {
    if (res.status !== 201) {
      throw new Error('Erro ao criar repo: ' + JSON.stringify(res.body));
    }
    return {
      nomeRepo:  nomeRepo,
      url:       res.body.html_url,
      cloneUrl:  res.body.clone_url,
      full_name: res.body.full_name,
    };
  });
}

function getSHA(fullName, branch) {
  return githubRequest('GET', '/repos/' + fullName + '/git/ref/heads/' + branch)
    .then(function(res) {
      if (res.status !== 200) throw new Error('Branch ' + branch + ' nao encontrada');
      return res.body.object.sha;
    });
}

function criarArquivo(fullName, filePath, conteudo, mensagem, branch) {
  var encoded = Buffer.from(conteudo).toString('base64');
  var body = { message: mensagem, content: encoded };
  if (branch) body.branch = branch;
  return githubRequest('PUT', '/repos/' + fullName + '/contents/' + filePath, body)
    .then(function(res) {
      return res.status === 201 || res.status === 200;
    });
}

function criarBranch(fullName, branch, sha) {
  return githubRequest('POST', '/repos/' + fullName + '/git/refs', {
    ref: 'refs/heads/' + branch,
    sha: sha,
  }).then(function(res) {
    if (res.status !== 201) throw new Error('Erro ao criar branch: ' + JSON.stringify(res.body));
    return true;
  });
}

function clonarRepositorioLocal(cloneUrl, nomeRepo, pastaLocal) {
  var base = pastaLocal || PROJETOS_PATH;
  if (!fs.existsSync(base)) {
    fs.mkdirSync(base, { recursive: true });
  }
  var dest = path.join(base, nomeRepo);
  if (fs.existsSync(path.join(dest, '.git'))) {
    return { ok: true, path: dest, alreadyExists: true };
  }
  if (fs.existsSync(dest)) {
    return { ok: false, path: dest, error: 'Pasta existe sem .git: ' + dest };
  }
  try {
    execSync(
      'git clone "' + String(cloneUrl).replace(/"/g, '') + '" "' + dest.replace(/\\/g, '/').replace(/"/g, '') + '"',
      { encoding: 'utf8', stdio: 'pipe', timeout: 180000 }
    );
    return { ok: true, path: dest };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

function criarPR(fullName, titulo, corpo, branch, base) {
  return githubRequest('POST', '/repos/' + fullName + '/pulls', {
    title: titulo,
    body:  corpo,
    head:  branch,
    base:  base || 'main',
  }).then(function(res) {
    if (res.status !== 201) throw new Error('Erro ao criar PR: ' + JSON.stringify(res.body));
    return {
      numero:  res.body.number,
      url:     res.body.html_url,
      titulo:  res.body.title,
    };
  });
}

// ─── Geração de conteúdo ──────────────────────────────────────────────────────
function gerarProjectMd(dados) {
  var nomeApp       = dados.nomeApp || '';
  var descricao     = dados.descricao || '';
  var publicoAlvo   = dados.publicoAlvo || 'A definir';
  var cores         = dados.cores || {};
  var telas         = dados.telas || '';
  var schema        = dados.schema || '';
  var regrasNegocio = dados.regrasNegocio || '';
  var integracoes   = dados.integracoes || '';

  var primary    = cores.primary    || '#D63384';
  var background = cores.background || '#000000';
  var surface    = cores.surface    || '#1a1a1a';
  var border     = cores.border     || '#333333';
  var text       = cores.text       || '#FFFFFF';
  var textMuted  = cores.textMuted  || '#9e9e9e';

  var telasDefault = '| Tela | Rota | Descricao |\n|------|------|-----------|\n| Splash | /index | Verifica login |\n| Login | /Login | Auth Firebase |\n| Home | /(tabs)/index | Tela principal |';
  var schemaDefault = 'usuarios/{uid}\n  - nome: string\n  - email: string\n  - criadoEm: Timestamp';

  return '# PROJECT.md — ' + nomeApp + '\n\n' +
    '## 1. Visao geral\n' +
    '- **Nome:** ' + nomeApp + '\n' +
    '- **Descricao:** ' + descricao + '\n' +
    '- **Publico-alvo:** ' + publicoAlvo + '\n' +
    '- **Stack:** React Native + Expo Router + Firebase + twrnc\n\n' +
    '## 2. Paleta de cores\n' +
    '```typescript\n' +
    'const COLORS = {\n' +
    "  primary:    '" + primary    + "',\n" +
    "  background: '" + background + "',\n" +
    "  surface:    '" + surface    + "',\n" +
    "  border:     '" + border     + "',\n" +
    "  text:       '" + text       + "',\n" +
    "  textMuted:  '" + textMuted  + "',\n" +
    '};\n```\n\n' +
    '## 3. Telas\n' + (telas || telasDefault) + '\n\n' +
    '## 4. Schema Firestore\n```\n' + (schema || schemaDefault) + '\n```\n\n' +
    '## 5. Regras de negocio\n' + (regrasNegocio || '- A definir') + '\n\n' +
    '## 6. Integracoes\n' + (integracoes || '- Nenhuma') + '\n\n' +
    '## 7. Deploy checklist\n\n' +
    '| Alvo | Comandos |\n|------|----------|\n' +
    '| Functions | `cd functions && npm run build` → `firebase deploy --only functions:NOME` |\n' +
    '| Firestore rules | `firebase deploy --only firestore:rules` |\n' +
    '| Hosting (web) | `npx expo export --platform web` → `firebase deploy --only hosting` |\n\n' +
    'Project ID: ler `.firebaserc` (default). Nunca hardcodar.\n';
}

function slugifyNomeApp(nomeApp) {
  return String(nomeApp || 'app').toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function gerarCursorSettingsJson() {
  return JSON.stringify({ plugins: { firebase: { enabled: true } } }, null, 2) + '\n';
}

function gerarProjetoMdc(nomeApp, slug, prdBasename) {
  return '---\n' +
    'description: ' + nomeApp + ' — negocio e integracoes. Firebase via .firebaserc.\n' +
    'alwaysApply: true\n' +
    '---\n\n' +
    '# ' + nomeApp + ' — especifico deste app\n\n' +
    '> Firebase: regra global `firebase-projeto-dinamico.mdc` + `.firebaserc`\n\n' +
    '## PRD\n\n' +
    '- `C:/Users/gusta/obsidian/projetos/' + prdBasename + '`\n\n' +
    '## Referencia\n\n' +
    '- `PROJECT.md` · `CLAUDE.md` Secao 18\n\n' +
    '## Deploy checklist\n\n' +
    '1. Functions: `npm run build` em `functions/` antes de deploy\n' +
    '2. Rules: `firebase deploy --only firestore:rules`\n' +
    '3. Hosting: export web + `firebase deploy --only hosting`\n' +
    '4. Pos-deploy: testar URL ou `firebase functions:log`\n';
}

function gerarCursorRules(nomeApp) {
  var slug = slugifyNomeApp(nomeApp);
  return '# .cursorrules — ' + nomeApp + '\n\n' +
    'Dev React Native — **' + nomeApp + '**.\n\n' +
    '## Contexto automatico\n\n' +
    '- Firebase: `.firebaserc` + regra global `firebase-projeto-dinamico.mdc`\n' +
    '- App: `.cursor/rules/' + slug + '-projeto.mdc` + `PROJECT.md`\n' +
    '- RAG: `~/.cursor/rules/rag-memoria-fabrica.mdc`\n\n' +
    'Antes de gerar codigo:\n' +
    '1. Leia `PROJECT.md`\n' +
    '2. Siga Secao 18 do `CLAUDE.md`\n' +
    '3. Consulte RAG (fabrica-apps) silenciosamente\n\n' +
    '## Stack\n\n' +
    '- Expo + expo-router + Firebase JS SDK\n' +
    '- `utils/firebaseConfig.ts` — unica fonte auth/firestore\n' +
    '- Cores em `theme/tokens.ts` ou PROJECT.md — nunca hardcoded\n' +
    '- `router.replace` apos login\n\n' +
    '## Deploy\n\n' +
    '- Checklist em `.cursor/rules/' + slug + '-projeto.mdc`\n' +
    '- Codigo no disco + git — nao confiar so em staging MCP\n';
}

function escreverArquivoLocal(dir, relPath, content) {
  var full = path.join(dir, relPath);
  var parent = path.dirname(full);
  if (!fs.existsSync(parent)) {
    fs.mkdirSync(parent, { recursive: true });
  }
  fs.writeFileSync(full, content, 'utf8');
}

function configurarScaffoldCursorLocal(dest, args, projectMd, branchNome) {
  var slug = slugifyNomeApp(args.nomeApp);
  var prdBasename = slug + '-prd.md';

  try {
    execSync('git fetch origin ' + branchNome, { cwd: dest, stdio: 'pipe', timeout: 90000 });
  } catch (e) { /* branch remota pode ainda nao existir localmente */ }

  try {
    execSync('git checkout ' + branchNome, { cwd: dest, stdio: 'pipe', timeout: 30000 });
  } catch (e) { /* fica em main se branch indisponivel */ }

  escreverArquivoLocal(dest, 'PROJECT.md', projectMd);
  escreverArquivoLocal(dest, '.cursorrules', gerarCursorRules(args.nomeApp));
  escreverArquivoLocal(dest, '.cursor/settings.json', gerarCursorSettingsJson());
  escreverArquivoLocal(dest, '.cursor/rules/' + slug + '-projeto.mdc', gerarProjetoMdc(args.nomeApp, slug, prdBasename));

  return { slug: slug, prdBasename: prdBasename, path: dest };
}

function gerarPromptAgente(tipo, nomeApp, projectMd) {
  var pm = projectMd || '';
  var mapa = {
    ux:       '# Agente UX — ' + nomeApp + '\n\nDefina: paleta, tipografia, componentes, fluxo de navegacao.\n\nPROJECT.md:\n' + pm,
    firebase: '# Agente Firebase — ' + nomeApp + '\n\nGere: firebaseConfig.ts, schema Firestore, firestore.rules, indices.\n\nOBRIGATORIO ao finalizar: rodar deploy no projeto Firebase (regras/indices) — ver Secao 0 do CLAUDE.md. Ex.: npx firebase-tools deploy --only firestore:rules --project <PROJECT_ID>. Sem deploy, o app continua com regras antigas (ex.: permission-denied).\n\nPROJECT.md:\n' + pm,
    frontend: '# Agente Frontend — ' + nomeApp + '\n\nGere as telas uma por vez. Aguarde aprovacao antes da proxima.\nOrdem: _layout → index → Login → (tabs) → demais telas.\n\nPROJECT.md:\n' + pm,
    qa:       '# Agente QA — ' + nomeApp + '\n\nRevise cada tela:\n- Touch targets < 44px\n- Memory leaks\n- Anti-padroes Firebase\n- FlatList dentro de ScrollView\n\nPROJECT.md:\n' + pm,
  };
  return mapa[tipo] || ('Agente ' + tipo + ' nao encontrado');
}

function extrairSecao(numero) {
  var linhas = CLAUDE_MD.split('\n');
  var re = new RegExp('^## ' + numero + '\\.');
  var inicio = -1;
  for (var i = 0; i < linhas.length; i++) {
    if (re.test(linhas[i])) { inicio = i; break; }
  }
  if (inicio === -1) return 'Secao ' + numero + ' nao encontrada.';
  var fim = linhas.length;
  for (var j = inicio + 1; j < linhas.length; j++) {
    if (/^## \d+\./.test(linhas[j])) { fim = j; break; }
  }
  return linhas.slice(inicio, fim).join('\n');
}

// ─── Ferramentas MCP ──────────────────────────────────────────────────────────
var TOOLS = [
  {
    name: 'criar_projeto_completo',
    description: 'Cria repositório GitHub + branch + PR + PROJECT.md + CLAUDE.md + .cursorrules + .cursor/ (rules + settings) + git clone local (padrão). Fluxo completo para novo app.',
    inputSchema: {
      type: 'object',
      properties: {
        nomeApp:       { type: 'string', description: 'Nome do app' },
        descricao:     { type: 'string', description: 'O que o app faz' },
        publicoAlvo:   { type: 'string', description: 'Quem vai usar' },
        privado:       { type: 'boolean', description: 'Repo privado?' },
        pastaLocal:    { type: 'string', description: 'Onde clonar (default: C:/Users/gusta/projetos)' },
        clonarLocal:   { type: 'boolean', description: 'Rodar git clone após criar repo (default: true)' },
        cores:         { type: 'object',  description: 'Paleta de cores' },
        telas:         { type: 'string',  description: 'Tabela de telas em markdown' },
        schema:        { type: 'string',  description: 'Schema Firestore' },
        regrasNegocio: { type: 'string',  description: 'Regras de negocio' },
        integracoes:   { type: 'string',  description: 'Integracoes externas' },
      },
      required: ['nomeApp', 'descricao'],
    },
  },
  {
    name: 'obter_prompt_agente',
    description: 'Retorna prompt completo para agente: ux, firebase, frontend ou qa.',
    inputSchema: {
      type: 'object',
      properties: {
        tipo:      { type: 'string', enum: ['ux','firebase','frontend','qa'] },
        nomeApp:   { type: 'string' },
        projectMd: { type: 'string', description: 'Conteudo do PROJECT.md' },
      },
      required: ['tipo', 'nomeApp'],
    },
  },
  {
    name: 'listar_repos_github',
    description: 'Lista repositórios GitHub do usuário.',
    inputSchema: {
      type: 'object',
      properties: { limite: { type: 'number' } },
      required: [],
    },
  },
  {
    name: 'criar_branch',
    description: 'Cria branch no repositório para um agente trabalhar.',
    inputSchema: {
      type: 'object',
      properties: {
        fullName: { type: 'string', description: 'usuario/repo' },
        branch:   { type: 'string', description: 'Nome da branch' },
      },
      required: ['fullName', 'branch'],
    },
  },
  {
    name: 'criar_pr',
    description: 'Cria Pull Request no GitHub.',
    inputSchema: {
      type: 'object',
      properties: {
        fullName: { type: 'string', description: 'usuario/repo' },
        titulo:   { type: 'string', description: 'Titulo do PR' },
        corpo:    { type: 'string', description: 'Descricao do PR' },
        branch:   { type: 'string', description: 'Branch de origem' },
        base:     { type: 'string', description: 'Branch destino (default: main)' },
      },
      required: ['fullName', 'titulo', 'branch'],
    },
  },
  {
    name: 'ler_secao_claude',
    description: 'Le secao especifica do CLAUDE.md pelo numero.',
    inputSchema: {
      type: 'object',
      properties: { numero: { type: 'number' } },
      required: ['numero'],
    },
  },
  {
    name: 'checar_padrao_lashmatch',
    description: 'Retorna padroes obrigatorios do projeto (Secao 18). Usar antes de gerar codigo.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'gerar_project_md',
    description: 'Gera conteudo do PROJECT.md sem criar repositorio.',
    inputSchema: {
      type: 'object',
      properties: {
        nomeApp:       { type: 'string' },
        descricao:     { type: 'string' },
        publicoAlvo:   { type: 'string' },
        cores:         { type: 'object' },
        telas:         { type: 'string' },
        schema:        { type: 'string' },
        regrasNegocio: { type: 'string' },
        integracoes:   { type: 'string' },
      },
      required: ['nomeApp', 'descricao'],
    },
  },
  {
    name: 'rag_buscar',
    description: 'Busca semantica no CLAUDE.md. Use para encontrar padroes sem saber o numero da secao. Ex: "como fazer agendamento", "evitar memory leak", "integrar whatsapp".',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'O que voce quer encontrar' },
        topK:  { type: 'number', description: 'Quantos resultados (default: 3)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'status_fabrica',
    description: 'Mostra status completo da fabrica: GitHub, CLAUDE.md, RAG.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
];

// ─── Executor ─────────────────────────────────────────────────────────────────
function executar(nome, args) {

  // ── criar_projeto_completo ──────────────────────────────────────────────────
  if (nome === 'criar_projeto_completo') {
    var projectMd   = gerarProjectMd(args);
    var cursorrules = gerarCursorRules(args.nomeApp);
    var slug        = slugifyNomeApp(args.nomeApp);
    var branchNome  = 'feature/setup-inicial';
    var repoInfo;

    return criarRepo(args.nomeApp, args.descricao, args.privado)
      .then(function(repo) {
        repoInfo = repo;
        // Aguardar 2s para o GitHub inicializar o repo
        return new Promise(function(r) { setTimeout(r, 2000); });
      })
      .then(function() {
        return getSHA(repoInfo.full_name, 'main');
      })
      .then(function(sha) {
        return criarBranch(repoInfo.full_name, branchNome, sha);
      })
      .then(function() {
        return criarArquivo(repoInfo.full_name, 'CLAUDE.md', CLAUDE_MD,
          'chore: add CLAUDE.md base de conhecimento', branchNome);
      })
      .then(function() {
        return criarArquivo(repoInfo.full_name, 'PROJECT.md', projectMd,
          'chore: add PROJECT.md do ' + args.nomeApp, branchNome);
      })
      .then(function() {
        return criarArquivo(repoInfo.full_name, '.cursorrules', cursorrules,
          'chore: add .cursorrules', branchNome);
      })
      .then(function() {
        return criarArquivo(repoInfo.full_name, '.cursor/settings.json', gerarCursorSettingsJson(),
          'chore: add .cursor/settings.json', branchNome);
      })
      .then(function() {
        return criarArquivo(repoInfo.full_name, '.cursor/rules/' + slug + '-projeto.mdc',
          gerarProjetoMdc(args.nomeApp, slug, slug + '-prd.md'),
          'chore: add cursor project rule', branchNome);
      })
      .then(function() {
        var corpoPR =
          '## Setup inicial — ' + args.nomeApp + '\n\n' +
          '### O que este PR adiciona\n' +
          '- `CLAUDE.md` — base de conhecimento dos agentes (27 secoes)\n' +
          '- `PROJECT.md` — contexto especifico do ' + args.nomeApp + '\n' +
          '- `.cursorrules` — instrucoes para o Cursor\n' +
          '- `.cursor/rules/' + slug + '-projeto.mdc` — regra alwaysApply do app\n' +
          '- `.cursor/settings.json` — plugin Firebase habilitado\n\n' +
          '### Proximo passo\n' +
          '1. Clone o repo\n' +
          '2. Abra no Cursor\n' +
          '3. Crie PRD em obsidian/projetos/' + slug + '-prd.md\n' +
          '4. Peca o prompt do Agente UX\n' +
          '5. Depois Firebase → Frontend → QA\n\n' +
          '### Stack\n' +
          'React Native + Expo Router + Firebase + twrnc';

        return criarPR(repoInfo.full_name,
          'Setup inicial: CLAUDE.md + PROJECT.md + .cursorrules',
          corpoPR,
          branchNome,
          'main'
        );
      })
      .then(function(pr) {
        var clonar = args.clonarLocal !== false;
        var pasta = args.pastaLocal || PROJETOS_PATH;
        var cloneResult = null;

        if (clonar) {
          cloneResult = clonarRepositorioLocal(repoInfo.cloneUrl, repoInfo.nomeRepo, pasta);
          if (cloneResult && cloneResult.ok) {
            configurarScaffoldCursorLocal(cloneResult.path, args, projectMd, branchNome);
          }
        }

        var msg =
          '✅ Projeto criado com sucesso!\n\n' +
          '📦 Repositorio: ' + repoInfo.url + '\n' +
          '🔗 Clone: ' + repoInfo.cloneUrl + '\n' +
          '🔀 PR #' + pr.numero + ': ' + pr.url + '\n\n' +
          'Arquivos na branch ' + branchNome + ':\n' +
          '- CLAUDE.md (base de conhecimento)\n' +
          '- PROJECT.md (contexto do ' + args.nomeApp + ')\n' +
          '- .cursorrules + .cursor/rules/' + slug + '-projeto.mdc + .cursor/settings.json\n\n' +
          '📝 PRD sugerido: C:/Users/gusta/obsidian/projetos/' + slug + '-prd.md\n\n';

        if (cloneResult) {
          if (cloneResult.ok) {
            msg += '📁 Local: ' + cloneResult.path +
              (cloneResult.alreadyExists ? ' (ja existia)\n\n' : ' (git clone OK)\n\n');
          } else {
            msg += '⚠️ Clone local falhou: ' + (cloneResult.error || 'erro') + '\n';
            msg += '   Rode manualmente: git clone ' + repoInfo.cloneUrl + ' "' +
              path.join(pasta, repoInfo.nomeRepo) + '"\n\n';
          }
        }

        msg +=
          'Proximos passos:\n' +
          '1. Revise e aprove o PR no GitHub\n' +
          '2. Abra no Cursor: ' + (cloneResult && cloneResult.ok ? cloneResult.path : pasta + '/' + repoInfo.nomeRepo) + '\n' +
          '3. Peca: obter_prompt_agente({ tipo: "ux", nomeApp: "' + args.nomeApp + '" })';

        return msg;
      });
  }

  // ── obter_prompt_agente ─────────────────────────────────────────────────────
  if (nome === 'obter_prompt_agente') {
    return Promise.resolve(gerarPromptAgente(args.tipo, args.nomeApp, args.projectMd));
  }

  // ── listar_repos_github ─────────────────────────────────────────────────────
  if (nome === 'listar_repos_github') {
    var limite = args.limite || 10;
    return githubRequest('GET', '/user/repos?per_page=' + limite + '&sort=updated')
      .then(function(res) {
        if (res.status !== 200) throw new Error('Erro ao listar repos');
        return res.body.map(function(r) {
          return '• ' + r.full_name + ' — ' + (r.description || 'sem descricao') +
            ' [' + (r.private ? 'privado' : 'publico') + ']';
        }).join('\n');
      });
  }

  // ── criar_branch ────────────────────────────────────────────────────────────
  if (nome === 'criar_branch') {
    return getSHA(args.fullName, 'main')
      .then(function(sha) {
        return criarBranch(args.fullName, args.branch, sha);
      })
      .then(function() {
        return 'Branch "' + args.branch + '" criada em ' + args.fullName;
      });
  }

  // ── criar_pr ────────────────────────────────────────────────────────────────
  if (nome === 'criar_pr') {
    return criarPR(args.fullName, args.titulo, args.corpo || '', args.branch, args.base)
      .then(function(pr) {
        return 'PR #' + pr.numero + ' criado: ' + pr.url;
      });
  }

  // ── ler_secao_claude ────────────────────────────────────────────────────────
  if (nome === 'ler_secao_claude') {
    return Promise.resolve(extrairSecao(args.numero));
  }

  // ── checar_padrao_lashmatch ─────────────────────────────────────────────────
  if (nome === 'checar_padrao_lashmatch') {
    return Promise.resolve(extrairSecao(18));
  }

  // ── gerar_project_md ────────────────────────────────────────────────────────
  if (nome === 'gerar_project_md') {
    return Promise.resolve(gerarProjectMd(args));
  }

  // ── rag_buscar ──────────────────────────────────────────────────────────────
  if (nome === 'rag_buscar') {
    var query = args.query;
    var topK  = args.topK || 5;

    return new Promise(function(resolve) {
      var http = require('http');
      var url  = '/buscar?q=' + encodeURIComponent(query) + '&n=' + topK;

      var req = http.request({
        hostname: '127.0.0.1',
        port:     7332,
        path:     url,
        method:   'GET',
      }, function(res) {
        var chunks = '';
        res.on('data', function(c) { chunks += c; });
        res.on('end', function() {
          try {
            var resultados = JSON.parse(chunks);
            if (!resultados.length) {
              resolve('Nenhum resultado para: "' + query + '"');
              return;
            }
            var texto = '🔍 RAG para "' + query + '":\n\n';
            resultados.forEach(function(r, i) {
              texto += '[' + (i+1) + '] ' + r.arquivo +
                ' (similaridade: ' + r.similaridade + ')\n';
              texto += r.conteudo.slice(0, 500) + '\n\n---\n\n';
            });
            resolve(texto);
          } catch(e) {
            resolve(null);
          }
        });
      });

      req.setTimeout(15000, function() { req.destroy(); resolve(null); });
      req.on('error', function() { resolve(null); });
      req.end();

    }).then(function(resultado) {
      if (resultado) return resultado;
      return RAG_SERVER_OFFLINE;
    });
  }

  // ── status_fabrica ──────────────────────────────────────────────────────────
  if (nome === 'status_fabrica') {
    return Promise.resolve(
      'Fabrica de Apps — Status\n\n' +
      'GitHub:\n' +
      '  Usuario: ' + (GITHUB_USER || 'nao configurado') + '\n' +
      '  Token: ' + (GITHUB_TOKEN ? 'configurado' : 'nao configurado') + '\n\n' +
      'CLAUDE.md:\n' +
      '  ' + (CLAUDE_MD.length > 50
        ? 'carregado (' + CLAUDE_MD.length + ' caracteres) — ponte, nao KB'
        : 'nao encontrado') + '\n\n' +
      'RAG:\n' +
      '  Chroma hibrido em http://127.0.0.1:7332\n' +
      '  Subir: python C:/Users/gusta/obsidian/indexar_obsidian_chroma.py --server\n\n' +
      'Ferramentas: ' + TOOLS.length + '\n' +
      'Agentes: UX, Firebase, Frontend, QA'
    );
  }

  return Promise.reject(new Error('Ferramenta desconhecida: ' + nome));
}

// ─── Staging — arquivos aguardando upload ─────────────────────────────────────
var STAGING_PATH = path.join(FABRICA_PATH, 'staging');

function garantirStagingDir() {
  if (!fs.existsSync(STAGING_PATH)) {
    fs.mkdirSync(STAGING_PATH, { recursive: true });
  }
}

function listarArquivosStaging() {
  if (!fs.existsSync(STAGING_PATH)) return [];
  var arquivos = [];

  function varrer(dir, base) {
    var itens = fs.readdirSync(dir);
    itens.forEach(function(item) {
      var fullPath = path.join(dir, item);
      var relPath  = base ? base + '/' + item : item;
      var stat     = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        varrer(fullPath, relPath);
      } else {
        arquivos.push({
          caminho:  relPath,
          fullPath: fullPath,
          tamanho:  stat.size,
        });
      }
    });
  }

  varrer(STAGING_PATH, '');
  return arquivos;
}

function limparStaging() {
  if (!fs.existsSync(STAGING_PATH)) return;
  function deletarRec(dir) {
    var itens = fs.readdirSync(dir);
    itens.forEach(function(item) {
      var fullPath = path.join(dir, item);
      if (fs.statSync(fullPath).isDirectory()) {
        deletarRec(fullPath);
        fs.rmdirSync(fullPath);
      } else {
        fs.unlinkSync(fullPath);
      }
    });
  }
  deletarRec(STAGING_PATH);
}

// Adicionar ferramentas de staging ao array TOOLS
TOOLS.push({
  name: 'salvar_arquivo_staging',
  description: 'Salva arquivo gerado pelo agente na pasta staging para depois subir ao GitHub. Use depois de gerar cada tela ou arquivo.',
  inputSchema: {
    type: 'object',
    properties: {
      caminho:  { type: 'string', description: 'Caminho no projeto. Ex: app/Login.tsx' },
      conteudo: { type: 'string', description: 'Conteudo completo do arquivo' },
    },
    required: ['caminho', 'conteudo'],
  },
});

TOOLS.push({
  name: 'listar_staging',
  description: 'Lista arquivos salvos no staging aguardando upload.',
  inputSchema: { type: 'object', properties: {}, required: [] },
});

TOOLS.push({
  name: 'publicar_funcionalidade',
  description: 'Sobe todos os arquivos do staging para o GitHub em nova branch e abre PR. Use quando o agente terminar uma funcionalidade.',
  inputSchema: {
    type: 'object',
    properties: {
      fullName:           { type: 'string', description: 'usuario/repo' },
      nomeFuncionalidade: { type: 'string', description: 'Ex: tela-login, modulo-financeiro' },
      descricao:          { type: 'string', description: 'O que foi implementado' },
    },
    required: ['fullName', 'nomeFuncionalidade'],
  },
});

TOOLS.push({
  name: 'limpar_staging',
  description: 'Limpa a pasta staging apos publicar o PR.',
  inputSchema: { type: 'object', properties: {}, required: [] },
});

// Guardar referência do executor original e estender
var _executarBase = executar;
executar = function(nome, args) {

  if (nome === 'salvar_arquivo_staging') {
    garantirStagingDir();
    var dest = path.join(STAGING_PATH, args.caminho.replace(/\//g, path.sep));
    var dir  = path.dirname(dest);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(dest, args.conteudo, 'utf-8');
    return Promise.resolve(
      'Arquivo salvo no staging: ' + args.caminho + '\n' +
      'Tamanho: ' + args.conteudo.length + ' caracteres\n\n' +
      'Use listar_staging para ver todos os arquivos pendentes.\n' +
      'Use publicar_funcionalidade quando terminar todos os arquivos da funcionalidade.'
    );
  }

  if (nome === 'listar_staging') {
    var arquivos = listarArquivosStaging();
    if (arquivos.length === 0) {
      return Promise.resolve('Staging vazio. Nenhum arquivo aguardando upload.');
    }
    var lista = 'Arquivos no staging (' + arquivos.length + '):\n\n';
    arquivos.forEach(function(a) {
      lista += '  - ' + a.caminho + ' (' + (a.tamanho / 1024).toFixed(1) + ' KB)\n';
    });
    lista += '\nUse publicar_funcionalidade para subir tudo ao GitHub.';
    return Promise.resolve(lista);
  }

  if (nome === 'publicar_funcionalidade') {
    var arquivos = listarArquivosStaging();
    if (arquivos.length === 0) {
      return Promise.resolve('Staging vazio. Nenhum arquivo para publicar.');
    }

    var branchNome = 'feature/' + args.nomeFuncionalidade
      .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    var fullName   = args.fullName;
    var descricao  = args.descricao || args.nomeFuncionalidade;

    return getSHA(fullName, 'main')
      .then(function(sha) {
        return criarBranch(fullName, branchNome, sha);
      })
      .then(function() {
        // Subir arquivos em sequência
        var promise = Promise.resolve();
        arquivos.forEach(function(arq) {
          promise = promise.then(function() {
            var conteudo = fs.readFileSync(arq.fullPath, 'utf-8');
            return criarArquivo(
              fullName,
              arq.caminho,
              conteudo,
              'feat: add ' + arq.caminho,
              branchNome
            );
          });
        });
        return promise;
      })
      .then(function() {
        var listaArqs = arquivos.map(function(a) {
          return '- `' + a.caminho + '`';
        }).join('\n');

        var corpoPR =
          '## ' + args.nomeFuncionalidade + '\n\n' +
          '### Descricao\n' + descricao + '\n\n' +
          '### Arquivos alterados\n' + listaArqs + '\n\n' +
          '### Gerado por\nFabrica de Apps MCP — Agente Frontend\n\n' +
          '### Checklist\n' +
          '- [ ] Codigo revisado pelo Agente QA\n' +
          '- [ ] Telas testadas no Expo Go\n' +
          '- [ ] Sem erros de TypeScript\n' +
          '- [ ] Padroes do CLAUDE.md seguidos';

        return criarPR(
          fullName,
          'feat: ' + args.nomeFuncionalidade,
          corpoPR,
          branchNome,
          'main'
        );
      })
      .then(function(pr) {
        limparStaging();
        return 'Funcionalidade publicada!\n\n' +
          'Branch: ' + branchNome + '\n' +
          'PR: ' + pr.url + '\n' +
          'Arquivos: ' + arquivos.length + '\n\n' +
          'Staging limpo automaticamente.\n' +
          'Proxima funcionalidade pode comecar!';
      });
  }

  if (nome === 'limpar_staging') {
    limparStaging();
    return Promise.resolve('Staging limpo. Pronto para proxima funcionalidade.');
  }

  return _executarBase(nome, args);
};

// ─── Agente Revisor de PR ─────────────────────────────────────────────────────
TOOLS.push({
  name: 'revisar_pr',
  description: 'Agente QA analisa o codigo do PR, deixa comentarios e aprova se estiver ok. Chama automaticamente apos publicar_funcionalidade.',
  inputSchema: {
    type: 'object',
    properties: {
      fullName:   { type: 'string', description: 'usuario/repo' },
      prNumero:   { type: 'number', description: 'Numero do PR' },
    },
    required: ['fullName', 'prNumero'],
  },
});

var _executarComStaging = executar;
executar = function(nome, args) {

  if (nome === 'revisar_pr') {
    var fullName = args.fullName;
    var prNum    = args.prNumero;
    var arquivos = [];
    var problemas = [];
    var avisos = [];

    // 1. Buscar arquivos do PR
    return githubRequest('GET', '/repos/' + fullName + '/pulls/' + prNum + '/files')
      .then(function(res) {
        if (res.status !== 200) throw new Error('Erro ao buscar arquivos do PR');
        arquivos = res.body;

        // 2. Analisar cada arquivo
        arquivos.forEach(function(arq) {
          var patch = arq.patch || '';
          var filename = arq.filename || '';

          // Verificar anti-padroes
          if (patch.indexOf('getAuth(app)') !== -1 || patch.indexOf('getFirestore(app)') !== -1) {
            problemas.push('🔴 **' + filename + '**: Inicializando Firebase dentro do componente. Importe de `utils/firebaseConfig.ts`');
          }
          if (patch.indexOf('FlatList') !== -1 && patch.indexOf('ScrollView') !== -1) {
            problemas.push('🔴 **' + filename + '**: FlatList dentro de ScrollView causa bug de rolagem.');
          }
          if (patch.indexOf('router.navigate') !== -1) {
            problemas.push('🟡 **' + filename + '**: Use `router.replace` em vez de `router.navigate` apos login.');
          }
          if (patch.indexOf('useEffect') !== -1 && patch.indexOf('return') === -1) {
            avisos.push('🟡 **' + filename + '**: useEffect sem cleanup pode causar memory leak.');
          }
          if (patch.indexOf('#') !== -1 && patch.match(/#[0-9a-fA-F]{6}/) &&
              patch.indexOf('COLORS') === -1 && patch.indexOf('tw`') === -1) {
            avisos.push('🟡 **' + filename + '**: Cor hardcoded detectada. Use as cores do PROJECT.md.');
          }
          if (filename.endsWith('.tsx') && patch.indexOf('minHeight: 44') === -1 &&
              patch.indexOf('TouchableOpacity') !== -1) {
            avisos.push('🟢 **' + filename + '**: Verifique se touch targets tem minHeight de 44px.');
          }
        });

        // 3. Montar corpo do comentario
        var aprovado = problemas.length === 0;
        var corpo =
          '## Revisao do Agente QA\n\n' +
          (aprovado
            ? '✅ **Codigo aprovado!** Nenhum problema critico encontrado.\n\n'
            : '❌ **' + problemas.length + ' problema(s) critico(s) encontrado(s)**\n\n') +
          (problemas.length > 0
            ? '### Problemas criticos (corrigir antes do merge)\n' + problemas.join('\n') + '\n\n'
            : '') +
          (avisos.length > 0
            ? '### Avisos (recomendado corrigir)\n' + avisos.join('\n') + '\n\n'
            : '') +
          '### Arquivos revisados\n' +
          arquivos.map(function(a) {
            return '- `' + a.filename + '` (' + a.changes + ' mudancas)';
          }).join('\n') + '\n\n' +
          '---\n*Revisao automatica pelo Agente QA da Fabrica de Apps*';

        // 4. Postar comentario no PR
        return githubRequest('POST',
          '/repos/' + fullName + '/issues/' + prNum + '/comments',
          { body: corpo }
        ).then(function() { return { aprovado: aprovado, problemas: problemas, avisos: avisos }; });
      })
      .then(function(resultado) {
        // 5. Aprovar o PR se nao tiver problemas criticos
        if (resultado.aprovado) {
          return githubRequest('POST',
            '/repos/' + fullName + '/pulls/' + prNum + '/reviews',
            { event: 'APPROVE', body: 'Aprovado pelo Agente QA. Nenhum problema critico encontrado.' }
          ).then(function() { return resultado; });
        }
        return resultado;
      })
      .then(function(resultado) {
        var msg = resultado.aprovado
          ? '✅ PR aprovado pelo Agente QA!\n\n'
          : '❌ PR com ' + resultado.problemas.length + ' problema(s) critico(s).\n\n';

        if (resultado.problemas.length > 0) {
          msg += 'Problemas:\n' + resultado.problemas.join('\n') + '\n\n';
        }
        if (resultado.avisos.length > 0) {
          msg += 'Avisos:\n' + resultado.avisos.join('\n') + '\n\n';
        }
        msg += 'Comentario postado no PR. Voce pode fazer o merge quando quiser.';
        return msg;
      });
  }

  return _executarComStaging(nome, args);
};

// ─── Setup Local ──────────────────────────────────────────────────────────────
TOOLS.push({
  name: 'configurar_projeto_local',
  description: 'Gera instrucoes completas para o Cursor clonar o repo, instalar dependencias e rodar o projeto localmente com Expo Go.',
  inputSchema: {
    type: 'object',
    properties: {
      cloneUrl:    { type: 'string', description: 'URL de clone do repositorio' },
      nomeRepo:    { type: 'string', description: 'Nome do repositorio' },
      pastaLocal:  { type: 'string', description: 'Pasta local para clonar (default: C:/Users/gusta/projetos)' },
    },
    required: ['cloneUrl', 'nomeRepo'],
  },
});

var _executarComReview = executar;
executar = function(nome, args) {

  if (nome === 'configurar_projeto_local') {
    var pasta    = args.pastaLocal || PROJETOS_PATH;
    var cloneUrl = args.cloneUrl;
    var nomeRepo = args.nomeRepo;
    var cloneResult = clonarRepositorioLocal(cloneUrl, nomeRepo, pasta);
    var dest = path.join(pasta, nomeRepo);

    var instrucoes =
      '## Setup Local — ' + nomeRepo + '\n\n';

    if (cloneResult.ok) {
      instrucoes += '✅ git clone: ' + cloneResult.path +
        (cloneResult.alreadyExists ? ' (repositorio ja existia)\n\n' : '\n\n');
    } else {
      instrucoes += '❌ git clone falhou: ' + (cloneResult.error || 'erro') + '\n\n';
    }

    instrucoes +=
      'Proximos comandos:\n\n' +
      '```bash\n' +
      'cd "' + dest.replace(/\\/g, '/') + '"\n' +
      'npm install\n' +
      'npx expo start\n' +
      '```\n\n' +
      'Apos rodar, escaneie o QR Code com o Expo Go no celular.\n\n' +
      '> Se der erro de SDK, rode: npx expo install --fix\n' +
      '> Se der erro de rede, rode: npx expo start --tunnel';

    return Promise.resolve(instrucoes);
  }

  return _executarComReview(nome, args);
};

// ─── Memória — Obsidian ───────────────────────────────────────────────────────
var OBSIDIAN_FABRICA  = path.join('C:/Users/gusta/obsidian', 'fabrica');
var OBSIDIAN_PROJETOS = path.join('C:/Users/gusta/obsidian', 'projetos');
var DECISOES_PATH     = path.join(OBSIDIAN_FABRICA, 'decisoes.md');
var CONTEXTOS_DIR     = path.join(OBSIDIAN_FABRICA, 'contextos-conversa');

function garantirDirMemoria(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function formatarDataDecisao() {
  var d = new Date();
  var dd = String(d.getDate()).padStart(2, '0');
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  return dd + '/' + mm + '/' + d.getFullYear();
}

function buscarHistoricoRemoto(query, topK) {
  return new Promise(function(resolve) {
    var http = require('http');
    var url  = '/buscar?q=' + encodeURIComponent(query) + '&n=' + (topK || 5);

    var req = http.request({
      hostname: '127.0.0.1',
      port:     7332,
      path:     url,
      method:   'GET',
    }, function(res) {
      var chunks = '';
      res.on('data', function(c) { chunks += c; });
      res.on('end', function() {
        try {
          var resultados = JSON.parse(chunks);
          if (!resultados.length) {
            resolve('Nenhum resultado no historico para: "' + query + '"');
            return;
          }
          var texto = 'Historico para "' + query + '":\n\n';
          resultados.forEach(function(r, i) {
            texto += '[' + (i + 1) + '] ' + r.arquivo +
              ' (similaridade: ' + r.similaridade + ')\n';
            texto += r.conteudo.slice(0, 600) + '\n\n---\n\n';
          });
          resolve(texto);
        } catch(e) {
          resolve(null);
        }
      });
    });

      req.setTimeout(15000, function() { req.destroy(); resolve(null); });
    req.on('error', function() { resolve(null); });
    req.end();
  });
}

TOOLS.push({
  name: 'salvar_decisao',
  description: 'Registra decisao tecnica no Obsidian (decisoes.md) para memoria da fabrica.',
  inputSchema: {
    type: 'object',
    properties: {
      projeto:              { type: 'string' },
      titulo:               { type: 'string' },
      decisao:              { type: 'string' },
      motivo:               { type: 'string' },
      alternativaRejeitada: { type: 'string' },
      impacto:              { type: 'string' },
      quemDecidiu:          { type: 'string' },
    },
    required: ['projeto', 'titulo', 'decisao'],
  },
});

TOOLS.push({
  name: 'buscar_historico',
  description: 'Busca no vault Obsidian (Chroma) decisoes e padroes anteriores. Ex: "google signin", "firebase auth".',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      topK:  { type: 'number' },
    },
    required: ['query'],
  },
});

TOOLS.push({
  name: 'listar_decisoes',
  description: 'Lista titulos das decisoes registradas em decisoes.md.',
  inputSchema: { type: 'object', properties: {}, required: [] },
});

TOOLS.push({
  name: 'salvar_contexto_conversa',
  description: 'Salva resumo de conversa/implementacao no Obsidian para referencia futura.',
  inputSchema: {
    type: 'object',
    properties: {
      projeto:  { type: 'string' },
      titulo:   { type: 'string' },
      resumo:   { type: 'string' },
      conteudo: { type: 'string' },
    },
    required: ['projeto', 'titulo', 'resumo'],
  },
});

var _executarComSetup = executar;
executar = function(nome, args) {

  if (nome === 'salvar_decisao') {
    garantirDirMemoria(OBSIDIAN_FABRICA);
    var data = formatarDataDecisao();
    var bloco =
      '\n### ' + data + ' — ' + args.projeto + ' — ' + args.titulo + '\n\n' +
      '- **Decisão:** ' + args.decisao + '\n' +
      '- **Motivo:** ' + (args.motivo || 'A definir') + '\n' +
      '- **Alternativa rejeitada:** ' + (args.alternativaRejeitada || 'N/A') + '\n' +
      '- **Impacto:** ' + (args.impacto || 'A definir') + '\n' +
      '- **Quem decidiu:** ' + (args.quemDecidiu || 'Ambos') + '\n\n---\n';

    if (!fs.existsSync(DECISOES_PATH)) {
      fs.writeFileSync(DECISOES_PATH, '# Decisoes\n', 'utf-8');
    }
    fs.appendFileSync(DECISOES_PATH, bloco, 'utf-8');
    return reindexarRagObsidian().then(function(logReindex) {
      return (
        'Decisao salva em decisoes.md: ' + args.titulo + '\n\n' +
        'RAG reindexado automaticamente:\n' + logReindex
      );
    });
  }

  if (nome === 'buscar_historico') {
    return buscarHistoricoRemoto(args.query, args.topK).then(function(resultado) {
      if (resultado) return resultado;
      return RAG_SERVER_OFFLINE;
    });
  }

  if (nome === 'listar_decisoes') {
    if (!fs.existsSync(DECISOES_PATH)) {
      return Promise.resolve('Arquivo decisoes.md nao encontrado em ' + DECISOES_PATH);
    }
    var conteudo = fs.readFileSync(DECISOES_PATH, 'utf-8');
    var linhas = conteudo.split('\n');
    var titulos = [];
    linhas.forEach(function(linha) {
      if (linha.indexOf('### ') === 0) {
        titulos.push(linha.replace(/^###\s+/, ''));
      }
    });
    if (titulos.length === 0) {
      return Promise.resolve('Nenhuma decisao registrada ainda.');
    }
    return Promise.resolve('Decisoes registradas (' + titulos.length + '):\n\n' +
      titulos.map(function(t, i) { return (i + 1) + '. ' + t; }).join('\n'));
  }

  if (nome === 'salvar_contexto_conversa') {
    garantirDirMemoria(CONTEXTOS_DIR);
    var slug = (args.projeto + '-' + args.titulo)
      .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    var arquivo = path.join(CONTEXTOS_DIR, slug + '.md');
    var textoCtx =
      '# ' + args.titulo + ' — ' + args.projeto + '\n\n' +
      '**Data:** ' + formatarDataDecisao() + '\n\n' +
      '## Resumo\n' + args.resumo + '\n\n' +
      (args.conteudo ? '## Detalhes\n' + args.conteudo + '\n' : '');
    fs.writeFileSync(arquivo, textoCtx, 'utf-8');
    return Promise.resolve('Contexto salvo: ' + arquivo);
  }

  return _executarComSetup(nome, args);
};

// ─── Aprendizado — erros e soluções (Obsidian) ───────────────────────────────
executar = require('./learning-tools.js')({
  TOOLS:                 TOOLS,
  executar:              executar,
  fs:                    fs,
  path:                  path,
  OBSIDIAN_FABRICA:      OBSIDIAN_FABRICA,
  buscarHistoricoRemoto: buscarHistoricoRemoto,
  garantirDirMemoria:    garantirDirMemoria,
  formatarDataDecisao:   formatarDataDecisao,
  reindexarRagObsidian:  reindexarRagObsidian,
});

// ─── Features — backlog e planejamento (Obsidian) ─────────────────────────────
executar = require('./feature-tools.js')({
  TOOLS:               TOOLS,
  executar:            executar,
  fs:                  fs,
  path:                path,
  OBSIDIAN_FABRICA:    OBSIDIAN_FABRICA,
  garantirDirMemoria:  garantirDirMemoria,
  formatarDataDecisao: formatarDataDecisao,
});

// ─── Protocolo MCP STDIO ──────────────────────────────────────────────────────
var rl = readline.createInterface({ input: process.stdin, terminal: false });

function enviar(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

rl.on('line', function(linha) {
  var msg;
  try { msg = JSON.parse(linha); } catch(e) { return; }

  var id     = msg.id;
  var method = msg.method;
  var params = msg.params;

  if (method === 'initialize') {
    return enviar({
      jsonrpc: '2.0', id: id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'fabrica-apps-mcp', version: '2.0.0' },
      },
    });
  }

  if (method === 'tools/list') {
    return enviar({ jsonrpc: '2.0', id: id, result: { tools: TOOLS } });
  }

  if (method === 'tools/call') {
    var nomeTool = params.name;
    var argsTool = params.arguments || {};
    executar(nomeTool, argsTool)
      .then(function(resultado) {
        enviar({
          jsonrpc: '2.0', id: id,
          result: { content: [{ type: 'text', text: String(resultado) }] },
        });
      })
      .catch(function(e) {
        enviar({
          jsonrpc: '2.0', id: id,
          error: { code: -32603, message: e.message },
        });
      });
    return;
  }

  if (method === 'notifications/initialized') return;

  enviar({
    jsonrpc: '2.0', id: id,
    error: { code: -32601, message: 'Metodo nao encontrado: ' + method },
  });
});
