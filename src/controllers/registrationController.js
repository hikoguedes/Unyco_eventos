const db = require('../config/database');

// Realizar inscrição pública em um evento esportivo (Landing Page)
exports.registerForEvent = async (req, res) => {
  try {
    const { id: evento_id } = req.params;
    const {
      nome_completo,
      cpf,
      email,
      telefone,
      data_nascimento,
      genero,
      tamanho_camiseta,
      contato_emergencia_nome,
      contato_emergencia_telefone,
      precisa_hospedagem,
      hospedagem_hotel_id,
      hospedagem_qtd_pessoas
    } = req.body;

    if (!nome_completo || !email || !telefone) {
      return res.status(400).json({
        success: false,
        message: 'Nome completo, email e telefone são campos obrigatórios para a inscrição.',
      });
    }

    // 1. Verificar se o evento existe e obter dados do parceiro (comissões)
    const eventResult = await db.query(
      `SELECT e.*, p.id AS parceiro_id, p.nome_fantasia AS parceiro_nome, p.logo_url AS parceiro_logo,
              p.comissao_inscricao_pct, p.comissao_hotelaria_pct,
              COUNT(i.id)::int AS total_inscritos
       FROM eventos e
       JOIN parceiros p ON p.id = e.parceiro_id
       LEFT JOIN inscricoes_evento i ON i.evento_id = e.id
       WHERE e.id = $1
       GROUP BY e.id, p.id, p.nome_fantasia, p.logo_url, p.comissao_inscricao_pct, p.comissao_hotelaria_pct`,
      [evento_id]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Evento esportivo não encontrado' });
    }

    const eventData = eventResult.rows[0];

    if (eventData.status === 'Cancelado') {
      return res.status(400).json({ success: false, message: 'Este evento foi cancelado e não aceita novas inscrições.' });
    }

    if (eventData.status === 'Concluído') {
      return res.status(400).json({ success: false, message: 'As inscrições para este evento já foram encerradas.' });
    }

    if (eventData.capacidade && eventData.total_inscritos >= eventData.capacidade) {
      return res.status(400).json({ success: false, message: 'As vagas para este evento estão esgotadas!' });
    }

    // 2. Gerar código único de inscrição (ex: UNY-2026-A8F2)
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const countSeq = (eventData.total_inscritos + 1).toString().padStart(4, '0');
    const codigo_inscricao = `UNY-2026-${countSeq}-${randomSuffix}`;

    const valorInscricao = eventData.valor_inscricao ? parseFloat(eventData.valor_inscricao) : 0.00;
    const comissaoInscricaoPct = parseFloat(eventData.comissao_inscricao_pct || 10.00);
    const comissaoParceiroInscricao = (valorInscricao * (comissaoInscricaoPct / 100.00)).toFixed(2);

    // 3. Inserir inscrição no banco
    const queryText = `
      INSERT INTO inscricoes_evento (
        evento_id, codigo_inscricao, nome_completo, cpf, email, telefone,
        data_nascimento, genero, tamanho_camiseta, contato_emergencia_nome,
        contato_emergencia_telefone, precisa_hospedagem, hospedagem_hotel_id,
        hospedagem_qtd_pessoas, status_pagamento, valor_pago, comissao_parceiro_inscricao
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `;

    const values = [
      evento_id,
      codigo_inscricao,
      nome_completo.trim(),
      cpf ? cpf.trim() : null,
      email.trim().toLowerCase(),
      telefone.trim(),
      data_nascimento || null,
      genero || null,
      tamanho_camiseta || 'M',
      contato_emergencia_nome ? contato_emergencia_nome.trim() : null,
      contato_emergencia_telefone ? contato_emergencia_telefone.trim() : null,
      Boolean(precisa_hospedagem || hospedagem_hotel_id),
      hospedagem_hotel_id || null,
      hospedagem_qtd_pessoas || 1,
      'Confirmado',
      valorInscricao,
      comissaoParceiroInscricao
    ];

    const result = await db.query(queryText, values);
    const registration = result.rows[0];

    // 4. Se o atleta solicitou hotelaria ou selecionou um hotel da curadoria UNYCO, registrar o lead de hospedagem
    let hotelLead = null;
    if (precisa_hospedagem || hospedagem_hotel_id) {
      try {
        let hotelTarifa = 350.00;
        let hotelNome = 'Hotel Curadoria UNYCO';
        if (hospedagem_hotel_id) {
          const hRes = await db.query('SELECT nome, tarifa_atleta_desconto, tarifa_media FROM hoteis_curadoria WHERE id = $1', [hospedagem_hotel_id]);
          if (hRes.rows.length > 0) {
            hotelTarifa = parseFloat(hRes.rows[0].tarifa_atleta_desconto || hRes.rows[0].tarifa_media || 350.00);
            hotelNome = hRes.rows[0].nome;
          }
        }

        const qtdPessoas = parseInt(hospedagem_qtd_pessoas || 1, 10);
        const qtdQuartos = Math.max(1, Math.ceil(qtdPessoas / 2));
        const estimatedNights = 2; // Padrão fim de semana de evento esportivo
        const valorEstimadoHotel = (hotelTarifa * qtdQuartos * estimatedNights).toFixed(2);

        const comissaoHotelPct = parseFloat(eventData.comissao_hotelaria_pct || 8.00);
        const comissaoParceiroHotel = (parseFloat(valorEstimadoHotel) * (comissaoHotelPct / 100.00)).toFixed(2);

        const leadQuery = `
          INSERT INTO reservas_hotel_leads (
            evento_id, parceiro_id, hotel_id, inscricao_id, nome_hospede, email, telefone,
            tipo_publico, qtd_hospedes, qtd_quartos, valor_total_estimado,
            comissao_parceiro_pct, comissao_parceiro_valor, status, observacoes
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'Pendente', $14)
          RETURNING *
        `;

        const leadValues = [
          evento_id,
          eventData.parceiro_id,
          hospedagem_hotel_id || null,
          registration.id,
          nome_completo.trim(),
          email.trim().toLowerCase(),
          telefone.trim(),
          'Atleta / Participante',
          qtdPessoas,
          qtdQuartos,
          valorEstimadoHotel,
          comissaoHotelPct,
          comissaoParceiroHotel,
          `Lead gerado automaticamente na inscrição online (${codigo_inscricao}) - Hotel: ${hotelNome}`,
        ];

        const leadRes = await db.query(leadQuery, leadValues);
        hotelLead = leadRes.rows[0];
      } catch (hErr) {
        console.error('Erro ao gerar lead automático de hotelaria:', hErr);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Inscrição realizada com sucesso!',
      data: {
        ...registration,
        evento_nome: eventData.nome,
        evento_modalidade: eventData.modalidade,
        evento_data_inicio: eventData.data_inicio,
        evento_local: eventData.local,
        evento_cidade: eventData.cidade,
        evento_banner: eventData.banner_url,
        parceiro_nome: eventData.parceiro_nome,
        hotel_lead: hotelLead,
      }
    });
  } catch (error) {
    console.error('Erro ao processar inscrição:', error);
    return res.status(500).json({ success: false, message: 'Erro ao processar inscrição', error: error.message });
  }
};

// Listar inscritos de um evento específico (Painel Administrativo)
exports.getEventRegistrations = async (req, res) => {
  try {
    const { id: evento_id } = req.params;

    const eventResult = await db.query('SELECT * FROM eventos WHERE id = $1', [evento_id]);
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Evento não encontrado' });
    }

    const regResult = await db.query(
      `SELECT i.*, h.nome AS hotel_nome 
       FROM inscricoes_evento i 
       LEFT JOIN hoteis_curadoria h ON i.hospedagem_hotel_id = h.id 
       WHERE i.evento_id = $1 
       ORDER BY i.created_at DESC`,
      [evento_id]
    );

    return res.json({
      success: true,
      evento: eventResult.rows[0],
      count: regResult.rowCount,
      data: regResult.rows,
    });
  } catch (error) {
    console.error('Erro ao buscar inscritos do evento:', error);
    return res.status(500).json({ success: false, message: 'Erro ao consultar inscritos', error: error.message });
  }
};

// Buscar inscrição por código único (Comprovante / QR code)
exports.getRegistrationByCode = async (req, res) => {
  try {
    const { code } = req.params;

    const queryText = `
      SELECT 
        i.*,
        e.nome AS evento_nome,
        e.modalidade AS evento_modalidade,
        e.local AS evento_local,
        e.cidade AS evento_cidade,
        e.estado AS evento_estado,
        e.data_inicio AS evento_data_inicio,
        e.data_fim AS evento_data_fim,
        e.banner_url AS evento_banner,
        p.nome_fantasia AS parceiro_nome,
        p.logo_url AS parceiro_logo,
        h.nome AS hotel_preferencia_nome,
        h.foto_url AS hotel_preferencia_foto,
        h.tarifa_atleta_desconto AS hotel_tarifa_atleta
      FROM inscricoes_evento i
      JOIN eventos e ON e.id = i.evento_id
      JOIN parceiros p ON p.id = e.parceiro_id
      LEFT JOIN hoteis_curadoria h ON i.hospedagem_hotel_id = h.id
      WHERE i.codigo_inscricao = $1
    `;

    const result = await db.query(queryText, [code]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Inscrição não localizada' });
    }

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Erro ao buscar inscrição por código:', error);
    return res.status(500).json({ success: false, message: 'Erro ao buscar inscrição', error: error.message });
  }
};

// Atualizar status de pagamento / presença de um participante
exports.updateRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const { status_pagamento, tamanho_camiseta } = req.body;

    const queryText = `
      UPDATE inscricoes_evento
      SET 
        status_pagamento = COALESCE($1, status_pagamento),
        tamanho_camiseta = COALESCE($2, tamanho_camiseta)
      WHERE id = $3
      RETURNING *
    `;

    const result = await db.query(queryText, [status_pagamento, tamanho_camiseta, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Inscrição não encontrada' });
    }

    return res.json({
      success: true,
      message: 'Inscrição atualizada com sucesso!',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Erro ao atualizar inscrição:', error);
    return res.status(500).json({ success: false, message: 'Erro ao atualizar inscrição', error: error.message });
  }
};

// Excluir inscrição
exports.deleteRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM inscricoes_evento WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Inscrição não encontrada para exclusão' });
    }

    return res.json({
      success: true,
      message: 'Inscrição cancelada com sucesso!',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Erro ao excluir inscrição:', error);
    return res.status(500).json({ success: false, message: 'Erro ao excluir inscrição', error: error.message });
  }
};
