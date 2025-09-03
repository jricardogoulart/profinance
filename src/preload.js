const { contextBridge } = require("electron");

const API_URL = "http://localhost:3001"; // Nosso backend local

contextBridge.exposeInMainWorld("profinanceAPI", {
  // ========================
  // CONTAS
  // ========================

  listarContas: async () => {
    const res = await fetch(`${API_URL}/contas`);
    return res.json();
  },

  criarConta: async (dados) => {
    const res = await fetch(`${API_URL}/contas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados)
    });
    return res.json();
  },

  atualizarConta: async (id, dados) => {
    const res = await fetch(`${API_URL}/contas/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados)
    });
    return res.json();
  },

  excluirConta: async (id) => {
    const res = await fetch(`${API_URL}/contas/${id}`, {
      method: "DELETE"
    });
    return res.json();
  },

  // ========================
  // TRANSAÇÕES
  // ========================

  listarTransacoes: async (contaId) => {
    const res = await fetch(`${API_URL}/transacoes/${contaId}`);
    return res.json();
  },

  criarTransacao: async (dados) => {
    const res = await fetch(`${API_URL}/transacoes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados)
    });
    return res.json();
  },

  excluirTransacao: async (id) => {
    const res = await fetch(`${API_URL}/transacoes/${id}`, {
      method: "DELETE"
    });
    return res.json();
  }
});
