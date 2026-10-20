# Changelog

Todas as versões do T-rax. Cada uma tem sua página em
[Releases](https://github.com/vtQuadros/T-rax/releases), com o `.deb`, o AppImage e os checksums.

## [0.2.1] - 2026-10-20

### Corrigido
- Explorer e listas voltam ao design: só texto, setas nas pastas e status do git à direita.
  Os ícones do Catppuccin ficam opcionais (Settings → Editor & Terminal → *Show file icons*).
- A janela abre maximizada e não passa mais do tamanho da tela (painel do agente e barra de status cortados).

## [0.2.0] - 2026-10-19

### Novo
- Atualização automática: o app verifica novas versões ao abrir e a cada 6 horas. No AppImage, a
  atualização é baixada, verificada pela assinatura e instalada com um clique ("Update & restart").
  No `.deb`, o app avisa e oferece o download do pacote novo.
- Settings → **About & Updates**: versão instalada, verificar agora e desligar a verificação automática.
- Comando "Check for Updates" na paleta (`Ctrl+Shift+P`).

### Design
- Visual novo, minimalista e escuro, com um único acento verde (`docs/design.md`).
- Fontes JetBrains Mono e IBM Plex Sans embutidas e tema de editor próprio.
- Explorer com status do git (M/U/D) e contador de mudanças na barra lateral.
- Diff com números de linha, agente com cards de edição e plano de tarefas, paleta de comandos e tela inicial refeitas.
- Ícones de arquivo monocromáticos (coloridos opcionais em Settings).

## [0.1.0] - 2026-10-17

Primeira versão: terminal multi-aba, editor com Vim e autocomplete por IA, explorer, busca, git com stage
por hunk e grafo de commits, agente de IA com diffs revisáveis, tarefas, preview web e temas.
