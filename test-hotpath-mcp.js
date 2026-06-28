'use strict';
/** Smoke test — rag_buscar / buscar_historico hot path (nao roda no CI). */

var RAG_SERVER_OFFLINE =
  'Servidor RAG offline. Rode: python C:/Users/gusta/obsidian/indexar_obsidian_chroma.py --server';

function buscarRemoto(query, topK, port) {
  return new Promise(function(resolve) {
    var http = require('http');
    var url = '/buscar?q=' + encodeURIComponent(query) + '&n=' + (topK || 5);
    var req = http.request({
      hostname: '127.0.0.1',
      port: port,
      path: url,
      method: 'GET',
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
          var texto = 'OK hits=' + resultados.length;
          resolve(texto);
        } catch (e) {
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

function run() {
  var t0 = Date.now();
  return buscarRemoto('firebase deploy checklist', 5, 7332).then(function(online) {
    var ms = Date.now() - t0;
    console.log('[online] ' + ms + 'ms — ' + online);
    if (ms >= 200) console.warn('WARN: latencia >= 200ms');
    return buscarRemoto('teste offline', 5, 7333);
  }).then(function(offline) {
    console.log('[offline] ' + offline);
    if (offline.indexOf('CLAUDE') >= 0 || offline.indexOf('fallback') >= 0) {
      console.error('FAIL: resposta parece TF-IDF legado');
      process.exit(1);
    }
    if (offline !== RAG_SERVER_OFFLINE) {
      console.error('FAIL: mensagem offline inesperada');
      process.exit(1);
    }
    console.log('OK');
  });
}

run().catch(function(e) {
  console.error(e);
  process.exit(1);
});
