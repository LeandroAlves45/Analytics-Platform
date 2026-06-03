# Plan Code Builder Skill

Transforma um plano de desenvolvimento em código de produção com validação completa.

## Como Usar

1. **Cria um plano** no teu projeto
2. **Pede à skill**: "Gera o código para [descrição]"
3. A skill:
   - Analisa o projeto (linguagem, frameworks, conventions)
   - Gera ficheiros `.md` com código passo a passo
   - Valida syntax, lint, Clean Code, testes
   - Entrega um directório pronto para copiar

## Exemplo

```
Utilizador: Gera o código da API de autenticação que está no plano

Skill:
1. Analisa que é FastAPI + Python + pytest
2. Gera authentication_api.md com:
   - Setup de dependências
   - Funções de token (create, verify)
   - Rotas protegidas
   - Tratamento de erros
   - Comentários em português
3. Valida PEP 8, pylint, syntax
4. Sugere testes e coverage
5. Entrega pronto
```

## Estrutura do Output

```
plan-code-builder-output/
├── README.md (instruções)
├── [componente1].md (código + passo a passo)
├── [componente2].md
└── validation-report.md (validações realizadas)
```

## O que a Skill Faz

### Análise
- Detecta linguagens e frameworks do projeto
- Lê conventions e padrões existentes
- Identifica linters/formatters configurados

### Geração
- Código completo e funcional
- Passo a passo explicado
- Comentários em português
- Tratamento de erros incluído
- Type hints (Python/TypeScript)

### Validação
- Syntax correcta
- Imports válidos
- Lint compliance (pylint, eslint, etc.)
- Clean Code principles
- Testes analisados e sugeridos

## Princípios

- Sem over-engineering
- Código prático e directo
- Validação rigorosa
- Contextual ao projeto
- Testável
