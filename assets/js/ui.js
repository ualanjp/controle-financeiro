// Componentes de interface reutilizáveis: folha (janela inferior), confirmação,
// escolha de opções, avisos (toast) e registro dos gráficos.
import { esc } from './util.js';

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// ---------- Gráficos ----------
let graficos = [];
function cssVar(nome) {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
}
export function criarGrafico(canvas, config) {
  if (!window.Chart) return null;
  Chart.defaults.color = cssVar('--txt2');
  Chart.defaults.borderColor = cssVar('--borda');
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  const g = new Chart(canvas, config);
  graficos.push(g);
  return g;
}
export function destruirGraficos() {
  graficos.forEach((g) => g.destroy());
  graficos = [];
}

// ---------- Folha ----------
export function abrirFolha(titulo, conteudo) {
  const fundo = el(`<div class="folha-fundo">
    <div class="folha" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
      <div class="folha-topo"><h2>${esc(titulo)}</h2>
        <button type="button" class="btn-icone" data-fechar aria-label="Fechar">✕</button></div>
      <div class="folha-corpo"></div>
    </div></div>`);
  const corpo = fundo.querySelector('.folha-corpo');
  if (typeof conteudo === 'string') corpo.innerHTML = conteudo;
  else if (conteudo) corpo.append(conteudo);
  document.body.append(fundo);
  document.body.classList.add('sem-rolagem');
  let fechada = false;
  const aoFechar = [];
  const fechar = () => {
    if (fechada) return;
    fechada = true;
    fundo.remove();
    if (!document.querySelector('.folha-fundo')) document.body.classList.remove('sem-rolagem');
    aoFechar.forEach((f) => f());
  };
  fundo.addEventListener('click', (e) => {
    if (e.target === fundo || e.target.closest('[data-fechar]')) fechar();
  });
  const esc_ = (e) => { if (e.key === 'Escape' && fundo === [...document.querySelectorAll('.folha-fundo')].pop()) fechar(); };
  document.addEventListener('keydown', esc_);
  aoFechar.push(() => document.removeEventListener('keydown', esc_));
  requestAnimationFrame(() => fundo.classList.add('aberta'));
  return { el: fundo, corpo, fechar, aoFechar: (f) => aoFechar.push(f) };
}

/** Pergunta sim/não. Resolve true/false. */
export function confirmar(msg, { titulo = 'Confirmar', ok = 'Confirmar', cancelar = 'Cancelar', perigo = false } = {}) {
  return new Promise((res) => {
    const f = abrirFolha(titulo, `<p class="msg">${esc(msg)}</p>
      <div class="acoes"><button type="button" class="btn" data-r="0">${esc(cancelar)}</button>
      <button type="button" class="btn ${perigo ? 'btn-perigo' : 'btn-pri'}" data-r="1">${esc(ok)}</button></div>`);
    let r = false;
    f.corpo.addEventListener('click', (e) => {
      const b = e.target.closest('[data-r]');
      if (b) { r = b.dataset.r === '1'; f.fechar(); }
    });
    f.aoFechar(() => res(r));
  });
}

/** Lista de opções; resolve o `valor` escolhido ou null. */
export function escolher(titulo, opcoes, msg = '') {
  return new Promise((res) => {
    const f = abrirFolha(titulo, `${msg ? `<p class="msg">${esc(msg)}</p>` : ''}
      <div class="opcoes-escolha">${opcoes.map((o, i) => `<button type="button" class="opcao" data-i="${i}">
        <b>${esc(o.rotulo)}</b>${o.desc ? `<small>${esc(o.desc)}</small>` : ''}</button>`).join('')}
      <button type="button" class="btn btn-link" data-fechar>Cancelar</button></div>`);
    let r = null;
    f.corpo.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (b) { r = opcoes[Number(b.dataset.i)].valor; f.fechar(); }
    });
    f.aoFechar(() => res(r));
  });
}

// ---------- Toast ----------
export function toast(msg, { erro = false, aoTocar = null, fixo = false, duracao = 2800 } = {}) {
  const area = document.getElementById('toasts');
  const t = el(`<div class="toast ${erro ? 'erro' : ''} ${aoTocar ? 'clicavel' : ''}" role="status">${esc(msg)}</div>`);
  if (aoTocar) t.addEventListener('click', () => { t.remove(); aoTocar(); });
  area.append(t);
  if (!fixo) setTimeout(() => t.remove(), duracao);
  return t;
}
export function mostrarErro(e) {
  console.error(e);
  toast(`⚠ ${e?.message || e}`, { erro: true, duracao: 4500 });
}
