// Pedaços de interface usados por várias telas.
import { esc, formatarMoeda } from '../util.js';
import { FONTE_BUDGET, FONTE_SAVINGS, fonteManual, idDaFonteManual } from '../servicos/despesas.js';
import { moedasConfiguradas } from '../servicos/cambio.js';

export const ROTULO_STATUS = { paga: 'Paga', pendente: 'Pendente', prevista: 'Prevista' };
export const mapa = (lista) => new Map(lista.map((x) => [x.id, x]));

export function nomeFonte(dados, fonte) {
  if (fonte === FONTE_BUDGET) return 'Budget';
  if (fonte === FONTE_SAVINGS) return 'Savings';
  const s = dados.saldosManuais.find((x) => x.id === idDaFonteManual(fonte));
  return s ? s.nome : '(saldo removido)';
}

export const bolinha = (cat, pequena = false) =>
  `<span class="bolinha ${pequena ? 'pequena' : ''}" style="--cor:${esc(cat?.cor || '#888888')}">${pequena ? '' : esc(cat?.icone || '')}</span>`;

export const avisoCambio = (moedas) =>
  moedas.map((m) => `<a class="aviso" href="#/cambio">⚠ Câmbio de ${esc(m)} não cadastrado para este mês. <u>Cadastrar</u></a>`).join('');

export const valorBase = (dados, v) => formatarMoeda(v, dados.config.moedaBase);

const opt = (valor, rotulo, sel) => `<option value="${esc(valor)}" ${sel ? 'selected' : ''}>${esc(rotulo)}</option>`;

export function opcoesCategorias(dados, atual, todas = false) {
  return dados.categorias
    .filter((c) => todas || !c.arquivada || c.id === atual)
    .map((c) => opt(c.id, `${c.icone ? c.icone + ' ' : ''}${c.nome}${c.arquivada ? ' (arquivada)' : ''}`, c.id === atual))
    .join('');
}
export function opcoesFormas(dados, atual, todas = false) {
  return dados.formasPagamento
    .filter((f) => todas || !f.arquivada || f.id === atual)
    .map((f) => opt(f.id, `${f.nome}${f.arquivada ? ' (arquivada)' : ''}`, f.id === atual))
    .join('');
}
export function opcoesFontes(dados, atual, todas = false) {
  const lista = [[FONTE_BUDGET, 'Budget'], [FONTE_SAVINGS, 'Savings']];
  for (const s of [...dados.saldosManuais].sort((a, b) => a.ordem - b.ordem)) {
    const f = fonteManual(s.id);
    if (todas || !s.arquivado || f === atual) lista.push([f, s.nome + (s.arquivado ? ' (arquivado)' : '')]);
  }
  return lista.map(([v, r]) => opt(v, r, v === atual)).join('');
}
export function opcoesMoedas(dados, atual, extras = []) {
  const lista = [...new Set([...moedasConfiguradas(dados), ...extras, ...(atual ? [atual] : [])])];
  return lista.map((m) => opt(m, m, m === atual)).join('');
}

const CAMPOS_FILTRO = {
  categoriaId: ['Categoria', (d) => opcoesCategorias(d, null, true)],
  formaPagamentoId: ['Forma de pagamento', (d) => opcoesFormas(d, null, true)],
  status: ['Status', () => Object.entries(ROTULO_STATUS).map(([v, r]) => opt(v, r)).join('')],
  moeda: ['Moeda', (d) => opcoesMoedas(d, null, [...new Set(d.despesas.map((x) => x.moeda))])],
  fonteSaldo: ['Saldo de origem', (d) => opcoesFontes(d, null, true)],
};

/** Bloco recolhível de filtros. `filtros` é um objeto que guarda o estado. */
export function filtrosHtml(dados, filtros, campos) {
  const ativos = campos.filter((c) => filtros[c]).length;
  return `<details class="cartao filtros" ${ativos ? 'open' : ''}>
    <summary>Filtros${ativos ? ` (${ativos})` : ''}</summary>
    <div class="grade-filtros">${campos.map((c) => `<label>${CAMPOS_FILTRO[c][0]}
      <select data-filtro="${c}"><option value="">Todos</option>${CAMPOS_FILTRO[c][1](dados)}</select></label>`).join('')}</div>
    ${ativos ? '<button type="button" class="btn btn-link" data-limpar-filtros>Limpar filtros</button>' : ''}
  </details>`;
}
export function ligarFiltros(container, filtros, aoMudar) {
  container.querySelectorAll('[data-filtro]').forEach((s) => {
    s.value = filtros[s.dataset.filtro] || '';
    s.addEventListener('change', () => { filtros[s.dataset.filtro] = s.value; aoMudar(); });
  });
  container.querySelector('[data-limpar-filtros]')?.addEventListener('click', () => {
    Object.keys(filtros).forEach((k) => (filtros[k] = ''));
    aoMudar();
  });
}

/** Formata número para eixos de gráfico ("1,2 mil"). */
const compacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
export const eixoCompacto = (v) => compacto.format(v);
