# Monitoramento SSH

Projeto para monitorar varios alvos SSH (IP + porta) ao mesmo tempo, com dashboard web em tempo real.

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

## Observacoes

- `localhost:3000` funciona apenas na sua maquina.
- Para outros computadores da rede acessarem, sera necessario abrir o servidor para o IP da rede e liberar firewall.
