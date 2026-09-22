const db = require('../config/database');

// Listar todas as categorias com contagem de eventos vinculados
exports.getAllCategories = async (req, res) => {
  try {
    const queryText = `
      SELECT 
        c.*,
        COUNT(e.id)::int AS total_eventos
      FROM categorias_evento c
      LEFT JOIN eventos e ON e.categoria_id = c.id
      GROUP BY c.id
      ORDER BY c.nome ASC
    `;

    const result = await db.query(queryText);
    return res.json({
      success: true,
      count: result.rowCount,
      data: result.rows,
    });
  } catch (error) {
    console.error('Erro ao listar categorias:', error);
    return res.status(500).json({ success: false, message: 'Erro ao consultar categorias', error: error.message });
  }
};

// Obter categoria por ID
exports.getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM categorias_evento WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Categoria não encontrada' });
    }

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Erro ao buscar categoria:', error);
    return res.status(500).json({ success: false, message: 'Erro ao buscar categoria', error: error.message });
  }
};

// Criar nova categoria de evento
exports.createCategory = async (req, res) => {
  try {
    const { nome, descricao, icone, cor } = req.body;

    if (!nome) {
      return res.status(400).json({ success: false, message: 'O nome da categoria é obrigatório' });
    }

    const queryText = `
      INSERT INTO categorias_evento (nome, descricao, icone, cor)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const values = [
      nome.trim(),
      descricao ? descricao.trim() : null,
      icone || 'fa-trophy',
      cor || '#0284C7'
    ];

    const result = await db.query(queryText, values);

    return res.status(201).json({
      success: true,
      message: 'Categoria de evento criada com sucesso!',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Erro ao criar categoria:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ success: false, message: 'Já existe uma categoria cadastrada com este nome' });
    }
    return res.status(500).json({ success: false, message: 'Erro ao criar categoria', error: error.message });
  }
};

// Atualizar categoria de evento
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, descricao, icone, cor } = req.body;

    const queryText = `
      UPDATE categorias_evento
      SET 
        nome = COALESCE($1, nome),
        descricao = COALESCE($2, descricao),
        icone = COALESCE($3, icone),
        cor = COALESCE($4, cor)
      WHERE id = $5
      RETURNING *
    `;

    const values = [
      nome ? nome.trim() : null,
      descricao ? descricao.trim() : null,
      icone,
      cor,
      id
    ];

    const result = await db.query(queryText, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Categoria não encontrada para atualização' });
    }

    return res.json({
      success: true,
      message: 'Categoria atualizada com sucesso!',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Erro ao atualizar categoria:', error);
    if (error.code === '23505') {
      return res.status(400).json({ success: false, message: 'Já existe outra categoria com este nome' });
    }
    return res.status(500).json({ success: false, message: 'Erro ao atualizar categoria', error: error.message });
  }
};

// Excluir categoria de evento
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM categorias_evento WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Categoria não encontrada para exclusão' });
    }

    return res.json({
      success: true,
      message: 'Categoria excluída com sucesso!',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Erro ao excluir categoria:', error);
    return res.status(500).json({ success: false, message: 'Erro ao excluir categoria', error: error.message });
  }
};
