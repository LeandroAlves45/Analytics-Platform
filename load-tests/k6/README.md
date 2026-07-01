## Pré-requisitos

- **Docker instalado** (https://docs.docker.com/get-docker/) — k6 corre em container
- **Backend + Postgres + Redis a correr:**
  ```bash
  cd backend
  docker compose --env-file .env up -d
  npm run dev
  ```
- **Passo 15 aplicado** (índice `api_keys_key_preview_status_idx`)
- **API key válida** (plan BUSINESS recomendado): Gera em `POST /api/api-keys`
- **JWT token válido** (para dashboard): Obtém em `POST /api/auth/login`

## Variáveis de ambiente

Cria `.env.k6` na raiz do projeto:

```bash
# Opcional — default é localhost:3000
API_URL=http://host.docker.internal:3000

# Para sustained/peak
API_KEY=apk_xxx_sua_key

# Para cold-cache (múltiplas keys)
API_KEYS=apk_key1,apk_key2,apk_key3

# Para dashboard-read
JWT_TOKEN=eyJ...seu_jwt_token
```

| Variável  | Obrigatória | Descrição                             |
| --------- | ----------- | ------------------------------------- |
| API_URL   | Não         | Default `http://localhost:3000`       |
| API_KEY   | Sim\*       | Key `apk_...` para sustained/peak     |
| API_KEYS  | Sim\*\*     | Lista comma-separated para cold-cache |
| JWT_TOKEN | Sim\*\*\*   | Token para dashboard-read             |

\* peak/sustained — \*\* cold-cache — \*\*\* dashboard

## Comandos (Docker)

```bash
# Throughput sustentado (~12 req/s, 10 min)
docker run --rm --env-file .env.k6 -v "$(pwd)/load-tests/k6:/scripts" grafana/k6 run /scripts/metrics-ingest-sustained.js

# Pico 1000 VUs (~6 min)
docker run --rm --env-file .env.k6 -v "$(pwd)/load-tests/k6:/scripts" grafana/k6 run /scripts/metrics-ingest-peak.js

# Cache frio (múltiplas keys)
docker run --rm --env-file .env.k6 -v "$(pwd)/load-tests/k6:/scripts" grafana/k6 run /scripts/metrics-ingest-cold-cache.js

# Dashboard read (100 VUs, 3 min)
docker run --rm --env-file .env.k6 -v "$(pwd)/load-tests/k6:/scripts" grafana/k6 run /scripts/dashboard-read.js
```
