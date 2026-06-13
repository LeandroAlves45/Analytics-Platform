# FRONTEND_DESIGN_SPEC.MD

## Analytics Platform — Sprint 4 Frontend Design

Design system spec para o dashboard React. Fonte de verdade para decisões visuais do Sprint 4.

Last Updated: June 2026

---

## 1. Identidade Visual

### Nome do produto
**Analytics Platform**

### Logo
Ícone com barras de dados + linha de tendência ascendente com seta.
Gradiente: roxo (#7055cc) → azul ciano (#5bbcf7) → laranja (#f97a4a).
O mesmo gradiente é aplicado ao texto "ANALYTICS" no header.

---

## 2. Tema Principal

**Dark mode como primário.**

Justificação técnica: dashboards de observabilidade são ferramentas de trabalho sob pressão.
O dark mode reduz fadiga visual e faz os dados numéricos destacarem-se com maior contraste.
Referências do mercado: Grafana, Datadog, Vercel Analytics, Railway — todos convergem aqui.

Light mode pode ser adicionado no Sprint 7 (polish) via CSS variables / Tailwind class strategy.

---

## 3. Paleta de Cores

Extraída directamente do logo. Nada foi inventado fora do contexto da marca.

### Base (backgrounds)

| Token                | Hex       | Uso                                      |
|----------------------|-----------|------------------------------------------|
| `--bg-app`           | `#0f0f13` | Background da aplicação inteira          |
| `--bg-card`          | `#141419` | Cards, painéis, sidebar                  |
| `--bg-card-hover`    | `#18181f` | Estado hover em cards interactivos       |
| `--bg-sidebar`       | `#0c0c10` | Sidebar (ligeiramente mais escuro)       |
| `--border-default`   | `rgba(255,255,255,0.07)` | Borders de cards e painéis |
| `--border-subtle`    | `rgba(255,255,255,0.04)` | Divisores internos (table rows, etc.) |

### Cores de marca (extraídas do logo)

| Token              | Hex       | Uso                                            |
|--------------------|-----------|------------------------------------------------|
| `--color-purple`   | `#9b7fe8` | Acento primário, KPI requests, nav activo     |
| `--color-purple-d` | `#7055cc` | Purple escuro, borders de acento               |
| `--color-blue`     | `#5bbcf7` | Throughput, informação, links                  |
| `--color-blue-d`   | `#3a9fd8` | Blue escuro, borders                           |
| `--color-orange`   | `#f97a4a` | P99 latency, alertas, valores críticos         |
| `--color-orange-d` | `#d45d30` | Orange escuro                                  |

### Cores semânticas

| Token              | Hex       | Uso                                   |
|--------------------|-----------|---------------------------------------|
| `--color-success`  | `#3dd68c` | Status 2xx, uptime, sistema saudável  |
| `--color-danger`   | `#ff6464` | Erros 5xx, alertas críticos           |
| `--color-warning`  | `#f97a4a` | Avisos (reutiliza o orange da marca)  |

### Texto

| Token              | Hex                     | Uso                              |
|--------------------|-------------------------|----------------------------------|
| `--text-primary`   | `#e8e6f0`               | Texto principal, valores KPI     |
| `--text-secondary` | `#8b8899`               | Labels, descrições               |
| `--text-muted`     | `#5a576a`               | Metadata, timestamps, subtexto   |
| `--text-disabled`  | `#4a4760`               | Texto inactivo                   |

---

## 4. Tipografia

### Font stack

```css
font-family: 'DM Sans', sans-serif;      /* UI, labels, corpo */
font-family: 'DM Mono', monospace;       /* valores numéricos, paths, code */
```

**Porquê DM Sans:** Limpa e técnica, mas com personalidade própria. Não é Inter nem
Roboto — evita o look genérico de AI-generated dashboard. Pares bem com dados.

**Porquê DM Mono:** Todos os valores numéricos (latências, percentis, paths de
endpoint, contagens) usam monospace. Isto resolve alinhamento em tabelas e dá ao
dashboard um look de terminal técnico sem ser pesado.

### Escala tipográfica

| Uso                          | Font     | Tamanho | Weight | Cor                |
|------------------------------|----------|---------|--------|--------------------|
| Page title                   | DM Sans  | 16px    | 600    | `--text-primary`   |
| Card title                   | DM Sans  | 12px    | 500    | `#c8c6d8`          |
| Section label (uppercase)    | DM Sans  | 10px    | 600    | `--text-muted`     |
| Body / label                 | DM Sans  | 13px    | 400    | `--text-secondary` |
| KPI value                    | DM Mono  | 22px    | 600    | `--text-primary`   |
| KPI unit                     | DM Mono  | 11px    | 400    | `--text-muted`     |
| Table cell                   | DM Mono  | 10-11px | 400    | `--text-secondary` |
| Tooltip / metadata           | DM Sans  | 11px    | 400    | `--text-muted`     |

---

## 5. Layout

### Estrutura principal

```
┌─────────────────────────────────────────────────┐
│  TOPBAR (52px) — logo + status + filtros + avatar│
├────┬────────────────────────────────────────────┤
│    │                                            │
│ S  │   MAIN CONTENT AREA                       │
│ I  │                                            │
│ D  │   ┌──────────────────────────────────┐    │
│ E  │   │ KPI row (4 cards)                │    │
│ B  │   ├──────────────────────────────────┤    │
│ A  │   │ Charts row (latency 2/3 + donut) │    │
│ R  │   ├──────────────────────────────────┤    │
│    │   │ Bottom row (table + throughput)  │    │
│52px│   └──────────────────────────────────┘    │
├────┴────────────────────────────────────────────┤
│  POLLING BAR (24px) — última actualização       │
└─────────────────────────────────────────────────┘
```

### Sidebar (52px, icon-only)

Ícones: chart-bar (Dashboard), activity (Endpoints), bell (Alertas — Sprint 5),
key (API Keys — Sprint 6), settings (Definições).

Estado activo: `background: rgba(155,127,232,0.15)`, icon `#9b7fe8`.

### Topbar

Lado esquerdo: logo icon + "ANALYTICS" (gradiente) + "Platform" (muted).
Lado direito: dot de status live + label "Live" + filtros de intervalo + avatar.

---

## 6. Componentes principais

### KPI Cards

4 cards em grid, cada um com:
- Accent line superior (1px, gradiente extraído da cor do card)
- Label em uppercase 10px muted
- Valor em DM Mono 22px
- Delta com ícone trending-up/down e cor semântica

Cores por card: purple (Requests), blue (P95 Latency), orange (Error Rate),
green (Throughput).

### Latency Chart (Recharts LineChart)

Três séries: p50 (roxo), p95 (azul), p99 (laranja).
Area fill subtil abaixo das linhas p50 e p95 com gradiente para transparente.
Grid lines muito subtis (4% opacidade).
Tooltip custom com DM Mono para os valores.

### Status Donut (Recharts PieChart)

Distribuição 2xx / 4xx / 5xx.
Cores: verde / laranja / vermelho.
Label central com percentagem 2xx em DM Mono.

### Throughput Chart (Recharts AreaChart)

Série única com fill gradiente azul.
Time axis: 00:00 → 24:00.

### Endpoints Table

Colunas: method badge | path | latência | barra de latência relativa.
Method badges com cores por método: GET verde, POST azul, PUT laranja, DELETE vermelho.
Paths em DM Mono.
Barra de latência: gradiente roxo → azul, largura proporcional ao valor máximo.

### Polling Indicator

Barra inferior com dot pulsante (animação CSS) + texto "Auto-refresh a cada 10s".
Mostra tempo desde a última actualização.

---

## 7. Assinaturas visuais (diferenciadores)

1. **Accent line no topo dos KPI cards** — traço de 1px com gradiente extraído
   da cor de cada card. Reaparece o logo sem ser óbvio.

2. **DM Mono exclusivo para dados** — todos os números, paths, e valores técnicos
   usam monospace. Labels e navegação ficam em sans-serif. Distinção clara entre
   "dado" e "interface".

3. **Polling dot** — indicador de live data com pulso animado. Comunica que o
   dashboard está vivo sem ser intrusivo.

4. **Gradiente roxo-azul-laranja** como fio condutor — aparece no logo, no texto
   "ANALYTICS", nos fills dos charts e nas barras de latência extremas.

5. **Method badges com cor semântica** — GET verde (leitura segura), POST azul
   (criação), PUT laranja (modificação), DELETE vermelho (perigo). Convenção que
   developers reconhecem imediatamente.

---

## 8. Espaçamento e border radius

| Contexto             | Valor  |
|----------------------|--------|
| Gap entre KPI cards  | 10px   |
| Gap entre rows       | 14px   |
| Padding interno card | 12-14px|
| Border radius card   | 10px   |
| Border radius badge  | 4-6px  |
| Border radius sidebar icon | 8px |

---

## 9. Stack técnica confirmada

```
React 19 + TypeScript + Vite
Tailwind CSS v3
shadcn/ui (tema customizado com a paleta acima)
Recharts (LineChart, AreaChart, PieChart)
React Query (polling 10s — refetchInterval: 10_000)
Zustand (filtros: endpoint, método, intervalo, from/to)
Axios (cliente HTTP — VITE_API_URL)
lucide-react (ícones)
DM Sans + DM Mono (Google Fonts)
```

---

## 10. Estrutura de pastas (frontend/)

```
frontend/
├── public/
├── src/
│   ├── api/
│   │   ├── client.ts              # instância Axios com baseURL
│   │   ├── metrics.ts             # fetchAggregatedMetrics
│   │   └── endpoints.ts           # fetchActiveEndpoints
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Topbar.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── PollingIndicator.tsx
│   │   ├── dashboard/
│   │   │   ├── KpiCard.tsx
│   │   │   ├── LatencyChart.tsx
│   │   │   ├── ThroughputChart.tsx
│   │   │   ├── StatusDonut.tsx
│   │   │   └── EndpointsTable.tsx
│   │   └── ui/                    # shadcn/ui components
│   ├── hooks/
│   │   ├── useAggregatedMetrics.ts
│   │   └── useActiveEndpoints.ts
│   ├── stores/
│   │   └── dashboardStore.ts      # Zustand — filtros
│   ├── types/
│   │   └── metrics.ts             # espelha API_REFERENCE.md
│   ├── lib/
│   │   └── utils.ts               # cn(), formatters
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css                  # CSS variables + Tailwind
├── .env
├── .env.example
├── index.html
├── tailwind.config.ts
├── tsconfig.json
└── vite.config.ts
```

---

## 11. Referências

- Logo original: `Generated_Image_June_09__2026_-_1_58PM.jpg`
- API contract: `API_REFERENCE.md`
- Sprint plan: `SPRINTS.md` (Sprint 4)
- Backend stack: Node.js/Express em `localhost:3000`
- Frontend origin: `localhost:5173` (CORS configurado no backend)
