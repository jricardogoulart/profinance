const db = require("../database");

module.exports = {
  listar() {
    return db.prepare("SELECT * FROM contas ORDER BY nome ASC").all();
  },

  criar(conta) {
    return db.prepare(`
      INSERT INTO contas (nome, banco, agencia, numero, saldo_inicial)
      VALUES (?, ?, ?, ?, ?)
    `).run(conta.nome, conta.banco, conta.agencia, conta.numero, conta.saldo_inicial || 0);
  },

  atualizar(id, conta) {
    return db.prepare(`
      UPDATE contas
      SET nome = ?, banco = ?, agencia = ?, numero = ?, saldo_inicial = ?
      WHERE id = ?
    `).run(conta.nome, conta.banco, conta.agencia, conta.numero, conta.saldo_inicial || 0, id);
  },

  excluir(id) {
    return db.prepare("DELETE FROM contas WHERE id = ?").run(id);
  }
};
