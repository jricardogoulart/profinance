// main.js
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const Decimal = require("decimal.js");

const dbPath = path.join(__dirname, "..", "profinance.db");
let db;

function openDatabase() {
  try {
    if (db) {
      try { db.close(); } catch (e) { console.warn("Erro fechando DB anterior:", e); }
    }
    db = new Database(dbPath);

    // Criação de tabelas com saldo/valor como TEXT para Decimal.js
    db.prepare(`
      CREATE TABLE IF NOT EXISTS contas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        banco TEXT NOT NULL,
        agencia TEXT NOT NULL,
        numero TEXT NOT NULL,
        saldo TEXT DEFAULT '0'
      )
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS transacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conta_id INTEGER,
        titulo TEXT,
        valor TEXT NOT NULL,
        tipo TEXT CHECK(tipo IN ('credito', 'debito')) NOT NULL,
        data TEXT,
        FOREIGN KEY (conta_id) REFERENCES contas(id) ON DELETE CASCADE
      )
    `).run();

  } catch (err) {
    console.error("Erro ao abrir banco:", err);
    throw err;
  }
}

// Inicializa banco
openDatabase();

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
// Helpers Decimal
//
function toDecimal(value) {
  return new Decimal(value || 0);
}

//
// IPC - CONTAS
//
ipcMain.handle("get-contas", async () => {
  return db.prepare("SELECT * FROM contas").all().map(c => ({
    ...c,
    saldo: c.saldo || "0"
  }));
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
    toDecimal(conta.saldo).toString()
  );
  if (mainWindow) mainWindow.webContents.send("contas-atualizadas");
  return { id: result.lastInsertRowid, ...conta };
});

ipcMain.handle("update-conta", async (_, conta) => {
  db.prepare(`
    UPDATE contas
    SET nome = ?, banco = ?, agencia = ?, numero = ?, saldo = ?
    WHERE id = ?
  `).run(
    conta.nome,
    conta.banco,
    conta.agencia,
    conta.numero,
    toDecimal(conta.saldo).toString(),
    conta.id
  );
  if (mainWindow) mainWindow.webContents.send("contas-atualizadas");
  return { success: true };
});

ipcMain.handle("delete-conta", async (_, id) => {
  db.prepare("DELETE FROM contas WHERE id = ?").run(id);
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
  `).all(contaId).map(t => ({ ...t, valor: t.valor || "0" }));
});

ipcMain.handle("get-ultimas-movimentacoes", async () => {
  return db.prepare(`
    SELECT t.id, t.data, t.titulo, t.tipo, t.valor, c.nome AS conta_nome
    FROM transacoes t
    JOIN contas c ON c.id = t.conta_id
    ORDER BY date(t.data) DESC, t.id DESC
    LIMIT 10
  `).all().map(t => ({ ...t, valor: t.valor || "0" }));
});

ipcMain.handle("add-transacao", async (_, transacao) => {
  const valorDecimal = toDecimal(transacao.valor);

  db.prepare(`
    INSERT INTO transacoes (conta_id, titulo, valor, tipo, data)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    transacao.conta_id,
    transacao.titulo,
    valorDecimal.toString(),
    transacao.tipo,
    transacao.data
  );

  const conta = db.prepare("SELECT saldo FROM contas WHERE id = ?").get(transacao.conta_id);
  const saldoAtual = toDecimal(conta.saldo);
  const novoSaldo = transacao.tipo === "credito"
    ? saldoAtual.plus(valorDecimal)
    : saldoAtual.minus(valorDecimal);

  db.prepare("UPDATE contas SET saldo = ? WHERE id = ?").run(novoSaldo.toString(), transacao.conta_id);

  if (mainWindow) mainWindow.webContents.send("contas-atualizadas");
  return { success: true };
});

ipcMain.handle("delete-transacao", async (_, id) => {
  const transacao = db.prepare("SELECT valor, tipo, conta_id FROM transacoes WHERE id = ?").get(id);
  if (transacao) {
    const valorDecimal = toDecimal(transacao.valor);
    const conta = db.prepare("SELECT saldo FROM contas WHERE id = ?").get(transacao.conta_id);
    const saldoAtual = toDecimal(conta.saldo);
    const novoSaldo = transacao.tipo === "credito"
      ? saldoAtual.minus(valorDecimal)
      : saldoAtual.plus(valorDecimal);
    db.prepare("UPDATE contas SET saldo = ? WHERE id = ?").run(novoSaldo.toString(), transacao.conta_id);
  }
  db.prepare("DELETE FROM transacoes WHERE id = ?").run(id);
  if (mainWindow) mainWindow.webContents.send("contas-atualizadas");
  return { success: true };
});

ipcMain.handle("update-transacao", async (_, transacao) => {
  const old = db.prepare("SELECT valor, tipo, conta_id FROM transacoes WHERE id = ?").get(transacao.id);
  if (!old) return { success: false, message: "Transação não encontrada" };

  const oldValor = toDecimal(old.valor);
  const contaOld = db.prepare("SELECT saldo FROM contas WHERE id = ?").get(old.conta_id);
  const saldoAtualOld = toDecimal(contaOld.saldo);
  const saldoAjustado = old.tipo === "credito"
    ? saldoAtualOld.minus(oldValor)
    : saldoAtualOld.plus(oldValor);
  db.prepare("UPDATE contas SET saldo = ? WHERE id = ?").run(saldoAjustado.toString(), old.conta_id);

  const novoValor = toDecimal(transacao.valor);
  db.prepare(`
    UPDATE transacoes
    SET titulo = ?, valor = ?, tipo = ?, data = ?, conta_id = ?
    WHERE id = ?
  `).run(transacao.titulo, novoValor.toString(), transacao.tipo, transacao.data, transacao.conta_id, transacao.id);

  const contaNovo = db.prepare("SELECT saldo FROM contas WHERE id = ?").get(transacao.conta_id);
  const saldoAtualNovo = toDecimal(contaNovo.saldo);
  const saldoFinal = transacao.tipo === "credito"
    ? saldoAtualNovo.plus(novoValor)
    : saldoAtualNovo.minus(novoValor);
  db.prepare("UPDATE contas SET saldo = ? WHERE id = ?").run(saldoFinal.toString(), transacao.conta_id);

  if (mainWindow) mainWindow.webContents.send("contas-atualizadas");
  return { success: true };
});

ipcMain.handle("query-transacoes", async (_, params = {}) => {
  const { contaId, tipo, inicio, fim } = params;
  let where = [];
  let args = [];

  if (contaId) { where.push("t.conta_id = ?"); args.push(contaId); }
  if (tipo && (tipo === "credito" || tipo === "debito")) { where.push("t.tipo = ?"); args.push(tipo); }
  if (inicio) { where.push("date(t.data) >= date(?)"); args.push(inicio); }
  if (fim) { where.push("date(t.data) <= date(?)"); args.push(fim); }

  const whereSQL = where.length ? "WHERE " + where.join(" AND ") : "";
  const sql = `
    SELECT t.*, c.nome AS conta_nome
    FROM transacoes t
    JOIN contas c ON c.id = t.conta_id
    ${whereSQL}
    ORDER BY date(t.data) ASC
  `;

  return db.prepare(sql).all(...args).map(t => ({ ...t, valor: t.valor || "0" }));
});

ipcMain.handle("get-saldo-consolidado", async () => {
  try {
    const rows = db.prepare("SELECT tipo, valor FROM transacoes").all();
    let saldoTotal = new Decimal(0);
    for (const t of rows) {
      const valor = toDecimal(t.valor);
      saldoTotal = t.tipo === "credito" ? saldoTotal.plus(valor) : saldoTotal.minus(valor);
    }
    return saldoTotal.toString();
  } catch (error) {
    console.error("Erro ao calcular saldo consolidado:", error);
    return "0";
  }
});

ipcMain.handle("fazer-backup", async () => {
  const pastaBackup = await dialog.showOpenDialog({
    title: "Selecione a pasta para salvar o backup",
    properties: ["openDirectory"]
  });

  if (pastaBackup.canceled) return null;

  const backupFolder = pastaBackup.filePaths[0];
  const backupFileName = `profinance_backup_${Date.now()}.db`;
  const backupPath = path.join(backupFolder, backupFileName);

  fs.copyFileSync(dbPath, backupPath);

  return { fullPath: backupPath, fileName: backupFileName };
});

ipcMain.handle("restaurar-backup", async () => {
  const arquivoBackup = await dialog.showOpenDialog({
    title: "Selecione o arquivo de backup para restaurar",
    properties: ["openFile"],
    filters: [{ name: "Banco de Dados", extensions: ["db"] }]
  });

  if (arquivoBackup.canceled) return null;

  const backupPath = arquivoBackup.filePaths[0];

  // Sobrescreve o banco atual com o backup
  fs.copyFileSync(backupPath, dbPath);

  return { fullPath: backupPath, fileName: path.basename(backupPath) };
});
