import { state, setState, addPatient, updatePatient, archivePatient, openModal, closeModal, formatCurrency, formatDateBR, DAY_NAMES, FREQ_LABELS, STATUS_LABELS, STATUS_COLORS } from '../lib/store.js';

export function renderPatients(container) {
  let search = '';

  function render() {
    const filtered = state.patients.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase())
    );

    container.innerHTML = `
      <div class="section-header">
        <h2 class="section-title">Pacientes</h2>
        <button class="btn btn-primary btn-sm" id="add-patient-btn">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Novo paciente
        </button>
      </div>

      <div class="search-wrap" style="margin-bottom:16px">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input class="form-input search-input" type="text" id="search" placeholder="Buscar paciente..." value="${search}" />
      </div>

      <div class="card">
        ${filtered.length === 0 ? `
          <div class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <p>${search ? 'Nenhum paciente encontrado.' : 'Nenhum paciente cadastrado ainda.'}</p>
            ${!search ? `<button class="btn btn-primary btn-sm" style="margin-top:12px" id="add-patient-empty">Adicionar primeiro paciente</button>` : ''}
          </div>
        ` : filtered.map(p => renderPatientRow(p)).join('')}
      </div>
    `;

    bindEvents(filtered);
  }

  function renderPatientRow(p) {
    const sessionCount = state.sessions.filter(s => s.patient_id === p.id && s.status === 'done').length;
    const pendingValue = state.sessions.filter(s => s.patient_id === p.id && s.status === 'done' && !s.paid).reduce((sum, s) => sum + (s.value || 0), 0);

    return `
      <div class="patient-row" data-patient-id="${p.id}">
        <div class="patient-avatar">${initials(p.name)}</div>
        <div class="patient-info">
          <div class="patient-name">${p.name}</div>
          <div class="patient-meta">
            ${DAY_NAMES[p.day_of_week]} · ${p.time} · ${formatCurrency(p.value)}
            ${p.social_price ? ' · <span style="color:var(--warning)">preço social</span>' : ''}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          <span class="freq-tag">${FREQ_LABELS[p.frequency]}</span>
          ${pendingValue > 0 ? `<span class="badge badge-warning">${formatCurrency(pendingValue)} pendente</span>` : ''}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;color:var(--text-muted)"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>
    `;
  }

  function bindEvents(filtered) {
    document.getElementById('search')?.addEventListener('input', (e) => {
      search = e.target.value;
      render();
    });

    document.getElementById('add-patient-btn')?.addEventListener('click', openAddPatientModal);
    document.getElementById('add-patient-empty')?.addEventListener('click', openAddPatientModal);

    container.querySelectorAll('[data-patient-id]').forEach(el => {
      el.addEventListener('click', () => {
        setState({ currentPage: 'patient-detail', currentPatientId: el.dataset.patientId });
      });
    });
  }

  function openAddPatientModal() {
    openModal({ type: 'add-patient', onUpdate: () => render() });
  }

  render();
}

export function renderPatientDetail(container) {
  const patientId = state.currentPatientId;
  const patient = state.patients.find(p => p.id === patientId);

  if (!patient) {
    setState({ currentPage: 'patients' });
    return;
  }

  const sessions = state.sessions
    .filter(s => s.patient_id === patientId)
    .sort((a, b) => b.date.localeCompare(a.date));

  const doneSessions = sessions.filter(s => s.status === 'done');
  const totalBilled = doneSessions.reduce((sum, s) => sum + (s.value || 0), 0);
  const totalReceived = doneSessions.filter(s => s.paid).reduce((sum, s) => sum + (s.value || 0), 0);
  const totalPending = totalBilled - totalReceived;
  const missedCount = sessions.filter(s => s.status === 'missed').length;

  container.innerHTML = `
    <div style="margin-bottom:16px">
      <button class="btn btn-ghost btn-sm" id="back-btn">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Voltar
      </button>
    </div>

    <div class="card" style="margin-bottom:20px">
      <div class="card-body">
        <div class="flex items-center gap-12" style="margin-bottom:16px">
          <div class="patient-avatar" style="width:52px;height:52px;font-size:18px">${initials(patient.name)}</div>
          <div style="flex:1">
            <div style="font-size:20px;font-weight:500;color:var(--text)">${patient.name}</div>
            <div class="text-sm text-muted">${DAY_NAMES[patient.day_of_week]} · ${patient.time} · ${FREQ_LABELS[patient.frequency]}</div>
          </div>
          <button class="btn btn-secondary btn-sm" id="edit-patient-btn">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Editar
          </button>
        </div>
        <hr class="divider">
        <div class="form-row form-row-3">
          <div>
            <div class="text-xs text-muted">Valor / sessão</div>
            <div class="font-medium" style="margin-top:2px">${formatCurrency(patient.value)}</div>
            ${patient.social_price ? `<span class="social-tag">preço social</span>` : ''}
          </div>
          <div>
            <div class="text-xs text-muted">Total faturado</div>
            <div class="font-medium" style="margin-top:2px">${formatCurrency(totalBilled)}</div>
          </div>
          <div>
            <div class="text-xs text-muted">Pendente</div>
            <div class="font-medium ${totalPending > 0 ? 'balance-pending' : 'text-muted'}" style="margin-top:2px">${formatCurrency(totalPending)}</div>
          </div>
        </div>
        ${patient.phone || patient.email ? `
          <hr class="divider">
          <div class="flex gap-16">
            ${patient.phone ? `<div><span class="text-xs text-muted">WhatsApp: </span><a href="https://wa.me/55${patient.phone.replace(/\D/g,'')}" target="_blank" style="color:var(--accent);font-size:14px">${patient.phone}</a></div>` : ''}
            ${patient.email ? `<div><span class="text-xs text-muted">E-mail: </span><span style="font-size:14px">${patient.email}</span></div>` : ''}
          </div>
        ` : ''}
        ${patient.notes ? `<hr class="divider"><div class="text-sm" style="color:var(--text-secondary)">${patient.notes}</div>` : ''}
      </div>
    </div>

    <div class="section-header">
      <h3 style="font-size:16px;font-weight:500">Histórico de sessões</h3>
      <span class="text-sm text-muted">${doneSessions.length} realizadas · ${missedCount} falta${missedCount !== 1 ? 's' : ''}</span>
    </div>

    <div class="card">
      ${sessions.length === 0 ? `
        <div class="empty-state">
          <p>Nenhuma sessão registrada ainda.</p>
        </div>
      ` : sessions.slice(0, 30).map(s => `
        <div class="patient-row">
          <div style="flex:1">
            <div class="patient-name">${formatDateBR(s.date)}</div>
            <div class="patient-meta">${formatCurrency(s.value || patient.value)}</div>
          </div>
          <div class="flex items-center gap-8">
            <span class="badge ${STATUS_COLORS[s.status]}">${STATUS_LABELS[s.status]}</span>
            ${s.status === 'done' ? (s.paid ? `<span class="badge badge-success">pago</span>` : `<span class="badge badge-warning">pendente</span>`) : ''}
          </div>
        </div>
      `).join('')}
    </div>

    <div style="margin-top:16px">
      <button class="btn btn-danger btn-sm" id="archive-btn">Arquivar paciente</button>
    </div>
  `;

  container.querySelector('#back-btn')?.addEventListener('click', () => setState({ currentPage: 'patients' }));
  container.querySelector('#edit-patient-btn')?.addEventListener('click', () => {
    openModal({ type: 'edit-patient', patient, onUpdate: () => renderPatientDetail(container) });
  });
  container.querySelector('#archive-btn')?.addEventListener('click', () => {
    archivePatient(patient.id);
  });
}

export function renderAddPatientModal(modal, container) {
  renderPatientForm({ modal, container, patient: null });
}

export function renderEditPatientModal(modal, container) {
  renderPatientForm({ modal, container, patient: modal.patient });
}

function renderPatientForm({ modal, container, patient }) {
  const isEdit = !!patient;
  container.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">${isEdit ? 'Editar paciente' : 'Novo paciente'}</span>
        <button class="btn btn-ghost btn-icon btn-sm" id="close-modal">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Nome completo</label>
          <input class="form-input" type="text" id="name" value="${patient?.name || ''}" placeholder="Nome do paciente" required />
        </div>
        <div class="form-row form-row-2">
          <div class="form-group">
            <label class="form-label">WhatsApp</label>
            <input class="form-input" type="tel" id="phone" value="${patient?.phone || ''}" placeholder="(11) 99999-9999" />
          </div>
          <div class="form-group">
            <label class="form-label">E-mail</label>
            <input class="form-input" type="email" id="email" value="${patient?.email || ''}" placeholder="email@exemplo.com" />
          </div>
        </div>
        <div class="form-row form-row-2">
          <div class="form-group">
            <label class="form-label">Dia fixo</label>
            <select class="form-select" id="day_of_week">
              ${DAY_NAMES.map((d, i) => `<option value="${i}" ${patient?.day_of_week === i ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Horário</label>
            <input class="form-input" type="time" id="time" value="${patient?.time || '09:00'}" />
          </div>
        </div>
        <div class="form-row form-row-2">
          <div class="form-group">
            <label class="form-label">Valor (R$)</label>
            <input class="form-input" type="number" id="value" value="${patient?.value || ''}" placeholder="0,00" min="0" step="0.01" />
          </div>
          <div class="form-group">
            <label class="form-label">Frequência</label>
            <select class="form-select" id="frequency">
              <option value="weekly" ${patient?.frequency === 'weekly' ? 'selected' : ''}>Semanal</option>
              <option value="biweekly" ${patient?.frequency === 'biweekly' ? 'selected' : ''}>Quinzenal</option>
              <option value="monthly" ${patient?.frequency === 'monthly' ? 'selected' : ''}>Mensal</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" id="social_price" ${patient?.social_price ? 'checked' : ''} style="width:16px;height:16px" />
            <span class="form-label" style="margin:0">Preço social</span>
          </label>
        </div>
        <div class="form-group">
          <label class="form-label">Observações</label>
          <textarea class="form-textarea" id="notes" placeholder="Notas internas sobre o paciente...">${patient?.notes || ''}</textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="close-modal-2">Cancelar</button>
        <button class="btn btn-primary" id="save-btn">${isEdit ? 'Salvar alterações' : 'Adicionar paciente'}</button>
      </div>
    </div>
  `;

  const close = () => closeModal();
  container.querySelector('#close-modal')?.addEventListener('click', close);
  container.querySelector('#close-modal-2')?.addEventListener('click', close);

  container.querySelector('#save-btn')?.addEventListener('click', async () => {
    const data = {
      name: container.querySelector('#name').value.trim(),
      phone: container.querySelector('#phone').value.trim(),
      email: container.querySelector('#email').value.trim(),
      day_of_week: parseInt(container.querySelector('#day_of_week').value),
      time: container.querySelector('#time').value,
      value: parseFloat(container.querySelector('#value').value) || 0,
      frequency: container.querySelector('#frequency').value,
      social_price: container.querySelector('#social_price').checked,
      notes: container.querySelector('#notes').value.trim(),
    };
    if (!data.name) return;
    if (isEdit) {
      await updatePatient(patient.id, data);
    } else {
      await addPatient(data);
    }
    closeModal();
    modal.onUpdate?.();
  });
}

function initials(name) {
  if (!name) return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
