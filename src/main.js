import './styles.css';
import { state, subscribe, init, signOut, setState } from './lib/store.js';
import { renderAuth } from './pages/auth.js';
import { renderOnboarding } from './pages/onboarding.js';
import { renderAgenda, renderSessionModal, renderAddSessionModal } from './pages/agenda.js';
import { renderPatients, renderPatientDetail, renderAddPatientModal, renderEditPatientModal } from './pages/patients.js';
import { renderFinancial } from './pages/financial.js';

const app = document.getElementById('app');
let currentPage = null;
let currentRenderer = null;

function render(s) {
  if (s.isLoading) {
    app.innerHTML = `
      <div class="loading-overlay">
        <div class="spinner"></div>
        <div style="margin-top:16px;font-size:14px;color:var(--text-muted)">${s.loadingMessage || 'Carregando...'}</div>
      </div>
    `;
    return;
  }

  if (s.currentPage === 'loading') {
    app.innerHTML = `
      <div class="loading-screen">
        <div class="spinner"></div>
        <div style="font-size:14px;color:var(--text-muted)">Carregando...</div>
      </div>
    `;
    return;
  }

  if (s.currentPage === 'auth') {
    if (currentPage !== 'auth') {
      currentPage = 'auth';
      app.innerHTML = '';
      renderAuth(app);
    }
    return;
  }

  if (s.currentPage === 'onboarding') {
    if (currentPage !== 'onboarding') {
      currentPage = 'onboarding';
      app.innerHTML = '';
      renderOnboarding(app);
    }
    return;
  }

  // Main app layout
  if (currentPage === 'auth' || currentPage === 'onboarding' || currentPage === 'loading') {
    // Rebuild full layout
    buildAppLayout();
  }
  currentPage = s.currentPage;

  updateSidebarActive();
  renderPageContent(s.currentPage);
  renderModal(s.modal);
  renderToast(s.toast);
}

function buildAppLayout() {
  app.innerHTML = `
    <div class="app-layout">
      <div id="sidebar-overlay" class="sidebar-overlay"></div>
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-logo">
          <div class="sidebar-logo-mark">Clínica</div>
          <div class="sidebar-logo-sub" id="clinic-name-display">${state.profile?.clinic_name || state.profile?.full_name || 'Meu consultório'}</div>
        </div>
        <nav class="sidebar-nav">
          <button class="nav-item" data-page="agenda">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Agenda
          </button>
          <button class="nav-item" data-page="patients">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Pacientes
          </button>
          <button class="nav-item" data-page="financial">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            Financeiro
          </button>
        </nav>
        <div class="sidebar-footer">
          <button class="nav-item" id="signout-btn">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sair
          </button>
        </div>
      </aside>

      <div class="main-area">
        <header class="topbar">
          <button class="hamburger" id="hamburger-btn">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div class="topbar-title" id="topbar-title">Agenda</div>
          <div id="topbar-actions"></div>
        </header>
        <main class="page-content" id="page-content"></main>
      </div>
    </div>
    <div id="modal-container"></div>
    <div id="toast-container" class="toast-container"></div>
  `;

  // Sidebar nav
  document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      setState({ currentPage: btn.dataset.page, sidebarOpen: false });
      closeSidebar();
    });
  });

  document.getElementById('signout-btn')?.addEventListener('click', signOut);

  // Hamburger
  document.getElementById('hamburger-btn')?.addEventListener('click', () => {
    toggleSidebar();
  });
  document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar?.classList.toggle('open');
  overlay?.classList.toggle('open');
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('open');
}

function updateSidebarActive() {
  document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
    const isActive = btn.dataset.page === state.currentPage ||
      (state.currentPage === 'patient-detail' && btn.dataset.page === 'patients');
    btn.classList.toggle('active', isActive);
  });

  const titles = { agenda: 'Agenda', patients: 'Pacientes', 'patient-detail': 'Pacientes', financial: 'Financeiro' };
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) {
    titleEl.innerHTML = `${titles[state.currentPage] || 'Clínica'}`;
    if (state.profile?.clinic_name) {
      titleEl.innerHTML += `<span>${state.profile.clinic_name}</span>`;
    }
  }
}

function renderPageContent(page) {
  const content = document.getElementById('page-content');
  if (!content) return;

  switch (page) {
    case 'agenda':
      renderAgenda(content);
      break;
    case 'patients':
      renderPatients(content);
      break;
    case 'patient-detail':
      renderPatientDetail(content);
      break;
    case 'financial':
      renderFinancial(content);
      break;
  }
}

function renderModal(modal) {
  const container = document.getElementById('modal-container');
  if (!container) return;

  if (!modal) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `<div class="modal-overlay" id="modal-overlay"></div>`;
  const overlay = container.querySelector('.modal-overlay');
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      setState({ modal: null });
    }
  });

  switch (modal.type) {
    case 'session': renderSessionModal(modal, overlay); break;
    case 'add-session': renderAddSessionModal(modal, overlay); break;
    case 'add-patient': renderAddPatientModal(modal, overlay); break;
    case 'edit-patient': renderEditPatientModal(modal, overlay); break;
    case 'confirm': renderConfirmModal(modal, overlay); break;
  }
}

function renderConfirmModal(modal, overlay) {
  const { title, message, confirmText, cancelText, isDangerous, onConfirm } = modal;
  
  overlay.innerHTML += `
    <div class="modal modal-confirm">
      <div class="modal-header">
        <h3>${title}</h3>
      </div>
      <div class="modal-body">
        <p>${message}</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="modal-cancel">${cancelText || 'Cancelar'}</button>
        <button class="btn ${isDangerous ? 'btn-danger' : 'btn-primary'}" id="modal-confirm">${confirmText || 'Confirmar'}</button>
      </div>
    </div>
  `;

  document.getElementById('modal-cancel')?.addEventListener('click', () => {
    setState({ modal: null });
  });

  document.getElementById('modal-confirm')?.addEventListener('click', async () => {
    try {
      await onConfirm();
    } catch (err) {
      console.error('Modal confirm error:', err);
    }
  });
}

function renderToast(toast) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  if (!toast) {
    container.innerHTML = '';
    return;
  }

  const icons = {
    success: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    error: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    info: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="8"/><line x1="12" y1="12" x2="12" y2="16"/></svg>`,
  };

  container.innerHTML = `
    <div class="toast ${toast.type}">
      ${icons[toast.type] || ''}
      ${toast.message}
    </div>
  `;
}

function showSetupInstructions() {
  alert(`Para usar com dados reais:\n\n1. Crie uma conta grátis em supabase.com\n2. Crie um novo projeto\n3. Vá em SQL Editor e cole o SQL do arquivo src/lib/supabase.js\n4. Copie sua URL e anon key das configurações do projeto\n5. Cole em src/lib/supabase.js nas variáveis SUPABASE_URL e SUPABASE_ANON_KEY\n\nPronto! O app estará totalmente funcional com banco de dados real.`);
}

// Subscribe and re-render on state changes
subscribe(render);

// Boot
init();
