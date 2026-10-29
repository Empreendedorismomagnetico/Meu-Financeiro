# Meu Financeiro

Primeira versão Android com React Native + Expo SDK 54.

## Funcionalidades
- Adicionar contas com nome, valor em reais e data.
- Formatação automática de moeda brasileira.
- Total das contas atualizado automaticamente.
- Tocar em uma conta para editar.
- Excluir pelo menu de três pontos dentro da edição, com confirmação.
- Finalizar a lista com confirmação.
- Salvar a lista ativa e as listas finalizadas localmente no aparelho.
- GitHub Actions para gerar o APK Android.

## Arquivos
- `App.js`: tela e funcionalidades.
- `app.json`: configuração Expo/Android.
- `package.json`: dependências.
- `assets/`: ícones.
- `.github/workflows/android-apk.yml`: geração automática do APK.

## Envio ao GitHub pelo celular
Envie todos os arquivos mantendo os caminhos. `App.js`, `app.json` e `package.json` ficam na raiz. A automação deve ficar exatamente em `.github/workflows/android-apk.yml`.

Se não conseguir enviar pastas pelo navegador, crie o arquivo informando o caminho completo como nome, por exemplo `.github/workflows/android-apk.yml`.

Depois do commit, abra **Actions**, aguarde o fluxo **Gerar APK Android**, entre na execução concluída e baixe o artefato `meu-financeiro-apk`.

## Observações
Os dados ficam no próprio aparelho e não sincronizam entre dispositivos. As listas finalizadas já são preservadas localmente, mas a tela Histórico será adicionada em uma próxima etapa. Esta versão inicial contém somente a tela Contas; Receita, Dashboard e Histórico virão depois.
