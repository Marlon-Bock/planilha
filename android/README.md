# App Android (APK / AAB) via TWA

O APK é uma **Trusted Web Activity**: um app Android nativo que abre o PWA da
Planilha em tela cheia, sem barra de endereço. Por isso as atualizações do
sistema chegam ao app na hora, sem publicar um APK novo.

## Pré-requisitos

1. **O sistema publicado num domínio com HTTPS** (ex.: `https://planilha.seudominio.com.br`).
   O APK aponta para esse endereço. `localhost` não funciona.
2. Node 20+. O Bubblewrap baixa o **JDK 17** e o **Android SDK** sozinho na primeira execução (~1 GB).

## Opção A: PWABuilder (mais fácil, sem instalar nada)

1. Acesse https://www.pwabuilder.com e cole a URL do sistema publicado.
2. Clique em **Package for stores → Android** e baixe o pacote.
   Ele traz o `.apk` (instalar direto), o `.aab` (Play Store), a chave de assinatura
   e um `assetlinks.json` com a impressão digital (SHA-256).
3. Siga o passo **"Ligar o app ao site"** abaixo, usando o SHA-256 que veio no pacote.

> No mesmo site dá para gerar o pacote **Windows (MSIX)** para a Microsoft Store.

## Opção B: Bubblewrap (linha de comando, nesta pasta)

1. Em `twa-manifest.json`, troque `planilha.seudominio.com.br` pelo seu domínio e
   `br.com.seudominio.planilha` pelo identificador do app (formato de domínio invertido).
   **O identificador não pode mudar depois de publicado.**
2. Gere o projeto Android e o APK:

   ```bash
   cd android
   npx @bubblewrap/cli update      # cria o projeto Android a partir do twa-manifest.json
   npx @bubblewrap/cli build       # na primeira vez, cria a chave planilha-release.keystore (guarde a senha!)
   ```

   Saem dois arquivos:
   - `app-release-signed.apk`: para instalar direto no celular (envie o arquivo e abra).
   - `app-release-bundle.aab`: para enviar à Google Play.
3. Pegue a impressão digital da chave:

   ```bash
   npx @bubblewrap/cli fingerprint list
   ```

## Ligar o app ao site (obrigatório para abrir sem barra de endereço)

No servidor do **frontend** (Next.js), configure as variáveis e reinicie:

```env
TWA_PACKAGE_NAME=br.com.seudominio.planilha
TWA_SHA256_FINGERPRINTS=AA:BB:CC:...      # se publicar na Play Store, adicione também a chave dela, separada por vírgula
```

Confira em `https://seu-dominio/.well-known/assetlinks.json`; deve aparecer o pacote e o SHA-256.

Se publicar na **Play Store** com "Assinatura de apps pelo Google Play", copie também o
SHA-256 em *Play Console → Configuração → Integridade do app* e adicione nessa variável.

## Atualizações

- Mudanças no sistema (telas, funcionalidades) **não exigem APK novo**: o app carrega o site.
- Só gere um APK novo para trocar nome, ícone, cores ou domínio. Antes, aumente
  `appVersionCode` (e `appVersionName`) no `twa-manifest.json`.

## Segurança

- **Nunca** coloque `planilha-release.keystore` no git (já está no `.gitignore`) e guarde a senha.
  Sem essa chave, não dá para atualizar o app na Play Store.
