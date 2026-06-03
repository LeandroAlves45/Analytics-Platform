# Checklist de Validação

## Syntax & Imports
- [ ] Código sintacticamente correto (sem erros de parsing)
- [ ] Todos os imports existem
- [ ] Imports não utilizados foram removidos
- [ ] Imports estão organizados (stdlib, third-party, local)

## Lint & Code Style
- [ ] Respeita pylint/eslint config do projeto
- [ ] Sem warnings do linter
- [ ] Nomes de variáveis/funções seguem conventions
- [ ] Indentação correcta e consistente

## Clean Code
- [ ] Funções têm responsabilidade única
- [ ] Nomes são descritivos
- [ ] Sem duplicação de código
- [ ] Sem magic numbers (constantes nomeadas)
- [ ] Código legível à primeira leitura

## Comentários
- [ ] Comentários em português (ou idioma do projeto)
- [ ] Explicam o "porquê", não o "o quê"
- [ ] Um comentário por bloco lógico
- [ ] Classes/funções complexas têm docstrings

## Tratamento de Erros
- [ ] Exceptions tratadas apropriadamente
- [ ] Mensagens de erro significativas
- [ ] Não há código que falha silenciosamente

## Type Hints (Python/TypeScript)
- [ ] Type hints presentes em funções
- [ ] Return types definidos
- [ ] Type hints coerentes com o código

## Lógica & Funcionamento
- [ ] Lógica alinhada com o plano
- [ ] Edge cases considerados
- [ ] Fluxo de controle é claro
- [ ] Não há lógica aparentemente incorrecta

## Testes
- [ ] Testes existentes ainda passam
- [ ] Coverage é adequado
- [ ] Casos edge têm testes
- [ ] Mocks/fixtures são apropriados (se aplicável)

## Documentação
- [ ] Docstrings presentes
- [ ] README de instruções é claro
- [ ] Exemplos de uso incluídos (se aplicável)
