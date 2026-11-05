// Tela principal: lançamento rápido em texto + lista do mês.
import { esc, formatarMoeda, formatarData, centavosParaTexto, parseValor, difDias } from '../util.js';
import { abrirFolha, confirmar, toast, mostrarErro } from '../ui.js';
import {
  interpretarTexto, salvarLancamentos, salvarLancamento, excluirLancamento, aprender, resumoMes,
  mapaAprendizado, ajustarAoGrupo, infoCategoria, GRUPOS, CATEGORIAS_RAPIDAS, CLASSES,
} from '../servicos/rapido.js';
import { precisaLembrete } from '../servicos/backup.js';

export const titulo = 'Lançar';
export const usaMes = true;

const R = (v) => formatarMoeda(v, 'BRL');
let filtro = 'tudo';
let rascunho = '';

const FILTROS = [['tudo', 'Tudo'], ['entrada', '🟢 Entradas'], ['saida', '🟥 Saídas'], ['oficina', '🔧 Oficina'], ['pessoal', '🙋 Pessoal']];
const passaFiltro = (l) => filtro === 'tudo' || l.tipo === filtro || l.grupo === filtro;

const tagGrupo = (g) => `<span class="tag tag-${g}">${GRUPOS[g]}</span>`;
function nomeDia(data, hoje) {
  const d = difDias(data, hoje);
  if (d === 0) return 'Hoje';
  if (d === 1) return 'Ontem';
  const sem = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][new Date(`${data}T12:00:00`).getDay()];
  return `${formatarData(data).slice(0, 5)} (${sem})`;
}
export const textoItem = (l) =>
  `${l.tipo === 'entrada' ? 'Entrou' : 'Saiu'} ${R(l.valor)} · ${l.descricao} · ${GRUPOS[l.grupo]}${l.categoria ? ` · ${l.categoria}` : ''}`;

export async function render(ctx) {
  const { el, dados, mes, hoje } = ctx;
  const r = resumoMes(dados, mes);
  const lista = dados.lancamentos.filter((l) => l.mes === mes && passaFiltro(l))
    .sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id);
  const dias = new Map();
  for (const l of lista) { if (!dias.has(l.data)) dias.set(l.data, []); dias.get(l.data).push(l); }
  const lembrete = precisaLembrete(dados.config, hoje, dados.lancamentos.length > 0);

  el.innerHTML = `
    ${lembrete ? '<a class="aviso" href="#/backup">💾 Faz tempo que você não faz backup. Toque aqui para salvar uma cópia dos seus dados.</a>' : ''}
    <section class="cartao rapido">
      <textarea id="rapido-txt" rows="2" autocomplete="off" autocapitalize="sentences" spellcheck="false"
        placeholder="saiu 30,00 almoço&#10;entrou 500,00 Caetano"></textarea>
      <button type="button" class="btn btn-pri btn-bloco" data-lancar>⚡ Lançar</button>
      <details class="ajuda"><summary>Como escrever?</summary>
        <p>Escreva <b>saiu</b> ou <b>entrou</b>, o <b>valor</b> e a <b>descrição</b>. Se quiser, termine com <b>pessoal</b> ou <b>oficina</b>.</p>
        <p><code>saiu 30,00 almoço</code><br><code>saiu 542,00 Julio RDM oficina</code><br><code>entrou 450,00 Edgar</code><br><code>entrou 200,00 aluguel pessoal</code></p>
        <p>Sem escrever nada no final: <b>entrou</b> conta como Oficina, <b>saiu</b> como Pessoal, e <b>fornecedor</b> sempre como Oficina.
        Se você corrigir um lançamento, o app aprende e da próxima vez já acerta.</p>
        <p>Dá para <b>colar várias mensagens do WhatsApp</b> de uma vez (uma por linha). O app mostra a lista para você conferir antes de salvar.</p>
      </details>
    </section>

    <div class="kpis kpis3">
      <div class="kpi"><small>Entrou</small><b class="cor-ok">${R(r.entradas)}</b></div>
      <div class="kpi"><small>Saiu</small><b class="cor-erro">${R(r.saidas)}</b></div>
      <div class="kpi"><small>${r.resultado >= 0 ? 'Sobrou' : 'Faltou'}</small><b class="${r.resultado >= 0 ? 'cor-ok' : 'cor-erro'}">${R(Math.abs(r.resultado))}</b></div>
    </div>
    <p class="dica" style="margin-top:-4px">Já com as contas fixas do mês. <a href="#/resumo">Ver resumo completo ›</a></p>

    <div class="chips">${FILTROS.map(([v, t]) => `<button type="button" class="chip ${filtro === v ? 'ativo' : ''}" data-filtro="${v}">${t}</button>`).join('')}</div>
    ${lista.length ? [...dias].map(([data, itens]) => {
      const saldo = itens.reduce((s, l) => s + (l.tipo === 'entrada' ? l.valor : -l.valor), 0);
      return `<div class="dia-cab"><span>${esc(nomeDia(data, hoje))}</span><span class="${saldo >= 0 ? 'cor-ok' : 'cor-erro'}">${saldo >= 0 ? '+' : '−'} ${R(Math.abs(saldo))}</span></div>
      <ul class="lista cartao sem-pad">${itens.map((l) => {
        const ent = l.tipo === 'entrada';
        const ic = ent ? '+' : infoCategoria(l.categoria).icone;
        return `<li class="item" data-id="${l.id}">
          <span class="bolinha" style="--cor:${ent ? 'var(--ok)' : 'var(--erro)'}">${ic}</span>
          <div class="item-info"><div class="item-nome">${esc(l.descricao)}</div>
            <div class="item-sub">${tagGrupo(l.grupo)}${l.categoria ? ` · ${esc(l.categoria)}` : ''}</div></div>
          <div class="item-dir"><div class="item-valor ${ent ? 'cor-ok' : 'cor-erro'}">${ent ? '+' : '−'} ${R(l.valor)}</div></div></li>`;
      }).join('')}</ul>`;
    }).join('') : `<div class="vazio">${filtro === 'tudo' ? 'Nenhum lançamento neste mês ainda.<br>Escreva acima, por exemplo: <b>saiu 30,00 almoço</b>' : 'Nada com esse filtro.'}</div>`}`;

  const ta = el.querySelector('#rapido-txt');
  ta.value = rascunho;
  const crescer = () => { ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight + 2, 260)}px`; };
  ta.addEventListener('input', () => { rascunho = ta.value; crescer(); });
  if (rascunho) crescer();
  const limpar = () => { rascunho = ''; ta.value = ''; crescer(); };

  el.querySelector('[data-lancar]').addEventListener('click', async () => {
    const { itens, erros } = interpretarTexto(ta.value, { hoje, aprendizado: mapaAprendizado(dados), lancamentos: dados.lancamentos });
    if (!itens.length && !erros.length) { toast('Escreva algo como: saiu 30,00 almoço'); ta.focus(); return; }
    if (itens.length === 1 && !erros.length && !itens[0].duplicado) {
      try {
        const [rec] = await salvarLancamentos(itens);
        limpar();
        toast(`✓ ${textoItem(rec)}  ·  toque para desfazer`, {
          duracao: 6000,
          aoTocar: async () => { await excluirLancamento(rec.id); toast('Lançamento desfeito'); ctx.atualizar(); },
        });
        if (rec.mes !== mes) ctx.definirMes(rec.mes); else ctx.atualizar();
      } catch (e) { mostrarErro(e); }
      return;
    }
    conferir(ctx, itens, erros, limpar);
  });
  el.querySelectorAll('[data-filtro]').forEach((b) => b.addEventListener('click', () => { filtro = b.dataset.filtro; ctx.atualizar(); }));
  el.querySelectorAll('.lista').forEach((ul) => ul.addEventListener('click', (e) => {
    const li = e.target.closest('[data-id]');
    if (li) editar(ctx, dados.lancamentos.find((l) => l.id === Number(li.dataset.id)));
  }));
}

/** Lista para conferir antes de salvar (várias linhas, linha repetida ou linha não entendida). */
function conferir(ctx, itens, erros, limpar) {
  const { hoje } = ctx;
  const semData = itens.some((i) => !i.dataDoTexto);
  const sel = itens.map((i) => !i.duplicado);
  const trocados = new Set();
  const f = abrirFolha('Conferir lançamentos', `
    ${itens.length ? `<p class="dica">Toque em <b>Pessoal/Oficina</b> para trocar. Desmarque o que não quiser salvar.</p>` : ''}
    ${semData && itens.length ? `<label class="campo">Data (para as linhas sem data)<input type="date" data-data value="${hoje}"></label>` : ''}
    <ul class="lista conf">${itens.map((i, n) => `<li class="item conf-item ${i.duplicado ? 'dup' : ''}" data-n="${n}">
      <input type="checkbox" data-sel ${sel[n] ? 'checked' : ''} aria-label="Salvar este">
      <div class="item-info"><div class="item-nome">${i.tipo === 'entrada' ? '🟢' : '🟥'} ${esc(i.descricao)}</div>
        <div class="item-sub"><span data-dt>${formatarData(i.data)}</span>${i.categoria ? ` · <span data-cat>${esc(i.categoria)}</span>` : ''}${i.duplicado ? ' · <b class="cor-aviso">já lançado</b>' : ''}</div></div>
      <div class="item-dir"><div class="item-valor ${i.tipo === 'entrada' ? 'cor-ok' : 'cor-erro'}">${i.tipo === 'entrada' ? '+' : '−'} ${R(i.valor)}</div>
        <button type="button" class="selo tag-${i.grupo}" data-grupo>${GRUPOS[i.grupo]}</button></div></li>`).join('')}</ul>
    ${erros.length ? `<div class="aviso"><b>Não entendi ${erros.length === 1 ? 'esta linha' : `estas ${erros.length} linhas`}:</b>
      ${erros.map((e) => `<div class="erro-linha">“${esc(e.linha)}” — ${esc(e.erro)}</div>`).join('')}
      <div style="margin-top:6px">Elas continuam na caixa de texto para você corrigir.</div></div>` : ''}
    <div class="acoes"><button type="button" class="btn" data-fechar>Cancelar</button>
      ${itens.length ? '<button type="button" class="btn btn-pri" data-salvar></button>' : ''}</div>`);
  const btn = f.corpo.querySelector('[data-salvar]');
  const atualizarBotao = () => {
    if (!btn) return;
    const n = sel.filter(Boolean).length;
    btn.textContent = n ? `Salvar ${n}` : 'Nada marcado';
    btn.disabled = !n;
  };
  atualizarBotao();
  f.corpo.querySelector('[data-data]')?.addEventListener('change', (e) => {
    if (!e.target.value) return;
    itens.forEach((i, n) => {
      if (i.dataDoTexto) return;
      i.data = e.target.value;
      f.corpo.querySelector(`[data-n="${n}"] [data-dt]`).textContent = formatarData(i.data);
    });
  });
  f.corpo.querySelectorAll('[data-n]').forEach((li) => {
    const n = Number(li.dataset.n);
    const i = itens[n];
    li.querySelector('[data-sel]').addEventListener('change', (e) => { sel[n] = e.target.checked; atualizarBotao(); });
    li.querySelector('[data-grupo]').addEventListener('click', (e) => {
      i.grupo = i.grupo === 'oficina' ? 'pessoal' : 'oficina';
      if (i.tipo === 'saida') Object.assign(i, ajustarAoGrupo(i.grupo, i.categoria, i.classe));
      trocados.add(n);
      e.target.className = `selo tag-${i.grupo}`;
      e.target.textContent = GRUPOS[i.grupo];
      const cat = li.querySelector('[data-cat]');
      if (cat) cat.textContent = i.categoria;
    });
  });
  btn?.addEventListener('click', async () => {
    try {
      const escolhidos = itens.filter((_, n) => sel[n]);
      await salvarLancamentos(escolhidos);
      for (const n of trocados) if (sel[n]) await aprender(itens[n].descricao, itens[n]);
      // Linhas não entendidas ficam na caixa para corrigir; o resto sai.
      if (erros.length) { rascunho = erros.map((e) => e.linha).join('\n'); } else limpar();
      f.fechar();
      toast(`✓ ${escolhidos.length} lançamento(s) salvo(s)`);
      ctx.atualizar();
    } catch (e) { mostrarErro(e); }
  });
}

function editar(ctx, l) {
  if (!l) return;
  const opcoesCat = CATEGORIAS_RAPIDAS.map((c) => `<option ${c.nome === l.categoria ? 'selected' : ''}>${esc(c.nome)}</option>`).join('');
  const opcoesClasse = Object.entries(CLASSES).map(([k, c]) => `<option value="${k}" ${k === l.classe ? 'selected' : ''}>${c.nome}</option>`).join('');
  const f = abrirFolha('Editar lançamento', `<form class="form" novalidate>
    <div class="segmentado">
      <label><input type="radio" name="tipo" value="saida" ${l.tipo === 'saida' ? 'checked' : ''}><span>🟥 Saiu</span></label>
      <label><input type="radio" name="tipo" value="entrada" ${l.tipo === 'entrada' ? 'checked' : ''}><span>🟢 Entrou</span></label>
    </div>
    <div class="linha2">
      <label>Valor<input name="valor" inputmode="decimal" value="${centavosParaTexto(l.valor)}"></label>
      <label>Data<input type="date" name="data" value="${l.data}"></label>
    </div>
    <label>Descrição<input name="descricao" value="${esc(l.descricao)}"></label>
    <div class="segmentado">
      <label><input type="radio" name="grupo" value="pessoal" ${l.grupo === 'pessoal' ? 'checked' : ''}><span>🙋 Pessoal</span></label>
      <label><input type="radio" name="grupo" value="oficina" ${l.grupo === 'oficina' ? 'checked' : ''}><span>🔧 Oficina</span></label>
    </div>
    <div class="linha2" data-so-saida>
      <label>Categoria<select name="categoria">${opcoesCat}</select></label>
      <label>Tipo de gasto<select name="classe">${opcoesClasse}</select></label>
    </div>
    <p class="dica" data-so-saida>Se mudar Pessoal/Oficina, categoria ou tipo, o app lembra para as próximas vezes com essa mesma descrição.</p>
    <div class="acoes">
      <button type="button" class="btn" data-excluir style="color:var(--erro)">Excluir</button>
      <button type="submit" class="btn btn-pri">Salvar</button>
    </div></form>`);
  const form = f.corpo.querySelector('form');
  const mostrar = () => {
    const saida = form.querySelector('[name=tipo]:checked').value === 'saida';
    form.querySelectorAll('[data-so-saida]').forEach((x) => { x.hidden = !saida; });
  };
  form.querySelectorAll('[name=tipo]').forEach((x) => x.addEventListener('change', mostrar));
  mostrar();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const novo = {
      ...l, tipo: fd.get('tipo'), valor: parseValor(fd.get('valor')), data: fd.get('data'),
      descricao: fd.get('descricao'), grupo: fd.get('grupo'),
      categoria: fd.get('categoria') || 'Diária', classe: fd.get('classe') || null,
    };
    try {
      await salvarLancamento(novo);
      const mudou = novo.grupo !== l.grupo || (novo.tipo === 'saida' && (novo.categoria !== l.categoria || novo.classe !== l.classe));
      if (mudou) await aprender(novo.descricao, novo);
      toast('✓ Lançamento salvo');
      f.fechar();
      ctx.atualizar();
    } catch (err) { mostrarErro(err); }
  });
  form.querySelector('[data-excluir]').addEventListener('click', async () => {
    if (!(await confirmar(`Excluir "${l.descricao}" (${R(l.valor)})?`, { ok: 'Excluir', perigo: true }))) return;
    try { await excluirLancamento(l.id); toast('Lançamento excluído'); f.fechar(); ctx.atualizar(); } catch (err) { mostrarErro(err); }
  });
}
