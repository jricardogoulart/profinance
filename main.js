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
    icon: path.join(__dirname, "renderer/assets/", "profinanceicon.ico"),
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
// 📌 Criação das tabelas
//
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
    FOREIGN KEY (conta_id) REFERENCES contas (id) ON DELETE CASCADE -- MELHORIA: Garante que transações são deletadas junto com a conta.
  )
`).run();

//
// 📌 IPC para CONTAS
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
  return { id: result.lastInsertRowid, ...conta };
});

ipcMain.handle("delete-conta", async (_, id) => {
  // CORREÇÃO: A linha para deletar transações não é mais necessária devido ao "ON DELETE CASCADE"
  db.prepare("DELETE FROM contas WHERE id = ?").run(id);
  return { success: true };
});

//
// 📌 IPC para TRANSAÇÕES
//

// Obter transações de uma conta específica
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

// Obter últimas 10 movimentações para o Dashboard
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
    transacao.valor,
    transacao.tipo,
    transacao.data
  );

  // Atualiza saldo da conta
  db.prepare("UPDATE contas SET saldo = saldo + ? WHERE id = ?").run(
    transacao.tipo === "credito" ? transacao.valor : -transacao.valor,
    transacao.conta_id
  );

  return { success: true };
});

// Excluir transação
ipcMain.handle("delete-transacao", async (_, id) => {
  // Busca a transação para reverter saldo
  const transacao = db
    .prepare("SELECT valor, tipo, conta_id FROM transacoes WHERE id = ?")
    .get(id);

  if (transacao) {
    const delta =
      transacao.tipo === "credito"
        ? -transacao.valor
        : transacao.valor;

    db.prepare("UPDATE contas SET saldo = saldo + ? WHERE id = ?").run(
      delta,
      transacao.conta_id
    );
  }

  db.prepare("DELETE FROM transacoes WHERE id = ?").run(id);
  return { success: true };
});
//
// 📌 IPC novos / atualizados
//

// Buscar transações com filtros e ordenação (usado por transacoes.html)
// params = { contaId, tipoFilter: 'credito'|'debito'|null, minValue, maxValue, sort: 'asc'|'desc' }
ipcMain.handle("query-transacoes", async (_, params = {}) => {
  const { contaId, tipoFilter, minValue, maxValue, sort } = params;
  let where = [];
  let args = [];

  if (contaId) {
    where.push("t.conta_id = ?");
    args.push(contaId);
  }
  if (tipoFilter && (tipoFilter === "credito" || tipoFilter === "debito")) {
    where.push("t.tipo = ?");
    args.push(tipoFilter);
  }
  if (typeof minValue === "number") {
    where.push("t.valor >= ?");
    args.push(minValue);
  }
  if (typeof maxValue === "number") {
    where.push("t.valor <= ?");
    args.push(maxValue);
  }

  const whereSQL = where.length ? "WHERE " + where.join(" AND ") : "";
  const orderSQL = sort === "asc" ? "ORDER BY date(t.data) ASC, t.id ASC" : "ORDER BY date(t.data) DESC, t.id DESC";

  const sql = `
    SELECT t.*, c.nome AS conta_nome
    FROM transacoes t
    JOIN contas c ON c.id = t.conta_id
    ${whereSQL}
    ${orderSQL}
  `;
  return db.prepare(sql).all(...args);
});


// 📌 Saldo consolidado calculado a partir das transações
ipcMain.handle("get-saldo-consolidado", async () => {
  try {
    // Soma todos os créditos e subtrai os débitos
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
  // CORREÇÃO: Removido '});' extra que causava erro de sintaxe.
});


// =============================
// 📌 Atualizar Conta
// =============================
ipcMain.handle("update-conta", async (_, conta) => {
  const stmt = db.prepare(`
    UPDATE contas
    SET nome = ?, banco = ?, agencia = ?, numero = ?, saldo = ?
    WHERE id = ?
  `);
  stmt.run(conta.nome, conta.banco, conta.agencia, conta.numero, conta.saldo, conta.id);
  return { success: true };
});

// =============================
// 📌 Atualizar Transação
// =============================
ipcMain.handle("update-transacao", async (_, transacao) => {
  const old = db.prepare("SELECT valor, tipo, conta_id FROM transacoes WHERE id = ?").get(transacao.id);
  if (!old) return { success: false, message: "Transação não encontrada" };

  // Reverte saldo anterior da conta antiga
  const deltaAnterior = old.tipo === "credito" ? -old.valor : old.valor;
  db.prepare("UPDATE contas SET saldo = saldo + ? WHERE id = ?").run(deltaAnterior, old.conta_id);

  // Atualiza transação (pode ter mudado de conta inclusive)
  db.prepare(`
    UPDATE transacoes
    SET titulo = ?, valor = ?, tipo = ?, data = ?, conta_id = ? 
    WHERE id = ?
  `).run(transacao.titulo, transacao.valor, transacao.tipo, transacao.data, transacao.conta_id, transacao.id);

  // Aplica novo saldo na conta correta (nova ou a mesma)
  const deltaNovo = transacao.tipo === "credito" ? transacao.valor : -transacao.valor;
  // CORREÇÃO LÓGICA: Usa o conta_id da transação ATUALIZADA.
  db.prepare("UPDATE contas SET saldo = saldo + ? WHERE id = ?").run(deltaNovo, transacao.conta_id);

  return { success: true };
});

// CORREÇÃO: Removido o segundo manipulador duplicado para "query-transacoes" que estava aqui.

