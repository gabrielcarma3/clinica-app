import { signIn, signUp } from '../lib/store.js';

export function renderAuth(container) {
  let mode = 'login'; // login | signup

  function render() {
    container.innerHTML = `
      <div class="auth-page">
        <div class="auth-card">
          <div class="auth-logo">Clínica</div>
          <p class="auth-tagline">Gestão simples para psicólogos e terapeutas</p>

          ${mode === 'login' ? renderLogin() : renderSignup()}
        </div>
      </div>
    `;
    bindEvents();
  }

  function renderLogin() {
    return `
      <form id="auth-form">
        <div class="flex-col gap-16">
          <div id="auth-error" style="display:none" class="auth-error"></div>
          <div class="form-group">
            <label class="form-label">E-mail</label>
            <input class="form-input" type="email" id="email" placeholder="seu@email.com" required autocomplete="email" />
          </div>
          <div class="form-group">
            <label class="form-label">Senha</label>
            <input class="form-input" type="password" id="password" placeholder="Sua senha" required autocomplete="current-password" />
          </div>
          <button type="submit" class="btn btn-primary w-full" id="submit-btn" style="justify-content:center; margin-top:4px">
            Entrar
          </button>
        </div>
      </form>
      <div class="auth-switch">
        Não tem conta? <a id="switch-mode">Criar conta grátis</a>
      </div>
    `;
  }

  function renderSignup() {
    return `
      <form id="auth-form">
        <div class="flex-col gap-16">
          <div id="auth-error" style="display:none" class="auth-error"></div>
          <div class="form-group">
            <label class="form-label">Nome completo</label>
            <input class="form-input" type="text" id="fullname" placeholder="Dr(a). Seu Nome" required />
          </div>
          <div class="form-group">
            <label class="form-label">E-mail</label>
            <input class="form-input" type="email" id="email" placeholder="seu@email.com" required autocomplete="email" />
          </div>
          <div class="form-group">
            <label class="form-label">Senha</label>
            <input class="form-input" type="password" id="password" placeholder="Mínimo 6 caracteres" required minlength="6" autocomplete="new-password" />
          </div>
          <p class="form-hint">Ao criar conta, você concorda com nossos termos de uso e política de privacidade (LGPD).</p>
          <button type="submit" class="btn btn-primary w-full" id="submit-btn" style="justify-content:center">
            Criar conta grátis
          </button>
        </div>
      </form>
      <div class="auth-switch">
        Já tem conta? <a id="switch-mode">Fazer login</a>
      </div>
    `;
  }

  function bindEvents() {
    document.getElementById('switch-mode')?.addEventListener('click', () => {
      mode = mode === 'login' ? 'signup' : 'login';
      render();
    });

    document.getElementById('auth-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('submit-btn');
      const errEl = document.getElementById('auth-error');
      btn.disabled = true;
      btn.textContent = 'Aguarde...';
      errEl.style.display = 'none';

      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;

      try {
        if (mode === 'login') {
          await signIn(email, password);
        } else {
          const fullName = document.getElementById('fullname').value.trim();
          await signUp(email, password, fullName);
        }
      } catch (err) {
        const msgs = {
          'Invalid login credentials': 'E-mail ou senha incorretos.',
          'User already registered': 'Este e-mail já está cadastrado.',
          'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres.',
        };
        errEl.textContent = msgs[err.message] || err.message;
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = mode === 'login' ? 'Entrar' : 'Criar conta grátis';
      }
    });
  }

  render();
}
