import { esc, formatarData, VERSAO_APP } from '../util.js';

export const titulo = 'Mais';

export async function render(ctx) {
  const { el, dados } = ctx;
  const ativos = (l, campo = 'arquivada') => l.filter((x) => !x[campo]).length;
  const itens = [
    ['saldos', '💰', 'Saldos', 'Budget, Savings, Poupança e seus potes'],
    ['categorias', '🏷️', 'Categorias', `${ativos(dados.categorias)} ativas`],
    ['formas', '💳', 'Formas de pagamento', `${ativos(dados.formasPagamento)} ativas`],
    ['configuracoes', '⚙️', 'Configurações', `Moeda-base ${dados.config.moedaBase}`],
    ['backup', '💾', 'Backup', dados.config.ultimoBackup ? `Último: ${formatarData(dados.config.ultimoBackup)}` : 'Nenhum backup ainda'],
  ];
  el.innerHTML = `
    <nav class="cartao sem-pad menu">
      ${itens.map(([r, ic, t, s]) => `<a href="#/${r}"><span class="ic">${ic}</span>
        <span class="txt">${esc(t)}<small>${esc(s)}</small></span><span class="seta">›</span></a>`).join('')}
    </nav>
    <p class="dica" style="text-align:center">Controle Financeiro v${VERSAO_APP} · seus dados ficam só neste aparelho.</p>`;
}
