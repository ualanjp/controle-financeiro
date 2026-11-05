import { esc, formatarMoeda, formatarPct, parseValor, centavosParaTexto, nomeMes, addMes } from '../util.js';
import { toast, mostrarErro, escolher } from '../ui.js';
import { linhasOrcamento, salvarPlanejado, planejarCopiaOrcamento, copiarOrcamento } from '../servicos/orcamento.js';
import { bolinha, avisoCambio } from './comum.js';

export const titulo = 'Orçamento';
export const usaMes = true;

function rodape(l, fmt) {
  switch (l.nivel) {
    case 'sem': return l.comprometido ? 'Sem orçamento definido' : 'Sem orçamento';
    case 'estourado': return `Estourou ${fmt(-l.restante)}`;
    case 'limite': return 'No limite';
    default: return `Sobram ${fmt(l.restante)}`;
  }
}

export async function render(ctx) {
  const { el, dados, mes } = ctx;
  const base = dados.config.moedaBase;
  const fmt = (v) => formatarMoeda(v, base);
  const r = linhasOrcamento(dados, mes);
  const pctTotal = r.totalPlanejado ? (r.totalComprometido / r.totalPlanejado) * 100 : null;

  el.innerHTML = `
    ${avisoCambio(r.moedasPendentes)}
    <section class="cartao nivel-${r.nivelTotal}">
      <div class="totais" style="grid-template-columns:1fr 1fr">
        <div><span class="rotulo">Planejado</span><b>${fmt(r.totalPlanejado)}</b></div>
        <div style="text-align:right"><span class="rotulo">Comprometido</span><b>${fmt(r.totalComprometido)}</b></div>
      </div>
      <div class="barra-prog"><span style="width:${Math.min(100, pctTotal || 0)}%"></span></div>
      <div class="orc-rodape">${r.totalPlanejado ? `${formatarPct(pctTotal)} usado · ${rodape({ nivel: r.nivelTotal, restante: r.totalPlanejado - r.totalComprometido, comprometido: r.totalComprometido }, fmt)}` : 'Defina quanto planeja gastar em cada categoria.'}</div>
      <p class="dica" style="margin-bottom:0">Comprometido = pago + pendente, só despesas que saem do <b>Budget</b>. Valores em ${esc(base)}.</p>
    </section>
    <div class="botoes-linha"><button type="button" class="btn" data-copiar>📋 Copiar orçamento de ${esc(nomeMes(addMes(mes, -1)))}</button></div>
    ${r.linhas.map((l) => `
      <section class="cartao nivel-${l.nivel}">
        <div class="orc-topo">
          ${bolinha(l.categoria)}
          <span class="nome">${esc(l.categoria.nome)}${l.categoria.arquivada ? '<span class="tag">arquivada</span>' : ''}</span>
          <span class="orc-pct">${l.pct == null ? '' : formatarPct(l.pct)}</span>
        </div>
        <div class="orc-campos">
          <label>Planejado (${esc(base)})<input data-cat="${l.categoria.id}" inputmode="decimal" placeholder="0,00" value="${l.planejado ? centavosParaTexto(l.planejado) : ''}"></label>
          <div class="orc-comp">Comprometido<b>${fmt(l.comprometido)}</b>${l.pendente ? '<span class="aviso-pequeno">⚠ câmbio pendente</span>' : ''}</div>
        </div>
        <div class="barra-prog"><span style="width:${l.planejado ? Math.min(100, l.pct) : 0}%"></span></div>
        <div class="orc-rodape">${rodape(l, fmt)}</div>
      </section>`).join('')}`;

  el.querySelectorAll('input[data-cat]').forEach((inp) => {
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') inp.blur(); });
    inp.addEventListener('change', async () => {
      const txt = inp.value.trim();
      const v = txt ? parseValor(txt) : 0;
      if (v == null) { mostrarErro('Valor inválido'); return; }
      try {
        await salvarPlanejado(mes, Number(inp.dataset.cat), v);
        ctx.atualizar();
      } catch (e) { mostrarErro(e); }
    });
  });

  el.querySelector('[data-copiar]').addEventListener('click', async () => {
    try {
      const p = planejarCopiaOrcamento(dados, mes);
      if (!p.origem.length) { toast('O mês anterior não tem orçamento.'); return; }
      let sobrescrever = false;
      if (p.conflitos.length) {
        const r2 = await escolher('Copiar orçamento',
          [
            { valor: 'vazias', rotulo: 'Copiar só para as categorias vazias', desc: 'Mantém o que você já preencheu neste mês.' },
            { valor: 'tudo', rotulo: 'Substituir também as preenchidas', desc: `${p.conflitos.length} categoria(s) terão o valor trocado pelo do mês anterior.` },
          ],
          `${p.conflitos.length} categoria(s) já têm valor diferente neste mês.`);
        if (!r2) return;
        sobrescrever = r2 === 'tudo';
      }
      const n = await copiarOrcamento(dados, mes, sobrescrever);
      toast(n ? `✓ ${n} categoria(s) copiada(s)` : 'Nada a copiar: os valores já estão iguais.');
      ctx.atualizar();
    } catch (e) { mostrarErro(e); }
  });
}
