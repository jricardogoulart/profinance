const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const contasModel = require("./models/contasModel");
const transacoesModel = require("./models/transacoesModel");

const app = express();
const PORT = 3001;

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// =========================
// ROTAS DE CONTAS
// =========================

// Listar todas as contas
app.get("/contas", (req, res) => {
  try {
    const contas = contasModel.listar();
    res.json(contas);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar contas" });
  }
});

// Criar conta
app.post("/contas", (req, res) => {
  try {
    const result = contasModel.criar(req.body);
    res.json({ message: "Conta criada com sucesso", id: result.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ error: "Erro ao criar conta" });
  }
});

// Atualizar conta
app.put("/contas/:id", (req, res) => {
  try {
    contasModel.atualizar(req.params.id, req.body);
    res.json({ message: "Conta atualizada com sucesso" });
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar conta" });
  }
});

// Excluir conta
app.delete("/contas/:id", (req, res) => {
  try {
    contasModel.excluir(req.params.id);
    res.json({ message: "Conta excluída com sucesso" });
  } catch (error) {
    res.status(500).json({ error: "Erro ao excluir conta" });
  }
});

// =========================
// ROTAS DE TRANSAÇÕES
// =========================

// Listar transações de uma conta
app.get("/transacoes/:contaId", (req, res) => {
  try {
    const transacoes = transacoesModel.listarPorConta(req.params.contaId);
    res.json(transacoes);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar transações" });
  }
});

// Criar transação
app.post("/transacoes", (req, res) => {
  try {
    const result = transacoesModel.criar(req.body);
    res.json({ message: "Transação criada com sucesso", id: result.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ error: "Erro ao criar transação" });
  }
});

// Excluir transação
app.delete("/transacoes/:id", (req, res) => {
  try {
    transacoesModel.excluir(req.params.id);
    res.json({ message: "Transação excluída com sucesso" });
  } catch (error) {
    res.status(500).json({ error: "Erro ao excluir transação" });
  }
});

// =========================
// INICIAR SERVIDOR
// =========================
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
