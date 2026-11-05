// Funções utilitárias puras: datas/meses, centavos, formatação.

export const VERSAO_APP = '1.0.0';

export const p2 = (n) => String(n).padStart(2, '0');

/** Data local de hoje no formato AAAA-MM-DD. */
export function hojeISO(d = new Date()) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}
/** Mês do calendário de hoje (AAAA-MM). */
export const mesHoje = () => hojeISO().slice(0, 7);

export const ehMes = (s) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
export const ehData = (s) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s);

/** Soma n meses (pode ser negativo) a um mês AAAA-MM. */
export function addMes(mes, n) {
  const [a, m] = mes.split('-').map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${p2((((t % 12) + 12) % 12) + 1)}`;
}
/** Quantos meses vão de `de` até `ate`. */
export function difMeses(de, ate) {
  const [a1, m1] = de.split('-').map(Number);
  const [a2, m2] = ate.split('-').map(Number);
  return a2 * 12 + m2 - (a1 * 12 + m1);
}
/** Lista de meses de `ini` até `fim` (inclusive). */
export function listaMeses(ini, fim) {
  const r = [];
  for (let m = ini; m <= fim; m = addMes(m, 1)) r.push(m);
  return r;
}
export const NOMES_MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho',
  'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export function nomeMes(mes) {
  const [a, m] = mes.split('-').map(Number);
  return `${NOMES_MES[m - 1]} ${a}`;
}
export function nomeMesCurto(mes) {
  const [a, m] = mes.split('-').map(Number);
  return `${NOMES_MES[m - 1].slice(0, 3)}/${String(a).slice(2)}`;
}
export function diasNoMes(mes) {
  const [a, m] = mes.split('-').map(Number);
  return new Date(a, m, 0).getDate();
}
/** Data AAAA-MM-DD no mês, limitando o dia ao último dia do mês (ex.: 31 → 28/fev). */
export const dataNoMes = (mes, dia) => `${mes}-${p2(Math.min(dia, diasNoMes(mes)))}`;
export const fimDoMes = (mes) => dataNoMes(mes, 31);
export function difDias(de, ate) {
  const u = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((u(ate) - u(de)) / 86400000);
}

/**
 * Converte texto digitado em centavos (inteiro). Aceita "1.234,56", "1234,56",
 * "1234.56", "R$ 10". Retorna null se inválido.
 */
export function parseValor(txt) {
  if (txt == null) return null;
  let s = String(txt).trim().replace(/[^\d.,]/g, '');
  if (!s) return null;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    const pontos = (s.match(/\./g) || []).length;
    // "1.234" ou "1.234.567" → separador de milhar
    if (pontos > 1 || /^\d{1,3}\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
  }
  if (!/^\d+(\.\d*)?$/.test(s)) return null;
  const [i, d = ''] = s.split('.');
  let c = Number(i) * 100 + Number((d + '00').slice(0, 2));
  if (d.length > 2 && Number(d[2]) >= 5) c += 1;
  return c;
}
/** Centavos → texto para campo de edição ("1234,56"). */
export function centavosParaTexto(c) {
  if (c == null) return '';
  const neg = c < 0;
  const a = Math.abs(c);
  return `${neg ? '-' : ''}${Math.floor(a / 100)},${p2(a % 100)}`;
}

/** Taxa de câmbio digitada → número com até 6 casas (ou null). */
export function parseTaxa(txt) {
  let s = String(txt ?? '').trim().replace(/\s/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const v = Math.round(Number(s) * 1e6) / 1e6;
  return v > 0 ? v : null;
}
export const taxaParaTexto = (v) => (v == null ? '' : String(v).replace('.', ','));

const formatadores = {};
/** Centavos → "AED 1.234,56" / "R$ 1.234,56". */
export function formatarMoeda(c, moeda) {
  if (c == null) return '—';
  let f = formatadores[moeda];
  if (!f) {
    try {
      f = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda });
    } catch {
      const n = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      f = { format: (v) => `${moeda} ${n.format(v)}` };
    }
    formatadores[moeda] = f;
  }
  return f.format(c / 100);
}
export const formatarData = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
export const formatarPct = (v, sinal = false) =>
  v == null || !isFinite(v)
    ? '—'
    : `${sinal && v > 0 ? '+' : ''}${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
