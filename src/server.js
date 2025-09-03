const path = require("path");
const Database = require("better-sqlite3");

// Conexão com o banco SQLite
const db = new Database(path.join(__dirname, "../profinance.db"));

// Criação das tabelas se não existirem
db.exec(`
  CREATE TABLE IF NOT EXISTS contas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    banco TEXT NOT NULL,
    numero TEXT NOT NULL,
    saldo_inicial REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS transacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conta_id INTEGER NOT NULL,
    titulo TEXT NOT NULL,
    data TEXT DEFAULT CURRENT_DATE,
    valor REAL NOT NULL,
    tipo TEXT CHECK(tipo IN ('credito', 'debito')) NOT NULL,
    descricao TEXT,
    FOREIGN KEY(conta_id) REFERENCES contas(id) ON DELETE CASCADE
  );
`);

module.exports = db;
