// Service worker: guarda todos os arquivos do app no celular (cache-first).
// IMPORTANTE: ao publicar uma versão nova, aumente o número em CACHE_NAME.
const CACHE_NAME = 'controle-financeiro-v3';

const ARQUIVOS = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/app.css',
  './assets/vendor/chart.umd.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-192.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/js/app.js',
  './assets/js/db.js',
  './assets/js/ui.js',
  './assets/js/util.js',
  './assets/js/servicos/backup.js',
  './assets/js/servicos/cadastros.js',
  './assets/js/servicos/cambio.js',
  './assets/js/servicos/dashboard.js',
  './assets/js/servicos/despesas.js',
  './assets/js/servicos/orcamento.js',
  './assets/js/servicos/rapido.js',
  './assets/js/servicos/saldos.js',
  './assets/js/telas/rapido.js',
  './assets/js/telas/resumo.js',
  './assets/js/telas/fixas.js',
  './assets/js/telas/historico.js',
  './assets/js/telas/backup.js',
  './assets/js/telas/cambio.js',
  './assets/js/telas/categorias.js',
  './assets/js/telas/comum.js',
  './assets/js/telas/configuracoes.js',
  './assets/js/telas/despesas.js',
  './assets/js/telas/formas.js',
  './assets/js/telas/inicio.js',
  './assets/js/telas/mais.js',
  './assets/js/telas/orcamento.js',
  './assets/js/telas/saldos.js',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' ignora o cache HTTP para pegar sempre os arquivos novos
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(ARQUIVOS.map((u) => new Request(u, { cache: 'reload' }))))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(
        chaves
          .filter((k) => k.startsWith('controle-financeiro-') && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
});

// A página pede para ativar a versão nova quando o usuário toca no aviso.
self.addEventListener('message', (e) => {
  if (e.data === 'atualizar') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (resp) =>
        resp ||
        fetch(req).catch(() =>
          req.mode === 'navigate' ? caches.match('./index.html') : Response.error()
        )
    )
  );
});
