import { state, setState, getFinancialSummary, markSessionPaid, formatCurrency, MONTH_NAMES } from '../lib/store.js';

export function renderFinancial(container) {
  function render() {
    const { expected, received, pending, missed, missedNotified, totalSessions, patientBalance } = getFinancialSummary(state.currentMonth, state.currentYear);
    const receivedRate = expected > 0 ? Math.round((received / expected) * 100) : 0;

    const debtors = Object.values(patientBalance).filter(b => b.pending > 0).sort((a, b) => b.pending - a.pending);
    const allPatients = Object.values(patientBalance).filter(b => b.done > 0).sort((a, b) => b.done - a.done);

    container.innerHTML = `
      <div class="section-header">
        <h2 class="section-title">Financeiro</h2>
        <div class="flex items-center gap-8">
          <button class="btn btn-secondary btn-sm btn-icon" id="prev-month">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span style="font-size:14px;font-weight:500;min-width:130px;text-align:center">${MONTH_NAMES[state.currentMonth]} ${state.currentYear}</span>
          <button class="btn btn-secondary btn-sm btn-icon" id="next-month">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">Faturado</div>
          <div class="stat-value">${formatCurrency(expected)}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${totalSessions} sessões realizadas</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Recebido</div>
          <div class="stat-value positive">${formatCurrency(received)}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${receivedRate}% do faturado</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Pendente</div>
          <div class="stat-value ${pending > 0 ? 'negative' : 'muted'}">${formatCurrency(pending)}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${debtors.length} paciente${debtors.length !== 1 ? 's' : ''} em aberto</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Faltas</div>
          <div class="stat-value muted">${missed + missedNotified}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${missedNotified} com aviso</div>
        </div>
      </div>

      <!-- PROGRESS BAR -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-body">
          <div class="flex justify-between" style="margin-bottom:8px">
            <span class="text-sm text-secondary">Taxa de recebimento</span>
            <span class="text-sm font-medium">${receivedRate}%</span>
          </div>
          <div style="height:8px;background:var(--bg);border-radius:4px;overflow:hidden">
            <div style="height:100%;width:${receivedRate}%;background:var(--success);border-radius:4px;transition:width 0.5s ease"></div>
          </div>
        </div>
      </div>

      <!-- DEBTORS -->
      ${debtors.length > 0 ? `
        <div class="section-header">
          <h3 style="font-size:16px;font-weight:500">Inadimplência</h3>
          <span class="badge badge-warning">${debtors.length} em aberto</span>
        </div>
        <div class="card" style="margin-bottom:20px">
          ${debtors.map(b => renderBalanceRow(b, true)).join('')}
        </div>
      ` : `
        <div class="card" style="margin-bottom:20px;padding:16px 20px">
          <div class="flex items-center gap-12">
            <span style="font-size:18px">✓</span>
            <span style="font-size:14px;color:var(--success);font-weight:500">Nenhuma inadimplência este mês</span>
          </div>
        </div>
      `}

      <!-- ALL PATIENTS THIS MONTH -->
      ${allPatients.length > 0 ? `
        <div class="section-header">
          <h3 style="font-size:16px;font-weight:500">Resumo por paciente</h3>
        </div>
        <div class="card">
          <div class="card-header">
            <span style="font-size:12px;color:var(--text-muted);flex:1">Paciente</span>
            <span style="font-size:12px;color:var(--text-muted);width:90px;text-align:right">Faturado</span>
            <span style="font-size:12px;color:var(--text-muted);width:90px;text-align:right">Recebido</span>
            <span style="font-size:12px;color:var(--text-muted);width:90px;text-align:right">Pendente</span>
          </div>
          ${allPatients.map(b => renderBalanceRow(b, false)).join('')}
        </div>
      ` : `
        <div class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          <p>Nenhuma sessão realizada em ${MONTH_NAMES[state.currentMonth]}.</p>
        </div>
      `}

      <!-- EXPORT HINT -->
      <div style="margin-top:24px;padding:14px 16px;background:var(--accent-light);border-radius:var(--radius);font-size:13px;color:var(--info)">
        <strong>Dica:</strong> Para declaração de IR, registre todas as sessões como pagas com o método correto. O histórico completo fica sempre disponível por aqui.
      </div>
    `;

    bindEvents();
  }

  function renderBalanceRow(b, compact) {
    if (compact) {
      return `
        <div class="patient-balance-row" style="cursor:pointer" data-patient-id="${b.patient.id}">
          <div class="patient-avatar" style="width:36px;height:36px;font-size:12px">${initials(b.patient.name)}</div>
          <div style="flex:1">
            <div class="font-medium text-sm">${b.patient.name}</div>
            <div class="text-xs text-muted">${formatCurrency(b.done)} faturado</div>
          </div>
          <div class="balance-pending">${formatCurrency(b.pending)}</div>
          <button class="btn btn-success btn-sm" data-mark-paid="${b.patient.id}">
            Marcar pago
          </button>
        </div>
      `;
    }
    return `
      <div class="patient-balance-row" style="cursor:pointer" data-patient-id="${b.patient.id}">
        <div class="patient-avatar" style="width:32px;height:32px;font-size:11px;flex-shrink:0">${initials(b.patient.name)}</div>
        <div style="flex:1;min-width:0">
          <div class="font-medium text-sm" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${b.patient.name}</div>
          ${b.patient.social_price ? `<span class="social-tag">social</span>` : ''}
        </div>
        <div style="width:90px;text-align:right;font-size:13px;color:var(--text-secondary)">${formatCurrency(b.done)}</div>
        <div style="width:90px;text-align:right;font-size:13px;color:var(--success)">${formatCurrency(b.paid)}</div>
        <div style="width:90px;text-align:right;font-size:13px" class="${b.pending > 0 ? 'balance-pending' : 'text-muted'}">${formatCurrency(b.pending)}</div>
      </div>
    `;
  }

  function bindEvents() {
    document.getElementById('prev-month')?.addEventListener('click', () => {
      let m = state.currentMonth - 1;
      let y = state.currentYear;
      if (m < 0) { m = 11; y--; }
      setState({ currentMonth: m, currentYear: y });
    });

    document.getElementById('next-month')?.addEventListener('click', () => {
      let m = state.currentMonth + 1;
      let y = state.currentYear;
      if (m > 11) { m = 0; y++; }
      setState({ currentMonth: m, currentYear: y });
    });

    container.querySelectorAll('[data-patient-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-mark-paid]')) return;
        setState({ currentPage: 'patient-detail', currentPatientId: el.dataset.patientId });
      });
    });

    container.querySelectorAll('[data-mark-paid]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const patientId = btn.dataset.markPaid;
        const unpaidSessions = state.sessions.filter(s =>
          s.patient_id === patientId && s.status === 'done' && !s.paid
        );
        for (const s of unpaidSessions) {
          await markSessionPaid(s.id, 'pix');
        }
        render();
      });
    });
  }

  render();
}

function initials(name) {
  if (!name) return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
