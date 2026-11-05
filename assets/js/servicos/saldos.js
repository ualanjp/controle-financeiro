// Saldos: tudo é RECALCULADO a partir das despesas pagas e das movimentações.
// O efeito de uma despesa num saldo nunca é gravado como lançamento.
import { addMes, fimDoMes, listaMeses } from '../util.js';
import { criarSoma } from './cambio.js';
import { planejadoTotal } from './orcamento.js';
import { FONTE_BUDGET, FONTE_SAVINGS, fonteManual, idDaFonteManual, nomeExibicao } from './despesas.js';

/** Data de referência de uma despesa paga: data de pagamento, ou dia 1 do mês dela. */
export const dataRef = (d) => d.dataPagamento || `${d.mes}-01`;
const mesRef = (d) => dataRef(d).slice(0, 7);
const res = (s) => ({ valor: s.valor, pendente: s.pendente });

/** Saldo manual até a data D: entradas − saídas − despesas pagas com essa fonte. */
export function saldoManual(dados, saldoId, ateData) {
  const s = criarSoma();
  const fonte = fonteManual(saldoId);
  for (const m of dados.movimentacoes) {
    if (m.saldoId === saldoId && m.data <= ateData) {
      s.add(dados, m.valor, m.moeda, m.data.slice(0, 7), m.tipo === 'entrada' ? 1 : -1);
    }
  }
  for (const d of dados.despesas) {
    if (d.status === 'paga' && d.fonteSaldo === fonte && dataRef(d) <= ateData) s.add(dados, d.valor, d.moeda, mesRef(d), -1);
  }
  return res(s);
}

/** Despesas pagas com fonte Budget alocadas no mês (opcionalmente sem a categoria Poupança). */
export function gastoBudget(dados, mes, semPoupanca = false) {
  const s = criarSoma();
  const pid = dados.config.categoriaPoupancaId;
  for (const d of dados.despesas) {
    if (d.status !== 'paga' || d.fonteSaldo !== FONTE_BUDGET || d.mes !== mes) continue;
    if (semPoupanca && d.categoriaId === pid) continue;
    s.add(dados, d.valor, d.moeda, d.mes);
  }
  return s;
}

/** Budget do mês M (não acumula): planejado total − pagas com fonte Budget. */
export function budgetDoMes(dados, mes) {
  const g = gastoBudget(dados, mes, false);
  return { valor: planejadoTotal(dados, mes) - g.valor, pendente: g.pendente };
}

/** Menor mês entre orçamentos e despesas (null se não há dados). */
export function primeiroMes(dados) {
  let p = null;
  for (const o of dados.orcamentos) if (!p || o.mes < p) p = o.mes;
  for (const d of dados.despesas) if (!p || d.mes < p) p = d.mes;
  return p;
}

/** Meses FECHADOS (anteriores ao mês atual do calendário) desde o 1º mês com dados até M. */
export function mesesFechados(dados, ate, mesAtual) {
  const p = primeiroMes(dados);
  if (!p) return [];
  const ultimoFechado = addMes(mesAtual, -1);
  const fim = ate < ultimoFechado ? ate : ultimoFechado;
  return fim < p ? [] : listaMeses(p, fim);
}

/** Sobra e estouro do Budget de um mês (ignorando a categoria Poupança). */
export function resultadoMes(dados, mes) {
  const plan = planejadoTotal(dados, mes);
  const g = gastoBudget(dados, mes, true);
  return { sobra: Math.max(0, plan - g.valor), estouro: Math.max(0, g.valor - plan), pendente: g.pendente };
}

/** Poupança e investimento até o fim de M: aportes na categoria − estouros dos meses fechados. */
export function poupancaAte(dados, M, mesAtual) {
  const s = criarSoma();
  const pid = dados.config.categoriaPoupancaId;
  const lim = fimDoMes(M);
  for (const d of dados.despesas) {
    if (d.status === 'paga' && d.categoriaId === pid && dataRef(d) <= lim) s.add(dados, d.valor, d.moeda, mesRef(d));
  }
  let valor = s.valor;
  let pendente = s.pendente;
  for (const m of mesesFechados(dados, M, mesAtual)) {
    const r = resultadoMes(dados, m);
    valor -= r.estouro;
    pendente = pendente || r.pendente;
  }
  return { valor, pendente };
}

/** Savings acumulado até o fim de M. */
export function savingsAte(dados, M, mesAtual) {
  const lim = fimDoMes(M);
  let valor = 0;
  let pendente = false;
  for (const m of mesesFechados(dados, M, mesAtual)) {
    const r = resultadoMes(dados, m);
    valor += r.sobra;
    pendente = pendente || r.pendente;
  }
  for (const s of dados.saldosManuais) {
    const r = saldoManual(dados, s.id, lim);
    valor += r.valor;
    pendente = pendente || r.pendente;
  }
  const p = poupancaAte(dados, M, mesAtual);
  valor += p.valor;
  pendente = pendente || p.pendente;
  const gastos = criarSoma();
  for (const d of dados.despesas) {
    if (d.status === 'paga' && d.fonteSaldo === FONTE_SAVINGS && dataRef(d) <= lim) gastos.add(dados, d.valor, d.moeda, mesRef(d));
  }
  valor -= gastos.valor;
  pendente = pendente || gastos.pendente;
  return { valor, pendente };
}

export const variacaoPct = (atual, anterior) => (!anterior ? null : ((atual - anterior) / Math.abs(anterior)) * 100);

/** Valor de qualquer saldo pela chave: 'budget' | 'savings' | 'poupanca' | 'manual:<id>'. */
export function valorSaldo(dados, chave, M, mesAtual) {
  if (chave === FONTE_BUDGET) return budgetDoMes(dados, M);
  if (chave === FONTE_SAVINGS) return savingsAte(dados, M, mesAtual);
  if (chave === 'poupanca') return poupancaAte(dados, M, mesAtual);
  return saldoManual(dados, idDaFonteManual(chave), fimDoMes(M));
}

/** Valor no fim de cada um dos últimos n meses (até M). */
export function evolucao(dados, chave, M, mesAtual, n = 12) {
  return listaMeses(addMes(M, -(n - 1)), M).map((mes) => ({ mes, ...valorSaldo(dados, chave, mes, mesAtual) }));
}

export function nomeSaldo(dados, chave) {
  if (chave === FONTE_BUDGET) return 'Budget';
  if (chave === FONTE_SAVINGS) return 'Savings';
  if (chave === 'poupanca') return 'Poupança e investimento';
  const s = dados.saldosManuais.find((x) => x.id === idDaFonteManual(chave));
  return s ? s.nome : '(saldo removido)';
}

/** Cartões da tela Saldos. */
export function cartoesSaldos(dados, M, mesAtual) {
  const sv = savingsAte(dados, M, mesAtual);
  const svAnt = savingsAte(dados, addMes(M, -1), mesAtual);
  const lista = [
    { chave: FONTE_BUDGET, nome: 'Budget', ...budgetDoMes(dados, M) },
    { chave: FONTE_SAVINGS, nome: 'Savings', ...sv, variacao: variacaoPct(sv.valor, svAnt.valor) },
    { chave: 'poupanca', nome: 'Poupança e investimento', ...poupancaAte(dados, M, mesAtual) },
  ];
  const manuais = [...dados.saldosManuais].filter((s) => !s.arquivado).sort((a, b) => a.ordem - b.ordem || a.id - b.id);
  for (const s of manuais) lista.push({ chave: fonteManual(s.id), nome: s.nome, ...saldoManual(dados, s.id, fimDoMes(M)) });
  return lista;
}

/** Movimentações manuais + despesas pagas com fonte em saldo manual (só leitura). */
export function listaMovimentacoes(dados, f = {}) {
  const itens = [];
  for (const m of dados.movimentacoes) {
    itens.push({ origem: 'manual', id: m.id, saldoId: m.saldoId, tipo: m.tipo, valor: m.valor, moeda: m.moeda, data: m.data, descricao: m.descricao || '', mov: m });
  }
  for (const d of dados.despesas) {
    const sid = idDaFonteManual(d.fonteSaldo);
    if (d.status === 'paga' && sid != null) {
      itens.push({ origem: 'despesa', id: d.id, saldoId: sid, tipo: 'saida', valor: d.valor, moeda: d.moeda, data: dataRef(d), descricao: nomeExibicao(d), despesa: d });
    }
  }
  return itens
    .filter((i) => (!f.saldoId || i.saldoId === Number(f.saldoId)) && (!f.mes || i.data.startsWith(f.mes)) && (!f.tipo || i.tipo === f.tipo))
    .sort((a, b) => (a.data === b.data ? b.id - a.id : a.data < b.data ? 1 : -1));
}
