# Guia do Controle Financeiro

Endereço do app: **https://ualanjp.github.io/controle-financeiro/**
Código no GitHub: **https://github.com/ualanjp/controle-financeiro** (usuário `ualanjp`)

## Instalar no celular

Abra o endereço no celular **com internet** (de preferência no Wi-Fi).

**Android (Chrome)**
1. Abra o endereço no **Chrome**.
2. Toque nos **três pontinhos ⋮** (canto superior direito).
3. Toque em **"Instalar app"** (ou **"Adicionar à tela inicial"** → **Instalar**).
4. O ícone (três barrinhas coloridas) aparece junto dos seus apps.

**iPhone (Safari)**
1. Abra o endereço no **Safari** (tem que ser o Safari).
2. Toque em **Compartilhar** (quadrado com seta para cima, embaixo da tela).
3. Toque em **"Adicionar à Tela de Início"** → **Adicionar**.

## Como usar no dia a dia

- **⚡ Lançar**: escreva como no WhatsApp, por exemplo `saiu 30,00 almoço`, `entrou 450,00 Edgar` ou `saiu 542,00 Julio RDM oficina`.
  - Sem nada no final: *entrou* conta como Oficina, *saiu* como Pessoal, e *fornecedor* sempre como Oficina.
  - Dá para colar várias mensagens do WhatsApp de uma vez.
  - Toque num lançamento para corrigir. O app aprende com a correção.
- **📋 Resumo**: o resumo do mês, como na planilha (receitas e despesas fixas e variáveis, situação real, Oficina × Pessoal, onde foi o dinheiro). Tem um botão para mandar o resumo pelo WhatsApp.
- **📌 Fixas**: contas que se repetem todo mês. Toque em **A pagar** para marcar como paga.
- **📈 Histórico**: cada mês com entradas, saídas, resultado e acumulado. Os meses antigos da planilha podem ser digitados aqui.
- **☰ Mais**: Backup, Configurações e o "modo completo" (as telas detalhadas originais).

## Testar sem internet

1. Abra o app pelo ícone **uma vez com internet** e espere carregar.
2. Feche o app, ligue o **modo avião** e abra de novo pelo ícone.
3. Deve abrir normalmente. Desligue o modo avião depois.

## Seus dados

- Ficam **só no aparelho**. Não vão para o GitHub nem para a internet.
- Cada aparelho tem os seus próprios dados. Para passar de um aparelho para outro, use **☰ Mais → Backup** (exportar em um, importar no outro).
- Faça backup de vez em quando e guarde o arquivo no Google Drive, no WhatsApp ou num e-mail. Se trocar de celular, formatar o aparelho, desinstalar o app ou limpar os dados do navegador, os dados só voltam com o backup.

## Atualizar o app (no computador)

1. Faça a mudança nos arquivos (ou peça ao Claude).
2. Dê dois cliques em **`Enviar para o GitHub.bat`** e espere aparecer "Pronto!".
3. Em uns 2 minutos o celular mostra **"Nova versão disponível — toque para atualizar"**. Atualizar não apaga os dados.

Para quem mexe no código: a cada mudança, aumente o número em `CACHE_NAME` no arquivo `sw.js` (ex.: `-v2` → `-v3`) e, se criar arquivos novos, inclua-os na lista desse mesmo arquivo.

## Testar no computador

Dois cliques em **`Iniciar servidor.bat`** abre o app em http://localhost:8000/ (testes em http://localhost:8000/testes.html). Feche a janela preta para desligar.

## Se formatar o computador

O código está guardado no GitHub. Para recuperar:
1. Instale o Git de novo (https://git-scm.com/download/win, botão **Next** até o fim).
2. Baixe o projeto: na página do repositório no GitHub, botão verde **Code** → **Download ZIP**, ou peça ao Claude para "clonar o repositório ualanjp/controle-financeiro".
