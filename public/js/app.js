/**
 * UNYCO ESPORTE - Frontend Application Logic
 * Gestão de Eventos Esportivos, Parceiros, Categorias e Propostas de Parceria
 */

window.app = {
  state: {
    currentTab: 'dashboard',
    currentEarningsSubtab: 'partners',
    currentUser: null,
    partners: [],
    events: [],
    categories: [],
    proposals: [],
    hotels: [],
    hotelLeads: [],
    earningsData: null,
    currentEventForRegistrations: null,
    stats: null,
    selectedPartnerForDetails: null,
    selectedPartnerWallet: null,
    walletStudentsCache: [],
  },

  // Helper para urls com prefixo de subdiretório
  urlWithBase(url) {
    if (!url || !url.startsWith('/')) return url;
    let base = window.BASE_PATH;
    if (!base && typeof window !== 'undefined' && window.location && window.location.pathname.includes('/unycoeventos')) {
      base = '/unycoeventos';
    }
    base = (base || '').replace(/\/$/, '');
    if (base && !url.startsWith(base)) {
      return base + url;
    }
    return url;
  },

  // Helper para requisições com autenticação RBAC
  async apiFetch(url, options = {}) {
    options.headers = options.headers || {};
    if (this.state.currentUser && this.state.currentUser.id) {
      options.headers['x-user-id'] = String(this.state.currentUser.id);
    }
    return fetch(this.urlWithBase(url), options);
  },

  // Inicialização da Aplicação
  async init() {
    window.app = this;
    this.bindEvents();
    this.checkHealth();
    await this.checkAuthSession();
    this.fetchUsers();
  },

  // Vinculação de Eventos da Interface
  bindEvents() {
    // Navegação por Abas
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-tab');
        if (tab) this.switchTab(tab);
      });
    });

    // Botões do Topbar
    document.getElementById('btnRefreshData')?.addEventListener('click', () => {
      this.refreshAll(true);
    });

    document.getElementById('btnOpenProposalModal')?.addEventListener('click', () => {
      this.openCreateProposalModal();
    });

    document.getElementById('btnOpenPartnerModal')?.addEventListener('click', () => {
      this.openCreatePartnerModal();
    });

    document.getElementById('btnOpenEventModal')?.addEventListener('click', () => {
      this.openCreateEventModal();
    });

    document.getElementById('btnOpenUserCreateTopbar')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openCreateUserModal();
    });

    document.getElementById('btnOpenCreateUserModal')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openCreateUserModal();
    });

    // Filtros de Parceiros
    document.getElementById('partnerSearchInput')?.addEventListener('input', () => {
      this.renderPartners();
    });
    document.getElementById('partnerStatusFilter')?.addEventListener('change', () => {
      this.renderPartners();
    });

    // Filtros de Eventos
    document.getElementById('eventSearchInput')?.addEventListener('input', () => {
      this.renderEvents();
    });
    document.getElementById('eventCategoryFilter')?.addEventListener('change', () => {
      this.renderEvents();
    });
    document.getElementById('eventPartnerFilter')?.addEventListener('change', () => {
      this.renderEvents();
    });
    document.getElementById('eventStatusFilter')?.addEventListener('change', () => {
      this.renderEvents();
    });

    // Filtros de Propostas
    document.getElementById('proposalSearchInput')?.addEventListener('input', () => {
      this.renderProposals();
    });
    document.getElementById('proposalStatusFilter')?.addEventListener('change', () => {
      this.renderProposals();
    });

    // Filtros de Categorias
    document.getElementById('categorySearchInput')?.addEventListener('input', () => {
      this.renderCategories();
    });

    // Filtros de Ganhos & Hotelaria
    document.getElementById('earningsPartnerSearch')?.addEventListener('input', () => {
      this.renderEarningsPartners();
    });
    document.getElementById('hotelSearchInput')?.addEventListener('input', () => {
      this.filterHotels();
    });
    document.getElementById('hotelLeadsSearchInput')?.addEventListener('input', () => {
      this.filterHotelLeads();
    });

    // Filtros de Operadores
    document.getElementById('userSearchInput')?.addEventListener('input', () => {
      this.renderUsers();
    });
    document.getElementById('userRoleFilter')?.addEventListener('change', () => {
      this.renderUsers();
    });
    document.getElementById('userStatusFilter')?.addEventListener('change', () => {
      this.renderUsers();
    });

    // Botão de adicionar evento no modal de detalhes do parceiro
    document.getElementById('btnAddNewEventForPartner')?.addEventListener('click', () => {
      if (this.state.selectedPartnerForDetails) {
        const partnerId = this.state.selectedPartnerForDetails.id;
        this.closeModal('partnerDetailsModal');
        this.openCreateEventModal(partnerId);
      }
    });

    // Botão de copiar link da LP dentro do modal de inscritos
    document.getElementById('btnCopyLPLinkFromModal')?.addEventListener('click', () => {
      if (this.state.currentEventForRegistrations) {
        this.copyLPLink(this.state.currentEventForRegistrations.id);
      }
    });

    // Fechar modal ao clicar fora da caixa
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeModal(modal.id);
        }
      });
    });
  },

  // Checagem de Conexão com o Backend e PostgreSQL
  async checkHealth() {
    try {
      const res = await fetch(this.urlWithBase('/health'));
      const data = await res.json();
      const pill = document.getElementById('serverStatusPill');
      if (pill) {
        if (data.status === 'UP' && data.database && (data.database === 'CONNECTED' || data.database.startsWith('CONNECTED'))) {
          const engineLabel = data.database_engine || 'PostgreSQL Conectado';
          pill.innerHTML = `
            <span class="status-dot online"></span>
            <span class="status-text">${engineLabel}</span>
          `;
        } else {
          pill.innerHTML = `
            <span class="status-dot" style="background: #EF4444; box-shadow: 0 0 8px #EF4444;"></span>
            <span class="status-text" style="color: #DC2626;">Banco de Dados Desconectado</span>
          `;
        }
      }
    } catch (e) {
      const pill = document.getElementById('serverStatusPill');
      if (pill) {
        pill.innerHTML = `
          <span class="status-dot" style="background: #EF4444;"></span>
          <span class="status-text" style="color: #DC2626;">Servidor Offline</span>
        `;
      }
    }
  },

  // ==========================================================
  // AUTENTICAÇÃO, LOGIN E CONTROLE DE ACESSO (RBAC)
  // ==========================================================
  async checkAuthSession() {
    const savedUser = localStorage.getItem('unyco_auth_user');
    const token = localStorage.getItem('unyco_session_token');

    if (savedUser && token) {
      try {
        const parsed = JSON.parse(savedUser);
        this.state.currentUser = parsed;

        // Validar e sincronizar com o backend
        const res = await fetch(this.urlWithBase('/api/auth/me'), {
          headers: { 'x-user-id': String(parsed.id) }
        });
        const json = await res.json();
        if (json.success && json.user) {
          this.state.currentUser = json.user;
          localStorage.setItem('unyco_auth_user', JSON.stringify(json.user));
          this.showAppLayout();
          this.applyPermissions();
          this.refreshAll();
          return;
        }
      } catch (e) {
        console.warn('Erro ao restaurar sessão existente:', e);
      }
    }

    // Se não houver sessão ativa, exibir tela de login
    this.showLoginScreen();
  },

  showLoginScreen() {
    const loginScreen = document.getElementById('loginScreen');
    const appLayout = document.getElementById('appLayout');
    if (loginScreen) {
      loginScreen.classList.remove('hidden');
      loginScreen.style.display = 'flex';
    }
    if (appLayout) {
      appLayout.style.display = 'none';
    }
  },

  showAppLayout() {
    const loginScreen = document.getElementById('loginScreen');
    const appLayout = document.getElementById('appLayout');
    if (loginScreen) {
      loginScreen.classList.add('hidden');
      setTimeout(() => {
        loginScreen.style.display = 'none';
      }, 300);
    }
    if (appLayout) {
      appLayout.style.display = 'flex';
    }
  },

  async handleLogin(event) {
    if (event) event.preventDefault();
    const email = document.getElementById('loginEmail')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;
    const submitBtn = document.getElementById('btnLoginSubmit');

    if (!email) {
      this.showToast('Por favor, informe seu email corporativo.', 'error');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Autenticando...';
    }

    try {
      const res = await fetch(this.urlWithBase('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha: password }),
      });

      const json = await res.json();

      if (json.success && json.user) {
        this.state.currentUser = json.user;
        localStorage.setItem('unyco_session_token', json.token || `user_${json.user.id}`);
        localStorage.setItem('unyco_auth_user', JSON.stringify(json.user));
        localStorage.setItem('unyco_active_profile', json.user.perfil);

        this.showToast(`Bem-vindo(a), ${json.user.nome}!`, 'success');
        this.showAppLayout();
        this.applyPermissions();
        await this.refreshAll();
      } else {
        this.showToast(json.message || 'Credenciais inválidas. Verifique seu email.', 'error');
      }
    } catch (e) {
      console.error('Erro no login:', e);
      this.showToast('Erro de comunicação com o servidor de autenticação.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Acessar o Sistema</span> <i class="fa-solid fa-arrow-right"></i>';
      }
    }
  },

  async quickLoginAs(email, password = '123456') {
    const emailInput = document.getElementById('loginEmail');
    const passInput = document.getElementById('loginPassword');
    if (emailInput) emailInput.value = email;
    if (passInput) passInput.value = password;

    await this.handleLogin(null);
  },

  logout() {
    localStorage.removeItem('unyco_session_token');
    localStorage.removeItem('unyco_auth_user');
    localStorage.removeItem('unyco_active_profile');
    this.state.currentUser = null;

    this.showLoginScreen();
    this.showToast('Sessão encerrada com sucesso.', 'info');
  },

  togglePasswordVisibility(inputId, btnEl) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const icon = btnEl.querySelector('i');
    if (input.type === 'password') {
      input.type = 'text';
      if (icon) {
        icon.className = 'fa-regular fa-eye-slash';
      }
    } else {
      input.type = 'password';
      if (icon) {
        icon.className = 'fa-regular fa-eye';
      }
    }
  },

  async fetchCurrentUser() {
    try {
      const savedProfile = localStorage.getItem('unyco_active_profile') || 'ADMIN';
      const res = await fetch(this.urlWithBase('/api/auth/switch-user'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ perfil: savedProfile }),
      });
      const json = await res.json();
      if (json.success && json.user) {
        this.state.currentUser = json.user;
        this.applyPermissions();
      }
    } catch (e) {
      console.error('Erro ao identificar usuário:', e);
    }
  },

  async switchActiveProfile(profile) {
    try {
      const res = await fetch(this.urlWithBase('/api/auth/switch-user'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ perfil: profile }),
      });
      const json = await res.json();
      if (json.success && json.user) {
        this.state.currentUser = json.user;
        localStorage.setItem('unyco_active_profile', profile);
        localStorage.setItem('unyco_auth_user', JSON.stringify(json.user));
        this.applyPermissions();
        this.showToast(`Perfil alternado para ${json.user.permissions?.label}!`, 'success');
        this.refreshAll();
      } else {
        this.showToast(json.message || 'Erro ao alternar perfil', 'error');
      }
    } catch (e) {
      console.error('Erro ao alternar perfil:', e);
      this.showToast('Erro de comunicação com o servidor.', 'error');
    }
  },

  applyPermissions() {
    const user = this.state.currentUser;
    if (!user) return;

    const perms = user.permissions || {};

    // 1. Atualizar Widget no Topbar
    const avatar = document.getElementById('currentUserAvatar');
    if (avatar) avatar.src = (user.avatar_url ? this.urlWithBase(user.avatar_url) : '') || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';

    const nameEl = document.getElementById('currentUserName');
    if (nameEl) nameEl.textContent = user.nome.split(' ')[0] + ' ' + (user.nome.split(' ')[1] || '');

    const badgeEl = document.getElementById('currentUserRoleBadge');
    if (badgeEl) {
      badgeEl.className = `user-role-badge ${perms.badge_class || 'badge-adm'}`;
      badgeEl.innerHTML = `<i class="fa-solid ${perms.icon || 'fa-user'}"></i> ${user.perfil}`;
    }

    const selectEl = document.getElementById('selectSwitchProfile');
    if (selectEl) selectEl.value = user.perfil;

    // 2. Restrições no Formulário de Propostas Comerciais
    const optAprovada = document.querySelector('#proposalStatus option[value="Aprovada"]');
    if (optAprovada) {
      if (!perms.can_approve_proposals) {
        optAprovada.disabled = true;
        optAprovada.textContent = 'Aprovada (🔒 Exclusivo ADM)';
      } else {
        optAprovada.disabled = false;
        optAprovada.textContent = 'Aprovada';
      }
    }

    // 3. Ajuste de Visibilidade em Botões de Ação
    const btnProposal = document.getElementById('btnOpenProposalModal');
    if (btnProposal) {
      btnProposal.style.display = (user.perfil === 'REPRESENTANTE') ? 'none' : 'inline-flex';
    }

    const btnPartner = document.getElementById('btnOpenPartnerModal');
    if (btnPartner) {
      btnPartner.style.display = (user.perfil === 'CONSULTOR') ? 'none' : 'inline-flex';
    }

    const btnEvent = document.getElementById('btnOpenEventModal');
    if (btnEvent) {
      btnEvent.style.display = (user.perfil === 'CONSULTOR') ? 'none' : 'inline-flex';
    }

    // 4. Controle de Visibilidade de Gestão de Usuários (Exclusivo ADM)
    const btnUsers = document.getElementById('btnOpenUsersModal');
    if (btnUsers) {
      btnUsers.style.display = (user.perfil === 'ADMIN') ? 'inline-flex' : 'none';
    }

    const btnUserTopbar = document.getElementById('btnOpenUserCreateTopbar');
    if (btnUserTopbar) {
      btnUserTopbar.style.display = (user.perfil === 'ADMIN') ? 'inline-flex' : 'none';
    }

    const navSettings = document.getElementById('navSettings');
    if (navSettings) {
      navSettings.style.display = (user.perfil === 'ADMIN') ? 'flex' : 'none';
    }
  },

  async fetchUsers() {
    try {
      const res = await this.apiFetch('/api/auth/users');
      const json = await res.json();
      if (json.success && json.data) {
        this.state.usersList = json.data;
        const badge = document.getElementById('badgeUsersCount');
        if (badge) badge.textContent = json.count || json.data.length;
        this.renderUsers();
      }
    } catch (e) {
      console.warn('Erro ao consultar operadores do sistema:', e);
    }
  },

  renderUsers() {
    const tabTbody = document.getElementById('tabUsersTableBody');
    const modalTbody = document.getElementById('usersTableBody');
    if (!this.state.usersList) return;

    const search = document.getElementById('userSearchInput')?.value.toLowerCase().trim() || '';
    const roleFilter = document.getElementById('userRoleFilter')?.value || '';
    const statusFilter = document.getElementById('userStatusFilter')?.value || '';

    const filtered = this.state.usersList.filter(u => {
      const matchSearch = !search || 
        (u.nome && u.nome.toLowerCase().includes(search)) || 
        (u.email && u.email.toLowerCase().includes(search)) || 
        (u.cargo && u.cargo.toLowerCase().includes(search));
      const matchRole = !roleFilter || u.perfil === roleFilter;
      const matchStatus = !statusFilter || (statusFilter === 'ativo' ? u.ativo !== false : u.ativo === false);
      return matchSearch && matchRole && matchStatus;
    });

    const renderRow = (u) => {
      const isSuperAdmin = u.id === 1;
      const isSelf = this.state.currentUser && this.state.currentUser.id === u.id;
      const statusClass = u.ativo !== false ? 'ativo' : 'inativo';
      const statusLabel = u.ativo !== false ? 'Ativo' : 'Inativo';
      const roleBadgeClass = u.permissions?.badge_class || (u.perfil === 'ADMIN' ? 'badge-adm' : u.perfil === 'REPRESENTANTE' ? 'badge-rep' : u.perfil === 'CONSULTOR' ? 'badge-consultor' : 'badge-parceiro');
      const roleIcon = u.permissions?.icon || (u.perfil === 'ADMIN' ? 'fa-crown' : u.perfil === 'REPRESENTANTE' ? 'fa-handshake' : u.perfil === 'CONSULTOR' ? 'fa-hotel' : 'fa-handshake-simple');
      const roleLabel = u.perfil === 'ADMIN' ? 'Administrador Geral' : u.perfil === 'REPRESENTANTE' ? 'Representante Comercial' : u.perfil === 'CONSULTOR' ? 'Consultor de Viagens' : 'Parceiro / Organizador';

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="${(u.avatar_url ? this.urlWithBase(u.avatar_url) : '') || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border-color);" alt="${this.escapeHtml(u.nome)}" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'">
              <div>
                <strong style="color: #0F172A; display: block; font-size: 14px;">${this.escapeHtml(u.nome)}</strong>
                ${isSelf ? '<span style="display: inline-block; font-size: 10px; font-weight: 700; color: #BE185D; background: #FDF2F8; padding: 1px 6px; border-radius: 4px; margin-top: 2px;">Sua Conta (Você)</span>' : ''}
              </div>
            </div>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 6px;">
              <i class="fa-regular fa-envelope" style="color: var(--text-dim); font-size: 12px;"></i>
              <code style="font-size: 12px; color: #334155; font-weight: 600;">${this.escapeHtml(u.email)}</code>
            </div>
          </td>
          <td>
            <span class="user-role-badge ${roleBadgeClass}" style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; font-weight: 600; font-size: 12px;">
              <i class="fa-solid ${roleIcon}"></i> ${roleLabel}
            </span>
          </td>
          <td>
            <span style="color: #475569; font-weight: 500; font-size: 13px;">${this.escapeHtml(u.cargo || '-')}</span>
          </td>
          <td>
            <span class="partner-status-tag ${statusClass}" style="font-size: 11px;">
              <span class="status-dot ${statusClass === 'ativo' ? 'online' : ''}" style="${statusClass !== 'ativo' ? 'background: #94A3B8;' : ''}"></span>
              ${statusLabel}
            </span>
          </td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 8px; justify-content: flex-end;">
              <button class="btn btn-sm btn-primary" onclick="app.openEditUserModal(${u.id})" title="Editar Usuário / Operador" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 12px;">
                <i class="fa-solid fa-pen-to-square"></i> <span>Editar</span>
              </button>
              ${!isSuperAdmin && !isSelf ? `
                <button class="btn btn-sm btn-outline" onclick="app.deleteUser(${u.id})" style="color: #EF4444; border-color: #FECACA; padding: 6px 10px;" title="Excluir Operador">
                  <i class="fa-solid fa-trash"></i>
                </button>
              ` : `
                <button class="btn btn-sm btn-outline" disabled style="opacity: 0.35; cursor: not-allowed; padding: 6px 10px;" title="Usuário protegido contra exclusão">
                  <i class="fa-solid fa-lock"></i>
                </button>
              `}
            </div>
          </td>
        </tr>
      `;
    };

    const emptyState = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px 20px; color: var(--text-dim);">
          <i class="fa-solid fa-user-xmark" style="font-size: 32px; color: #CBD5E1; margin-bottom: 12px; display: block;"></i>
          <strong>Nenhum operador encontrado com os filtros selecionados.</strong>
          <p style="font-size: 12px; margin-top: 4px;">Tente ajustar a busca ou limpe os filtros para visualizar os usuários.</p>
        </td>
      </tr>
    `;

    const html = filtered.length > 0 ? filtered.map(renderRow).join('') : emptyState;

    if (tabTbody) tabTbody.innerHTML = html;
    if (modalTbody) modalTbody.innerHTML = html;
  },

  async openUsersManagementModal() {
    this.switchTab('users');
  },

  openCreateUserModal() {
    try {
      const form = document.getElementById('userManagementForm');
      if (form) form.reset();

      const idEl = document.getElementById('userFormId');
      if (idEl) idEl.value = '';

      const titleEl = document.getElementById('userFormModalTitle');
      if (titleEl) titleEl.textContent = 'Novo Operador do Sistema';

      const passEl = document.getElementById('userSenha');
      if (passEl) {
        passEl.value = '';
        passEl.setAttribute('required', 'required');
        passEl.placeholder = 'Digite a senha (mínimo 4 caracteres)';
      }

      const passHelp = document.getElementById('userSenhaHelp');
      if (passHelp) passHelp.textContent = 'Senha obrigatória para o primeiro acesso do operador.';

      const perfilEl = document.getElementById('userPerfil');
      if (perfilEl) perfilEl.value = 'REPRESENTANTE';

      const nomeEl = document.getElementById('userNome');
      if (nomeEl) nomeEl.value = '';

      const emailEl = document.getElementById('userEmail');
      if (emailEl) emailEl.value = '';

      const cargoEl = document.getElementById('userCargo');
      if (cargoEl) cargoEl.value = '';

      const ativoEl = document.getElementById('userAtivo');
      if (ativoEl) ativoEl.checked = true;

      const avatarEl = document.getElementById('userAvatarUrl');
      const defaultAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
      if (avatarEl) avatarEl.value = defaultAvatar;
      this.updateUserAvatarPreviewFromUrl(defaultAvatar);
      const fileInputCreate = document.getElementById('userAvatarFileInput');
      if (fileInputCreate) fileInputCreate.value = '';

      this.updateUserRoleHelpText('REPRESENTANTE');
      this.openModal('userFormModal');
    } catch (e) {
      console.error('Erro ao abrir modal de criação de operador:', e);
      alert('Erro ao abrir formulário de cadastro: ' + e.message);
    }
  },

  async openEditUserModal(userId) {
    try {
      if (!this.state.usersList || this.state.usersList.length === 0) {
        await this.fetchUsers();
      }

      const u = this.state.usersList?.find(item => Number(item.id) === Number(userId));
      if (!u) {
        this.showToast('Usuário não localizado.', 'error');
        return;
      }

      const form = document.getElementById('userManagementForm');
      if (form) form.reset();

      const formId = document.getElementById('userFormId');
      if (formId) formId.value = u.id;

      const title = document.getElementById('userFormModalTitle');
      if (title) title.textContent = `Editar Operador: ${u.nome}`;

      const nome = document.getElementById('userNome');
      if (nome) nome.value = u.nome || '';

      const email = document.getElementById('userEmail');
      if (email) email.value = u.email || '';

      const senha = document.getElementById('userSenha');
      if (senha) {
        senha.value = '';
        senha.removeAttribute('required');
        senha.placeholder = 'Deixe em branco para manter a senha atual';
      }

      const senhaHelp = document.getElementById('userSenhaHelp');
      if (senhaHelp) senhaHelp.textContent = 'Deixe em branco caso não queira alterar a senha atual do operador.';

      const perfil = document.getElementById('userPerfil');
      if (perfil) perfil.value = u.perfil || 'REPRESENTANTE';

      const cargo = document.getElementById('userCargo');
      if (cargo) cargo.value = u.cargo || '';

      const avatar = document.getElementById('userAvatarUrl');
      const avatarVal = u.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
      if (avatar) avatar.value = u.avatar_url || '';
      this.updateUserAvatarPreviewFromUrl(avatarVal);
      const fileInputEdit = document.getElementById('userAvatarFileInput');
      if (fileInputEdit) fileInputEdit.value = '';

      const ativo = document.getElementById('userAtivo');
      if (ativo) ativo.checked = u.ativo !== false;

      this.updateUserRoleHelpText(u.perfil || 'REPRESENTANTE');
      this.openModal('userFormModal');
    } catch (e) {
      console.error('Erro ao abrir modal de edição de operador:', e);
      this.showToast('Erro ao abrir formulário de edição.', 'error');
    }
  },

  updateUserRoleHelpText(perfil) {
    const box = document.getElementById('userRoleDescriptionBox');
    if (!box) return;

    if (perfil === 'ADMIN') {
      box.style.background = '#FDF2F8';
      box.style.borderColor = '#FBCFE8';
      box.style.color = '#9D174D';
      box.innerHTML = '<i class="fa-solid fa-crown"></i> <strong>Administrador (ADM):</strong> Acesso total e irrestrito. Único que aprova propostas comerciais, gerencia outros operadores e ajusta taxas financeiras.';
    } else if (perfil === 'REPRESENTANTE') {
      box.style.background = '#EFF6FF';
      box.style.borderColor = '#BFDBFE';
      box.style.color = '#1E40AF';
      box.innerHTML = '<i class="fa-solid fa-handshake"></i> <strong>Representante Comercial:</strong> Cadastra parceiros, eventos esportivos, categorias e gerencia inscrições. Não aprova propostas.';
    } else if (perfil === 'CONSULTOR') {
      box.style.background = '#F0FDF4';
      box.style.borderColor = '#BBF7D0';
      box.style.color = '#166534';
      box.innerHTML = '<i class="fa-solid fa-hotel"></i> <strong>Consultor de Viagens:</strong> Cadastra e gerencia a curadoria de hotéis, cria propostas/cotações e gerencia reservas de atletas.';
    } else if (perfil === 'PARCEIRO') {
      box.style.background = '#FFFBEB';
      box.style.borderColor = '#FDE68A';
      box.style.color = '#B45309';
      box.innerHTML = '<i class="fa-solid fa-handshake-simple"></i> <strong>Parceiro / Organizador:</strong> Acesso focado na visualização dos seus eventos esportivos cadastrados, extratos financeiros e relatório de atletas inscritos.';
    }

    // Sincronizar visual dos cards de seleção de perfil
    document.querySelectorAll('.role-card-option').forEach(card => {
      const cardRole = card.getAttribute('data-role');
      if (cardRole === perfil) {
        card.className = `role-card-option selected-role-${perfil}`;
      } else {
        card.className = 'role-card-option';
      }
    });
  },

  selectUserRoleInModal(role) {
    const select = document.getElementById('userPerfil');
    if (select) {
      select.value = role;
      this.updateUserRoleHelpText(role);
    }
  },

  async handleSaveUser(event) {
    if (event) event.preventDefault();
    if (this._isSavingUser) return;
    this._isSavingUser = true;

    const id = document.getElementById('userFormId').value;
    const nome = document.getElementById('userNome').value.trim();
    const email = document.getElementById('userEmail').value.trim();
    const senha = document.getElementById('userSenha').value;
    const perfil = document.getElementById('userPerfil').value;
    const cargo = document.getElementById('userCargo').value.trim();
    const avatar_url = document.getElementById('userAvatarUrl').value.trim();
    const ativo = document.getElementById('userAtivo').checked;

    if (!nome || !email || !perfil) {
      this.showToast('Preencha os campos obrigatórios (Nome, Email e Perfil).', 'error');
      this._isSavingUser = false;
      return;
    }

    if (!id && (!senha || senha.length < 4)) {
      this.showToast('A senha do novo operador deve conter pelo menos 4 caracteres.', 'error');
      this._isSavingUser = false;
      return;
    }

    const payload = {
      nome,
      email,
      perfil,
      cargo,
      avatar_url,
      ativo,
    };

    if (senha && senha.trim()) {
      payload.senha = senha.trim();
    }

    const saveBtn = document.getElementById('btnSaveUserSubmit');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
    }

    try {
      const url = id ? `/api/auth/users/${id}` : '/api/auth/users';
      const method = id ? 'PUT' : 'POST';

      const res = await this.apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (json.success) {
        this.showToast(json.message || 'Operador salvo com sucesso!', 'success');
        this.closeModal('userFormModal');
        await this.fetchUsers();

        // Se o operador editou o próprio perfil, atualizar topbar e state
        if (id && this.state.currentUser && String(this.state.currentUser.id) === String(id)) {
          this.state.currentUser = { ...this.state.currentUser, ...json.data };
          localStorage.setItem('unyco_auth_user', JSON.stringify(this.state.currentUser));
          this.applyPermissions();
        }
      } else {
        this.showToast(json.message || 'Erro ao salvar operador', 'error');
      }
    } catch (err) {
      console.error('Erro ao salvar operador:', err);
      this.showToast('Erro de comunicação com o servidor.', 'error');
    } finally {
      this._isSavingUser = false;
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar Operador';
      }
    }
  },

  async deleteUser(id) {
    if (id === 1) {
      this.showToast('O Administrador Principal (ID 1) não pode ser excluído.', 'error');
      return;
    }

    const u = this.state.usersList?.find(item => item.id === id);
    const name = u ? u.nome : 'este operador';

    if (!confirm(`Deseja realmente excluir o operador "${name}"?\nEsta ação removerá o acesso dele à plataforma.`)) {
      return;
    }

    try {
      const res = await this.apiFetch(`/api/auth/users/${id}`, { method: 'DELETE' });
      const json = await res.json();

      if (json.success) {
        this.showToast('Operador excluído com sucesso.', 'success');
        await this.fetchUsers();
      } else {
        this.showToast(json.message || 'Erro ao excluir operador', 'error');
      }
    } catch (err) {
      console.error('Erro ao excluir operador:', err);
      this.showToast('Erro de comunicação com o servidor.', 'error');
    }
  },

  // Atualizar preview visual do avatar a partir da URL
  updateUserAvatarPreviewFromUrl(url) {
    const preview = document.getElementById('userAvatarPreview');
    const badge = document.getElementById('userAvatarStatusBadge');
    if (!preview) return;

    const defaultImg = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
    const targetUrl = (url && url.trim()) ? this.urlWithBase(url.trim()) : defaultImg;
    preview.src = targetUrl;

    if (badge) {
      if (url && (url.startsWith('/uploads') || url.startsWith('data:image'))) {
        badge.textContent = 'Arquivo do Computador';
        badge.style.background = '#DCFCE7';
        badge.style.color = '#166534';
      } else if (url && url.startsWith('http')) {
        badge.textContent = 'URL Externa';
        badge.style.background = '#EFF6FF';
        badge.style.color = '#1D4ED8';
      } else {
        badge.textContent = 'Avatar Padrão';
        badge.style.background = '#F1F5F9';
        badge.style.color = '#64748B';
      }
    }
  },

  // Processar arquivo de foto selecionado a partir do computador
  async handleUserAvatarFileUpload(event) {
    const file = event.target?.files?.[0];
    if (!file) return;

    // Validação de tipo de arquivo
    if (!file.type.startsWith('image/')) {
      this.showToast('Por favor selecione um arquivo de imagem válido (PNG, JPG, WebP ou GIF).', 'error');
      event.target.value = '';
      return;
    }

    // Validação de tamanho (máximo 8MB)
    const maxBytes = 8 * 1024 * 1024;
    if (file.size > maxBytes) {
      this.showToast('A imagem selecionada excede o limite máximo de 8MB.', 'error');
      event.target.value = '';
      return;
    }

    const uploadBtn = document.getElementById('btnUploadUserAvatar');
    const preview = document.getElementById('userAvatarPreview');
    const badge = document.getElementById('userAvatarStatusBadge');
    const urlInput = document.getElementById('userAvatarUrl');

    if (uploadBtn) {
      uploadBtn.disabled = true;
      uploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
    }

    const reader = new FileReader();

    reader.onload = async (e) => {
      const dataUrl = e.target.result;

      // Exibir preview imediato na interface
      if (preview) preview.src = dataUrl;

      try {
        // Enviar imagem ao endpoint /api/upload para salvar no servidor
        const res = await this.apiFetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: dataUrl,
            filename: file.name,
            folder: 'avatars'
          })
        });

        const json = await res.json();

        if (json.success && json.url) {
          if (urlInput) urlInput.value = json.url;
          if (preview) preview.src = this.urlWithBase(json.url);
          if (badge) {
            badge.textContent = 'Arquivo do Computador';
            badge.style.background = '#DCFCE7';
            badge.style.color = '#166534';
          }
          this.showToast('Foto do computador carregada com sucesso!', 'success');
        } else {
          // Fallback para Base64 direto no campo
          if (urlInput) urlInput.value = dataUrl;
          if (badge) {
            badge.textContent = 'Imagem Local';
            badge.style.background = '#FEF3C7';
            badge.style.color = '#B45309';
          }
          this.showToast('Imagem carregada com sucesso!', 'info');
        }
      } catch (err) {
        console.warn('Fallback para Base64 local:', err);
        if (urlInput) urlInput.value = dataUrl;
        this.showToast('Imagem carregada localmente!', 'info');
      } finally {
        if (uploadBtn) {
          uploadBtn.disabled = false;
          uploadBtn.innerHTML = '<i class="fa-solid fa-upload"></i> Carregar do Computador';
        }
        event.target.value = '';
      }
    };

    reader.onerror = () => {
      this.showToast('Erro ao ler arquivo de imagem do computador.', 'error');
      if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="fa-solid fa-upload"></i> Carregar do Computador';
      }
      event.target.value = '';
    };

    reader.readAsDataURL(file);
  },

  // Remover foto / reverter para avatar padrão
  removeUserAvatar() {
    const defaultAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
    const input = document.getElementById('userAvatarUrl');
    const fileInput = document.getElementById('userAvatarFileInput');
    if (input) input.value = '';
    if (fileInput) fileInput.value = '';
    this.updateUserAvatarPreviewFromUrl(defaultAvatar);
    this.showToast('Foto removida. Utilizando avatar padrão.', 'info');
  },

  // ==========================================================
  // HELPERS DE UPLOAD DE LOGO DO PARCEIRO
  // ==========================================================
  updatePartnerLogoPreviewFromUrl(url) {
    const preview = document.getElementById('partnerLogoPreview');
    const badge = document.getElementById('partnerLogoStatusBadge');
    if (!preview) return;

    const defaultImg = 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=150';
    const targetUrl = (url && url.trim()) ? this.urlWithBase(url.trim()) : defaultImg;
    preview.src = targetUrl;

    if (badge) {
      if (url && (url.startsWith('/uploads') || url.startsWith('data:image'))) {
        badge.textContent = 'Arquivo do Computador';
        badge.style.background = '#DCFCE7';
        badge.style.color = '#166534';
      } else if (url && url.startsWith('http')) {
        badge.textContent = 'URL Externa';
        badge.style.background = '#EFF6FF';
        badge.style.color = '#1D4ED8';
      } else {
        badge.textContent = 'Logo Padrão';
        badge.style.background = '#F1F5F9';
        badge.style.color = '#64748B';
      }
    }
  },

  async handlePartnerLogoFileUpload(event) {
    const file = event.target?.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.showToast('Por favor selecione um arquivo de imagem válido (PNG, JPG, SVG ou WebP).', 'error');
      event.target.value = '';
      return;
    }

    const maxBytes = 8 * 1024 * 1024;
    if (file.size > maxBytes) {
      this.showToast('A imagem selecionada excede o limite máximo de 8MB.', 'error');
      event.target.value = '';
      return;
    }

    const uploadBtn = document.getElementById('btnUploadPartnerLogo');
    const preview = document.getElementById('partnerLogoPreview');
    const badge = document.getElementById('partnerLogoStatusBadge');
    const urlInput = document.getElementById('partnerLogoUrl');

    if (uploadBtn) {
      uploadBtn.disabled = true;
      uploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
    }

    const reader = new FileReader();

    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      if (preview) preview.src = dataUrl;

      try {
        const res = await this.apiFetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: dataUrl,
            filename: file.name,
            folder: 'partners'
          })
        });

        const json = await res.json();

        if (json.success && json.url) {
          if (urlInput) urlInput.value = json.url;
          if (preview) preview.src = this.urlWithBase(json.url);
          if (badge) {
            badge.textContent = 'Arquivo do Computador';
            badge.style.background = '#DCFCE7';
            badge.style.color = '#166534';
          }
          this.showToast('Logo do parceiro carregado com sucesso!', 'success');
        } else {
          if (urlInput) urlInput.value = dataUrl;
          if (badge) {
            badge.textContent = 'Imagem Local';
            badge.style.background = '#FEF3C7';
            badge.style.color = '#B45309';
          }
          this.showToast('Logo carregado com sucesso!', 'info');
        }
      } catch (err) {
        console.warn('Fallback para Base64 local:', err);
        if (urlInput) urlInput.value = dataUrl;
        this.showToast('Logo carregado localmente!', 'info');
      } finally {
        if (uploadBtn) {
          uploadBtn.disabled = false;
          uploadBtn.innerHTML = '<i class="fa-solid fa-upload"></i> Carregar do Computador';
        }
        event.target.value = '';
      }
    };

    reader.onerror = () => {
      this.showToast('Erro ao ler arquivo do computador.', 'error');
      if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="fa-solid fa-upload"></i> Carregar do Computador';
      }
      event.target.value = '';
    };

    reader.readAsDataURL(file);
  },

  removePartnerLogo() {
    const defaultLogo = 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=150';
    const input = document.getElementById('partnerLogoUrl');
    const fileInput = document.getElementById('partnerLogoFileInput');
    if (input) input.value = '';
    if (fileInput) fileInput.value = '';
    this.updatePartnerLogoPreviewFromUrl(defaultLogo);
    this.showToast('Logo removido. Utilizando padrão.', 'info');
  },

  // ==========================================================
  // HELPERS DE UPLOAD DE BANNER DO EVENTO
  // ==========================================================
  updateEventBannerPreviewFromUrl(url) {
    const preview = document.getElementById('eventBannerPreview');
    const badge = document.getElementById('eventBannerStatusBadge');
    if (!preview) return;

    const defaultImg = 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=600';
    const targetUrl = (url && url.trim()) ? this.urlWithBase(url.trim()) : defaultImg;
    preview.src = targetUrl;

    if (badge) {
      if (url && (url.startsWith('/uploads') || url.startsWith('data:image'))) {
        badge.textContent = 'Arquivo do Computador';
        badge.style.background = '#DCFCE7';
        badge.style.color = '#166534';
      } else if (url && url.startsWith('http')) {
        badge.textContent = 'URL Externa';
        badge.style.background = '#EFF6FF';
        badge.style.color = '#1D4ED8';
      } else {
        badge.textContent = 'Banner Padrão';
        badge.style.background = '#F1F5F9';
        badge.style.color = '#64748B';
      }
    }
  },

  async handleEventBannerFileUpload(event) {
    const file = event.target?.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.showToast('Por favor selecione um arquivo de imagem válido (PNG, JPG ou WebP).', 'error');
      event.target.value = '';
      return;
    }

    const maxBytes = 8 * 1024 * 1024;
    if (file.size > maxBytes) {
      this.showToast('A imagem selecionada excede o limite máximo de 8MB.', 'error');
      event.target.value = '';
      return;
    }

    const uploadBtn = document.getElementById('btnUploadEventBanner');
    const preview = document.getElementById('eventBannerPreview');
    const badge = document.getElementById('eventBannerStatusBadge');
    const urlInput = document.getElementById('eventBannerUrl');

    if (uploadBtn) {
      uploadBtn.disabled = true;
      uploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
    }

    const reader = new FileReader();

    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      if (preview) preview.src = dataUrl;

      try {
        const res = await this.apiFetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: dataUrl,
            filename: file.name,
            folder: 'events'
          })
        });

        const json = await res.json();

        if (json.success && json.url) {
          if (urlInput) urlInput.value = json.url;
          if (preview) preview.src = this.urlWithBase(json.url);
          if (badge) {
            badge.textContent = 'Arquivo do Computador';
            badge.style.background = '#DCFCE7';
            badge.style.color = '#166534';
          }
          this.showToast('Banner do evento carregado com sucesso!', 'success');
        } else {
          if (urlInput) urlInput.value = dataUrl;
          if (badge) {
            badge.textContent = 'Imagem Local';
            badge.style.background = '#FEF3C7';
            badge.style.color = '#B45309';
          }
          this.showToast('Banner carregado com sucesso!', 'info');
        }
      } catch (err) {
        console.warn('Fallback para Base64 local:', err);
        if (urlInput) urlInput.value = dataUrl;
        this.showToast('Banner carregado localmente!', 'info');
      } finally {
        if (uploadBtn) {
          uploadBtn.disabled = false;
          uploadBtn.innerHTML = '<i class="fa-solid fa-upload"></i> Carregar do Computador';
        }
        event.target.value = '';
      }
    };

    reader.onerror = () => {
      this.showToast('Erro ao ler arquivo do computador.', 'error');
      if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="fa-solid fa-upload"></i> Carregar do Computador';
      }
      event.target.value = '';
    };

    reader.readAsDataURL(file);
  },

  removeEventBanner() {
    const defaultBanner = 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=600';
    const input = document.getElementById('eventBannerUrl');
    const fileInput = document.getElementById('eventBannerFileInput');
    if (input) input.value = '';
    if (fileInput) fileInput.value = '';
    this.updateEventBannerPreviewFromUrl(defaultBanner);
    this.showToast('Banner removido. Utilizando imagem padrão.', 'info');
  },

  // Troca de Abas
  switchTab(tabName) {
    this.state.currentTab = tabName;

    // Atualizar botões de navegação
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-tab') === tabName);
    });

    // Atualizar seções de conteúdo
    document.querySelectorAll('.tab-content').forEach(section => {
      section.classList.toggle('active', section.id === `tab-${tabName}`);
    });

    // Atualizar título do Topbar
    const pageTitle = document.getElementById('pageTitle');
    const pageDesc = document.getElementById('pageDescription');

    if (tabName === 'dashboard') {
      pageTitle.textContent = 'Painel Geral';
      pageDesc.textContent = 'Visão consolidada de parceiros, eventos e propostas comerciais';
      this.loadDashboardStats();
    } else if (tabName === 'partners') {
      pageTitle.textContent = 'Gestão de Parceiros';
      pageDesc.textContent = 'Clubes, federações, arenas e patrocinadores realizadores de eventos';
      this.renderPartners();
    } else if (tabName === 'events') {
      pageTitle.textContent = 'Eventos Esportivos & Inscrições';
      pageDesc.textContent = 'Calendário esportivo, landing pages de inscrição e participantes';
      this.renderEvents();
    } else if (tabName === 'proposals') {
      pageTitle.textContent = 'Propostas de Parceria Comercial';
      pageDesc.textContent = 'Elaboração, negociação e acompanhamento de contratos com parceiros';
      this.renderProposals();
    } else if (tabName === 'categories') {
      pageTitle.textContent = 'Categorias de Eventos';
      pageDesc.textContent = 'Gerenciamento de categorias esportivas, torneios e modalidades';
      this.renderCategories();
    } else if (tabName === 'earnings') {
      pageTitle.textContent = 'Ganhos por Parceria & Curadoria de Hotéis';
      pageDesc.textContent = 'Repasse financeiro aos parceiros por inscrições e reservas de hotel dos atletas e familiares';
      this.loadEarningsData();
      this.loadHotelsData();
      this.loadHotelLeadsData();
    } else if (tabName === 'settings' || tabName === 'users') {
      pageTitle.textContent = 'Configurações & Gestão de Usuários';
      pageDesc.textContent = 'Gestão de operadores, parceiros, credenciais de acesso e controle de permissões (RBAC)';
      this.fetchUsers();
    }
  },

  // Troca de Sub-abas no Módulo de Ganhos
  switchEarningsSubtab(subtabName) {
    this.state.currentEarningsSubtab = subtabName;

    document.querySelectorAll('.sub-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.id === `btnSubtab${subtabName.charAt(0).toUpperCase() + subtabName.slice(1)}`);
    });

    document.querySelectorAll('.earnings-subtab-view').forEach(view => {
      view.style.display = view.id === `subtab-view-${subtabName}` ? 'block' : 'none';
    });

    if (subtabName === 'partners') this.loadEarningsData();
    if (subtabName === 'hotels') this.loadHotelsData();
    if (subtabName === 'leads') this.loadHotelLeadsData();
  },

  // Recarregar todos os dados da API
  async refreshAll(showFeedback = false) {
    await Promise.all([
      this.loadDashboardStats(),
      this.fetchPartners(),
      this.fetchCategories(),
      this.fetchEvents(),
      this.fetchProposals(),
      this.fetchEarnings(),
      this.fetchHotels(),
      this.fetchHotelLeads(),
      this.fetchUsers(),
    ]);

    this.populateDropdowns();

    if (showFeedback) {
      this.showToast('Dados atualizados com sucesso!', 'info');
    }
  },

  // ==========================================================
  // REQUISIÇÕES DE API
  // ==========================================================
  async fetchPartners() {
    try {
      const res = await this.apiFetch('/api/partners');
      const json = await res.json();
      if (json.success) {
        this.state.partners = json.data;
        document.getElementById('badgePartnersCount').textContent = json.count;
        this.renderPartners();
      }
    } catch (err) {
      console.error('Erro ao buscar parceiros:', err);
    }
  },

  async fetchCategories() {
    try {
      const res = await this.apiFetch('/api/categories');
      const json = await res.json();
      if (json.success) {
        this.state.categories = json.data;
        const badge = document.getElementById('badgeCategoriesCount');
        if (badge) badge.textContent = json.count;
        this.renderCategories();
      }
    } catch (err) {
      console.error('Erro ao buscar categorias:', err);
    }
  },

  async fetchEvents() {
    try {
      const res = await this.apiFetch('/api/events');
      const json = await res.json();
      if (json.success) {
        this.state.events = json.data;
        document.getElementById('badgeEventsCount').textContent = json.count;
        this.renderEvents();
      }
    } catch (err) {
      console.error('Erro ao buscar eventos:', err);
    }
  },

  async fetchProposals() {
    try {
      const res = await this.apiFetch('/api/proposals');
      const json = await res.json();
      if (json.success) {
        this.state.proposals = json.data;
        const badge = document.getElementById('badgeProposalsCount');
        if (badge) badge.textContent = json.count;
        this.renderProposals();
      }
    } catch (err) {
      console.error('Erro ao buscar propostas:', err);
    }
  },

  async loadDashboardStats() {
    try {
      const res = await this.apiFetch('/api/stats');
      const json = await res.json();
      if (json.success) {
        this.state.stats = json.data;
        this.renderDashboardStats();
      }
    } catch (err) {
      console.error('Erro ao buscar estatísticas:', err);
    }
  },

  // ==========================================================
  // RENDERIZAÇÃO DO DASHBOARD
  // ==========================================================
  renderDashboardStats() {
    const stats = this.state.stats;
    if (!stats) return;

    const totals = stats.totals || {};
    document.getElementById('kpiTotalPartners').textContent = totals.total_parceiros || 0;
    document.getElementById('kpiActivePartners').textContent = `${totals.parceiros_ativos || 0} parceiros ativos`;

    document.getElementById('kpiScheduledEvents').textContent = totals.eventos_agendados || 0;
    document.getElementById('kpiOngoingEvents').textContent = `${totals.eventos_em_andamento || 0} em andamento`;

    // Calcular pipeline de propostas
    const activeProposals = this.state.proposals.filter(p => p.status === 'Em Negociação' || p.status === 'Enviada');
    const totalVolume = activeProposals.reduce((sum, p) => sum + parseFloat(p.valor_proposta || 0), 0);
    document.getElementById('kpiTotalProposals').textContent = activeProposals.length;
    document.getElementById('kpiProposalsVolume').textContent = `R$ ${totalVolume.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em pipeline`;

    document.getElementById('kpiTotalCapacity').textContent = (parseInt(totals.capacidade_total_atletas || 0)).toLocaleString('pt-BR');

    // Próximos Eventos
    const upcomingContainer = document.getElementById('upcomingEventsList');
    if (!stats.upcomingEvents || stats.upcomingEvents.length === 0) {
      upcomingContainer.innerHTML = `<div class="empty-state-loading">Nenhum evento agendado no momento.</div>`;
    } else {
      upcomingContainer.innerHTML = stats.upcomingEvents.map(ev => {
        const dateObj = new Date(ev.data_inicio);
        const day = dateObj.getDate().toString().padStart(2, '0');
        const month = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
        const time = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        return `
          <div class="upcoming-item" onclick="app.viewPartnerDetails(${ev.parceiro_id})">
            <div class="event-date-badge">
              <span class="event-date-day">${day}</span>
              <span class="event-date-month">${month}</span>
            </div>
            <div class="upcoming-info">
              <h4 class="upcoming-title">${this.escapeHtml(ev.nome)}</h4>
              <div class="upcoming-meta">
                <span class="upcoming-partner-tag"><i class="fa-solid fa-handshake"></i> ${this.escapeHtml(ev.parceiro_nome)}</span>
                <span><i class="fa-solid fa-location-dot"></i> ${this.escapeHtml(ev.local)}</span>
                <span><i class="fa-regular fa-clock"></i> ${time}</span>
              </div>
            </div>
            <span class="modality-pill"><i class="fa-solid fa-trophy"></i> ${this.escapeHtml(ev.modalidade)}</span>
          </div>
        `;
      }).join('');
    }

    // Nuvem de Modalidades
    const modalitiesContainer = document.getElementById('modalitiesTagCloud');
    if (!stats.modalities || stats.modalities.length === 0) {
      modalitiesContainer.innerHTML = `<span style="color: var(--text-dim); font-size: 12px;">Nenhuma modalidade cadastrada.</span>`;
    } else {
      modalitiesContainer.innerHTML = stats.modalities.map(m => `
        <div class="modality-pill">
          <span>${this.escapeHtml(m.modalidade)}</span>
          <span class="modality-count">${m.total}</span>
        </div>
      `).join('');
    }

    // Top Parceiros
    const topPartnersContainer = document.getElementById('topPartnersList');
    if (!stats.topPartners || stats.topPartners.length === 0) {
      topPartnersContainer.innerHTML = `<span style="color: var(--text-dim); font-size: 12px;">Nenhum parceiro cadastrado.</span>`;
    } else {
      topPartnersContainer.innerHTML = stats.topPartners.map(p => `
        <div class="top-partner-row" onclick="app.viewPartnerDetails(${p.id})" style="cursor: pointer;">
          <div class="top-partner-info">
            <img class="partner-mini-logo" src="${p.logo_url || 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=100'}" alt="${this.escapeHtml(p.nome_fantasia)}" onerror="this.src='https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=100'">
            <div>
              <div class="top-partner-name">${this.escapeHtml(p.nome_fantasia)}</div>
              <div class="top-partner-cat">${this.escapeHtml(p.categoria || 'Parceiro')}</div>
            </div>
          </div>
          <span class="events-counter-badge">${p.total_eventos} evento${p.total_eventos === 1 ? '' : 's'}</span>
        </div>
      `).join('');
    }
  },

  // ==========================================================
  // RENDERIZAÇÃO DE PARCEIROS
  // ==========================================================
  renderPartners() {
    const container = document.getElementById('partnersContainer');
    const search = document.getElementById('partnerSearchInput')?.value.toLowerCase().trim() || '';
    const statusFilter = document.getElementById('partnerStatusFilter')?.value || '';

    let list = this.state.partners;

    if (statusFilter) {
      list = list.filter(p => p.status === statusFilter);
    }

    if (search) {
      list = list.filter(p => 
        (p.nome_fantasia && p.nome_fantasia.toLowerCase().includes(search)) ||
        (p.cnpj && p.cnpj.toLowerCase().includes(search)) ||
        (p.email && p.email.toLowerCase().includes(search)) ||
        (p.categoria && p.categoria.toLowerCase().includes(search))
      );
    }

    if (list.length === 0) {
      container.innerHTML = `
        <div class="empty-state-loading">
          <i class="fa-solid fa-folder-open" style="font-size: 32px; margin-bottom: 12px; display: block; color: var(--text-dim);"></i>
          Nenhum parceiro encontrado com os filtros selecionados.
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(p => `
      <div class="partner-card">
        <div class="partner-card-header">
          <img class="partner-logo-img" src="${p.logo_url || 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=150'}" alt="${this.escapeHtml(p.nome_fantasia)}" onerror="this.src='https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=150'">
          <div class="partner-title-wrap">
            <h3 class="partner-name">${this.escapeHtml(p.nome_fantasia)}</h3>
            <span class="partner-category-badge">${this.escapeHtml(p.categoria || 'Clube')}</span>
          </div>
          <span class="partner-status-tag ${p.status}">${p.status === 'ativo' ? 'Ativo' : 'Inativo'}</span>
        </div>

        <div class="partner-details-list">
          ${p.cnpj ? `<div class="partner-detail-item"><i class="fa-solid fa-id-card"></i> <span>CNPJ: ${this.escapeHtml(p.cnpj)}</span></div>` : ''}
          ${p.email ? `<div class="partner-detail-item"><i class="fa-solid fa-envelope"></i> <span>${this.escapeHtml(p.email)}</span></div>` : ''}
          ${p.telefone ? `<div class="partner-detail-item"><i class="fa-solid fa-phone"></i> <span>${this.escapeHtml(p.telefone)}</span></div>` : ''}
          ${p.responsavel ? `<div class="partner-detail-item"><i class="fa-solid fa-user-tie"></i> <span>Resp: ${this.escapeHtml(p.responsavel)}</span></div>` : ''}
        </div>

        <!-- Botões: Carteira do Parceiro & Monitoramento de Alunos -->
        <div style="display: flex; gap: 6px; margin: 12px 0 6px 0; flex-wrap: wrap;">
          <button class="btn btn-sm btn-primary flex-1" onclick="app.copyPartnerWalletLink(${p.id})" title="Copiar Link da Carteira para alunos e atletas">
            <i class="fa-solid fa-wallet"></i> Link da Carteira
          </button>
          <a href="${this.getPartnerWalletUrl(p.id)}" target="_blank" class="btn btn-sm btn-secondary" title="Abrir Carteira Pública de Inscrição">
            <i class="fa-solid fa-arrow-up-right-from-square"></i>
          </a>
          <button class="btn btn-sm btn-outline" style="border-color: #86EFAC; color: #16A34A;" onclick="app.sharePartnerWalletWhatsApp(${p.id})" title="Compartilhar Carteira no WhatsApp com alunos e atletas">
            <i class="fa-brands fa-whatsapp"></i> WhatsApp
          </button>
        </div>

        <button class="btn btn-sm" style="width: 100%; margin-bottom: 12px; background: #EFF6FF; border: 1px solid #BFDBFE; color: #1D4ED8; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 6px 10px; border-radius: var(--radius-sm);" onclick="app.openPartnerWalletModal(${p.id})" title="Monitorar Alunos e Indicações deste Parceiro">
          <i class="fa-solid fa-user-graduate"></i> Alunos na Carteira: <strong>${p.total_alunos_carteira || 0} alunos</strong>
        </button>

        <div class="partner-card-footer">
          <button class="btn btn-sm btn-outline" onclick="app.viewPartnerDetails(${p.id})">
            <i class="fa-solid fa-calendar-days"></i> Ver Eventos (${p.total_eventos || 0})
          </button>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-sm btn-secondary" onclick="app.openCreateProposalModal(${p.id})" title="Criar Proposta Comercial para este Parceiro">
              <i class="fa-solid fa-file-signature"></i>
            </button>
            <button class="btn btn-sm btn-secondary" onclick="app.openEditPartnerModal(${p.id})" title="Editar Parceiro">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="app.deletePartner(${p.id})" title="Excluir Parceiro">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `).join('');
  },

  // ==========================================================
  // RENDERIZAÇÃO DE EVENTOS
  // ==========================================================
  renderEvents() {
    const container = document.getElementById('eventsContainer');
    const search = document.getElementById('eventSearchInput')?.value.toLowerCase().trim() || '';
    const categoryFilter = document.getElementById('eventCategoryFilter')?.value || '';
    const partnerFilter = document.getElementById('eventPartnerFilter')?.value || '';
    const statusFilter = document.getElementById('eventStatusFilter')?.value || '';

    let list = this.state.events;

    if (categoryFilter) {
      list = list.filter(e => e.categoria_id == categoryFilter);
    }

    if (partnerFilter) {
      list = list.filter(e => e.parceiro_id == partnerFilter);
    }

    if (statusFilter) {
      list = list.filter(e => e.status === statusFilter);
    }

    if (search) {
      list = list.filter(e => 
        (e.nome && e.nome.toLowerCase().includes(search)) ||
        (e.local && e.local.toLowerCase().includes(search)) ||
        (e.parceiro_nome && e.parceiro_nome.toLowerCase().includes(search)) ||
        (e.modalidade && e.modalidade.toLowerCase().includes(search)) ||
        (e.categoria_nome && e.categoria_nome.toLowerCase().includes(search))
      );
    }

    if (list.length === 0) {
      container.innerHTML = `
        <div class="empty-state-loading">
          <i class="fa-solid fa-calendar-xmark" style="font-size: 32px; margin-bottom: 12px; display: block; color: var(--text-dim);"></i>
          Nenhum evento encontrado com os filtros selecionados.
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(e => {
      const dateObj = new Date(e.data_inicio);
      const formattedDate = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const formattedTime = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      const statusClass = e.status === 'Agendado' ? 'status-agendado' :
                          e.status === 'Em Andamento' ? 'status-emandamento' :
                          e.status === 'Concluído' ? 'status-concluido' : 'status-cancelado';

      const banner = e.banner_url || 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=600&auto=format&fit=crop&q=80';
      const categoryColor = e.categoria_cor || '#0284C7';
      const categoryIcon = e.categoria_icone || 'fa-trophy';
      const totalInscritos = e.total_inscritos || 0;

      return `
        <div class="event-card">
          <div class="event-banner-wrap">
            <img class="event-banner-img" src="${banner}" alt="${this.escapeHtml(e.nome)}" onerror="this.src='https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=600'">
            ${e.categoria_nome ? `
              <span class="event-category-badge" style="background: ${categoryColor};">
                <i class="fa-solid ${categoryIcon}"></i> ${this.escapeHtml(e.categoria_nome)}
              </span>
            ` : ''}
            <span class="event-status-badge ${statusClass}">${e.status}</span>
            <span class="event-modality-badge"><i class="fa-solid fa-medal"></i> ${this.escapeHtml(e.modalidade)}</span>
          </div>

          <div class="event-content">
            <div class="event-partner-info" onclick="app.viewPartnerDetails(${e.parceiro_id})" style="cursor: pointer;">
              <img class="event-partner-avatar" src="${e.parceiro_logo || 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=50'}" alt="${this.escapeHtml(e.parceiro_nome)}" onerror="this.src='https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=50'">
              <span class="event-partner-title">${this.escapeHtml(e.parceiro_nome)}</span>
            </div>

            <h3 class="event-title">${this.escapeHtml(e.nome)}</h3>

            <div class="event-meta-grid">
              <div class="event-meta-item">
                <i class="fa-regular fa-calendar"></i>
                <span>${formattedDate} às ${formattedTime}</span>
              </div>
              <div class="event-meta-item">
                <i class="fa-solid fa-location-dot"></i>
                <span title="${this.escapeHtml(e.local)}">${this.escapeHtml(e.cidade || 'SP')} - ${this.escapeHtml(e.local)}</span>
              </div>
              <div class="event-meta-item">
                <i class="fa-solid fa-users"></i>
                <span>${totalInscritos} / ${e.capacidade || 0} inscritos</span>
              </div>
              <div class="event-meta-item">
                <i class="fa-solid fa-ticket"></i>
                <span>${parseFloat(e.valor_inscricao) > 0 ? `R$ ${parseFloat(e.valor_inscricao).toFixed(2).replace('.', ',')}` : 'Gratuito'}</span>
              </div>
            </div>

            <!-- Botões Rápidos de Landing Page, Inscritos e Hotéis -->
            <div style="display: flex; gap: 6px; margin-bottom: 14px; flex-wrap: wrap;">
              <button class="btn btn-sm btn-primary flex-1" onclick="app.copyLPLink(${e.id})" title="Copiar link público para inscrições">
                <i class="fa-solid fa-link"></i> Link da LP
              </button>
              <a href="/lp.html?id=${e.id}" target="_blank" class="btn btn-sm btn-secondary" title="Abrir página pública de inscrição">
                <i class="fa-solid fa-arrow-up-right-from-square"></i>
              </a>
              <button class="btn btn-sm btn-outline flex-1" onclick="app.viewEventRegistrations(${e.id})" title="Ver lista de inscritos">
                <i class="fa-solid fa-users-viewfinder"></i> Inscritos (${totalInscritos})
              </button>
              <button class="btn btn-sm btn-secondary" onclick="app.openLinkHotelsModal(${e.id})" title="Vincular Hotéis da Curadoria ao Evento">
                <i class="fa-solid fa-hotel"></i> Hotéis
              </button>
            </div>

            <div class="event-actions">
              <button class="btn btn-sm btn-secondary" onclick="app.viewPartnerDetails(${e.parceiro_id})">
                <i class="fa-solid fa-building"></i> Ficha Parceiro
              </button>
              <div style="display: flex; gap: 6px;">
                <button class="btn btn-sm btn-secondary" onclick="app.openEditEventModal(${e.id})" title="Editar Evento">
                  <i class="fa-solid fa-pen"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="app.deleteEvent(${e.id})" title="Excluir Evento">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  // Retorna a URL da Landing Page do evento
  getEventLPUrl(eventId) {
    const origin = window.location.origin;
    let base = window.BASE_PATH;
    if (!base && typeof window !== 'undefined' && window.location && window.location.pathname.includes('/unycoeventos')) {
      base = '/unycoeventos';
    }
    base = (base || '').replace(/\/$/, '');
    return `${origin}${base}/lp.html?id=${eventId}`;
  },

  // Copiar link da LP do evento
  copyLPLink(eventId) {
    const url = this.getEventLPUrl(eventId);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        this.showToast(`Link da LP copiado com sucesso!\n${url}`, 'success');
      }).catch(() => {
        prompt('Copie o link abaixo:', url);
      });
    } else {
      prompt('Copie o link abaixo:', url);
    }
  },

  // Retorna a URL da Carteira oficial do parceiro / academia
  getPartnerWalletUrl(partnerId) {
    const origin = window.location.origin;
    let base = window.BASE_PATH;
    if (!base && typeof window !== 'undefined' && window.location && window.location.pathname.includes('/unycoeventos')) {
      base = '/unycoeventos';
    }
    base = (base || '').replace(/\/$/, '');
    return `${origin}${base}/lp.html?carteira=${partnerId}`;
  },

  // Alias retrocompatível
  getPartnerLPUrl(partnerId) {
    return this.getPartnerWalletUrl(partnerId);
  },

  // Copiar link público da Carteira do parceiro
  copyPartnerWalletLink(partnerId) {
    const url = this.getPartnerWalletUrl(partnerId);
    const partner = this.state.partners.find(p => p.id === partnerId);
    const partnerName = partner ? partner.nome_fantasia : 'Parceiro';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        this.showToast(`Link da Carteira de ${partnerName} copiado com sucesso! Compartilhe com seus alunos e atletas.\n${url}`, 'success');
      }).catch(() => {
        prompt(`Copie o Link da Carteira de ${partnerName} para os alunos e atletas:`, url);
      });
    } else {
      prompt(`Copie o Link da Carteira de ${partnerName} para os alunos e atletas:`, url);
    }
  },

  copyPartnerLPLink(partnerId) {
    this.copyPartnerWalletLink(partnerId);
  },

  // Copiar link a partir do formulário de parceiro
  copyPartnerWalletLinkFromModal() {
    const input = document.getElementById('partnerLpUrlInput');
    const url = input ? input.value : '';
    if (!url) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        this.showToast('Link da Carteira copiado para a área de transferência!', 'success');
      }).catch(() => {
        prompt('Copie o Link da Carteira abaixo:', url);
      });
    } else {
      prompt('Copie o Link da Carteira abaixo:', url);
    }
  },

  copyPartnerLPLinkFromModal() {
    this.copyPartnerWalletLinkFromModal();
  },

  // Copiar link a partir do modal da carteira
  copyPartnerWalletLinkFromWalletModal() {
    const input = document.getElementById('walletModalLinkInput');
    const url = input ? input.value : '';
    if (!url) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        this.showToast('Link da Carteira copiado com sucesso!', 'success');
      }).catch(() => {
        prompt('Copie o Link da Carteira abaixo:', url);
      });
    } else {
      prompt('Copie o Link da Carteira abaixo:', url);
    }
  },

  // Compartilhar Carteira no WhatsApp a partir da lista
  sharePartnerWalletWhatsApp(partnerId) {
    const partner = this.state.partners.find(p => p.id === partnerId);
    const partnerName = partner ? partner.nome_fantasia : 'nossa academia';
    const url = this.getPartnerWalletUrl(partnerId);
    const msg = encodeURIComponent(`Olá alunos e atletas da ${partnerName}! 🏅\n\nAcesse nossa Carteira Oficial para inscrições em etapas esportivas e condições exclusivas:\n${url}`);
    window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
  },

  sharePartnerLpWhatsApp(partnerId) {
    this.sharePartnerWalletWhatsApp(partnerId);
  },

  // Compartilhar no WhatsApp a partir do modal de parceiro
  sharePartnerWalletWhatsAppFromModal() {
    const nome = document.getElementById('partnerNomeFantasia')?.value.trim() || 'nossa academia';
    const url = document.getElementById('partnerLpUrlInput')?.value;
    if (!url) return;
    const msg = encodeURIComponent(`Olá alunos e atletas da ${nome}! 🏅\n\nAcesse nossa Carteira Oficial para inscrições em etapas esportivas e condições exclusivas:\n${url}`);
    window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
  },

  sharePartnerLpWhatsAppFromModal() {
    this.sharePartnerWalletWhatsAppFromModal();
  },

  // Compartilhar no WhatsApp a partir do modal da carteira
  sharePartnerWalletWhatsAppFromWalletModal() {
    const nome = this.state.selectedPartnerWallet?.parceiro?.nome_fantasia || 'nossa academia';
    const url = document.getElementById('walletModalLinkInput')?.value;
    if (!url) return;
    const msg = encodeURIComponent(`Olá alunos e atletas da ${nome}! 🏅\n\nAcesse nossa Carteira Oficial para inscrições em etapas esportivas e condições exclusivas:\n${url}`);
    window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
  },

  // Abrir Modal de Monitoramento da Carteira do Parceiro
  async openPartnerWalletModal(partnerId) {
    try {
      const res = await this.apiFetch(`/api/partners/${partnerId}/wallet`);
      const json = await res.json();

      if (!json.success) {
        this.showToast('Erro ao carregar dados da carteira do parceiro.', 'error');
        return;
      }

      const parceiro = json.parceiro || json.partner || (json.data && json.data.parceiro) || {};
      const resumo = json.resumo || json.summary || (json.data && json.data.resumo) || {};
      const alunos = Array.isArray(json.data) ? json.data : (json.alunos || (json.data && json.data.alunos) || []);

      this.state.selectedPartnerWallet = { parceiro, resumo, alunos };
      this.state.walletStudentsCache = alunos;

      // Preencher Cabeçalho
      const nameEl = document.getElementById('walletModalPartnerName');
      const metaEl = document.getElementById('walletModalPartnerMeta');
      if (nameEl) nameEl.textContent = `Carteira: ${parceiro.nome_fantasia}`;
      if (metaEl) metaEl.textContent = `${parceiro.categoria || 'Parceiro'} • Monitoramento de Alunos e Inscrições Indicadas`;

      // Preencher Link da Carteira
      const walletUrl = this.getPartnerWalletUrl(parceiro.id);
      const linkInput = document.getElementById('walletModalLinkInput');
      const openBtn = document.getElementById('walletModalOpenBtn');
      if (linkInput) linkInput.value = walletUrl;
      if (openBtn) openBtn.href = walletUrl;

      // Preencher KPIs
      const kpiAlunos = document.getElementById('walletKpiTotalAlunos');
      const kpiEventos = document.getElementById('walletKpiTotalEventos');
      const kpiReceita = document.getElementById('walletKpiTotalReceita');
      const kpiComissao = document.getElementById('walletKpiTotalComissao');

      if (kpiAlunos) kpiAlunos.textContent = resumo.total_alunos || 0;
      if (kpiEventos) kpiEventos.textContent = resumo.total_eventos_distintos || 0;
      if (kpiReceita) kpiReceita.textContent = `R$ ${(resumo.total_receita_gerada || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      if (kpiComissao) kpiComissao.textContent = `R$ ${(resumo.total_comissao_acumulada || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      // Resetar campo de busca e renderizar tabela
      const searchInput = document.getElementById('walletStudentSearchInput');
      if (searchInput) searchInput.value = '';

      this.renderWalletStudentsTable(this.state.walletStudentsCache);

      this.openModal('partnerWalletModal');
    } catch (err) {
      console.error('Erro ao abrir carteira do parceiro:', err);
      this.showToast('Erro de comunicação ao carregar a carteira.', 'error');
    }
  },

  // Renderizar a tabela de alunos da carteira
  renderWalletStudentsTable(students) {
    const wrapper = document.getElementById('walletStudentsTableWrapper');
    const countEl = document.getElementById('walletStudentsCount');
    if (countEl) countEl.textContent = students ? students.length : 0;

    if (!wrapper) return;

    if (!students || students.length === 0) {
      wrapper.innerHTML = `
        <div style="padding: 36px 20px; text-align: center; color: var(--text-muted); font-size: 13px;">
          <i class="fa-solid fa-user-graduate" style="font-size: 36px; color: #CBD5E1; margin-bottom: 12px; display: block;"></i>
          <strong>Nenhum aluno ou indicação registrada nesta Carteira ainda.</strong><br>
          <span style="font-size: 12px; color: var(--text-dim); margin-top: 4px; display: block;">
            Compartilhe o Link da Carteira acima com seus alunos e atletas para que as inscrições apareçam aqui separadamente.
          </span>
        </div>
      `;
      return;
    }

    wrapper.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Aluno / Atleta</th>
            <th>Contato</th>
            <th>Evento Indicado</th>
            <th>Data Inscrição</th>
            <th>Valor Pago</th>
            <th>Comissão</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${students.map(s => {
            const dateObj = new Date(s.created_at);
            const regDate = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const valor = parseFloat(s.valor_pago || 0);
            const comissao = parseFloat(s.valor_comissao_calculada || 0);
            return `
              <tr>
                <td><strong style="font-family: monospace; color: var(--primary); font-size: 12px;">${this.escapeHtml(s.codigo_inscricao)}</strong></td>
                <td>
                  <div style="font-weight: 700; color: #0F172A;">${this.escapeHtml(s.nome_completo)}</div>
                  <small style="color: var(--text-dim);">${s.cpf ? `CPF: ${this.escapeHtml(s.cpf)}` : 'CPF não informado'}</small>
                </td>
                <td>
                  <div>${this.escapeHtml(s.email)}</div>
                  <small style="color: var(--text-dim);">${this.escapeHtml(s.telefone || '-')}</small>
                </td>
                <td>
                  <div style="font-weight: 600; color: #0284C7;">${this.escapeHtml(s.evento_nome || '-')}</div>
                  <small style="color: var(--text-dim);">${this.escapeHtml(s.evento_modalidade || '')}</small>
                </td>
                <td><span style="font-size: 12px; color: #475569;">${regDate}</span></td>
                <td>
                  <strong style="font-size: 12px; color: #0F172A;">
                    ${valor > 0 ? `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Gratuito'}
                  </strong>
                </td>
                <td>
                  <span style="font-weight: 700; color: #16A34A; font-size: 12px;">
                    R$ ${comissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <small style="display: block; font-size: 10px; color: var(--text-dim);">(${s.comissao_inscricao_pct || 0}%)</small>
                </td>
                <td>
                  <span class="partner-status-tag ativo" style="font-size: 11px;">${this.escapeHtml(s.status_pagamento || 'Confirmada')}</span>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  },

  // Filtrar alunos na carteira
  filterWalletStudents() {
    const q = document.getElementById('walletStudentSearchInput')?.value.toLowerCase().trim() || '';
    if (!this.state.walletStudentsCache) return;

    if (!q) {
      this.renderWalletStudentsTable(this.state.walletStudentsCache);
      return;
    }

    const filtered = this.state.walletStudentsCache.filter(s =>
      (s.nome_completo && s.nome_completo.toLowerCase().includes(q)) ||
      (s.cpf && s.cpf.toLowerCase().includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.telefone && s.telefone.toLowerCase().includes(q)) ||
      (s.codigo_inscricao && s.codigo_inscricao.toLowerCase().includes(q)) ||
      (s.evento_nome && s.evento_nome.toLowerCase().includes(q))
    );

    this.renderWalletStudentsTable(filtered);
  },

  // Visualizar Lista de Inscritos de um Evento
  async viewEventRegistrations(eventId) {
    try {
      const res = await this.apiFetch(`/api/events/${eventId}/registrations`);
      const json = await res.json();

      if (!json.success) {
        this.showToast('Erro ao carregar participantes do evento.', 'error');
        return;
      }

      const ev = json.evento;
      const attendees = json.data || [];
      this.state.currentEventForRegistrations = ev;

      document.getElementById('regModalEventTitle').textContent = ev.nome;
      document.getElementById('regModalEventMeta').textContent = `${ev.modalidade} • ${ev.local} (${ev.cidade || 'SP'})`;
      document.getElementById('regModalTotalCount').textContent = attendees.length;

      const statsBanner = document.getElementById('regModalStatsBanner');
      const totalReceita = attendees.reduce((acc, curr) => acc + parseFloat(curr.valor_pago || 0), 0);

      statsBanner.innerHTML = `
        <div class="info-stat-block">
          <span class="info-stat-label">Total de Inscritos</span>
          <span class="info-stat-value">${attendees.length} atletas</span>
        </div>
        <div class="info-stat-block">
          <span class="info-stat-label">Capacidade Máxima</span>
          <span class="info-stat-value">${ev.capacidade || 0} vagas</span>
        </div>
        <div class="info-stat-block">
          <span class="info-stat-label">Ocupação</span>
          <span class="info-stat-value">${Math.round((attendees.length / (ev.capacidade || 1)) * 100)}%</span>
        </div>
        <div class="info-stat-block">
          <span class="info-stat-label">Receita Estimada</span>
          <span class="info-stat-value" style="color: #047857;">R$ ${totalReceita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
      `;

      const wrapper = document.getElementById('registrationsTableWrapper');

      if (attendees.length === 0) {
        wrapper.innerHTML = `
          <div style="padding: 30px; text-align: center; color: var(--text-muted); font-size: 13px;">
            <i class="fa-solid fa-users-slash" style="font-size: 32px; color: var(--text-dim); margin-bottom: 12px; display: block;"></i>
            Ainda não há participantes inscritos neste evento.<br>
            Compartilhe o <strong>Link da Landing Page</strong> para começar a receber inscrições!
          </div>
        `;
      } else {
        wrapper.innerHTML = `
          <table class="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nome do Atleta</th>
                <th>Email / Contato</th>
                <th>Kit / Camiseta</th>
                <th>Data Inscrição</th>
                <th>Origem / Carteira</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${attendees.map(a => {
                const dateObj = new Date(a.created_at);
                const regDate = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const origemBadge = a.parceiro_indicador_nome ?
                  `<span class="badge" style="background: #EFF6FF; color: #1D4ED8; font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;" title="Inscrição realizada via Carteira do Parceiro"><i class="fa-solid fa-wallet"></i> ${this.escapeHtml(a.parceiro_indicador_nome)}</span>` :
                  `<span class="badge" style="background: #F1F5F9; color: #64748B; font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 4px;">Direta</span>`;

                return `
                  <tr>
                    <td><strong style="font-family: monospace; color: var(--primary);">${this.escapeHtml(a.codigo_inscricao)}</strong></td>
                    <td>
                      <div style="font-weight: 700; color: #0F172A;">${this.escapeHtml(a.nome_completo)}</div>
                      <small style="color: var(--text-dim);">${a.cpf ? `CPF: ${this.escapeHtml(a.cpf)}` : ''}</small>
                    </td>
                    <td>
                      <div>${this.escapeHtml(a.email)}</div>
                      <small style="color: var(--text-dim);">${this.escapeHtml(a.telefone)}</small>
                    </td>
                    <td><span class="modality-pill" style="padding: 2px 8px; font-size: 11px;">Tam: ${this.escapeHtml(a.tamanho_camiseta || 'M')}</span></td>
                    <td>${regDate}</td>
                    <td>${origemBadge}</td>
                    <td><span class="partner-status-tag ativo" style="font-size: 11px;">${a.status_pagamento}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `;
      }

      this.openModal('eventRegistrationsModal');
    } catch (err) {
      console.error('Erro ao buscar inscritos do evento:', err);
      this.showToast('Erro ao carregar lista de inscritos', 'error');
    }
  },

  // ==========================================================
  // RENDERIZAÇÃO DE PROPOSTAS DE PARCERIA
  // ==========================================================
  renderProposals() {
    const container = document.getElementById('proposalsContainer');
    if (!container) return;

    const search = document.getElementById('proposalSearchInput')?.value.toLowerCase().trim() || '';
    const statusFilter = document.getElementById('proposalStatusFilter')?.value || '';

    let list = this.state.proposals;

    if (statusFilter) {
      list = list.filter(p => p.status === statusFilter);
    }

    if (search) {
      list = list.filter(p => 
        (p.titulo && p.titulo.toLowerCase().includes(search)) ||
        (p.parceiro_nome && p.parceiro_nome.toLowerCase().includes(search)) ||
        (p.tipo_proposta && p.tipo_proposta.toLowerCase().includes(search))
      );
    }

    if (list.length === 0) {
      container.innerHTML = `
        <div class="empty-state-loading">
          <i class="fa-solid fa-file-circle-question" style="font-size: 32px; margin-bottom: 12px; display: block; color: var(--text-dim);"></i>
          Nenhuma proposta comercial encontrada. Clique em "+ Nova Proposta" para criar a primeira!
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(p => {
      const valor = parseFloat(p.valor_proposta || 0);
      const comissao = parseFloat(p.comissao_porcentagem || 0);
      const comissaoValor = (valor * comissao) / 100;

      const statusClass = p.status === 'Rascunho' ? 'status-rascunho' :
                          p.status === 'Enviada' ? 'status-enviada' :
                          p.status === 'Em Negociação' ? 'status-negociacao' :
                          p.status === 'Aprovada' ? 'status-aprovada' : 'status-recusada';

      return `
        <div class="proposal-card">
          <div class="proposal-header">
            <div>
              <div class="proposal-partner-tag">
                <i class="fa-solid fa-handshake"></i> ${this.escapeHtml(p.parceiro_nome)}
              </div>
              <h3 class="proposal-title">${this.escapeHtml(p.titulo)}</h3>
            </div>
            <span class="proposal-status-badge ${statusClass}">${p.status}</span>
          </div>

          <div class="proposal-value-box">
            <div>
              <small style="color: var(--text-dim); display: block; font-size: 11px; text-transform: uppercase;">Valor da Proposta</small>
              <span class="proposal-value-amount">R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div style="text-align: right;">
              <small style="color: var(--text-dim); display: block; font-size: 11px; text-transform: uppercase;">Comissão (${comissao}%)</small>
              <strong style="color: var(--primary); font-size: 14px;">R$ ${comissaoValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
            </div>
          </div>

          <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 14px; line-height: 1.5;">
            <div style="margin-bottom: 4px;"><strong>Tipo:</strong> ${this.escapeHtml(p.tipo_proposta || 'Patrocínio')}</div>
            ${p.data_validade ? `<div><strong>Validade:</strong> ${new Date(p.data_validade).toLocaleDateString('pt-BR')}</div>` : ''}
          </div>

          ${p.contrapartidas ? `<p style="font-size: 12px; color: var(--text-dim); margin-bottom: 14px; line-height: 1.4;">${this.escapeHtml(p.contrapartidas.substring(0, 95))}${p.contrapartidas.length > 95 ? '...' : ''}</p>` : ''}

          <div class="category-card-footer">
            <button class="btn btn-sm btn-outline" onclick="app.viewProposalSheet(${p.id})">
              <i class="fa-solid fa-file-invoice"></i> Ver Ficha
            </button>
            
            <div style="display: flex; gap: 6px; align-items: center;">
              ${p.status !== 'Aprovada' ? (
                this.state.currentUser?.perfil === 'ADMIN' ? 
                  `<button class="btn btn-sm btn-primary" onclick="app.quickApproveProposal(${p.id})" title="Aprovar Proposta Comercial (Exclusivo ADM)">
                    <i class="fa-solid fa-circle-check"></i> Aprovar
                  </button>` :
                  `<span class="role-restricted-badge" title="Aprovação restrita ao Administrador Geral (ADM)">
                    <i class="fa-solid fa-lock"></i> Aguarda ADM
                  </span>`
              ) : `
                <span class="proposal-status-badge status-aprovada" style="font-size: 11px;">
                  <i class="fa-solid fa-check"></i> Aprovada
                </span>
              `}

              <button class="btn btn-sm btn-secondary" onclick="app.openEditProposalModal(${p.id})" title="Editar Proposta">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button class="btn btn-sm btn-danger" onclick="app.deleteProposal(${p.id})" title="Excluir Proposta">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  async quickApproveProposal(id) {
    if (this.state.currentUser?.perfil !== 'ADMIN') {
      this.showToast('Apenas o Administrador (ADM) tem autorização para aprovar propostas comerciais.', 'error');
      return;
    }

    try {
      const res = await this.apiFetch(`/api/proposals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Aprovada' }),
      });
      const json = await res.json();
      if (json.success) {
        this.showToast('Proposta aprovada com sucesso!', 'success');
        this.closeModal('proposalViewModal');
        await this.fetchProposals();
      } else {
        this.showToast(json.message || 'Erro ao aprovar proposta', 'error');
      }
    } catch (err) {
      console.error('Erro ao aprovar proposta:', err);
      this.showToast('Erro de comunicação com o servidor.', 'error');
    }
  },

  // Visualizar Ficha Executiva da Proposta
  async viewProposalSheet(proposalId) {
    try {
      const res = await this.apiFetch(`/api/proposals/${proposalId}`);
      const json = await res.json();

      if (!json.success || !json.data) {
        this.showToast('Não foi possível carregar a proposta.', 'error');
        return;
      }

      const p = json.data;
      const valor = parseFloat(p.valor_proposta || 0);
      const comissao = parseFloat(p.comissao_porcentagem || 0);

      document.getElementById('propViewTitle').textContent = p.titulo;
      document.getElementById('propViewPartnerName').textContent = `${p.parceiro_nome} • ${p.tipo_proposta}`;

      const body = document.getElementById('proposalViewBody');
      body.innerHTML = `
        <div class="proposal-sheet">
          <div class="proposal-sheet-header">
            <div>
              <h2 style="font-size: 20px; font-weight: 800; color: #0F172A;">PROPOSTA COMERCIAL DE PARCERIA</h2>
              <p style="color: var(--text-muted); font-size: 13px;">UNYCO ESPORTE & EVENTOS CORPORATIVOS</p>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <span class="proposal-status-badge ${p.status === 'Aprovada' ? 'status-aprovada' : 'status-negociacao'}" style="font-size: 13px;">${p.status}</span>
              ${(p.status !== 'Aprovada' && this.state.currentUser?.perfil === 'ADMIN') ? `
                <button class="btn btn-sm btn-primary" onclick="app.quickApproveProposal(${p.id})">
                  <i class="fa-solid fa-circle-check"></i> Aprovar Proposta
                </button>
              ` : ''}
            </div>
          </div>

          <div class="partner-info-banner" style="margin-bottom: 20px;">
            <div class="info-stat-block">
              <span class="info-stat-label">Parceiro Proponente</span>
              <span class="info-stat-value">${this.escapeHtml(p.parceiro_nome)}</span>
            </div>
            <div class="info-stat-block">
              <span class="info-stat-label">CNPJ</span>
              <span class="info-stat-value">${this.escapeHtml(p.parceiro_cnpj || 'Não informado')}</span>
            </div>
            <div class="info-stat-block">
              <span class="info-stat-label">Valor Proposto</span>
              <span class="info-stat-value" style="color: #047857; font-size: 16px;">R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div class="info-stat-block">
              <span class="info-stat-label">Comissão Operacional</span>
              <span class="info-stat-value">${comissao}%</span>
            </div>
          </div>

          <div style="margin-bottom: 20px;">
            <h4 style="font-size: 14px; font-weight: 700; color: #0F172A; margin-bottom: 8px;">Contrapartidas & Entregas Acordadas:</h4>
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 16px; border-radius: var(--radius-md); font-size: 13px; color: var(--text-main); line-height: 1.6; white-space: pre-line;">
              ${this.escapeHtml(p.contrapartidas || 'Nenhuma contrapartida registrada')}
            </div>
          </div>

          ${p.observacoes ? `
            <div>
              <h4 style="font-size: 14px; font-weight: 700; color: #0F172A; margin-bottom: 8px;">Notas & Observações da Negociação:</h4>
              <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 14px; border-radius: var(--radius-md); font-size: 13px; color: var(--text-muted); line-height: 1.5;">
                ${this.escapeHtml(p.observacoes)}
              </div>
            </div>
          ` : ''}
        </div>
      `;

      this.openModal('proposalViewModal');
    } catch (err) {
      console.error('Erro ao abrir ficha da proposta:', err);
      this.showToast('Erro ao carregar proposta', 'error');
    }
  },

  // ==========================================================
  // MODAIS E FORMULÁRIOS DE PROPOSTAS
  // ==========================================================
  openCreateProposalModal(preselectedPartnerId = null) {
    document.getElementById('proposalForm').reset();
    document.getElementById('proposalFormId').value = '';
    document.getElementById('proposalModalTitle').textContent = 'Nova Proposta de Parceria';

    if (preselectedPartnerId) {
      document.getElementById('proposalParceiroId').value = preselectedPartnerId;
    }

    this.openModal('proposalModal');
  },

  openEditProposalModal(id) {
    const p = this.state.proposals.find(item => item.id === id);
    if (!p) return;

    document.getElementById('proposalFormId').value = p.id;
    document.getElementById('proposalParceiroId').value = p.parceiro_id;
    document.getElementById('proposalTitulo').value = p.titulo || '';
    document.getElementById('proposalTipo').value = p.tipo_proposta || 'Patrocínio Master';
    document.getElementById('proposalValor').value = p.valor_proposta || '';
    document.getElementById('proposalComissao').value = p.comissao_porcentagem || '';
    document.getElementById('proposalStatus').value = p.status || 'Rascunho';

    if (p.data_validade) {
      document.getElementById('proposalDataValidade').value = p.data_validade.slice(0, 10);
    } else {
      document.getElementById('proposalDataValidade').value = '';
    }

    document.getElementById('proposalContrapartidas').value = p.contrapartidas || '';
    document.getElementById('proposalObservacoes').value = p.observacoes || '';

    document.getElementById('proposalModalTitle').textContent = 'Editar Proposta de Parceria';
    this.openModal('proposalModal');
  },

  async handleSaveProposal(event) {
    event.preventDefault();

    const id = document.getElementById('proposalFormId').value;
    const payload = {
      parceiro_id: parseInt(document.getElementById('proposalParceiroId').value, 10),
      titulo: document.getElementById('proposalTitulo').value.trim(),
      tipo_proposta: document.getElementById('proposalTipo').value,
      valor_proposta: document.getElementById('proposalValor').value ? parseFloat(document.getElementById('proposalValor').value) : 0,
      comissao_porcentagem: document.getElementById('proposalComissao').value ? parseFloat(document.getElementById('proposalComissao').value) : 0,
      status: document.getElementById('proposalStatus').value,
      data_validade: document.getElementById('proposalDataValidade').value || null,
      contrapartidas: document.getElementById('proposalContrapartidas').value.trim(),
      observacoes: document.getElementById('proposalObservacoes').value.trim(),
    };

    try {
      const url = id ? `/api/proposals/${id}` : '/api/proposals';
      const method = id ? 'PUT' : 'POST';

      const res = await this.apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (json.success) {
        this.showToast(json.message || 'Proposta salva com sucesso!', 'success');
        this.closeModal('proposalModal');
        await this.fetchProposals();
      } else {
        this.showToast(json.message || 'Erro ao salvar proposta', 'error');
      }
    } catch (err) {
      console.error('Erro ao salvar proposta:', err);
      this.showToast('Erro ao comunicar com o servidor', 'error');
    }
  },

  async deleteProposal(id) {
    const p = this.state.proposals.find(item => item.id === id);
    const name = p ? p.titulo : 'esta proposta';

    if (!confirm(`Deseja realmente excluir a proposta "${name}"?`)) {
      return;
    }

    try {
      const res = await this.apiFetch(`/api/proposals/${id}`, { method: 'DELETE' });
      const json = await res.json();

      if (json.success) {
        this.showToast('Proposta excluída com sucesso.', 'success');
        await this.fetchProposals();
      } else {
        this.showToast(json.message || 'Erro ao excluir proposta', 'error');
      }
    } catch (err) {
      console.error('Erro ao excluir proposta:', err);
      this.showToast('Erro ao excluir proposta', 'error');
    }
  },

  // ==========================================================
  // RENDERIZAÇÃO DE CATEGORIAS DE EVENTO
  // ==========================================================
  renderCategories() {
    const container = document.getElementById('categoriesContainer');
    if (!container) return;

    const search = document.getElementById('categorySearchInput')?.value.toLowerCase().trim() || '';
    let list = this.state.categories;

    if (search) {
      list = list.filter(c => 
        (c.nome && c.nome.toLowerCase().includes(search)) ||
        (c.descricao && c.descricao.toLowerCase().includes(search))
      );
    }

    if (list.length === 0) {
      container.innerHTML = `
        <div class="empty-state-loading">
          <i class="fa-solid fa-tags" style="font-size: 32px; margin-bottom: 12px; display: block; color: var(--text-dim);"></i>
          Nenhuma categoria encontrada.
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(c => `
      <div class="category-card" style="--card-accent-color: ${c.cor || '#0284C7'};">
        <div class="category-card-header">
          <div class="category-icon-box" style="background: ${c.cor || '#0284C7'};">
            <i class="fa-solid ${c.icone || 'fa-trophy'}"></i>
          </div>
          <span class="events-counter-badge">${c.total_eventos || 0} evento${c.total_eventos === 1 ? '' : 's'}</span>
        </div>

        <h3 class="category-title">${this.escapeHtml(c.nome)}</h3>
        <p class="category-desc">${this.escapeHtml(c.descricao || 'Sem descrição cadastrada.')}</p>

        <div class="category-card-footer">
          <button class="btn btn-sm btn-outline" onclick="app.filterEventsByCategory(${c.id})">
            <i class="fa-solid fa-filter"></i> Filtrar Eventos
          </button>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-sm btn-secondary" onclick="app.openEditCategoryModal(${c.id})" title="Editar Categoria">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="app.deleteCategory(${c.id})" title="Excluir Categoria">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `).join('');
  },

  filterEventsByCategory(categoryId) {
    this.switchTab('events');
    const select = document.getElementById('eventCategoryFilter');
    if (select) {
      select.value = categoryId;
      this.renderEvents();
    }
  },

  // Preenche selects de parceiros e categorias dinamicamente
  populateDropdowns() {
    // 1. Parceiros (em Eventos e Propostas)
    const partnerFilter = document.getElementById('eventPartnerFilter');
    const partnerEventForm = document.getElementById('eventParceiroId');
    const partnerPropForm = document.getElementById('proposalParceiroId');

    const partnerOptions = this.state.partners.map(p => `
      <option value="${p.id}">${this.escapeHtml(p.nome_fantasia)} (${this.escapeHtml(p.categoria || 'Parceiro')})</option>
    `).join('');

    if (partnerFilter) {
      partnerFilter.innerHTML = `<option value="">Todos os Parceiros</option>` + partnerOptions;
    }
    if (partnerEventForm) {
      partnerEventForm.innerHTML = `<option value="">Selecione o parceiro realizador...</option>` + partnerOptions;
    }
    if (partnerPropForm) {
      partnerPropForm.innerHTML = `<option value="">Selecione o parceiro...</option>` + partnerOptions;
    }

    // 2. Categorias
    const catFilter = document.getElementById('eventCategoryFilter');
    const catForm = document.getElementById('eventCategoriaId');

    const catOptions = this.state.categories.map(c => `
      <option value="${c.id}">${this.escapeHtml(c.nome)}</option>
    `).join('');

    if (catFilter) {
      catFilter.innerHTML = `<option value="">Todas as Categorias</option>` + catOptions;
    }
    if (catForm) {
      catForm.innerHTML = `<option value="">Selecione a categoria...</option>` + catOptions;
    }
  },

  // ==========================================================
  // MODAIS E FORMULÁRIOS DE CATEGORIAS
  // ==========================================================
  openCreateCategoryModal() {
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryFormId').value = '';
    document.getElementById('categoryCor').value = '#0284C7';
    document.getElementById('categoryModalTitle').textContent = 'Criar Nova Categoria de Evento';
    this.openModal('categoryModal');
  },

  openEditCategoryModal(id) {
    const category = this.state.categories.find(c => c.id === id);
    if (!category) return;

    document.getElementById('categoryFormId').value = category.id;
    document.getElementById('categoryNome').value = category.nome || '';
    document.getElementById('categoryDescricao').value = category.descricao || '';
    document.getElementById('categoryIcone').value = category.icone || 'fa-trophy';
    document.getElementById('categoryCor').value = category.cor || '#0284C7';

    document.getElementById('categoryModalTitle').textContent = 'Editar Categoria de Evento';
    this.openModal('categoryModal');
  },

  async handleSaveCategory(event) {
    event.preventDefault();

    const id = document.getElementById('categoryFormId').value;
    const payload = {
      nome: document.getElementById('categoryNome').value.trim(),
      descricao: document.getElementById('categoryDescricao').value.trim(),
      icone: document.getElementById('categoryIcone').value,
      cor: document.getElementById('categoryCor').value,
    };

    try {
      const url = id ? `/api/categories/${id}` : '/api/categories';
      const method = id ? 'PUT' : 'POST';

      const res = await this.apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (json.success) {
        this.showToast(json.message || 'Categoria salva com sucesso!', 'success');
        this.closeModal('categoryModal');
        await this.fetchCategories();
        await this.fetchEvents();
      } else {
        this.showToast(json.message || 'Erro ao salvar categoria', 'error');
      }
    } catch (err) {
      console.error('Erro ao salvar categoria:', err);
      this.showToast('Erro ao comunicar com o servidor', 'error');
    }
  },

  async deleteCategory(id) {
    const cat = this.state.categories.find(c => c.id === id);
    const name = cat ? cat.nome : 'esta categoria';

    const isRep = this.state.currentUser?.perfil === 'REPRESENTANTE';
    const msg = isRep
      ? `[Perfil Representante] - Esta exclusão será processada sob autorização da coordenação.\n\nConfirma a exclusão da categoria "${name}"?`
      : `Deseja realmente excluir a categoria "${name}"?\n(Os eventos vinculados terão sua categoria desvinculada)`;

    if (!confirm(msg)) {
      return;
    }

    try {
      const res = await this.apiFetch(`/api/categories/${id}`, { method: 'DELETE' });
      const json = await res.json();

      if (json.success) {
        this.showToast('Categoria excluída com sucesso.', 'success');
        await this.fetchCategories();
        await this.fetchEvents();
      } else {
        this.showToast(json.message || 'Erro ao excluir categoria', 'error');
      }
    } catch (err) {
      console.error('Erro ao excluir categoria:', err);
      this.showToast('Erro ao excluir categoria', 'error');
    }
  },

  // ==========================================================
  // MODAIS E FORMULÁRIOS DE PARCEIROS
  // ==========================================================
  openCreatePartnerModal() {
    document.getElementById('partnerForm').reset();
    document.getElementById('partnerFormId').value = '';
    document.getElementById('partnerModalTitle').textContent = 'Cadastrar Novo Parceiro';

    const defaultLogo = 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=150';
    const logoInput = document.getElementById('partnerLogoUrl');
    if (logoInput) logoInput.value = '';
    this.updatePartnerLogoPreviewFromUrl(defaultLogo);
    const logoFileInput = document.getElementById('partnerLogoFileInput');
    if (logoFileInput) logoFileInput.value = '';

    // Configurar seção de Link da LP
    const notice = document.getElementById('partnerLpNewNotice');
    const controls = document.getElementById('partnerLpActiveControls');
    if (notice) notice.style.display = 'block';
    if (controls) controls.style.display = 'none';

    this.openModal('partnerModal');
  },

  openEditPartnerModal(id) {
    const partner = this.state.partners.find(p => p.id === id);
    if (!partner) return;

    document.getElementById('partnerFormId').value = partner.id;
    document.getElementById('partnerNomeFantasia').value = partner.nome_fantasia || '';
    document.getElementById('partnerRazaoSocial').value = partner.razao_social || '';
    document.getElementById('partnerCnpj').value = partner.cnpj || '';
    document.getElementById('partnerEmail').value = partner.email || '';
    document.getElementById('partnerTelefone').value = partner.telefone || '';
    document.getElementById('partnerResponsavel').value = partner.responsavel || '';
    document.getElementById('partnerCategoria').value = partner.categoria || 'Clube / Arena';
    document.getElementById('partnerStatus').value = partner.status || 'ativo';
    document.getElementById('partnerLogoUrl').value = partner.logo_url || '';
    document.getElementById('partnerWebsite').value = partner.website || '';

    const logoVal = partner.logo_url || 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=150';
    this.updatePartnerLogoPreviewFromUrl(logoVal);
    const logoFileInput = document.getElementById('partnerLogoFileInput');
    if (logoFileInput) logoFileInput.value = '';

    // Configurar seção de Link da Carteira com o link gerado
    const notice = document.getElementById('partnerLpNewNotice');
    const controls = document.getElementById('partnerLpActiveControls');
    const input = document.getElementById('partnerLpUrlInput');
    const openLink = document.getElementById('partnerLpOpenLink');
    const walletUrl = this.getPartnerWalletUrl(partner.id);
    if (notice) notice.style.display = 'none';
    if (controls) controls.style.display = 'block';
    if (input) input.value = walletUrl;
    if (openLink) openLink.href = walletUrl;

    document.getElementById('partnerModalTitle').textContent = `Editar Parceiro: ${partner.nome_fantasia}`;
    this.openModal('partnerModal');
  },

  async handleSavePartner(event) {
    event.preventDefault();

    const id = document.getElementById('partnerFormId').value;
    const isNew = !id;
    const payload = {
      nome_fantasia: document.getElementById('partnerNomeFantasia').value.trim(),
      razao_social: document.getElementById('partnerRazaoSocial').value.trim(),
      cnpj: document.getElementById('partnerCnpj').value.trim(),
      email: document.getElementById('partnerEmail').value.trim(),
      telefone: document.getElementById('partnerTelefone').value.trim(),
      responsavel: document.getElementById('partnerResponsavel').value.trim(),
      categoria: document.getElementById('partnerCategoria').value,
      status: document.getElementById('partnerStatus').value,
      logo_url: document.getElementById('partnerLogoUrl').value.trim(),
      website: document.getElementById('partnerWebsite').value.trim(),
    };

    try {
      const url = id ? `/api/partners/${id}` : '/api/partners';
      const method = id ? 'PUT' : 'POST';

      const res = await this.apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (json.success) {
        const savedPartner = json.data;
        this.closeModal('partnerModal');
        await this.refreshAll();

        if (isNew && savedPartner && savedPartner.id) {
          const walletUrl = this.getPartnerWalletUrl(savedPartner.id);
          this.showToast(`Parceiro cadastrado com sucesso! Link da Carteira ativado.`, 'success');
          // Confirmação para copiar o link imediatamente
          setTimeout(() => {
            if (confirm(`Parceiro cadastrado com sucesso!\n\nDeseja copiar agora o Link da Carteira para enviar aos alunos e atletas da academia?\n\n${walletUrl}`)) {
              this.copyPartnerWalletLink(savedPartner.id);
            }
          }, 300);
        } else {
          this.showToast(json.message || 'Parceiro salvo com sucesso!', 'success');
        }
      } else {
        this.showToast(json.message || 'Erro ao salvar parceiro', 'error');
      }
    } catch (err) {
      console.error('Erro ao salvar parceiro:', err);
      this.showToast('Erro ao comunicar com o servidor', 'error');
    }
  },

  async deletePartner(id) {
    const partner = this.state.partners.find(p => p.id === id);
    const name = partner ? partner.nome_fantasia : 'este parceiro';

    const isRep = this.state.currentUser?.perfil === 'REPRESENTANTE';
    const msg = isRep
      ? `[Perfil Representante] - Esta exclusão será registrada sob autorização da coordenação comercial.\n\nAtenção: Ao excluir "${name}", todos os eventos vinculados também serão removidos.\n\nDeseja prosseguir?`
      : `Atenção: Ao excluir "${name}", todos os eventos associados a ele também serão excluídos do banco de dados.\n\nDeseja continuar?`;

    if (!confirm(msg)) {
      return;
    }

    try {
      const res = await this.apiFetch(`/api/partners/${id}`, { method: 'DELETE' });
      const json = await res.json();

      if (json.success) {
        this.showToast('Parceiro e eventos excluídos com sucesso.', 'success');
        await this.refreshAll();
      } else {
        this.showToast(json.message || 'Erro ao excluir parceiro', 'error');
      }
    } catch (err) {
      console.error('Erro ao excluir parceiro:', err);
      this.showToast('Erro de comunicação ao excluir parceiro', 'error');
    }
  },

  // ==========================================================
  // MODAIS E FORMULÁRIOS DE EVENTOS
  // ==========================================================
  openCreateEventModal(preselectedPartnerId = null) {
    document.getElementById('eventForm').reset();
    document.getElementById('eventFormId').value = '';
    document.getElementById('eventModalTitle').textContent = 'Cadastrar Novo Evento';

    const defaultBanner = 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=600';
    const bannerInput = document.getElementById('eventBannerUrl');
    if (bannerInput) bannerInput.value = '';
    this.updateEventBannerPreviewFromUrl(defaultBanner);
    const bannerFileInput = document.getElementById('eventBannerFileInput');
    if (bannerFileInput) bannerFileInput.value = '';

    if (preselectedPartnerId) {
      document.getElementById('eventParceiroId').value = preselectedPartnerId;
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 7);
    tomorrow.setHours(8, 0, 0, 0);
    document.getElementById('eventDataInicio').value = tomorrow.toISOString().slice(0, 16);

    this.openModal('eventModal');
  },

  openEditEventModal(id) {
    const ev = this.state.events.find(e => e.id === id);
    if (!ev) return;

    document.getElementById('eventFormId').value = ev.id;
    document.getElementById('eventParceiroId').value = ev.parceiro_id;
    document.getElementById('eventCategoriaId').value = ev.categoria_id || '';
    document.getElementById('eventNome').value = ev.nome || '';
    document.getElementById('eventModalidade').value = ev.modalidade || '';
    document.getElementById('eventLocal').value = ev.local || '';
    document.getElementById('eventCidade').value = ev.cidade || 'São Paulo';
    document.getElementById('eventEstado').value = ev.estado || 'SP';

    if (ev.data_inicio) {
      const start = new Date(ev.data_inicio);
      start.setMinutes(start.getMinutes() - start.getTimezoneOffset());
      document.getElementById('eventDataInicio').value = start.toISOString().slice(0, 16);
    }

    if (ev.data_fim) {
      const end = new Date(ev.data_fim);
      end.setMinutes(end.getMinutes() - end.getTimezoneOffset());
      document.getElementById('eventDataFim').value = end.toISOString().slice(0, 16);
    } else {
      document.getElementById('eventDataFim').value = '';
    }

    document.getElementById('eventCapacidade').value = ev.capacidade || '';
    document.getElementById('eventValorInscricao').value = ev.valor_inscricao || '';
    document.getElementById('eventStatus').value = ev.status || 'Agendado';
    document.getElementById('eventBannerUrl').value = ev.banner_url || '';
    document.getElementById('eventDescricao').value = ev.descricao || '';

    const bannerVal = ev.banner_url || 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=600';
    this.updateEventBannerPreviewFromUrl(bannerVal);
    const bannerFileInput = document.getElementById('eventBannerFileInput');
    if (bannerFileInput) bannerFileInput.value = '';

    document.getElementById('eventModalTitle').textContent = 'Editar Evento';
    this.openModal('eventModal');
  },

  async handleSaveEvent(event) {
    event.preventDefault();

    const id = document.getElementById('eventFormId').value;
    const catId = document.getElementById('eventCategoriaId').value;

    const payload = {
      parceiro_id: parseInt(document.getElementById('eventParceiroId').value, 10),
      categoria_id: catId ? parseInt(catId, 10) : null,
      nome: document.getElementById('eventNome').value.trim(),
      modalidade: document.getElementById('eventModalidade').value.trim(),
      local: document.getElementById('eventLocal').value.trim(),
      cidade: document.getElementById('eventCidade').value.trim(),
      estado: document.getElementById('eventEstado').value.trim(),
      data_inicio: document.getElementById('eventDataInicio').value,
      data_fim: document.getElementById('eventDataFim').value || null,
      capacidade: document.getElementById('eventCapacidade').value || 100,
      valor_inscricao: document.getElementById('eventValorInscricao').value || 0.00,
      status: document.getElementById('eventStatus').value,
      banner_url: document.getElementById('eventBannerUrl').value.trim(),
      descricao: document.getElementById('eventDescricao').value.trim(),
    };

    try {
      const url = id ? `/api/events/${id}` : '/api/events';
      const method = id ? 'PUT' : 'POST';

      const res = await this.apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (json.success) {
        this.showToast(json.message || 'Evento salvo com sucesso!', 'success');
        this.closeModal('eventModal');
        await this.refreshAll();
      } else {
        this.showToast(json.message || 'Erro ao salvar evento', 'error');
      }
    } catch (err) {
      console.error('Erro ao salvar evento:', err);
      this.showToast('Erro ao comunicar com o servidor', 'error');
    }
  },

  async deleteEvent(id) {
    const ev = this.state.events.find(e => e.id === id);
    const name = ev ? ev.nome : 'este evento';

    const isRep = this.state.currentUser?.perfil === 'REPRESENTANTE';
    const msg = isRep
      ? `[Perfil Representante] - Esta exclusão será registrada sob autorização da coordenação comercial.\n\nConfirma a exclusão do evento "${name}"?`
      : `Deseja realmente excluir o evento "${name}"?`;

    if (!confirm(msg)) {
      return;
    }

    try {
      const res = await this.apiFetch(`/api/events/${id}`, { method: 'DELETE' });
      const json = await res.json();

      if (json.success) {
        this.showToast('Evento excluído com sucesso.', 'success');
        await this.refreshAll();
      } else {
        this.showToast(json.message || 'Erro ao excluir evento', 'error');
      }
    } catch (err) {
      console.error('Erro ao excluir evento:', err);
      this.showToast('Erro ao excluir evento', 'error');
    }
  },

  // ==========================================================
  // DETALHES DO PARCEIRO E HISTÓRICO DE EVENTOS REALIZADOS
  // ==========================================================
  async viewPartnerDetails(partnerId) {
    try {
      const res = await this.apiFetch(`/api/partners/${partnerId}`);
      const json = await res.json();

      if (!json.success || !json.data) {
        this.showToast('Não foi possível carregar os detalhes do parceiro.', 'error');
        return;
      }

      const partner = json.data;
      this.state.selectedPartnerForDetails = partner;

      document.getElementById('partnerDetailsName').textContent = partner.nome_fantasia;
      document.getElementById('partnerDetailsMeta').textContent = `${partner.categoria || 'Parceiro'} • CNPJ: ${partner.cnpj || 'Não informado'}`;

      const logoContainer = document.getElementById('partnerDetailsLogoContainer');
      if (partner.logo_url) {
        logoContainer.innerHTML = `<img src="${partner.logo_url}" style="width: 100%; height: 100%; border-radius: 8px; object-fit: cover;" onerror="this.outerHTML='<i class=\\\'fa-solid fa-building\\\'></i>'">`;
      } else {
        logoContainer.innerHTML = `<i class="fa-solid fa-building"></i>`;
      }

      const infoBanner = document.getElementById('partnerDetailsInfoBanner');
      infoBanner.innerHTML = `
        <div class="info-stat-block">
          <span class="info-stat-label">Razão Social</span>
          <span class="info-stat-value">${this.escapeHtml(partner.razao_social || 'Não cadastrado')}</span>
        </div>
        <div class="info-stat-block">
          <span class="info-stat-label">Email de Contato</span>
          <span class="info-stat-value">${this.escapeHtml(partner.email || 'Não cadastrado')}</span>
        </div>
        <div class="info-stat-block">
          <span class="info-stat-label">Telefone / WhatsApp</span>
          <span class="info-stat-value">${this.escapeHtml(partner.telefone || 'Não cadastrado')}</span>
        </div>
        <div class="info-stat-block">
          <span class="info-stat-label">Responsável</span>
          <span class="info-stat-value">${this.escapeHtml(partner.responsavel || 'Não cadastrado')}</span>
        </div>
        <div class="info-stat-block">
          <span class="info-stat-label">Website Oficial</span>
          <span class="info-stat-value">${partner.website ? `<a href="${partner.website}" target="_blank" style="color: var(--primary); text-decoration: none;"><i class="fa-solid fa-arrow-up-right-from-square"></i> Acessar</a>` : 'Não informado'}</span>
        </div>
        <div class="info-stat-block">
          <span class="info-stat-label">Status do Parceiro</span>
          <span class="info-stat-value"><span class="partner-status-tag ${partner.status}">${partner.status === 'ativo' ? 'Ativo' : 'Inativo'}</span></span>
        </div>

        <div style="grid-column: 1 / -1; background: #F0F9FF; border: 1px solid #BAE6FD; border-radius: var(--radius-md); padding: 14px 18px; margin-top: 6px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
          <div>
            <div style="font-size: 13px; font-weight: 700; color: #0369A1; display: flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-link"></i> Link da LP da Academia / Alunos & Atletas
            </div>
            <div style="font-size: 12px; color: #0284C7; font-weight: 600; margin-top: 2px;">
              ${this.getPartnerLPUrl(partner.id)}
            </div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-sm btn-primary" onclick="app.copyPartnerLPLink(${partner.id})" title="Copiar Link da LP">
              <i class="fa-solid fa-copy"></i> Copiar Link
            </button>
            <a href="${this.getPartnerLPUrl(partner.id)}" target="_blank" class="btn btn-sm btn-secondary" title="Abrir Landing Page">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> Abrir LP
            </a>
            <button class="btn btn-sm btn-outline" style="border-color: #86EFAC; color: #16A34A; background: #FFFFFF;" onclick="app.sharePartnerLpWhatsApp(${partner.id})" title="Compartilhar no WhatsApp">
              <i class="fa-brands fa-whatsapp"></i> WhatsApp
            </button>
          </div>
        </div>
      `;

      const events = partner.eventos || [];
      document.getElementById('partnerEventsCount').textContent = events.length;

      const tableWrapper = document.getElementById('partnerEventsTableWrapper');

      if (events.length === 0) {
        tableWrapper.innerHTML = `
          <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px;">
            Este parceiro ainda não possui eventos cadastrados. Clique no botão acima para adicionar o primeiro evento!
          </div>
        `;
      } else {
        tableWrapper.innerHTML = `
          <table class="data-table">
            <thead>
              <tr>
                <th>Evento</th>
                <th>Modalidade</th>
                <th>Data</th>
                <th>Local</th>
                <th>Capacidade</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${events.map(e => {
                const dateObj = new Date(e.data_inicio);
                const formattedDate = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                return `
                  <tr>
                    <td><strong>${this.escapeHtml(e.nome)}</strong></td>
                    <td><span class="modality-pill" style="padding: 3px 8px; font-size: 11px;">${this.escapeHtml(e.modalidade)}</span></td>
                    <td>${formattedDate}</td>
                    <td>${this.escapeHtml(e.local)}</td>
                    <td>${e.capacidade || 0} vagas</td>
                    <td><span class="partner-status-tag ${e.status === 'Agendado' ? 'ativo' : 'inativo'}" style="font-size: 11px;">${e.status}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `;
      }

      this.openModal('partnerDetailsModal');
    } catch (err) {
      console.error('Erro ao abrir detalhes do parceiro:', err);
      this.showToast('Erro ao carregar detalhes do parceiro', 'error');
    }
  },

  // ==========================================================
  // MÓDULO DE GANHOS DO PARCEIRO & CURADORIA DE HOTÉIS
  // ==========================================================
  async fetchEarnings() {
    try {
      const res = await this.apiFetch('/api/earnings');
      const json = await res.json();
      if (json.success) {
        this.state.earningsData = json;
        const totalRepasse = parseFloat(json.summary?.total_repasse_parceiros || 0);
        document.getElementById('badgeEarningsCount').textContent = `R$ ${totalRepasse.toFixed(2).replace('.', ',')}`;
      }
    } catch (err) {
      console.error('Erro ao buscar extrato de ganhos:', err);
    }
  },

  async loadEarningsData() {
    await this.fetchEarnings();
    if (!this.state.earningsData) return;

    const summary = this.state.earningsData.summary || {};
    document.getElementById('kpiTotalPayouts').textContent = `R$ ${parseFloat(summary.total_repasse_parceiros || 0).toFixed(2).replace('.', ',')}`;
    document.getElementById('kpiHotelGross').textContent = `R$ ${parseFloat(summary.total_receita_hotelaria || 0).toFixed(2).replace('.', ',')}`;
    document.getElementById('kpiInscriptionsGross').textContent = `R$ ${parseFloat(summary.total_receita_inscricoes || 0).toFixed(2).replace('.', ',')}`;
    document.getElementById('kpiHotelLeadsCount').textContent = `${summary.total_leads_hotelaria || 0} solicitações geradas`;

    this.renderEarningsPartners();
  },

  renderEarningsPartners() {
    const tbody = document.getElementById('earningsTableBody');
    if (!tbody || !this.state.earningsData) return;

    const searchTerm = (document.getElementById('earningsPartnerSearch')?.value || '').toLowerCase();
    let partners = this.state.earningsData.data || [];

    if (searchTerm) {
      partners = partners.filter(p => 
        (p.parceiro_nome && p.parceiro_nome.toLowerCase().includes(searchTerm)) ||
        (p.chave_pix && p.chave_pix.toLowerCase().includes(searchTerm))
      );
    }

    if (partners.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 30px; color: var(--text-muted);">Nenhum registro de parceiro localizado.</td></tr>`;
      return;
    }

    const isAdmin = this.state.currentUser?.perfil === 'ADMIN';

    tbody.innerHTML = partners.map(p => {
      const inscrRate = parseFloat(p.comissao_inscricao_pct || 10).toFixed(1);
      const hotelRate = parseFloat(p.comissao_hotelaria_pct || 8).toFixed(1);
      const inscrEarn = parseFloat(p.ganho_comissao_inscricoes || 0).toFixed(2);
      const hotelEarn = parseFloat(p.ganho_comissao_hotelaria || 0).toFixed(2);
      const totalEarn = parseFloat(p.ganho_total_acumulado || 0).toFixed(2);

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <img src="${p.parceiro_logo || 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=60'}" style="width: 32px; height: 32px; border-radius: 6px; object-fit: cover;">
              <div>
                <strong style="color: #0F172A; display: block;">${this.escapeHtml(p.parceiro_nome)}</strong>
                <small style="color: var(--text-muted);">${this.escapeHtml(p.parceiro_categoria || 'Parceiro')}</small>
              </div>
            </div>
          </td>
          <td><span class="badge-commission-inscr">${inscrRate}%</span></td>
          <td><span class="badge-commission-hotel">${hotelRate}%</span></td>
          <td><strong style="color: #047857;">R$ ${inscrEarn.replace('.', ',')}</strong> <small style="display: block; color: var(--text-dim);">${p.total_inscritos || 0} inscritos</small></td>
          <td><strong style="color: #1D4ED8;">R$ ${hotelEarn.replace('.', ',')}</strong> <small style="display: block; color: var(--text-dim);">${p.total_reservas_confirmadas || 0} reservas</small></td>
          <td><span class="badge-commission-total">R$ ${totalEarn.replace('.', ',')}</span></td>
          <td>
            ${p.chave_pix ? `<span class="badge-pix-key"><i class="fa-brands fa-pix" style="color: #059669;"></i> ${this.escapeHtml(p.chave_pix)}</span>` : '<span style="color: var(--text-dim); font-size: 11px;">Não cadastrada</span>'}
          </td>
          <td>
            <div style="display: flex; gap: 6px;">
              ${isAdmin ? `
                <button class="btn btn-outline btn-sm" onclick="app.openPartnerCommissionsModal(${p.parceiro_id})" title="Configurar % e PIX (Exclusivo ADM)">
                  <i class="fa-solid fa-gear"></i>
                </button>
              ` : `
                <button class="btn btn-outline btn-sm" disabled style="opacity: 0.5; cursor: not-allowed;" title="Ajuste de taxas restrito ao Administrador">
                  <i class="fa-solid fa-lock"></i>
                </button>
              `}
              <button class="btn btn-secondary btn-sm" onclick="app.openPartnerStatementModal(${p.parceiro_id})" title="Extrato Detalhado">
                <i class="fa-solid fa-file-invoice-dollar"></i> Extrato
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  openPartnerCommissionsModal(partnerId) {
    if (this.state.currentUser?.perfil !== 'ADMIN') {
      this.showToast('Apenas o Administrador (ADM) tem autorização para alterar taxas de comissão.', 'error');
      return;
    }

    const partner = this.state.partners.find(p => p.id === partnerId) || (this.state.earningsData?.data?.find(p => p.parceiro_id === partnerId));
    if (!partner) return;

    document.getElementById('commModalPartnerId').value = partner.id || partner.parceiro_id;
    document.getElementById('commModalPartnerName').textContent = partner.nome_fantasia || partner.parceiro_nome;
    document.getElementById('commInscricaoPct').value = partner.comissao_inscricao_pct || 10.0;
    document.getElementById('commHotelariaPct').value = partner.comissao_hotelaria_pct || 8.0;
    document.getElementById('commChavePix').value = partner.chave_pix || '';
    document.getElementById('commBancoRepasse').value = partner.banco_repasse || '';

    this.openModal('partnerCommissionsModal');
  },

  async handleSavePartnerCommissions(event) {
    event.preventDefault();
    const partnerId = document.getElementById('commModalPartnerId').value;
    const payload = {
      comissao_inscricao_pct: parseFloat(document.getElementById('commInscricaoPct').value),
      comissao_hotelaria_pct: parseFloat(document.getElementById('commHotelariaPct').value),
      chave_pix: document.getElementById('commChavePix').value.trim(),
      banco_repasse: document.getElementById('commBancoRepasse').value.trim(),
    };

    try {
      const res = await this.apiFetch(`/api/earnings/partner/${partnerId}/commissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        this.showToast('Taxas de comissão atualizadas com sucesso!', 'success');
        this.closeModal('partnerCommissionsModal');
        await this.refreshAll();
      } else {
        this.showToast(json.message || 'Erro ao salvar taxas', 'error');
      }
    } catch (err) {
      console.error('Erro ao salvar taxas:', err);
      this.showToast('Erro de comunicação com o servidor.', 'error');
    }
  },

  async openPartnerStatementModal(partnerId) {
    try {
      const res = await this.apiFetch(`/api/earnings/partner/${partnerId}`);
      const json = await res.json();
      if (!json.success || !json.data) {
        this.showToast('Erro ao carregar extrato.', 'error');
        return;
      }

      const d = json.data;
      document.getElementById('stmtModalPartnerName').textContent = `Extrato: ${d.parceiro.nome_fantasia}`;
      document.getElementById('stmtModalPartnerMeta').textContent = `CNPJ: ${d.parceiro.cnpj || 'Não informado'} • Chave PIX: ${d.parceiro.chave_pix || 'Pendente'}`;

      const container = document.getElementById('partnerStatementBody');
      container.innerHTML = `
        <!-- Banner de Totais -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px;">
          <div style="background: #F0FDF4; border: 1px solid #BBF7D0; padding: 14px; border-radius: 12px;">
            <span style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase;">Ganhos Inscrições (${d.parceiro.comissao_inscricao_pct}%)</span>
            <h3 style="font-size: 18px; font-weight: 800; color: #166534; margin-top: 4px;">R$ ${d.totais.ganho_inscricoes.replace('.', ',')}</h3>
          </div>
          <div style="background: #EFF6FF; border: 1px solid #BFDBFE; padding: 14px; border-radius: 12px;">
            <span style="font-size: 11px; font-weight: 700; color: #1E40AF; text-transform: uppercase;">Ganhos Hotelaria (${d.parceiro.comissao_hotelaria_pct}%)</span>
            <h3 style="font-size: 18px; font-weight: 800; color: #1E40AF; margin-top: 4px;">R$ ${d.totais.ganho_hotelaria.replace('.', ',')}</h3>
          </div>
          <div style="background: #FEF3C7; border: 1px solid #FDE68A; padding: 14px; border-radius: 12px;">
            <span style="font-size: 11px; font-weight: 700; color: #92400E; text-transform: uppercase;">Hotelaria Pendente</span>
            <h3 style="font-size: 18px; font-weight: 800; color: #92400E; margin-top: 4px;">R$ ${d.totais.pendente_hotelaria.replace('.', ',')}</h3>
          </div>
          <div style="background: #FAF5FF; border: 1px solid #E9D5FF; padding: 14px; border-radius: 12px;">
            <span style="font-size: 11px; font-weight: 700; color: #6B21A8; text-transform: uppercase;">Total a Repassar (PIX)</span>
            <h3 style="font-size: 18px; font-weight: 800; color: #6B21A8; margin-top: 4px;">R$ ${d.totais.saldo_total_receber.replace('.', ',')}</h3>
          </div>
        </div>

        <h4 style="font-size: 14px; font-weight: 800; color: #0F172A; margin: 18px 0 8px 0;">
          <i class="fa-solid fa-calendar-check" style="color: var(--primary);"></i> Inscrições por Evento Realizado
        </h4>
        <table class="data-table" style="margin-bottom: 24px;">
          <thead>
            <tr>
              <th>Evento</th>
              <th>Modalidade</th>
              <th>Inscritos</th>
              <th>Receita Bruta</th>
              <th>Comissão (${d.parceiro.comissao_inscricao_pct}%)</th>
            </tr>
          </thead>
          <tbody>
            ${d.eventos.map(ev => `
              <tr>
                <td><strong>${this.escapeHtml(ev.nome)}</strong></td>
                <td><span class="modality-pill" style="font-size: 11px; padding: 2px 6px;">${this.escapeHtml(ev.modalidade)}</span></td>
                <td>${ev.total_inscritos || 0}</td>
                <td>R$ ${parseFloat(ev.receita_inscricoes || 0).toFixed(2).replace('.', ',')}</td>
                <td><strong style="color: #047857;">R$ ${parseFloat(ev.comissao_parceiro || 0).toFixed(2).replace('.', ',')}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h4 style="font-size: 14px; font-weight: 800; color: #0F172A; margin: 18px 0 8px 0;">
          <i class="fa-solid fa-hotel" style="color: #0284C7;"></i> Reservas de Hospedagem de Atletas e Familiares
        </h4>
        <table class="data-table">
          <thead>
            <tr>
              <th>Hóspede</th>
              <th>Evento</th>
              <th>Hotel UNYCO</th>
              <th>Hóspedes</th>
              <th>Valor Reserva</th>
              <th>Comissão (${d.parceiro.comissao_hotelaria_pct}%)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${d.reservas_hotelaria.length === 0 ? `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 18px;">Nenhuma reserva de hotel vinculada até o momento.</td></tr>` : 
              d.reservas_hotelaria.map(r => `
                <tr>
                  <td><strong>${this.escapeHtml(r.nome_hospede)}</strong></td>
                  <td>${this.escapeHtml(r.evento_nome)}</td>
                  <td>${this.escapeHtml(r.hotel_nome || 'Curadoria UNYCO')}</td>
                  <td>${r.qtd_hospedes} pessoa(s)</td>
                  <td>R$ ${parseFloat(r.valor_total_estimado || 0).toFixed(2).replace('.', ',')}</td>
                  <td><strong style="color: #1D4ED8;">R$ ${parseFloat(r.comissao_parceiro_valor || 0).toFixed(2).replace('.', ',')}</strong></td>
                  <td><span class="event-status-badge status-res-${r.status.toLowerCase()}" style="font-size: 11px;">${r.status}</span></td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      `;

      this.openModal('partnerStatementModal');
    } catch (err) {
      console.error('Erro ao abrir demonstrativo:', err);
      this.showToast('Erro ao consultar demonstrativo do parceiro', 'error');
    }
  },

  // ==========================================================
  // CURADORIA DE HOTÉIS UNYCO
  // ==========================================================
  async fetchHotels() {
    try {
      const res = await this.apiFetch('/api/hotels');
      const json = await res.json();
      if (json.success) {
        this.state.hotels = json.data;
        this.populateHotelCityFilter();
        this.renderHotels();
      }
    } catch (err) {
      console.error('Erro ao buscar hotéis:', err);
    }
  },

  async loadHotelsData() {
    await this.fetchHotels();
  },

  populateHotelCityFilter() {
    const select = document.getElementById('hotelCityFilter');
    if (!select) return;
    const cities = [...new Set(this.state.hotels.map(h => h.cidade).filter(Boolean))];
    select.innerHTML = '<option value="">Todas as Cidades</option>' + cities.map(c => `<option value="${c}">${c}</option>`).join('');
  },

  filterHotels() {
    this.renderHotels();
  },

  renderHotels() {
    const container = document.getElementById('hotelsGridContainer');
    if (!container) return;

    const searchTerm = (document.getElementById('hotelSearchInput')?.value || '').toLowerCase();
    const cityFilter = document.getElementById('hotelCityFilter')?.value || '';

    let filtered = this.state.hotels;
    if (searchTerm) {
      filtered = filtered.filter(h => 
        h.nome.toLowerCase().includes(searchTerm) || 
        h.cidade.toLowerCase().includes(searchTerm) ||
        (h.endereco && h.endereco.toLowerCase().includes(searchTerm))
      );
    }
    if (cityFilter) {
      filtered = filtered.filter(h => h.cidade === cityFilter);
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
          <i class="fa-solid fa-hotel" style="font-size: 32px; color: #CBD5E1; margin-bottom: 12px; display: block;"></i>
          Nenhum hotel localizado. Clique em <strong>"Novo Hotel na Curadoria"</strong> para adicionar o primeiro hotel.
        </div>
      `;
      return;
    }

    const canManageHotels = this.state.currentUser?.perfil === 'ADMIN' || this.state.currentUser?.perfil === 'CONSULTOR';

    container.innerHTML = filtered.map(h => {
      const stars = '★'.repeat(h.categoria_estrelas || 4);
      const amenities = (h.comodidades || '')
        .split(',')
        .map(a => `<span class="amenity-chip" style="font-size: 11px; background: #F8FAFC; border: 1px solid #E2E8F0; padding: 2px 6px; border-radius: 4px;">${a.trim()}</span>`)
        .slice(0, 3)
        .join('');

      return `
        <div class="hotel-card">
          <div class="hotel-card-cover">
            <img src="${h.foto_url || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600'}" alt="${this.escapeHtml(h.nome)}">
            <span class="hotel-card-stars-pill">${stars}</span>
          </div>
          <div class="hotel-card-body">
            <div>
              <h3 class="hotel-title-h3">${this.escapeHtml(h.nome)}</h3>
              <span class="hotel-location-text">
                <i class="fa-solid fa-location-dot" style="color: #0284C7;"></i> ${this.escapeHtml(h.cidade)} - ${h.estado} • ${this.escapeHtml(h.endereco || '')}
              </span>
              
              <div class="hotel-rates-box">
                <div class="hotel-rate-row">
                  <span style="color: var(--text-muted);">Tarifa Padrão Balcão:</span>
                  <span style="text-decoration: line-through; color: #94A3B8;">R$ ${parseFloat(h.tarifa_media).toFixed(2)}</span>
                </div>
                <div class="hotel-rate-row">
                  <span style="font-weight: 700; color: #047857;"><i class="fa-solid fa-tag"></i> Tarifa Atleta UNYCO:</span>
                  <span class="hotel-rate-atleta">R$ ${parseFloat(h.tarifa_atleta_desconto).toFixed(2)} <small style="font-size: 10px; font-weight: normal; color: var(--text-muted);">/noite</small></span>
                </div>
              </div>

              <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px;">${amenities}</div>
            </div>

            <div style="display: flex; gap: 8px; margin-top: 16px;">
              <span class="badge" style="background: #F0F9FF; color: #0369A1; font-size: 11px;">
                <i class="fa-solid fa-calendar-check"></i> ${h.total_eventos_vinculados || 0} eventos vinculados
              </span>
              <span class="badge" style="background: #ECFDF5; color: #047857; font-size: 11px;">
                <i class="fa-solid fa-users"></i> ${h.total_reservas_geradas || 0} reservas
              </span>
            </div>
          </div>
          <div class="hotel-card-footer">
            ${canManageHotels ? `
              <button class="btn btn-outline btn-sm" onclick="app.openEditHotelModal(${h.id})">
                <i class="fa-solid fa-pen-to-square"></i> Editar
              </button>
              <button class="btn btn-outline btn-sm" onclick="app.handleDeleteHotel(${h.id})" style="color: #EF4444;" title="Excluir Hotel">
                <i class="fa-solid fa-trash"></i>
              </button>
            ` : `
              <span style="font-size: 11px; color: var(--text-muted);"><i class="fa-solid fa-eye"></i> Curadoria UNYCO</span>
            `}
          </div>
        </div>
      `;
    }).join('');
  },

  openCreateHotelModal() {
    document.getElementById('hotelFormId').value = '';
    document.getElementById('hotelModalTitle').textContent = 'Novo Hotel na Curadoria UNYCO';
    document.getElementById('hotelForm').reset();
    document.getElementById('hotelCidade').value = 'São Paulo';
    document.getElementById('hotelEstado').value = 'SP';
    document.getElementById('hotelEstrelas').value = '4';
    this.openModal('hotelModal');
  },

  openEditHotelModal(hotelId) {
    const hotel = this.state.hotels.find(h => h.id === hotelId);
    if (!hotel) return;

    document.getElementById('hotelFormId').value = hotel.id;
    document.getElementById('hotelModalTitle').textContent = `Editar Hotel: ${hotel.nome}`;
    document.getElementById('hotelNome').value = hotel.nome;
    document.getElementById('hotelEstrelas').value = hotel.categoria_estrelas || 4;
    document.getElementById('hotelCidade').value = hotel.cidade;
    document.getElementById('hotelEstado').value = hotel.estado || 'SP';
    document.getElementById('hotelEndereco').value = hotel.endereco || '';
    document.getElementById('hotelTarifaMedia').value = hotel.tarifa_media;
    document.getElementById('hotelTarifaAtleta').value = hotel.tarifa_atleta_desconto;
    document.getElementById('hotelFotoUrl').value = hotel.foto_url || '';
    document.getElementById('hotelComodidades').value = hotel.comodidades || '';
    document.getElementById('hotelTelefone').value = hotel.telefone_contato || '';
    document.getElementById('hotelEmail').value = hotel.email_reservas || '';

    this.openModal('hotelModal');
  },

  async handleSaveHotel(event) {
    event.preventDefault();
    const id = document.getElementById('hotelFormId').value;
    const payload = {
      nome: document.getElementById('hotelNome').value.trim(),
      categoria_estrelas: parseInt(document.getElementById('hotelEstrelas').value, 10),
      cidade: document.getElementById('hotelCidade').value.trim(),
      estado: document.getElementById('hotelEstado').value.trim(),
      endereco: document.getElementById('hotelEndereco').value.trim(),
      tarifa_media: parseFloat(document.getElementById('hotelTarifaMedia').value),
      tarifa_atleta_desconto: parseFloat(document.getElementById('hotelTarifaAtleta').value),
      foto_url: document.getElementById('hotelFotoUrl').value.trim(),
      comodidades: document.getElementById('hotelComodidades').value.trim(),
      telefone_contato: document.getElementById('hotelTelefone').value.trim(),
      email_reservas: document.getElementById('hotelEmail').value.trim(),
    };

    try {
      const url = id ? `/api/hotels/${id}` : '/api/hotels';
      const method = id ? 'PUT' : 'POST';

      const res = await this.apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (json.success) {
        this.showToast(json.message || 'Hotel salvo com sucesso!', 'success');
        this.closeModal('hotelModal');
        await this.fetchHotels();
      } else {
        this.showToast(json.message || 'Erro ao salvar hotel', 'error');
      }
    } catch (err) {
      console.error('Erro ao salvar hotel:', err);
      this.showToast('Erro de comunicação com o servidor.', 'error');
    }
  },

  async handleDeleteHotel(hotelId) {
    if (!confirm('Deseja realmente remover este hotel da curadoria UNYCO?')) return;
    try {
      const res = await this.apiFetch(`/api/hotels/${hotelId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        this.showToast('Hotel removido da curadoria.', 'info');
        await this.fetchHotels();
      } else {
        this.showToast(json.message || 'Erro ao remover hotel', 'error');
      }
    } catch (err) {
      console.error('Erro ao deletar hotel:', err);
      this.showToast('Erro de comunicação com o servidor.', 'error');
    }
  },

  // Vincular hotéis ao evento
  openLinkHotelsModal(eventId) {
    const ev = this.state.events.find(e => e.id === eventId);
    if (!ev) return;

    document.getElementById('linkHotelEventId').value = ev.id;
    document.getElementById('linkHotelEventTitle').textContent = `Vincular Hotel ao Evento: ${ev.nome}`;
    
    // Popular dropdown de hotéis
    const select = document.getElementById('linkHotelSelect');
    select.innerHTML = '<option value="">Selecione o hotel...</option>' + 
      this.state.hotels.map(h => `<option value="${h.id}">${h.nome} (${h.cidade} - R$ ${parseFloat(h.tarifa_atleta_desconto).toFixed(2)})</option>`).join('');

    document.getElementById('linkHotelCupom').value = `${ev.nome.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)}2026`;
    this.openModal('eventHotelLinkModal');
  },

  async handleLinkHotelToEvent(event) {
    event.preventDefault();
    const eventId = document.getElementById('linkHotelEventId').value;
    const payload = {
      hotel_id: parseInt(document.getElementById('linkHotelSelect').value, 10),
      distancia_evento_km: parseFloat(document.getElementById('linkHotelDistancia').value || 1.5),
      desconto_percentual: parseFloat(document.getElementById('linkHotelDescontoPct').value || 15),
      cupom_desconto: document.getElementById('linkHotelCupom').value.trim(),
      destaque: true,
    };

    try {
      const res = await this.apiFetch(`/api/hotels/event/${eventId}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        this.showToast('Hotel vinculado ao evento com sucesso!', 'success');
        this.closeModal('eventHotelLinkModal');
      } else {
        this.showToast(json.message || 'Erro ao vincular hotel', 'error');
      }
    } catch (err) {
      console.error('Erro ao vincular hotel:', err);
      this.showToast('Erro de comunicação com o servidor.', 'error');
    }
  },

  // ==========================================================
  // LEADS E RESERVAS DE HOSPEDAGEM
  // ==========================================================
  async fetchHotelLeads() {
    try {
      const res = await this.apiFetch('/api/earnings/hotel-leads');
      const json = await res.json();
      if (json.success) {
        this.state.hotelLeads = json.data;
        this.renderHotelLeads();
      }
    } catch (err) {
      console.error('Erro ao buscar leads de hotelaria:', err);
    }
  },

  async loadHotelLeadsData() {
    await this.fetchHotelLeads();
  },

  filterHotelLeads() {
    this.renderHotelLeads();
  },

  renderHotelLeads() {
    const tbody = document.getElementById('hotelLeadsTableBody');
    if (!tbody) return;

    const searchTerm = (document.getElementById('hotelLeadsSearchInput')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('hotelLeadStatusFilter')?.value || '';

    let list = this.state.hotelLeads || [];
    if (searchTerm) {
      list = list.filter(l => 
        l.nome_hospede.toLowerCase().includes(searchTerm) ||
        (l.evento_nome && l.evento_nome.toLowerCase().includes(searchTerm)) ||
        (l.hotel_nome && l.hotel_nome.toLowerCase().includes(searchTerm))
      );
    }
    if (statusFilter) {
      list = list.filter(l => l.status === statusFilter);
    }

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 30px; color: var(--text-muted);">Nenhuma solicitação de hospedagem localizada.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(l => {
      const valor = parseFloat(l.valor_total_estimado || 0).toFixed(2);
      const comissao = parseFloat(l.comissao_parceiro_valor || 0).toFixed(2);
      const isConfirmed = l.status === 'Confirmada';
      const isPending = l.status === 'Pendente';

      return `
        <tr>
          <td>
            <strong style="color: #0F172A; display: block;">${this.escapeHtml(l.nome_hospede)}</strong>
            <small style="color: var(--text-muted);"><i class="fa-solid fa-phone"></i> ${this.escapeHtml(l.telefone)}</small>
          </td>
          <td><span class="modality-pill" style="font-size: 11px; padding: 2px 6px;">${this.escapeHtml(l.tipo_publico || 'Atleta')}</span></td>
          <td>
            <strong style="color: var(--primary);">${this.escapeHtml(l.evento_nome)}</strong>
            <small style="display: block; color: var(--text-dim);">${this.escapeHtml(l.parceiro_nome)}</small>
          </td>
          <td>
            <strong>${this.escapeHtml(l.hotel_nome || 'Hotel UNYCO')}</strong>
            <small style="display: block; color: var(--text-dim);">${l.qtd_hospedes} hóspede(s)</small>
          </td>
          <td><span style="font-size: 12px; color: var(--text-muted);">${l.data_checkin ? new Date(l.data_checkin).toLocaleDateString('pt-BR') : 'A definir'}</span></td>
          <td><strong>R$ ${valor.replace('.', ',')}</strong></td>
          <td><strong style="color: #1D4ED8;">R$ ${comissao.replace('.', ',')}</strong> <small style="display: block; color: var(--text-dim);">(${l.comissao_parceiro_pct}%)</small></td>
          <td><span class="event-status-badge status-res-${l.status.toLowerCase()}">${l.status}</span></td>
          <td>
            <div style="display: flex; gap: 4px;">
              ${isPending ? `
                <button class="btn btn-sm btn-primary" onclick="app.updateLeadStatus(${l.id}, 'Confirmada', ${l.valor_total_estimado})" style="padding: 4px 8px; font-size: 11px;" title="Confirmar Reserva">
                  <i class="fa-solid fa-check"></i>
                </button>
                <button class="btn btn-sm btn-outline" onclick="app.updateLeadStatus(${l.id}, 'Cancelada', ${l.valor_total_estimado})" style="padding: 4px 8px; font-size: 11px; color: #EF4444;" title="Cancelar Reserva">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              ` : isConfirmed ? `
                <button class="btn btn-sm btn-outline" onclick="app.updateLeadStatus(${l.id}, 'Pendente', ${l.valor_total_estimado})" style="padding: 4px 8px; font-size: 11px;" title="Reabrir">
                  <i class="fa-solid fa-rotate-left"></i>
                </button>
              ` : `
                <button class="btn btn-sm btn-outline" onclick="app.updateLeadStatus(${l.id}, 'Confirmada', ${l.valor_total_estimado})" style="padding: 4px 8px; font-size: 11px;" title="Reativar">
                  <i class="fa-solid fa-rotate-left"></i>
                </button>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  async updateLeadStatus(leadId, newStatus, currentAmount) {
    try {
      const res = await this.apiFetch(`/api/earnings/hotel-leads/${leadId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, valor_total_estimado: currentAmount }),
      });
      const json = await res.json();
      if (json.success) {
        this.showToast(`Reserva marcada como ${newStatus}!`, 'success');
        await this.refreshAll();
      } else {
        this.showToast(json.message || 'Erro ao atualizar status', 'error');
      }
    } catch (err) {
      console.error('Erro ao atualizar status do lead:', err);
      this.showToast('Erro de comunicação com o servidor.', 'error');
    }
  },

  // ==========================================================
  // HELPERS DE MODAIS, TOASTS E UTILITÁRIOS
  // ==========================================================
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success' ? 'fa-circle-check' :
                 type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info';

    toast.innerHTML = `
      <i class="fa-solid ${icon}"></i>
      <span>${this.escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

var app = window.app;

// Inicializar aplicação ao carregar o DOM ou imediatamente se DOM já estiver carregado
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.app.init();
  });
} else {
  window.app.init();
}
