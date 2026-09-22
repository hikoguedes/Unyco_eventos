const db = require('../config/database');

exports.getDashboardStats = async (req, res) => {
  try {
    // 1. Totais gerais
    const totalsPromise = db.query(`
      SELECT 
        (SELECT COUNT(*) FROM parceiros) AS total_parceiros,
        (SELECT COUNT(*) FROM parceiros WHERE status = 'ativo') AS parceiros_ativos,
        (SELECT COUNT(*) FROM eventos) AS total_eventos,
        (SELECT COUNT(*) FROM eventos WHERE status = 'Agendado') AS eventos_agendados,
        (SELECT COUNT(*) FROM eventos WHERE status = 'Em Andamento') AS eventos_em_andamento,
        (SELECT COUNT(*) FROM eventos WHERE status = 'Concluído') AS eventos_concluidos,
        (SELECT COALESCE(SUM(capacidade), 0) FROM eventos) AS capacidade_total_atletas,
        (SELECT COALESCE(SUM(valor_inscricao * capacidade), 0) FROM eventos) AS potencial_receita
    `);

    // 2. Eventos por modalidade
    const modalitiesPromise = db.query(`
      SELECT modalidade, COUNT(*) AS total
      FROM eventos
      GROUP BY modalidade
      ORDER BY total DESC
      LIMIT 6
    `);

    // 3. Próximos eventos (mais recentes agendados ou em andamento)
    const upcomingPromise = db.query(`
      SELECT 
        e.*,
        p.nome_fantasia AS parceiro_nome,
        p.logo_url AS parceiro_logo
      FROM eventos e
      JOIN parceiros p ON p.id = e.parceiro_id
      WHERE e.status IN ('Agendado', 'Em Andamento')
      ORDER BY e.data_inicio ASC
      LIMIT 5
    `);

    // 4. Parceiros com mais eventos realizados
    const topPartnersPromise = db.query(`
      SELECT 
        p.id,
        p.nome_fantasia,
        p.categoria,
        p.logo_url,
        COUNT(e.id)::int AS total_eventos
      FROM parceiros p
      LEFT JOIN eventos e ON e.parceiro_id = p.id
      GROUP BY p.id
      ORDER BY total_eventos DESC
      LIMIT 5
    `);

    const [totalsRes, modalitiesRes, upcomingRes, topPartnersRes] = await Promise.all([
      totalsPromise,
      modalitiesPromise,
      upcomingPromise,
      topPartnersPromise,
    ]);

    return res.json({
      success: true,
      data: {
        totals: totalsRes.rows[0],
        modalities: modalitiesRes.rows,
        upcomingEvents: upcomingRes.rows,
        topPartners: topPartnersRes.rows,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas do dashboard:', error);
    return res.status(500).json({ success: false, message: 'Erro ao processar estatísticas', error: error.message });
  }
};
