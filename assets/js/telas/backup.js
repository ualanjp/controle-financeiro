import { formatarData, difDias } from '../util.js';
import { abrirFolha, confirmar, toast, mostrarErro } from '../ui.js';
import {
  gerarBackup, nomeArquivoBackup, validarBackup, textoResumo, restaurarBackup, apagarTudo, registrarBackup,
  ehDadosIniciais, validarDadosIniciais, importarDadosIniciais,
} from '../servicos/backup.js';

export const titulo = 'Backup';
export const pai = 'mais';
export const aba = 'mais';

function baixar(arquivo) {
  const url = URL.createObjectURL(arquivo);
  const a = document.createElement('a');
  a.href = url;
  a.download = arquivo.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function render(ctx) {
  const { el, dados, hoje } = ctx;
  const ult = dados.config.ultimoBackup;
  const podeCompartilhar = (() => {
    try { return !!navigator.canShare?.({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] }); } catch { return false; }
  })();

  el.innerHTML = `
    <section class="cartao">
      <h2>Por que fazer backup?</h2>
      <p class="dica" style="margin:0">Seus dados ficam <b>só neste aparelho</b>. Se o app for desinstalado ou os dados do navegador forem limpos, eles se perdem.
      Exporte um backup de vez em quando e guarde o arquivo (Google Drive, e-mail, WhatsApp para você mesmo…). O backup também serve para passar os dados para outro aparelho.</p>
    </section>
    <section class="cartao">
      <h2>Exportar</h2>
      <p class="dica">Último backup: <b>${ult ? `${formatarData(ult)} (há ${difDias(ult, hoje)} dia(s))` : 'nunca'}</b></p>
      <div class="botoes-linha" style="margin:0">
        ${podeCompartilhar ? '<button type="button" class="btn btn-pri" data-exportar="share">📤 Salvar / compartilhar</button>' : ''}
        <button type="button" class="btn ${podeCompartilhar ? '' : 'btn-pri'}" data-exportar="download">⬇️ Baixar arquivo</button>
      </div>
    </section>
    <section class="cartao">
      <h2>Importar</h2>
      <p class="dica">Escolha um arquivo <code>controle-financeiro-AAAA-MM-DD.json</code>. Os dados atuais serão <b>substituídos</b> (você confirma antes).</p>
      <label class="btn btn-bloco" style="margin:0">📂 Escolher arquivo de backup<input type="file" accept=".json,application/json,application/octet-stream,text/plain" hidden data-importar></label>
    </section>
    <section class="cartao">
      <h2 class="cor-erro">Apagar todos os dados</h2>
      <p class="dica">Remove tudo deste aparelho e volta às categorias padrão. Não dá para desfazer.</p>
      <button type="button" class="btn btn-bloco" data-apagar style="color:var(--erro)">🗑️ Apagar todos os dados</button>
    </section>`;

  el.querySelectorAll('[data-exportar]').forEach((b) => b.addEventListener('click', async () => {
    try {
      const json = JSON.stringify(await gerarBackup());
      const arquivo = new File([json], nomeArquivoBackup(hoje), { type: 'application/json' });
      if (b.dataset.exportar === 'share') {
        try {
          await navigator.share({ files: [arquivo], title: 'Backup Controle Financeiro' });
        } catch (e) {
          if (e.name === 'AbortError') return; // usuário cancelou
          baixar(arquivo);
        }
      } else {
        baixar(arquivo);
      }
      await registrarBackup(hoje);
      toast('✓ Backup exportado');
      ctx.atualizar();
    } catch (e) { mostrarErro(e); }
  }));

  el.querySelector('[data-importar]').addEventListener('change', async (e) => {
    const arq = e.target.files[0];
    e.target.value = '';
    if (!arq) return;
    try {
      let obj;
      try { obj = JSON.parse(await arq.text()); } catch { throw new Error('Arquivo inválido (não é JSON).'); }
      if (ehDadosIniciais(obj)) {
        const n = validarDadosIniciais(obj);
        const ok = await confirmar(`Arquivo de dados iniciais com:\n${n.fixos} contas fixas e ${n.historico} meses de histórico.\n\nEles serão ADICIONADOS (nada do que você já lançou é apagado; contas fixas repetidas são ignoradas).`, { titulo: 'Importar dados iniciais', ok: 'Adicionar' });
        if (!ok) return;
        const r = await importarDadosIniciais(obj);
        toast(`✓ ${r.fixos} contas fixas e ${r.historico} meses adicionados`);
        ctx.atualizar();
        return;
      }
      const resumo = validarBackup(obj);
      const quando = obj.exportadoEm ? ` de ${formatarData(obj.exportadoEm.slice(0, 10))}` : '';
      const ok = await confirmar(`Backup${quando} com:\n${textoResumo(resumo)}.\n\nIsso SUBSTITUI todos os dados atuais deste aparelho.`, { titulo: 'Importar backup', ok: 'Substituir dados', perigo: true });
      if (!ok) return;
      await restaurarBackup(obj);
      toast('✓ Backup importado');
      ctx.atualizar();
    } catch (err) { mostrarErro(err); }
  });

  el.querySelector('[data-apagar]').addEventListener('click', async () => {
    const ok = await confirmar('Tem certeza? Todos os dados deste aparelho serão apagados. Considere exportar um backup antes.', { ok: 'Continuar', perigo: true });
    if (!ok) return;
    const f = abrirFolha('Confirmação final', `<form class="form" novalidate>
      <p class="msg">Digite <b>APAGAR</b> para confirmar.</p>
      <label><input name="txt" autocomplete="off" autocapitalize="characters"></label>
      <div class="acoes"><button type="button" class="btn" data-fechar>Cancelar</button>
      <button type="submit" class="btn btn-perigo" disabled>Apagar tudo</button></div></form>`);
    const form = f.corpo.querySelector('form');
    const btn = form.querySelector('[type=submit]');
    form.txt.addEventListener('input', () => { btn.disabled = form.txt.value.trim() !== 'APAGAR'; });
    form.txt.focus();
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (form.txt.value.trim() !== 'APAGAR') return;
      try {
        await apagarTudo();
        f.fechar();
        toast('Todos os dados foram apagados');
        location.hash = '#/rapido';
        ctx.atualizar();
      } catch (err) { mostrarErro(err); }
    });
  });
}
