// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("profinanceAPI", {
  // Contas
  listarContas: () => ipcRenderer.invoke("get-contas"),
  cadastrarConta: (conta) => ipcRenderer.invoke("add-conta", conta),
  excluirConta: (id) => ipcRenderer.invoke("delete-conta", id),

  // Transações
  listarMovimentacoes: (contaId) => ipcRenderer.invoke("get-transacoes", contaId),
  addTransacao: (transacao) => ipcRenderer.invoke("add-transacao", transacao),

  // Eventos em tempo real (opcional)
  onContasAtualizadas: (callback) => {
    ipcRenderer.on("contas-atualizadas", callback);
  }
});

contextBridge.exposeInMainWorld("config", {
  getConfig: () => ipcRenderer.invoke("get-config"),
  setConfig: (config) => ipcRenderer.invoke("set-config", config),
});
