// Categorias, formas de pagamento, saldos manuais, movimentações e configurações.
import { tx, obter, salvar, excluir, VERSAO_ESQUEMA } from '../db.js';
import { ehData } from '../util.js';
import { fonteManual } from './despesas.js';

export const CATEGORIAS_PADRAO = [
  ['Moradia', '#2a78d6', '🏠'], ['Alimentação', '#1baf7a', '🍽️'], ['Transporte', '#eda100', '🚗'],
  ['Saúde', '#008300', '🩺'], ['Educação', '#4a3aa7', '🎓'], ['Lazer', '#e34948', '🎉'],
  ['Assinaturas', '#e87ba4', '📺'], ['Outros', '#eb6834', '📦'], ['Poupança e investimento', '#0e7490', '🏦'],
];
export const FORMAS_PADRAO = ['Dinheiro', 'Cartão de Débito', 'Cartão de Crédito', 'Transferência/PIX', 'Boleto'];
export const SALDOS_PADRAO = ['Bonus', 'Investido'];

export function configPadrao() {
  return {
    chave: 'principal', moedaBase: 'AED', outrasMoedas: ['USD', 'BRL'],
    versaoEsquema: VERSAO_ESQUEMA, categoriaPoupancaId: null, ultimoBackup: null,
  };
}

/** Cria categorias, formas, saldos e configuração padrão (banco vazio). */
export function semearDados() {
  return tx(['categorias', 'formasPagamento', 'saldosManuais', 'config'], 'readwrite', (l) => {
    const cfg = configPadrao();
    CATEGORIAS_PADRAO.forEach(([nome, cor, icone], i) => {
      const r = l.categorias.add({ nome, cor, icone, arquivada: false });
      if (i === CATEGORIAS_PADRAO.length - 1) {
        r.onsuccess = () => { cfg.categoriaPoupancaId = r.result; l.config.put(cfg); };
      }
    });
    FORMAS_PADRAO.forEach((nome) => l.formasPagamento.add({ nome, arquivada: false }));
    SALDOS_PADRAO.forEach((nome, i) => l.saldosManuais.add({ nome, ordem: i + 1, arquivado: false }));
  });
}
export async function garantirDadosIniciais() {
  if (!(await obter('config', 'principal'))) await semearDados();
}

const norm = (s) => String(s || '').trim().toLocaleLowerCase('pt-BR');
function nomeLivre(lista, nome, id) {
  if (!String(nome || '').trim()) throw new Error('Informe o nome.');
  if (lista.some((x) => x.id !== id && norm(x.nome) === norm(nome))) throw new Error('Já existe um item com esse nome.');
}

// ---------- Categorias ----------
export const categoriaEmUso = (dados, id) =>
  dados.despesas.some((d) => d.categoriaId === id) || dados.series.some((s) => s.categoriaId === id) ||
  dados.orcamentos.some((o) => o.categoriaId === id);

export function salvarCategoria(dados, c) {
  nomeLivre(dados.categorias, c.nome, c.id);
  if (!/^#[0-9a-f]{6}$/i.test(c.cor || '')) throw new Error('Cor inválida.');
  const obj = { ...c, nome: c.nome.trim(), icone: (c.icone || '').trim(), arquivada: !!c.arquivada };
  if (obj.id == null) delete obj.id;
  return salvar('categorias', obj);
}
export async function excluirCategoria(dados, id) {
  if (id === dados.config.categoriaPoupancaId) throw new Error('Esta categoria é usada no cálculo da Poupança e não pode ser excluída.');
  if (categoriaEmUso(dados, id)) throw new Error('Possui histórico, use Arquivar');
  return excluir('categorias', id);
}

// ---------- Formas de pagamento ----------
export const formaEmUso = (dados, id) =>
  dados.despesas.some((d) => d.formaPagamentoId === id) || dados.series.some((s) => s.formaPagamentoId === id);

export function salvarForma(dados, f) {
  nomeLivre(dados.formasPagamento, f.nome, f.id);
  const obj = { ...f, nome: f.nome.trim(), arquivada: !!f.arquivada };
  if (obj.id == null) delete obj.id;
  return salvar('formasPagamento', obj);
}
export async function excluirForma(dados, id) {
  if (formaEmUso(dados, id)) throw new Error('Possui histórico, use Arquivar');
  return excluir('formasPagamento', id);
}

// ---------- Saldos manuais ----------
export const saldoEmUso = (dados, id) =>
  dados.movimentacoes.some((m) => m.saldoId === id) ||
  dados.despesas.some((d) => d.fonteSaldo === fonteManual(id)) ||
  dados.series.some((s) => s.fonteSaldo === fonteManual(id));

export function salvarSaldoManual(dados, s) {
  nomeLivre(dados.saldosManuais, s.nome, s.id);
  const ordem = s.ordem ?? Math.max(0, ...dados.saldosManuais.map((x) => x.ordem || 0)) + 1;
  const obj = { ...s, nome: s.nome.trim(), ordem, arquivado: !!s.arquivado };
  if (obj.id == null) delete obj.id;
  return salvar('saldosManuais', obj);
}
export async function excluirSaldoManual(dados, id) {
  if (saldoEmUso(dados, id)) throw new Error('Possui histórico, use Arquivar');
  return excluir('saldosManuais', id);
}

// ---------- Movimentações ----------
export function salvarMovimentacao(m) {
  if (!m.saldoId) throw new Error('Escolha o saldo.');
  if (m.tipo !== 'entrada' && m.tipo !== 'saida') throw new Error('Escolha entrada ou saída.');
  if (!Number.isInteger(m.valor) || m.valor <= 0) throw new Error('Informe um valor maior que zero.');
  if (!/^[A-Z]{3}$/.test(m.moeda || '')) throw new Error('Moeda inválida.');
  if (!ehData(m.data)) throw new Error('Informe a data.');
  const obj = { ...m, descricao: (m.descricao || '').trim() || null };
  if (obj.id == null) delete obj.id;
  return salvar('movimentacoes', obj);
}
export const excluirMovimentacao = (id) => excluir('movimentacoes', id);

// ---------- Configurações ----------
export async function salvarMoedas(dados, base, outras) {
  const lista = [base, ...outras].map((m) => String(m || '').trim().toUpperCase());
  if (lista.some((m) => !/^[A-Z]{3}$/.test(m))) throw new Error('Use códigos de 3 letras (ex.: AED, USD, BRL).');
  if (new Set(lista).size !== lista.length) throw new Error('As três moedas precisam ser diferentes.');
  return salvar('config', { ...dados.config, moedaBase: lista[0], outrasMoedas: lista.slice(1) });
}
