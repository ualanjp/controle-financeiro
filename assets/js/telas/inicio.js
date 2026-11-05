import { esc, formatarMoeda, formatarPct, formatarData, addMes, nomeMes } from '../util.js';
import { criarGrafico } from '../ui.js';
import { resumoDashboard, pagasDaFonte } from '../servicos/dashboard.js';
import { valorSaldo } from '../servicos/saldos.js';
import { valorNaBase } from '../servicos/cambio.js';
import { precisaLembrete } from '../servicos/backup.js';
import { nomeExibicao } from '../servicos/despesas.js';
import { avisoCambio, mapa, filtrosHtml, ligarFiltros, opcoesFontes, eixoCompacto } from './comum.js';

export const titulo = 'Início';
export const usaMes = true;
/** Os compromissos futuros contam as fixas, então elas precisam existir nos próximos 11 meses. */
export const mesesExtras = (mes) => Array.from({ length: 11 }, (_, i) => addMes(mes, i + 1));

const filtros = { categoriaId: '', formaPagamentoId: '', status: '', moeda: '' };
let fonteSel = 'budget';

export async function render(ctx) {
  const { el, dados, mes, mesAtual, hoje } = ctx;
  const base = dados.config.moedaBase;
  const fmt = (v) => formatarMoeda(v, base);
  const r = resumoDashboard(dados, mes, filtros);
  const cats = mapa(dados.categorias);
  const formas = mapa(dados.formasPagamento);
  const saldo = valorSaldo(dados, fonteSel, mes, mesAtual);
  const pagas = pagasDaFonte(dados, mes, fonteSel);
  const lembrete = precisaLembrete(dados.config, hoje, dados.despesas.length > 0);

  const kpi = (rotulo, valor, extra = '', cls = '') => `<div class="kpi ${cls}"><small>${rotulo}</small><b>${valor}</b>${extra ? `<small>${extra}</small>` : ''}</div>`;
  const varTxt = r.variacao == null ? '—' : `${r.variacao > 0 ? '▲' : r.variacao < 0 ? '▼' : ''} ${formatarPct(Math.abs(r.variacao))}`;

  el.innerHTML = `
    ${lembrete ? `<a class="aviso" href="#/backup">💾 ${dados.config.ultimoBackup ? `Seu último backup foi em ${formatarData(dados.config.ultimoBackup)}.` : 'Você ainda não fez nenhum backup.'} Toque para exportar.</a>` : ''}
    ${avisoCambio(r.moedasSemTaxa)}
    ${filtrosHtml(dados, filtros, ['categoriaId', 'formaPagamentoId', 'status', 'moeda'])}
    <div class="kpis">
      ${kpi('Pago', `<span class="cor-ok">${fmt(r.pago)}</span>`)}
      ${kpi('Pendente', `<span class="cor-aviso">${fmt(r.pendente)}</span>`)}
      ${kpi('Comprometido', fmt(r.comprometido), 'pago + pendente')}
      ${kpi('Orçamento total', fmt(r.orcamentoTotal))}
      ${kpi('Disponível', `<span class="${r.disponivel < 0 ? 'cor-erro' : ''}">${fmt(r.disponivel)}</span>`, 'orçamento − comprometido (Budget)')}
      ${kpi('% do orçamento', formatarPct(r.pctConsumido), 'consumido')}
      ${kpi('Vs. mês anterior', `<span class="${r.variacao > 0 ? 'cor-erro' : r.variacao < 0 ? 'cor-ok' : ''}">${varTxt}</span>`, r.comprometidoAnterior ? `antes: ${fmt(r.comprometidoAnterior)}` : 'sem dados no mês anterior')}
      ${kpi('Compromissos futuros', fmt(r.futuros), `próximos 11 meses${r.futurosPendente ? ' · ⚠ câmbio pendente' : ''}`, 'largo')}
    </div>

    <section class="cartao">
      <div class="cartao-cab"><h3>Saldo</h3>
        <select data-fonte style="width:auto;margin:0">${opcoesFontes(dados, fonteSel)}</select></div>
      <b style="font-size:22px" class="${saldo.valor < 0 ? 'negativo' : ''}">${fmt(saldo.valor)}</b>
      ${saldo.pendente ? '<span class="aviso-pequeno"> ⚠ câmbio pendente</span>' : ''}
      <p class="dica">${fonteSel === 'budget' ? `Orçamento de ${esc(nomeMes(mes))} menos o que já foi pago pelo Budget.` : `No fim de ${esc(nomeMes(mes))}.`}
        <a href="#/saldos">Ver todos os saldos</a></p>
      ${pagas.length ? `<div class="secao-titulo" style="margin-top:4px">Pagas neste mês com essa fonte</div>
        <ul class="lista">${pagas.map((d) => {
          const v = valorNaBase(dados, d);
          return `<li class="item" style="padding:8px 0;cursor:default"><div class="item-info"><div>${esc(nomeExibicao(d))}</div>
            <div class="item-sub">${formatarData(d.dataPagamento)}</div></div><div class="item-valor">${v == null ? formatarMoeda(d.valor, d.moeda) : fmt(v)}</div></li>`;
        }).join('')}</ul>` : '<p class="dica" style="margin:0">Nenhuma despesa paga com essa fonte neste mês.</p>'}
    </section>

    <section class="cartao"><h3>Gasto por categoria</h3><div class="grafico" data-g="cat"></div></section>
    <section class="cartao"><h3>Gasto por forma de pagamento</h3><div class="grafico" data-g="forma"></div></section>
    <section class="cartao"><h3>Gasto acumulado no mês</h3><div class="grafico" data-g="dia"></div></section>
    <section class="cartao"><h3>Planejado × comprometido</h3><div class="grafico alto" data-g="orc"></div></section>
    <p class="dica" style="text-align:center">Gráficos: pago + pendente, convertidos para ${esc(base)}.</p>`;

  ligarFiltros(el, filtros, ctx.atualizar);
  el.querySelector('[data-fonte]').addEventListener('change', (e) => { fonteSel = e.target.value; ctx.atualizar(); });

  const tooltip = { callbacks: { label: (c) => `${c.dataset.label ? c.dataset.label + ': ' : ''}${fmt(Math.round(c.raw * 100))}` } };
  const grafico = (chave, temDados, config) => {
    const box = el.querySelector(`[data-g="${chave}"]`);
    if (!temDados) { box.outerHTML = '<p class="dica">Sem dados neste mês.</p>'; return; }
    if (!window.Chart) { box.outerHTML = '<p class="dica">Gráficos indisponíveis.</p>'; return; }
    box.innerHTML = '<canvas></canvas>';
    criarGrafico(box.querySelector('canvas'), config);
  };

  // Rosca por categoria
  const pc = [...r.porCategoria.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  grafico('cat', pc.length, {
    type: 'doughnut',
    data: {
      labels: pc.map(([id]) => cats.get(id)?.nome || '?'),
      datasets: [{ data: pc.map(([, v]) => v / 100), backgroundColor: pc.map(([id]) => cats.get(id)?.cor || '#888'), borderWidth: 0 }],
    },
    options: { maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'right', labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: (c) => `${c.label}: ${fmt(Math.round(c.raw * 100))}` } } } },
  });

  // Barras horizontais por forma
  const pf = [...r.porForma.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  grafico('forma', pf.length, {
    type: 'bar',
    data: { labels: pf.map(([id]) => formas.get(id)?.nome || '?'), datasets: [{ data: pf.map(([, v]) => v / 100), backgroundColor: '#2563eb', borderRadius: 6 }] },
    options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip }, scales: { x: { ticks: { callback: eixoCompacto } } } },
  });

  // Linha acumulada dia a dia
  grafico('dia', r.comprometido > 0, {
    type: 'line',
    data: {
      labels: r.acumulado.map((_, i) => i + 1),
      datasets: [{ data: r.acumulado.map((v) => v / 100), borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,.12)', fill: true, stepped: true, pointRadius: 0 }],
    },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { ...tooltip, callbacks: { ...tooltip.callbacks, title: (i) => `Dia ${i[0].label}` } } }, scales: { y: { ticks: { callback: eixoCompacto } }, x: { ticks: { maxTicksLimit: 10 } } }, interaction: { mode: 'index', intersect: false } },
  });

  // Planejado × comprometido por categoria
  const pxc = r.planejadoXComprometido;
  grafico('orc', pxc.length, {
    type: 'bar',
    data: {
      labels: pxc.map((l) => l.categoria.nome),
      datasets: [
        { label: 'Planejado', data: pxc.map((l) => l.planejado / 100), backgroundColor: '#9ca3af', borderRadius: 4 },
        { label: 'Comprometido', data: pxc.map((l) => l.comprometido / 100), backgroundColor: pxc.map((l) => (l.nivel === 'estourado' ? '#dc2626' : '#2563eb')), borderRadius: 4 },
      ],
    },
    options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } }, tooltip }, scales: { y: { ticks: { callback: eixoCompacto } }, x: { ticks: { autoSkip: false, maxRotation: 60 } } } },
  });
}
