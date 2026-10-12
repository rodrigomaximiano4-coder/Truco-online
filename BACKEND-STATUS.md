# Preparação do backend do Truco Online

Esta branch é **experimental** e não é usada pelo Render em produção (que acompanha `main`).

## Já preparado
- Servidor HTTP e interface online na raiz do repositório
- Partidas de até quatro assentos com bots
- Turnos e cronômetro autoritativos no servidor
- Substituição de desconectados no protótipo
- Tratamento de JSON inválido e limite básico de requisições por IP
- Scripts `npm start` e `npm test` corrigidos para a organização atual

## Ainda obrigatório antes do lançamento comercial
1. Regras completas de Truco, Seis, Nove, Doze, mão de onze e casos de empate, com testes determinísticos.
2. Autenticação verdadeira de conta, tokens de sessão persistentes e reconexão robusta. O token atual é temporário.
3. Banco de dados persistente, histórico de partidas, ranking e saldo de diamantes controlados e validados no backend.
4. Validação servidor-a-servidor das compras pelo Google Play Billing; entrega idempotente e prevenção de fraude.
5. AdMob: credenciais e callbacks de recompensa validados; valores da economia configuráveis.
6. Rate limits persistentes e por conta, TLS/allowed origins apropriados, proteção operacional e logs privados.
7. Persistência das partidas: o serviço gratuito reinicia e dorme, e o estado atual em memória desaparece.
8. Testes em dois Androids, falhas de rede, reinício do servidor, múltiplas salas, carga e regras da Play.

**Não usar o backend experimental para diamantes reais nem pagamentos.**

## Comandos
```bash
npm install
npm test
npm start
```

Porta definida por `PORT`. Endereço de bind: `HOST`, padrão `0.0.0.0`.
