// ============================================================
// 📌 ProFinance - Main Process
// ============================================================

const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const Database = require("better-sqlite3");
const Decimal = require("decimal.js");

// ============================================================
// 📌 Configuração do Banco de Dados
// ============================================================
const dbPath = path.join(__dirname, "profinance.db");
const db = new Database(dbPath);

// ============================================================
// 📌 Criação da Janela Principal
// ============================================================
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "ProFinance",
    icon: path.join(__dirname, "renderer/assets/profinanceicon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"), // <-- Corrigido
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer/dashboard.html"));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ============================================================
// 📌 Inicialização do App
// ============================================================
app.whenReady().then(() => {
  console.log("🚀 ProFinance iniciado com sucesso!");
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ============================================================
// 📌 Criação das Tabelas (caso não existam)
// ============================================================
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

// ============================================================
// 📌 Função Auxiliar para Precisão com Decimal.js
// ============================================================
function toDecimal(value) {
  return new Decimal(value || 0);
}

// ============================================================
// 📌 IPC - Contas
// ============================================================
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
    toDecimal(conta.saldo).toNumber()
  );

  return { id: result.lastInsertRowid, ...conta };
});

ipcMain.handle("update-conta", async (_, conta) => {
  const stmt = db.prepare(`
    UPDATE contas
    SET nome = ?, banco = ?, agencia = ?, numero = ?, saldo = ?
    WHERE id = ?
  `);

  stmt.run(
    conta.nome,
    conta.banco,
    conta.agencia,
    conta.numero,
    toDecimal(conta.saldo).toNumber(),
    conta.id
  );

  return { success: true };
});

ipcMain.handle("delete-conta", async (_, id) => {
  db.prepare("DELETE FROM contas WHERE id = ?").run(id);
  return { success: true };
});

// ============================================================
// 📌 IPC - Transações
// ============================================================

// Listar transações por conta
ipcMain.handle("get-transacoes", async (_, contaId) => {
  return db
    .prepare(
      `
      SELECT t.*, c.nome AS conta_nome
      FROM transacoes t
      JOIN contas c ON c.id = t.conta_id
      WHERE t.conta_id = ?
      ORDER BY date(t.data) DESC
    `
    )
    .all(contaId);
});

// Buscar últimas 10 movimentações
ipcMain.handle("get-ultimas-movimentacoes", async () => {
  return db.prepare(`
    SELECT t.id, t.data, t.titulo, t.tipo, t.valor, c.nome AS conta_nome
    FROM transacoes t
    JOIN contas c ON c.id = t.conta_id
    ORDER BY date(t.data) DESC, t.id DESC
    LIMIT 10
  `).all();
});

// Adicionar transação
ipcMain.handle("add-transacao", async (_, transacao) => {
  const stmt = db.prepare(`
    INSERT INTO transacoes (conta_id, titulo, valor, tipo, data)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(
    transacao.conta_id,
    transacao.titulo,
    toDecimal(transacao.valor).toNumber(),
    transacao.tipo,
    transacao.data
  );

  // Atualiza saldo da conta com precisão
  const delta = transacao.tipo === "credito"
    ? toDecimal(transacao.valor)
    : toDecimal(transacao.valor).negated();

  db.prepare("UPDATE contas SET saldo = saldo + ? WHERE id = ?").run(
    delta.toNumber(),
    transacao.conta_id
  );

  return { success: true };
});

// Atualizar transação
ipcMain.handle("update-transacao", async (_, transacao) => {
  const old = db.prepare("SELECT valor, tipo, conta_id FROM transacoes WHERE id = ?").get(transacao.id);
  if (!old) return { success: false, message: "Transação não encontrada" };

  // Reverte saldo anterior
  const deltaAnterior = old.tipo === "credito"
    ? toDecimal(old.valor).negated()
    : toDecimal(old.valor);

  db.prepare("UPDATE contas SET saldo = saldo + ? WHERE id = ?").run(
    deltaAnterior.toNumber(),
    old.conta_id
  );

  // Atualiza transação
  db.prepare(`
    UPDATE transacoes
    SET titulo = ?, valor = ?, tipo = ?, data = ?, conta_id = ?
    WHERE id = ?
  `).run(
    transacao.titulo,
    toDecimal(transacao.valor).toNumber(),
    transacao.tipo,
    transacao.data,
    transacao.conta_id,
    transacao.id
  );

  // Aplica novo saldo
  const deltaNovo = transacao.tipo === "credito"
    ? toDecimal(transacao.valor)
    : toDecimal(transacao.valor).negated();

  db.prepare("UPDATE contas SET saldo = saldo + ? WHERE id = ?").run(
    deltaNovo.toNumber(),
    transacao.conta_id
  );

  return { success: true };
});

// Excluir transação
ipcMain.handle("delete-transacao", async (_, id) => {
  const transacao = db
    .prepare("SELECT valor, tipo, conta_id FROM transacoes WHERE id = ?")
    .get(id);

  if (transacao) {
    const delta = transacao.tipo === "credito"
      ? toDecimal(transacao.valor).negated()
      : toDecimal(transacao.valor);

    db.prepare("UPDATE contas SET saldo = saldo + ? WHERE id = ?").run(
      delta.toNumber(),
      transacao.conta_id
    );
  }

  db.prepare("DELETE FROM transacoes WHERE id = ?").run(id);
  return { success: true };
});

// ============================================================
// 📌 IPC - Filtros e Relatórios
// ============================================================
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

// ============================================================
// 📌 IPC - Saldo Consolidado
// ============================================================
ipcMain.handle("get-saldo-consolidado", async () => {
  const row = db.prepare(`
    SELECT
      IFNULL(SUM(CASE WHEN tipo = 'credito' THEN valor ELSE -valor END), 0) AS saldo_total
    FROM transacoes
  `).get();

  return toDecimal(row.saldo_total).toNumber();
});
