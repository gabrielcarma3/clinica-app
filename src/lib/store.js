import { supabase } from './supabase.js';
import { withRetry, withTimeout } from './async-utils.js';
import { validators } from './validators.js';

// ============================================================
// GLOBAL STATE
// ============================================================
export const state = {
  user: null,
  profile: null,
  patients: [],
  sessions: [],
  currentPage: 'loading', // loading | auth | onboarding | agenda | patients | financial | patient-detail
  currentPatientId: null,
  currentWeekOffset: 0,
  currentMonth: new Date().getMonth(),
  currentYear: new Date().getFullYear(),
  sidebarOpen: false,
  isLoading: false,
  loadingMessage: null,
  toast: null,
  modal: null,
  lastError: null,
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach(fn => fn(state));
}

// ============================================================
// AUTH
// ============================================================
export async function init() {
  try {
    setState({ currentPage: 'loading', loadingMessage: 'Carregando...' });
    const ok = await supabase.restoreSession();
    
    if (ok) {
      const user = await supabase.getUser().catch(() => null);
      if (user) {
        setState({ user });
        await loadProfile();
        await loadAllData();
        setState({ currentPage: 'agenda', isLoading: false });
        return;
      }
    }
    
    setState({ currentPage: 'auth', isLoading: false });
  } catch (err) {
    console.error('[Init Error]', err);
    setState({ currentPage: 'auth', isLoading: false, lastError: err });
  }
}

export async function signIn(email, password) {
  try {
    // Validação local
    const emailErr = validators.email(email);
    if (emailErr) throw new Error(emailErr);
    if (password.length < 6) throw new Error('Senha deve ter ao menos 6 caracteres');

    setState({ isLoading: true, loadingMessage: 'Entrando...' });
    
    const data = await withRetry(() => supabase.signIn(email, password), 2);
    const user = await supabase.getUser();
    
    if (!user) throw new Error('Falha ao recuperar dados do usuário');
    
    setState({ user });
    await loadProfile();
    await loadAllData();
    setState({ currentPage: 'agenda', isLoading: false });
    return data;
  } catch (err) {
    console.error('[SignIn Error]', err);
    const msg = mapAuthError(err.message);
    setState({ isLoading: false, lastError: err });
    throw new Error(msg);
  }
}

export async function signUp(email, password, fullName) {
  try {
    // Validação local
    const emailErr = validators.email(email);
    if (emailErr) throw new Error(emailErr);
    if (password.length < 6) throw new Error('Senha deve ter ao menos 6 caracteres');
    if (!fullName || fullName.trim().length < 2) throw new Error('Nome inválido');

    setState({ isLoading: true, loadingMessage: 'Criando conta...' });
    
    const data = await supabase.signUp(email, password, { full_name: fullName });
    if (data.error) throw data.error;

    const user = await supabase.getUser();
    if (!user) throw new Error('Usuário não encontrado após signup');
    
    setState({ user, loadingMessage: 'Finalizando...' });

    // POLLING: Espera profile ser criado pela trigger
    const profile = await pollProfileCreation(user.id, 15, 500);
    setState({ profile, currentPage: 'onboarding', isLoading: false });
    
    return { user, profile };
  } catch (err) {
    console.error('[SignUp Error]', err);
    const msg = mapAuthError(err.message);
    setState({ isLoading: false, lastError: err });
    throw new Error(msg);
  }
}

async function pollProfileCreation(userId, maxAttempts = 15, delayMs = 500) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
        .get();

      if (profile) {
        console.log(`[Poll] Profile created after ${attempt} attempt(s)`);
        return profile;
      }
    } catch (err) {
      if (attempt === maxAttempts) {
        throw new Error('Timeout na criação do perfil. Atualize a página e tente novamente.');
      }
    }

    await new Promise(r => setTimeout(r, delayMs));
  }
  
  throw new Error('Falha ao criar perfil');
}

export async function signOut() {
  await supabase.signOut();
  setState({ user: null, profile: null, patients: [], sessions: [], currentPage: 'auth' });
}

// ============================================================
// DATA LOADERS
// ============================================================
async function loadProfile() {
  if (!state.user) return;
  const { data } = await supabase.from('profiles').select('*').eq('id', state.user.id).single().get();
  setState({ profile: data });
}

export async function loadAllData() {
  if (!state.user) return;
  try {
    setState({ loadingMessage: 'Carregando dados...' });
    
    const [pRes, sRes] = await Promise.all([
      withRetry(() => supabase.from('patients').select('*').eq('user_id', state.user.id).eq('active', true).order('name', { ascending: true }).get(), 2),
      withRetry(() => supabase.from('sessions').select('*').eq('user_id', state.user.id).order('date', { ascending: false }).get(), 2),
    ]);

    if (!pRes.data || !sRes.data) throw new Error('Falha ao carregar dados');
    
    setState({ patients: pRes.data || [], sessions: sRes.data || [], loadingMessage: null });
  } catch (err) {
    console.error('[LoadAllData Error]', err);
    setState({ lastError: err, loadingMessage: null });
    showToast('Erro ao carregar dados: ' + err.message, 'error');
  }
}

// ============================================================
// PATIENTS
// ============================================================
export async function addPatient(data) {
  try {
    // Validação local completa
    const nameErr = validators.patientName(data.name);
    if (nameErr) throw new Error(nameErr);
    
    const dayErr = validators.dayOfWeek(data.day_of_week);
    if (dayErr) throw new Error(dayErr);
    
    const timeErr = validators.time(data.time);
    if (timeErr) throw new Error(timeErr);
    
    const valueErr = validators.sessionValue(data.value);
    if (valueErr) throw new Error(valueErr);
    
    const freqErr = validators.frequency(data.frequency);
    if (freqErr) throw new Error(freqErr);

    setState({ isLoading: true, loadingMessage: 'Adicionando paciente...' });

    const { data: newP, error } = await withRetry(
      () => supabase.from('patients').insert({ ...data, user_id: state.user.id }),
      2
    );

    if (error) throw error;
    if (!newP) throw new Error('Falha ao criar paciente');

    setState({ 
      patients: [...state.patients, newP].sort((a, b) => a.name.localeCompare(b.name)),
      modal: null,
      isLoading: false
    });
    showToast('Paciente adicionado com sucesso', 'success');
    return newP;
  } catch (err) {
    console.error('[AddPatient Error]', err);
    setState({ isLoading: false, lastError: err });
    showToast(`Erro: ${err.message}`, 'error');
    throw err;
  }
}

export async function updatePatient(id, data) {
  try {
    setState({ isLoading: true });
    await withRetry(() => supabase.from('patients').eq('id', id).update(data), 2);
    const updated = state.patients.map(p => p.id === id ? { ...p, ...data } : p);
    setState({ patients: updated, isLoading: false });
    showToast('Paciente atualizado', 'success');
  } catch (err) {
    console.error('[UpdatePatient Error]', err);
    setState({ isLoading: false, lastError: err });
    showToast(`Erro: ${err.message}`, 'error');
    throw err;
  }
}

export async function archivePatient(id) {
  // Pede confirmação antes de deletar
  openModal({
    type: 'confirm',
    title: 'Arquivar paciente?',
    message: 'Este paciente será movido para o arquivo. Você ainda poderá recuperá-lo depois.',
    confirmText: 'Arquivar',
    cancelText: 'Cancelar',
    isDangerous: false,
    onConfirm: async () => {
      try {
        setState({ isLoading: true });
        await withRetry(() => supabase.from('patients').eq('id', id).update({ active: false }), 2);
        setState({ 
          patients: state.patients.filter(p => p.id !== id),
          modal: null,
          isLoading: false
        });
        showToast('Paciente arquivado', 'info');
      } catch (err) {
        console.error('[ArchivePatient Error]', err);
        setState({ isLoading: false, lastError: err });
        showToast(`Erro: ${err.message}`, 'error');
      }
    }
  });
}

// ============================================================
// SESSIONS
// ============================================================
export async function addSession(data) {
  const { data: newS } = await supabase.from('sessions').insert({ ...data, user_id: state.user.id });
  setState({ sessions: [newS, ...state.sessions] });
  return newS;
}

export async function updateSession(id, data) {
  await supabase.from('sessions').eq('id', id).update(data);
  const updated = state.sessions.map(s => s.id === id ? { ...s, ...data } : s);
  setState({ sessions: updated });
}

export async function markSessionStatus(id, status) {
  await updateSession(id, { status });
  const label = { done: 'Sessão realizada', missed: 'Falta registrada', missed_notified: 'Falta com aviso registrada', cancelled: 'Sessão cancelada' };
  showToast(label[status] || 'Atualizado', 'success');
}

export async function markSessionPaid(id, method = 'pix') {
  await updateSession(id, { paid: true, paid_at: new Date().toISOString(), payment_method: method });
  showToast('Pagamento registrado', 'success');
}

export async function updateProfile(data) {
  await supabase.from('profiles').eq('id', state.user.id).update(data);
  setState({ profile: { ...state.profile, ...data } });
  showToast('Perfil atualizado', 'success');
}

// ============================================================
// SCHEDULE GENERATION
// ============================================================
export function getWeekDates(offset = 0) {
  const today = new Date();
  const monday = new Date(today);
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  monday.setDate(today.getDate() + diff + (offset * 7));
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export function getSessionsForDate(date) {
  const dateStr = formatDate(date);
  const real = state.sessions.filter(s => s.date === dateStr);
  const realPatientIds = new Set(real.map(s => s.patient_id));
  
  const generated = state.patients
    .filter(p => !realPatientIds.has(p.id)) // Não tem sessão real
    .filter(p => matchesSchedule(p, new Date(date)))
    .map(p => ({
      id: `gen_${p.id}_${dateStr}`,
      patient_id: p.id,
      user_id: p.user_id,
      date: dateStr,
      status: 'scheduled',
      value: p.value,
      paid: false,
      _generated: true,
      _patient: p
    }));
  
  return [...real.map(s => ({
    ...s,
    _patient: state.patients.find(p => p.id === s.patient_id)
  })), ...generated].sort((a, b) => {
    const ta = a._patient?.time || '00:00';
    const tb = b._patient?.time || '00:00';
    return ta.localeCompare(tb);
  });
}

function matchesSchedule(patient, dateToCheck) {
  // patient.day_of_week: 0=Monday, 1=Tuesday, ..., 5=Saturday
  // dateToCheck.getDay(): 0=Sunday, 1=Monday, ..., 6=Saturday
  
  // Converter JS getDay() para nosso formato
  const jsDay = dateToCheck.getDay();
  const dateDay = jsDay === 0 ? 5 : jsDay - 1; // JS Sunday=0 → nosso Saturday=5
  
  // 1. Verificar dia da semana
  if (patient.day_of_week !== dateDay) {
    return false;
  }
  
  // 2. Verificar frequência
  const patientStartDate = new Date(patient.created_at);
  patientStartDate.setHours(0, 0, 0, 0);
  dateToCheck.setHours(0, 0, 0, 0);
  
  const daysDiff = Math.floor((dateToCheck - patientStartDate) / (24 * 60 * 60 * 1000));
  
  switch (patient.frequency) {
    case 'weekly':
      return daysDiff >= 0;
    
    case 'biweekly':
      return daysDiff >= 0 && Math.floor(daysDiff / 7) % 2 === 0;
    
    case 'monthly':
      const startDay = patientStartDate.getDate();
      const currentDay = dateToCheck.getDate();
      
      if (patientStartDate.getMonth() === dateToCheck.getMonth() &&
          patientStartDate.getFullYear() === dateToCheck.getFullYear()) {
        return Math.abs(currentDay - startDay) <= 3;
      }
      
      const monthDiff = (dateToCheck.getFullYear() - patientStartDate.getFullYear()) * 12 +
                       (dateToCheck.getMonth() - patientStartDate.getMonth());
      if (monthDiff < 0) return false;
      
      return currentDay >= startDay - 3 && currentDay <= startDay + 3;
    
    default:
      return false;
  }
}

export function getFinancialSummary(month, year) {
  const monthSessions = state.sessions.filter(s => {
    const d = new Date(s.date + 'T12:00:00');
    return d.getMonth() === month && d.getFullYear() === year;
  });

  const done = monthSessions.filter(s => s.status === 'done');
  const expected = done.reduce((sum, s) => sum + (s.value || 0), 0);
  const received = done.filter(s => s.paid).reduce((sum, s) => sum + (s.value || 0), 0);
  const pending = expected - received;
  const missed = monthSessions.filter(s => s.status === 'missed').length;
  const missedNotified = monthSessions.filter(s => s.status === 'missed_notified').length;
  const totalSessions = done.length;

  // Per-patient balance
  const patientBalance = {};
  state.patients.forEach(p => {
    patientBalance[p.id] = {
      patient: p,
      done: 0,
      paid: 0,
      pending: 0,
      lastSession: null
    };
  });

  state.sessions.forEach(s => {
    if (!patientBalance[s.patient_id]) return;
    if (s.status === 'done') {
      patientBalance[s.patient_id].done += s.value || 0;
      if (s.paid) {
        patientBalance[s.patient_id].paid += s.value || 0;
      } else {
        patientBalance[s.patient_id].pending += s.value || 0;
      }
      if (!patientBalance[s.patient_id].lastSession || s.date > patientBalance[s.patient_id].lastSession) {
        patientBalance[s.patient_id].lastSession = s.date;
      }
    }
  });

  return { expected, received, pending, missed, missedNotified, totalSessions, patientBalance };
}

// ============================================================
// UTILS
// ============================================================
export function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatCurrency(n) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);
}

export function formatDateBR(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function showToast(message, type = 'info') {
  setState({ toast: { message, type, id: Date.now() } });
  setTimeout(() => setState({ toast: null }), 3500);
}

export function openModal(modal) { setState({ modal }); }
export function closeModal() { setState({ modal: null }); }

export const DAY_NAMES = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const DAY_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const STATUS_LABELS = { scheduled: 'Agendada', done: 'Realizada', missed: 'Falta s/ aviso', missed_notified: 'Falta c/ aviso', rescheduled: 'Remarcada', cancelled: 'Cancelada' };
export const STATUS_COLORS = { scheduled: 'status-scheduled', done: 'status-done', missed: 'status-missed', missed_notified: 'status-missed-notified', rescheduled: 'status-rescheduled', cancelled: 'status-cancelled' };
export const FREQ_LABELS = { weekly: 'Semanal', biweekly: 'Quinzenal', monthly: 'Mensal' };

// ============================================================
// HELPERS
// ============================================================
function mapAuthError(message) {
  const errorMap = {
    'Invalid login credentials': 'E-mail ou senha incorretos.',
    'User already registered': 'Este e-mail já está cadastrado.',
    'Email not confirmed': 'Confirme seu e-mail antes de fazer login.',
    'invalid_credentials': 'E-mail ou senha incorretos.',
  };

  for (const [key, value] of Object.entries(errorMap)) {
    if (message.includes(key)) return value;
  }

  return message || 'Erro ao fazer login';
}

export function setLoading(isLoading, message = null) {
  setState({ isLoading, loadingMessage: message });
}
