const db = require("../database");

module.exports = {
  listarPorConta(contaId) {
    return db.prepare("SELECT * FROM transacoes WHERE conta_id = ? ORDER BY data DESC").all(contaId);
  },

  criar(transacao) {
    return db.prepare(`
      INSERT INTO transacoes (conta_id, titulo, valor, tipo, data, descricao)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      transacao.conta_id,
      transacao.titulo,
      transacao.valor,
      transacao.tipo,
      transacao.data,
      transacao.descricao || null
    );
  },

  excluir(id) {
    return db.prepare("DELETE FROM transacoes WHERE id = ?").run(id);
  }
};
