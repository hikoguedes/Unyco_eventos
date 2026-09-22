-- ==========================================================
-- Banco de Dados: UNYCO Esporte - Gestão de Eventos, Hotéis e Parceiros
-- Arquivo de Inicialização Automática do PostgreSQL
-- ==========================================================

-- Criação da função para atualização automática de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ----------------------------------------------------------
-- 1. Tabela: parceiros (Partners)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS parceiros (
    id SERIAL PRIMARY KEY,
    nome_fantasia VARCHAR(150) NOT NULL,
    razao_social VARCHAR(200),
    cnpj VARCHAR(20) UNIQUE,
    email VARCHAR(150),
    telefone VARCHAR(20),
    responsavel VARCHAR(100),
    categoria VARCHAR(50) DEFAULT 'Clube',
    status VARCHAR(20) DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
    comissao_inscricao_pct NUMERIC(5,2) DEFAULT 10.00,
    comissao_hotelaria_pct NUMERIC(5,2) DEFAULT 8.00,
    chave_pix VARCHAR(100),
    banco_repasse VARCHAR(150),
    logo_url TEXT,
    website TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trigger para atualizar timestamp de parceiros
DROP TRIGGER IF EXISTS trigger_update_parceiros_updated_at ON parceiros;
CREATE TRIGGER trigger_update_parceiros_updated_at
BEFORE UPDATE ON parceiros
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------
-- 2. Tabela: categorias_evento (Event Categories)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias_evento (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    descricao TEXT,
    icone VARCHAR(50) DEFAULT 'fa-trophy',
    cor VARCHAR(30) DEFAULT '#0284C7',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------
-- 3. Tabela: eventos (Events)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS eventos (
    id SERIAL PRIMARY KEY,
    parceiro_id INTEGER NOT NULL REFERENCES parceiros(id) ON DELETE CASCADE,
    categoria_id INTEGER REFERENCES categorias_evento(id) ON DELETE SET NULL,
    nome VARCHAR(200) NOT NULL,
    modalidade VARCHAR(60) NOT NULL,
    local VARCHAR(200) NOT NULL,
    cidade VARCHAR(100) DEFAULT 'São Paulo',
    estado VARCHAR(2) DEFAULT 'SP',
    data_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    data_fim TIMESTAMP WITH TIME ZONE,
    capacidade INTEGER DEFAULT 100,
    status VARCHAR(30) DEFAULT 'Agendado' CHECK (status IN ('Agendado', 'Em Andamento', 'Concluído', 'Cancelado')),
    valor_inscricao NUMERIC(10,2) DEFAULT 0.00,
    descricao TEXT,
    banner_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trigger para atualizar timestamp de eventos
DROP TRIGGER IF EXISTS trigger_update_eventos_updated_at ON eventos;
CREATE TRIGGER trigger_update_eventos_updated_at
BEFORE UPDATE ON eventos
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------
-- 4. Tabela: propostas_parceria (Partnership Proposals)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS propostas_parceria (
    id SERIAL PRIMARY KEY,
    parceiro_id INTEGER NOT NULL REFERENCES parceiros(id) ON DELETE CASCADE,
    titulo VARCHAR(200) NOT NULL,
    tipo_proposta VARCHAR(60) DEFAULT 'Patrocínio Master',
    valor_proposta NUMERIC(12,2) DEFAULT 0.00,
    comissao_porcentagem NUMERIC(5,2) DEFAULT 0.00,
    data_envio DATE DEFAULT CURRENT_DATE,
    data_validade DATE,
    status VARCHAR(30) DEFAULT 'Rascunho' CHECK (status IN ('Rascunho', 'Enviada', 'Em Negociação', 'Aprovada', 'Recusada')),
    contrapartidas TEXT,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trigger para updated_at em propostas_parceria
DROP TRIGGER IF EXISTS trigger_update_propostas_updated_at ON propostas_parceria;
CREATE TRIGGER trigger_update_propostas_updated_at
BEFORE UPDATE ON propostas_parceria
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------
-- 5. Tabela: hoteis_curadoria (Curated Hotels by UNYCO)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS hoteis_curadoria (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    categoria_estrelas INTEGER DEFAULT 4,
    cidade VARCHAR(100) NOT NULL,
    estado VARCHAR(2) DEFAULT 'SP',
    endereco VARCHAR(255),
    tarifa_media NUMERIC(10,2) NOT NULL,
    tarifa_atleta_desconto NUMERIC(10,2) NOT NULL,
    comodidades TEXT DEFAULT 'Café da Manhã Incluso, Wi-Fi Grátis, Academia, Estacionamento',
    foto_url TEXT,
    link_reserva TEXT,
    telefone_contato VARCHAR(30),
    email_reservas VARCHAR(100),
    status VARCHAR(20) DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trigger para updated_at em hoteis_curadoria
DROP TRIGGER IF EXISTS trigger_update_hoteis_updated_at ON hoteis_curadoria;
CREATE TRIGGER trigger_update_hoteis_updated_at
BEFORE UPDATE ON hoteis_curadoria
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------
-- 6. Tabela: evento_hoteis (Curated Hotels linked to Events)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS evento_hoteis (
    id SERIAL PRIMARY KEY,
    evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    hotel_id INTEGER NOT NULL REFERENCES hoteis_curadoria(id) ON DELETE CASCADE,
    distancia_evento_km NUMERIC(4,1) DEFAULT 1.5,
    cupom_desconto VARCHAR(50) DEFAULT 'UNYCOESPORTE',
    desconto_percentual NUMERIC(5,2) DEFAULT 10.00,
    destaque BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(evento_id, hotel_id)
);

-- ----------------------------------------------------------
-- 7. Tabela: inscricoes_evento (Event Registrations / Participants)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS inscricoes_evento (
    id SERIAL PRIMARY KEY,
    evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    codigo_inscricao VARCHAR(40) UNIQUE NOT NULL,
    nome_completo VARCHAR(150) NOT NULL,
    cpf VARCHAR(20),
    email VARCHAR(150) NOT NULL,
    telefone VARCHAR(20) NOT NULL,
    data_nascimento DATE,
    genero VARCHAR(20),
    tamanho_camiseta VARCHAR(10) DEFAULT 'M',
    contato_emergencia_nome VARCHAR(100),
    contato_emergencia_telefone VARCHAR(20),
    precisa_hospedagem BOOLEAN DEFAULT FALSE,
    hospedagem_hotel_id INTEGER REFERENCES hoteis_curadoria(id) ON DELETE SET NULL,
    hospedagem_qtd_pessoas INTEGER DEFAULT 1,
    status_pagamento VARCHAR(30) DEFAULT 'Confirmado' CHECK (status_pagamento IN ('Pendente', 'Confirmado', 'Cancelado')),
    valor_pago NUMERIC(10,2) DEFAULT 0.00,
    comissao_parceiro_inscricao NUMERIC(10,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------
-- 8. Tabela: reservas_hotel_leads (Hotel Booking Leads for Athletes/Families)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservas_hotel_leads (
    id SERIAL PRIMARY KEY,
    evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    parceiro_id INTEGER NOT NULL REFERENCES parceiros(id) ON DELETE CASCADE,
    hotel_id INTEGER REFERENCES hoteis_curadoria(id) ON DELETE SET NULL,
    inscricao_id INTEGER REFERENCES inscricoes_evento(id) ON DELETE SET NULL,
    nome_hospede VARCHAR(150) NOT NULL,
    email VARCHAR(150),
    telefone VARCHAR(30),
    tipo_publico VARCHAR(50) DEFAULT 'Atleta',
    qtd_hospedes INTEGER DEFAULT 1,
    qtd_quartos INTEGER DEFAULT 1,
    data_checkin DATE,
    data_checkout DATE,
    valor_total_estimado NUMERIC(10,2) DEFAULT 0.00,
    comissao_parceiro_pct NUMERIC(5,2) DEFAULT 8.00,
    comissao_parceiro_valor NUMERIC(10,2) DEFAULT 0.00,
    status VARCHAR(30) DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Confirmada', 'Cancelada', 'Finalizada')),
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------
-- 9. Tabela: usuarios (Operadores e Controle de Acesso RBAC)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    senha VARCHAR(255) DEFAULT '$2a$10$defaultHashPlaceholder',
    perfil VARCHAR(30) NOT NULL DEFAULT 'ADMIN' CHECK (perfil IN ('ADMIN', 'REPRESENTANTE', 'CONSULTOR', 'PARCEIRO')),
    cargo VARCHAR(100),
    avatar_url TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trigger para updated_at em usuarios
DROP TRIGGER IF EXISTS trigger_update_usuarios_updated_at ON usuarios;
CREATE TRIGGER trigger_update_usuarios_updated_at
BEFORE UPDATE ON usuarios
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------
-- Índices para otimização de consultas
-- ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_eventos_parceiro ON eventos(parceiro_id);
CREATE INDEX IF NOT EXISTS idx_eventos_status ON eventos(status);
CREATE INDEX IF NOT EXISTS idx_eventos_modalidade ON eventos(modalidade);
CREATE INDEX IF NOT EXISTS idx_eventos_data_inicio ON eventos(data_inicio);
CREATE INDEX IF NOT EXISTS idx_parceiros_status ON parceiros(status);
CREATE INDEX IF NOT EXISTS idx_inscricoes_evento ON inscricoes_evento(evento_id);
CREATE INDEX IF NOT EXISTS idx_propostas_parceiro ON propostas_parceria(parceiro_id);
CREATE INDEX IF NOT EXISTS idx_evento_hoteis_ev ON evento_hoteis(evento_id);
CREATE INDEX IF NOT EXISTS idx_hotel_leads_parceiro ON reservas_hotel_leads(parceiro_id);
CREATE INDEX IF NOT EXISTS idx_hotel_leads_evento ON reservas_hotel_leads(evento_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_perfil ON usuarios(perfil);

-- ----------------------------------------------------------
-- Carga Inicial de Dados (Seed Data)
-- ----------------------------------------------------------
INSERT INTO parceiros (nome_fantasia, razao_social, cnpj, email, telefone, responsavel, categoria, status, comissao_inscricao_pct, comissao_hotelaria_pct, chave_pix, banco_repasse, logo_url, website)
VALUES
(
    'Federação Paulista de Atletismo',
    'Federação Paulista de Atletismo e Corridas LTDA',
    '12.345.678/0001-90',
    'contato@atletismosp.org.br',
    '(11) 3123-4567',
    'Carlos Eduardo Silva',
    'Federação Esportiva',
    'ativo',
    10.00,
    8.00,
    'financeiro@atletismosp.org.br',
    'Banco Itaú (341) Ag 0123 CC 45678-9',
    'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=150&auto=format&fit=crop&q=80',
    'https://atletismosp.org.br'
),
(
    'Arena Beach Club Pro',
    'Arena Pro Esportes de Areia e Eventos EIRELI',
    '98.765.432/0001-10',
    'eventos@arenabeachpro.com.br',
    '(11) 98765-4321',
    'Mariana Guimarães',
    'Clube / Arena',
    'ativo',
    12.00,
    9.00,
    '98.765.432/0001-10',
    'Banco Bradesco (237) Ag 4455 CC 12345-6',
    'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=150&auto=format&fit=crop&q=80',
    'https://arenabeachpro.com.br'
),
(
    'Liga Metropolitana de Futsal & Futebol',
    'Associacao Liga Metropolitana de Esportes',
    '45.678.910/0001-22',
    'contato@ligafutsalsp.com',
    '(11) 3344-5566',
    'Rodrigo Albuquerque',
    'Liga Esportiva',
    'ativo',
    8.00,
    7.50,
    '45678910000122',
    'Banco Santander (033) Ag 1122 CC 98765-4',
    'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=150&auto=format&fit=crop&q=80',
    'https://ligafutsalsp.com'
),
(
    'Vôlei Master Brasil Assessoria',
    'VMB Assessoria e Gestao Esportiva LTDA',
    '55.123.456/0001-77',
    'atendimento@voleimaster.com.br',
    '(11) 97111-2233',
    'Fernanda Vasconcelos',
    'Assessoria Esportiva',
    'ativo',
    10.00,
    8.50,
    '11971112233',
    'Banco Nubank (260) Ag 0001 CC 778899-0',
    'https://images.unsplash.com/photo-1592656094267-764a45160876?w=150&auto=format&fit=crop&q=80',
    'https://voleimaster.com.br'
)
ON CONFLICT (cnpj) DO NOTHING;

-- Inserção de Categorias de Eventos Esportivos
INSERT INTO categorias_evento (nome, descricao, icone, cor) VALUES
('Campeonato Oficial', 'Competições oficiais com pontuação e premiações', 'fa-trophy', '#0284C7'),
('Torneio Corporativo', 'Eventos inter-empresas e ligas fechadas', 'fa-briefcase', '#7C3AED'),
('Circuito & Corrida', 'Provas de rua, etapas e maratonas abertas', 'fa-person-running', '#10B981'),
('Festival & Recreativo', 'Encontros esportivos e atividades comunitárias', 'fa-sun', '#F59E0B'),
('Clínica & Workshop', 'Treinamentos especializados e capacitações', 'fa-graduation-cap', '#EC4899')
ON CONFLICT (nome) DO NOTHING;

-- Inserção de Eventos Esportivos Vinculados aos Parceiros
INSERT INTO eventos (id, parceiro_id, categoria_id, nome, modalidade, local, cidade, estado, data_inicio, data_fim, capacidade, status, valor_inscricao, descricao, banner_url)
VALUES
(
    1,
    1,
    3,
    'Circuito Noturno UNYCO Night Run 10k',
    'Corrida de Rua',
    'Parque Ibirapuera - Portão 7',
    'São Paulo',
    'SP',
    NOW() + INTERVAL '15 days',
    NOW() + INTERVAL '15 days' + INTERVAL '4 hours',
    1500,
    'Agendado',
    89.90,
    'A maior corrida noturna corporativa do calendário UNYCO. Percursos de 5km e 10km com show ao vivo na chegada e medalha especial.',
    'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&auto=format&fit=crop&q=80'
),
(
    2,
    1,
    1,
    'Maratona Estadual de Revezamento',
    'Atletismo',
    'Pista de Atletismo CEPEUSP',
    'São Paulo',
    'SP',
    NOW() + INTERVAL '30 days',
    NOW() + INTERVAL '30 days' + INTERVAL '8 hours',
    600,
    'Agendado',
    120.00,
    'Desafio de revezamento em equipes com 4 e 8 integrantes. Troféus para os 5 melhores tempos e estrutura médica de excelência.',
    'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&auto=format&fit=crop&q=80'
),
(
    3,
    2,
    1,
    'Open Nacional de Beach Tennis UNYCO Cup',
    'Beach Tennis',
    'Arena Beach Club - Quadras Cobertas',
    'Campinas',
    'SP',
    NOW() + INTERVAL '7 days',
    NOW() + INTERVAL '9 days',
    240,
    'Agendado',
    150.00,
    'Torneio oficial com categorias Pro, A, B, C e Mista. Premiação em dinheiro para a categoria Pro e brindes exclusivos para todos os inscritos.',
    'https://images.unsplash.com/photo-1599474924187-334a4ae5bd3c?w=800&auto=format&fit=crop&q=80'
),
(
    4,
    3,
    2,
    'Copa das Empresas de Futebol Society',
    'Futebol',
    'Complexo Esportivo Morumbi',
    'São Paulo',
    'SP',
    NOW() - INTERVAL '2 days',
    NOW() + INTERVAL '20 days',
    320,
    'Em Andamento',
    250.00,
    'Torneio inter-empresas com 16 equipes corporativas em disputa pelo troféu UNYCO Corporate Champions 2026.',
    'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&auto=format&fit=crop&q=80'
),
(
    5,
    4,
    1,
    'Grand Prix de Vôlei de Quadra 2026',
    'Vôlei',
    'Ginásio Poliesportivo do Ibirapuera',
    'São Paulo',
    'SP',
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '28 days',
    450,
    'Concluído',
    100.00,
    'Edição de abertura da temporada com participação de 12 equipes regionais e arbitragem oficial.',
    'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&auto=format&fit=crop&q=80'
)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------
-- Inserção de Hotéis da Curadoria UNYCO
-- ----------------------------------------------------------
INSERT INTO hoteis_curadoria (id, nome, categoria_estrelas, cidade, estado, endereco, tarifa_media, tarifa_atleta_desconto, comodidades, foto_url, link_reserva, telefone_contato, email_reservas, status)
VALUES
(
    1,
    'Grand Hotel Ibirapuera & Spa',
    5,
    'São Paulo',
    'SP',
    'Av. Ibirapuera, 1200 - Moema',
    580.00,
    449.00,
    'Café Especial Atleta, Wi-Fi 500MB, Piscina Térmica, Sauna, Transfer Prova',
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=80',
    'https://unyco.tur.br/hoteis/grand-ibirapuera',
    '(11) 5055-1234',
    'reservas@grandibirapuera.com.br',
    'ativo'
),
(
    2,
    'Comfort Suites Jardins & Paulista',
    4,
    'São Paulo',
    'SP',
    'Alameda Santos, 850 - Cerqueira César',
    420.00,
    339.00,
    'Café da Manhã Incluso, Wi-Fi Grátis, Academia Fitness 24h, Estacionamento',
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&auto=format&fit=crop&q=80',
    'https://unyco.tur.br/hoteis/comfort-jardins',
    '(11) 3288-9900',
    'reservas@comfortjardins.com.br',
    'ativo'
),
(
    3,
    'Ibis Styles Expo & Sports Arena',
    3,
    'São Paulo',
    'SP',
    'Rua Vergueiro, 2200 - Vila Mariana',
    280.00,
    219.00,
    'Café da Manhã, Wi-Fi Cortesia, Bar 24h, Próximo ao Metrô e Parque',
    'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&auto=format&fit=crop&q=80',
    'https://unyco.tur.br/hoteis/ibis-sports',
    '(11) 5549-0011',
    'contato@ibissports.com.br',
    'ativo'
),
(
    4,
    'Royal Palm Plaza Resort & Sports',
    5,
    'Campinas',
    'SP',
    'Av. Royal Palm Plaza, 100 - Jd Nova Califórnia',
    750.00,
    589.00,
    'Quadras Esportivas, Complexo Aquático, SPA Relax, Café da Manhã de Luxo',
    'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&auto=format&fit=crop&q=80',
    'https://unyco.tur.br/hoteis/royal-palm-campinas',
    '(19) 2117-8000',
    'reservas@royalpalm.com.br',
    'ativo'
),
(
    5,
    'Meliá Morumbi Corporate & Leisure',
    4,
    'São Paulo',
    'SP',
    'Av. Roque Petroni Jr, 1000 - Brooklin',
    490.00,
    389.00,
    'Café da Manhã Incluso, Piscina Coberta, Academia Moderna, Estacionamento com Manobrista',
    'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&auto=format&fit=crop&q=80',
    'https://unyco.tur.br/hoteis/melia-morumbi',
    '(11) 2184-1600',
    'reservas@meliamorumbi.com.br',
    'ativo'
)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------
-- Associação de Hotéis aos Eventos (Curadoria UNYCO)
-- ----------------------------------------------------------
INSERT INTO evento_hoteis (evento_id, hotel_id, distancia_evento_km, cupom_desconto, desconto_percentual, destaque)
VALUES
(1, 1, 1.2, 'NIGHTRUN2026', 15.00, true),
(1, 2, 2.8, 'NIGHTRUN2026', 12.00, false),
(1, 3, 3.5, 'NIGHTRUN2026', 10.00, false),
(2, 2, 4.0, 'MARATONA2026', 12.00, true),
(2, 3, 5.2, 'MARATONA2026', 10.00, false),
(3, 4, 1.0, 'BEACHPRO2026', 18.00, true),
(4, 5, 2.1, 'FUTEBOL2026', 15.00, true),
(5, 1, 1.5, 'VOLEI2026', 12.00, true)
ON CONFLICT (evento_id, hotel_id) DO NOTHING;

-- ----------------------------------------------------------
-- Exemplo de Leads e Reservas de Hospedagem (Geração de Comissões)
-- ----------------------------------------------------------
INSERT INTO reservas_hotel_leads (evento_id, parceiro_id, hotel_id, nome_hospede, email, telefone, tipo_publico, qtd_hospedes, qtd_quartos, data_checkin, data_checkout, valor_total_estimado, comissao_parceiro_pct, comissao_parceiro_valor, status, observacoes)
VALUES
(
    1, 1, 1,
    'Marcelo Fontes e Família',
    'marcelo.fontes@gmail.com',
    '(19) 98122-3344',
    'Atleta + Família',
    3, 1,
    CURRENT_DATE + INTERVAL '14 days',
    CURRENT_DATE + INTERVAL '16 days',
    898.00,
    8.00,
    71.84,
    'Confirmada',
    'Atleta participante da Night Run com esposa e filho. Solicitaram late check-out pós-prova.'
),
(
    1, 1, 2,
    'Equipe Assessoria Corrida Total',
    'contato@corridatotal.com.br',
    '(11) 97654-1122',
    'Equipe Técnica / Alunos',
    6, 3,
    CURRENT_DATE + INTERVAL '14 days',
    CURRENT_DATE + INTERVAL '16 days',
    2034.00,
    8.00,
    162.72,
    'Confirmada',
    'Reserva de 3 quartos duplos para o grupo de atletas do interior.'
),
(
    3, 2, 4,
    'Lucas & Gabriel (Dupla Pro Beach Tennis)',
    'lucas.beachtennis@outlook.com',
    '(21) 99887-7665',
    'Atleta',
    2, 1,
    CURRENT_DATE + INTERVAL '6 days',
    CURRENT_DATE + INTERVAL '9 days',
    1767.00,
    9.00,
    159.03,
    'Confirmada',
    'Dupla federada inscrita na categoria Pro da UNYCO Cup em Campinas.'
),
(
    4, 3, 5,
    'Time Corporativo TechBank FC',
    'esportes@techbank.com.br',
    '(11) 94433-2211',
    'Equipe Técnica',
    10, 5,
    CURRENT_DATE + INTERVAL '5 days',
    CURRENT_DATE + INTERVAL '7 days',
    3890.00,
    7.50,
    291.75,
    'Pendente',
    'Aguardando confirmação de faturamento corporativo para 5 quartos duplos.'
)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------
-- Operadores e Usuários com Perfis RBAC
-- ----------------------------------------------------------
INSERT INTO usuarios (id, nome, email, senha, perfil, cargo, avatar_url, ativo)
VALUES
(
    1,
    'Carlos Mendonça',
    'admin@unyco.com.br',
    '$2a$10$e8wzG3K2v4xY7zU.ADMIN.SECRET.HASH',
    'ADMIN',
    'Diretor Executivo / ADM Geral',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    true
),
(
    2,
    'Roberto Almeida',
    'representante@unyco.com.br',
    '$2a$10$e8wzG3K2v4xY7zU.REP.SECRET.HASH',
    'REPRESENTANTE',
    'Representante Comercial & Parcerias',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    true
),
(
    3,
    'Fernanda Vasconcelos',
    'consultor@unyco.com.br',
    '$2a$10$e8wzG3K2v4xY7zU.CONSULT.SECRET.HASH',
    'CONSULTOR',
    'Consultora de Viagens & Hotelaria',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    true
)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    email = EXCLUDED.email,
    perfil = EXCLUDED.perfil,
    cargo = EXCLUDED.cargo,
    avatar_url = EXCLUDED.avatar_url,
    ativo = EXCLUDED.ativo;

-- Ajustar sequências de IDs
SELECT setval('parceiros_id_seq', (SELECT COALESCE(MAX(id), 1) FROM parceiros));
SELECT setval('eventos_id_seq', (SELECT COALESCE(MAX(id), 1) FROM eventos));
SELECT setval('hoteis_curadoria_id_seq', (SELECT COALESCE(MAX(id), 1) FROM hoteis_curadoria));
SELECT setval('evento_hoteis_id_seq', (SELECT COALESCE(MAX(id), 1) FROM evento_hoteis));
SELECT setval('reservas_hotel_leads_id_seq', (SELECT COALESCE(MAX(id), 1) FROM reservas_hotel_leads));
SELECT setval('usuarios_id_seq', (SELECT COALESCE(MAX(id), 1) FROM usuarios));
