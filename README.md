# Fábrica de Apps MCP

Sistema completo de criação de apps com agentes de IA.
Você descreve o app, o sistema orquestra tudo automaticamente.

## Fluxo completo

```
VOCÊ: "Quero um app de gestão de petshop"
         ↓
ORQUESTRADOR cria repositório GitHub
         ↓
AGENTE UX define visual e componentes
         ↓
AGENTE FIREBASE monta schema e regras
         ↓
AGENTE FRONTEND gera telas (uma por vez)
         ↓
AGENTE QA revisa cada tela
         ↓
PR criado no GitHub ✅
```

## Setup — 4 passos

### 1. Copiar arquivos
Coloque `server.js` em `C:\Users\gusta\fabrica-apps-mcp\`
Coloque o `CLAUDE.md` na mesma pasta.

### 2. Configurar mcp.json
Abra `C:\Users\gusta\.cursor\mcp.json` e cole:

```json
{
  "mcpServers": {
    "fabrica-apps": {
      "command": "node",
      "args": ["C:/Users/gusta/fabrica-apps-mcp/server.js"],
      "env": {
        "GITHUB_TOKEN": "SEU_TOKEN_AQUI",
        "GITHUB_USER":  "seu-usuario-github",
        "FABRICA_PATH": "C:/Users/gusta/fabrica-apps-mcp"
      }
    }
  }
}
```

### 3. Criar GitHub Token
1. github.com/settings/tokens
2. Generate new token (classic)
3. Marcar: `repo` (acesso completo)
4. Copiar e colar no mcp.json

### 4. Reiniciar o Cursor
Settings → Tools & MCP → confirmar `fabrica-apps` conectado

## Como usar

No chat do Cursor, basta descrever o app:

```
Quero criar um app de gestão de petshop.
O dono cadastra pets, agendamentos de banho/tosa,
controla estoque de produtos e vê relatório financeiro.
Público: donos de petshop pequenos.
```

O Orquestrador vai:
1. Chamar `criar_projeto_completo` → cria repo no GitHub
2. Chamar `obter_prompt_agente` para UX → você valida
3. Chamar `obter_prompt_agente` para Firebase → você valida
4. E assim por diante...

## Ferramentas disponíveis

| Ferramenta | O que faz |
|---|---|
| `criar_projeto_completo` | Cria repo GitHub + PROJECT.md + CLAUDE.md + .cursorrules |
| `obter_prompt_agente` | Gera prompt para UX / Firebase / Frontend / QA |
| `listar_repos_github` | Lista seus repositórios |
| `criar_branch` | Cria branch para um agente trabalhar |
| `ler_secao_claude` | Lê seção específica do CLAUDE.md |
| `checar_padrao_lashmatch` | Padrões obrigatórios antes de gerar código |
| `gerar_project_md` | Gera PROJECT.md sem criar repo |
| `status_fabrica` | Verifica se tudo está configurado |
