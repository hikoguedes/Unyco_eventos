# UNYCO Esporte - Gestão de Eventos, Parceiros e Hotéis (Docker + Node.js + PostgreSQL)

Sistema completo em arquitetura de micro-serviços conteinerizados com Docker, backend em Node.js (Express), banco de dados relacional PostgreSQL e interface Web responsiva com controle de permissões por perfil (RBAC) para gestão de parceiros, eventos esportivos, curadoria de hotéis e propostas comerciais.

---

## 👥 Perfis de Acesso & Matriz de Permissões (RBAC)

O sistema conta com 3 perfis operacionais especializados:

| Perfil | Identificador | Ícone / Badge | Escopo de Atuação & Permissões |
|---|---|---|---|
| **Administrador Geral** | `ADMIN` | 👑 Rosa / Magenta | Acesso total irrestrito. **Exclusivo para aprovação de propostas comerciais**, gestão de operadores, taxas financeiras de comissão de parceiros, remoções e parametrizações globais. |
| **Representante Comercial** | `REPRESENTANTE` | 🤝 Azul | Cadastra e gerencia Parceiros, Eventos Esportivos, Categorias e Participantes/Atletas. Cria rascunhos de propostas comerciais (não aprova). Exclusões requerem autorização. |
| **Consultor de Viagens** | `CONSULTOR` | 🏨 Verde / Esmeralda | Responsável pela **Curadoria de Hotéis UNYCO**, elaboração e negociação de Propostas Comerciais / Cotações, e gestão de Leads e Reservas de Hospedagem de atletas e familiares. |

### 🔑 Operadores Padrão para Testes
- **Administrador:** `admin@unyco.com.br` (ID: 1)
- **Representante:** `representante@unyco.com.br` (ID: 2)
- **Consultora:** `consultor@unyco.com.br` (ID: 3)

> **Dica**: No Topbar do sistema há um seletor rápido para alternar entre os perfis instantaneamente e testar o comportamento das permissões em tempo real.

---

## 🚀 Como Executar com Docker

### Pré-requisitos
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e em execução na máquina.

### 1. Iniciar os Containers (Primeira Execução / Build)
No terminal, dentro da pasta do projeto (`Eventos_UNYCO_ESPORTE`), execute:

```bash
docker compose up --build -d
```

### 2. Acessar a Aplicação
- **Interface Web do Sistema**: [http://localhost:3060](http://localhost:3060)
- **Status do Servidor e Banco (Healthcheck)**: [http://localhost:3060/health](http://localhost:3060/health)

---

## 🛠️ Comandos Úteis do Docker

| Comando | Descrição |
|---|---|
| `docker compose up -d` | Inicia todos os serviços em segundo plano |
| `docker compose logs -f` | Acompanha os logs em tempo real do Node e do PostgreSQL |
| `docker compose logs -f app` | Acompanha os logs apenas do backend Node.js |
| `docker compose logs -f db` | Acompanha os logs do banco de dados PostgreSQL |
| `docker compose down` | Para e remove os containers mantendo os dados salvos |
| `docker compose down -v` | Para e remove os containers **apagando** os volumes de dados |
| `docker compose restart` | Reinicia todos os serviços |

---

## 📡 Endpoints da API REST

### Autenticação & Operadores (`/api/auth`)
- `GET /api/auth/me` - Retorna os dados e permissões do operador autenticado via header `x-user-id` ou token.
- `POST /api/auth/switch-user` - Alterna o perfil ativo (`ADMIN`, `REPRESENTANTE`, `CONSULTOR`).
- `GET /api/auth/users` - Lista todos os operadores cadastrados (*Exclusivo ADM*).

### Parceiros (`/api/partners`)
- `GET /api/partners` - Lista todos os parceiros com contagem de eventos vinculados (suporta `?status=ativo` e `?search=nome`).
- `GET /api/partners/:id` - Retorna a ficha cadastral do parceiro com todos os seus eventos.
- `POST /api/partners` - Cadastra um novo parceiro (*ADMIN, REPRESENTANTE*).
- `PUT /api/partners/:id` - Atualiza os dados de um parceiro (*ADMIN, REPRESENTANTE*).
- `DELETE /api/partners/:id` - Exclui um parceiro e seus eventos em cascata (*ADMIN, REPRESENTANTE com autorização*).

### Categorias de Eventos (`/api/categories`)
- `GET /api/categories` - Lista todas as categorias de eventos com o total de eventos vinculados.
- `GET /api/categories/:id` - Retorna os dados de uma categoria específica.
- `POST /api/categories` - Cadastra uma nova categoria (*ADMIN, REPRESENTANTE*).
- `PUT /api/categories/:id` - Atualiza uma categoria (*ADMIN, REPRESENTANTE*).
- `DELETE /api/categories/:id` - Exclui uma categoria (*ADMIN, REPRESENTANTE*).

### Eventos Esportivos (`/api/events`)
- `GET /api/events` - Lista todos os eventos com informações do parceiro e da categoria (suporta filtros `?categoria_id=X`, `?parceiro_id=X`, `?status=Agendado`, `?modalidade=Corrida`, `?search=termo`).
- `GET /api/events/:id` - Detalhes de um evento específico com dados do parceiro e categoria.
- `POST /api/events` - Cadastra um novo evento vinculado a um parceiro e a uma categoria (*ADMIN, REPRESENTANTE*).
- `PUT /api/events/:id` - Atualiza um evento (*ADMIN, REPRESENTANTE*).
- `DELETE /api/events/:id` - Exclui um evento (*ADMIN, REPRESENTANTE*).

### Propostas Comerciais de Parceria (`/api/proposals`)
- `GET /api/proposals` - Lista todas as propostas com dados do parceiro e comissão calculada (suporta `?status=Enviada` e `?parceiro_id=X`).
- `GET /api/proposals/:id` - Retorna os detalhes de uma proposta específica.
- `POST /api/proposals` - Cadastra uma nova proposta vinculada a um parceiro (*ADMIN, CONSULTOR, REPRESENTANTE*).
- `PUT /api/proposals/:id` - Atualiza dados, contrapartidas ou status da proposta (**aprovação com status 'Aprovada' é Exclusiva do ADM**).
- `DELETE /api/proposals/:id` - Exclui uma proposta (*ADMIN, CONSULTOR, REPRESENTANTE*).

### Curadoria de Hotéis UNYCO (`/api/hotels`)
- `GET /api/hotels` - Lista hotéis parceiros da rede UNYCO com tarifas padrão e tarifas com desconto atleta.
- `GET /api/hotels/:id` - Detalhes do hotel e lista de eventos vinculados.
- `POST /api/hotels` - Cadastra novo hotel na curadoria (*ADMIN, CONSULTOR*).
- `PUT /api/hotels/:id` - Atualiza dados e tarifas do hotel (*ADMIN, CONSULTOR*).
- `DELETE /api/hotels/:id` - Remove hotel da curadoria (*ADMIN, CONSULTOR*).
- `POST /api/hotels/event/:eventId/link` - Vincula hotel a um evento esportivo (*ADMIN, CONSULTOR*).
- `DELETE /api/hotels/event/:eventId/link/:hotelId` - Desvincula hotel do evento (*ADMIN, CONSULTOR*).

### Ganhos do Parceiro & Reservas (`/api/earnings`)
- `GET /api/earnings` - Extrato financeiro consolidado de repasses por inscrições e hospedagens.
- `GET /api/earnings/partner/:partnerId` - Extrato analítico por evento e reservas geradas do parceiro.
- `PUT /api/earnings/partner/:partnerId/commissions` - Configura taxas de comissão e chave PIX de repasse (*Exclusivo ADM*).
- `GET /api/earnings/hotel-leads` - Lista solicitações de hospedagem de atletas e familiares.
- `POST /api/earnings/hotel-leads` - Registra lead/reserva de hotel para atleta.
- `PUT /api/earnings/hotel-leads/:id/status` - Atualiza status da reserva (`Pendente` -> `Confirmada` / `Cancelada`) (*ADMIN, CONSULTOR*).

### Inscrições e Landing Page Pública (`/api/events/:id/...`)
- `GET /api/events/:id/registrations` - Lista todos os participantes inscritos em um determinado evento.
- `POST /api/events/:id/register` - Realiza a inscrição de um participante (gera código único `UNY-2026-XXXXX` e deduz vagas).
- **Landing Page Pública de Inscrição**: `http://localhost:3060/lp.html?id=ID_DO_EVENTO`

---

## 🗄️ Estrutura do Banco de Dados (`init.sql`)

O banco de dados é inicializado automaticamente com as 9 tabelas relacionais:
1. **`usuarios`**: Operadores do sistema com controle de perfis (`ADMIN`, `REPRESENTANTE`, `CONSULTOR`).
2. **`parceiros`**: Clubes, federações e organizadores com taxas de comissão e PIX.
3. **`categorias_evento`**: Modalidades e tipos de torneios com ícones e cores temáticas.
4. **`eventos`**: Calendário esportivo com capacidade e taxa de inscrição.
5. **`propostas_parceria`**: Propostas comerciais, valores e contrapartidas acordadas.
6. **`hoteis_curadoria`**: Hotéis selecionados pela UNYCO com tarifas balcão e descontos atleta.
7. **`evento_hoteis`**: Vínculo entre eventos e hotéis curados com cupons e distâncias.
8. **`inscricoes_evento`**: Atletas e clientes inscritos via landing page pública.
9. **`reservas_hotel_leads`**: Reservas de hotelaria de atletas gerando comissões automáticas.

---

## 💻 Desenvolvimento Local (Sem Docker - Opcional)
Se preferir rodar o Node.js diretamente na sua máquina conectando a um PostgreSQL existente:

1. Configure as variáveis no arquivo `.env`.
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Inicie em modo de desenvolvimento com hot-reload:
   ```bash
   npm run dev
   ```

