import { esc, formatarData, VERSAO_APP } from '../util.js';

export const titulo = 'Mais';

const menu = (itens) => `<nav class="cartao sem-pad menu">
  ${itens.map(([r, ic, t, s]) => `<a href="#/${r}"><span class="ic">${ic}</span>
    <span class="txt">${esc(t)}<small>${esc(s)}</small></span><span class="seta">›</span></a>`).join('')}
</nav>`;

export async function render(ctx) {
  const { el, dados } = ctx;
  const ativos = (l, campo = 'arquivada') => l.filter((x) => !x[campo]).length;
  el.innerHTML = `
    ${menu([
      ['backup', '💾', 'Backup', dados.config.ultimoBackup ? `Último: ${formatarData(dados.config.ultimoBackup)}` : 'Nenhum backup ainda'],
      ['configuracoes', '⚙️', 'Configurações', `Moeda ${dados.config.moedaBase}`],
    ])}
    <div class="secao-titulo">Modo completo (detalhado)</div>
    <p class="dica" style="margin:0 4px 8px">Telas mais detalhadas, com orçamento por categoria, parcelas e câmbio. São separadas do lançamento rápido: use se quiser.</p>
    ${menu([
      ['inicio', '📊', 'Painel', 'Gráficos das despesas detalhadas'],
      ['despesas', '💳', 'Despesas detalhadas', 'Única, parcelada ou fixa, com categoria e forma de pagamento'],
      ['orcamento', '🎯', 'Orçamento', 'Quanto planeja gastar por categoria'],
      ['saldos', '💰', 'Saldos', 'Budget, Savings, Poupança e seus potes'],
      ['cambio', '💱', 'Câmbio', 'Taxas de outras moedas'],
      ['categorias', '🏷️', 'Categorias', `${ativos(dados.categorias)} ativas`],
      ['formas', '💳', 'Formas de pagamento', `${ativos(dados.formasPagamento)} ativas`],
    ])}
    <p class="dica" style="text-align:center">Controle Financeiro v${VERSAO_APP} · seus dados ficam só neste aparelho.</p>`;
}
