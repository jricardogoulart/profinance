const express = require("express");
const cors = require("cors");
const db = require("./database");

const app = express();
app.use(cors());
app.use(express.json());

// Rotas de Contas
app.get("/contas", (req, res) => {
  const contas = db.prepare("SELECT * FROM contas").all();
  res.json(contas);
});

app.post("/contas", (req, res) => {
  const { nome, banco, agencia, numero, saldo_inicial } = req.body;
  const stmt = db.prepare(`
    INSERT INTO contas (nome, banco, agencia, numero, saldo_inicial)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(nome, banco, agencia, numero, saldo_inicial);
  res.json({ id: result.lastInsertRowid });
});

// Rotas de Transações
app.get("/transacoes/:conta_id", (req, res) => {
  const { conta_id } = req.params;
  const transacoes = db.prepare(`
    SELECT * FROM transacoes WHERE conta_id = ?
  `).all(conta_id);
  res.json(transacoes);
});

app.post("/transacoes", (req, res) => {
  const { conta_id, titulo, data, valor, tipo } = req.body;
  const stmt = db.prepare(`
    INSERT INTO transacoes (conta_id, titulo, data, valor, tipo)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(conta_id, titulo, data, valor, tipo);
  res.json({ id: result.lastInsertRowid });
});

app.listen(3000, () => console.log("Servidor rodando na porta 3000 🚀"));
