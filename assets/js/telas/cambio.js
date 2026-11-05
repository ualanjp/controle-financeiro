import { esc, parseTaxa, taxaParaTexto, nomeMes, addMes } from '../util.js';
import { toast, mostrarErro, confirmar } from '../ui.js';
import { taxaDe, salvarTaxa, planejarCopiaTaxas, copiarTaxas } from '../servicos/cambio.js';

export const titulo = 'Câmbio';
export const usaMes = true;

export async function render(ctx) {
  const { el, dados, mes } = ctx;
  const base = dados.config.moedaBase;
  // Outras moedas configuradas + qualquer moeda usada neste mês
  const usadas = [
    ...dados.despesas.filter((d) => d.mes === mes).map((d) => d.moeda),
    ...dados.movimentacoes.filter((m) => m.data.startsWith(mes)).map((m) => m.moeda),
  ];
  const moedas = [...new Set([...dados.config.outrasMoedas, ...usadas])].filter((m) => m !== base);

  el.innerHTML = `
    <section class="cartao">
      <p class="dica" style="margin-top:0">Informe quanto <b>1 unidade</b> de cada moeda vale em <b>${esc(base)}</b> em ${esc(nomeMes(mes))} (até 6 casas decimais).
      Despesas nessas moedas são convertidas com a taxa do próprio mês.</p>
      ${moedas.map((m) => {
        const t = taxaDe(dados, mes, m);
        return `<div class="taxa-linha" style="margin-bottom:10px">
          <span class="moeda">1 ${esc(m)} =</span>
          <input data-moeda="${esc(m)}" inputmode="decimal" placeholder="ex.: 3,6725" value="${taxaParaTexto(t)}">
          <span class="base">${esc(base)}</span>
        </div>${t == null ? `<div class="aviso-pequeno" style="margin:-6px 0 10px">⚠ sem taxa neste mês${dados.config.outrasMoedas.includes(m) ? '' : ' (moeda usada em lançamentos)'}</div>` : ''}`;
      }).join('') || '<p class="dica">Nenhuma outra moeda configurada.</p>'}
    </section>
    <div class="botoes-linha"><button type="button" class="btn" data-copiar>📋 Copiar taxas de ${esc(nomeMes(addMes(mes, -1)))}</button></div>
    <p class="dica">Para trocar as moedas, vá em Mais → Configurações.</p>`;

  el.querySelectorAll('input[data-moeda]').forEach((inp) => {
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') inp.blur(); });
    inp.addEventListener('change', async () => {
      const txt = inp.value.trim();
      const v = txt ? parseTaxa(txt) : null;
      if (txt && v == null) { mostrarErro('Taxa inválida. Use números, ex.: 3,6725'); return; }
      try {
        await salvarTaxa(mes, inp.dataset.moeda, v);
        toast(v == null ? `Taxa de ${inp.dataset.moeda} removida` : `✓ 1 ${inp.dataset.moeda} = ${taxaParaTexto(v)} ${base}`);
        ctx.atualizar();
      } catch (e) { mostrarErro(e); }
    });
  });

  el.querySelector('[data-copiar]').addEventListener('click', async () => {
    try {
      const p = planejarCopiaTaxas(dados, mes);
      if (!p.origem.length) { toast('O mês anterior não tem taxas.'); return; }
      let sobrescrever = false;
      if (!p.faltantes.length) {
        sobrescrever = await confirmar('Todas as moedas já têm taxa neste mês. Substituir pelas do mês anterior?', { ok: 'Substituir' });
        if (!sobrescrever) return;
      }
      const n = await copiarTaxas(dados, mes, sobrescrever);
      toast(`✓ ${n} taxa(s) copiada(s)`);
      ctx.atualizar();
    } catch (e) { mostrarErro(e); }
  });
}
