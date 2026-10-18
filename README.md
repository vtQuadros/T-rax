<p align="center">
  <img src="src-tauri/icons/128x128@2x.png" width="128" alt="T-rax" />
</p>

# T-rax — versão Linux

Código-fonte da versão Linux do T-rax: um workspace de desenvolvimento "terminal-first" com IA,
feito com Tauri 2 (Rust) + React 19. Para baixar o app pronto, veja a branch `main` ou a página de
[Releases](https://github.com/vtQuadros/T-rax/releases).

## Rodando a partir do código

Pacotes do sistema (Debian/Ubuntu/Zorin):

```bash
sudo apt install -y pkg-config libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libssl-dev libsoup-3.0-dev libjavascriptcoregtk-4.1-dev
```

Rust (via [rustup](https://rustup.rs)) e Node.js 22+, depois:

```bash
npm install
npm run tauri dev
```

`npm run dev` sozinho abre só a interface no navegador, com um backend simulado (`src/dev/mockIpc.ts`).

## Gerando os pacotes

```bash
npm run tauri build
```

Saída em `src-tauri/target/release/bundle/` (`.deb` e `.AppImage`). Para instalar o binário compilado
só no seu usuário, com ícone e atalho no menu:

```bash
scripts/install-linux.sh
```

(`scripts/install-linux.sh --uninstall` remove.)

## Estrutura

```
src/                 Frontend React
  ai/                provedores (streaming), loop do agente + ferramentas, autocomplete
  components/        painéis e views (terminal, editor, explorer, git, IA, preview…)
  lib/               wrappers de IPC, stores (zustand), temas, diff e grafo de commits
src-tauri/src/       Backend Rust
  pty.rs             terminais (portable-pty, streaming por Channel)
  fs.rs              arquivos, busca fuzzy e grep (respeita .gitignore)
  git.rs             status, diff, stage por hunk, commit, push, log
  shell.rs           comandos não interativos para o agente (com timeout)
  ai.rs              proxy de streaming HTTP para os provedores de IA (cancelável)
docs/analysis.md     como o Terax original foi analisado (REA + código aberto)
```

Testes do backend: `cd src-tauri && cargo test`.

## Atalhos

| Teclas | Ação |
| --- | --- |
| Ctrl+P | Ir para arquivo |
| Ctrl+Shift+P | Paleta de comandos |
| Ctrl+Shift+T / Ctrl+Shift+W | Novo terminal / fechar aba |
| Ctrl+Tab, Ctrl+1…9 | Trocar de aba |
| Ctrl+Shift+E / F / G / K | Explorer / Busca / Git / Tarefas |
| Ctrl+B, Ctrl+I | Mostrar/ocultar barra lateral / painel do agente |
| Ctrl+O, Ctrl+, | Abrir pasta / configurações |

Dentro do terminal só os atalhos com Ctrl+Shift são capturados; os Ctrl simples vão para o shell.

## Problemas conhecidos

**Janela vazia (cinza) ao abrir.** O WebKitGTK trava se `~/.cache/fontconfig` tiver caches `cache-9`
que são symlinks para `cache-12` (criados por apps com fontconfig mais novo). Correção:

```bash
find ~/.cache/fontconfig -maxdepth 1 -type l -name '*.cache-*' -lname '*.cache-12' -delete
```

```bash
fc-cache -f
```
