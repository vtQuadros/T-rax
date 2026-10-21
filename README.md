<p align="center">
  <img src="assets/t-rax.png" width="160" alt="T-rax" />
</p>

<h1 align="center">T-rax</h1>

<p align="center">
  <b>Terminal, editor, git, agentes de IA e preview web — numa janela só.</b><br/>
  Leve, rápido e com dentes afiados. 🦖
</p>

<p align="center">
  <a href="https://github.com/vtQuadros/T-rax/releases/latest">Downloads</a> ·
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

**Versão mais recente: v1.1.0** (os links sempre apontam para a última versão lançada). Versão estável recomendada: **v1.0.0 LTS**.

| Sistema | Arquivo | Como instalar |
| --- | --- | --- |
| **Linux** — Debian, Ubuntu, Zorin, Mint | [`T-rax_amd64.deb`](https://github.com/vtQuadros/T-rax/releases/latest/download/T-rax_amd64.deb) | `sudo apt install ./T-rax_amd64.deb` |
| **Linux** — qualquer distro | [`T-rax_amd64.AppImage`](https://github.com/vtQuadros/T-rax/releases/latest/download/T-rax_amd64.AppImage) | `chmod +x T-rax_amd64.AppImage` e execute |
| **Windows** 10/11 | [`T-rax_x64-setup.exe`](https://github.com/vtQuadros/T-rax/releases/latest/download/T-rax_x64-setup.exe) | execute o instalador (não pede administrador) |
| **macOS** | não planejado por enquanto | — |

### Todas as versões

Cada versão tem sua página, com o `.deb`, o AppImage e os checksums (`SHA256SUMS.txt`).
Dá para baixar e instalar qualquer uma, inclusive voltar para uma anterior.

| Versão | Data | Destaques | Downloads |
| --- | --- | --- | --- |
| [**v1.1.0**](https://github.com/vtQuadros/T-rax/releases/tag/v1.1.0) | 21/10/2026 | Versão para Windows (PowerShell, explorer seguindo o `cd`, instalador `.exe`) | [.deb](https://github.com/vtQuadros/T-rax/releases/download/v1.1.0/T-rax_1.1.0_amd64.deb) · [AppImage](https://github.com/vtQuadros/T-rax/releases/download/v1.1.0/T-rax_1.1.0_amd64.AppImage) · [.exe](https://github.com/vtQuadros/T-rax/releases/download/v1.1.0/T-rax_1.1.0_x64-setup.exe) |
| [v1.0.0 LTS](https://github.com/vtQuadros/T-rax/releases/tag/v1.0.0) | 20/10/2026 | Primeira versão estável: agente minimizável, arrastar arquivos, anexos no agente | [.deb](https://github.com/vtQuadros/T-rax/releases/download/v1.0.0/T-rax_1.0.0_amd64.deb) · [AppImage](https://github.com/vtQuadros/T-rax/releases/download/v1.0.0/T-rax_1.0.0_amd64.AppImage) |
| [v0.2.2](https://github.com/vtQuadros/T-rax/releases/tag/v0.2.2) | 20/10/2026 | Imagens e PDFs, explorer segue o terminal, abas renomeáveis | [.deb](https://github.com/vtQuadros/T-rax/releases/download/v0.2.2/T-rax_0.2.2_amd64.deb) · [AppImage](https://github.com/vtQuadros/T-rax/releases/download/v0.2.2/T-rax_0.2.2_amd64.AppImage) |
| [v0.2.1](https://github.com/vtQuadros/T-rax/releases/tag/v0.2.1) | 20/10/2026 | Explorer só texto como no design, janela abre maximizada | [.deb](https://github.com/vtQuadros/T-rax/releases/download/v0.2.1/T-rax_0.2.1_amd64.deb) · [AppImage](https://github.com/vtQuadros/T-rax/releases/download/v0.2.1/T-rax_0.2.1_amd64.AppImage) |
| [v0.2.0](https://github.com/vtQuadros/T-rax/releases/tag/v0.2.0) | 19/10/2026 | Atualização automática, visual novo minimalista | [.deb](https://github.com/vtQuadros/T-rax/releases/download/v0.2.0/T-rax_0.2.0_amd64.deb) · [AppImage](https://github.com/vtQuadros/T-rax/releases/download/v0.2.0/T-rax_0.2.0_amd64.AppImage) |
| [v0.1.0](https://github.com/vtQuadros/T-rax/releases/tag/v0.1.0) | 17/10/2026 | Primeira versão | [.deb](https://github.com/vtQuadros/T-rax/releases/download/v0.1.0/T-rax_0.1.0_amd64.deb) · [AppImage](https://github.com/vtQuadros/T-rax/releases/download/v0.1.0/T-rax_0.1.0_amd64.AppImage) |

**LTS** marca as versões estáveis recomendadas para o dia a dia. As versões seguem `MAJOR.MINOR.PATCH`:
`1.0.1` corrige bugs, `1.1.0` traz recursos novos e `2.0.0` traz mudanças grandes.

O histórico completo de mudanças está no [CHANGELOG](https://github.com/vtQuadros/T-rax/blob/Linux/CHANGELOG.md).

## Recursos

- **Terminal de verdade** — xterm.js com renderização WebGL, várias abas, PTY nativo, links clicáveis.
- **Editor** — CodeMirror 6 com modo Vim, 8 temas, `Ctrl+S` para salvar e **autocomplete com IA** (Tab aceita).
- **Explorer** — acompanha o `cd` do terminal, status do git em cada arquivo, navegação por teclado, criar/renomear/apagar pelo menu de contexto.
- **Busca** — no conteúdo de todo o projeto (texto ou regex, respeita `.gitignore`) e busca de arquivo por nome (`Ctrl+P`).
- **Git** — stage/unstage/descartar por arquivo **ou por trecho (hunk)**, commit com `Ctrl+Enter`, push,
  e um **grafo de commits** com branches, merges e tags.
- **Agente de IA** — lê, procura, propõe edições (cada uma vira um **diff para você aceitar ou rejeitar**),
  roda comandos (com sua aprovação), mantém um plano de tarefas e cria sub-agentes de pesquisa.
- **Seus modelos, sua chave** — OpenAI, Anthropic, Groq, OpenRouter, ou **100% local** com LM Studio / Ollama.
- **Memória por projeto** — um arquivo `TRAX.md` na raiz que o agente lê a cada conversa.
- **Planos e tarefas** — lista de tarefas compartilhada entre você e o agente.
- **Imagens e PDFs** — abrem numa aba com zoom; PDFs com busca, texto selecionável e páginas sob demanda.
- **Snippets** — prompts reutilizáveis chamados com `/nome` no chat.
- **Anexos e arrastar arquivos** — solte imagens, PDFs ou código no agente para anexar; no terminal para
  colar o caminho; no resto da janela para abrir. O painel do agente pode ser minimizado ou fechado.
- **Preview web** — detecta servidores de dev (Vite, Next, Astro…) no terminal e abre numa aba.
- **Temas** — 10 paletas, tema do editor independente, temas personalizados (exporta/importa JSON) e
  imagem de fundo com opacidade e blur.
- **Leve** — binário de ~8 MB, sem Electron, sem conta, sem telemetria.

## Instalação

### Linux (.deb)

```bash
sudo apt install ./T-rax_amd64.deb
```

Depois procure **T-rax** no menu de aplicativos, ou rode `t-rax` no terminal. Para abrir direto numa
pasta: `t-rax ~/meu-projeto`.

### Linux (AppImage)

```bash
chmod +x T-rax_amd64.AppImage
```

```bash
./T-rax_amd64.AppImage
```

### Windows

Baixe e execute o `T-rax_x64-setup.exe`. Como o instalador ainda não tem certificado de assinatura de
código, o Windows pode mostrar *"O Windows protegeu o computador"*: clique em **Mais informações →
Executar assim mesmo**. A instalação é só para o seu usuário (não pede administrador) e cria o atalho no
Menu Iniciar. O terminal usa o PowerShell 7, se instalado, ou o Windows PowerShell.

### Atualizações

A partir da v0.2.0, o T-rax verifica novas versões ao abrir e a cada 6 horas:

- **AppImage e Windows:** aparece um aviso com **Update & restart**. O app baixa a versão nova, confere a
  assinatura digital e se substitui sozinho.
- **.deb:** aparece um aviso com o link do pacote novo. Instale por cima do atual com
  `sudo apt install ./T-rax_X.Y.Z_amd64.deb`; suas configurações são mantidas.

Você também pode verificar em **Settings → About & Updates** ou na paleta (`Ctrl+Shift+P` →
*Check for Updates*), e desligar a verificação automática por lá. Quem está na v0.1.0 precisa
instalar a v0.2.0 manualmente uma vez.

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
| [`Linux`](https://github.com/vtQuadros/T-rax/tree/Linux) | Código-fonte (Tauri 2 + React), o mesmo para Linux e Windows, e instruções de build |
| [`Windows`](https://github.com/vtQuadros/T-rax/tree/Windows) | Espelho do mesmo código, mantido em sincronia com a `Linux` |
