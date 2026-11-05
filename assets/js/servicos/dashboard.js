// Números do Início (dashboard).
import { addMes, diasNoMes } from '../util.js';
import { criarSoma } from './cambio.js';
import { planejadoTotal, linhasOrcamento } from './orcamento.js';
import { filtrarDespesas, FONTE_BUDGET } from './despesas.js';
import { variacaoPct } from './saldos.js';

const ativa = (d) => d.status === 'paga' || d.status === 'pendente';

/** Dia do mês usado no gráfico acumulado: pagamento, senão vencimento, senão dia 1. */
export function diaDaDespesa(d, mes) {
  for (const data of [d.dataPagamento, d.dataVencimento]) {
    if (data && data.startsWith(mes)) return Number(data.slice(8, 10));
  }
  return 1;
}

export function resumoDashboard(dados, mes, filtros = {}) {
  const filtradas = filtrarDespesas(dados.despesas, filtros);
  const doMes = filtradas.filter((d) => d.mes === mes);
  const pago = criarSoma();
  const pendente = criarSoma();
  const compBudget = criarSoma();
  const porCategoria = new Map();
  const porForma = new Map();
  const nDias = diasNoMes(mes);
  const porDia = Array(nDias).fill(0);

  for (const d of doMes) {
    if (!ativa(d)) continue;
    const v = (d.status === 'paga' ? pago : pendente).add(dados, d.valor, d.moeda, d.mes);
    if (d.fonteSaldo === FONTE_BUDGET) compBudget.add(dados, d.valor, d.moeda, d.mes);
    if (v === null) continue;
    porCategoria.set(d.categoriaId, (porCategoria.get(d.categoriaId) || 0) + v);
    porForma.set(d.formaPagamentoId, (porForma.get(d.formaPagamentoId) || 0) + v);
    porDia[diaDaDespesa(d, mes) - 1] += v;
  }
  const acumulado = [];
  porDia.reduce((s, v, i) => (acumulado[i] = s + v), 0);

  const comprometido = pago.valor + pendente.valor;
  const ant = criarSoma();
  const mesAnt = addMes(mes, -1);
  for (const d of filtradas) if (d.mes === mesAnt && ativa(d)) ant.add(dados, d.valor, d.moeda, d.mes);

  // Compromissos futuros: previstas/pendentes nos próximos 11 meses
  const futuros = criarSoma();
  const limite = addMes(mes, 11);
  for (const d of filtradas) {
    if (d.mes > mes && d.mes <= limite && (d.status === 'prevista' || d.status === 'pendente')) futuros.add(dados, d.valor, d.moeda, d.mes);
  }

  const orcamentoTotal = planejadoTotal(dados, mes);
  const semTaxa = new Set([...pago.moedas(), ...pendente.moedas()]);
  return {
    pago: pago.valor,
    pendente: pendente.valor,
    comprometido,
    comprometidoBudget: compBudget.valor,
    orcamentoTotal,
    disponivel: orcamentoTotal - compBudget.valor,
    pctConsumido: orcamentoTotal ? (compBudget.valor / orcamentoTotal) * 100 : null,
    comprometidoAnterior: ant.valor,
    variacao: variacaoPct(comprometido, ant.valor),
    futuros: futuros.valor,
    futurosPendente: futuros.pendente,
    porCategoria,
    porForma,
    acumulado,
    planejadoXComprometido: linhasOrcamento(dados, mes).linhas.filter((l) => l.planejado || l.comprometido),
    moedasSemTaxa: [...semTaxa],
  };
}

/** Despesas pagas no mês com uma fonte (Budget, Savings ou saldo manual). */
export const pagasDaFonte = (dados, mes, fonte) =>
  dados.despesas.filter((d) => d.mes === mes && d.status === 'paga' && d.fonteSaldo === fonte);
