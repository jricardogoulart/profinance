const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const Decimal = require("decimal.js");

const dbPath = path.join(__dirname, "..", "profinance.db");
let db;

function openDatabase() {
  try {
    if (db) try { db.close(); } catch (e) { console.warn("Erro fechando DB anterior:", e); }
    db = new Database(dbPath);
  } catch (err) {
    console.error("Erro ao abrir banco:", err);
    throw err;
  }
}

openDatabase();

// Criação das tabelas em centavos
db.prepare(`
  CREATE TABLE IF NOT EXISTS contas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    banco TEXT NOT NULL,
    agencia TEXT NOT NULL,
    numero TEXT NOT NULL,
    saldo INTEGER DEFAULT 0 -- centavos
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS transacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conta_id INTEGER,
    titulo TEXT,
    valor INTEGER NOT NULL, -- centavos
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

// Helpers de conversão
function toCents(value) { return Math.round(new Decimal(value || 0).times(100).toNumber()); }
function fromCents(value) { return new Decimal(value || 0).div(100).toNumber(); }

// =================== BACKUP / RESTAURAÇÃO ===================

// Cria pasta de backups se não existir
const backupDir = path.join(__dirname, "..", "backups");
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

// Fazer backup
ipcMain.handle("fazer-backup", async () => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(backupDir, `profinance-backup-${timestamp}.db`);
    fs.copyFileSync(dbPath, backupPath);
    return backupPath;
  } catch (err) {
    console.error("Erro ao fazer backup:", err);
    throw err;
  }
});

// Restaurar backup (último backup)
ipcMain.handle("restaurar-backup", async () => {
  try {
    const arquivos = fs.readdirSync(backupDir)
      .filter(f => f.endsWith(".db"))
      .map(f => ({ f, time: fs.statSync(path.join(backupDir, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    if (!arquivos.length) return false;

    const ultimoBackup = path.join(backupDir, arquivos[0].f);
    fs.copyFileSync(ultimoBackup, dbPath);

    return true;
  } catch (err) {
    console.error("Erro ao restaurar backup:", err);
    throw err;
  }
});