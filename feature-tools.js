'use strict';

/**
 * Ferramentas MCP de features — backlog e planejamento (Obsidian).
 * Backlog: C:/Users/gusta/obsidian/fabrica/features-pendentes.md
 */

module.exports = function registerFeatureTools(ctx) {
  var TOOLS = ctx.TOOLS;
  var executarAnterior = ctx.executar;
  var fs = ctx.fs;
  var path = ctx.path;
  var OBSIDIAN_FABRICA = ctx.OBSIDIAN_FABRICA;
  var garantirDirMemoria = ctx.garantirDirMemoria;
  var formatarDataDecisao = ctx.formatarDataDecisao;

  var FEATURES_PATH = path.join(OBSIDIAN_FABRICA, 'features-pendentes.md');

  TOOLS.push({
    name: 'criar_feature',
    description: [
      'Orquestra a criação completa de uma feature:',
      '1. Consulta RAG e histórico automaticamente',
      '2. Planeja os arquivos necessários',
      '3. Implementa todo o código',
      '4. Salva no staging',
      '5. Cria branch + commit + PR no GitHub',
      '6. Roda QA automático',
      '7. Documenta decisões no Obsidian',
      'Use com uma descrição simples do que quer: "tela de ranking", "sistema de notificações", etc.'
    ].join(' '),
    inputSchema: {
      type: 'object',
      properties: {
        projeto:    { type: 'string', description: 'Nome do projeto (Setmatch, LashMatch)' },
        fullName:   { type: 'string', description: 'usuario/repo no GitHub' },
        feature:    { type: 'string', description: 'O que implementar. Ex: "tela de ranking de jogadores"' },
        descricao:  { type: 'string', description: 'Detalhes extras (opcional)' },
        prioridade: { type: 'string', enum: ['baixa', 'media', 'alta'], description: 'Prioridade (default: media)' }
      },
      required: ['projeto', 'fullName', 'feature']
    }
  });

  TOOLS.push({
    name: 'planejar_feature',
    description: [
      'Planeja uma feature ANTES de implementar.',
      'Retorna: lista de arquivos a criar/modificar, dependências, riscos.',
      'Use quando quiser revisar o plano antes de executar.'
    ].join(' '),
    inputSchema: {
      type: 'object',
      properties: {
        projeto:   { type: 'string' },
        feature:   { type: 'string' },
        descricao: { type: 'string' }
      },
      required: ['projeto', 'feature']
    }
  });

  TOOLS.push({
    name: 'listar_features_pendentes',
    description: 'Lista features planejadas ainda não implementadas no projeto.',
    inputSchema: {
      type: 'object',
      properties: {
        projeto: { type: 'string', description: 'Filtrar por projeto (opcional)' }
      },
      required: []
    }
  });

  TOOLS.push({
    name: 'registrar_feature_pendente',
    description: 'Registra uma feature para implementar depois.',
    inputSchema: {
      type: 'object',
      properties: {
        projeto:    { type: 'string' },
        feature:    { type: 'string' },
        descricao:  { type: 'string' },
        prioridade: { type: 'string', enum: ['baixa', 'media', 'alta'] }
      },
      required: ['projeto', 'feature']
    }
  });

  return function executarComFeature(nome, args) {
    if (nome === 'planejar_feature') {
      var projeto = args.projeto;
      var feature = args.feature;
      var descricao = args.descricao || '';

      var MAPA_FEATURES = {
        tela:        ['componente tsx', 'rota no expo router', 'hook de dados', 'schema firestore'],
        ranking:     ['tela ranking', 'query firestore orderBy', 'componente card jogador', 'cálculo de pontuação'],
        notificacao: ['tela notificações', 'push token', 'cloud function trigger', 'schema notificacoes'],
        perfil:      ['tela perfil', 'upload avatar storage', 'formulário edição', 'hook useProfile'],
        pagamento:   ['tela planos', 'mercado pago checkout', 'webhook cloud function', 'controle de acesso'],
        chat:        ['tela chat', 'firestore realtime', 'componente mensagem', 'notificação push'],
        mapa:        ['react-native-maps', 'permissão geolocalização', 'tela busca por região'],
        agendamento: ['tela agenda', 'calendário', 'schema agendamentos', 'lembrete whatsapp'],
        estoque:     ['tela estoque', 'schema produtos', 'alerta estoque baixo', 'CRUD produtos'],
        financeiro:  ['tela financeiro', 'schema transações', 'gráfico receita', 'filtros data']
      };

      var featureLower = feature.toLowerCase();
      var arquivosEstimados = ['README sobre a feature'];

      Object.keys(MAPA_FEATURES).forEach(function(chave) {
        if (featureLower.indexOf(chave) !== -1) {
          arquivosEstimados = arquivosEstimados.concat(MAPA_FEATURES[chave]);
        }
      });

      var plano =
        '## Plano de Feature: ' + feature + '\n' +
        '**Projeto:** ' + projeto + '\n' +
        (descricao ? '**Descrição:** ' + descricao + '\n' : '') +
        '\n### Arquivos estimados\n' +
        arquivosEstimados.map(function(a) { return '- [ ] ' + a; }).join('\n') +
        '\n\n### Antes de implementar\n' +
        '- [ ] Consultar RAG: rag_buscar("' + featureLower + '")\n' +
        '- [ ] Consultar histórico: buscar_historico("' + featureLower + '")\n' +
        '- [ ] Verificar PRD: ' + projeto.toLowerCase() + '-prd.md\n' +
        '\n### Riscos identificados\n' +
        '- Verificar compatibilidade Expo Go\n' +
        '- Verificar regras Firestore\n' +
        '- Testar no web e mobile\n' +
        '\n### Após implementar\n' +
        '- [ ] Salvar decisões: salvar_decisao\n' +
        '- [ ] Publicar: publicar_funcionalidade\n' +
        '- [ ] QA: revisar_pr\n' +
        '- [ ] Re-indexar RAG\n';

      return Promise.resolve(plano);
    }

    if (nome === 'registrar_feature_pendente') {
      try {
        garantirDirMemoria(OBSIDIAN_FABRICA);

        if (!fs.existsSync(FEATURES_PATH)) {
          fs.writeFileSync(FEATURES_PATH,
            '# Features Pendentes — Fábrica de Software\n\n' +
            '> Backlog de features a implementar.\n' +
            '> Use criar_feature para implementar qualquer item desta lista.\n\n' +
            '## Alta prioridade\n\n' +
            '## Média prioridade\n\n' +
            '## Baixa prioridade\n\n',
            'utf-8'
          );
        }

        var prioridade = args.prioridade || 'media';
        var secaoMap = {
          alta:  '## Alta prioridade',
          media: '## Média prioridade',
          baixa: '## Baixa prioridade'
        };

        var item =
          '- [ ] **[' + args.projeto + ']** ' + args.feature +
          (args.descricao ? ' — ' + args.descricao : '') +
          ' `' + formatarDataDecisao() + '`\n';

        var conteudo = fs.readFileSync(FEATURES_PATH, 'utf-8');
        var secao = secaoMap[prioridade];
        var pos = conteudo.indexOf(secao);

        if (pos > -1) {
          var posInsert = pos + secao.length + 1;
          conteudo = conteudo.slice(0, posInsert) + '\n' + item + conteudo.slice(posInsert);
          fs.writeFileSync(FEATURES_PATH, conteudo, 'utf-8');
        } else {
          fs.appendFileSync(FEATURES_PATH, '\n' + item, 'utf-8');
        }

        return Promise.resolve(
          'Feature registrada!\n\n' +
          '[' + args.projeto + '] ' + args.feature + '\n' +
          'Prioridade: ' + prioridade + '\n\n' +
          'Use criar_feature para implementar quando quiser.'
        );
      } catch (e) {
        return Promise.resolve('Erro: ' + e.message);
      }
    }

    if (nome === 'listar_features_pendentes') {
      try {
        if (!fs.existsSync(FEATURES_PATH)) {
          return Promise.resolve('Nenhuma feature pendente registrada ainda.');
        }

        var conteudoLista = fs.readFileSync(FEATURES_PATH, 'utf-8');
        var projetoFiltro = args.projeto ? args.projeto.toLowerCase() : null;

        if (projetoFiltro) {
          var linhas = conteudoLista.split('\n');
          var filtradas = linhas.filter(function(l) {
            return l.indexOf('- [') !== 0 || l.toLowerCase().indexOf(projetoFiltro) !== -1;
          });
          conteudoLista = filtradas.join('\n');
        }

        var pendentes = (conteudoLista.match(/- \[ \]/g) || []).length;
        var feitas = (conteudoLista.match(/- \[x\]/gi) || []).length;

        return Promise.resolve(
          'Features pendentes: ' + pendentes + ' | Concluídas: ' + feitas + '\n\n' +
          conteudoLista
        );
      } catch (e) {
        return Promise.resolve('Erro: ' + e.message);
      }
    }

    if (nome === 'criar_feature') {
      var projetoCf = args.projeto;
      var fullName = args.fullName;
      var featureCf = args.feature;
      var descricaoCf = args.descricao || featureCf;
      var slug = featureCf.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .slice(0, 40);

      var instrucoes =
        '## Criar Feature: ' + featureCf + '\n\n' +
        '**Projeto:** ' + projetoCf + '\n' +
        '**Repo:** ' + fullName + '\n' +
        '**Branch:** feature/' + slug + '\n\n' +
        '### PASSO 1 — Contexto automático\n' +
        'Execute automaticamente:\n' +
        '```\n' +
        'rag_buscar("' + slug.replace(/-/g, ' ') + '")\n' +
        'buscar_historico("' + slug.replace(/-/g, ' ') + '")\n' +
        'buscar_solucao("' + featureCf + '")\n' +
        '```\n\n' +
        '### PASSO 2 — Planejar\n' +
        'Execute: planejar_feature com projeto "' + projetoCf + '" e feature "' + featureCf + '"\n\n' +
        '### PASSO 3 — Implementar\n' +
        'Implemente todos os arquivos necessários.\n' +
        'Para cada arquivo: use salvar_arquivo_staging\n\n' +
        'Regras obrigatórias:\n' +
        '- Cores de constants/colors.ts\n' +
        '- initializeAuth + AsyncStorage\n' +
        '- expo-auth-session (nunca google-signin)\n' +
        '- ScrollContainer no web\n' +
        '- Validação em todos os formulários\n\n' +
        '### PASSO 4 — Publicar\n' +
        'Execute: publicar_funcionalidade com:\n' +
        '- fullName: "' + fullName + '"\n' +
        '- nomeFuncionalidade: "' + slug + '"\n' +
        '- descricao: "' + descricaoCf + '"\n\n' +
        '### PASSO 5 — QA automático\n' +
        'Execute: revisar_pr com fullName e número do PR gerado\n\n' +
        '### PASSO 6 — Documentar\n' +
        'Execute: salvar_decisao com as decisões tomadas\n' +
        'Execute: salvar_contexto_conversa com o resumo\n' +
        'Re-indexe: python C:/Users/gusta/obsidian/indexar_rapido.py && python C:/Users/gusta/obsidian/indexar_obsidian_chroma.py --server\n\n' +
        '### PASSO 7 — Marcar como concluída\n' +
        'Se estava em features-pendentes.md, marque como [x]\n\n' +
        '---\n' +
        'Execute os passos em ordem. Confirme cada um antes de avançar.';

      return Promise.resolve(instrucoes);
    }

    return executarAnterior(nome, args);
  };
};
