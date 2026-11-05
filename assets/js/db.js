// Acesso ao IndexedDB (um object store por entidade). Sem regras de negócio aqui.

export const VERSAO_ESQUEMA = 2;
/** Stores criados na versão 2 (modo simples). Backups antigos não os têm. */
export const STORES_V2 = ['lancamentos', 'fixos', 'fixosMes', 'historico', 'aprendizado'];
export const STORES = [
  'categorias', 'formasPagamento', 'taxasCambio', 'orcamentos', 'series',
  'despesas', 'saldosManuais', 'movimentacoes', 'config', ...STORES_V2,
];

let nomeBanco = 'controle-financeiro';
let conexao = null;

/** Troca o banco usado (os testes usam um banco separado). */
export function usarBanco(nome) {
  if (conexao) conexao.then((db) => db.close()).catch(() => {});
  nomeBanco = nome;
  conexao = null;
}

function criarEsquema(db, versaoAntiga) {
  if (versaoAntiga < 1) criarEsquemaV1(db);
  if (versaoAntiga < 2) {
    const lanc = db.createObjectStore('lancamentos', { keyPath: 'id', autoIncrement: true });
    lanc.createIndex('mes', 'mes');
    db.createObjectStore('fixos', { keyPath: 'id', autoIncrement: true });
    db.createObjectStore('fixosMes', { keyPath: ['fixoId', 'mes'] });
    db.createObjectStore('historico', { keyPath: 'mes' });
    db.createObjectStore('aprendizado', { keyPath: 'chave' });
  }
}

export function criarEsquemaV1(db) {
  const cat = db.createObjectStore('categorias', { keyPath: 'id', autoIncrement: true });
  cat.createIndex('nome', 'nome', { unique: true });
  const fp = db.createObjectStore('formasPagamento', { keyPath: 'id', autoIncrement: true });
  fp.createIndex('nome', 'nome', { unique: true });
  db.createObjectStore('taxasCambio', { keyPath: ['mes', 'moeda'] });
  db.createObjectStore('orcamentos', { keyPath: ['mes', 'categoriaId'] });
  db.createObjectStore('series', { keyPath: 'id', autoIncrement: true });
  const desp = db.createObjectStore('despesas', { keyPath: 'id', autoIncrement: true });
  desp.createIndex('mes', 'mes');
  // No máximo UMA despesa por (série, mês). Avulsas (serieId null) não entram no índice.
  desp.createIndex('serieMes', ['serieId', 'mes'], { unique: true });
  db.createObjectStore('saldosManuais', { keyPath: 'id', autoIncrement: true });
  const mov = db.createObjectStore('movimentacoes', { keyPath: 'id', autoIncrement: true });
  mov.createIndex('saldoId', 'saldoId');
  db.createObjectStore('config', { keyPath: 'chave' });
}

export function abrir() {
  if (!conexao) {
    conexao = new Promise((res, rej) => {
      const r = indexedDB.open(nomeBanco, VERSAO_ESQUEMA);
      r.onupgradeneeded = (e) => criarEsquema(r.result, e.oldVersion);
      r.onsuccess = () => {
        const db = r.result;
        db.onversionchange = () => { db.close(); conexao = null; };
        res(db);
      };
      r.onerror = () => { conexao = null; rej(r.error); };
    });
  }
  return conexao;
}

/**
 * Executa `fn(lojas)` numa transação. `fn` deve só disparar requisições (sem await).
 * Se `fn` devolver uma função, ela é chamada quando a transação termina e o
 * resultado dela é o valor da promessa.
 */
export async function tx(stores, modo, fn) {
  const db = await abrir();
  return new Promise((res, rej) => {
    const t = db.transaction(stores, modo);
    const lojas = {};
    for (const s of stores) lojas[s] = t.objectStore(s);
    let saida;
    t.oncomplete = () => res(typeof saida === 'function' ? saida() : saida);
    t.onerror = (e) => rej(e.target.error || t.error);
    t.onabort = () => rej(t.error || new Error('Operação cancelada'));
    try {
      saida = fn(lojas, t);
    } catch (e) {
      try { t.abort(); } catch { /* já finalizada */ }
      rej(e);
    }
  });
}

export const todos = (s) => tx([s], 'readonly', (l) => { const r = l[s].getAll(); return () => r.result; });
export const obter = (s, chave) => tx([s], 'readonly', (l) => { const r = l[s].get(chave); return () => r.result; });
export const excluir = (s, chave) => tx([s], 'readwrite', (l) => { l[s].delete(chave); });

/** Grava (insere ou substitui) e devolve a chave. Preenche obj.id quando gerado. */
export function salvar(s, obj) {
  return tx([s], 'readwrite', (l) => {
    const r = l[s].put(obj);
    r.onsuccess = () => { if (l[s].keyPath === 'id') obj.id = r.result; };
    return () => r.result;
  });
}
export function salvarVarios(s, lista) {
  return tx([s], 'readwrite', (l) => {
    for (const obj of lista) {
      const r = l[s].put(obj);
      r.onsuccess = () => { if (l[s].keyPath === 'id') obj.id = r.result; };
    }
  });
}
export function excluirVarios(s, chaves) {
  return tx([s], 'readwrite', (l) => { for (const k of chaves) l[s].delete(k); });
}

/** Lê todos os stores de uma vez (o volume de dados pessoais é pequeno). */
export function carregarTudo() {
  return tx(STORES, 'readonly', (l) => {
    const r = {};
    for (const s of STORES) r[s] = l[s].getAll();
    return () => {
      const d = {};
      for (const s of STORES) d[s] = r[s].result;
      d.config = d.config.find((c) => c.chave === 'principal') || null;
      return d;
    };
  });
}

/** Cópia bruta de todos os stores (para backup). */
export function lerStoresBrutos() {
  return tx(STORES, 'readonly', (l) => {
    const r = {};
    for (const s of STORES) r[s] = l[s].getAll();
    return () => Object.fromEntries(STORES.map((s) => [s, r[s].result]));
  });
}
