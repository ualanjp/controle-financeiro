// Contas fixas (receitas e despesas que se repetem todo mês), com status do mês.
import { esc, formatarMoeda, centavosParaTexto, parseValor, nomeMes, addMes, dataNoMes, difDias, p2 } from '../util.js';
import { abrirFolha, confirmar, escolher, toast, mostrarErro } from '../ui.js';
import { fixosDoMes, resumoMes, salvarFixo, excluirFixo, marcarFixo, valorFixoNoMes, GRUPOS } from '../servicos/rapido.js';

export const titulo = 'Contas fixas';
export const usaMes = true;

const R = (v) => formatarMoeda(v, 'BRL');

function prazo(f, mes, mesAtual, hoje) {
  if (f.ok) return '';
  if (mes < mesAtual) return ' · <span class="cor-erro">não marcada</span>';
  if (mes > mesAtual) return '';
  const d = difDias(hoje, dataNoMes(mes, f.dia));
  if (d < 0) return ` · <span class="cor-erro">${f.tipo === 'despesa' ? 'atrasada' : 'atrasado'} ${-d} dia(s)</span>`;
  if (d === 0) return ' · <span class="cor-aviso">vence hoje</span>';
  if (d <= 5) return ` · <span class="cor-aviso">vence em ${d} dia(s)</span>`;
  return '';
}

export async function render(ctx) {
  const { el, dados, mes, mesAtual, hoje } = ctx;
  const lista = fixosDoMes(dados, mes);
  const desp = lista.filter((f) => f.tipo === 'despesa');
  const rec = lista.filter((f) => f.tipo === 'receita');
  const r = resumoMes(dados, mes);

  const item = (f) => {
    const receita = f.tipo === 'receita';
    return `<li class="item" data-id="${f.id}">
      <div class="item-info"><div class="item-nome">${esc(f.descricao)}</div>
        <div class="item-sub">dia ${p2(f.dia)} · <span class="tag tag-${f.grupo}" style="margin:0">${GRUPOS[f.grupo]}</span>${f.ajustado ? ' · valor deste mês' : ''}${prazo(f, mes, mesAtual, hoje)}</div></div>
      <div class="item-dir"><div class="item-valor">${R(f.valorMes)}</div>
        <button type="button" class="selo ${f.ok ? 'selo-paga' : 'selo-pendente'}" data-ok>${f.ok ? `✓ ${receita ? 'Recebido' : 'Pago'}` : receita ? 'A receber' : 'A pagar'}</button></div></li>`;
  };

  el.innerHTML = lista.length ? `
    <div class="kpis">
      <div class="kpi"><small>Receitas fixas</small><b class="cor-ok">${R(r.receitasFixas)}</b><small>${r.fixas.recebidas} de ${r.fixas.receitas} recebidas</small></div>
      <div class="kpi"><small>Despesas fixas</small><b class="cor-erro">${R(r.despesasFixas)}</b><small>${r.fixas.pagas} de ${r.fixas.despesas} pagas</small></div>
      <div class="kpi"><small>Fixas da oficina</small><b>${R(r.fixas.oficina)}</b></div>
      <div class="kpi"><small>Fixas pessoais (casa)</small><b>${R(r.fixas.pessoal)}</b></div>
      ${r.fixas.consorcios ? `<div class="kpi largo"><small>Consórcios</small><b>${R(r.fixas.consorcios)}</b></div>` : ''}
    </div>
    <p class="dica">Toque em <b>A pagar</b> para marcar como pago. Toque na conta para mudar o valor ou encerrar.</p>
    ${desp.length ? `<div class="secao-titulo">Despesas fixas (${desp.length})</div><ul class="lista cartao sem-pad">${desp.map(item).join('')}</ul>` : ''}
    ${rec.length ? `<div class="secao-titulo">Receitas fixas (${rec.length})</div><ul class="lista cartao sem-pad">${rec.map(item).join('')}</ul>` : ''}
    <button type="button" class="fab" aria-label="Nova conta fixa">+</button>`
    : `<div class="vazio">Nenhuma conta fixa em ${esc(nomeMes(mes))}.<br><br>
      Contas fixas são as que se repetem todo mês: aluguel, luz, consórcio, aluguéis que você recebe…
      Cadastre uma vez e elas aparecem sozinhas nos próximos meses.<br><br>
      <button type="button" class="btn btn-pri" data-novo>+ Cadastrar conta fixa</button></div>`;

  el.querySelector('.fab, [data-novo]').addEventListener('click', () => formulario(ctx));
  el.querySelectorAll('.lista').forEach((ul) => ul.addEventListener('click', async (e) => {
    const li = e.target.closest('[data-id]');
    if (!li) return;
    const f = lista.find((x) => x.id === Number(li.dataset.id));
    if (e.target.closest('[data-ok]')) {
      try { await marcarFixo(f.id, mes, !f.ok); ctx.atualizar(); } catch (err) { mostrarErro(err); }
      return;
    }
    formulario(ctx, f);
  }));
}

function formulario(ctx, f = null) {
  const { mes } = ctx;
  const x = f || { tipo: 'despesa', descricao: '', valor: null, dia: 10, grupo: 'oficina' };
  const fl = abrirFolha(f ? 'Editar conta fixa' : 'Nova conta fixa', `<form class="form" novalidate>
    <div class="segmentado">
      <label><input type="radio" name="tipo" value="despesa" ${x.tipo === 'despesa' ? 'checked' : ''}><span>🟥 Despesa (pago)</span></label>
      <label><input type="radio" name="tipo" value="receita" ${x.tipo === 'receita' ? 'checked' : ''}><span>🟢 Receita (recebo)</span></label>
    </div>
    <label>Descrição<input name="descricao" value="${esc(x.descricao)}" placeholder="ex.: Aluguel terreno oficina"></label>
    <div class="linha2">
      <label>Valor normal<input name="valor" inputmode="decimal" placeholder="0,00" value="${centavosParaTexto(x.valor)}"></label>
      <label>Dia do vencimento<input name="dia" inputmode="numeric" value="${x.dia}"></label>
    </div>
    <div class="segmentado">
      <label><input type="radio" name="grupo" value="oficina" ${x.grupo === 'oficina' ? 'checked' : ''}><span>🔧 Oficina</span></label>
      <label><input type="radio" name="grupo" value="pessoal" ${x.grupo === 'pessoal' ? 'checked' : ''}><span>🙋 Pessoal (casa)</span></label>
    </div>
    ${f ? `<p class="dica">Se mudar o valor normal, ele vale de ${esc(nomeMes(mes))} em diante (os meses anteriores não mudam).</p>
      <label>Valor diferente só em ${esc(nomeMes(mes))} (opcional)<input name="valorMes" inputmode="decimal" placeholder="usa o valor normal"
        value="${f.ajustado ? centavosParaTexto(f.valorMes) : ''}"></label>`
    : `<label>Começa em<input type="month" name="inicio" value="${mes}"></label>`}
    <div class="acoes">
      ${f ? '<button type="button" class="btn" data-encerrar>Encerrar</button><button type="button" class="btn" data-excluir style="color:var(--erro)">Excluir</button>' : ''}
      <button type="submit" class="btn btn-pri">Salvar</button>
    </div></form>`);
  const form = fl.corpo.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      const { valorMes: _v, ok: _o, ajustado: _a, ...base } = f || {};
      const rec = {
        ...base, tipo: fd.get('tipo'), descricao: fd.get('descricao'), valor: parseValor(fd.get('valor')),
        dia: Number(fd.get('dia')), grupo: fd.get('grupo'), inicio: f ? f.inicio : fd.get('inicio'), fim: f ? f.fim : null,
      };
      const id = await salvarFixo(rec, mes);
      if (f) {
        const txt = String(fd.get('valorMes') || '').trim();
        const vm = txt ? parseValor(txt) : null;
        if (txt && !vm) throw new Error('Valor deste mês inválido.');
        if (vm !== (f.ajustado ? f.valorMes : null)) await valorFixoNoMes(id, mes, vm);
      }
      toast('✓ Conta fixa salva');
      fl.fechar();
      ctx.atualizar();
    } catch (err) { mostrarErro(err); }
  });
  form.querySelector('[data-encerrar]')?.addEventListener('click', async () => {
    const prox = addMes(mes, 1);
    const fim = await escolher('Encerrar conta fixa', [
      { valor: mes, rotulo: `Depois de ${nomeMes(mes)}`, desc: `Ainda conta em ${nomeMes(mes)} e some a partir de ${nomeMes(prox)}.` },
      { valor: addMes(mes, -1), rotulo: `Já em ${nomeMes(mes)}`, desc: `Some de ${nomeMes(mes)} em diante.` },
    ], `"${f.descricao}" — os meses anteriores continuam com ela.`);
    if (!fim) return;
    try {
      const { valorMes: _v, ok: _o, ajustado: _a, ...base } = f;
      if (fim < f.inicio) await excluirFixo(f.id);
      else await salvarFixo({ ...base, fim });
      toast('Conta fixa encerrada');
      fl.fechar();
      ctx.atualizar();
    } catch (err) { mostrarErro(err); }
  });
  form.querySelector('[data-excluir]')?.addEventListener('click', async () => {
    const ok = await confirmar(`Excluir "${f.descricao}" de TODOS os meses, inclusive os passados?\n\nSe ela só parou de existir agora, use "Encerrar".`, { ok: 'Excluir', perigo: true });
    if (!ok) return;
    try { await excluirFixo(f.id); toast('Conta fixa excluída'); fl.fechar(); ctx.atualizar(); } catch (err) { mostrarErro(err); }
  });
}
