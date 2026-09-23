/**
 * UNYCO ESPORTE - Public Landing Page & Hotel Curation Script
 * Suporta acesso por ID do evento (?id=X) e por ID do parceiro/academia (?parceiro=X ou ?partnerId=X)
 */

const lp = {
  eventId: null,
  partnerId: null,
  eventData: null,
  partnerData: null,
  curatedHotels: [],
  selectedHotelId: null,

  init() {
    const params = new URLSearchParams(window.location.search);
    this.partnerId = params.get('carteira') || params.get('parceiro') || params.get('partnerId') || params.get('partner');
    this.eventId = params.get('id') || params.get('eventId');

    if (!this.partnerId && !this.eventId) {
      this.showNotFound('Página Não Encontrada', 'Por favor informe o link oficial do evento ou da academia/parceiro.');
      return;
    }

    if (this.partnerId && !this.eventId) {
      // Abre o Hub Oficial do Parceiro para os alunos e atletas
      this.loadPartnerHub();
    } else {
      // Abre a página do evento
      if (this.partnerId) {
        this.fetchPartnerData(this.partnerId);
      }
      this.loadEventAndHotels();
    }
  },

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

  resolveImageUrl(url, fallback = 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=150') {
    if (!url || typeof url !== 'string' || !url.trim()) return fallback;
    const trimmed = url.trim();
    if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    return this.urlWithBase(trimmed.startsWith('/') ? trimmed : `/${trimmed}`);
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  showNotFound(title = 'Página Não Encontrada', text = 'O link acessado é inválido ou o conteúdo não existe mais.') {
    document.getElementById('lpLoading').style.display = 'none';
    const notFoundEl = document.getElementById('lpNotFound');
    if (notFoundEl) {
      notFoundEl.style.display = 'block';
      const titleEl = document.getElementById('lpNotFoundTitle');
      const textEl = document.getElementById('lpNotFoundText');
      if (titleEl) titleEl.textContent = title;
      if (textEl) textEl.textContent = text;
    }
    document.getElementById('lpContent').style.display = 'none';
    const hub = document.getElementById('lpPartnerHub');
    if (hub) hub.style.display = 'none';
  },

  async fetchPartnerData(id) {
    try {
      const res = await fetch(this.urlWithBase(`/api/partners/${id}`));
      const json = await res.json();
      if (json.success && json.data) {
        this.partnerData = json.data;
        this.updateBackButton();
        this.updatePartnerReferralBanner();
      }
    } catch (e) {
      console.warn('Erro ao carregar dados do parceiro:', e);
    }
  },

  updateBackButton() {
    const nav = document.getElementById('lpBackNavContainer');
    const text = document.getElementById('lpBackPartnerText');
    if (nav && this.partnerData) {
      nav.style.display = 'block';
      if (text) {
        text.textContent = `Voltar para todos os eventos de ${this.partnerData.nome_fantasia}`;
      }
    }
  },

  updatePartnerReferralBanner() {
    const badge = document.getElementById('lpPartnerReferralBadge');
    const nameEl = document.getElementById('lpPartnerReferralName');
    if (badge && this.partnerData && this.partnerId) {
      badge.style.display = 'flex';
      if (nameEl) nameEl.textContent = this.partnerData.nome_fantasia;
    }
  },

  async loadPartnerHub() {
    try {
      document.getElementById('lpLoading').style.display = 'block';
      document.getElementById('lpNotFound').style.display = 'none';
      document.getElementById('lpContent').style.display = 'none';
      const hub = document.getElementById('lpPartnerHub');
      if (hub) hub.style.display = 'none';

      const res = await fetch(this.urlWithBase(`/api/partners/${this.partnerId}`));
      const json = await res.json();

      if (!json.success || !json.data) {
        this.showNotFound('Academia / Parceiro Não Encontrado', 'O link informado para esta academia ou parceiro não foi localizado no sistema.');
        return;
      }

      this.partnerData = json.data;
      this.renderPartnerHub();
    } catch (err) {
      console.error('Erro ao carregar hub do parceiro:', err);
      this.showNotFound('Erro de Carregamento', 'Não foi possível carregar a página da academia. Tente novamente mais tarde.');
    }
  },

  renderPartnerHub() {
    const p = this.partnerData;
    document.getElementById('lpLoading').style.display = 'none';
    document.getElementById('lpNotFound').style.display = 'none';
    document.getElementById('lpContent').style.display = 'none';
    const hub = document.getElementById('lpPartnerHub');
    if (hub) hub.style.display = 'block';

    // Top Header do Parceiro
    const logoImg = document.getElementById('hubPartnerLogo');
    if (logoImg) {
      logoImg.src = this.resolveImageUrl(p.logo_url);
      logoImg.onerror = () => { logoImg.src = 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=150'; };
    }

    const nameEl = document.getElementById('hubPartnerName');
    if (nameEl) nameEl.textContent = p.nome_fantasia;

    const catEl = document.getElementById('hubPartnerCategory');
    if (catEl) catEl.textContent = `${p.categoria || 'Academia'} • Parceiro Oficial UNYCO`;

    // WhatsApp botão de contato
    const waBtn = document.getElementById('hubWhatsappBtn');
    if (waBtn) {
      if (p.telefone) {
        const phoneClean = p.telefone.replace(/\D/g, '');
        const phoneFull = phoneClean.length <= 11 ? `55${phoneClean}` : phoneClean;
        const msg = encodeURIComponent(`Olá equipe da ${p.nome_fantasia}! Sou atleta/aluno e estou entrando em contato através do portal oficial de eventos.`);
        waBtn.href = `https://wa.me/${phoneFull}?text=${msg}`;
        waBtn.style.display = 'inline-flex';
      } else {
        waBtn.style.display = 'none';
      }
    }

    // Grid de Eventos
    const events = p.eventos || [];
    const countBadge = document.getElementById('hubEventsCountBadge');
    if (countBadge) {
      countBadge.textContent = `${events.length} evento${events.length === 1 ? '' : 's'} no calendário`;
    }

    const grid = document.getElementById('hubEventsGrid');
    const noEvents = document.getElementById('hubNoEvents');

    if (events.length === 0) {
      if (grid) grid.innerHTML = '';
      if (noEvents) noEvents.style.display = 'block';
      return;
    }

    if (noEvents) noEvents.style.display = 'none';
    if (grid) {
      grid.innerHTML = events.map(e => {
        const dateObj = new Date(e.data_inicio);
        const formattedDate = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        const valor = parseFloat(e.valor_inscricao || 0);
        const priceStr = valor > 0 ? `R$ ${valor.toFixed(2).replace('.', ',')}` : 'Inscrição Gratuita';
        const remaining = (e.capacidade || 100) - (e.total_inscritos || 0);

        return `
          <div class="hub-event-card">
            <div class="hub-event-banner-wrap">
              <img class="hub-event-banner" src="${this.resolveImageUrl(e.banner_url, 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=600')}" alt="${this.escapeHtml(e.nome)}" onerror="this.src='https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=600'">
              <span class="event-status-badge ${e.status === 'Agendado' ? 'status-agendado' : 'status-emandamento'}" style="position: absolute; top: 12px; right: 12px;">${e.status}</span>
            </div>
            <div class="hub-event-content">
              <div>
                <span style="font-size: 11px; font-weight: 700; color: #0284C7; text-transform: uppercase;">
                  <i class="fa-solid fa-trophy"></i> ${this.escapeHtml(e.modalidade || 'Competição')}
                </span>
                <h3 class="hub-event-title">${this.escapeHtml(e.nome)}</h3>
                
                <div class="hub-event-meta">
                  <div class="hub-event-meta-item">
                    <i class="fa-regular fa-calendar-days"></i>
                    <span>${formattedDate}</span>
                  </div>
                  <div class="hub-event-meta-item">
                    <i class="fa-solid fa-location-dot"></i>
                    <span>${this.escapeHtml(e.cidade || 'SP')} • ${this.escapeHtml(e.local || '')}</span>
                  </div>
                  <div class="hub-event-meta-item">
                    <i class="fa-solid fa-hotel"></i>
                    <span style="color: #059669; font-weight: 600;">Descontos exclusivos em hotéis</span>
                  </div>
                </div>
              </div>

              <div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding-top: 10px; border-top: 1px solid #E2E8F0;">
                  <span style="font-size: 16px; font-weight: 800; color: #059669;">${priceStr}</span>
                  <span style="font-size: 11px; color: var(--text-muted);">${Math.max(0, remaining)} vagas</span>
                </div>
                <button class="btn btn-primary" onclick="lp.selectEventFromPartner(${e.id})" style="width: 100%; justify-content: center; padding: 12px; font-weight: 700;">
                  <i class="fa-solid fa-ticket"></i> Inscrição Oficial & Hotéis
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  },

  selectEventFromPartner(eventId) {
    this.eventId = eventId;
    const nav = document.getElementById('lpBackNavContainer');
    const text = document.getElementById('lpBackPartnerText');
    if (nav) {
      nav.style.display = 'block';
      if (text && this.partnerData) {
        text.textContent = `Voltar para todos os eventos de ${this.partnerData.nome_fantasia}`;
      }
    }
    const hub = document.getElementById('lpPartnerHub');
    if (hub) hub.style.display = 'none';
    document.getElementById('lpLoading').style.display = 'block';
    this.loadEventAndHotels();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  showPartnerHub() {
    this.eventId = null;
    const nav = document.getElementById('lpBackNavContainer');
    if (nav) nav.style.display = 'none';
    document.getElementById('lpContent').style.display = 'none';
    const hub = document.getElementById('lpPartnerHub');
    if (hub) hub.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  async loadEventAndHotels() {
    try {
      const [evRes, hotRes] = await Promise.all([
        fetch(this.urlWithBase(`/api/events/${this.eventId}`)),
        fetch(this.urlWithBase(`/api/hotels/event/${this.eventId}`))
      ]);

      const evJson = await evRes.json();
      const hotJson = await hotRes.json();

      if (!evJson.success || !evJson.data) {
        this.showNotFound('Evento Não Encontrado', 'O link acessado é inválido ou o evento não existe mais.');
        return;
      }

      this.eventData = evJson.data;
      this.curatedHotels = hotJson.success && hotJson.data ? hotJson.data : [];

      if (!this.partnerData && this.eventData.parceiro_id) {
        this.fetchPartnerData(this.eventData.parceiro_id);
      }

      this.renderEvent();
      this.renderHotels();
    } catch (err) {
      console.error('Erro ao carregar dados do evento e hotéis:', err);
      this.showNotFound();
    }
  },

  renderEvent() {
    const ev = this.eventData;

    document.getElementById('lpLoading').style.display = 'none';
    document.getElementById('lpNotFound').style.display = 'none';
    const hub = document.getElementById('lpPartnerHub');
    if (hub) hub.style.display = 'none';
    document.getElementById('lpContent').style.display = 'grid';

    // Banner & Título
    document.getElementById('lpEventBanner').src = this.resolveImageUrl(ev.banner_url, 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=800');
    document.getElementById('lpEventTitle').textContent = ev.nome;

    // Categoria
    const catBadge = document.getElementById('lpEventCategory');
    if (ev.categoria_nome) {
      catBadge.style.display = 'inline-flex';
      catBadge.style.background = ev.categoria_cor || '#0284C7';
      catBadge.innerHTML = `<i class="fa-solid ${ev.categoria_icone || 'fa-trophy'}"></i> ${ev.categoria_nome}`;
    }

    // Status
    const statusBadge = document.getElementById('lpEventStatus');
    statusBadge.textContent = ev.status;
    statusBadge.className = `event-status-badge ${
      ev.status === 'Agendado' ? 'status-agendado' :
      ev.status === 'Em Andamento' ? 'status-emandamento' :
      ev.status === 'Concluído' ? 'status-concluido' : 'status-cancelado'
    }`;

    // Parceiro
    document.getElementById('lpPartnerName').textContent = ev.parceiro_nome;
    const partnerLogo = document.getElementById('lpPartnerLogo');
    partnerLogo.src = this.resolveImageUrl(ev.parceiro_logo, 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=100');

    // Preço
    const priceSpan = document.getElementById('lpEventPrice');
    const valor = parseFloat(ev.valor_inscricao || 0);
    if (valor > 0) {
      priceSpan.textContent = `R$ ${valor.toFixed(2).replace('.', ',')}`;
    } else {
      priceSpan.textContent = 'Inscrição Gratuita';
    }

    // Detalhes
    document.getElementById('lpEventModality').textContent = ev.modalidade;

    const dateObj = new Date(ev.data_inicio);
    document.getElementById('lpEventDate').textContent = `${dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })} às ${dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

    document.getElementById('lpEventLocation').textContent = `${ev.cidade || 'SP'} • ${ev.local}`;

    const remaining = (ev.capacidade || 100) - (ev.total_inscritos || 0);
    document.getElementById('lpEventCapacity').textContent = `${Math.max(0, remaining)} vagas disponíveis`;

    document.getElementById('lpEventDescription').textContent = ev.descricao || 'Traga seu documento com foto e chegue com antecedência para a retirada do chip e do kit do atleta.';

    // Desabilitar formulário se o evento não estiver aberto
    if (ev.status === 'Concluído' || ev.status === 'Cancelado' || remaining <= 0) {
      const btn = document.getElementById('btnSubmitRegistration');
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-ban"></i> Inscrições Encerradas`;
      btn.style.background = '#94A3B8';
    }

    this.updatePartnerReferralBanner();
  },

  renderHotels() {
    const listContainer = document.getElementById('hotelCurationList');
    const selectDropdown = document.getElementById('regHotelSelect');

    if (!this.curatedHotels || this.curatedHotels.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 13px;">
          <i class="fa-solid fa-hotel" style="font-size: 24px; color: #CBD5E1; margin-bottom: 8px; display: block;"></i>
          Nenhum hotel com tarifa especial associado a este evento no momento. 
          Solicite curadoria personalizada através do formulário de inscrição.
        </div>
      `;
      return;
    }

    // Popular Dropdown
    selectDropdown.innerHTML = '<option value="">Qualquer hotel disponível na curadoria</option>';

    let html = '';
    this.curatedHotels.forEach((hotel, idx) => {
      const stars = '★'.repeat(hotel.categoria_estrelas || 4);
      const isSelected = this.selectedHotelId === hotel.id || idx === 0;
      if (idx === 0 && !this.selectedHotelId) {
        this.selectedHotelId = hotel.id;
      }

      // Adicionar option
      const opt = document.createElement('option');
      opt.value = hotel.id;
      opt.textContent = `${hotel.nome} (R$ ${parseFloat(hotel.tarifa_atleta_desconto).toFixed(2)}/noite)`;
      if (isSelected) opt.selected = true;
      selectDropdown.appendChild(opt);

      // Comodidades chips
      const amenities = (hotel.comodidades || 'Café da Manhã, Wi-Fi Grátis')
        .split(',')
        .map(a => `<span class="amenity-chip">${a.trim()}</span>`)
        .slice(0, 3)
        .join('');

      html += `
        <div class="hotel-card-mini ${isSelected ? 'selected-hotel' : ''}" id="hotelCard_${hotel.id}" onclick="lp.selectHotel(${hotel.id})">
          <img src="${hotel.foto_url || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400'}" alt="${hotel.nome}" class="hotel-mini-photo">
          <div class="hotel-mini-info">
            <div>
              <div class="hotel-mini-title">
                <span>${hotel.nome}</span>
                <span class="stars-badge" title="${hotel.categoria_estrelas} estrelas">${stars}</span>
              </div>
              <div class="hotel-dist-badge">
                <i class="fa-solid fa-location-dot"></i> A ${hotel.distancia_evento_km || '1.5'} km do evento • ${hotel.cidade}
              </div>
              <div class="hotel-amenity-tags">${amenities}</div>
            </div>

            <div class="hotel-price-row">
              <div>
                <span class="old-price">R$ ${parseFloat(hotel.tarifa_media).toFixed(2)}</span>
                <span class="new-price">R$ ${parseFloat(hotel.tarifa_atleta_desconto).toFixed(2)} <small style="font-size: 11px; font-weight: normal; color: var(--text-muted);">/noite</small></span>
              </div>
              <span class="btn btn-outline btn-sm" style="font-size: 11px; padding: 4px 8px;">
                <i class="fa-solid fa-check"></i> ${isSelected ? 'Selecionado' : 'Escolher'}
              </span>
            </div>
          </div>
        </div>
      `;
    });

    listContainer.innerHTML = html;
  },

  selectHotel(hotelId) {
    this.selectedHotelId = hotelId;
    const selectDropdown = document.getElementById('regHotelSelect');
    if (selectDropdown) {
      selectDropdown.value = hotelId;
    }

    // Marcar visualmente
    document.querySelectorAll('.hotel-card-mini').forEach(el => el.classList.remove('selected-hotel'));
    const target = document.getElementById(`hotelCard_${hotelId}`);
    if (target) {
      target.classList.add('selected-hotel');
    }

    // Marcar checkbox de hospedagem caso esteja desmarcado
    const check = document.getElementById('regHospedagemCheck');
    if (check && !check.checked) {
      check.checked = true;
      this.toggleHospedagemFields(true);
    }
  },

  toggleHospedagemFields(show) {
    const extra = document.getElementById('hospedagemExtraFields');
    if (extra) {
      extra.style.display = show ? 'block' : 'none';
    }
  },

  async handleSubmitRegistration(event) {
    event.preventDefault();

    const btn = document.getElementById('btnSubmitRegistration');
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processando Inscrição...`;

    const precisaHospedagem = document.getElementById('regHospedagemCheck').checked;
    const hotelSelectVal = document.getElementById('regHotelSelect').value;
    const qtdHospedesVal = document.getElementById('regHospedesQtd').value;

    const payload = {
      nome_completo: document.getElementById('regNome').value.trim(),
      cpf: document.getElementById('regCpf').value.trim(),
      data_nascimento: document.getElementById('regNascimento').value || null,
      email: document.getElementById('regEmail').value.trim(),
      telefone: document.getElementById('regTelefone').value.trim(),
      genero: document.getElementById('regGenero').value,
      tamanho_camiseta: document.getElementById('regCamiseta').value,
      contato_emergencia_nome: document.getElementById('regEmergenciaNome').value.trim(),
      contato_emergencia_telefone: document.getElementById('regEmergenciaTelefone').value.trim(),
      precisa_hospedagem: precisaHospedagem,
      hospedagem_hotel_id: precisaHospedagem && hotelSelectVal ? parseInt(hotelSelectVal, 10) : null,
      hospedagem_qtd_pessoas: precisaHospedagem ? parseInt(qtdHospedesVal || 1, 10) : 1,
      parceiro_indicador_id: this.partnerId ? parseInt(this.partnerId, 10) : null,
      origem_inscricao: this.partnerId ? 'CARTEIRA_PARCEIRO' : 'DIRETA',
    };

    try {
      const res = await fetch(this.urlWithBase(`/api/events/${this.eventId}/register`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (json.success && json.data) {
        document.getElementById('formWrapper').style.display = 'none';
        document.getElementById('voucherWrapper').style.display = 'block';

        document.getElementById('vouchCode').textContent = json.data.codigo_inscricao;
        document.getElementById('vouchAthleteName').textContent = json.data.nome_completo;
        document.getElementById('vouchEventTitle').textContent = `${json.data.evento_nome} (${json.data.evento_modalidade})`;

        // Configurar detalhes de hotel no voucher
        if (precisaHospedagem) {
          const cupom = (this.curatedHotels[0] && this.curatedHotels[0].cupom_desconto) || 'UNYCOESPORTE';
          document.getElementById('vouchCupomCode').textContent = cupom;
          document.getElementById('vouchHotelText').innerHTML = `
            Sua solicitação de hospedagem para <strong>${payload.hospedagem_qtd_pessoas} pessoa(s)</strong> foi enviada para nossa equipe de concierge com sucesso!
          `;
          const whatsappMsg = encodeURIComponent(`Olá equipe UNYCO! Acabei de me inscrever no evento ${json.data.evento_nome} (Inscrição: ${json.data.codigo_inscricao}) e gostaria de confirmar minha reserva com o cupom ${cupom}.`);
          document.getElementById('btnConciergeWhatsapp').href = `https://wa.me/5511999999999?text=${whatsappMsg}`;
        } else {
          document.getElementById('voucherHotelBox').style.display = 'none';
        }

        this.showToast('Inscrição confirmada com sucesso!', 'success');
      } else {
        this.showToast(json.message || 'Erro ao realizar inscrição', 'error');
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-check-circle"></i> Confirmar Minha Inscrição`;
      }
    } catch (err) {
      console.error('Erro ao enviar inscrição:', err);
      this.showToast('Erro de comunicação com o servidor.', 'error');
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-check-circle"></i> Confirmar Minha Inscrição`;
    }
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 4000);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  lp.init();
});
