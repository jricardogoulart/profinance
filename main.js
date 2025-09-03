const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const Database = require("better-sqlite3");

// Caminho do banco de dados
const dbPath = path.join(__dirname, "..", "profinance.db");
const db = new Database(dbPath);

// Criação da janela principal
let mainWindow;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "src/preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer/dashboard.html"));
  mainWindow.on("closed", () => (mainWindow = null));
}

// Inicializa o app
app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Fecha o app quando todas as janelas são fechadas
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

//
// 📌 Rotas do banco via IPC
//

// Criar tabela de contas se não existir
db.prepare(`
  CREATE TABLE IF NOT EXISTS contas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    banco TEXT NOT NULL,
    agencia TEXT NOT NULL,
    numero TEXT NOT NULL,
    saldo REAL DEFAULT 0
  )
`).run();

// Criar tabela de transações se não existir
db.prepare(`
  CREATE TABLE IF NOT EXISTS transacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conta_id INTEGER,
    titulo TEXT,
    valor REAL,
    tipo TEXT,
    data TEXT,
    FOREIGN KEY (conta_id) REFERENCES contas (id)
  )
`).run();

//
// 📌 Funções IPC para contas
//

// Obter todas as contas
ipcMain.handle("get-contas", async () => {
  return db.prepare("SELECT * FROM contas").all();
});

// Criar nova conta
ipcMain.handle("add-conta", async (_, conta) => {
  const stmt = db.prepare(`
    INSERT INTO contas (nome, banco, agencia, numero, saldo)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(conta.nome, conta.banco, conta.agencia, conta.numero, conta.saldo || 0);
  return { id: result.lastInsertRowid, ...conta };
});

// Excluir conta
ipcMain.handle("delete-conta", async (_, id) => {
  db.prepare("DELETE FROM contas WHERE id = ?").run(id);
  return { success: true };
});

//
// 📌 Funções IPC para transações
//

// Obter transações por conta
ipcMain.handle("get-transacoes", async (_, contaId) => {
  return db.prepare("SELECT * FROM transacoes WHERE conta_id = ? ORDER BY data DESC").all(contaId);
});

// Adicionar transação
ipcMain.handle("add-transacao", async (_, transacao) => {
  const stmt = db.prepare(`
    INSERT INTO transacoes (conta_id, titulo, valor, tipo, data)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(transacao.conta_id, transacao.titulo, transacao.valor, transacao.tipo, transacao.data);
  db.prepare("UPDATE contas SET saldo = saldo + ? WHERE id = ?").run(
    transacao.tipo === "credito" ? transacao.valor : -transacao.valor,
    transacao.conta_id
  );
  return { success: true };
});
