// ============================================================
// VALIDATORS — Validações reutilizáveis
// ============================================================

export const validators = {
  patientName: (name) => {
    if (!name || name.trim().length < 2) return 'Nome deve ter ao menos 2 caracteres';
    if (name.trim().length > 100) return 'Nome muito longo (máximo 100 caracteres)';
    if (!/^[a-záàâãéèêíïóôõöúçñ\s'-]+$/i.test(name)) return 'Nome contém caracteres inválidos';
    return null;
  },

  time: (time) => {
    if (!time || !/^\d{2}:\d{2}$/.test(time)) return 'Formato inválido (use HH:MM)';
    const [h, m] = time.split(':').map(Number);
    if (h < 0 || h > 23 || m < 0 || m > 59) return 'Hora inválida';
    return null;
  },

  sessionValue: (value) => {
    const num = parseFloat(value);
    if (isNaN(num)) return 'Valor deve ser um número';
    if (num < 0) return 'Valor não pode ser negativo';
    if (num > 100000) return 'Valor muito grande (máximo R$ 100.000)';
    return null;
  },

  crp: (crp) => {
    if (!crp) return null; // Opcional
    if (!crp.match(/^CRP\s+\d{2}\/\d{5,6}$/i)) {
      return 'Formato inválido: CRP XX/XXXXX';
    }
    return null;
  },

  phone: (phone) => {
    if (!phone) return null; // Opcional
    if (!phone.match(/^\(?[\d]{2}\)?[\s-]?[\d]{4,5}-?[\d]{4}$/)) {
      return 'Telefone inválido. Use: (11) 99999-9999';
    }
    return null;
  },

  email: (email) => {
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return 'Email inválido';
    }
    return null;
  },

  dayOfWeek: (day) => {
    const d = parseInt(day);
    if (isNaN(d) || d < 0 || d > 5) return 'Dia inválido';
    return null;
  },

  frequency: (freq) => {
    if (!['weekly', 'biweekly', 'monthly'].includes(freq)) {
      return 'Frequência inválida';
    }
    return null;
  }
};

export function validatePatientForm(data) {
  const errors = {};

  const nameErr = validators.patientName(data.name);
  if (nameErr) errors.name = nameErr;

  const dayErr = validators.dayOfWeek(data.day_of_week);
  if (dayErr) errors.day_of_week = dayErr;

  const timeErr = validators.time(data.time);
  if (timeErr) errors.time = timeErr;

  const valueErr = validators.sessionValue(data.value);
  if (valueErr) errors.value = valueErr;

  const freqErr = validators.frequency(data.frequency);
  if (freqErr) errors.frequency = freqErr;

  return Object.keys(errors).length === 0 ? null : errors;
}

export function validateAuthForm(email, password, fullName = null) {
  const errors = {};

  const emailErr = validators.email(email);
  if (emailErr) errors.email = emailErr;

  if (password.length < 6) {
    errors.password = 'Senha deve ter ao menos 6 caracteres';
  }

  if (fullName !== null) {
    const nameErr = validators.patientName(fullName);
    if (nameErr) errors.fullName = nameErr;
  }

  return Object.keys(errors).length === 0 ? null : errors;
}
