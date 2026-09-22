/**
 * UNYCO Esporte - Earnings & Commissions Controller
 * Gestão de Ganhos dos Parceiros por Inscrições e Curadoria de Hotéis
 */
const pool = require('../config/database');

const earningsController = {
  // Visão Geral Consolidada de Ganhos de Todos os Parceiros
  async getConsolidatedEarnings(req, res) {
    try {
      const query = `
        SELECT 
          p.id AS parceiro_id,
          p.nome_fantasia AS parceiro_nome,
          p.categoria AS parceiro_categoria,
          p.status AS parceiro_status,
          p.logo_url AS parceiro_logo,
          p.comissao_inscricao_pct,
          p.comissao_hotelaria_pct,
          p.chave_pix,
          p.banco_repasse,
          
          -- Métricas de Eventos
          COUNT(DISTINCT e.id) AS total_eventos,
          
          -- Métricas de Inscrições
          COUNT(DISTINCT i.id) AS total_inscritos,
          COALESCE(SUM(CASE WHEN i.status_pagamento = 'Confirmado' THEN i.valor_pago ELSE 0 END), 0.00) AS receita_bruta_inscricoes,
          COALESCE(
            SUM(CASE WHEN i.status_pagamento = 'Confirmado' THEN (i.valor_pago * (COALESCE(p.comissao_inscricao_pct, 10.00) / 100.00)) ELSE 0 END), 
            0.00
          ) AS ganho_comissao_inscricoes,
          
          -- Métricas de Hotelaria
          COUNT(DISTINCT rhl.id) AS total_leads_hotelaria,
          COUNT(DISTINCT CASE WHEN rhl.status = 'Confirmada' THEN rhl.id ELSE NULL END) AS total_reservas_confirmadas,
          COALESCE(
            SUM(CASE WHEN rhl.status != 'Cancelada' THEN rhl.valor_total_estimado ELSE 0 END), 
            0.00
          ) AS receita_bruta_hotelaria,
          COALESCE(
            SUM(CASE WHEN rhl.status = 'Confirmada' THEN rhl.comissao_parceiro_valor ELSE 0 END), 
            0.00
          ) AS ganho_comissao_hotelaria,
          COALESCE(
            SUM(CASE WHEN rhl.status = 'Pendente' THEN rhl.comissao_parceiro_valor ELSE 0 END), 
            0.00
          ) AS comissao_hotelaria_pendente

        FROM parceiros p
        LEFT JOIN eventos e ON p.id = e.parceiro_id
        LEFT JOIN inscricoes_evento i ON e.id = i.evento_id
        LEFT JOIN reservas_hotel_leads rhl ON p.id = rhl.parceiro_id
        GROUP BY p.id
        ORDER BY (
          COALESCE(SUM(CASE WHEN i.status_pagamento = 'Confirmado' THEN (i.valor_pago * (COALESCE(p.comissao_inscricao_pct, 10.00) / 100.00)) ELSE 0 END), 0) +
          COALESCE(SUM(CASE WHEN rhl.status = 'Confirmada' THEN rhl.comissao_parceiro_valor ELSE 0 END), 0)
        ) DESC
      `;

      const result = await pool.query(query);

      // Calcular totais gerais da plataforma
      let totalGeralRepasseConfirmado = 0;
      let totalGeralReceitaInscricoes = 0;
      let totalGeralReceitaHotelaria = 0;
      let totalGeralLeadsHotelaria = 0;

      const parceirosComTotais = result.rows.map(row => {
        const ganhoInscricao = parseFloat(row.ganho_comissao_inscricoes || 0);
        const ganhoHotel = parseFloat(row.ganho_comissao_hotelaria || 0);
        const totalGanho = ganhoInscricao + ganhoHotel;

        totalGeralRepasseConfirmado += totalGanho;
        totalGeralReceitaInscricoes += parseFloat(row.receita_bruta_inscricoes || 0);
        totalGeralReceitaHotelaria += parseFloat(row.receita_bruta_hotelaria || 0);
        totalGeralLeadsHotelaria += parseInt(row.total_leads_hotelaria || 0, 10);

        return {
          ...row,
          ganho_total_acumulado: totalGanho.toFixed(2),
        };
      });

      return res.status(200).json({
        success: true,
        data: parceirosComTotais,
        summary: {
          total_repasse_parceiros: totalGeralRepasseConfirmado.toFixed(2),
          total_receita_inscricoes: totalGeralReceitaInscricoes.toFixed(2),
          total_receita_hotelaria: totalGeralReceitaHotelaria.toFixed(2),
          total_leads_hotelaria: totalGeralLeadsHotelaria,
        },
      });
    } catch (err) {
      console.error('Erro ao consultar extrato consolidado de ganhos:', err);
      return res.status(500).json({
        success: false,
        message: 'Erro interno ao consultar extrato de comissões.',
        error: err.message,
      });
    }
  },

  // Extrato Detalhado de um Parceiro Específico
  async getPartnerEarningsStatement(req, res) {
    try {
      const { partnerId } = req.params;

      // Buscar parceiro
      const partnerRes = await pool.query(`SELECT * FROM parceiros WHERE id = $1`, [partnerId]);
      if (partnerRes.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Parceiro não encontrado.',
        });
      }
      const partner = partnerRes.rows[0];

      // Eventos e Inscrições vinculados
      const eventsRes = await pool.query(`
        SELECT 
          e.id,
          e.nome,
          e.modalidade,
          e.data_inicio,
          e.valor_inscricao,
          COUNT(i.id) AS total_inscritos,
          COALESCE(SUM(CASE WHEN i.status_pagamento = 'Confirmado' THEN i.valor_pago ELSE 0 END), 0.00) AS receita_inscricoes,
          COALESCE(
            SUM(CASE WHEN i.status_pagamento = 'Confirmado' THEN (i.valor_pago * ($2 / 100.00)) ELSE 0 END), 
            0.00
          ) AS comissao_parceiro
        FROM eventos e
        LEFT JOIN inscricoes_evento i ON e.id = i.evento_id
        WHERE e.parceiro_id = $1
        GROUP BY e.id
        ORDER BY e.data_inicio DESC
      `, [partnerId, partner.comissao_inscricao_pct || 10.00]);

      // Reservas de Hotelaria geradas para este parceiro
      const hotelRes = await pool.query(`
        SELECT 
          rhl.*,
          e.nome AS evento_nome,
          h.nome AS hotel_nome,
          h.foto_url AS hotel_foto,
          h.cidade AS hotel_cidade,
          h.categoria_estrelas
        FROM reservas_hotel_leads rhl
        JOIN eventos e ON rhl.evento_id = e.id
        LEFT JOIN hoteis_curadoria h ON rhl.hotel_id = h.id
        WHERE rhl.parceiro_id = $1
        ORDER BY rhl.created_at DESC
      `, [partnerId]);

      // Calcular totais
      let totalGanhoInscricoes = 0;
      eventsRes.rows.forEach(ev => {
        totalGanhoInscricoes += parseFloat(ev.comissao_parceiro || 0);
      });

      let totalGanhoHotelaria = 0;
      let totalPendenteHotelaria = 0;
      hotelRes.rows.forEach(reserva => {
        if (reserva.status === 'Confirmada') {
          totalGanhoHotelaria += parseFloat(reserva.comissao_parceiro_valor || 0);
        } else if (reserva.status === 'Pendente') {
          totalPendenteHotelaria += parseFloat(reserva.comissao_parceiro_valor || 0);
        }
      });

      return res.status(200).json({
        success: true,
        data: {
          parceiro: partner,
          eventos: eventsRes.rows,
          reservas_hotelaria: hotelRes.rows,
          totais: {
            ganho_inscricoes: totalGanhoInscricoes.toFixed(2),
            ganho_hotelaria: totalGanhoHotelaria.toFixed(2),
            pendente_hotelaria: totalPendenteHotelaria.toFixed(2),
            saldo_total_receber: (totalGanhoInscricoes + totalGanhoHotelaria).toFixed(2),
          },
        },
      });
    } catch (err) {
      console.error('Erro ao buscar extrato do parceiro:', err);
      return res.status(500).json({
        success: false,
        message: 'Erro interno ao consultar extrato do parceiro.',
        error: err.message,
      });
    }
  },

  // Atualizar Configuração de Comissões e Dados de Repasse do Parceiro
  async updatePartnerCommissionRates(req, res) {
    try {
      const { partnerId } = req.params;
      const { comissao_inscricao_pct, comissao_hotelaria_pct, chave_pix, banco_repasse } = req.body;

      const query = `
        UPDATE parceiros SET
          comissao_inscricao_pct = COALESCE($1, comissao_inscricao_pct),
          comissao_hotelaria_pct = COALESCE($2, comissao_hotelaria_pct),
          chave_pix = COALESCE($3, chave_pix),
          banco_repasse = COALESCE($4, banco_repasse)
        WHERE id = $5
        RETURNING *
      `;

      const result = await pool.query(query, [
        comissao_inscricao_pct,
        comissao_hotelaria_pct,
        chave_pix,
        banco_repasse,
        partnerId,
      ]);

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Parceiro não encontrado.',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Taxas de comissão e dados de repasse atualizados com sucesso!',
        data: result.rows[0],
      });
    } catch (err) {
      console.error('Erro ao atualizar taxas do parceiro:', err);
      return res.status(500).json({
        success: false,
        message: 'Erro ao salvar configuração de comissões.',
        error: err.message,
      });
    }
  },

  // Listar todas as reservas e leads de hospedagem
  async getAllHotelLeads(req, res) {
    try {
      const { evento_id, parceiro_id, status } = req.query;
      let query = `
        SELECT 
          rhl.*,
          e.nome AS evento_nome,
          e.modalidade AS evento_modalidade,
          p.nome_fantasia AS parceiro_nome,
          p.chave_pix AS parceiro_pix,
          h.nome AS hotel_nome,
          h.foto_url AS hotel_foto,
          h.cidade AS hotel_cidade,
          h.categoria_estrelas AS hotel_estrelas
        FROM reservas_hotel_leads rhl
        JOIN eventos e ON rhl.evento_id = e.id
        JOIN parceiros p ON rhl.parceiro_id = p.id
        LEFT JOIN hoteis_curadoria h ON rhl.hotel_id = h.id
        WHERE 1=1
      `;
      const params = [];
      let count = 1;

      if (evento_id) {
        query += ` AND rhl.evento_id = $${count++}`;
        params.push(evento_id);
      }

      if (parceiro_id) {
        query += ` AND rhl.parceiro_id = $${count++}`;
        params.push(parceiro_id);
      }

      if (status) {
        query += ` AND rhl.status = $${count++}`;
        params.push(status);
      }

      query += ` ORDER BY rhl.created_at DESC`;

      const result = await pool.query(query, params);
      return res.status(200).json({
        success: true,
        count: result.rowCount,
        data: result.rows,
      });
    } catch (err) {
      console.error('Erro ao listar leads de hotelaria:', err);
      return res.status(500).json({
        success: false,
        message: 'Erro ao consultar solicitações de hotelaria.',
        error: err.message,
      });
    }
  },

  // Atualizar Status da Reserva de Hotel (Pendente -> Confirmada / Cancelada)
  async updateHotelLeadStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, valor_total_estimado } = req.body;

      // Buscar lead atual
      const currentRes = await pool.query(`SELECT * FROM reservas_hotel_leads WHERE id = $1`, [id]);
      if (currentRes.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Registro de hospedagem não encontrado.',
        });
      }
      const current = currentRes.rows[0];

      const novoValor = valor_total_estimado !== undefined ? parseFloat(valor_total_estimado) : parseFloat(current.valor_total_estimado || 0);
      const comissaoPct = parseFloat(current.comissao_parceiro_pct || 8.0);
      const novoValorComissao = (novoValor * (comissaoPct / 100.0)).toFixed(2);

      const query = `
        UPDATE reservas_hotel_leads SET
          status = COALESCE($1, status),
          valor_total_estimado = $2,
          comissao_parceiro_valor = $3
        WHERE id = $4
        RETURNING *
      `;

      const result = await pool.query(query, [status, novoValor, novoValorComissao, id]);

      return res.status(200).json({
        success: true,
        message: `Status da reserva atualizado para ${status}!`,
        data: result.rows[0],
      });
    } catch (err) {
      console.error('Erro ao atualizar status do lead de hotel:', err);
      return res.status(500).json({
        success: false,
        message: 'Erro ao atualizar status da reserva.',
        error: err.message,
      });
    }
  },

  // Cadastro Manual de Reserva / Lead de Hotelaria
  async createHotelLead(req, res) {
    try {
      const {
        evento_id,
        hotel_id,
        nome_hospede,
        email,
        telefone,
        tipo_publico,
        qtd_hospedes,
        qtd_quartos,
        data_checkin,
        data_checkout,
        valor_total_estimado,
        observacoes,
      } = req.body;

      if (!evento_id || !nome_hospede || !telefone) {
        return res.status(400).json({
          success: false,
          message: 'Campos obrigatórios: evento_id, nome_hospede e telefone.',
        });
      }

      // Buscar parceiro do evento
      const evRes = await pool.query(`
        SELECT e.parceiro_id, p.comissao_hotelaria_pct 
        FROM eventos e 
        JOIN parceiros p ON e.parceiro_id = p.id 
        WHERE e.id = $1
      `, [evento_id]);

      if (evRes.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Evento não encontrado.',
        });
      }

      const parceiroId = evRes.rows[0].parceiro_id;
      const comissaoPct = parseFloat(evRes.rows[0].comissao_hotelaria_pct || 8.00);
      const valorEstimado = parseFloat(valor_total_estimado || 0);
      const comissaoValor = (valorEstimado * (comissaoPct / 100.0)).toFixed(2);

      const query = `
        INSERT INTO reservas_hotel_leads (
          evento_id, parceiro_id, hotel_id, nome_hospede, email, telefone,
          tipo_publico, qtd_hospedes, qtd_quartos, data_checkin, data_checkout,
          valor_total_estimado, comissao_parceiro_pct, comissao_parceiro_valor,
          status, observacoes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'Pendente', $15)
        RETURNING *
      `;

      const values = [
        evento_id,
        parceiroId,
        hotel_id || null,
        nome_hospede,
        email || null,
        telefone,
        tipo_publico || 'Atleta',
        qtd_hospedes || 1,
        qtd_quartos || 1,
        data_checkin || null,
        data_checkout || null,
        valorEstimado,
        comissaoPct,
        comissaoValor,
        observacoes || null,
      ];

      const result = await pool.query(query, values);
      return res.status(201).json({
        success: true,
        message: 'Solicitação de hospedagem registrada com sucesso!',
        data: result.rows[0],
      });
    } catch (err) {
      console.error('Erro ao cadastrar lead de hotel:', err);
      return res.status(500).json({
        success: false,
        message: 'Erro interno ao registrar solicitação de hospedagem.',
        error: err.message,
      });
    }
  },
};

module.exports = earningsController;
