// Regras das despesas: única, parcelada, fixa mensal, escopos de edição/exclusão.
// As funções "montar/planejar" são puras (testáveis); as demais gravam no banco.
import { tx, todos, salvar } from '../db.js';
import { addMes, mesHoje, hojeISO, dataNoMes, ehMes, ehData } from '../util.js';
import { criarSoma } from './cambio.js';

export const FONTE_BUDGET = 'budget';
export const FONTE_SAVINGS = 'savings';
export const fonteManual = (id) => `manual:${id}`;
export const idDaFonteManual = (f) => (typeof f === 'string' && f.startsWith('manual:') ? Number(f.slice(7)) : null);

/** Divide o total em n parcelas inteiras; a última recebe o resto. */
export function dividirParcelas(total, n) {
  const base = Math.floor(total / n);
  const r = Array(n).fill(base);
  r[n - 1] = total - base * (n - 1);
  return r;
}

/** 'prevista' se o mês é depois do mês atual; senão 'pendente'. */
export const statusPorMes = (mes, mesAtual = mesHoje()) => (mes > mesAtual ? 'prevista' : 'pendente');

export const nomeExibicao = (d) =>
  d.tipo === 'parcelada' && d.totalParcelas ? `${d.nome} (${d.numeroParcela}/${d.totalParcelas})` : d.nome;

const diaDe = (data) => (data ? Number(data.slice(8, 10)) : null);

export function validarCampos(f) {
  if (!f.nome || !String(f.nome).trim()) throw new Error('Informe o nome.');
  if (!Number.isInteger(f.valor) || f.valor <= 0) throw new Error('Informe um valor maior que zero.');
  if (!/^[A-Z]{3}$/.test(f.moeda || '')) throw new Error('Moeda inválida.');
  if (!f.categoriaId) throw new Error('Escolha a categoria.');
  if (!f.formaPagamentoId) throw new Error('Escolha a forma de pagamento.');
  if (!f.fonteSaldo) throw new Error('Escolha de qual saldo sai.');
  if (!ehMes(f.mes)) throw new Error('Informe o mês.');
  if (f.dataVencimento && !ehData(f.dataVencimento)) throw new Error('Data de vencimento inválida.');
  if (f.dataPagamento && !ehData(f.dataPagamento)) throw new Error('Data de pagamento inválida.');
}

const camposComuns = (f) => ({
  nome: String(f.nome).trim(),
  moeda: f.moeda,
  categoriaId: f.categoriaId,
  formaPagamentoId: f.formaPagamentoId,
  fonteSaldo: f.fonteSaldo,
  observacoes: f.observacoes ? String(f.observacoes).trim() || null : null,
});

function aplicarStatus(status, dataPagamento, hoje) {
  if (status === 'paga') return { status: 'paga', dataPagamento: dataPagamento || hoje };
  return { status: status === 'prevista' ? 'prevista' : 'pendente', dataPagamento: null };
}

// ---------- Criação (puras) ----------
export function montarUnica(f, hoje = hojeISO()) {
  validarCampos(f);
  return {
    serieId: null, numeroParcela: null, totalParcelas: null,
    ...camposComuns(f),
    valor: f.valor, mes: f.mes, dataVencimento: f.dataVencimento || null,
    tipo: 'unica', ...aplicarStatus(f.status, f.dataPagamento, hoje),
    editadaIndividualmente: false,
  };
}

export function montarParcelada(f, mesAtual = mesHoje()) {
  validarCampos(f);
  const n = Number(f.numeroParcelas);
  if (!Number.isInteger(n) || n < 2) throw new Error('Parcelada precisa de no mínimo 2 parcelas.');
  if (n > 360) throw new Error('Número de parcelas muito alto.');
  if (f.valor < n) throw new Error('O valor total é menor que o número de parcelas.');
  const dia = diaDe(f.dataVencimento);
  const comuns = camposComuns(f);
  const serie = {
    tipo: 'parcelada', ...comuns, valorTotal: f.valor, valorParcela: null, numeroParcelas: n,
    mesInicio: f.mes, ativa: true, mesEncerramento: null, diaVencimento: dia, mesesExcluidos: [],
  };
  const despesas = dividirParcelas(f.valor, n).map((valor, i) => {
    const mes = addMes(f.mes, i);
    return {
      serieId: null, numeroParcela: i + 1, totalParcelas: n, ...comuns, valor, mes,
      dataVencimento: dia ? dataNoMes(mes, dia) : null, tipo: 'parcelada',
      status: statusPorMes(mes, mesAtual), dataPagamento: null, editadaIndividualmente: false,
    };
  });
  return { serie, despesas };
}

export function montarSerieFixa(f) {
  validarCampos(f);
  return {
    tipo: 'fixa', ...camposComuns(f), valorTotal: null, valorParcela: f.valor, numeroParcelas: null,
    mesInicio: f.mes, ativa: true, mesEncerramento: null, diaVencimento: diaDe(f.dataVencimento),
    mesesExcluidos: [],
  };
}

export function ocorrenciaFixa(serie, mes, mesAtual = mesHoje()) {
  return {
    serieId: serie.id, numeroParcela: null, totalParcelas: null,
    nome: serie.nome, valor: serie.valorParcela, moeda: serie.moeda, mes,
    dataVencimento: serie.diaVencimento ? dataNoMes(mes, serie.diaVencimento) : null,
    categoriaId: serie.categoriaId, formaPagamentoId: serie.formaPagamentoId, fonteSaldo: serie.fonteSaldo,
    tipo: 'fixa', status: statusPorMes(mes, mesAtual), dataPagamento: null,
    editadaIndividualmente: false, observacoes: serie.observacoes || null,
  };
}

export const serieGeraNoMes = (s, mes) =>
  s.tipo === 'fixa' && s.ativa !== false && s.mesInicio <= mes &&
  (!s.mesEncerramento || s.mesEncerramento >= mes) && !(s.mesesExcluidos || []).includes(mes);

/** Ocorrências de fixas que faltam nos meses pedidos (nunca duplica). */
export function fixasParaGerar(series, despesas, meses, mesAtual = mesHoje()) {
  const existe = new Set(despesas.filter((d) => d.serieId != null).map((d) => `${d.serieId}|${d.mes}`));
  const novas = [];
  for (const mes of meses) {
    for (const s of series) {
      const k = `${s.id}|${mes}`;
      if (serieGeraNoMes(s, mes) && !existe.has(k)) {
        novas.push(ocorrenciaFixa(s, mes, mesAtual));
        existe.add(k);
      }
    }
  }
  return novas;
}

// ---------- Edição / exclusão (puras) ----------
/**
 * Planeja a edição. `f` = campos do formulário; escopo 'esta' | 'proximas'.
 * Devolve { despesas: [...a gravar], serie: série atualizada ou null }.
 */
export function planejarEdicao(dados, despesa, f, escopo = 'esta', hoje = hojeISO()) {
  const mes = despesa.serieId == null ? f.mes : despesa.mes;
  validarCampos({ ...f, mes });
  const comuns = camposComuns(f);
  const atual = {
    ...despesa, ...comuns, valor: f.valor, mes,
    dataVencimento: f.dataVencimento || null,
    ...aplicarStatus(f.status || despesa.status, f.dataPagamento, hoje),
  };
  if (despesa.serieId == null) return { despesas: [atual], serie: null };
  if (escopo !== 'proximas') {
    atual.editadaIndividualmente = true;
    return { despesas: [atual], serie: null };
  }
  const serie = dados.series.find((s) => s.id === despesa.serieId);
  const dia = diaDe(f.dataVencimento);
  const outras = dados.despesas
    .filter((d) => d.serieId === despesa.serieId && d.id !== despesa.id && d.mes >= despesa.mes &&
      d.status !== 'paga' && !d.editadaIndividualmente)
    .map((d) => ({ ...d, ...comuns, valor: f.valor, dataVencimento: dia ? dataNoMes(d.mes, dia) : null }));
  if (!serie) return { despesas: [atual, ...outras], serie: null };
  const novaSerie = { ...serie, ...comuns, diaVencimento: dia };
  if (serie.tipo === 'fixa') {
    novaSerie.valorParcela = f.valor;
  } else {
    const valores = new Map(dados.despesas.filter((d) => d.serieId === serie.id).map((d) => [d.id, d.valor]));
    for (const d of [atual, ...outras]) valores.set(d.id, d.valor);
    novaSerie.valorTotal = [...valores.values()].reduce((a, b) => a + b, 0);
  }
  return { despesas: [atual, ...outras], serie: novaSerie };
}

/**
 * Planeja a exclusão. escopo: 'esta' | 'proximas' (fixas) | 'todas' (parceladas).
 * Devolve { excluirIds, serie (a gravar) ou null, excluirSerieId ou null }.
 */
export function planejarExclusao(dados, despesa, escopo = 'esta') {
  if (despesa.serieId == null) return { excluirIds: [despesa.id], serie: null, excluirSerieId: null };
  const serie = dados.series.find((s) => s.id === despesa.serieId);
  const daSerie = dados.despesas.filter((d) => d.serieId === despesa.serieId);
  if (!serie) return { excluirIds: [despesa.id], serie: null, excluirSerieId: null };

  if (escopo === 'todas') {
    return { excluirIds: daSerie.map((d) => d.id), serie: null, excluirSerieId: serie.id };
  }
  if (escopo === 'proximas' && serie.tipo === 'fixa') {
    const ids = daSerie
      .filter((d) => d.id === despesa.id || (d.mes >= despesa.mes && d.status !== 'paga' && !d.editadaIndividualmente))
      .map((d) => d.id);
    return { excluirIds: ids, serie: encerrar(serie, despesa.mes), excluirSerieId: null };
  }
  // Somente esta
  if (serie.tipo === 'fixa') {
    // Lembra o mês excluído para a geração automática não recriar a ocorrência.
    const meses = new Set(serie.mesesExcluidos || []);
    meses.add(despesa.mes);
    return { excluirIds: [despesa.id], serie: { ...serie, mesesExcluidos: [...meses].sort() }, excluirSerieId: null };
  }
  return { excluirIds: [despesa.id], serie: null, excluirSerieId: daSerie.length <= 1 ? serie.id : null };
}

/** Série encerrada a partir de `mes` (último mês que gera = mês anterior). */
export function encerrar(serie, mes) {
  const fim = addMes(mes, -1);
  const atual = serie.mesEncerramento;
  return { ...serie, mesEncerramento: atual && atual < fim ? atual : fim };
}

// ---------- Lista ----------
export function filtrarDespesas(lista, f = {}) {
  return lista.filter((d) =>
    (!f.categoriaId || d.categoriaId === Number(f.categoriaId)) &&
    (!f.formaPagamentoId || d.formaPagamentoId === Number(f.formaPagamentoId)) &&
    (!f.status || d.status === f.status) &&
    (!f.moeda || d.moeda === f.moeda) &&
    (!f.fonteSaldo || d.fonteSaldo === f.fonteSaldo));
}
export function ordenarDespesas(lista) {
  return [...lista].sort((a, b) => {
    if (a.dataVencimento && b.dataVencimento && a.dataVencimento !== b.dataVencimento) return a.dataVencimento < b.dataVencimento ? -1 : 1;
    if (a.dataVencimento && !b.dataVencimento) return -1;
    if (!a.dataVencimento && b.dataVencimento) return 1;
    return a.nome.localeCompare(b.nome, 'pt-BR') || a.id - b.id;
  });
}
/** Totais na moeda-base por status. */
export function totaisPorStatus(dados, lista) {
  const s = { paga: criarSoma(), pendente: criarSoma(), prevista: criarSoma() };
  for (const d of lista) s[d.status]?.add(dados, d.valor, d.moeda, d.mes);
  return s;
}

// ---------- Gravação ----------
export async function criarDespesa(f, mesAtual = mesHoje(), hoje = hojeISO()) {
  if (f.tipo === 'parcelada') {
    const { serie, despesas } = montarParcelada(f, mesAtual);
    return tx(['series', 'despesas'], 'readwrite', (l) => {
      const r = l.series.add(serie);
      r.onsuccess = () => { for (const d of despesas) { d.serieId = r.result; l.despesas.add(d); } };
    });
  }
  if (f.tipo === 'fixa') {
    const serie = montarSerieFixa(f);
    await salvar('series', serie);
    return garantirFixas([f.mes], mesAtual);
  }
  return salvar('despesas', montarUnica(f, hoje));
}

/** Gera (se faltar) as ocorrências das fixas nos meses pedidos. Idempotente. */
export async function garantirFixas(meses, mesAtual = mesHoje()) {
  const [series, despesas] = await Promise.all([todos('series'), todos('despesas')]);
  const novas = fixasParaGerar(series, despesas, meses, mesAtual);
  if (!novas.length) return 0;
  await tx(['despesas'], 'readwrite', (l) => {
    for (const d of novas) {
      const r = l.despesas.add(d);
      // Se outra chamada já criou (índice único série+mês), ignora sem abortar.
      r.onerror = (e) => { e.preventDefault(); e.stopPropagation(); };
    }
  });
  return novas.length;
}

/** Quando o mês chega, o que era 'prevista' vira 'pendente'. */
export function promoverPrevistas(mesAtual = mesHoje()) {
  return tx(['despesas'], 'readwrite', (l) => {
    l.despesas.openCursor().onsuccess = (e) => {
      const c = e.target.result;
      if (!c) return;
      if (c.value.status === 'prevista' && c.value.mes <= mesAtual) c.update({ ...c.value, status: 'pendente' });
      c.continue();
    };
  });
}

export function salvarEdicao(dados, despesa, f, escopo, hoje = hojeISO()) {
  const p = planejarEdicao(dados, despesa, f, escopo, hoje);
  return tx(['series', 'despesas'], 'readwrite', (l) => {
    if (p.serie) l.series.put(p.serie);
    p.despesas.forEach((d) => l.despesas.put(d));
  });
}

export function executarExclusao(dados, despesa, escopo) {
  const p = planejarExclusao(dados, despesa, escopo);
  return tx(['series', 'despesas'], 'readwrite', (l) => {
    p.excluirIds.forEach((id) => l.despesas.delete(id));
    if (p.serie) l.series.put(p.serie);
    if (p.excluirSerieId != null) l.series.delete(p.excluirSerieId);
  });
}

/** Toque no selo: marca como paga (hoje) ou desfaz. */
export function alternarPaga(despesa, hoje = hojeISO(), mesAtual = mesHoje()) {
  const d = { ...despesa };
  if (d.status === 'paga') { d.status = statusPorMes(d.mes, mesAtual); d.dataPagamento = null; }
  else { d.status = 'paga'; d.dataPagamento = hoje; }
  return salvar('despesas', d).then(() => d);
}

export const encerrarSerie = (serie, mes) => salvar('series', encerrar(serie, mes));
