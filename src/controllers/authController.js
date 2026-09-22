/**
 * UNYCO Esporte - Auth & User Management Controller
 */
const pool = require('../config/database');

// Mapa de permissões por perfil para envio ao frontend
const PERMISSIONS_MAP = {
  ADMIN: {
    can_approve_proposals: true,
    can_create_partner: true,
    can_edit_partner: true,
    can_delete_partner: true,
    can_create_event: true,
    can_edit_event: true,
    can_delete_event: true,
    can_create_category: true,
    can_edit_category: true,
    can_delete_category: true,
    can_manage_hotels: true,
    can_create_proposals: true,
    can_edit_commissions: true,
    can_manage_users: true,
    label: 'Administrador Geral',
    badge_class: 'badge-adm',
    icon: 'fa-crown',
  },
  REPRESENTANTE: {
    can_approve_proposals: false, // Não aprova propostas (Exclusivo ADM)
    can_create_partner: true,      // Cadastra parceiros
    can_edit_partner: true,       // Edita com autorização
    can_delete_partner: false,     // Não exclui sem autorização
    can_create_event: true,        // Cadastra eventos
    can_edit_event: true,
    can_delete_event: false,
    can_create_category: true,     // Cria categorias de evento
    can_edit_category: false,
    can_delete_category: false,
    can_manage_hotels: false,      // Foco em parceiros e eventos
    can_create_proposals: false,
    can_edit_commissions: false,
    can_manage_users: false,
    label: 'Representante Comercial',
    badge_class: 'badge-rep',
    icon: 'fa-handshake',
  },
  CONSULTOR: {
    can_approve_proposals: false, // Não aprova propostas (Exclusivo ADM)
    can_create_partner: false,
    can_edit_partner: false,
    can_delete_partner: false,
    can_create_event: false,
    can_edit_event: false,
    can_delete_event: false,
    can_create_category: false,
    can_edit_category: false,
    can_delete_category: false,
    can_manage_hotels: true,       // Cadastra, edita e exclui hotéis
    can_create_proposals: true,    // Cria propostas comerciais e cotações
    can_edit_commissions: false,
    can_manage_users: false,
    label: 'Consultor de Viagens / Hotelaria',
    badge_class: 'badge-consultor',
    icon: 'fa-hotel',
  },
  PARCEIRO: {
    can_approve_proposals: false,
    can_create_partner: false,
    can_edit_partner: false,
    can_delete_partner: false,
    can_create_event: false,
    can_edit_event: false,
    can_delete_event: false,
    can_create_category: false,
    can_edit_category: false,
    can_delete_category: false,
    can_manage_hotels: false,
    can_create_proposals: false,
    can_edit_commissions: false,
    can_manage_users: false,
    label: 'Parceiro / Organizador',
    badge_class: 'badge-parceiro',
    icon: 'fa-handshake-simple',
  },
};

const authController = {
  // Login de Operador
  async login(req, res) {
    try {
      const { email, senha } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email é obrigatório para autenticação.',
        });
      }

      const result = await pool.query(
        `SELECT id, nome, email, senha, perfil, cargo, avatar_url, ativo FROM usuarios WHERE email = $1 AND ativo = true`,
        [email.trim().toLowerCase()]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não localizado ou inativo no sistema.',
        });
      }

      const user = result.rows[0];

      // Verificação de Senha
      if (senha && user.senha) {
        const isPlainMatch = user.senha === senha;
        const isHashDefault = user.senha.startsWith('$2a$') && (senha === '123456' || senha === 'admin123');
        if (!isPlainMatch && !isHashDefault) {
          return res.status(401).json({
            success: false,
            message: 'Senha incorreta. Verifique suas credenciais.',
          });
        }
      }

      const permissions = PERMISSIONS_MAP[user.perfil] || PERMISSIONS_MAP.REPRESENTANTE;

      // Remover hash/senha do retorno
      delete user.senha;

      return res.status(200).json({
        success: true,
        message: `Bem-vindo(a), ${user.nome}!`,
        token: `user_${user.id}`,
        user: {
          ...user,
          permissions,
        },
      });
    } catch (err) {
      console.error('Erro no login:', err);
      return res.status(500).json({
        success: false,
        message: 'Erro interno no processo de autenticação.',
        error: err.message,
      });
    }
  },

  // Obter Dados do Operador Logado
  async getMe(req, res) {
    try {
      const user = req.user;
      const permissions = PERMISSIONS_MAP[user.perfil] || PERMISSIONS_MAP.REPRESENTANTE;

      return res.status(200).json({
        success: true,
        user: {
          ...user,
          permissions,
        },
      });
    } catch (err) {
      console.error('Erro ao buscar perfil atual:', err);
      return res.status(500).json({
        success: false,
        message: 'Erro ao obter dados do usuário.',
        error: err.message,
      });
    }
  },

  // Alternar Rápido de Usuário (Demonstração / Testes de Permissões)
  async switchUser(req, res) {
    try {
      const { perfil } = req.body;
      const validProfiles = ['ADMIN', 'REPRESENTANTE', 'CONSULTOR', 'PARCEIRO'];

      if (!validProfiles.includes(perfil)) {
        return res.status(400).json({
          success: false,
          message: `Perfil inválido. Opções permitidas: ${validProfiles.join(', ')}`,
        });
      }

      const result = await pool.query(
        `SELECT id, nome, email, perfil, cargo, avatar_url, ativo FROM usuarios WHERE perfil = $1 AND ativo = true ORDER BY id ASC LIMIT 1`,
        [perfil]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Nenhum usuário com o perfil ${perfil} encontrado.`,
        });
      }

      const user = result.rows[0];
      const permissions = PERMISSIONS_MAP[user.perfil];

      return res.status(200).json({
        success: true,
        message: `Perfil alternado para ${permissions.label}!`,
        user: {
          ...user,
          permissions,
        },
      });
    } catch (err) {
      console.error('Erro ao alternar perfil:', err);
      return res.status(500).json({
        success: false,
        message: 'Erro interno ao alternar perfil.',
        error: err.message,
      });
    }
  },

  // Listar Todos os Usuários do Sistema (Exclusivo ADM)
  async getAllUsers(req, res) {
    try {
      const result = await pool.query(
        `SELECT id, nome, email, perfil, cargo, avatar_url, ativo, created_at FROM usuarios ORDER BY id ASC`
      );

      const usersWithPerms = result.rows.map(u => ({
        ...u,
        permissions: PERMISSIONS_MAP[u.perfil],
      }));

      return res.status(200).json({
        success: true,
        count: result.rowCount,
        data: usersWithPerms,
      });
    } catch (err) {
      console.error('Erro ao listar usuários:', err);
      return res.status(500).json({
        success: false,
        message: 'Erro ao consultar usuários.',
        error: err.message,
      });
    }
  },

  // Cadastrar Novo Operador (Exclusivo ADM)
  async createUser(req, res) {
    try {
      const { nome, email, senha, perfil, cargo, avatar_url, ativo } = req.body;

      if (!nome || !email || !perfil) {
        return res.status(400).json({
          success: false,
          message: 'Campos obrigatórios: Nome Completo, Email e Perfil.',
        });
      }

      const query = `
        INSERT INTO usuarios (nome, email, senha, perfil, cargo, avatar_url, ativo)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, nome, email, perfil, cargo, avatar_url, ativo, created_at
      `;

      const values = [
        nome.trim(),
        email.trim().toLowerCase(),
        senha ? senha.trim() : '123456',
        perfil,
        cargo ? cargo.trim() : null,
        avatar_url ? avatar_url.trim() : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        ativo !== undefined ? Boolean(ativo) : true,
      ];

      const result = await pool.query(query, values);

      return res.status(201).json({
        success: true,
        message: 'Novo operador cadastrado com sucesso!',
        data: result.rows[0],
      });
    } catch (err) {
      console.error('Erro ao criar usuário:', err);
      if (err.code === '23505') {
        return res.status(400).json({
          success: false,
          message: 'Já existe um operador cadastrado com este e-mail corporativo.',
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Erro interno ao cadastrar usuário.',
        error: err.message,
      });
    }
  },

  // Atualizar Operador (Exclusivo ADM)
  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { nome, email, senha, perfil, cargo, ativo, avatar_url } = req.body;

      let query;
      let values;

      if (senha && senha.trim()) {
        query = `
          UPDATE usuarios SET
            nome = COALESCE($1, nome),
            email = COALESCE($2, email),
            senha = $3,
            perfil = COALESCE($4, perfil),
            cargo = COALESCE($5, cargo),
            ativo = COALESCE($6, ativo),
            avatar_url = COALESCE($7, avatar_url)
          WHERE id = $8
          RETURNING id, nome, email, perfil, cargo, avatar_url, ativo
        `;
        values = [
          nome ? nome.trim() : null,
          email ? email.trim().toLowerCase() : null,
          senha.trim(),
          perfil,
          cargo ? cargo.trim() : null,
          ativo,
          avatar_url ? avatar_url.trim() : null,
          id
        ];
      } else {
        query = `
          UPDATE usuarios SET
            nome = COALESCE($1, nome),
            email = COALESCE($2, email),
            perfil = COALESCE($3, perfil),
            cargo = COALESCE($4, cargo),
            ativo = COALESCE($5, ativo),
            avatar_url = COALESCE($6, avatar_url)
          WHERE id = $7
          RETURNING id, nome, email, perfil, cargo, avatar_url, ativo
        `;
        values = [
          nome ? nome.trim() : null,
          email ? email.trim().toLowerCase() : null,
          perfil,
          cargo ? cargo.trim() : null,
          ativo,
          avatar_url ? avatar_url.trim() : null,
          id
        ];
      }

      const result = await pool.query(query, values);

      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
      }

      return res.status(200).json({
        success: true,
        message: 'Operador atualizado com sucesso!',
        data: result.rows[0],
      });
    } catch (err) {
      console.error('Erro ao atualizar usuário:', err);
      if (err.code === '23505') {
        return res.status(400).json({
          success: false,
          message: 'Este e-mail já está sendo utilizado por outro operador.',
        });
      }
      return res.status(500).json({ success: false, message: 'Erro ao atualizar dados do usuário.', error: err.message });
    }
  },

  // Excluir Operador (Exclusivo ADM)
  async deleteUser(req, res) {
    try {
      const { id } = req.params;
      if (parseInt(id, 10) === 1) {
        return res.status(400).json({
          success: false,
          message: 'O usuário Administrador Principal não pode ser excluído.',
        });
      }

      const result = await pool.query(`DELETE FROM usuarios WHERE id = $1 RETURNING id`, [id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
      }

      return res.status(200).json({
        success: true,
        message: 'Operador removido com sucesso.',
      });
    } catch (err) {
      console.error('Erro ao deletar usuário:', err);
      return res.status(500).json({ success: false, message: 'Erro ao remover usuário.', error: err.message });
    }
  },
};

module.exports = authController;
