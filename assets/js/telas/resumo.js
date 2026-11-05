// Resumo do mês no formato da planilha: receitas/despesas fixas e variáveis e a situação real.
import { esc, formatarMoeda, formatarData, nomeMes, addMes } from '../util.js';
import { abrirFolha, toast } from '../ui.js';
import { resumoMes, infoCategoria, CLASSES, GRUPOS } from '../servicos/rapido.js';

export const titulo = 'Resumo do mês';
export const usaMes = true;

const R = (v) => formatarMoeda(v, 'BRL');
const pctTxt = (p) => `${p.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

function barras(itens) {
  if (!itens.length) return '<p class="dica">Nenhuma despesa do dia a dia neste mês.</p>';
  return itens.map((i) => `<div class="barra-linha">
    <div class="barra-topo"><span>${esc(i.rotulo)}</span><b>${R(i.valor)}</b><small>${pctTxt(i.pct)}</small></div>
    <div class="barra-prog"><span style="width:${Math.max(i.pct, 1)}%;background:${i.cor}"></span></div></div>`).join('');
}
function variacao(atual, anterior, maiorEhBom) {
  const d = atual - anterior;
  if (!d) return '<small class="cor-sec">igual</small>';
  const bom = maiorEhBom ? d > 0 : d < 0;
  return `<small class="${bom ? 'cor-ok' : 'cor-erro'}">${d > 0 ? '▲' : '▼'} ${R(Math.abs(d))}</small>`;
}

export function textoResumo(mes, r) {
  const linhas = [
    `📋 Resumo de ${nomeMes(mes)}`,
    '',
    `Receitas fixas: ${R(r.receitasFixas)}`,
    `Receitas variáveis: ${R(r.receitasVariaveis)}`,
    `Despesas fixas: ${R(r.despesasFixas)}`,
    `Despesas variáveis: ${R(r.despesasVariaveis)}`,
    '',
    `Total que entrou: ${R(r.entradas)}`,
    `Total que saiu: ${R(r.saidas)}`,
    `SITUAÇÃO REAL: ${r.resultado < 0 ? '-' : ''}${R(Math.abs(r.resultado))} ${r.resultado >= 0 ? '✅' : '⚠️'}`,
    '',
    ...r.porGrupo.map((g) => `${g.nome}: entrou ${R(g.entradas)}, saiu ${R(g.saidas)}, resultado ${g.resultado < 0 ? '-' : ''}${R(Math.abs(g.resultado))}`),
  ];
  if (r.porCategoria.length) {
    linhas.push('', 'Gastos do dia a dia:', ...r.porCategoria.map((c) => `• ${c.chave}: ${R(c.valor)} (${pctTxt(c.pct)})`));
  }
  return linhas.join('\n');
}

export async function render(ctx) {
  const { el, dados, mes } = ctx;
  const r = resumoMes(dados, mes);
  const antMes = addMes(mes, -1);
  const ant = resumoMes(dados, antMes);

  if (!r.temDados) {
    el.innerHTML = `<div class="vazio">Nada lançado em ${esc(nomeMes(mes))}.<br><br>
      <a class="btn btn-pri" href="#/rapido">⚡ Lançar gastos e entradas</a><br><br>
      <a class="btn" href="#/fixas">📌 Cadastrar contas fixas</a></div>`;
    return;
  }
  const pos = r.resultado >= 0;
  el.innerHTML = `
    <section class="cartao situacao ${pos ? 'pos' : 'neg'}">
      <small>SITUAÇÃO REAL</small>
      <b>${pos ? '' : '−'}${R(Math.abs(r.resultado))}</b>
      <span>${pos ? 'Sobrou dinheiro no mês 👍' : 'Saiu mais do que entrou ⚠️'}</span>
    </section>

    <div class="quadro4">
      <div class="q"><small>Receitas fixas</small><b>${R(r.receitasFixas)}</b></div>
      <div class="q"><small>Receitas variáveis</small><b>${R(r.receitasVariaveis)}</b></div>
      <div class="q desp"><small>Despesas fixas</small><b>${R(r.despesasFixas)}</b></div>
      <div class="q desp"><small>Despesas variáveis</small><b>${R(r.despesasVariaveis)}</b></div>
      <div class="q tot"><small>Total que entrou</small><b class="cor-ok">${R(r.entradas)}</b></div>
      <div class="q tot desp"><small>Total que saiu</small><b class="cor-erro">${R(r.saidas)}</b></div>
    </div>

    <section class="cartao">
      <h3>🔧 Oficina × 🙋 Pessoal</h3>
      <div class="tabela-rolagem"><table class="tabela">
        <thead><tr><th></th><th>Entrou</th><th>Saiu</th><th>Resultado</th></tr></thead>
        <tbody>${r.porGrupo.map((g) => `<tr><td><b>${g.nome}</b></td><td>${R(g.entradas)}</td><td>${R(g.saidas)}</td>
          <td class="${g.resultado >= 0 ? 'cor-ok' : 'cor-erro'}"><b>${g.resultado < 0 ? '−' : ''}${R(Math.abs(g.resultado))}</b></td></tr>`).join('')}</tbody>
      </table></div>
      <p class="dica" style="margin-bottom:0">Inclui as contas fixas de cada um.</p>
    </section>

    <section class="cartao">
      <h3>Onde foi o dinheiro do dia a dia</h3>
      ${barras(r.porCategoria.map((c) => ({ rotulo: `${infoCategoria(c.chave).icone} ${c.chave}`, valor: c.valor, pct: c.pct, cor: infoCategoria(c.chave).cor })))}
    </section>

    <section class="cartao">
      <h3>Necessidade × Desejo</h3>
      ${barras(r.porClasse.map((c) => ({ rotulo: CLASSES[c.chave]?.nome || 'Sem classificação', valor: c.valor, pct: c.pct, cor: CLASSES[c.chave]?.cor || 'var(--neutro)' })))}
    </section>

    <section class="cartao">
      <div class="cartao-cab"><h3>📌 Contas fixas</h3><a href="#/fixas" class="btn-link">Ver ›</a></div>
      <div class="linhas-info">
        <div><span>Fixas da oficina</span><b>${R(r.fixas.oficina)}</b></div>
        <div><span>Fixas pessoais (casa)</span><b>${R(r.fixas.pessoal)}</b></div>
        ${r.fixas.consorcios ? `<div><span>Consórcios</span><b>${R(r.fixas.consorcios)}</b></div>` : ''}
        <div><span>Pagas</span><b>${r.fixas.pagas} de ${r.fixas.despesas}</b></div>
        ${r.fixas.faltaPagar ? `<div><span>Falta pagar</span><b class="cor-aviso">${R(r.fixas.faltaPagar)}</b></div>` : ''}
        ${r.fixas.faltaReceber ? `<div><span>Falta receber</span><b class="cor-aviso">${R(r.fixas.faltaReceber)}</b></div>` : ''}
      </div>
    </section>

    ${r.maiores.length ? `<section class="cartao sem-pad"><h3 style="padding:14px 14px 0">Maiores gastos do mês</h3>
      <ul class="lista" style="margin:0">${r.maiores.map((l) => `<li class="item" style="cursor:default">
        <div class="item-info"><div class="item-nome">${esc(l.descricao)}</div>
          <div class="item-sub">${formatarData(l.data)} · ${GRUPOS[l.grupo]}${l.categoria ? ` · ${esc(l.categoria)}` : ''}</div></div>
        <div class="item-valor cor-erro">${R(l.valor)}</div></li>`).join('')}</ul></section>` : ''}

    ${ant.temDados ? `<section class="cartao">
      <h3>Comparado com ${esc(nomeMes(antMes))}</h3>
      <div class="linhas-info">
        <div><span>Entrou</span><b>${R(r.entradas)} ${variacao(r.entradas, ant.entradas, true)}</b></div>
        <div><span>Saiu</span><b>${R(r.saidas)} ${variacao(r.saidas, ant.saidas, false)}</b></div>
        <div><span>Situação real</span><b>${r.resultado < 0 ? '−' : ''}${R(Math.abs(r.resultado))} ${variacao(r.resultado, ant.resultado, true)}</b></div>
      </div></section>` : ''}

    <button type="button" class="btn btn-bloco" data-compartilhar>📤 Mandar este resumo (WhatsApp, etc.)</button>`;

  el.querySelector('[data-compartilhar]').addEventListener('click', async () => {
    const texto = textoResumo(mes, r);
    if (navigator.share) {
      try { await navigator.share({ text: texto }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(texto); toast('✓ Resumo copiado. Cole no WhatsApp.'); return; } catch { /* sem clipboard */ }
    abrirFolha('Resumo', `<textarea rows="16" readonly>${esc(texto)}</textarea>`);
  });
}
