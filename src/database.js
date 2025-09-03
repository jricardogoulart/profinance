// src/database.js
const Database = require("better-sqlite3");

// Cria/conecta ao banco local
const db = new Database("profinance.db");

// Criação das tabelas, se não existirem
db.prepare(`
  CREATE TABLE IF NOT EXISTS contas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    banco TEXT NOT NULL,
    agencia TEXT NOT NULL,
    numero TEXT NOT NULL,
    saldo_inicial REAL DEFAULT 0
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS transacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conta_id INTEGER NOT NULL,
    titulo TEXT NOT NULL,
    valor REAL NOT NULL,
    tipo TEXT CHECK(tipo IN ('credito','debito')) NOT NULL,
    data TEXT NOT NULL,
    descricao TEXT,
    FOREIGN KEY (conta_id) REFERENCES contas(id) ON DELETE CASCADE
  )
`).run();


module.exports = db;
