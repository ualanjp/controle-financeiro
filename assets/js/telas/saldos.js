import { esc, formatarMoeda, formatarData, formatarPct, parseValor, centavosParaTexto, nomeMes, nomeMesCurto } from '../util.js';
import { abrirFolha, confirmar, toast, mostrarErro, criarGrafico } from '../ui.js';
import { cartoesSaldos, evolucao, listaMovimentacoes, nomeSaldo } from '../servicos/saldos.js';
import { converter } from '../servicos/cambio.js';
import { salvarMovimentacao, excluirMovimentacao, salvarSaldoManual, excluirSaldoManual } from '../servicos/cadastros.js';
import { opcoesMoedas, eixoCompacto } from './comum.js';

export const titulo = 'Saldos';
export const usaMes = true;
export const pai = 'mais';
export const aba = 'mais';

let selecionado = 'savings';
const filtros = { saldoId: '', mes: '', tipo: '' };

const DESCRICOES = {
  budget: 'Orçamento do mês − pagos pelo Budget',
  savings: 'Sobras dos meses fechados + saldos + poupança − pagos pelo Savings',
  poupanca: 'Aportes na categoria − estouros do orçamento',
};

export async function render(ctx) {
  const { el, dados, mes, mesAtual } = ctx;
  const base = dados.config.moedaBase;
  const fmt = (v) => formatarMoeda(v, base);
  const cartoes = cartoesSaldos(dados, mes, mesAtual);
  if (!cartoes.some((c) => c.chave === selecionado)) selecionado = 'savings';
  const manuais = [...dados.saldosManuais].sort((a, b) => a.ordem - b.ordem || a.id - b.id);
  const movs = listaMovimentacoes(dados, filtros);
  const nomeManual = (id) => dados.saldosManuais.find((s) => s.id === id)?.nome || '(removido)';

  el.innerHTML = `
    <p class="dica" style="margin-top:0">Valores no fim de ${esc(nomeMes(mes))}${mes === mesAtual ? ' (mês em andamento: a sobra/estouro dele só conta quando ele terminar)' : ''}. Toque num cartão para ver a evolução.</p>
    <div class="saldos-grade">
      ${cartoes.map((c) => `<button type="button" class="saldo-cartao ${c.chave === selecionado ? 'sel' : ''}" data-chave="${esc(c.chave)}">
        <small>${esc(c.nome)}</small>
        <b class="${c.valor < 0 ? 'negativo' : ''}">${fmt(c.valor)}</b>
        ${c.variacao !== undefined ? `<small>${c.variacao == null ? '—' : formatarPct(c.variacao, true)} vs. mês anterior</small>` : ''}
        ${DESCRICOES[c.chave] ? `<small>${DESCRICOES[c.chave]}</small>` : ''}
        ${c.pendente ? '<small class="aviso-pequeno">⚠ câmbio pendente</small>' : ''}
      </button>`).join('')}
    </div>
    <section class="cartao">
      <div class="cartao-cab"><h3>${esc(nomeSaldo(dados, selecionado))} — últimos 12 meses</h3></div>
      <div class="grafico"><canvas id="graf-evolucao"></canvas></div>
    </section>

    <div class="cartao-cab" style="margin:18px 4px 8px"><h3 style="margin:0">Movimentações</h3>
      <button type="button" class="btn btn-link" data-gerenciar>⚙ Gerenciar saldos</button></div>
    <section class="cartao">
      <div class="grade-filtros" style="margin-top:0;grid-template-columns:1fr 1fr 1fr">
        <label>Saldo<select data-f="saldoId"><option value="">Todos</option>
          ${manuais.map((s) => `<option value="${s.id}">${esc(s.nome)}</option>`).join('')}</select></label>
        <label>Mês<input type="month" data-f="mes"></label>
        <label>Tipo<select data-f="tipo"><option value="">Todos</option><option value="entrada">Entrada</option><option value="saida">Saída</option></select></label>
      </div>
    </section>
    ${movs.length ? `<ul class="lista cartao sem-pad">${movs.map((m) => {
      const conv = m.moeda !== base ? converter(dados, m.valor, m.moeda, m.data.slice(0, 7)) : null;
      return `<li class="item" data-origem="${m.origem}" data-id="${m.id}">
        <span class="bolinha" style="--cor:${m.tipo === 'entrada' ? 'var(--ok)' : 'var(--erro)'}">${m.tipo === 'entrada' ? '↓' : '↑'}</span>
        <div class="item-info">
          <div class="item-nome">${esc(m.descricao || (m.tipo === 'entrada' ? 'Entrada' : 'Saída'))}</div>
          <div class="item-sub">${esc(nomeManual(m.saldoId))} · ${formatarData(m.data)}${m.origem === 'despesa' ? ' · despesa paga 🔗' : ''}</div>
        </div>
        <div class="item-dir">
          <div class="item-valor ${m.tipo === 'entrada' ? 'cor-ok' : 'cor-erro'}">${m.tipo === 'entrada' ? '+' : '−'} ${formatarMoeda(m.valor, m.moeda)}</div>
          ${m.moeda !== base ? `<div class="item-conv">${conv == null ? '⚠ sem câmbio' : '≈ ' + fmt(conv)}</div>` : ''}
        </div></li>`;
    }).join('')}</ul>` : '<div class="vazio">Nenhuma movimentação.</div>'}
    <button type="button" class="fab" aria-label="Nova movimentação">+</button>`;

  // Gráfico de evolução
  const pontos = evolucao(dados, selecionado, mes, mesAtual);
  criarGrafico(el.querySelector('#graf-evolucao'), {
    type: 'line',
    data: {
      labels: pontos.map((p) => nomeMesCurto(p.mes)),
      datasets: [{
        label: nomeSaldo(dados, selecionado), data: pontos.map((p) => p.valor / 100),
        borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,.12)', fill: true, tension: 0.25, pointRadius: 3,
      }],
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => fmt(Math.round(c.raw * 100)) } } },
      scales: { y: { ticks: { callback: eixoCompacto } } },
    },
  });

  el.querySelectorAll('[data-chave]').forEach((b) => b.addEventListener('click', () => { selecionado = b.dataset.chave; ctx.atualizar(); }));
  el.querySelectorAll('[data-f]').forEach((i) => {
    i.value = filtros[i.dataset.f];
    i.addEventListener('change', () => { filtros[i.dataset.f] = i.value; ctx.atualizar(); });
  });
  el.querySelector('.fab').addEventListener('click', () => abrirFormMov(ctx));
  el.querySelector('[data-gerenciar]').addEventListener('click', () => gerenciarSaldos(ctx));
  el.querySelector('.lista')?.addEventListener('click', (e) => {
    const li = e.target.closest('.item');
    if (!li) return;
    if (li.dataset.origem === 'despesa') { location.hash = `#/despesas/${li.dataset.id}`; return; }
    abrirFormMov(ctx, dados.movimentacoes.find((m) => m.id === Number(li.dataset.id)));
  });
}

function abrirFormMov(ctx, mov = null) {
  const { dados } = ctx;
  const ativos = dados.saldosManuais.filter((s) => !s.arquivado || s.id === mov?.saldoId);
  if (!ativos.length) { toast('Crie um saldo primeiro (Gerenciar saldos).'); return; }
  const m = mov || { saldoId: ativos[0].id, tipo: 'entrada', valor: null, moeda: dados.config.moedaBase, data: ctx.hoje, descricao: '' };
  const f = abrirFolha(mov ? 'Editar movimentação' : 'Nova movimentação', `<form class="form" novalidate>
    <label>Saldo<select name="saldoId">${ativos.map((s) => `<option value="${s.id}" ${s.id === m.saldoId ? 'selected' : ''}>${esc(s.nome)}</option>`).join('')}</select></label>
    <div class="segmentado">
      <label><input type="radio" name="tipo" value="entrada" ${m.tipo === 'entrada' ? 'checked' : ''}><span>Entrada</span></label>
      <label><input type="radio" name="tipo" value="saida" ${m.tipo === 'saida' ? 'checked' : ''}><span>Saída</span></label>
    </div>
    <div class="linha2">
      <label>Valor<input name="valor" inputmode="decimal" placeholder="0,00" value="${centavosParaTexto(m.valor)}"></label>
      <label>Moeda<select name="moeda">${opcoesMoedas(dados, m.moeda)}</select></label>
    </div>
    <label>Data<input type="date" name="data" value="${m.data}"></label>
    <label>Descrição (opcional)<input name="descricao" value="${esc(m.descricao || '')}"></label>
    <div class="acoes">
      ${mov ? '<button type="button" class="btn" data-excluir style="color:var(--erro)">Excluir</button>' : ''}
      <button type="submit" class="btn btn-pri">Salvar</button>
    </div></form>`);
  const form = f.corpo.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      await salvarMovimentacao({
        ...(mov ? { id: mov.id } : {}),
        saldoId: Number(fd.get('saldoId')), tipo: fd.get('tipo'), valor: parseValor(fd.get('valor')),
        moeda: fd.get('moeda'), data: fd.get('data'), descricao: fd.get('descricao'),
      });
      toast('✓ Movimentação salva');
      f.fechar();
      ctx.atualizar();
    } catch (err) { mostrarErro(err); }
  });
  form.querySelector('[data-excluir]')?.addEventListener('click', async () => {
    if (!(await confirmar('Excluir esta movimentação?', { ok: 'Excluir', perigo: true }))) return;
    try { await excluirMovimentacao(mov.id); toast('Movimentação excluída'); f.fechar(); ctx.atualizar(); } catch (err) { mostrarErro(err); }
  });
}

function gerenciarSaldos(ctx) {
  const { dados } = ctx;
  const lista = [...dados.saldosManuais].sort((a, b) => a.ordem - b.ordem || a.id - b.id);
  const linha = (s) => `<li class="item" data-id="${s.id}" style="cursor:default">
    <div class="item-info"><input data-nome value="${esc(s.nome)}" aria-label="Nome do saldo"></div>
    <button type="button" class="btn-icone" data-arquivar title="${s.arquivado ? 'Desarquivar' : 'Arquivar'}">${s.arquivado ? '📤' : '🗄️'}</button>
    <button type="button" class="btn-icone" data-excluir title="Excluir">🗑️</button></li>`;
  const f = abrirFolha('Gerenciar saldos', `
    <p class="dica">Saldos são "potes" de dinheiro (ex.: Viagem, Reserva). Altere o nome e toque fora para salvar.</p>
    <ul class="lista">${lista.filter((s) => !s.arquivado).map(linha).join('')}</ul>
    ${lista.some((s) => s.arquivado) ? `<div class="secao-titulo">Arquivados</div><ul class="lista">${lista.filter((s) => s.arquivado).map(linha).join('')}</ul>` : ''}
    <form class="form" data-novo style="display:flex;gap:8px;align-items:flex-end">
      <label style="flex:1;margin:0">Novo saldo<input name="nome" placeholder="ex.: Viagem"></label>
      <button class="btn btn-pri" type="submit">Criar</button></form>`);
  const recarregar = () => f.fechar(); // ao fechar, a tela é atualizada
  f.corpo.querySelectorAll('[data-id]').forEach((li) => {
    const s = dados.saldosManuais.find((x) => x.id === Number(li.dataset.id));
    li.querySelector('[data-nome]').addEventListener('change', async (e) => {
      try { await salvarSaldoManual(dados, { ...s, nome: e.target.value }); toast('✓ Nome salvo'); s.nome = e.target.value.trim(); } catch (err) { mostrarErro(err); e.target.value = s.nome; }
    });
    li.querySelector('[data-arquivar]').addEventListener('click', async () => {
      try { await salvarSaldoManual(dados, { ...s, arquivado: !s.arquivado }); recarregar(); } catch (err) { mostrarErro(err); }
    });
    li.querySelector('[data-excluir]').addEventListener('click', async () => {
      try {
        if (!(await confirmar(`Excluir o saldo "${s.nome}"?`, { ok: 'Excluir', perigo: true }))) return;
        await excluirSaldoManual(dados, s.id);
        toast('Saldo excluído');
        recarregar();
      } catch (err) { mostrarErro(err); }
    });
  });
  f.corpo.querySelector('[data-novo]').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await salvarSaldoManual(dados, { nome: e.target.nome.value }); toast('✓ Saldo criado'); recarregar(); } catch (err) { mostrarErro(err); }
  });
  f.aoFechar(() => ctx.atualizar());
}
