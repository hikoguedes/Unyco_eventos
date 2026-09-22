/**
 * UNYCO Esporte - Hotel Controller (Curadoria de Hotéis UNYCO)
 */
const pool = require('../config/database');

const hotelController = {
  // Listar todos os hotéis da curadoria UNYCO
  async getAllHotels(req, res) {
    try {
      const { cidade, status, search } = req.query;
      let query = `
        SELECT 
          h.*,
          COUNT(DISTINCT eh.evento_id) AS total_eventos_vinculados,
          COUNT(DISTINCT rhl.id) AS total_reservas_geradas
        FROM hoteis_curadoria h
        LEFT JOIN evento_hoteis eh ON h.id = eh.hotel_id
        LEFT JOIN reservas_hotel_leads rhl ON h.id = rhl.hotel_id
        WHERE 1=1
      `;
      const params = [];
      let paramCount = 1;

      if (cidade) {
        query += ` AND LOWER(h.cidade) = LOWER($${paramCount++})`;
        params.push(cidade);
      }

      if (status) {
        query += ` AND h.status = $${paramCount++}`;
        params.push(status);
      }

      if (search) {
        query += ` AND (LOWER(h.nome) LIKE LOWER($${paramCount}) OR LOWER(h.endereco) LIKE LOWER($${paramCount}) OR LOWER(h.cidade) LIKE LOWER($${paramCount}))`;
        params.push(`%${search}%`);
        paramCount++;
      }

      query += ` GROUP BY h.id ORDER BY h.categoria_estrelas DESC, h.nome ASC`;

      const result = await pool.query(query, params);
      return res.status(200).json({
        success: true,
        count: result.rowCount,
        data: result.rows,
      });
    } catch (err) {
      console.error('Erro ao listar hotéis:', err);
      return res.status(500).json({
        success: false,
        message: 'Erro interno ao consultar curadoria de hotéis.',
        error: err.message,
      });
    }
  },

  // Obter detalhes de um hotel específico
  async getHotelById(req, res) {
    try {
      const { id } = req.params;
      const hotelResult = await pool.query(`SELECT * FROM hoteis_curadoria WHERE id = $1`, [id]);

      if (hotelResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Hotel não encontrado.',
        });
      }

      // Buscar eventos vinculados
      const eventsResult = await pool.query(`
        SELECT 
          e.id AS evento_id,
          e.nome AS evento_nome,
          e.modalidade,
          e.data_inicio,
          e.cidade,
          p.nome_fantasia AS parceiro_nome,
          eh.distancia_evento_km,
          eh.cupom_desconto,
          eh.desconto_percentual,
          eh.destaque
        FROM evento_hoteis eh
        JOIN eventos e ON eh.evento_id = e.id
        JOIN parceiros p ON e.parceiro_id = p.id
        WHERE eh.hotel_id = $1
        ORDER BY e.data_inicio ASC
      `, [id]);

      return res.status(200).json({
        success: true,
        data: {
          ...hotelResult.rows[0],
          eventos_vinculados: eventsResult.rows,
        },
      });
    } catch (err) {
      console.error('Erro ao buscar hotel:', err);
      return res.status(500).json({
        success: false,
        message: 'Erro interno ao consultar dados do hotel.',
        error: err.message,
      });
    }
  },

  // Obter hotéis curados para um determinado evento (usado na LP e no painel)
  async getHotelsByEvent(req, res) {
    try {
      const { eventId } = req.params;
      const query = `
        SELECT 
          h.*,
          eh.distancia_evento_km,
          eh.cupom_desconto,
          eh.desconto_percentual,
          eh.destaque
        FROM evento_hoteis eh
        JOIN hoteis_curadoria h ON eh.hotel_id = h.id
        WHERE eh.evento_id = $1 AND h.status = 'ativo'
        ORDER BY eh.destaque DESC, eh.distancia_evento_km ASC
      `;

      const result = await pool.query(query, [eventId]);
      return res.status(200).json({
        success: true,
        count: result.rowCount,
        data: result.rows,
      });
    } catch (err) {
      console.error('Erro ao consultar hotéis do evento:', err);
      return res.status(500).json({
        success: false,
        message: 'Erro ao buscar curadoria de hotéis para este evento.',
        error: err.message,
      });
    }
  },

  // Cadastrar novo hotel na curadoria UNYCO
  async createHotel(req, res) {
    try {
      const {
        nome,
        categoria_estrelas,
        cidade,
        estado,
        endereco,
        tarifa_media,
        tarifa_atleta_desconto,
        comodidades,
        foto_url,
        link_reserva,
        telefone_contato,
        email_reservas,
        status,
      } = req.body;

      if (!nome || !cidade || !tarifa_media || !tarifa_atleta_desconto) {
        return res.status(400).json({
          success: false,
          message: 'Campos obrigatórios: nome, cidade, tarifa_media e tarifa_atleta_desconto.',
        });
      }

      const query = `
        INSERT INTO hoteis_curadoria (
          nome, categoria_estrelas, cidade, estado, endereco,
          tarifa_media, tarifa_atleta_desconto, comodidades,
          foto_url, link_reserva, telefone_contato, email_reservas, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;

      const values = [
        nome,
        categoria_estrelas || 4,
        cidade,
        estado || 'SP',
        endereco || null,
        tarifa_media,
        tarifa_atleta_desconto,
        comodidades || 'Café da Manhã Incluso, Wi-Fi Grátis, Academia, Estacionamento',
        foto_url || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
        link_reserva || 'https://unyco.tur.br',
        telefone_contato || null,
        email_reservas || null,
        status || 'ativo',
      ];

      const result = await pool.query(query, values);
      return res.status(201).json({
        success: true,
        message: 'Hotel cadastrado com sucesso na curadoria UNYCO.',
        data: result.rows[0],
      });
    } catch (err) {
      console.error('Erro ao cadastrar hotel:', err);
      return res.status(500).json({
        success: false,
        message: 'Erro interno ao cadastrar hotel.',
        error: err.message,
      });
    }
  },

  // Atualizar hotel
  async updateHotel(req, res) {
    try {
      const { id } = req.params;
      const {
        nome,
        categoria_estrelas,
        cidade,
        estado,
        endereco,
        tarifa_media,
        tarifa_atleta_desconto,
        comodidades,
        foto_url,
        link_reserva,
        telefone_contato,
        email_reservas,
        status,
      } = req.body;

      const query = `
        UPDATE hoteis_curadoria SET
          nome = COALESCE($1, nome),
          categoria_estrelas = COALESCE($2, categoria_estrelas),
          cidade = COALESCE($3, cidade),
          estado = COALESCE($4, estado),
          endereco = COALESCE($5, endereco),
          tarifa_media = COALESCE($6, tarifa_media),
          tarifa_atleta_desconto = COALESCE($7, tarifa_atleta_desconto),
          comodidades = COALESCE($8, comodidades),
          foto_url = COALESCE($9, foto_url),
          link_reserva = COALESCE($10, link_reserva),
          telefone_contato = COALESCE($11, telefone_contato),
          email_reservas = COALESCE($12, email_reservas),
          status = COALESCE($13, status)
        WHERE id = $14
        RETURNING *
      `;

      const values = [
        nome,
        categoria_estrelas,
        cidade,
        estado,
        endereco,
        tarifa_media,
        tarifa_atleta_desconto,
        comodidades,
        foto_url,
        link_reserva,
        telefone_contato,
        email_reservas,
        status,
        id,
      ];

      const result = await pool.query(query, values);
      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Hotel não encontrado para atualização.',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Hotel atualizado com sucesso.',
        data: result.rows[0],
      });
    } catch (err) {
      console.error('Erro ao atualizar hotel:', err);
      return res.status(500).json({
        success: false,
        message: 'Erro interno ao atualizar hotel.',
        error: err.message,
      });
    }
  },

  // Vincular hotel a um evento
  async linkHotelToEvent(req, res) {
    try {
      const { eventId } = req.params;
      const { hotel_id, distancia_evento_km, cupom_desconto, desconto_percentual, destaque } = req.body;

      if (!hotel_id) {
        return res.status(400).json({
          success: false,
          message: 'hotel_id é obrigatório.',
        });
      }

      const query = `
        INSERT INTO evento_hoteis (evento_id, hotel_id, distancia_evento_km, cupom_desconto, desconto_percentual, destaque)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (evento_id, hotel_id) DO UPDATE SET
          distancia_evento_km = EXCLUDED.distancia_evento_km,
          cupom_desconto = EXCLUDED.cupom_desconto,
          desconto_percentual = EXCLUDED.desconto_percentual,
          destaque = EXCLUDED.destaque
        RETURNING *
      `;

      const values = [
        eventId,
        hotel_id,
        distancia_evento_km || 1.5,
        cupom_desconto || 'UNYCOESPORTE',
        desconto_percentual || 10.00,
        destaque !== undefined ? destaque : true,
      ];

      const result = await pool.query(query, values);
      return res.status(200).json({
        success: true,
        message: 'Hotel vinculado ao evento com sucesso!',
        data: result.rows[0],
      });
    } catch (err) {
      console.error('Erro ao vincular hotel ao evento:', err);
      return res.status(500).json({
        success: false,
        message: 'Erro interno ao vincular hotel ao evento.',
        error: err.message,
      });
    }
  },

  // Desvincular hotel de um evento
  async unlinkHotelFromEvent(req, res) {
    try {
      const { eventId, hotelId } = req.params;
      const result = await pool.query(
        `DELETE FROM evento_hoteis WHERE evento_id = $1 AND hotel_id = $2 RETURNING *`,
        [eventId, hotelId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Vínculo não encontrado.',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Hotel desvinculado do evento com sucesso.',
      });
    } catch (err) {
      console.error('Erro ao desvincular hotel do evento:', err);
      return res.status(500).json({
        success: false,
        message: 'Erro interno ao desvincular hotel.',
        error: err.message,
      });
    }
  },

  // Excluir hotel da curadoria
  async deleteHotel(req, res) {
    try {
      const { id } = req.params;
      const result = await pool.query(`DELETE FROM hoteis_curadoria WHERE id = $1 RETURNING *`, [id]);

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Hotel não encontrado.',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Hotel removido da curadoria com sucesso.',
      });
    } catch (err) {
      console.error('Erro ao deletar hotel:', err);
      return res.status(500).json({
        success: false,
        message: 'Erro ao remover hotel. Verifique vínculos existentes.',
        error: err.message,
      });
    }
  },
};

module.exports = hotelController;
