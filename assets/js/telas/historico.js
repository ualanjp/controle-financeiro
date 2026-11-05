// Histórico mês a mês (o "demonstrativo mensal" da planilha).
import { esc, formatarMoeda, centavosParaTexto, parseValor, nomeMes, nomeMesCurto, mesHoje, addMes } from '../util.js';
import { abrirFolha, confirmar, toast, mostrarErro, criarGrafico } from '../ui.js';
import { demonstrativo, salvarHistorico, excluirHistorico } from '../servicos/rapido.js';
import { eixoCompacto } from './comum.js';

export const titulo = 'Histórico';

const R = (v) => formatarMoeda(v, 'BRL');
const N = (v) => (v < 0 ? '−' : '') + (Math.abs(v) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function render(ctx) {
  const { el, dados, mesAtual } = ctx;
  const linhas = demonstrativo(dados, mesAtual);
  if (!linhas.length) {
    el.innerHTML = `<div class="vazio">Ainda não há meses para mostrar.<br><br>
      Conforme você lança, cada mês aparece aqui com o que entrou, saiu e o acumulado.<br><br>
      <button type="button" class="btn" data-novo>+ Digitar um mês antigo (da planilha)</button></div>`;
    el.querySelector('[data-novo]').addEventListener('click', () => formulario(ctx));
    return;
  }
  const ultima = linhas[linhas.length - 1];
  const fechados = linhas.filter((l) => l.mes < mesAtual).slice(-12);
  const media = fechados.length ? Math.round(fechados.reduce((s, l) => s + l.resultado, 0) / fechados.length) : null;
  const ultimos = linhas.slice(-24);

  el.innerHTML = `
    <div class="kpis">
      <div class="kpi"><small>Acumulado (compilado)</small><b class="${ultima.acumulado >= 0 ? 'cor-ok' : 'cor-erro'}">${ultima.acumulado < 0 ? '−' : ''}${R(Math.abs(ultima.acumulado))}</b></div>
      <div class="kpi"><small>Média por mês${fechados.length ? ` (últimos ${fechados.length})` : ''}</small><b class="${(media ?? 0) >= 0 ? 'cor-ok' : 'cor-erro'}">${media == null ? '—' : `${media < 0 ? '−' : ''}${R(Math.abs(media))}`}</b></div>
    </div>
    <section class="cartao">
      <h3>Resultado de cada mês</h3>
      <div class="grafico"><canvas id="graf-hist"></canvas></div>
    </section>
    <section class="cartao sem-pad"><div class="tabela-rolagem">
      <table class="tabela hist">
        <thead><tr><th>Mês</th><th>Entradas</th><th>Saídas</th><th>Resultado</th><th>Acumulado</th></tr></thead>
        <tbody>${[...linhas].reverse().map((l) => `<tr data-mes="${l.mes}" data-origem="${l.origem}">
          <td><b>${nomeMesCurto(l.mes)}</b>${l.origem === 'manual' ? ' ✎' : ''}${l.mes === mesAtual ? ' <small class="cor-sec">(atual)</small>' : ''}</td>
          <td>${N(l.entradas)}</td><td>${N(l.saidas)}</td>
          <td class="${l.resultado >= 0 ? 'cor-ok' : 'cor-erro'}"><b>${N(l.resultado)}</b></td>
          <td>${N(l.acumulado)}</td></tr>`).join('')}</tbody>
      </table></div></section>
    <p class="dica">Toque num mês para ver o resumo. Meses com ✎ foram digitados à mão (de antes do app) — toque para corrigir.
      Se um mês tem lançamentos no app, valem os lançamentos.</p>
    <button type="button" class="btn btn-bloco" data-novo>+ Digitar um mês antigo (da planilha)</button>`;

  criarGrafico(el.querySelector('#graf-hist'), {
    type: 'bar',
    data: {
      labels: ultimos.map((l) => nomeMesCurto(l.mes)),
      datasets: [
        { type: 'bar', label: 'Resultado', data: ultimos.map((l) => l.resultado / 100), backgroundColor: ultimos.map((l) => (l.resultado >= 0 ? '#059669' : '#dc2626')), borderRadius: 4, yAxisID: 'y' },
        { type: 'line', label: 'Acumulado', data: ultimos.map((l) => l.acumulado / 100), borderColor: '#2563eb', backgroundColor: '#2563eb', tension: 0.25, pointRadius: 2, yAxisID: 'y1' },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${R(Math.round(c.raw * 100))}` } } },
      scales: {
        y: { ticks: { callback: eixoCompacto }, title: { display: true, text: 'Resultado' } },
        y1: { position: 'right', grid: { display: false }, ticks: { callback: eixoCompacto }, title: { display: true, text: 'Acumulado' } },
      },
    },
  });

  el.querySelector('tbody').addEventListener('click', (e) => {
    const tr = e.target.closest('tr');
    if (!tr) return;
    if (tr.dataset.origem === 'manual') {
      formulario(ctx, dados.historico.find((h) => h.mes === tr.dataset.mes));
    } else {
      location.hash = '#/resumo';
      ctx.definirMes(tr.dataset.mes);
    }
  });
  el.querySelector('[data-novo]').addEventListener('click', () => formulario(ctx));
}

function formulario(ctx, h = null) {
  const sugestao = addMes(mesHoje(), -1);
  const f = abrirFolha(h ? `Corrigir ${nomeMes(h.mes)}` : 'Mês antigo', `<form class="form" novalidate>
    <p class="dica">Use para os meses de antes do app (da sua planilha). Basta o total que entrou e o total que saiu no mês.</p>
    <label>Mês<input type="month" name="mes" value="${h ? h.mes : sugestao}" ${h ? 'disabled' : ''}></label>
    <div class="linha2">
      <label>Total que entrou<input name="entradas" inputmode="decimal" placeholder="0,00" value="${h ? centavosParaTexto(h.entradas) : ''}"></label>
      <label>Total que saiu<input name="saidas" inputmode="decimal" placeholder="0,00" value="${h ? centavosParaTexto(h.saidas) : ''}"></label>
    </div>
    <div class="acoes">
      ${h ? '<button type="button" class="btn" data-excluir style="color:var(--erro)">Excluir</button>' : ''}
      <button type="submit" class="btn btn-pri">Salvar</button>
    </div></form>`);
  const form = f.corpo.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const mes = h ? h.mes : fd.get('mes');
    try {
      if (!h && ctx.dados.historico.some((x) => x.mes === mes)) {
        if (!(await confirmar(`${nomeMes(mes)} já foi digitado. Substituir?`, { ok: 'Substituir' }))) return;
      }
      await salvarHistorico({ mes, entradas: parseValor(fd.get('entradas')) ?? 0, saidas: parseValor(fd.get('saidas')) ?? 0 });
      toast(`✓ ${nomeMes(mes)} salvo`);
      f.fechar();
      ctx.atualizar();
    } catch (err) { mostrarErro(err); }
  });
  form.querySelector('[data-excluir]')?.addEventListener('click', async () => {
    if (!(await confirmar(`Excluir ${nomeMes(h.mes)} do histórico?`, { ok: 'Excluir', perigo: true }))) return;
    try { await excluirHistorico(h.mes); toast('Mês excluído'); f.fechar(); ctx.atualizar(); } catch (err) { mostrarErro(err); }
  });
}
