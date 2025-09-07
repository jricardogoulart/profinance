// main.js
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

// Caminho do banco de dados
const dbPath = path.join(__dirname, "..", "profinance.db");
let db;

// Função para abrir (ou reabrir) a conexão com o DB
function openDatabase() {
  try {
    if (db) {
      try { db.close(); } catch (e) { console.warn("Erro fechando DB anterior:", e); }
    }
    db = new Database(dbPath);
  } catch (err) {
    console.error("Erro ao abrir banco:", err);
    throw err;
  }
}

// Inicializa o DB (abre e cria tabelas se não existirem)
openDatabase();

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

db.prepare(`
  CREATE TABLE IF NOT EXISTS transacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conta_id INTEGER,
    titulo TEXT,
    valor REAL,
    tipo TEXT CHECK(tipo IN ('credito', 'debito')) NOT NULL,
    data TEXT,
    FOREIGN KEY (conta_id) REFERENCES contas (id) ON DELETE CASCADE
  )
`).run();

let mainWindow;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, "renderer/assets/", "profinanceicon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),  
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer/dashboard.html"));
  mainWindow.on("closed", () => (mainWindow = null));
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

//
// IPC - CONTAS
//
ipcMain.handle("get-contas", async () => {
  return db.prepare("SELECT * FROM contas").all();
});

ipcMain.handle("add-conta", async (_, conta) => {
  const stmt = db.prepare(`
    INSERT INTO contas (nome, banco, agencia, numero, saldo)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    conta.nome,
    conta.banco,
    conta.agencia,
    conta.numero,
    conta.saldo || 0
  );
  // opcional: notificar renderer
  if (mainWindow) mainWindow.webContents.send("contas-atualizadas");
  return { id: result.lastInsertRowid, ...conta };
});

ipcMain.handle("delete-conta", async (_, id) => {
  db.prepare("DELETE FROM contas WHERE id = ?").run(id);
  if (mainWindow) mainWindow.webContents.send("contas-atualizadas");
  return { success: true };
});

ipcMain.handle("update-conta", async (_, conta) => {
  const stmt = db.prepare(`
    UPDATE contas
    SET nome = ?, banco = ?, agencia = ?, numero = ?, saldo = ?
    WHERE id = ?
  `);
  stmt.run(conta.nome, conta.banco, conta.agencia, conta.numero, conta.saldo, conta.id);
  if (mainWindow) mainWindow.webContents.send("contas-atualizadas");
  return { success: true };
});

//
// IPC - TRANSAÇÕES
//
ipcMain.handle("get-transacoes", async (_, contaId) => {
  return db.prepare(`
    SELECT t.*, c.nome AS conta_nome
    FROM transacoes t
    JOIN contas c ON c.id = t.conta_id
    WHERE t.conta_id = ?
    ORDER BY date(t.data) DESC
  `).all(contaId);
});

ipcMain.handle("get-ultimas-movimentacoes", async () => {
  return db.prepare(`
    SELECT t.id, t.data, t.titulo, t.tipo, t.valor, c.nome AS conta_nome
    FROM transacoes t
    JOIN contas c ON c.id = t.conta_id
    ORDER BY date(t.data) DESC, t.id DESC
    LIMIT 10
  `).all();
});

ipcMain.handle("add-transacao", async (_, transacao) => {
  const stmt = db.prepare(`
    INSERT INTO transacoes (conta_id, titulo, valor, tipo, data)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(
    transacao.conta_id,
    transacao.titulo,
    transacao.valor,
    transacao.tipo,
    transacao.data
  );

  // Atualiza saldo da conta
  db.prepare("UPDATE contas SET saldo = saldo + ? WHERE id = ?").run(
    transacao.tipo === "credito" ? transacao.valor : -transacao.valor,
    transacao.conta_id
  );

  if (mainWindow) mainWindow.webContents.send("contas-atualizadas");
  return { success: true };
});

ipcMain.handle("delete-transacao", async (_, id) => {
  const transacao = db.prepare("SELECT valor, tipo, conta_id FROM transacoes WHERE id = ?").get(id);

  if (transacao) {
    const delta = transacao.tipo === "credito" ? -transacao.valor : transacao.valor;
    db.prepare("UPDATE contas SET saldo = saldo + ? WHERE id = ?").run(delta, transacao.conta_id);
  }

  db.prepare("DELETE FROM transacoes WHERE id = ?").run(id);
  if (mainWindow) mainWindow.webContents.send("contas-atualizadas");
  return { success: true };
});

ipcMain.handle("update-transacao", async (_, transacao) => {
  const old = db.prepare("SELECT valor, tipo, conta_id FROM transacoes WHERE id = ?").get(transacao.id);
  if (!old) return { success: false, message: "Transação não encontrada" };

  const deltaAnterior = old.tipo === "credito" ? -old.valor : old.valor;
  db.prepare("UPDATE contas SET saldo = saldo + ? WHERE id = ?").run(deltaAnterior, old.conta_id);

  db.prepare(`
    UPDATE transacoes
    SET titulo = ?, valor = ?, tipo = ?, data = ?, conta_id = ?
    WHERE id = ?
  `).run(transacao.titulo, transacao.valor, transacao.tipo, transacao.data, transacao.conta_id, transacao.id);

  const deltaNovo = transacao.tipo === "credito" ? transacao.valor : -transacao.valor;
  db.prepare("UPDATE contas SET saldo = saldo + ? WHERE id = ?").run(deltaNovo, transacao.conta_id);

  if (mainWindow) mainWindow.webContents.send("contas-atualizadas");
  return { success: true };
});

// Query com filtros (usado por transacoes.html / relatorios.html)
ipcMain.handle("query-transacoes", async (_, params = {}) => {
  const { contaId, tipo, inicio, fim } = params;
  let where = [];
  let args = [];

  if (contaId) {
    where.push("t.conta_id = ?");
    args.push(contaId);
  }
  if (tipo && (tipo === "credito" || tipo === "debito")) {
    where.push("t.tipo = ?");
    args.push(tipo);
  }
  if (inicio) {
    where.push("date(t.data) >= date(?)");
    args.push(inicio);
  }
  if (fim) {
    where.push("date(t.data) <= date(?)");
    args.push(fim);
  }

  const whereSQL = where.length ? "WHERE " + where.join(" AND ") : "";
  const sql = `
    SELECT t.*, c.nome AS conta_nome
    FROM transacoes t
    JOIN contas c ON c.id = t.conta_id
    ${whereSQL}
    ORDER BY date(t.data) ASC
  `;

  return db.prepare(sql).all(...args);
});

ipcMain.handle("get-saldo-consolidado", async () => {
  try {
    const row = db.prepare(`
      SELECT
        IFNULL(SUM(CASE WHEN tipo = 'credito' THEN valor ELSE -valor END), 0) AS saldo_total
      FROM transacoes
    `).get();

    return row.saldo_total || 0;
  } catch (error) {
    console.error("Erro ao calcular saldo consolidado:", error);
    return 0;
  }
});

//
// Backup / Restauração
//
ipcMain.handle("fazer-backup", async () => {
  try {
    const backupsDir = path.join(__dirname, "..", "backups");
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const dest = path.join(backupsDir, `profinance-backup-${timestamp}.db`);
    await fs.promises.copyFile(dbPath, dest);
    return { success: true, path: dest };
  } catch (err) {
    console.error("Erro ao fazer backup:", err);
    return { success: false, message: err.message || String(err) };
  }
});

ipcMain.handle("restaurar-backup", async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Selecionar arquivo de backup",
      buttonLabel: "Restaurar",
      properties: ["openFile"],
      filters: [
        { name: "Backups", extensions: ["db", "sqlite", "sqlite3"] },
        { name: "Todos", extensions: ["*"] }
      ]
    });

    if (result.canceled || !result.filePaths.length) {
      return { success: false, message: "Operação cancelada." };
    }

    const filePath = result.filePaths[0];

    // Fechar DB atual, substituir arquivo e reabrir
    try { if (db) db.close(); } catch (e) { console.warn("Erro fechando DB:", e); }

    await fs.promises.copyFile(filePath, dbPath);

    // Reabrir DB
    openDatabase();

    // Notifica renderers para recarregarem dados
    if (mainWindow) {
      mainWindow.webContents.send("contas-atualizadas");
    }

    return { success: true, path: filePath };
  } catch (err) {
    console.error("Erro ao restaurar backup:", err);
    return { success: false, message: err.message || String(err) };
  }
});
