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
