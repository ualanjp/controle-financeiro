import { esc, VERSAO_APP } from '../util.js';
import { confirmar, toast, mostrarErro } from '../ui.js';
import { salvarMoedas } from '../servicos/cadastros.js';

export const titulo = 'Configurações';
export const pai = 'mais';
export const aba = 'mais';

export async function render(ctx) {
  const { el, dados } = ctx;
  const c = dados.config;
  let persistente = null;
  try { persistente = navigator.storage?.persisted ? await navigator.storage.persisted() : null; } catch { /* sem suporte */ }

  el.innerHTML = `
    <form class="cartao form" novalidate>
      <h2>Moedas</h2>
      <p class="dica">Use códigos de 3 letras (ex.: BRL, USD, EUR). Orçamentos e saldos são mostrados na moeda-base.</p>
      <label>Moeda-base<input name="base" value="${esc(c.moedaBase)}" maxlength="3" autocapitalize="characters" style="text-transform:uppercase"></label>
      <div class="linha2">
        <label>Outra moeda 1<input name="m1" value="${esc(c.outrasMoedas[0] || '')}" maxlength="3" autocapitalize="characters" style="text-transform:uppercase"></label>
        <label>Outra moeda 2<input name="m2" value="${esc(c.outrasMoedas[1] || '')}" maxlength="3" autocapitalize="characters" style="text-transform:uppercase"></label>
      </div>
      <div class="acoes"><button type="submit" class="btn btn-pri">Salvar moedas</button></div>
    </form>
    <section class="cartao">
      <h2>Armazenamento</h2>
      <p class="dica" style="margin:0">${persistente === true
        ? '✓ O navegador marcou os dados deste app como persistentes (não serão apagados automaticamente).'
        : persistente === false
          ? '⚠ O navegador ainda não garantiu armazenamento persistente. Instalar o app na tela inicial costuma resolver. Faça backups regularmente.'
          : 'Este navegador não informa se o armazenamento é persistente. Faça backups regularmente.'}</p>
    </section>
    <p class="dica" style="text-align:center">Versão ${VERSAO_APP}</p>`;

  el.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const base = f.base.value.trim().toUpperCase();
    try {
      if (base !== c.moedaBase && dados.despesas.length) {
        const ok = await confirmar(`Trocar a moeda-base de ${c.moedaBase} para ${base}?\n\nAs taxas de câmbio e os orçamentos já cadastrados NÃO são convertidos: revise-os depois.`, { ok: 'Trocar' });
        if (!ok) return;
      }
      await salvarMoedas(dados, base, [f.m1.value, f.m2.value]);
      toast('✓ Moedas salvas');
      ctx.atualizar();
    } catch (err) { mostrarErro(err); }
  });
}
