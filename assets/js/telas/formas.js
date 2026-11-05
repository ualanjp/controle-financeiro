import { esc } from '../util.js';
import { abrirFolha, confirmar, toast, mostrarErro } from '../ui.js';
import { salvarForma, excluirForma, formaEmUso } from '../servicos/cadastros.js';

export const titulo = 'Formas de pagamento';
export const pai = 'mais';
export const aba = 'mais';

export async function render(ctx) {
  const { el, dados } = ctx;
  const item = (f) => `<li class="item" data-id="${f.id}"><div class="item-info"><div class="item-nome">${esc(f.nome)}</div></div>
    <span style="color:var(--txt2)">›</span></li>`;
  const ativas = dados.formasPagamento.filter((f) => !f.arquivada);
  const arquivadas = dados.formasPagamento.filter((f) => f.arquivada);
  el.innerHTML = `
    <ul class="lista cartao sem-pad">${ativas.map(item).join('')}</ul>
    ${arquivadas.length ? `<div class="secao-titulo">Arquivadas</div><ul class="lista cartao sem-pad">${arquivadas.map(item).join('')}</ul>` : ''}
    <p class="dica">Arquivadas não aparecem ao cadastrar despesas, mas continuam no histórico.</p>
    <button type="button" class="fab" aria-label="Nova forma de pagamento">+</button>`;
  el.querySelector('.fab').addEventListener('click', () => abrirForm(ctx));
  el.querySelectorAll('.item').forEach((li) => li.addEventListener('click', () =>
    abrirForm(ctx, dados.formasPagamento.find((f) => f.id === Number(li.dataset.id)))));
}

function abrirForm(ctx, forma = null) {
  const { dados } = ctx;
  const fp = forma || { nome: '', arquivada: false };
  const emUso = forma ? formaEmUso(dados, forma.id) : false;
  const f = abrirFolha(forma ? 'Editar forma de pagamento' : 'Nova forma de pagamento', `<form class="form" novalidate>
    <label>Nome<input name="nome" value="${esc(fp.nome)}" required></label>
    <div class="acoes">
      ${forma ? `<button type="button" class="btn" data-arquivar>${fp.arquivada ? 'Desarquivar' : 'Arquivar'}</button>` : ''}
      <button type="submit" class="btn btn-pri">Salvar</button>
    </div>
    ${forma ? `<button type="button" class="btn btn-link btn-bloco" data-excluir style="color:var(--erro)">Excluir</button>
      ${emUso ? '<p class="dica" style="text-align:center">Possui histórico, use Arquivar.</p>' : ''}` : ''}
  </form>`);
  const form = f.corpo.querySelector('form');
  const fim = (msg) => { toast(msg); f.fechar(); ctx.atualizar(); };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await salvarForma(dados, { ...fp, nome: form.nome.value }); fim('✓ Salvo'); }
    catch (err) { mostrarErro(err.name === 'ConstraintError' ? 'Já existe uma forma com esse nome.' : err); }
  });
  form.querySelector('[data-arquivar]')?.addEventListener('click', async () => {
    try { await salvarForma(dados, { ...fp, arquivada: !fp.arquivada }); fim(fp.arquivada ? 'Reativada' : 'Arquivada'); } catch (err) { mostrarErro(err); }
  });
  form.querySelector('[data-excluir]')?.addEventListener('click', async () => {
    try {
      if (emUso) { await excluirForma(dados, forma.id); return; } // lança a mensagem
      if (!(await confirmar(`Excluir "${forma.nome}"?`, { ok: 'Excluir', perigo: true }))) return;
      await excluirForma(dados, forma.id);
      fim('Excluída');
    } catch (err) { mostrarErro(err); }
  });
}
