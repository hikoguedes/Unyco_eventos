const db = require('../config/database');

// Listar eventos com filtros, contagem de inscritos, dados do parceiro e categoria
exports.getAllEvents = async (req, res) => {
  try {
    const { parceiro_id, categoria_id, status, modalidade, search } = req.query;

    let queryText = `
      SELECT 
        e.*,
        p.nome_fantasia AS parceiro_nome,
        p.categoria AS parceiro_categoria,
        p.logo_url AS parceiro_logo,
        p.email AS parceiro_email,
        p.telefone AS parceiro_telefone,
        c.nome AS categoria_nome,
        c.icone AS categoria_icone,
        c.cor AS categoria_cor,
        COUNT(i.id)::int AS total_inscritos
      FROM eventos e
      JOIN parceiros p ON p.id = e.parceiro_id
      LEFT JOIN categorias_evento c ON c.id = e.categoria_id
      LEFT JOIN inscricoes_evento i ON i.evento_id = e.id
    `;

    const queryParams = [];
    const conditions = [];

    if (parceiro_id) {
      queryParams.push(parceiro_id);
      conditions.push(`e.parceiro_id = $${queryParams.length}`);
    }

    if (categoria_id) {
      queryParams.push(categoria_id);
      conditions.push(`e.categoria_id = $${queryParams.length}`);
    }

    if (status) {
      queryParams.push(status);
      conditions.push(`e.status = $${queryParams.length}`);
    }

    if (modalidade) {
      queryParams.push(modalidade);
      conditions.push(`e.modalidade ILIKE $${queryParams.length}`);
    }

    if (search) {
      queryParams.push(`%${search}%`);
      conditions.push(`(e.nome ILIKE $${queryParams.length} OR e.local ILIKE $${queryParams.length} OR p.nome_fantasia ILIKE $${queryParams.length} OR c.nome ILIKE $${queryParams.length})`);
    }

    if (conditions.length > 0) {
      queryText += ` WHERE ` + conditions.join(' AND ');
    }

    queryText += `
      GROUP BY e.id, p.nome_fantasia, p.categoria, p.logo_url, p.email, p.telefone, c.nome, c.icone, c.cor
      ORDER BY e.data_inicio ASC
    `;

    const result = await db.query(queryText, queryParams);

    return res.json({
      success: true,
      count: result.rowCount,
      data: result.rows,
    });
  } catch (error) {
    console.error('Erro ao listar eventos:', error);
    return res.status(500).json({ success: false, message: 'Erro interno ao consultar eventos', error: error.message });
  }
};

// Obter detalhes de um evento específico
exports.getEventById = async (req, res) => {
  try {
    const { id } = req.params;

    const queryText = `
      SELECT 
        e.*,
        p.nome_fantasia AS parceiro_nome,
        p.razao_social AS parceiro_razao,
        p.cnpj AS parceiro_cnpj,
        p.logo_url AS parceiro_logo,
        p.email AS parceiro_email,
        p.telefone AS parceiro_telefone,
        p.responsavel AS parceiro_responsavel,
        c.nome AS categoria_nome,
        c.icone AS categoria_icone,
        c.cor AS categoria_cor,
        COUNT(i.id)::int AS total_inscritos
      FROM eventos e
      JOIN parceiros p ON p.id = e.parceiro_id
      LEFT JOIN categorias_evento c ON c.id = e.categoria_id
      LEFT JOIN inscricoes_evento i ON i.evento_id = e.id
      WHERE e.id = $1
      GROUP BY e.id, p.nome_fantasia, p.razao_social, p.cnpj, p.logo_url, p.email, p.telefone, p.responsavel, c.nome, c.icone, c.cor
    `;

    const result = await db.query(queryText, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Evento não encontrado' });
    }

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Erro ao buscar evento por ID:', error);
    return res.status(500).json({ success: false, message: 'Erro interno ao buscar evento', error: error.message });
  }
};

// Cadastrar novo evento para um parceiro
exports.createEvent = async (req, res) => {
  try {
    const {
      parceiro_id,
      categoria_id,
      nome,
      modalidade,
      local,
      cidade,
      estado,
      data_inicio,
      data_fim,
      capacidade,
      status,
      valor_inscricao,
      descricao,
      banner_url
    } = req.body;

    if (!parceiro_id || !nome || !modalidade || !local || !data_inicio) {
      return res.status(400).json({
        success: false,
        message: 'Os campos parceiro_id, nome, modalidade, local e data_inicio são obrigatórios',
      });
    }

    // Verificar se o parceiro existe
    const partnerCheck = await db.query('SELECT id, nome_fantasia FROM parceiros WHERE id = $1', [parceiro_id]);
    if (partnerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Parceiro associado não foi encontrado' });
    }

    const queryText = `
      INSERT INTO eventos (
        parceiro_id, categoria_id, nome, modalidade, local, cidade, estado, 
        data_inicio, data_fim, capacidade, status, valor_inscricao, 
        descricao, banner_url
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const values = [
      parceiro_id,
      categoria_id ? parseInt(categoria_id, 10) : null,
      nome,
      modalidade,
      local,
      cidade || 'São Paulo',
      estado || 'SP',
      data_inicio,
      data_fim || null,
      capacidade ? parseInt(capacidade, 10) : 100,
      status || 'Agendado',
      valor_inscricao ? parseFloat(valor_inscricao) : 0.00,
      descricao || null,
      banner_url || null
    ];

    const result = await db.query(queryText, values);

    return res.status(201).json({
      success: true,
      message: 'Evento cadastrado com sucesso',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Erro ao criar evento:', error);
    return res.status(500).json({ success: false, message: 'Erro ao cadastrar evento', error: error.message });
  }
};

// Atualizar evento
exports.updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      parceiro_id,
      categoria_id,
      nome,
      modalidade,
      local,
      cidade,
      estado,
      data_inicio,
      data_fim,
      capacidade,
      status,
      valor_inscricao,
      descricao,
      banner_url
    } = req.body;

    const queryText = `
      UPDATE eventos
      SET 
        parceiro_id = COALESCE($1, parceiro_id),
        categoria_id = $2,
        nome = COALESCE($3, nome),
        modalidade = COALESCE($4, modalidade),
        local = COALESCE($5, local),
        cidade = COALESCE($6, cidade),
        estado = COALESCE($7, estado),
        data_inicio = COALESCE($8, data_inicio),
        data_fim = COALESCE($9, data_fim),
        capacidade = COALESCE($10, capacidade),
        status = COALESCE($11, status),
        valor_inscricao = COALESCE($12, valor_inscricao),
        descricao = COALESCE($13, descricao),
        banner_url = COALESCE($14, banner_url)
      WHERE id = $15
      RETURNING *
    `;

    const values = [
      parceiro_id,
      categoria_id !== undefined ? (categoria_id ? parseInt(categoria_id, 10) : null) : null,
      nome,
      modalidade,
      local,
      cidade,
      estado,
      data_inicio,
      data_fim,
      capacidade,
      status,
      valor_inscricao,
      descricao,
      banner_url,
      id
    ];

    const result = await db.query(queryText, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Evento não encontrado para atualização' });
    }

    return res.json({
      success: true,
      message: 'Evento atualizado com sucesso',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Erro ao atualizar evento:', error);
    return res.status(500).json({ success: false, message: 'Erro ao atualizar evento', error: error.message });
  }
};

// Excluir evento
exports.deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM eventos WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Evento não encontrado para exclusão' });
    }

    return res.json({
      success: true,
      message: 'Evento excluído com sucesso',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Erro ao excluir evento:', error);
    return res.status(500).json({ success: false, message: 'Erro ao excluir evento', error: error.message });
  }
};
