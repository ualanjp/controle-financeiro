import { esc, formatarMoeda, formatarData, parseValor, centavosParaTexto, nomeMes, nomeMesCurto } from '../util.js';
import { abrirFolha, confirmar, escolher, toast, mostrarErro } from '../ui.js';
import * as D from '../servicos/despesas.js';
import { valorNaBase, moedasSemTaxa } from '../servicos/cambio.js';
import {
  ROTULO_STATUS, bolinha, avisoCambio, nomeFonte, mapa, opcoesCategorias, opcoesFormas,
  opcoesFontes, opcoesMoedas, filtrosHtml, ligarFiltros,
} from './comum.js';

export const titulo = 'Despesas';
export const usaMes = true;

const filtros = { categoriaId: '', formaPagamentoId: '', status: '', moeda: '', fonteSaldo: '' };
let abrirDepois = null; // id de despesa a abrir (vindo de um link)

export async function render(ctx) {
  const { el, dados, mes } = ctx;

  // Link "#/despesas/123" (ex.: vindo de Saldos → Movimentações)
  if (ctx.params[0]) {
    const id = Number(ctx.params[0]);
    history.replaceState(null, '', '#/despesas');
    const alvo = dados.despesas.find((x) => x.id === id);
    if (alvo) {
      abrirDepois = id;
      if (alvo.mes !== mes) { ctx.definirMes(alvo.mes); return; }
    }
  }

  const base = dados.config.moedaBase;
  const cats = mapa(dados.categorias);
  const doMes = dados.despesas.filter((d) => d.mes === mes);
  const lista = D.ordenarDespesas(D.filtrarDespesas(doMes, filtros));
  const tot = D.totaisPorStatus(dados, lista);
  const temFiltro = Object.values(filtros).some(Boolean);

  const item = (d) => {
    const cat = cats.get(d.categoriaId);
    const conv = d.moeda !== base ? valorNaBase(dados, d) : null;
    const sub = [
      cat ? esc(cat.nome) : '—',
      d.dataVencimento ? `vence ${formatarData(d.dataVencimento).slice(0, 5)}` : '',
      d.fonteSaldo !== D.FONTE_BUDGET ? `💰 ${esc(nomeFonte(dados, d.fonteSaldo))}` : '',
    ].filter(Boolean).join(' · ');
    return `<li class="item" data-id="${d.id}">
      ${bolinha(cat)}
      <div class="item-info">
        <div class="item-nome">${esc(D.nomeExibicao(d))}${d.tipo === 'fixa' ? ' <span title="Fixa mensal">🔁</span>' : ''}</div>
        <div class="item-sub">${sub}</div>
      </div>
      <div class="item-dir">
        <div class="item-valor">${formatarMoeda(d.valor, d.moeda)}</div>
        ${d.moeda !== base ? `<div class="item-conv">${conv == null ? '⚠ sem câmbio' : '≈ ' + formatarMoeda(conv, base)}</div>` : ''}
        <button type="button" class="selo selo-${d.status}" data-status title="Tocar para ${d.status === 'paga' ? 'desfazer pagamento' : 'marcar como paga'}">${ROTULO_STATUS[d.status]}</button>
      </div>
    </li>`;
  };

  el.innerHTML = `
    ${avisoCambio(moedasSemTaxa(dados, lista))}
    <section class="cartao totais">
      <div><span class="rotulo">Pago</span><b class="cor-ok">${formatarMoeda(tot.paga.valor, base)}</b></div>
      <div><span class="rotulo">Pendente</span><b class="cor-aviso">${formatarMoeda(tot.pendente.valor, base)}</b></div>
      <div><span class="rotulo">Previsto</span><b class="cor-sec">${formatarMoeda(tot.prevista.valor, base)}</b></div>
    </section>
    ${filtrosHtml(dados, filtros, ['categoriaId', 'formaPagamentoId', 'status', 'moeda', 'fonteSaldo'])}
    ${lista.length
      ? `<ul class="lista cartao sem-pad">${lista.map(item).join('')}</ul>`
      : `<div class="vazio">Nenhuma despesa ${temFiltro ? 'com esses filtros ' : ''}em ${nomeMes(mes)}.<br>Toque em <b>+</b> para cadastrar.</div>`}
    <button type="button" class="fab" aria-label="Nova despesa">+</button>`;

  ligarFiltros(el, filtros, ctx.atualizar);
  el.querySelector('.fab').addEventListener('click', () => abrirFormDespesa(ctx));
  el.querySelector('.lista')?.addEventListener('click', async (e) => {
    const li = e.target.closest('.item');
    if (!li) return;
    const d = dados.despesas.find((x) => x.id === Number(li.dataset.id));
    if (e.target.closest('[data-status]')) {
      try {
        const n = await D.alternarPaga(d, ctx.hoje, ctx.mesAtual);
        toast(n.status === 'paga' ? `✓ ${d.nome} marcada como paga` : `${d.nome}: pagamento desfeito`);
        ctx.atualizar();
      } catch (err) { mostrarErro(err); }
      return;
    }
    abrirFormDespesa(ctx, d);
  });

  if (abrirDepois) {
    const d = dados.despesas.find((x) => x.id === abrirDepois);
    abrirDepois = null;
    if (d) abrirFormDespesa(ctx, d);
  }
}

const TIPOS = { unica: 'Única', parcelada: 'Parcelada', fixa: 'Fixa mensal' };

export function abrirFormDespesa(ctx, despesa = null) {
  const { dados, mes } = ctx;
  const novo = !despesa;
  const serie = despesa?.serieId ? dados.series.find((s) => s.id === despesa.serieId) : null;
  const d = despesa || {
    nome: '', valor: null, moeda: dados.config.moedaBase, mes,
    categoriaId: dados.categorias.find((c) => !c.arquivada)?.id,
    formaPagamentoId: dados.formasPagamento.find((f) => !f.arquivada)?.id,
    fonteSaldo: D.FONTE_BUDGET, status: 'pendente', tipo: 'unica',
  };

  let infoSerie = '';
  if (serie?.tipo === 'parcelada') infoSerie = `Parcela ${despesa.numeroParcela}/${despesa.totalParcelas} de uma compra parcelada (total ${formatarMoeda(serie.valorTotal, serie.moeda)}).`;
  if (serie?.tipo === 'fixa') infoSerie = `Despesa fixa mensal desde ${nomeMesCurto(serie.mesInicio)}${serie.mesEncerramento ? `, encerrada após ${nomeMesCurto(serie.mesEncerramento)}` : ''}.`;
  if (despesa?.editadaIndividualmente) infoSerie += ' Esta ocorrência foi editada individualmente.';

  const html = `<form class="form" novalidate>
    ${novo
      ? `<div class="segmentado">${Object.entries(TIPOS).map(([v, r]) =>
        `<label><input type="radio" name="tipo" value="${v}" ${v === 'unica' ? 'checked' : ''}><span>${r}</span></label>`).join('')}</div>`
      : `<p class="dica">${TIPOS[d.tipo]}${infoSerie ? ' · ' + esc(infoSerie) : ''}</p>`}
    <label>Nome<input name="nome" required autocomplete="off" value="${esc(d.nome)}"></label>
    <div class="linha2">
      <label><span data-rot-valor>Valor</span><input name="valor" inputmode="decimal" placeholder="0,00" value="${centavosParaTexto(d.valor)}"></label>
      <label>Moeda<select name="moeda">${opcoesMoedas(dados, d.moeda)}</select></label>
    </div>
    <label data-so-parcelada hidden>Número de parcelas<input name="numeroParcelas" type="number" min="2" max="360" inputmode="numeric" value="2"></label>
    <label><span data-rot-mes>Mês</span><input name="mes" type="month" value="${d.mes}" ${serie ? 'disabled' : ''}></label>
    <label>Categoria<select name="categoriaId">${opcoesCategorias(dados, d.categoriaId)}</select></label>
    <label>Forma de pagamento<select name="formaPagamentoId">${opcoesFormas(dados, d.formaPagamentoId)}</select></label>
    <label>Sai de qual saldo?<select name="fonteSaldo">${opcoesFontes(dados, d.fonteSaldo)}</select></label>
    <label data-so-status>Status<select name="status">
      ${(novo ? ['pendente', 'paga'] : ['prevista', 'pendente', 'paga']).map((s) =>
        `<option value="${s}" ${s === d.status ? 'selected' : ''}>${ROTULO_STATUS[s]}</option>`).join('')}
    </select></label>
    <label data-so-pagamento>Data de pagamento<input name="dataPagamento" type="date" value="${d.dataPagamento || ctx.hoje}"></label>
    <label><span data-rot-venc>Vencimento (opcional)</span><input name="dataVencimento" type="date" value="${d.dataVencimento || ''}"></label>
    <label>Observações (opcional)<textarea name="observacoes" rows="2">${esc(d.observacoes || '')}</textarea></label>
    <p class="dica" data-dica></p>
    <div class="acoes">
      ${novo ? '' : '<button type="button" class="btn" data-excluir style="color:var(--erro)">Excluir</button>'}
      <button type="submit" class="btn btn-pri">Salvar</button>
    </div>
    ${serie?.tipo === 'fixa' ? `<button type="button" class="btn btn-link btn-bloco" data-encerrar>Encerrar série a partir de ${esc(nomeMes(mes))}</button>` : ''}
  </form>`;

  const folha = abrirFolha(novo ? 'Nova despesa' : 'Editar despesa', html);
  const form = folha.corpo.querySelector('form');
  const tipoAtual = () => (novo ? form.querySelector('[name=tipo]:checked').value : d.tipo);
  const q = (s) => form.querySelector(s);

  function atualizarCampos() {
    const t = tipoAtual();
    const ehNovaSerie = novo && t !== 'unica';
    q('[data-so-parcelada]').hidden = !(novo && t === 'parcelada');
    q('[data-so-status]').hidden = ehNovaSerie;
    q('[data-so-pagamento]').hidden = ehNovaSerie || q('[name=status]').value !== 'paga';
    q('[data-rot-valor]').textContent = novo
      ? { unica: 'Valor', parcelada: 'Valor total da compra', fixa: 'Valor mensal' }[t]
      : { unica: 'Valor', parcelada: 'Valor desta parcela', fixa: 'Valor deste mês' }[t];
    q('[data-rot-mes]').textContent = novo ? { unica: 'Mês', parcelada: 'Mês da 1ª parcela', fixa: 'Mês de início' }[t] : 'Mês';
    q('[data-rot-venc]').textContent = ehNovaSerie ? 'Vencimento da 1ª (opcional — repete o dia nos outros meses)' : 'Vencimento (opcional)';
    let dica = '';
    if (novo && t === 'parcelada') {
      const total = parseValor(q('[name=valor]').value);
      const n = Number(q('[name=numeroParcelas]').value);
      if (total && n >= 2 && total >= n) {
        const p = D.dividirParcelas(total, n);
        const m = q('[name=moeda]').value;
        dica = `${n}× de ${formatarMoeda(p[0], m)}${p[n - 1] !== p[0] ? ` (última: ${formatarMoeda(p[n - 1], m)})` : ''}. Todas as parcelas são criadas agora.`;
      }
    }
    if (novo && t === 'fixa') dica = 'A despesa aparece automaticamente em todo mês, a partir do mês de início, até você encerrar a série.';
    q('[data-dica]').textContent = dica;
  }
  form.addEventListener('input', atualizarCampos);
  form.addEventListener('change', atualizarCampos);
  atualizarCampos();

  const ler = () => {
    const fd = new FormData(form);
    const valor = parseValor(fd.get('valor'));
    return {
      tipo: tipoAtual(),
      nome: fd.get('nome'),
      valor,
      moeda: fd.get('moeda'),
      numeroParcelas: Number(fd.get('numeroParcelas')),
      mes: fd.get('mes') || d.mes,
      categoriaId: Number(fd.get('categoriaId')),
      formaPagamentoId: Number(fd.get('formaPagamentoId')),
      fonteSaldo: fd.get('fonteSaldo'),
      status: fd.get('status'),
      dataPagamento: fd.get('dataPagamento') || null,
      dataVencimento: fd.get('dataVencimento') || null,
      observacoes: fd.get('observacoes'),
    };
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const f = ler();
      if (novo) {
        await D.criarDespesa(f, ctx.mesAtual, ctx.hoje);
        toast(f.tipo === 'parcelada' ? `✓ ${f.numeroParcelas} parcelas criadas` : '✓ Despesa salva');
      } else {
        let escopo = 'esta';
        if (despesa.serieId) {
          D.planejarEdicao(dados, despesa, f, 'esta', ctx.hoje); // valida antes de perguntar
          escopo = await escolher('Aplicar a alteração a…', [
            { valor: 'esta', rotulo: 'Somente esta', desc: 'Só esta ocorrência muda.' },
            { valor: 'proximas', rotulo: 'Esta e as próximas', desc: 'Muda o molde da série e as ocorrências a partir deste mês que não estão pagas nem foram editadas individualmente.' },
          ]);
          if (!escopo) return;
        }
        await D.salvarEdicao(dados, despesa, f, escopo, ctx.hoje);
        toast('✓ Alterações salvas');
      }
      folha.fechar();
      ctx.atualizar();
    } catch (err) { mostrarErro(err); }
  });

  q('[data-excluir]')?.addEventListener('click', async () => {
    try {
      let escopo = 'esta';
      if (serie?.tipo === 'fixa') {
        escopo = await escolher('Excluir…', [
          { valor: 'esta', rotulo: 'Somente esta', desc: 'Só a ocorrência deste mês. A série continua nos outros meses.' },
          { valor: 'proximas', rotulo: 'Esta e as próximas', desc: 'Apaga as ocorrências a partir deste mês (não pagas e não editadas) e encerra a série.' },
        ]);
      } else if (serie?.tipo === 'parcelada') {
        escopo = await escolher('Excluir…', [
          { valor: 'esta', rotulo: 'Somente esta parcela' },
          { valor: 'todas', rotulo: 'Todas as parcelas da compra', desc: `Apaga as ${despesa.totalParcelas} parcelas, inclusive as pagas.` },
        ]);
      } else if (!(await confirmar(`Excluir "${despesa.nome}"?`, { ok: 'Excluir', perigo: true }))) {
        escopo = null;
      }
      if (!escopo) return;
      await D.executarExclusao(dados, despesa, escopo);
      toast('Despesa excluída');
      folha.fechar();
      ctx.atualizar();
    } catch (err) { mostrarErro(err); }
  });

  q('[data-encerrar]')?.addEventListener('click', async () => {
    const ok = await confirmar(`A série "${serie.nome}" deixa de gerar despesas a partir de ${nomeMes(mes)}. O que já existe não é apagado.`, { ok: 'Encerrar série' });
    if (!ok) return;
    try {
      await D.encerrarSerie(serie, mes);
      toast('Série encerrada');
      folha.fechar();
      ctx.atualizar();
    } catch (err) { mostrarErro(err); }
  });
}
