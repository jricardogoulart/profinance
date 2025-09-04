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

  // Saldo consolidado calculado
  getSaldoConsolidado: () => ipcRenderer.invoke("get-saldo-consolidado"),

  // Eventos
  onContasAtualizadas: (callback) => ipcRenderer.on("contas-atualizadas", callback)
});

contextBridge.exposeInMainWorld("config", {
  getConfig: () => ipcRenderer.invoke("get-config"),
  setConfig: (config) => ipcRenderer.invoke("set-config", config),
});
