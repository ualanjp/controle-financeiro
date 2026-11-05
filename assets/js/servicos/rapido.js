// Modo simples: lançamento rápido em texto ("saiu 30,00 almoço"), contas fixas,
// resumo do mês (como a planilha) e histórico mês a mês. Valores em centavos.
import { tx, salvar, salvarVarios, excluir, obter } from '../db.js';
import { parseValor, ehData, ehMes, addMes, listaMeses, p2 } from '../util.js';

export const GRUPOS = { oficina: 'Oficina', pessoal: 'Pessoal' };
export const CATEGORIAS_RAPIDAS = [
  { nome: 'Alimentação', icone: '🍽️', cor: '#1baf7a' },
  { nome: 'Transporte', icone: '🚗', cor: '#eda100' },
  { nome: 'Casa', icone: '🏠', cor: '#2a78d6' },
  { nome: 'Saúde', icone: '🩺', cor: '#008300' },
  { nome: 'PC', icone: '💻', cor: '#4a3aa7' },
  { nome: 'Oficina', icone: '🔧', cor: '#eb6834' },
  { nome: 'Diária', icone: '🧾', cor: '#8b93a3' },
];
export const CLASSES = {
  necessidade: { nome: 'Necessidade', cor: '#2563eb' },
  desejo: { nome: 'Desejo', cor: '#e87ba4' },
  juros: { nome: 'Juros', cor: '#dc2626' },
  investimento: { nome: 'Investimento', cor: '#059669' },
};
export const infoCategoria = (nome) => CATEGORIAS_RAPIDAS.find((c) => c.nome === nome) || CATEGORIAS_RAPIDAS[CATEGORIAS_RAPIDAS.length - 1];

export const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();
const palavras = (s) => new Set(s.split(' '));
const tokens = (s) => normalizar(s).split(/[^a-z0-9]+/).filter(Boolean);

// ---------- Sugestão automática de grupo / categoria / classificação ----------
const REGRAS = [
  { categoria: 'Oficina', grupo: 'oficina', p: palavras('fornecedor fornecedores rdm sucata peca pecas mola molas grampo grampos pino pinos bucha buchas parafuso parafusos solda ferramenta ferramentas') },
  { categoria: 'Alimentação', p: palavras('almoco almoca almocei janta jantar jantei jantw cafe lanche lanches mercado padaria restaurante comida marmita marmitex pizza ifood sorvete acai refrigerante cerveja churrasco acougue hamburguer salgado pastel doce chocolate') },
  { categoria: 'Transporte', p: palavras('uber onibus gasolina combustivel etanol diesel pedagio estacionamento taxi 99 passagem') },
  { categoria: 'Saúde', p: palavras('farmacia remedio remedios medico dentista consulta exame exames hospital') },
  { categoria: 'Casa', p: palavras('limpeza faxina netflix spotify internet luz energia agua gas aluguel condominio inseticida') },
  { categoria: 'PC', p: palavras('pc jogo jogos game games steam playstation xbox') },
];
const DESEJO = palavras('sorvete acai lanche lanches pizza ifood cerveja doce chocolate hamburguer netflix spotify assinatura jogo jogos game games steam');
const JUROS = palavras('juros fatura imposto impostos multa emprestimo tarifa ipva iptu');
const CLASSE_PADRAO = {
  'Alimentação': 'necessidade', Transporte: 'necessidade', 'Saúde': 'necessidade', Casa: 'necessidade',
  PC: 'desejo', Oficina: 'investimento', 'Diária': 'desejo',
};

export const chaveAprendizado = (descricao) => normalizar(descricao);
export const mapaAprendizado = (dados) => Object.fromEntries((dados.aprendizado || []).map((a) => [a.chave, a]));

/** Sugere grupo, categoria e classificação a partir da descrição (e do que o app já aprendeu). */
export function sugerir(descricao, tipo, aprendizado = {}, grupoExplicito = null) {
  const t = tokens(descricao);
  const tem = (set) => t.some((x) => set.has(x));
  let grupo = tipo === 'entrada' ? 'oficina' : 'pessoal';
  let categoria = null;
  let classe = null;
  if (tipo === 'saida') {
    const r = REGRAS.find((x) => tem(x.p));
    categoria = r ? r.categoria : 'Diária';
    if (r?.grupo) grupo = r.grupo;
    classe = tem(JUROS) ? 'juros' : tem(DESEJO) ? 'desejo' : CLASSE_PADRAO[categoria];
  }
  const a = aprendizado[chaveAprendizado(descricao)];
  if (a) {
    if (a.grupo) grupo = a.grupo;
    if (tipo === 'saida') { categoria = a.categoria || categoria; classe = a.classe || classe; }
  }
  if (grupoExplicito) {
    grupo = grupoExplicito;
    if (tipo === 'saida') ({ categoria, classe } = ajustarAoGrupo(grupo, categoria, classe));
  }
  return { grupo, categoria, classe };
}

/** Ao trocar o grupo de uma saída, a categoria genérica acompanha. */
export function ajustarAoGrupo(grupo, categoria, classe) {
  if (grupo === 'oficina' && categoria === 'Diária') return { categoria: 'Oficina', classe: 'investimento' };
  if (grupo === 'pessoal' && categoria === 'Oficina') return { categoria: 'Diária', classe: 'desejo' };
  return { categoria, classe };
}

// ---------- Leitura do texto ----------
const RE_CAB1 = /^\[?(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4}),?\s+(\d{1,2}:\d{2})(?::\d{2})?\]?\s*(?:-\s*)?/;
const RE_CAB2 = /^\[(\d{1,2}:\d{2})(?::\d{2})?,?\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\]\s*/;
const RE_VERBO = /^(entrou|entrada|recebi(?:do)?|ganhei|vendi|saiu|sa[ií]da|paguei|pago|gastei|gasto|comprei)(?=[\s:,.\-]|\d|$)[\s:,.\-]*/iu;
const RE_VALOR_INICIO = /^(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?![\d/:])/i;
const RE_VALOR_MEIO = /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+,\d{1,2}|\d+,\d{1,2})(?![\d/:])/i;
const RE_GRUPO_FIM = /(?:^|[\s\-–(,/])\(?(pessoal|pess|oficina|ofic|ofi|ofc)\)?[\s.!]*$/i;
const RE_DICA_ENTRADA = /^(?:🟢|🟩|✅|💚|➕|\+)/u;
const RE_DICA_SAIDA = /^(?:🟥|🔴|❌|➖|-)/u;

function dataDoCabecalho(d, m, a) {
  const ano = a.length === 2 ? `20${a}` : a;
  const iso = `${ano}-${p2(m)}-${p2(d)}`;
  return ehData(iso) ? iso : null;
}

/**
 * Interpreta uma linha. Devolve null (linha ignorada), { erro, linha } ou o item:
 * { tipo, valor, descricao, grupo, grupoExplicito, categoria, classe, data|null, linha }.
 */
export function interpretarLinha(linhaOriginal, aprendizado = {}) {
  const linha = String(linhaOriginal ?? '').trim();
  if (!linha) return null;
  let s = linha;
  let data = null;
  let c = s.match(RE_CAB1);
  if (c) { data = dataDoCabecalho(c[1], c[2], c[3]); s = s.slice(c[0].length); }
  else if ((c = s.match(RE_CAB2))) { data = dataDoCabecalho(c[2], c[3], c[4]); s = s.slice(c[0].length); }
  if (c) {
    // "[05/11/2026 09:04] Fulano: saiu 30,00 ..." → tira o nome de quem mandou
    const rem = s.match(/^([^:]{1,40}):\s*/);
    if (rem && !RE_VERBO.test(rem[1].replace(/^[^\p{L}\p{N}]+/u, ''))) s = s.slice(rem[0].length);
  }
  s = s.trim();
  const dica = RE_DICA_ENTRADA.test(s) ? 'entrada' : RE_DICA_SAIDA.test(s) ? 'saida' : null;
  s = s.replace(/^[^\p{L}\p{N}]+/u, '');

  let tipo = dica;
  const v = s.match(RE_VERBO);
  let resto = s;
  if (v) {
    tipo = /^(entrou|entrada|recebi|recebido|ganhei|vendi)$/.test(normalizar(v[1])) ? 'entrada' : 'saida';
    resto = s.slice(v[0].length);
  }
  let token = null;
  const vi = resto.match(RE_VALOR_INICIO);
  if (vi) { token = vi[1]; resto = resto.slice(vi[0].length); }
  else if (v || dica) {
    const vm = resto.match(RE_VALOR_MEIO);
    if (vm) { token = vm[1]; resto = resto.slice(0, vm.index) + ' ' + resto.slice(vm.index + vm[0].length); }
  }
  if (!v && !dica && !vi) {
    // Sem "saiu/entrou": só reclama se parece ter um valor em dinheiro; senão ignora (datas, conversa…)
    return RE_VALOR_MEIO.test(s) ? { erro: 'Comece com "saiu" ou "entrou"', linha } : null;
  }
  if (!token) return { erro: 'Faltou o valor', linha };
  const valor = parseValor(token);
  if (!valor) return { erro: 'Valor inválido', linha };
  if (!tipo) tipo = 'saida';

  let descricao = resto.replace(/^\s*(?:reais|real)\b/i, '').replace(/^[\s\-–:,.]+/, '').replace(/\s+/g, ' ').trim();
  let grupoExplicito = null;
  const g = descricao.match(RE_GRUPO_FIM);
  if (g) {
    grupoExplicito = normalizar(g[1]).startsWith('p') ? 'pessoal' : 'oficina';
    descricao = descricao.slice(0, g.index).replace(/[\s\-–,(/]+$/, '').trim();
  }
  if (!descricao) descricao = tipo === 'entrada' ? 'Entrada' : 'Saída';
  const sug = sugerir(descricao, tipo, aprendizado, grupoExplicito);
  return { tipo, valor, descricao, ...sug, grupoExplicito: !!grupoExplicito, data, linha };
}

export function ehDuplicado(item, lancamentos) {
  const d = normalizar(item.descricao);
  return lancamentos.some((l) => l.data === item.data && l.tipo === item.tipo && l.valor === item.valor && normalizar(l.descricao) === d);
}

/** Várias linhas (ex.: mensagens coladas do WhatsApp). */
export function interpretarTexto(texto, { hoje, aprendizado = {}, lancamentos = [] }) {
  const itens = [];
  const erros = [];
  for (const linha of String(texto ?? '').split(/\r?\n/)) {
    const r = interpretarLinha(linha, aprendizado);
    if (!r) continue;
    if (r.erro) { erros.push(r); continue; }
    const item = { ...r, dataDoTexto: !!r.data, data: r.data || hoje };
    item.duplicado = ehDuplicado(item, lancamentos);
    itens.push(item);
  }
  return { itens, erros };
}

export function novoLancamento(item) {
  return {
    tipo: item.tipo, valor: item.valor, descricao: String(item.descricao).trim(), grupo: item.grupo,
    categoria: item.tipo === 'saida' ? item.categoria || 'Diária' : null,
    classe: item.tipo === 'saida' ? item.classe || null : null,
    data: item.data, mes: item.data.slice(0, 7), criadoEm: new Date().toISOString(),
  };
}

// ---------- Contas fixas ----------
export const fixoAtivo = (f, mes) => f.inicio <= mes && (!f.fim || mes <= f.fim);

/** Fixas ativas no mês, com o valor do mês e o status (pago/recebido). */
export function fixosDoMes(dados, mes) {
  const st = new Map((dados.fixosMes || []).filter((x) => x.mes === mes).map((x) => [x.fixoId, x]));
  return (dados.fixos || []).filter((f) => fixoAtivo(f, mes)).map((f) => {
    const s = st.get(f.id);
    return { ...f, valorMes: s?.valor ?? f.valor, ok: !!s?.ok, ajustado: s?.valor != null };
  }).sort((a, b) => a.dia - b.dia || a.descricao.localeCompare(b.descricao, 'pt-BR'));
}

// ---------- Resumo do mês (igual à planilha) ----------
const soma = (lista, f = (x) => x.valor) => lista.reduce((s, x) => s + f(x), 0);
const pct = (v, total) => (total > 0 ? Math.round((v / total) * 1000) / 10 : 0);

export function resumoMes(dados, mes) {
  const lanc = (dados.lancamentos || []).filter((l) => l.mes === mes);
  const fixos = fixosDoMes(dados, mes);
  const recFix = fixos.filter((f) => f.tipo === 'receita');
  const despFix = fixos.filter((f) => f.tipo === 'despesa');
  const ent = lanc.filter((l) => l.tipo === 'entrada');
  const sai = lanc.filter((l) => l.tipo === 'saida');
  const vm = (f) => f.valorMes;
  const r = {
    receitasFixas: soma(recFix, vm), receitasVariaveis: soma(ent),
    despesasFixas: soma(despFix, vm), despesasVariaveis: soma(sai),
  };
  r.entradas = r.receitasFixas + r.receitasVariaveis;
  r.saidas = r.despesasFixas + r.despesasVariaveis;
  r.resultado = r.entradas - r.saidas;
  r.temDados = lanc.length > 0 || fixos.length > 0;

  r.porGrupo = Object.keys(GRUPOS).map((g) => {
    const entradas = soma(recFix.filter((f) => f.grupo === g), vm) + soma(ent.filter((l) => l.grupo === g));
    const saidas = soma(despFix.filter((f) => f.grupo === g), vm) + soma(sai.filter((l) => l.grupo === g));
    return { grupo: g, nome: GRUPOS[g], entradas, saidas, resultado: entradas - saidas };
  });
  const agrupar = (lista, chave) => {
    const m = new Map();
    for (const l of lista) m.set(chave(l), (m.get(chave(l)) || 0) + l.valor);
    return [...m].map(([k, valor]) => ({ chave: k, valor, pct: pct(valor, r.despesasVariaveis) })).sort((a, b) => b.valor - a.valor);
  };
  r.porCategoria = agrupar(sai, (l) => l.categoria || 'Diária');
  r.porClasse = agrupar(sai, (l) => l.classe || 'sem');
  r.maiores = [...sai].sort((a, b) => b.valor - a.valor).slice(0, 5);
  r.fixas = {
    despesas: despFix.length, pagas: despFix.filter((f) => f.ok).length,
    faltaPagar: soma(despFix.filter((f) => !f.ok), vm),
    receitas: recFix.length, recebidas: recFix.filter((f) => f.ok).length,
    faltaReceber: soma(recFix.filter((f) => !f.ok), vm),
    oficina: soma(despFix.filter((f) => f.grupo === 'oficina'), vm),
    pessoal: soma(despFix.filter((f) => f.grupo === 'pessoal'), vm),
    consorcios: soma(despFix.filter((f) => normalizar(f.descricao).includes('consorc')), vm),
  };
  return r;
}

// ---------- Histórico (demonstrativo mensal) ----------
/** Linhas mês a mês (mais antigo primeiro) com resultado e acumulado ("compilado"). */
export function demonstrativo(dados, mesAtual) {
  const lanc = dados.lancamentos || [];
  const hist = new Map((dados.historico || []).map((h) => [h.mes, h]));
  let fim = mesAtual;
  for (const l of lanc) if (l.mes > fim) fim = l.mes;
  const meses = new Set([...hist.keys(), ...lanc.map((l) => l.mes)]);
  for (const f of dados.fixos || []) {
    const ate = f.fim && f.fim < fim ? f.fim : fim;
    if (f.inicio <= ate) listaMeses(f.inicio, ate).forEach((m) => meses.add(m));
  }
  let acumulado = 0;
  return [...meses].sort().map((mes) => {
    const r = resumoMes(dados, mes);
    let linha;
    if (r.temDados) linha = { mes, entradas: r.entradas, saidas: r.saidas, origem: 'app' };
    else {
      const h = hist.get(mes);
      linha = { mes, entradas: h.entradas, saidas: h.saidas, origem: 'manual' };
    }
    linha.resultado = linha.entradas - linha.saidas;
    acumulado += linha.resultado;
    linha.acumulado = acumulado;
    return linha;
  });
}

// ---------- Gravação ----------
function validarLancamento(l) {
  if (!['entrada', 'saida'].includes(l.tipo)) throw new Error('Tipo inválido.');
  if (!Number.isInteger(l.valor) || l.valor <= 0) throw new Error('Informe um valor maior que zero.');
  if (!ehData(l.data)) throw new Error('Data inválida.');
  if (!String(l.descricao || '').trim()) throw new Error('Informe a descrição.');
  if (!GRUPOS[l.grupo]) throw new Error('Escolha Pessoal ou Oficina.');
}
export async function salvarLancamentos(itens) {
  const recs = itens.map(novoLancamento);
  recs.forEach(validarLancamento);
  await salvarVarios('lancamentos', recs);
  return recs;
}
export function salvarLancamento(l) {
  const rec = { ...l, descricao: String(l.descricao || '').trim(), mes: String(l.data).slice(0, 7) };
  if (rec.tipo === 'entrada') { rec.categoria = null; rec.classe = null; }
  validarLancamento(rec);
  return salvar('lancamentos', rec);
}
export const excluirLancamento = (id) => excluir('lancamentos', id);
export const aprender = (descricao, { grupo, categoria = null, classe = null }) =>
  salvar('aprendizado', { chave: chaveAprendizado(descricao), grupo, categoria, classe });

function validarFixo(f) {
  if (!['receita', 'despesa'].includes(f.tipo)) throw new Error('Tipo inválido.');
  if (!String(f.descricao || '').trim()) throw new Error('Informe a descrição.');
  if (!Number.isInteger(f.valor) || f.valor <= 0) throw new Error('Informe um valor maior que zero.');
  if (!Number.isInteger(f.dia) || f.dia < 1 || f.dia > 31) throw new Error('Dia do vencimento deve ser de 1 a 31.');
  if (!GRUPOS[f.grupo]) throw new Error('Escolha Oficina ou Pessoal.');
  if (!ehMes(f.inicio) || (f.fim != null && !ehMes(f.fim))) throw new Error('Mês inválido.');
}
/**
 * Grava uma conta fixa. Se o valor normal mudou, os meses anteriores a `aPartirDe`
 * ficam com o valor antigo (o histórico não muda).
 */
export async function salvarFixo(f, aPartirDe = null) {
  const rec = { ...f, descricao: String(f.descricao || '').trim(), fim: f.fim ?? null };
  validarFixo(rec);
  const antigo = rec.id != null ? await obter('fixos', rec.id) : null;
  return tx(['fixos', 'fixosMes'], 'readwrite', (l) => {
    const r = l.fixos.put(rec);
    r.onsuccess = () => { rec.id = r.result; };
    if (antigo && aPartirDe && antigo.valor !== rec.valor && antigo.inicio < aPartirDe) {
      const meses = listaMeses(antigo.inicio, addMes(aPartirDe, -1));
      const g = l.fixosMes.getAll(IDBKeyRange.bound([rec.id, ''], [rec.id, '￿']));
      g.onsuccess = () => {
        const exist = new Map(g.result.map((x) => [x.mes, x]));
        for (const mes of meses) {
          const x = exist.get(mes);
          if (x?.valor == null) l.fixosMes.put({ fixoId: rec.id, mes, ok: !!x?.ok, valor: antigo.valor });
        }
      };
    }
    return () => rec.id;
  });
}
export function excluirFixo(id) {
  return tx(['fixos', 'fixosMes'], 'readwrite', (l) => {
    l.fixos.delete(id);
    l.fixosMes.delete(IDBKeyRange.bound([id, ''], [id, '￿']));
  });
}
async function atualizarFixoMes(fixoId, mes, mudar) {
  const atual = (await obter('fixosMes', [fixoId, mes])) || { fixoId, mes, ok: false, valor: null };
  return salvar('fixosMes', { ...atual, ...mudar });
}
export const marcarFixo = (fixoId, mes, ok) => atualizarFixoMes(fixoId, mes, { ok });
export const valorFixoNoMes = (fixoId, mes, valor) => atualizarFixoMes(fixoId, mes, { valor: valor ?? null });

export function salvarHistorico(h) {
  if (!ehMes(h.mes)) throw new Error('Mês inválido.');
  for (const k of ['entradas', 'saidas']) {
    if (!Number.isInteger(h[k]) || h[k] < 0) throw new Error('Informe entradas e saídas (pode ser 0).');
  }
  return salvar('historico', { mes: h.mes, entradas: h.entradas, saidas: h.saidas });
}
export const excluirHistorico = (mes) => excluir('historico', mes);
