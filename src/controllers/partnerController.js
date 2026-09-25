const db = require('../config/database');

// Listar todos os parceiros com contagem de eventos
exports.getAllPartners = async (req, res) => {
  try {
    const { status, search } = req.query;
    let queryText = `
      SELECT 
        p.*,
        COUNT(DISTINCT e.id)::int AS total_eventos,
        COUNT(DISTINCT i.id)::int AS total_alunos_carteira
      FROM parceiros p
      LEFT JOIN eventos e ON e.parceiro_id = p.id
      LEFT JOIN inscricoes_evento i ON i.parceiro_indicador_id = p.id
    `;
    const queryParams = [];
    const conditions = [];

    if (status) {
      queryParams.push(status);
      conditions.push(`p.status = $${queryParams.length}`);
    }

    if (search) {
      queryParams.push(`%${search}%`);
      conditions.push(`(p.nome_fantasia ILIKE $${queryParams.length} OR p.cnpj ILIKE $${queryParams.length} OR p.email ILIKE $${queryParams.length})`);
    }

    if (conditions.length > 0) {
      queryText += ` WHERE ` + conditions.join(' AND ');
    }

    queryText += `
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `;

    const result = await db.query(queryText, queryParams);
    return res.json({
      success: true,
      count: result.rowCount,
      data: result.rows,
    });
  } catch (error) {
    console.error('Erro ao listar parceiros:', error);
    return res.status(500).json({ success: false, message: 'Erro interno ao consultar parceiros', error: error.message });
  }
};

// Obter dados de um parceiro específico incluindo a lista completa de eventos
exports.getPartnerById = async (req, res) => {
  try {
    const { id } = req.params;

    const partnerResult = await db.query('SELECT * FROM parceiros WHERE id = $1', [id]);
    if (partnerResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Parceiro não encontrado' });
    }

    const eventsResult = await db.query(
      'SELECT * FROM eventos WHERE parceiro_id = $1 ORDER BY data_inicio DESC',
      [id]
    );

    const partner = partnerResult.rows[0];
    partner.eventos = eventsResult.rows;

    return res.json({
      success: true,
      data: partner,
    });
  } catch (error) {
    console.error('Erro ao buscar parceiro por ID:', error);
    return res.status(500).json({ success: false, message: 'Erro interno ao buscar parceiro', error: error.message });
  }
};

// Obter carteira de alunos e indicações diretas do parceiro
exports.getPartnerWallet = async (req, res) => {
  try {
    const { id } = req.params;

    const partnerResult = await db.query('SELECT * FROM parceiros WHERE id = $1', [id]);
    if (partnerResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Parceiro não encontrado' });
    }

    const partner = partnerResult.rows[0];

    // Buscar todos os alunos/atletas que se inscreveram através da Carteira deste parceiro
    const walletQuery = `
      SELECT 
        i.*,
        e.nome AS evento_nome,
        e.modalidade AS evento_modalidade,
        e.data_inicio AS evento_data_inicio,
        e.local AS evento_local,
        h.nome AS hotel_nome
      FROM inscricoes_evento i
      JOIN eventos e ON e.id = i.evento_id
      LEFT JOIN hoteis_curadoria h ON i.hospedagem_hotel_id = h.id
      WHERE i.parceiro_indicador_id = $1
      ORDER BY i.created_at DESC
    `;

    const walletResult = await db.query(walletQuery, [id]);
    const alunos = walletResult.rows;

    const totalAlunos = alunos.length;
    const totalReceita = alunos.reduce((acc, a) => acc + parseFloat(a.valor_pago || 0), 0);
    const totalComissao = alunos.reduce((acc, a) => acc + parseFloat(a.comissao_parceiro_inscricao || 0), 0);
    const distinctEventos = new Set(alunos.map(a => a.evento_id)).size;

    return res.json({
      success: true,
      partner,
      parceiro: partner,
      summary: {
        total_alunos: totalAlunos,
        total_eventos_distintos: distinctEventos,
        total_receita_gerada: totalReceita.toFixed(2),
        total_comissao_acumulada: totalComissao.toFixed(2),
      },
      resumo: {
        total_alunos: totalAlunos,
        total_eventos_distintos: distinctEventos,
        total_receita_gerada: totalReceita.toFixed(2),
        total_comissao_acumulada: totalComissao.toFixed(2),
      },
      data: alunos,
      alunos: alunos,
    });
  } catch (error) {
    console.error('Erro ao consultar carteira do parceiro:', error);
    return res.status(500).json({ success: false, message: 'Erro ao consultar carteira do parceiro', error: error.message });
  }
};

// Cadastrar novo parceiro
exports.createPartner = async (req, res) => {
  try {
    const {
      nome_fantasia,
      razao_social,
      cnpj,
      email,
      telefone,
      responsavel,
      categoria,
      status,
      logo_url,
      website
    } = req.body;

    const cleanNome = (nome_fantasia || '').trim();
    if (!cleanNome) {
      return res.status(400).json({ success: false, message: 'O campo Nome Fantasia é obrigatório' });
    }

    const cleanCnpj = cnpj ? String(cnpj).trim() : null;
    const cleanEmail = email ? String(email).trim() : null;
    const cleanTelefone = telefone ? String(telefone).trim() : null;
    const cleanRazaoSocial = razao_social ? String(razao_social).trim() : null;
    const cleanResponsavel = responsavel ? String(responsavel).trim() : null;
    const cleanCategoria = categoria ? String(categoria).trim() : 'Promotor';
    const cleanStatus = (status && status.toLowerCase() === 'inativo') ? 'inativo' : 'ativo';
    const cleanLogoUrl = logo_url ? String(logo_url).trim() : null;
    const cleanWebsite = website ? String(website).trim() : null;

    const queryText = `
      INSERT INTO parceiros (
        nome_fantasia, razao_social, cnpj, email, telefone, 
        responsavel, categoria, status, logo_url, website
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      cleanNome,
      cleanRazaoSocial || null,
      cleanCnpj || null,
      cleanEmail || null,
      cleanTelefone || null,
      cleanResponsavel || null,
      cleanCategoria || 'Promotor',
      cleanStatus,
      cleanLogoUrl || null,
      cleanWebsite || null
    ];

    const result = await db.query(queryText, values);
    return res.status(201).json({
      success: true,
      message: 'Parceiro cadastrado com sucesso',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Erro ao criar parceiro:', error);
    if (error.code === '23505') { // Unique constraint violation (CNPJ)
      return res.status(400).json({ success: false, message: 'Já existe um parceiro cadastrado com este CNPJ' });
    }
    if (error.code === '22001') { // String too long
      return res.status(400).json({ success: false, message: 'Um dos campos informados excede o limite de caracteres.' });
    }
    return res.status(500).json({ success: false, message: `Erro ao cadastrar parceiro: ${error.message}`, error: error.message });
  }
};

// Atualizar dados de um parceiro
exports.updatePartner = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nome_fantasia,
      razao_social,
      cnpj,
      email,
      telefone,
      responsavel,
      categoria,
      status,
      logo_url,
      website
    } = req.body;

    const cleanCnpj = cnpj !== undefined ? (String(cnpj).trim() || null) : undefined;
    const cleanEmail = email !== undefined ? (String(email).trim() || null) : undefined;
    const cleanTelefone = telefone !== undefined ? (String(telefone).trim() || null) : undefined;
    const cleanRazaoSocial = razao_social !== undefined ? (String(razao_social).trim() || null) : undefined;
    const cleanResponsavel = responsavel !== undefined ? (String(responsavel).trim() || null) : undefined;
    const cleanNome = nome_fantasia !== undefined ? String(nome_fantasia).trim() : undefined;
    const cleanCategoria = categoria !== undefined ? String(categoria).trim() : undefined;
    const cleanStatus = status !== undefined ? String(status).trim() : undefined;
    const cleanLogoUrl = logo_url !== undefined ? (String(logo_url).trim() || null) : undefined;
    const cleanWebsite = website !== undefined ? (String(website).trim() || null) : undefined;

    const queryText = `
      UPDATE parceiros
      SET 
        nome_fantasia = COALESCE($1, nome_fantasia),
        razao_social = COALESCE($2, razao_social),
        cnpj = COALESCE($3, cnpj),
        email = COALESCE($4, email),
        telefone = COALESCE($5, telefone),
        responsavel = COALESCE($6, responsavel),
        categoria = COALESCE($7, categoria),
        status = COALESCE($8, status),
        logo_url = COALESCE($9, logo_url),
        website = COALESCE($10, website)
      WHERE id = $11
      RETURNING *
    `;

    const values = [
      cleanNome,
      cleanRazaoSocial,
      cleanCnpj,
      cleanEmail,
      cleanTelefone,
      cleanResponsavel,
      cleanCategoria,
      cleanStatus,
      cleanLogoUrl,
      cleanWebsite,
      id
    ];

    const result = await db.query(queryText, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Parceiro não encontrado para atualização' });
    }

    return res.json({
      success: true,
      message: 'Parceiro atualizado com sucesso',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Erro ao atualizar parceiro:', error);
    if (error.code === '23505') {
      return res.status(400).json({ success: false, message: 'Já existe um parceiro com este CNPJ cadastrado' });
    }
    if (error.code === '22001') {
      return res.status(400).json({ success: false, message: 'Um dos campos informados excede o limite de caracteres.' });
    }
    return res.status(500).json({ success: false, message: `Erro ao atualizar parceiro: ${error.message}`, error: error.message });
  }
};

// Excluir parceiro (e seus eventos em cascata)
exports.deletePartner = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM parceiros WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Parceiro não encontrado para exclusão' });
    }

    return res.json({
      success: true,
      message: 'Parceiro e seus eventos associados foram excluídos com sucesso',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Erro ao excluir parceiro:', error);
    return res.status(500).json({ success: false, message: 'Erro ao excluir parceiro', error: error.message });
  }
};

// ==========================================================
// PORTAL DO PARCEIRO (ÁREA EXCLUSIVA DE GANHOS E INDICAÇÕES)
// ==========================================================

// Login no Portal do Parceiro por CNPJ ou E-mail
exports.loginPortal = async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier || !identifier.trim()) {
      return res.status(400).json({ success: false, message: 'Informe o CNPJ ou E-mail cadastrado.' });
    }

    const cleanInput = identifier.trim();
    const cleanNumbers = cleanInput.replace(/\D/g, '');

    const query = `
      SELECT id, nome_fantasia, razao_social, cnpj, email, telefone, responsavel, categoria, status, logo_url
      FROM parceiros
      WHERE LOWER(email) = LOWER($1)
         OR cnpj = $1
         OR ($2 != '' AND REGEXP_REPLACE(cnpj, '\\D', '', 'g') = $2)
      LIMIT 1
    `;

    const result = await db.query(query, [cleanInput, cleanNumbers]);
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Nenhum parceiro encontrado com este CNPJ ou E-mail. Verifique os dados digitados ou contate a equipe UNYCO.',
      });
    }

    const partner = result.rows[0];
    if (partner.status === 'inativo') {
      return res.status(403).json({
        success: false,
        message: 'Cadastro de parceiro inativo. Entre em contato com a equipe UNYCO.',
      });
    }

    return res.json({
      success: true,
      message: `Bem-vindo, ${partner.nome_fantasia}!`,
      partner_id: partner.id,
      partner,
    });
  } catch (error) {
    console.error('Erro no login do portal do parceiro:', error);
    return res.status(500).json({ success: false, message: 'Erro interno ao realizar login', error: error.message });
  }
};

// Resumo consolidado para o Portal do Parceiro (Ganhos, Indicações, Hotéis e Eventos)
exports.getPartnerPortalSummary = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Dados do parceiro
    const partnerRes = await db.query(`SELECT * FROM parceiros WHERE id = $1`, [id]);
    if (partnerRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Parceiro não encontrado.' });
    }
    const partner = partnerRes.rows[0];

    // 2. Eventos do parceiro (com cálculo DEX e contagem de inscritos)
    const eventsQuery = `
      SELECT 
        e.*,
        c.nome AS categoria_nome,
        c.cor AS categoria_cor,
        c.icone AS categoria_icone,
        (e.data_inicio < (e.created_at + INTERVAL '30 days')) AS is_dex,
        ROUND(EXTRACT(EPOCH FROM (e.data_inicio - e.created_at)) / 86400)::int AS dias_antecedencia,
        COUNT(i.id)::int AS total_inscritos,
        COALESCE(SUM(CASE WHEN i.status_pagamento = 'Confirmado' THEN i.valor_pago ELSE 0 END), 0.00) AS receita_inscricoes,
        COALESCE(
          SUM(CASE WHEN i.status_pagamento = 'Confirmado' THEN (i.valor_pago * (COALESCE($2, 10.00) / 100.00)) ELSE 0 END),
          0.00
        ) AS comissao_inscricoes_evento
      FROM eventos e
      LEFT JOIN categorias_evento c ON c.id = e.categoria_id
      LEFT JOIN inscricoes_evento i ON i.evento_id = e.id
      WHERE e.parceiro_id = $1
      GROUP BY e.id, c.nome, c.cor, c.icone
      ORDER BY e.data_inicio ASC
    `;
    const eventsRes = await db.query(eventsQuery, [id, partner.comissao_inscricao_pct || 10.00]);

    // 3. Hotéis vinculados aos eventos do parceiro
    const hotelsQuery = `
      SELECT 
        eh.evento_id,
        eh.distancia_evento_km,
        eh.desconto_percentual,
        eh.cupom_desconto,
        h.id AS hotel_id,
        h.nome AS hotel_nome,
        h.foto_url AS hotel_foto,
        h.cidade AS hotel_cidade,
        h.estado AS hotel_estado,
        h.tarifa_media,
        h.tarifa_atleta_desconto,
        h.categoria_estrelas
      FROM evento_hoteis eh
      JOIN eventos e ON e.id = eh.evento_id
      JOIN hoteis_curadoria h ON h.id = eh.hotel_id
      WHERE e.parceiro_id = $1
      ORDER BY eh.evento_id ASC
    `;
    const hotelsRes = await db.query(hotelsQuery, [id]);

    const hotelsByEvent = {};
    hotelsRes.rows.forEach(h => {
      if (!hotelsByEvent[h.evento_id]) hotelsByEvent[h.evento_id] = [];
      hotelsByEvent[h.evento_id].push(h);
    });

    const eventsWithHotels = eventsRes.rows.map(ev => ({
      ...ev,
      hoteis_vinculados: hotelsByEvent[ev.id] || [],
    }));

    // 4. Reservas de Hotel geradas pelas indicações deste parceiro
    const hotelLeadsQuery = `
      SELECT 
        rhl.*,
        e.nome AS evento_nome,
        h.nome AS hotel_nome,
        h.foto_url AS hotel_foto,
        h.cidade AS hotel_cidade,
        h.categoria_estrelas
      FROM reservas_hotel_leads rhl
      LEFT JOIN eventos e ON rhl.evento_id = e.id
      LEFT JOIN hoteis_curadoria h ON rhl.hotel_id = h.id
      WHERE rhl.parceiro_id = $1
      ORDER BY rhl.created_at DESC
    `;
    const hotelLeadsRes = await db.query(hotelLeadsQuery, [id]);

    // 5. Inscrições geradas pela Carteira / Link de Indicação do parceiro
    const walletQuery = `
      SELECT 
        i.*,
        e.nome AS evento_nome,
        e.modalidade AS evento_modalidade,
        e.data_inicio AS evento_data_inicio
      FROM inscricoes_evento i
      JOIN eventos e ON e.id = i.evento_id
      WHERE i.parceiro_indicador_id = $1
      ORDER BY i.created_at DESC
    `;
    const walletRes = await db.query(walletQuery, [id]);

    // 6. Cálculos de Totais e Comissões
    let totalComissaoHotelConfirmada = 0;
    let totalComissaoHotelPendente = 0;
    let totalReceitaHotelConfirmada = 0;

    hotelLeadsRes.rows.forEach(r => {
      const valComissao = parseFloat(r.comissao_parceiro_valor || 0);
      const valTotal = parseFloat(r.valor_total_estimado || 0);
      if (r.status === 'Confirmada') {
        totalComissaoHotelConfirmada += valComissao;
        totalReceitaHotelConfirmada += valTotal;
      } else if (r.status === 'Pendente') {
        totalComissaoHotelPendente += valComissao;
      }
    });

    let totalComissaoInscricoes = 0;
    let totalReceitaInscricoes = 0;
    walletRes.rows.forEach(w => {
      if (w.status_pagamento === 'Confirmado') {
        totalComissaoInscricoes += parseFloat(w.comissao_parceiro_inscricao || 0);
        totalReceitaInscricoes += parseFloat(w.valor_pago || 0);
      }
    });

    const saldoTotalReceber = totalComissaoHotelConfirmada + totalComissaoInscricoes;

    return res.json({
      success: true,
      partner,
      events: eventsWithHotels,
      hotel_reservations: hotelLeadsRes.rows,
      wallet_inscriptions: walletRes.rows,
      metrics: {
        total_ganhos_confirmados: saldoTotalReceber.toFixed(2),
        total_ganhos_pendentes: totalComissaoHotelPendente.toFixed(2),
        total_hotel_comissao: totalComissaoHotelConfirmada.toFixed(2),
        total_hotel_receita: totalReceitaHotelConfirmada.toFixed(2),
        total_inscricoes_comissao: totalComissaoInscricoes.toFixed(2),
        total_inscricoes_receita: totalReceitaInscricoes.toFixed(2),
        total_indicados_alunos: walletRes.rows.length,
        total_reservas_hotel: hotelLeadsRes.rows.length,
        total_reservas_confirmadas: hotelLeadsRes.rows.filter(r => r.status === 'Confirmada').length,
        total_eventos: eventsRes.rows.length,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar resumo do portal do parceiro:', error);
    return res.status(500).json({ success: false, message: 'Erro ao carregar dados do portal do parceiro', error: error.message });
  }
};

// Atualizar Chave PIX e dados de repasse pelo parceiro
exports.updatePartnerBanking = async (req, res) => {
  try {
    const { id } = req.params;
    const { chave_pix, banco_repasse } = req.body;

    const query = `
      UPDATE parceiros
      SET chave_pix = $1, banco_repasse = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING id, nome_fantasia, chave_pix, banco_repasse
    `;
    const result = await db.query(query, [chave_pix ? chave_pix.trim() : null, banco_repasse ? banco_repasse.trim() : null, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Parceiro não encontrado' });
    }

    return res.json({
      success: true,
      message: 'Dados bancários e Chave PIX atualizados com sucesso!',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Erro ao atualizar dados bancários do parceiro:', error);
    return res.status(500).json({ success: false, message: 'Erro ao atualizar dados de repasse', error: error.message });
  }
};

