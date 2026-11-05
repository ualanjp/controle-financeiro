// Regras do orçamento mensal por categoria.
import { salvarVarios, salvar, excluir } from '../db.js';
import { addMes } from '../util.js';
import { criarSoma } from './cambio.js';
import { FONTE_BUDGET } from './despesas.js';

/** Nível da barra (comparação em centavos). */
export function nivelOrcamento(planejado, comprometido) {
  if (!planejado) return 'sem';
  if (comprometido > planejado) return 'estourado';
  if (comprometido === planejado) return 'limite';
  if (comprometido * 10 >= planejado * 9) return 'alerta';
  return 'ok';
}

export function planejadoDe(dados, mes, categoriaId) {
  const o = dados.orcamentos.find((x) => x.mes === mes && x.categoriaId === categoriaId);
  return o ? o.valorPlanejado : 0;
}
export const planejadoTotal = (dados, mes) =>
  dados.orcamentos.filter((o) => o.mes === mes).reduce((s, o) => s + o.valorPlanejado, 0);

/** Comprometido = pago + pendente, só despesas com fonte Budget, convertidas. */
export function comprometidoBudget(dados, mes, despesas = dados.despesas) {
  const porCat = new Map();
  const total = criarSoma();
  for (const d of despesas) {
    if (d.mes !== mes || d.fonteSaldo !== FONTE_BUDGET || (d.status !== 'paga' && d.status !== 'pendente')) continue;
    if (!porCat.has(d.categoriaId)) porCat.set(d.categoriaId, criarSoma());
    porCat.get(d.categoriaId).add(dados, d.valor, d.moeda, d.mes);
    total.add(dados, d.valor, d.moeda, d.mes);
  }
  return { porCat, total };
}

export function compararLinhas(a, b) {
  if (a.planejado && !b.planejado) return -1;
  if (!a.planejado && b.planejado) return 1;
  if (a.planejado && b.planejado) {
    // maior % usado primeiro (comparação sem divisão)
    const d = b.comprometido * a.planejado - a.comprometido * b.planejado;
    if (d) return d;
  } else if (b.comprometido !== a.comprometido) {
    return b.comprometido - a.comprometido;
  }
  return a.categoria.nome.localeCompare(b.categoria.nome, 'pt-BR');
}

export function linhasOrcamento(dados, mes) {
  const { porCat, total } = comprometidoBudget(dados, mes);
  const linhas = [];
  for (const c of dados.categorias) {
    const planejado = planejadoDe(dados, mes, c.id);
    const soma = porCat.get(c.id);
    const comprometido = soma ? soma.valor : 0;
    if (c.arquivada && !planejado && !comprometido) continue;
    linhas.push({
      categoria: c, planejado, comprometido,
      pendente: soma ? soma.pendente : false,
      nivel: nivelOrcamento(planejado, comprometido),
      pct: planejado ? (comprometido / planejado) * 100 : null,
      restante: planejado - comprometido,
    });
  }
  linhas.sort(compararLinhas);
  const totalPlanejado = planejadoTotal(dados, mes);
  return {
    linhas, totalPlanejado, totalComprometido: total.valor,
    nivelTotal: nivelOrcamento(totalPlanejado, total.valor),
    moedasPendentes: total.moedas(),
  };
}

// ---------- Gravação ----------
export function salvarPlanejado(mes, categoriaId, valor) {
  if (!valor) return excluir('orcamentos', [mes, categoriaId]);
  if (!Number.isInteger(valor) || valor < 0) throw new Error('Valor inválido.');
  return salvar('orcamentos', { mes, categoriaId, valorPlanejado: valor });
}

/** `conflitos` = categorias já preenchidas neste mês com valor diferente do anterior. */
export function planejarCopiaOrcamento(dados, mes) {
  const ant = addMes(mes, -1);
  const origem = dados.orcamentos.filter((o) => o.mes === ant && o.valorPlanejado > 0);
  const conflitos = origem.filter((o) => {
    const atual = planejadoDe(dados, mes, o.categoriaId);
    return atual > 0 && atual !== o.valorPlanejado;
  });
  return { origem, conflitos };
}
export async function copiarOrcamento(dados, mes, sobrescrever = false) {
  const { origem } = planejarCopiaOrcamento(dados, mes);
  const lista = origem
    .filter((o) => sobrescrever || planejadoDe(dados, mes, o.categoriaId) === 0)
    .map((o) => ({ mes, categoriaId: o.categoriaId, valorPlanejado: o.valorPlanejado }));
  await salvarVarios('orcamentos', lista);
  return lista.length;
}
