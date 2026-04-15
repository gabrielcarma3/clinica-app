import { state, updateProfile, addPatient, setState } from '../lib/store.js';
import { DAY_NAMES } from '../lib/store.js';

export function renderOnboarding(container) {
  let step = 1; // 1 = profile, 2 = first patient
  let profileData = {};

  function render() {
    container.innerHTML = step === 1 ? renderStep1() : renderStep2();
    bindEvents();
  }

  function renderStep1() {
    return `
      <div class="onboarding-page">
        <div class="onboarding-card">
          <div class="onboarding-step">Passo 1 de 2</div>
          <div class="onboarding-title">Bem-vindo(a) ao Clínica</div>
          <p class="onboarding-sub">Vamos configurar seu perfil profissional. Você pode alterar essas informações depois.</p>
          <form id="onboarding-form">
            <div class="flex-col gap-16">
              <div class="form-group">
                <label class="form-label">Nome profissional</label>
                <input class="form-input" type="text" id="full_name" placeholder="Ex: Dra. Ana Costa" value="${state.profile?.full_name || ''}" required />
              </div>
              <div class="form-row form-row-2">
                <div class="form-group">
                  <label class="form-label">CRP / CRM</label>
                  <input class="form-input" type="text" id="crp" placeholder="Ex: CRP 06/123456" value="${state.profile?.crp || ''}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Telefone / WhatsApp</label>
                  <input class="form-input" type="tel" id="phone" placeholder="(11) 99999-9999" value="${state.profile?.phone || ''}" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Nome da clínica ou consultório</label>
                <input class="form-input" type="text" id="clinic_name" placeholder="Ex: Consultório Bem Estar" value="${state.profile?.clinic_name || ''}" />
              </div>
              <button type="submit" class="btn btn-primary w-full" style="justify-content:center; margin-top:8px">
                Continuar →
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  function renderStep2() {
    return `
      <div class="onboarding-page">
        <div class="onboarding-card">
          <div class="onboarding-step">Passo 2 de 2</div>
          <div class="onboarding-title">Adicione seu primeiro paciente</div>
          <p class="onboarding-sub">Cadastre um paciente para começar a usar a agenda. Você pode adicionar mais depois.</p>
          <form id="patient-form">
            <div class="flex-col gap-16">
              <div class="form-group">
                <label class="form-label">Nome do paciente</label>
                <input class="form-input" type="text" id="name" placeholder="Nome completo" required />
              </div>
              <div class="form-row form-row-2">
                <div class="form-group">
                  <label class="form-label">Dia fixo</label>
                  <select class="form-select" id="day_of_week">
                    ${DAY_NAMES.map((d, i) => `<option value="${i}">${d}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Horário</label>
                  <input class="form-input" type="time" id="time" value="09:00" required />
                </div>
              </div>
              <div class="form-row form-row-2">
                <div class="form-group">
                  <label class="form-label">Valor da sessão (R$)</label>
                  <input class="form-input" type="number" id="value" placeholder="0,00" min="0" step="0.01" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Frequência</label>
                  <select class="form-select" id="frequency">
                    <option value="weekly">Semanal</option>
                    <option value="biweekly">Quinzenal</option>
                    <option value="monthly">Mensal</option>
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                  <input type="checkbox" id="social_price" style="width:16px;height:16px" />
                  <span class="form-label" style="margin:0">Preço social</span>
                </label>
              </div>
              <div class="flex gap-8" style="margin-top:8px">
                <button type="button" id="skip-btn" class="btn btn-secondary" style="flex:1; justify-content:center">
                  Pular por agora
                </button>
                <button type="submit" class="btn btn-primary" style="flex:1; justify-content:center">
                  Adicionar e entrar →
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  function bindEvents() {
    document.getElementById('onboarding-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      profileData = {
        full_name: document.getElementById('full_name').value.trim(),
        crp: document.getElementById('crp').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        clinic_name: document.getElementById('clinic_name').value.trim(),
      };
      await updateProfile(profileData);
      step = 2;
      render();
    });

    document.getElementById('patient-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await addPatient({
        name: document.getElementById('name').value.trim(),
        day_of_week: parseInt(document.getElementById('day_of_week').value),
        time: document.getElementById('time').value,
        value: parseFloat(document.getElementById('value').value) || 0,
        frequency: document.getElementById('frequency').value,
        social_price: document.getElementById('social_price').checked,
      });
      setState({ currentPage: 'agenda' });
    });

    document.getElementById('skip-btn')?.addEventListener('click', () => {
      setState({ currentPage: 'agenda' });
    });
  }

  render();
}
