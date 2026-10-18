# Design do T-rax

Visual minimalista e escuro, com um único acento verde. Baseado nas recomendações do
[ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) para *Developer Tool / IDE*:
Dark Mode + Minimalism & Swiss, paleta de tema de sintaxe com verde de "run" e o par tipográfico
"Developer Mono". Vale para todas as plataformas (Linux e Windows).

## Cores (tema T-rax Default)

| Token | Hex | Uso |
| --- | --- | --- |
| `bg` | `#0B0D0C` | fundo da janela, terminal, editor |
| `panel` | `#0E1110` | barras laterais, painel do agente |
| `elevated` | `#121614` | inputs, cards, cabeçalho de hunk |
| `hover` | `#1A1F1C` | hover e item selecionado |
| `border` | `#1E2421` | linhas finas (divisórias) |
| `border-strong` | `#252B28` | contorno de cards, inputs e botões secundários |
| `fg` | `#E7ECE9` | texto principal (16.3:1) |
| `fg-soft` | `#C9D1CC` | texto secundário (12.5:1) |
| `muted` | `#8B948F` | rótulos (6.2:1) |
| `dim` | `#7A837E` | números de linha, dicas (5.0:1) |
| `accent` | `#4ADE80` | a única cor de marca: aba ativa, botão primário, adições |
| `accent-fg` | `#052E16` | texto sobre o acento (8.6:1) |
| `blue` | `#60A5FA` | anel de foco e links |
| `yellow` | `#FBBF24` | arquivo modificado |
| `red` | `#F87171` | remoções e ações destrutivas |

Os temas alternativos (Nord, Tokyo Night…) só trocam esses valores; `border-strong`, `fg-soft`, `dim`
e as versões translúcidas são derivadas automaticamente (`src/lib/themes.ts`).

## Tipografia

- **JetBrains Mono**: código, terminal, rótulos de seção, atalhos, caminhos e números.
- **IBM Plex Sans**: o resto da interface.
- Escala: display 32/700 mono · título 15/600 · corpo 13/400 · código 13/400 (altura 1.75) ·
  rótulo 11/600 mono, maiúsculas, espaçamento +8%.
- As fontes vêm embutidas no app (`@fontsource`), sem depender de internet.

## Regras

1. Um acento. Todo o resto é cinza.
2. Linhas finas, não sombras. A profundidade são 3 tons de superfície.
3. Espaçamento em grade de 4 px: 4 · 8 · 12 · 16 · 24 · 32.
4. Raio 6 px em controles, 8–10 px em cards, 12 px em diálogos.
5. Movimento de 200 ms, só de cor; desligado com "reduzir movimento".
6. Status nunca só por cor: letras (M/U/D), `+`/`−`, ícones.
7. Foco sempre visível (anel azul de 2 px); alvos clicáveis com rótulo acessível.

## Componentes

- **Barra lateral (rail)**: 52 px, logo do dino no topo, item ativo com barra verde à esquerda e
  contagem de mudanças do git no ícone de Source Control.
- **Abas**: 44 px, ativa com sublinhado verde de 2 px; ponto branco = arquivo não salvo.
- **Botões**: primário (verde, texto escuro), secundário (contorno), ghost (só hover), perigo (contorno vermelho).
- **Diff**: cards por hunk com número de linha, coluna `+`/`−` e fundo translúcido verde/vermelho.
- **Agente**: balão do usuário à direita, ferramentas em uma linha mono com check, edições como card
  com prévia e Reject/Accept, plano com ● ◐ ○.
- **Paleta de comandos**: diálogo de 600 px, prompt `›` verde, dicas de teclado no rodapé.

Os protótipos visuais ficam no canvas de design do projeto.
