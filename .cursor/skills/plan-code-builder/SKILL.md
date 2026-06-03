---
name: plan-code-builder
description: Transforma um plano de desenvolvimento em ficheiros .md com código de produção, passo a passo, e validação completa. Use quando o utilizador diz "gera o código", "implementa o plano", "cria os ficheiros", ou tem um plano que precisa virar código pronto para o projeto. Analisa automaticamente a linguagem, frameworks, conventions e linters do projeto (pylint, eslint, etc.) para gerar código contextualizado. Valida syntax, imports, lint rules, Clean Code, e testes antes de entregar.
compatibility: Requer análise do projeto existente
---

## Objetivo

Transformar um plano de desenvolvimento em ficheiros .md com código de produção, comentários estruturados, passo a passo, e validação completa.

## Workflow

### 1. Análise do Projeto

Antes de gerar qualquer código, analisa o projeto para entender:

- **Estrutura**: Directórios, padrão de organização
- **Linguagens**: Quais estão presentes (Python, JavaScript/TypeScript, etc.)
- **Frameworks**: FastAPI, React, Django, Express, etc.
- **Conventions**: Naming, estrutura de ficheiros
- **Linters/Formatters**: pylint, eslint, prettier config
- **Testes**: Framework (pytest, Jest, etc.)
- **Idioma de comentários**: Português (default) ou outro

### 2. Geração de Código

Estrutura de cada ficheiro .md:

```
# [Nome do Componente]

## Descrição
O que faz.

## Dependências
Imports/packages necessários.

## Implementação

### Passo 1: [Nome]
Explicação do que faz e porquê.

\`\`\`[linguagem]
código com comentários
\`\`\`

### Passo 2: [Nome]
...

## Validação
Checklist do que foi verificado.

## Testes
Sugestões de testes ou análise de testes existentes.
```

### Regras de Geração

1. **Clean Code**: Legível, nomes descritivos, sem duplicação
2. **Comentários**: 
   - Em português (ou idioma do projeto)
   - Explicam o "porquê", não o "o quê"
   - Um comentário por bloco lógico
3. **Conventions**: Segue pylint, eslint, standards da linguagem
4. **Imports**: Apenas necessários, organizados (stdlib, third-party, local)
5. **Tratamento de Erros**: Present e significativo
6. **Type Hints**: Se a linguagem suporta

### 3. Validação Completa

Antes de entregar, verifica:

- **Syntax**: Código sintaticamente correto
- **Imports**: Todos existem e são usados
- **Lint**: Respeita as rules (pylint, eslint, etc.)
- **Clean Code**: Sem over-engineering
- **Funcionamento**: Lógica coerente com o plano
- **Testes**: Analisa testes existentes e sugere ajustes/novos

### 4. Output Final

Directório com:
- Ficheiros .md com código passo a passo
- README com instruções
- Validações completas
- Sugestões de testes

## Exemplo

**Utilizador**: "Gera o código da API de autenticação"

**Skill**:
1. Lê o plano
2. Analisa o projeto (Python + FastAPI + pytest)
3. Gera `authentication_api.md`
4. Valida syntax, PEP 8, pylint
5. Analisa testes e sugere coverage
6. Entrega pronto

## Princípios

- Sem over-engineering
- Contextual ao projeto
- Validação rigorosa
- Português por default
- Testável
