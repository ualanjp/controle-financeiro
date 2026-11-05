// Regras de câmbio e conversão para a moeda-base.
import { tx, salvar, excluir } from '../db.js';
import { addMes } from '../util.js';

/** Moedas usadas no app: [base, ...outras]. */
export const moedasConfiguradas = (dados) => [dados.config.moedaBase, ...dados.config.outrasMoedas];

/** Quanto 1 unidade de `moeda` vale na moeda-base no `mes` (1 para a própria base; null se não cadastrada). */
export function taxaDe(dados, mes, moeda) {
  if (moeda === dados.config.moedaBase) return 1;
  const t = dados.taxasCambio.find((x) => x.mes === mes && x.moeda === moeda);
  return t && t.valorNaBase > 0 ? t.valorNaBase : null;
}

/** Converte centavos por uma taxa, arredondando para o centavo (meio para cima). Aritmética inteira exata. */
export function converterCentavos(valor, taxa) {
  if (taxa == null) return null;
  if (taxa === 1) return valor;
  const micro = BigInt(Math.round(taxa * 1e6));
  const p = BigInt(valor) * micro;
  const neg = p < 0n;
  const a = neg ? -p : p;
  let q = a / 1000000n;
  if ((a % 1000000n) * 2n >= 1000000n) q += 1n;
  return Number(neg ? -q : q);
}

/** Converte um valor para a base usando a taxa do `mes`. null = indefinida (sem taxa). */
export const converter = (dados, valor, moeda, mes) => converterCentavos(valor, taxaDe(dados, mes, moeda));

/** Valor da despesa na moeda-base, pela taxa do mês da própria despesa. */
export const valorNaBase = (dados, d) => converter(dados, d.valor, d.moeda, d.mes);

/**
 * Acumulador: soma valores convertidos e lembra quais moedas ficaram sem taxa
 * (esses valores NÃO entram na soma).
 */
export function criarSoma() {
  return {
    valor: 0,
    faltando: new Map(),
    add(dados, valor, moeda, mes, sinal = 1) {
      const v = converter(dados, valor, moeda, mes);
      if (v === null) {
        if (!this.faltando.has(moeda)) this.faltando.set(moeda, new Set());
        this.faltando.get(moeda).add(mes);
        return null;
      }
      this.valor += sinal * v;
      return v;
    },
    get pendente() { return this.faltando.size > 0; },
    moedas() { return [...this.faltando.keys()]; },
  };
}

/** Moedas (sem repetir) das despesas que não têm taxa no mês delas. */
export function moedasSemTaxa(dados, despesas) {
  const r = new Set();
  for (const d of despesas) if (valorNaBase(dados, d) === null) r.add(d.moeda);
  return [...r];
}

// ---------- Gravação ----------
export async function salvarTaxa(mes, moeda, valor) {
  if (valor == null) return excluir('taxasCambio', [mes, moeda]);
  if (!(valor > 0)) throw new Error('Taxa inválida.');
  return salvar('taxasCambio', { mes, moeda, valorNaBase: Math.round(valor * 1e6) / 1e6 });
}

/** O que seria copiado do mês anterior. `faltantes` = moedas sem taxa neste mês. */
export function planejarCopiaTaxas(dados, mes) {
  const ant = addMes(mes, -1);
  const origem = dados.taxasCambio.filter((t) => t.mes === ant && t.moeda !== dados.config.moedaBase);
  const faltantes = origem.filter((t) => taxaDe(dados, mes, t.moeda) === null);
  return { origem, faltantes };
}
export async function copiarTaxas(dados, mes, sobrescrever) {
  const { origem, faltantes } = planejarCopiaTaxas(dados, mes);
  const lista = (sobrescrever ? origem : faltantes).map((t) => ({ mes, moeda: t.moeda, valorNaBase: t.valorNaBase }));
  await tx(['taxasCambio'], 'readwrite', (l) => { lista.forEach((t) => l.taxasCambio.put(t)); });
  return lista.length;
}
