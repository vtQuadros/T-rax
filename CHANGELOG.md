# Changelog

Todas as versões do T-rax. Cada uma tem sua página em
[Releases](https://github.com/vtQuadros/T-rax/releases), com o `.deb`, o AppImage e os checksums.
Versões marcadas com **(LTS)** são as estáveis recomendadas.

## [1.0.0] - 2026-10-20 (LTS)

Primeira versão estável do T-rax, marcada como **LTS**: é a versão recomendada para uso no dia a dia.
Reúne tudo das versões 0.x (terminal, editor, git, agente de IA, visualizador de imagens e PDFs,
atualização automática) com as novidades abaixo.

### Novo
- Painel do agente com **minimizar** (vira uma faixa fina à direita; um clique reabre) e **fechar**.
  Reabra pelo ícone do agente na barra lateral, pelo botão "Agent", com `Ctrl+I` ou pela paleta. O app
  lembra como você deixou o painel. A faixa minimizada avisa quando o agente está trabalhando ou
  esperando sua revisão.
- **Arrastar arquivos** do sistema para o T-rax:
  - no painel do agente, viram anexos da mensagem (borda verde ao arrastar);
  - no terminal, o caminho é colado entre aspas;
  - no resto da janela, o arquivo abre numa aba (imagem e PDF no visualizador, código no editor).
- **Anexos no agente**, por arrastar ou pelo clipe no campo de mensagem: imagens (png, jpg, gif, webp,
  até 5 MB) vão como imagem para modelos com visão; PDFs têm o texto extraído (funciona com qualquer
  modelo, inclusive locais); arquivos de texto e código vão com o conteúdo.

## [0.2.2] - 2026-10-20

### Novo
- O explorer acompanha o terminal: um `cd ..` ou `cd /home` no terminal da aba ativa muda a pasta
  mostrada à esquerda. Trocar de aba mostra a pasta daquele terminal. O botão de corrente no cabeçalho
  do explorer liga e desliga esse comportamento.
- Abas renomeáveis: duplo clique no nome (ou botão direito → Rename, ou `F2`). Enter salva, Esc cancela,
  nome vazio volta ao padrão. Também na paleta: *Rename Tab*.
- Botão direito na aba: Rename, Close e Close Others.
- **Imagens e PDFs** abrem numa aba de visualização em vez do erro "binary file" ([#4](https://github.com/vtQuadros/T-rax/issues/4)):
  - Imagens (png, jpg, gif, webp, avif, bmp, ico, svg): ajustar à tela, 100%, `+`/`−`, `Ctrl` + scroll,
    arrastar quando ampliada, fundo xadrez para transparência, dimensões e tamanho; SVG com *View source*.
  - PDFs (pdf.js): rolagem contínua, página X de Y com "ir para página", zoom e ajustar à largura, texto
    selecionável e busca com destaque (`Ctrl+F`, Enter/Shift+Enter entre resultados). Só as páginas
    visíveis são renderizadas, então PDFs grandes abrem rápido.
  - Recarregam sozinhos quando o arquivo muda no disco; botão para abrir no app padrão do sistema.
  - Cada arquivo aberto é liberado individualmente para a interface (sem expor pastas inteiras).
- Explorer: "Open in System App" no menu de botão direito.

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
