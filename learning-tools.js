'use strict';

/**
 * Ferramentas MCP de aprendizado automático — erros e soluções (Obsidian).
 * Registra em: C:/Users/gusta/obsidian/fabrica/erros-e-solucoes.md
 */

function normalizarTexto(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokensRelevantes(texto) {
  var STOP = ['que', 'para', 'com', 'uma', 'dos', 'das', 'por', 'sao', 'ser', 'tem',
    'nao', 'mais', 'como', 'mas', 'seu', 'sua', 'isso', 'este', 'esta', 'the', 'and',
    'not', 'found', 'could', 'error', 'erro'];
  return normalizarTexto(texto).split(' ')
    .filter(function(t) { return t.length > 2 && STOP.indexOf(t) === -1; });
}

function pontuarTrecho(trecho, tokens) {
  var norm = normalizarTexto(trecho);
  var score = 0;
  tokens.forEach(function(t) {
    if (norm.indexOf(t) !== -1) score += 1;
  });
  return score;
}

function buscarNoArquivoErros(conteudo, query, limite) {
  limite = limite || 5;
  var tokens = tokensRelevantes(query);
  if (!conteudo || tokens.length === 0) return [];

  var blocos = conteudo.split(/\n---\n/);
  var scored = blocos.map(function(bloco) {
    return { bloco: bloco.trim(), score: pontuarTrecho(bloco, tokens) };
  }).filter(function(item) {
    return item.score > 0 && item.bloco.indexOf('# Erros e Soluções') !== 0;
  });

  scored.sort(function(a, b) { return b.score - a.score; });
  return scored.slice(0, limite);
}

function slugArquivo(nome) {
  return (nome || 'padrao')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function aplicarTemplate(template, vars) {
  var out = template;
  Object.keys(vars).forEach(function(k) {
    out = out.split('{{' + k + '}}').join(vars[k] || '');
  });
  return out;
}

module.exports = function registerLearningTools(ctx) {
  var TOOLS = ctx.TOOLS;
  var fs = ctx.fs;
  var path = ctx.path;
  var OBSIDIAN_FABRICA = ctx.OBSIDIAN_FABRICA;
  var buscarHistoricoRemoto = ctx.buscarHistoricoRemoto;
  var garantirDirMemoria = ctx.garantirDirMemoria;
  var formatarDataDecisao = ctx.formatarDataDecisao;
  var reindexarRagObsidian = ctx.reindexarRagObsidian;
  var executarAnterior = ctx.executar;

  var ERROS_PATH = path.join(OBSIDIAN_FABRICA, 'erros-e-solucoes.md');
  var TEMPLATE_PATH = path.join(OBSIDIAN_FABRICA, 'template-erro-aprendizado.md');

  var MAPA_PADROES = {
    auth: 'auth-patterns.md',
    firebase: 'firebase-setup-patterns.md',
    storage: 'storage-patterns.md',
    navegacao: 'expo-router-navegacao.md',
    google: 'auth-patterns.md',
    signin: 'auth-patterns.md',
    expo: 'react-native-fundamentos.md',
    firestore: 'firestore-schemas.md',
    geral: 'padroes-fabrica.md'
  };

  TOOLS.push({
    name: 'buscar_solucao',
    description: 'Busca erros já resolvidos no Obsidian (erros-e-solucoes.md) e no RAG. Use antes de corrigir qualquer erro.',
    inputSchema: {
      type: 'object',
      properties: {
        erro:    { type: 'string', description: 'Mensagem ou trecho do erro' },
        projeto: { type: 'string', description: 'Nome do projeto (opcional)' },
        topK:    { type: 'number', description: 'Quantos resultados (default: 5)' }
      },
      required: ['erro']
    }
  });

  TOOLS.push({
    name: 'analisar_e_aprender',
    description: 'Investiga um erro: busca soluções anteriores, padrões da fábrica e sugere causa/solução.',
    inputSchema: {
      type: 'object',
      properties: {
        projeto:  { type: 'string' },
        erro:     { type: 'string' },
        contexto: { type: 'string' }
      },
      required: ['projeto', 'erro']
    }
  });

  TOOLS.push({
    name: 'registrar_erro_solucao',
    description: 'Registra erro resolvido em erros-e-solucoes.md usando o template da fábrica.',
    inputSchema: {
      type: 'object',
      properties: {
        projeto:   { type: 'string' },
        erro:      { type: 'string' },
        contexto:  { type: 'string' },
        causa:     { type: 'string' },
        solucao:   { type: 'string' },
        arquivos:  { type: 'string', description: 'Arquivos alterados (lista ou texto)' },
        tags:      { type: 'string', description: 'Tags separadas por vírgula' }
      },
      required: ['projeto', 'erro', 'causa', 'solucao']
    }
  });

  TOOLS.push({
    name: 'atualizar_padrao',
    description: 'Adiciona ou atualiza seção em arquivo de padrões da fábrica (Obsidian/fabrica).',
    inputSchema: {
      type: 'object',
      properties: {
        arquivo:  { type: 'string', description: 'Ex: auth-patterns.md ou tag: auth' },
        secao:    { type: 'string', description: 'Título da seção em markdown' },
        conteudo: { type: 'string', description: 'Conteúdo markdown da seção' }
      },
      required: ['arquivo', 'secao', 'conteudo']
    }
  });

  function resolverArquivoPadrao(arquivoOuTag) {
    var chave = slugArquivo(arquivoOuTag);
    if (arquivoOuTag && arquivoOuTag.indexOf('.md') !== -1) {
      return arquivoOuTag;
    }
    if (MAPA_PADROES[chave]) {
      return MAPA_PADROES[chave];
    }
    var keys = Object.keys(MAPA_PADROES);
    for (var i = 0; i < keys.length; i++) {
      if (chave.indexOf(keys[i]) !== -1 || keys[i].indexOf(chave) !== -1) {
        return MAPA_PADROES[keys[i]];
      }
    }
    return 'padroes-fabrica.md';
  }

  function executarBuscarSolucao(args) {
    var partes = [];
    var query = args.erro;
    if (args.projeto) {
      query = args.projeto + ' ' + query;
    }

    if (fs.existsSync(ERROS_PATH)) {
      var conteudo = fs.readFileSync(ERROS_PATH, 'utf-8');
      var matches = buscarNoArquivoErros(conteudo, args.erro, args.topK || 5);
      if (matches.length > 0) {
        partes.push('## Soluções registradas (erros-e-solucoes.md)\n');
        matches.forEach(function(m, i) {
          partes.push('### Match ' + (i + 1) + ' (relevância: ' + m.score + ')\n' + m.bloco.slice(0, 1200) + '\n');
        });
      } else {
        partes.push('Nenhuma solução registrada ainda para este erro em erros-e-solucoes.md.\n');
      }
    } else {
      partes.push('Arquivo erros-e-solucoes.md ainda não existe em ' + ERROS_PATH + '\n');
    }

    return buscarHistoricoRemoto(query, args.topK || 5).then(function(rag) {
      partes.push('\n## Histórico RAG (Obsidian/Chroma)\n' + (rag || 'RAG indisponível.'));
      return partes.join('\n');
    });
  }

  function executarAnalisar(args) {
    var erro = args.erro;
    var contexto = args.contexto || '';
    var projeto = args.projeto;
    var sugestoes = [];

    var norm = normalizarTexto(erro + ' ' + contexto);
    if (norm.indexOf('googlesignin') !== -1 || norm.indexOf('rngoogle') !== -1) {
      sugestoes.push(
        '- Pacote nativo @react-native-google-signin não funciona no Expo Go.\n' +
        '- Usar expo-auth-session + Google provider (padrão Setmatch).\n' +
        '- Remover imports de RNGoogleSignin; auth em utils/firebaseConfig.ts.'
      );
    }
    if (norm.indexOf('turbomodule') !== -1) {
      sugestoes.push(
        '- TurboModuleRegistry indica módulo nativo ausente no runtime (Expo Go).\n' +
        '- Trocar por alternativa Expo-compatible ou usar development build (EAS).'
      );
    }

    return executarBuscarSolucao({ erro: erro, projeto: projeto, topK: 5 }).then(function(busca) {
      var arquivosPadrao = [];
      Object.keys(MAPA_PADROES).forEach(function(tag) {
        if (norm.indexOf(tag) !== -1) {
          arquivosPadrao.push(MAPA_PADROES[tag]);
        }
      });
      if (arquivosPadrao.length === 0) {
        arquivosPadrao.push('auth-patterns.md', 'padroes-fabrica.md');
      }

      var refs = '';
      arquivosPadrao.forEach(function(arq) {
        var p = path.join(OBSIDIAN_FABRICA, arq);
        if (fs.existsSync(p)) {
          var trecho = fs.readFileSync(p, 'utf-8').slice(0, 800);
          refs += '\n### Referência: ' + arq + '\n' + trecho + '\n...\n';
        }
      });

      return (
        '# Análise de erro — ' + projeto + '\n\n' +
        '**Erro:** ' + erro + '\n\n' +
        '**Contexto:** ' + (contexto || 'Não informado') + '\n\n' +
        '## Sugestões automáticas\n' +
        (sugestoes.length ? sugestoes.join('\n') : '- Consulte busca abaixo e padrões da fábrica.\n') +
        '\n## Busca de soluções anteriores\n' + busca + '\n' +
        '## Padrões relacionados\n' + (refs || 'Nenhum arquivo de padrão encontrado.') + '\n\n' +
        '## Próximos passos\n' +
        '1. Aplicar correção no código\n' +
        '2. `registrar_erro_solucao` com causa e solução\n' +
        '3. `atualizar_padrao` se for padrão reutilizável\n' +
        '4. Re-indexar: python C:/Users/gusta/obsidian/indexar_rapido.py && python C:/Users/gusta/obsidian/indexar_obsidian_chroma.py --server'
      );
    });
  }

  function executarRegistrar(args) {
    garantirDirMemoria(OBSIDIAN_FABRICA);

    if (!fs.existsSync(ERROS_PATH)) {
      fs.writeFileSync(ERROS_PATH,
        '# Erros e Soluções — Fábrica de Software\n\n' +
        '> Registro automático de erros resolvidos pelo agente.\n' +
        '> Atualizado após cada solução para que a fábrica aprenda.\n\n---\n',
        'utf-8');
    }

    var template = fs.existsSync(TEMPLATE_PATH)
      ? fs.readFileSync(TEMPLATE_PATH, 'utf-8')
      : (
        '\n## {{data}} — {{projeto}} — {{titulo}}\n\n' +
        '**Erro:** {{erro}}\n\n' +
        '**Contexto:** {{contexto}}\n\n' +
        '**Causa:** {{causa}}\n\n' +
        '**Solução:** {{solucao}}\n\n' +
        '**Arquivos:** {{arquivos}}\n\n' +
        '**Tags:** {{tags}}\n\n---\n'
      );

    var titulo = (args.erro || '').slice(0, 80);
    var bloco = aplicarTemplate(template, {
      data:     formatarDataDecisao(),
      projeto:  args.projeto,
      titulo:   titulo,
      erro:     args.erro,
      contexto: args.contexto || 'N/A',
      causa:    args.causa,
      solucao:  args.solucao,
      arquivos: args.arquivos || 'N/A',
      tags:     args.tags || ''
    });

    fs.appendFileSync(ERROS_PATH, '\n' + bloco.trim() + '\n', 'utf-8');
    var cabecalho =
      'Erro registrado em erros-e-solucoes.md\n' +
      'Projeto: ' + args.projeto + '\n' +
      'Título: ' + titulo + '\n\n';
    if (!reindexarRagObsidian) {
      return Promise.resolve(
        cabecalho +
        'Re-indexe o RAG:\n' +
        '  python C:/Users/gusta/obsidian/indexar_rapido.py\n' +
        '  python C:/Users/gusta/obsidian/indexar_obsidian_chroma.py --server'
      );
    }
    return reindexarRagObsidian().then(function(logReindex) {
      return cabecalho + 'RAG reindexado automaticamente:\n' + logReindex;
    });
  }

  function executarAtualizarPadrao(args) {
    garantirDirMemoria(OBSIDIAN_FABRICA);
    var nomeArquivo = resolverArquivoPadrao(args.arquivo);
    var arquivoPath = path.join(OBSIDIAN_FABRICA, nomeArquivo);

    if (!fs.existsSync(arquivoPath)) {
      fs.writeFileSync(arquivoPath, '# ' + nomeArquivo.replace('.md', '') + '\n\n', 'utf-8');
    }

    var secao = args.secao.indexOf('##') === 0 ? args.secao : '## ' + args.secao;
    var bloco =
      '\n' + secao + '\n\n' +
      '*Atualizado em ' + formatarDataDecisao() + '*\n\n' +
      args.conteudo + '\n\n---\n';

    fs.appendFileSync(arquivoPath, bloco, 'utf-8');
    var cabecalho =
      'Padrão atualizado: ' + arquivoPath + '\n' +
      'Seção: ' + secao + '\n\n';
    if (!reindexarRagObsidian) {
      return Promise.resolve(
        cabecalho +
        'Re-indexe o RAG:\n' +
        '  python C:/Users/gusta/obsidian/indexar_rapido.py\n' +
        '  python C:/Users/gusta/obsidian/indexar_obsidian_chroma.py --server'
      );
    }
    return reindexarRagObsidian().then(function(logReindex) {
      return cabecalho + 'RAG reindexado automaticamente:\n' + logReindex;
    });
  }

  return function executarComLearning(nome, args) {
    if (nome === 'buscar_solucao') {
      return executarBuscarSolucao(args);
    }
    if (nome === 'analisar_e_aprender') {
      return executarAnalisar(args);
    }
    if (nome === 'registrar_erro_solucao') {
      return executarRegistrar(args);
    }
    if (nome === 'atualizar_padrao') {
      return executarAtualizarPadrao(args);
    }
    return executarAnterior(nome, args);
  };
};
