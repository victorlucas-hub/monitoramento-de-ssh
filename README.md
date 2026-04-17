# Monitoramento SSH

Dashboard web para monitorar a disponibilidade de dispositivos de rede em tempo real — PABXs, impressoras, servidores e qualquer equipamento acessivel por TCP.

O servidor testa periodicamente se cada alvo (IP + porta) esta respondendo e exibe o resultado em um painel visual com graficos de tempo de resposta, historico de disponibilidade e contagem de alvos online/offline. Quando um dispositivo cai ou se recupera, o sistema pode enviar alertas automaticos via **Telegram** ou **WhatsApp**.

### Principais funcionalidades

- Monitoramento simultaneo de multiplos alvos via conexao TCP (SSH, HTTP, Telnet etc.)
- Dashboard atualizado automaticamente no navegador
- Graficos de tempo de resposta e historico de disponibilidade
- Adicao, edicao e remocao de alvos diretamente pelo painel web
- Alertas de OFFLINE e RECUPERADO via Telegram e/ou WhatsApp
- Configuracao simples via arquivo `targets.json`

## Como executar

1. Abra o terminal na pasta do projeto.
2. Execute:

```powershell
powershell -ExecutionPolicy Bypass -File .\server.ps1
```

3. Abra no navegador:

- `http://localhost:3000`
- `http://localhost:3000/index`

## Como adicionar outros IPs e portas

Edite o arquivo `targets.json` na raiz do projeto.

Exemplo:

```json
[
  { "name": "Central PABX", "host": "10.119.8.1", "port": 22 },
  { "name": "Servidor Linux", "host": "10.119.8.2", "port": 22 },
  { "name": "Firewall SSH", "host": "10.119.8.254", "port": 2222 }
]
```

Campos:

- `name`: nome exibido na tela.
- `host`: IP ou HOST
- `port`: porta TCP para testar (nao precisa ser so 22).

Depois de salvar o `targets.json`, reinicie o servidor para aplicar:

```powershell
Ctrl + C
powershell -ExecutionPolicy Bypass -File .\server.ps1
```

## Atalho de inicializacao

- `iniciar-monitoramento.bat` (duplo clique)
- ou `powershell -ExecutionPolicy Bypass -File .\iniciar-monitoramento.ps1`

## Alertas no celular

Voce pode receber alerta de OFFLINE e RECUPERADO no celular.

### Opcao 1. Telegram (gratuito)

#### 1. Criar bot no Telegram

1. Abra o Telegram e procure por `@BotFather`.
2. Envie `/newbot` e siga as instrucoes.
3. Ao final, copie o token do bot.

#### 2. Descobrir seu chat id

1. Abra o chat com o seu bot e envie qualquer mensagem (exemplo: `oi`).
2. No navegador, abra:

```text
https://api.telegram.org/botSEU_TOKEN/getUpdates
```

3. No JSON de retorno, copie o valor de `chat.id`.

#### 3. Configurar variaveis de ambiente (PowerShell)

No mesmo terminal em que vai iniciar o servidor:

```powershell
$env:SSH_MONITOR_TELEGRAM_BOT_TOKEN = "SEU_TOKEN"
$env:SSH_MONITOR_TELEGRAM_CHAT_ID = "SEU_CHAT_ID"
powershell -ExecutionPolicy Bypass -File .\server.ps1
```

Para enviar para duas (ou mais) pessoas ao mesmo tempo, use `SSH_MONITOR_TELEGRAM_CHAT_IDS`:

```powershell
$env:SSH_MONITOR_TELEGRAM_BOT_TOKEN = "SEU_TOKEN"
$env:SSH_MONITOR_TELEGRAM_CHAT_IDS = "CHAT_ID_1,CHAT_ID_2"
powershell -ExecutionPolicy Bypass -File .\server.ps1 -WebPort 3001
```

Quando iniciar, o servidor mostra se Telegram esta `ATIVADO`.

### Opcao 2. WhatsApp via CallMeBot

Esse caminho e o mais simples para receber no seu proprio WhatsApp sem precisar montar conta Business.

#### 1. Ativar sua chave no CallMeBot

1. Adicione o numero `+34 623 78 95 80` nos seus contatos.
2. Envie no WhatsApp a mensagem `I allow callmebot to send me messages` para esse contato.
3. Aguarde a resposta com sua `APIKEY`.

#### 2. Configurar variaveis de ambiente (PowerShell)

No mesmo terminal em que vai iniciar o servidor:

```powershell
$env:SSH_MONITOR_WHATSAPP_API_KEY = "SUA_API_KEY"
$env:SSH_MONITOR_WHATSAPP_PHONE = "+5599999999999"
powershell -ExecutionPolicy Bypass -File .\server.ps1
```

Para enviar para mais de um numero:

```powershell
$env:SSH_MONITOR_WHATSAPP_API_KEY = "SUA_API_KEY"
$env:SSH_MONITOR_WHATSAPP_PHONES = "+5599999999999,+5588888888888"
powershell -ExecutionPolicy Bypass -File .\server.ps1
```

Use o numero com codigo do pais, por exemplo `+55DDDNUMERO`.

#### 3. Como os alertas funcionam

- Envia mensagem quando um alvo muda para OFFLINE.
- Envia mensagem quando o alvo volta (RECUPERADO).
- Nao repete alerta toda checagem se o estado nao mudou.

Quando iniciar, o servidor mostra se Telegram e WhatsApp estao `ATIVADOS`.

No painel web, use o botao `Enviar teste WhatsApp/Telegram` para validar o recebimento sem precisar derrubar um IP.

#### Observacao sobre WhatsApp

- O CallMeBot e pratico para uso pessoal, mas nao e o provedor oficial do WhatsApp.
- Se depois voce quiser algo corporativo, o caminho certo e Twilio ou Meta WhatsApp Cloud API.

## Observacoes

- `localhost:3000` funciona apenas na sua maquina.
- Para outros computadores da rede acessarem, sera necessario abrir o servidor para o IP da rede e liberar
