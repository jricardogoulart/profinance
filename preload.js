const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("profinanceAPI", {
  // Contas
  listarContas: () => ipcRenderer.invoke("get-contas"),
  cadastrarConta: (conta) => ipcRenderer.invoke("add-conta", conta),
  excluirConta: (id) => ipcRenderer.invoke("delete-conta", id),
  atualizarConta: (conta) => ipcRenderer.invoke("update-conta", conta),

  // Transações
  listarTransacoes: (contaId) => ipcRenderer.invoke("get-transacoes", contaId),
  listarUltimasMovimentacoes: () => ipcRenderer.invoke("get-ultimas-movimentacoes"),
  addTransacao: (transacao) => ipcRenderer.invoke("add-transacao", transacao),
  excluirTransacao: (id) => ipcRenderer.invoke("delete-transacao", id),
  atualizarTransacao: (transacao) => ipcRenderer.invoke("update-transacao", transacao),
  queryTransacoes: (params) => ipcRenderer.invoke("query-transacoes", params),

  // Relatórios
  getSaldoConsolidado: () => ipcRenderer.invoke("get-saldo-consolidado"),

  // Backup
  fazerBackup: () => ipcRenderer.invoke("fazer-backup"),
  restaurarBackup: () => ipcRenderer.invoke("restaurar-backup")
});
