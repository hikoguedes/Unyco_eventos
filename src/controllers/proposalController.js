const db = require('../config/database');

// Listar todas as propostas de parceria com filtros
exports.getAllProposals = async (req, res) => {
  try {
    const { parceiro_id, status, search } = req.query;

    let queryText = `
      SELECT 
        pr.*,
        p.nome_fantasia AS parceiro_nome,
        p.razao_social AS parceiro_razao,
        p.cnpj AS parceiro_cnpj,
        p.logo_url AS parceiro_logo,
        p.email AS parceiro_email,
        p.telefone AS parceiro_telefone,
        p.responsavel AS parceiro_responsavel
      FROM propostas_parceria pr
      JOIN parceiros p ON p.id = pr.parceiro_id
    `;

    const queryParams = [];
    const conditions = [];

    if (parceiro_id) {
      queryParams.push(parceiro_id);
      conditions.push(`pr.parceiro_id = $${queryParams.length}`);
    }

    if (status) {
      queryParams.push(status);
      conditions.push(`pr.status = $${queryParams.length}`);
    }

    if (search) {
      queryParams.push(`%${search}%`);
      conditions.push(`(pr.titulo ILIKE $${queryParams.length} OR p.nome_fantasia ILIKE $${queryParams.length} OR pr.tipo_proposta ILIKE $${queryParams.length})`);
    }

    if (conditions.length > 0) {
      queryText += ` WHERE ` + conditions.join(' AND ');
    }

    queryText += ` ORDER BY pr.created_at DESC`;

    const result = await db.query(queryText, queryParams);

    return res.json({
      success: true,
      count: result.rowCount,
      data: result.rows,
    });
  } catch (error) {
    console.error('Erro ao listar propostas:', error);
    return res.status(500).json({ success: false, message: 'Erro ao consultar propostas', error: error.message });
  }
};

// Obter proposta por ID
exports.getProposalById = async (req, res) => {
  try {
    const { id } = req.params;

    const queryText = `
      SELECT 
        pr.*,
        p.nome_fantasia AS parceiro_nome,
        p.razao_social AS parceiro_razao,
        p.cnpj AS parceiro_cnpj,
        p.logo_url AS parceiro_logo,
        p.email AS parceiro_email,
        p.telefone AS parceiro_telefone,
        p.responsavel AS parceiro_responsavel,
        p.categoria AS parceiro_categoria,
        p.website AS parceiro_website
      FROM propostas_parceria pr
      JOIN parceiros p ON p.id = pr.parceiro_id
      WHERE pr.id = $1
    `;

    const result = await db.query(queryText, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Proposta não encontrada' });
    }

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Erro ao buscar proposta:', error);
    return res.status(500).json({ success: false, message: 'Erro ao buscar proposta', error: error.message });
  }
};

// Criar nova proposta de parceria
exports.createProposal = async (req, res) => {
  try {
    const {
      parceiro_id,
      titulo,
      tipo_proposta,
      valor_proposta,
      comissao_porcentagem,
      data_envio,
      data_validade,
      status,
      contrapartidas,
      observacoes
    } = req.body;

    if (!parceiro_id || !titulo) {
      return res.status(400).json({
        success: false,
        message: 'Os campos parceiro_id e título são obrigatórios',
      });
    }

    const partnerCheck = await db.query('SELECT id, nome_fantasia FROM parceiros WHERE id = $1', [parceiro_id]);
    if (partnerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Parceiro selecionado não existe' });
    }

    const queryText = `
      INSERT INTO propostas_parceria (
        parceiro_id, titulo, tipo_proposta, valor_proposta, comissao_porcentagem,
        data_envio, data_validade, status, contrapartidas, observacoes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      parceiro_id,
      titulo.trim(),
      tipo_proposta || 'Patrocínio Master',
      valor_proposta ? parseFloat(valor_proposta) : 0.00,
      comissao_porcentagem ? parseFloat(comissao_porcentagem) : 0.00,
      data_envio || new Date().toISOString().slice(0, 10),
      data_validade || null,
      status || 'Rascunho',
      contrapartidas ? contrapartidas.trim() : null,
      observacoes ? observacoes.trim() : null
    ];

    const result = await db.query(queryText, values);

    return res.status(201).json({
      success: true,
      message: 'Proposta de parceria criada com sucesso!',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Erro ao criar proposta:', error);
    return res.status(500).json({ success: false, message: 'Erro ao criar proposta', error: error.message });
  }
};

// Atualizar proposta de parceria
exports.updateProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      parceiro_id,
      titulo,
      tipo_proposta,
      valor_proposta,
      comissao_porcentagem,
      data_envio,
      data_validade,
      status,
      contrapartidas,
      observacoes
    } = req.body;

    // Validação de Permissão: Apenas ADMIN pode aprovar propostas
    if (status === 'Aprovada' && req.user && req.user.perfil !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Apenas o Administrador (ADM) tem autorização para aprovar propostas comerciais e contratos.',
        required_role: 'ADMIN',
        current_role: req.user.perfil,
      });
    }

    const queryText = `
      UPDATE propostas_parceria
      SET 
        parceiro_id = COALESCE($1, parceiro_id),
        titulo = COALESCE($2, titulo),
        tipo_proposta = COALESCE($3, tipo_proposta),
        valor_proposta = COALESCE($4, valor_proposta),
        comissao_porcentagem = COALESCE($5, comissao_porcentagem),
        data_envio = COALESCE($6, data_envio),
        data_validade = COALESCE($7, data_validade),
        status = COALESCE($8, status),
        contrapartidas = COALESCE($9, contrapartidas),
        observacoes = COALESCE($10, observacoes)
      WHERE id = $11
      RETURNING *
    `;

    const values = [
      parceiro_id,
      titulo ? titulo.trim() : null,
      tipo_proposta,
      valor_proposta !== undefined ? parseFloat(valor_proposta) : null,
      comissao_porcentagem !== undefined ? parseFloat(comissao_porcentagem) : null,
      data_envio,
      data_validade,
      status,
      contrapartidas,
      observacoes,
      id
    ];

    const result = await db.query(queryText, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Proposta não encontrada para atualização' });
    }

    return res.json({
      success: true,
      message: 'Proposta atualizada com sucesso!',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Erro ao atualizar proposta:', error);
    return res.status(500).json({ success: false, message: 'Erro ao atualizar proposta', error: error.message });
  }
};

// Excluir proposta de parceria
exports.deleteProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM propostas_parceria WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Proposta não encontrada para exclusão' });
    }

    return res.json({
      success: true,
      message: 'Proposta excluída com sucesso!',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Erro ao excluir proposta:', error);
    return res.status(500).json({ success: false, message: 'Erro ao excluir proposta', error: error.message });
  }
};
