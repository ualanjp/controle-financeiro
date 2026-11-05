// Rotas (hash), layout, mês selecionado e service worker.
import { carregarTudo } from './db.js';
import { garantirDadosIniciais } from './servicos/cadastros.js';
import { garantirFixas, promoverPrevistas } from './servicos/despesas.js';
import { mesHoje, hojeISO, addMes, nomeMes, ehMes, esc } from './util.js';
import { destruirGraficos, toast } from './ui.js';
import * as inicio from './telas/inicio.js';
import * as despesas from './telas/despesas.js';
import * as orcamento from './telas/orcamento.js';
import * as cambio from './telas/cambio.js';
import * as mais from './telas/mais.js';
import * as saldos from './telas/saldos.js';
import * as categorias from './telas/categorias.js';
import * as formas from './telas/formas.js';
import * as configuracoes from './telas/configuracoes.js';
import * as backup from './telas/backup.js';

const ROTAS = { inicio, despesas, orcamento, cambio, mais, saldos, categorias, formas, configuracoes, backup };

const $ = (id) => document.getElementById(id);

// ---------- Mês selecionado (vale para todas as telas) ----------
let mesSel = (() => {
  try { const m = sessionStorage.getItem('cf.mes'); if (ehMes(m)) return m; } catch { /* sem storage */ }
  return mesHoje();
})();
function definirMes(m) {
  mesSel = m;
  try { sessionStorage.setItem('cf.mes', m); } catch { /* sem storage */ }
  renderizar();
}

function rotaAtual() {
  const partes = location.hash.replace(/^#\/?/, '').split('/');
  const nome = ROTAS[partes[0]] ? partes[0] : 'inicio';
  return { nome, params: partes.slice(1).filter(Boolean) };
}

let renderId = 0;
async function renderizar({ manterRolagem = false } = {}) {
  const id = ++renderId;
  const { nome, params } = rotaAtual();
  const tela = ROTAS[nome];
  const main = $('conteudo');
  const rolagem = window.scrollY;
  try {
    const mesAtual = mesHoje();
    if (tela.usaMes) {
      const extras = tela.mesesExtras ? tela.mesesExtras(mesSel) : [];
      await garantirFixas([mesSel, ...extras], mesAtual);
    }
    const dados = await carregarTudo();
    if (id !== renderId) return;

    destruirGraficos();
    $('titulo').textContent = tela.titulo;
    document.title = `${tela.titulo} · Controle Financeiro`;
    $('voltar').hidden = !tela.pai;
    $('nav-mes').hidden = !tela.usaMes;
    $('mes-nome').textContent = nomeMes(mesSel) + (mesSel === mesAtual ? '' : ' •');
    const aba = tela.aba || nome;
    document.querySelectorAll('#barra a').forEach((a) => a.classList.toggle('ativo', a.dataset.aba === aba));

    main.innerHTML = '';
    await tela.render({
      el: main, dados, params, mes: mesSel, mesAtual, hoje: hojeISO(),
      atualizar: () => renderizar({ manterRolagem: true }),
      definirMes,
    });
    if (id === renderId) window.scrollTo(0, manterRolagem ? rolagem : 0);
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="cartao"><b class="cor-erro">Algo deu errado.</b><p class="dica">${esc(e.message || e)}</p></div>`;
  }
}

function ligarLayout() {
  $('mes-ant').addEventListener('click', () => definirMes(addMes(mesSel, -1)));
  $('mes-prox').addEventListener('click', () => definirMes(addMes(mesSel, 1)));
  $('mes-nome').addEventListener('click', () => definirMes(mesHoje()));
  $('voltar').addEventListener('click', () => {
    const tela = ROTAS[rotaAtual().nome];
    location.hash = `#/${tela.pai || 'inicio'}`;
  });
  window.addEventListener('hashchange', () => renderizar());
  // Ao voltar para o app (ex.: dia seguinte), atualiza status "prevista" → "pendente".
  let ultimoMes = mesHoje();
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    if (mesHoje() !== ultimoMes) {
      ultimoMes = mesHoje();
      await promoverPrevistas(ultimoMes);
      renderizar({ manterRolagem: true });
    }
  });
}

function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  let recarregando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recarregando) return;
    recarregando = true;
    location.reload();
  });
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    let avisado = false;
    const avisar = (w) => {
      if (avisado) return;
      avisado = true;
      toast('Nova versão disponível — toque para atualizar', { fixo: true, aoTocar: () => w.postMessage('atualizar') });
    };
    if (reg.waiting && navigator.serviceWorker.controller) avisar(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) avisar(w);
      });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch((e) => console.warn('Service worker não registrado:', e));
}

async function iniciar() {
  ligarLayout();
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch { /* navegador sem suporte */ }
  try {
    await garantirDadosIniciais();
    await promoverPrevistas(mesHoje());
  } catch (e) {
    $('conteudo').innerHTML = `<div class="cartao"><b class="cor-erro">Não foi possível abrir o banco de dados.</b>
      <p class="dica">${esc(e.message || e)}</p><p class="dica">Em janela anônima/privada alguns navegadores bloqueiam o armazenamento.</p></div>`;
    return;
  }
  registrarServiceWorker();
  renderizar();
}

iniciar();
