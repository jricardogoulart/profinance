const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("profinanceAPI", {
  // Contas
  listarContas: () => ipcRenderer.invoke("get-contas"),
  cadastrarConta: (conta) => ipcRenderer.invoke("add-conta", conta),
  excluirConta: (id) => ipcRenderer.invoke("delete-conta", id),
  atualizarConta: (conta) => ipcRenderer.invoke("update-conta", conta),

  // Transações
  listarMovimentacoes: (contaId) => ipcRenderer.invoke("get-transacoes", contaId),
  queryTransacoes: (params) => ipcRenderer.invoke("query-transacoes", params),
  listarUltimasMovimentacoes: () => ipcRenderer.invoke("get-ultimas-movimentacoes"),
  addTransacao: (transacao) => ipcRenderer.invoke("add-transacao", transacao),
  excluirTransacao: (id) => ipcRenderer.invoke("delete-transacao", id),
  atualizarTransacao: (transacao) => ipcRenderer.invoke("update-transacao", transacao),

  // Saldo consolidado
  getSaldoConsolidado: () => ipcRenderer.invoke("get-saldo-consolidado"),

  // Configurações
  getConfig: () => ipcRenderer.invoke("get-config"),
  setConfig: (config) => ipcRenderer.invoke("set-config", config),

  // Eventos
  onContasAtualizadas: (callback) => ipcRenderer.on("contas-atualizadas", callback),

  //  Backup
  criarBackup: () => ipcRenderer.invoke("backup-criar"),
  restaurarBackup: (caminho) => ipcRenderer.invoke("backup-restaurar", caminho),
  selecionarBackup: () => ipcRenderer.invoke("backup-selecionar"),
  fazerBackup: () => ipcRenderer.invoke("fazer-backup"),
restaurarBackup: () => ipcRenderer.invoke("restaurar-backup"),

}); 
