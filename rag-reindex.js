'use strict';

/**
 * Reindexação RAG após gravar memória no Obsidian.
 * Fluxo: indexar_rapido.py (indexa) → reinicia indexar_obsidian_chroma.py --server (só HTTP)
 */

var execSync = require('child_process').execSync;
var spawn = require('child_process').spawn;
var http = require('http');

var INDEXAR_RAPIDO = 'C:/Users/gusta/obsidian/indexar_rapido.py';
var INDEXAR_CHROMA = 'C:/Users/gusta/obsidian/indexar_obsidian_chroma.py';
var CHROMA_PORT = 7332;

function envPython() {
  return Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8' });
}

function servidorRagOnline() {
  return new Promise(function(resolve) {
    var req = http.get('http://localhost:' + CHROMA_PORT + '/buscar', function(res) {
      res.resume();
      resolve(res.statusCode < 500);
    });
    req.on('error', function() { resolve(false); });
    req.setTimeout(2000, function() {
      req.destroy();
      resolve(false);
    });
  });
}

function matarServidorNaPorta(porta) {
  try {
    if (process.platform !== 'win32') return;
    var out = execSync('netstat -ano | findstr :' + porta, { encoding: 'utf8', stdio: 'pipe' });
    var pids = {};
    out.split('\n').forEach(function(line) {
      if (line.indexOf('LISTENING') === -1) return;
      var parts = line.trim().split(/\s+/);
      var pid = parts[parts.length - 1];
      if (pid && pid !== '0') pids[pid] = true;
    });
    Object.keys(pids).forEach(function(pid) {
      try {
        execSync('taskkill /F /PID ' + pid, { stdio: 'pipe' });
      } catch (e) { /* ignore */ }
    });
  } catch (e) { /* porta livre */ }
}

function iniciarServidorRag() {
  var child = spawn('python', [INDEXAR_CHROMA, '--server'], {
    detached: true,
    stdio: 'ignore',
    env: envPython(),
    windowsHide: true,
  });
  child.unref();
}

/**
 * @param {{ timeoutMs?: number }} opcoes
 * @returns {Promise<string>}
 */
function reindexarRagObsidian(opcoes) {
  opcoes = opcoes || {};
  var logs = [];

  try {
    logs.push('1/2 indexar_rapido.py...');
    execSync('python "' + INDEXAR_RAPIDO + '"', {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: opcoes.timeoutMs || 600000,
      env: envPython(),
    });
    logs.push('   OK — Chroma atualizado.');
  } catch (e) {
    var msg = (e && e.message) ? e.message : String(e);
    return Promise.resolve('Falha no indexar_rapido.py:\n' + msg);
  }

  return servidorRagOnline().then(function(online) {
    if (online) {
      logs.push('2/2 Reiniciando servidor RAG (porta ' + CHROMA_PORT + ')...');
      matarServidorNaPorta(CHROMA_PORT);
    } else {
      logs.push('2/2 Subindo servidor RAG (porta ' + CHROMA_PORT + ')...');
    }
    try {
      iniciarServidorRag();
      logs.push('   OK — indexar_obsidian_chroma.py --server em background.');
    } catch (e) {
      logs.push('   Aviso: falha ao subir --server. Rode manualmente:\n' +
        '   python C:/Users/gusta/obsidian/indexar_obsidian_chroma.py --server');
    }
    return logs.join('\n');
  });
}

module.exports = {
  reindexarRagObsidian: reindexarRagObsidian,
  servidorRagOnline: servidorRagOnline,
};
