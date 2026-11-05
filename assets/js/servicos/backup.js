// Exportar / importar / apagar dados.
import { tx, obter, salvar, lerStoresBrutos, STORES, VERSAO_ESQUEMA } from '../db.js';
import { difDias, ehMes } from '../util.js';
import { semearDados } from './cadastros.js';

export const APP_ID = 'controle-financeiro';
export const nomeArquivoBackup = (hoje) => `controle-financeiro-${hoje}.json`;

export async function gerarBackup() {
  return { app: APP_ID, versaoEsquema: VERSAO_ESQUEMA, exportadoEm: new Date().toISOString(), dados: await lerStoresBrutos() };
}

const ROTULOS = {
  despesas: 'despesas', series: 'séries (parceladas/fixas)', categorias: 'categorias',
  formasPagamento: 'formas de pagamento', orcamentos: 'orçamentos', taxasCambio: 'taxas de câmbio',
  saldosManuais: 'saldos', movimentacoes: 'movimentações',
};

/** Valida o conteúdo de um arquivo de backup. Lança erro se inválido; devolve o resumo. */
export function validarBackup(obj) {
  if (!obj || typeof obj !== 'object' || obj.app !== APP_ID || !obj.dados || typeof obj.dados !== 'object') {
    throw new Error('Este arquivo não é um backup do Controle Financeiro.');
  }
  if (!Number.isInteger(obj.versaoEsquema) || obj.versaoEsquema < 1) throw new Error('Versão do backup inválida.');
  if (obj.versaoEsquema > VERSAO_ESQUEMA) throw new Error('Este backup é de uma versão mais nova do app. Atualize o app antes de importar.');
  for (const s of STORES) {
    if (!Array.isArray(obj.dados[s])) throw new Error(`Backup incompleto: falta "${s}".`);
  }
  const d = obj.dados;
  if (!d.config.some((c) => c.chave === 'principal')) throw new Error('Backup sem configuração.');
  const idOk = (x) => Number.isInteger(x.id);
  for (const s of ['categorias', 'formasPagamento', 'series', 'despesas', 'saldosManuais', 'movimentacoes']) {
    if (!d[s].every(idOk)) throw new Error(`Backup corrompido em "${s}".`);
  }
  if (!d.despesas.every((x) => Number.isInteger(x.valor) && ehMes(x.mes))) throw new Error('Backup corrompido em "despesas".');
  if (!d.orcamentos.every((x) => ehMes(x.mes) && Number.isInteger(x.valorPlanejado))) throw new Error('Backup corrompido em "orcamentos".');
  return Object.fromEntries(Object.keys(ROTULOS).map((s) => [s, d[s].length]));
}
export const textoResumo = (resumo) =>
  Object.entries(ROTULOS).map(([s, r]) => `${resumo[s]} ${r}`).join(', ');

/** Substitui TODOS os dados pelos do backup (numa única transação). */
export async function restaurarBackup(obj) {
  validarBackup(obj);
  const atual = await obter('config', 'principal');
  await tx(STORES, 'readwrite', (l) => {
    for (const s of STORES) l[s].clear();
    for (const s of STORES) {
      for (let item of obj.dados[s]) {
        if (s === 'config' && item.chave === 'principal') {
          const datas = [item.ultimoBackup, atual?.ultimoBackup].filter(Boolean).sort();
          item = { ...item, ultimoBackup: datas.pop() || null };
        }
        l[s].put(item);
      }
    }
  });
}

export async function apagarTudo() {
  await tx(STORES, 'readwrite', (l) => { for (const s of STORES) l[s].clear(); });
  await semearDados();
}

export async function registrarBackup(hoje) {
  const c = await obter('config', 'principal');
  return salvar('config', { ...c, ultimoBackup: hoje });
}

/** Lembrete no Início: há dados e nunca fez backup, ou o último tem mais de 30 dias. */
export function precisaLembrete(config, hoje, temDados) {
  if (!temDados) return false;
  if (!config.ultimoBackup) return true;
  return difDias(config.ultimoBackup, hoje) > 30;
}
