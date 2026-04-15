import { state, setState, getWeekDates, getSessionsForDate, formatCurrency, markSessionStatus, markSessionPaid, addSession, openModal, closeModal, formatDate, DAY_SHORT, STATUS_LABELS, STATUS_COLORS, MONTH_NAMES } from '../lib/store.js';

export function renderAgenda(container) {
  function render() {
    const dates = getWeekDates(state.currentWeekOffset);
    const today = new Date();
    const todayStr = formatDate(today);
    const mondayDate = dates[0];
    const sundayDate = dates[5];
    const weekLabel = formatWeekLabel(mondayDate, sundayDate);

    container.innerHTML = `
      <div class="section-header">
        <h2 class="section-title">Agenda semanal</h2>
        <button class="btn btn-primary btn-sm" id="add-session-btn">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nova sessão
        </button>
      </div>

      <div class="week-nav">
        <button class="btn btn-secondary btn-sm btn-icon" id="prev-week">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="week-label">${weekLabel}</div>
        <button class="btn btn-secondary btn-sm btn-icon" id="next-week">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        ${state.currentWeekOffset !== 0 ? `<button class="btn btn-ghost btn-sm" id="today-btn">Hoje</button>` : ''}
      </div>

      <div class="week-grid">
        ${dates.map(date => {
          const dateStr = formatDate(date);
          const isToday = dateStr === todayStr;
          const sessions = getSessionsForDate(date);
          const dayIdx = date.getDay() - 1; // 0=Mon

          return `
            <div class="day-col">
              <div class="day-header ${isToday ? 'today' : ''}">
                <div class="day-name">${DAY_SHORT[dayIdx >= 0 ? dayIdx : 5]}</div>
                <div class="day-num">${date.getDate()}</div>
              </div>
              ${sessions.length === 0 ? `<div style="height:4px"></div>` : ''}
              ${sessions.map(s => renderSessionCard(s, isToday)).join('')}
            </div>
          `;
        }).join('')}
      </div>

      ${state.currentWeekOffset === 0 ? renderTodaySummary(dates, todayStr) : ''}
    `;

    bindEvents();
  }

  function renderSessionCard(s, isToday) {
    const patient = s._patient;
    if (!patient) return '';
    const statusClass = STATUS_COLORS[s.status] || '';
    const firstName = patient.name.split(' ')[0];
    return `
      <div class="session-card ${statusClass}" data-session-id="${s.id}" data-patient-id="${patient.id}">
        <div class="session-time">${patient.time || '--:--'}</div>
        <div class="session-name">${firstName}</div>
        <div class="session-value">${formatCurrency(s.value)}</div>
        ${s.paid ? '<div style="font-size:10px;color:var(--success);margin-top:2px">✓ pago</div>' : ''}
      </div>
    `;
  }

  function renderTodaySummary(dates, todayStr) {
    const todaySessions = getSessionsForDate(dates.find(d => formatDate(d) === todayStr) || dates[0]);
    if (todaySessions.length === 0) return '';
    const totalDay = todaySessions.reduce((sum, s) => sum + (s.value || 0), 0);
    return `
      <div class="card" style="margin-top:20px">
        <div class="card-header">
          <span class="card-title">Hoje — ${todaySessions.length} sessão${todaySessions.length !== 1 ? 'ões' : ''}</span>
          <span style="font-size:14px;color:var(--text-secondary)">${formatCurrency(totalDay)} previstos</span>
        </div>
        <div>
          ${todaySessions.map(s => {
            const p = s._patient;
            if (!p) return '';
            return `
              <div class="patient-row" data-session-id="${s.id}" data-patient-id="${p.id}">
                <div class="patient-avatar">${initials(p.name)}</div>
                <div class="patient-info">
                  <div class="patient-name">${p.name}</div>
                  <div class="patient-meta">${p.time} · ${formatCurrency(s.value)}</div>
                </div>
                <span class="badge ${STATUS_COLORS[s.status]}">${STATUS_LABELS[s.status]}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function bindEvents() {
    document.getElementById('prev-week')?.addEventListener('click', () => {
      setState({ currentWeekOffset: state.currentWeekOffset - 1 });
    });
    document.getElementById('next-week')?.addEventListener('click', () => {
      setState({ currentWeekOffset: state.currentWeekOffset + 1 });
    });
    document.getElementById('today-btn')?.addEventListener('click', () => {
      setState({ currentWeekOffset: 0 });
    });
    document.getElementById('add-session-btn')?.addEventListener('click', () => {
      openAddSessionModal();
    });

    container.querySelectorAll('.session-card, [data-session-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const sessionId = el.dataset.sessionId;
        const patientId = el.dataset.patientId;
        if (sessionId) openSessionModal(sessionId, patientId);
      });
    });
  }

  function openSessionModal(sessionId, patientId) {
    const session = state.sessions.find(s => s.id === sessionId) || {
      id: sessionId,
      patient_id: patientId,
      status: 'scheduled',
      _generated: true
    };
    const patient = state.patients.find(p => p.id === patientId);
    if (!patient) return;

    openModal({
      type: 'session',
      session,
      patient,
      onUpdate: () => render()
    });
  }

  function openAddSessionModal() {
    openModal({ type: 'add-session', onUpdate: () => render() });
  }

  return { render };
}

export function renderSessionModal(modal, container) {
  const { session, patient } = modal;
  const isGenerated = session._generated;

  async function handleStatus(status) {
    if (isGenerated) {
      // Create real session first
      const newSession = await addSession({
        patient_id: patient.id,
        date: session.date,
        status,
        value: patient.value,
        paid: false
      });
      await markSessionStatus(newSession.id, status);
    } else {
      await markSessionStatus(session.id, status);
    }
    closeModal();
    modal.onUpdate?.();
  }

  async function handlePaid(method) {
    if (!isGenerated) {
      await markSessionPaid(session.id, method);
      closeModal();
      modal.onUpdate?.();
    }
  }

  const currentSession = isGenerated ? session : (state.sessions.find(s => s.id === session.id) || session);

  container.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">${patient.name}</span>
        <button class="btn btn-ghost btn-icon btn-sm" id="close-modal">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="flex items-center gap-12">
          <div>
            <div style="font-size:14px;color:var(--text-secondary)">${formatDateBR(currentSession.date)}</div>
            <div style="font-size:16px;font-weight:500;margin-top:2px">${patient.time} · ${formatCurrency(currentSession.value || patient.value)}</div>
          </div>
          <span class="badge ${STATUS_COLORS[currentSession.status]}" style="margin-left:auto">${STATUS_LABELS[currentSession.status]}</span>
        </div>

        ${!currentSession.paid && currentSession.status !== 'scheduled' ? `
          <div style="background:var(--warning-bg);border:1px solid #F7D99F;border-radius:var(--radius-sm);padding:10px 14px;font-size:13px;color:var(--warning)">
            Pagamento pendente
          </div>
        ` : ''}

        ${currentSession.paid ? `
          <div style="background:var(--success-bg);border:1px solid #B8DFC9;border-radius:var(--radius-sm);padding:10px 14px;font-size:13px;color:var(--success)">
            ✓ Pago via ${currentSession.payment_method || 'pix'}
          </div>
        ` : ''}

        <div>
          <div class="form-label" style="margin-bottom:8px">Atualizar status</div>
          <div class="session-actions">
            ${currentSession.status !== 'done' ? `<button class="btn btn-success btn-sm" data-action="done">✓ Realizada</button>` : ''}
            ${currentSession.status !== 'missed' ? `<button class="btn btn-danger btn-sm" data-action="missed">Falta s/ aviso</button>` : ''}
            ${currentSession.status !== 'missed_notified' ? `<button class="btn btn-secondary btn-sm" data-action="missed_notified">Falta c/ aviso</button>` : ''}
            ${currentSession.status !== 'cancelled' ? `<button class="btn btn-secondary btn-sm" data-action="cancelled">Cancelar</button>` : ''}
          </div>
        </div>

        ${currentSession.status === 'done' && !currentSession.paid && !isGenerated ? `
          <div>
            <div class="form-label" style="margin-bottom:8px">Registrar pagamento</div>
            <div class="session-actions">
              <button class="btn btn-primary btn-sm" data-pay="pix">Pix</button>
              <button class="btn btn-secondary btn-sm" data-pay="card">Cartão</button>
              <button class="btn btn-secondary btn-sm" data-pay="cash">Dinheiro</button>
              <button class="btn btn-secondary btn-sm" data-pay="transfer">TED/PIX</button>
            </div>
          </div>
        ` : ''}

        <div>
          <button class="btn btn-ghost btn-sm" id="view-patient-btn">
            Ver perfil do paciente →
          </button>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#close-modal')?.addEventListener('click', closeModal);
  container.querySelector('#view-patient-btn')?.addEventListener('click', () => {
    closeModal();
    setState({ currentPage: 'patient-detail', currentPatientId: patient.id });
  });

  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => handleStatus(btn.dataset.action));
  });

  container.querySelectorAll('[data-pay]').forEach(btn => {
    btn.addEventListener('click', () => handlePaid(btn.dataset.pay));
  });
}

export function renderAddSessionModal(modal, container) {
  container.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">Nova sessão avulsa</span>
        <button class="btn btn-ghost btn-icon btn-sm" id="close-modal">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <form id="add-session-form">
          <div class="flex-col gap-16">
            <div class="form-group">
              <label class="form-label">Paciente</label>
              <select class="form-select" id="patient_id" required>
                <option value="">Selecione...</option>
                ${state.patients.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-row form-row-2">
              <div class="form-group">
                <label class="form-label">Data</label>
                <input class="form-input" type="date" id="date" value="${formatDate(new Date())}" required />
              </div>
              <div class="form-group">
                <label class="form-label">Valor (R$)</label>
                <input class="form-input" type="number" id="value" placeholder="0,00" min="0" step="0.01" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Status</label>
              <select class="form-select" id="status">
                <option value="scheduled">Agendada</option>
                <option value="done">Realizada</option>
              </select>
            </div>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="close-modal-2">Cancelar</button>
        <button class="btn btn-primary" id="save-session-btn">Adicionar</button>
      </div>
    </div>
  `;

  // Auto-fill value when patient selected
  container.querySelector('#patient_id')?.addEventListener('change', (e) => {
    const p = state.patients.find(p => p.id === e.target.value);
    if (p) container.querySelector('#value').value = p.value;
  });

  const closeBtn = () => { closeModal(); modal.onUpdate?.(); };
  container.querySelector('#close-modal')?.addEventListener('click', closeBtn);
  container.querySelector('#close-modal-2')?.addEventListener('click', closeBtn);

  container.querySelector('#save-session-btn')?.addEventListener('click', async () => {
    const patientId = container.querySelector('#patient_id').value;
    const date = container.querySelector('#date').value;
    const value = parseFloat(container.querySelector('#value').value) || 0;
    const status = container.querySelector('#status').value;
    if (!patientId || !date) return;
    await addSession({ patient_id: patientId, date, value, status });
    closeModal();
    modal.onUpdate?.();
  });
}

function formatWeekLabel(monday, sunday) {
  const opts = { day: '2-digit', month: 'short' };
  const mLabel = monday.toLocaleDateString('pt-BR', opts);
  const sLabel = sunday.toLocaleDateString('pt-BR', opts);
  if (monday.getMonth() === sunday.getMonth()) {
    return `${monday.getDate()} – ${sLabel}`;
  }
  return `${mLabel} – ${sLabel}`;
}

function formatDateBR(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
}

function initials(name) {
  if (!name) return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
