import { esc } from '../util.js';
import { abrirFolha, confirmar, toast, mostrarErro } from '../ui.js';
import { salvarCategoria, excluirCategoria, categoriaEmUso } from '../servicos/cadastros.js';
import { bolinha } from './comum.js';

export const titulo = 'Categorias';
export const pai = 'mais';
export const aba = 'mais';

export async function render(ctx) {
  const { el, dados } = ctx;
  const item = (c) => `<li class="item" data-id="${c.id}">${bolinha(c)}
    <div class="item-info"><div class="item-nome">${esc(c.nome)}</div>
    ${c.id === dados.config.categoriaPoupancaId ? '<div class="item-sub">Categoria especial: alimenta o saldo Poupança e investimento</div>' : ''}</div>
    <span class="seta" style="color:var(--txt2)">›</span></li>`;
  const ativas = dados.categorias.filter((c) => !c.arquivada);
  const arquivadas = dados.categorias.filter((c) => c.arquivada);
  el.innerHTML = `
    <ul class="lista cartao sem-pad">${ativas.map(item).join('')}</ul>
    ${arquivadas.length ? `<div class="secao-titulo">Arquivadas</div><ul class="lista cartao sem-pad">${arquivadas.map(item).join('')}</ul>` : ''}
    <p class="dica">Arquivadas não aparecem ao cadastrar despesas, mas continuam no histórico.</p>
    <button type="button" class="fab" aria-label="Nova categoria">+</button>`;
  el.querySelector('.fab').addEventListener('click', () => abrirForm(ctx));
  el.querySelectorAll('.item').forEach((li) => li.addEventListener('click', () =>
    abrirForm(ctx, dados.categorias.find((c) => c.id === Number(li.dataset.id)))));
}

function abrirForm(ctx, cat = null) {
  const { dados } = ctx;
  const c = cat || { nome: '', cor: '#2563eb', icone: '', arquivada: false };
  const emUso = cat ? categoriaEmUso(dados, cat.id) : false;
  const f = abrirFolha(cat ? 'Editar categoria' : 'Nova categoria', `<form class="form" novalidate>
    <label>Nome<input name="nome" value="${esc(c.nome)}" required></label>
    <div class="linha2">
      <label>Cor<input type="color" name="cor" value="${esc(c.cor)}"></label>
      <label>Ícone (emoji)<input name="icone" value="${esc(c.icone || '')}" placeholder="ex.: 🛒" maxlength="8"></label>
    </div>
    <div class="acoes">
      ${cat ? `<button type="button" class="btn" data-arquivar>${c.arquivada ? 'Desarquivar' : 'Arquivar'}</button>` : ''}
      <button type="submit" class="btn btn-pri">Salvar</button>
    </div>
    ${cat ? `<button type="button" class="btn btn-link btn-bloco" data-excluir style="color:var(--erro)">Excluir categoria</button>
      ${emUso ? '<p class="dica" style="text-align:center">Possui histórico, use Arquivar.</p>' : ''}` : ''}
  </form>`);
  const form = f.corpo.querySelector('form');
  const fim = (msg) => { toast(msg); f.fechar(); ctx.atualizar(); };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await salvarCategoria(dados, { ...c, nome: form.nome.value, cor: form.cor.value, icone: form.icone.value });
      fim('✓ Categoria salva');
    } catch (err) { mostrarErro(err.name === 'ConstraintError' ? 'Já existe uma categoria com esse nome.' : err); }
  });
  form.querySelector('[data-arquivar]')?.addEventListener('click', async () => {
    try { await salvarCategoria(dados, { ...c, arquivada: !c.arquivada }); fim(c.arquivada ? 'Categoria reativada' : 'Categoria arquivada'); } catch (err) { mostrarErro(err); }
  });
  form.querySelector('[data-excluir]')?.addEventListener('click', async () => {
    try {
      if (emUso || cat.id === dados.config.categoriaPoupancaId) { await excluirCategoria(dados, cat.id); return; } // lança a mensagem
      if (!(await confirmar(`Excluir a categoria "${cat.nome}"?`, { ok: 'Excluir', perigo: true }))) return;
      await excluirCategoria(dados, cat.id);
      fim('Categoria excluída');
    } catch (err) { mostrarErro(err); }
  });
}
