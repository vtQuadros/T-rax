<p align="center">
  <img src="assets/t-rax.png" width="160" alt="T-rax" />
</p>

<h1 align="center">T-rax</h1>

<p align="center">
  <b>Terminal, editor, git, agentes de IA e preview web — numa janela só.</b><br/>
  Leve, rápido e com dentes afiados. 🦖
</p>

<p align="center">
  <a href="https://github.com/vtQuadros/Clone-Terax/releases/latest">Downloads</a> ·
  <a href="#recursos">Recursos</a> ·
  <a href="#instalação">Instalação</a> ·
  <a href="#branches">Branches</a>
</p>

---

## O que é

O **T-rax** é um workspace de desenvolvimento *terminal-first* e *AI-native*: você abre uma pasta e tem
terminal, editor de código, controle de versão, um agente de IA que lê e altera o projeto (sempre com
diff para revisar antes) e o preview do seu app rodando, tudo lado a lado.

O nome é uma brincadeira com o **T-REX** — e uma homenagem ao [Terax](https://terax.app/), projeto
open source (Apache-2.0) que inspirou este. O T-rax foi reescrito do zero com Tauri 2 (Rust) + React,
depois de estudar o Terax com a ferramenta de engenharia reversa [REA](https://github.com/morluto/rea)
e o código aberto dele. Não é afiliado ao Terax.

## Downloads

| Sistema | Arquivo | Como instalar |
| --- | --- | --- |
| **Linux** — Debian, Ubuntu, Zorin, Mint | [`T-rax_0.1.0_amd64.deb`](https://github.com/vtQuadros/Clone-Terax/releases/download/v0.1.0/T-rax_0.1.0_amd64.deb) | `sudo apt install ./T-rax_0.1.0_amd64.deb` |
| **Linux** — qualquer distro | [`T-rax_0.1.0_amd64.AppImage`](https://github.com/vtQuadros/Clone-Terax/releases/download/v0.1.0/T-rax_0.1.0_amd64.AppImage) | `chmod +x T-rax_0.1.0_amd64.AppImage` e execute |
| **Windows** | em breve | — |
| **macOS** | não planejado por enquanto | — |

Todas as versões ficam em [Releases](https://github.com/vtQuadros/Clone-Terax/releases).

## Recursos

- **Terminal de verdade** — xterm.js com renderização WebGL, várias abas, PTY nativo, links clicáveis.
- **Editor** — CodeMirror 6 com modo Vim, 8 temas, `Ctrl+S` para salvar e **autocomplete com IA** (Tab aceita).
- **Explorer** — ícones Catppuccin, navegação por teclado, criar/renomear/apagar pelo menu de contexto.
- **Busca** — no conteúdo de todo o projeto (texto ou regex, respeita `.gitignore`) e busca de arquivo por nome (`Ctrl+P`).
- **Git** — stage/unstage/descartar por arquivo **ou por trecho (hunk)**, commit com `Ctrl+Enter`, push,
  e um **grafo de commits** com branches, merges e tags.
- **Agente de IA** — lê, procura, propõe edições (cada uma vira um **diff para você aceitar ou rejeitar**),
  roda comandos (com sua aprovação), mantém um plano de tarefas e cria sub-agentes de pesquisa.
- **Seus modelos, sua chave** — OpenAI, Anthropic, Groq, OpenRouter, ou **100% local** com LM Studio / Ollama.
- **Memória por projeto** — um arquivo `TRAX.md` na raiz que o agente lê a cada conversa.
- **Planos e tarefas** — lista de tarefas compartilhada entre você e o agente.
- **Snippets** — prompts reutilizáveis chamados com `/nome` no chat.
- **Preview web** — detecta servidores de dev (Vite, Next, Astro…) no terminal e abre numa aba.
- **Temas** — 10 paletas, tema do editor independente, temas personalizados (exporta/importa JSON) e
  imagem de fundo com opacidade e blur.
- **Leve** — binário de ~8 MB, sem Electron, sem conta, sem telemetria.

## Instalação

### Linux (.deb)

```bash
sudo apt install ./T-rax_0.1.0_amd64.deb
```

Depois procure **T-rax** no menu de aplicativos, ou rode `t-rax` no terminal. Para abrir direto numa
pasta: `t-rax ~/meu-projeto`.

### Linux (AppImage)

```bash
chmod +x T-rax_0.1.0_amd64.AppImage
```

```bash
./T-rax_0.1.0_amd64.AppImage
```

### Configurando a IA

Abra **Settings** (`Ctrl+,`) → **AI Providers**, escolha um provedor e cole sua chave. Para rodar sem
internet, use **LM Studio** ou **Ollama** — nada sai da sua máquina.

### Janela vazia ao abrir?

Alguns sistemas têm caches de fontes incompatíveis que travam o WebKitGTK. Rode:

```bash
find ~/.cache/fontconfig -maxdepth 1 -type l -name '*.cache-*' -lname '*.cache-12' -delete
```

```bash
fc-cache -f
```

## Branches

| Branch | Conteúdo |
| --- | --- |
| `main` | Esta página: apresentação e downloads |
| [`Linux`](https://github.com/vtQuadros/Clone-Terax/tree/Linux) | Código-fonte da versão Linux (Tauri 2 + React) e instruções de build |
| [`Windows`](https://github.com/vtQuadros/Clone-Terax/tree/Windows) | Versão Windows — em desenvolvimento |
