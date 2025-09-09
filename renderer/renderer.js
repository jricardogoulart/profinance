// =================== Tema Escuro Global ===================
document.addEventListener("DOMContentLoaded", () => {
  const html = document.documentElement;
  const toggleBtn = document.getElementById("toggle-tema");
  const toggleCircle = document.getElementById("toggle-circle");

  // Aplica o tema salvo ou preferência do sistema
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    html.classList.add("dark");
    if (toggleBtn) toggleBtn.checked = true;
  } else if (savedTheme === "light") {
    html.classList.remove("dark");
    if (toggleBtn) toggleBtn.checked = false;
  } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    html.classList.add("dark");
    if (toggleBtn) toggleBtn.checked = true;
  }

  // Evento de clique no toggle
  if (toggleBtn) {
    toggleBtn.addEventListener("change", () => {
      if (toggleBtn.checked) {
        html.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        html.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }

      // Pulse animation
      toggleCircle.classList.add("animate-pulse");
      setTimeout(() => {
        toggleCircle.classList.remove("animate-pulse");
      }, 300);
    });
  }
});

// =================== Menu Mobile ===================
document.addEventListener("DOMContentLoaded", () => {
  const menuBtn = document.getElementById("menu-btn");
  const mobileMenu = document.getElementById("mobile-menu");
  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener("click", () =>
      mobileMenu.classList.toggle("hidden")
    );
  }
});

// =================== Toast Helper ===================
function showToast(text, type = "info") {
  let t = document.getElementById("__toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "__toast";
    t.className =
      "fixed right-5 bottom-5 z-[9999] flex flex-col items-end gap-2";
    document.body.appendChild(t);
  }
  const el = document.createElement("div");
  el.className = "p-3 rounded-lg shadow-lg text-white font-medium";
  if (type === "success") el.style.background = "#10B981";
  else if (type === "info") el.style.background = "#3B82F6";
  else el.style.background = "#EF4444";
  el.innerText = text;
  t.appendChild(el);

  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity 0.5s ease";
    setTimeout(() => el.remove(), 500);
  }, 3000);
}

// =================== Helper BRL ===================
function formatBRL(valor) {
  const dec = new Decimal(valor || 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(dec.toFixed(2));
}
// =================== Helper Data ===================
function formatDate(dateStr) {
  if (!dateStr) return "";

  // Se vier no formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [ano, mes, dia] = dateStr.split("-");
    return `${dia}/${mes}/${ano}`;
  }

  // Caso contrário, tenta parse normal (ISO, DateTime etc.)
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;

  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

// =================== DASHBOARD ===================
async function carregarDashboard() {
  const cardsContainer = document.getElementById("cards-contas");
  const saldoConsolidadoEl = document.getElementById("saldo-consolidado");
  const tabelaMov = document.getElementById("tabela-movimentacoes");
  if (!cardsContainer) return;

  try {
    const contas = await window.profinanceAPI.listarContas();
    if (!contas.length) {
      cardsContainer.innerHTML = `<div class="col-span-full text-center text-gray-500">Nenhuma conta cadastrada.</div>`;
      saldoConsolidadoEl.textContent = "R$ 0,00";
      tabelaMov.innerHTML = `<tr><td colspan="5" class="text-center text-gray-500">Nenhuma movimentação encontrada.</td></tr>`;
      return;
    }

    // Cards de contas
    cardsContainer.innerHTML = contas
      .map(
        (c) => `
      <div class="card shadow-md hover:shadow-lg transition p-4 rounded bg-white dark:bg-gray-800">
        <h3 class="text-lg font-semibold">${c.nome}</h3>
        <p>${c.banco || ""}</p>
        <p class="mt-2 text-blue-600 font-bold">Saldo atual: ${formatBRL(
          c.saldo
        )}</p>
        <button onclick="verTransacoes(${
          c.id
        })" class="mt-4 button-primary w-full">Ver Transações</button>
      </div>
    `
      )
      .join("");

    // Saldo consolidado
    const saldoConsolidado = contas.reduce(
      (acc, c) => acc.plus(new Decimal(c.saldo || 0)),
      new Decimal(0)
    );
    saldoConsolidadoEl.textContent = formatBRL(saldoConsolidado);

    // Últimas movimentações (de todas as contas)
    const movs = await window.profinanceAPI.listarUltimasMovimentacoes(); // sem filtro por conta
    if (!movs || !movs.length) {
      tabelaMov.innerHTML = `<tr><td colspan="5" class="text-center text-gray-500">Nenhuma movimentação encontrada.</td></tr>`;
      return;
    }

    tabelaMov.innerHTML = movs
      .map((m) => {
        const isCredito = m.tipo === "credito";
        const bgClass = isCredito ? "bg-green-600" : "bg-red-600";
        const tipoLabel = isCredito ? "Crédito" : "Débito";
        const valorText = `${isCredito ? "" : "-"}${formatBRL(m.valor)}`;
        return `
        <tr>
          <td>${formatDate(m.data)}</td>
          <td>${m.conta_nome || ""}</td>
          <td>${m.titulo || ""}</td>
          <td class="px-2 py-1 text-left">
            <span class="px-2 py-1 ${bgClass} text-white rounded">${tipoLabel}</span>
          </td>
          <td class="text-right font-semibold">${valorText}</td>
        </tr>
      `;
      })
      .join("");
  } catch (err) {
    console.error(err);
    showToast("Erro ao carregar dashboard", "error");
  }
}

// Redireciona para a página de transações com filtro da conta pré-selecionado
function verTransacoes(contaId) {
  if (!contaId) return;
  navigateTo(`transacoes.html?conta=${contaId}`);
}

// =================== CONTAS ===================
let contasCache = [];

async function atualizarCacheContas() {
  const tabela = document.getElementById("tabela-contas");
  if (!tabela) return;

  try {
    contasCache = await window.profinanceAPI.listarContas();
    if (!contasCache.length) {
      tabela.innerHTML =
        '<tr><td colspan="6" class="text-center text-gray-500">Nenhuma conta cadastrada.</td></tr>';
      return;
    }
    tabela.innerHTML = contasCache
      .map(
        (c) => `
      <tr>
        <td>${c.nome}</td>
        <td>${c.banco}</td>
        <td>${c.agencia}</td>
        <td>${c.numero}</td>
        <td class="text-right">${formatBRL(c.saldo)}</td>
        <td class="text-center">
          <button onclick="abrirModalConta(${
            c.id
          })" class="bg-yellow-500 text-white rounded-full p-2">✏️</button>
          <button onclick="excluirConta(${
            c.id
          })" class="bg-red-600 text-white rounded-full p-2">🗑️</button>
        </td>
      </tr>
    `
      )
      .join("");
  } catch (err) {
    console.error(err);
    showToast("Erro ao carregar contas", "error");
  }
}
// =================== MODAL FILTROS RELATÓRIO ===================
function abrirModalFiltrosRelatorio() {
  document.getElementById("modal-filtros-relatorio").classList.remove("hidden");
}

function fecharModalFiltrosRelatorio() {
  document.getElementById("modal-filtros-relatorio").classList.add("hidden");
}

document.getElementById("btn-filtros-relatorio")?.addEventListener("click", abrirModalFiltrosRelatorio);

document.getElementById("btn-filtrar")?.addEventListener("click", async (e) => {
  e.preventDefault();
  await carregarRelatorio();
  fecharModalFiltrosRelatorio();
});

document.getElementById("btn-limpar")?.addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("filtro-conta").value = "";
  document.getElementById("filtro-tipo").value = "";
  document.getElementById("filtro-data-inicio").value = "";
  document.getElementById("filtro-data-fim").value = "";
  carregarRelatorio();
});

// =================== MODAL FILTROS ===================
function abrirModalFiltros() {
  document.getElementById("modal-filtros").classList.remove("hidden");
}

function fecharModalFiltros() {
  document.getElementById("modal-filtros").classList.add("hidden");
}

document
  .getElementById("btn-filtros")
  ?.addEventListener("click", abrirModalFiltros);

// =================== BOTÕES APLICAR / LIMPAR FILTROS ===================
document
  .getElementById("apply-filters")
  ?.addEventListener("click", async () => {
    await carregarTransacoes(); // Aplica filtros
    fecharModalFiltros(); // Fecha modal
  });

document.getElementById("clear-filters")?.addEventListener("click", () => {
  document.getElementById("filter-tipo").value = "";
  document.getElementById("sort-date").value = "desc";
  document.getElementById("min-value").value = "";
  document.getElementById("max-value").value = "";
});

function abrirModalNovaConta() {
  document.getElementById("modal-nova-conta").classList.remove("hidden");
}

function fecharModalNovaConta() {
  document.getElementById("modal-nova-conta").classList.add("hidden");
}

function abrirModalNovaTransacao() {
  document.getElementById("modal-nova-transacao").classList.remove("hidden");
}

function fecharModalNovaTransacao() {
  document.getElementById("modal-nova-transacao").classList.add("hidden");
}

// Modal
function abrirModalConta(id) {
  const conta = contasCache.find((c) => c.id === id);
  if (!conta) return;
  document.getElementById("edit-id").value = conta.id;
  document.getElementById("edit-nome").value = conta.nome;
  document.getElementById("edit-banco").value = conta.banco;
  document.getElementById("edit-agencia").value = conta.agencia;
  document.getElementById("edit-numero").value = conta.numero;
  document.getElementById("edit-saldo").value = conta.saldo;
  document.getElementById("modal-conta").classList.remove("hidden");
}

function fecharModalConta() {
  document.getElementById("modal-conta").classList.add("hidden");
}

// Criar nova conta
document.getElementById("form-conta")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const novaConta = {
    nome: document.getElementById("nome").value.trim(),
    banco: document.getElementById("banco").value.trim(),
    agencia: document.getElementById("agencia").value.trim(),
    numero: document.getElementById("numero").value.trim(),
    saldo: new Decimal(document.getElementById("saldo").value || 0).toString(),
  };
  try {
    await window.profinanceAPI.cadastrarConta(novaConta);
    e.target.reset();
    showToast("Conta cadastrada com sucesso!", "success");
    await atualizarCacheContas();
    await carregarDashboard();
  } catch (err) {
    console.error(err);
    showToast("Erro ao cadastrar conta!", "error");
  }
});

// Editar conta
document
  .getElementById("form-editar-conta")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const contaAtualizada = {
      id: Number(document.getElementById("edit-id").value),
      nome: document.getElementById("edit-nome").value.trim(),
      banco: document.getElementById("edit-banco").value.trim(),
      agencia: document.getElementById("edit-agencia").value.trim(),
      numero: document.getElementById("edit-numero").value.trim(),
      saldo: new Decimal(
        document.getElementById("edit-saldo").value || 0
      ).toString(),
    };
    try {
      await window.profinanceAPI.atualizarConta(contaAtualizada);
      fecharModalConta();
      showToast("Conta atualizada com sucesso!", "success");
      await atualizarCacheContas();
      await carregarDashboard();
    } catch (err) {
      console.error(err);
      showToast("Erro ao atualizar conta!", "error");
    }
  });

// Excluir conta
async function excluirConta(id) {
  if (!confirm("Confirma exclusão desta conta?")) return;
  try {
    await window.profinanceAPI.excluirConta(id);
    showToast("Conta excluída", "info");
    await atualizarCacheContas();
    await carregarDashboard();
  } catch (err) {
    console.error(err);
    showToast("Erro ao excluir conta", "error");
  }
}

// =================== TRANSACOES ===================
let transacaoEditandoId = null;

async function carregarContasTransacoes() {
  const contas = await window.profinanceAPI.listarContas();
  const filterSelect = document.getElementById("filter-conta");
  if (!filterSelect) return;

  const optionsHTML =
    '<option value="">Selecione a Conta</option>' + // padrão inicial
    '<option value="all">Todas as Contas</option>' + // opção todas
    contas
      .map((c) => `<option value="${c.id}">${c.nome} (${c.banco})</option>`)
      .join("");

  filterSelect.innerHTML = optionsHTML;
}

// =================== Carregar contas no select de filtros ===================
async function carregarContasTransacoes() {
  const contas = await window.profinanceAPI.listarContas();
  const selectContas = document.getElementById("conta"); // para nova transação
  const selectFiltro = document.getElementById("filter-conta"); // para filtros
  const selectModal = document.getElementById("edit-conta"); // para editar transação
  if (!selectContas || !selectFiltro) return;

  // Select da nova transação
  selectContas.innerHTML =
    '<option value="">Selecione a Conta</option>' +
    contas.map((c) => `<option value="${c.id}">${c.nome} (${c.banco})</option>`).join("");

  // Select de filtros: Selecionar / Todas / cada conta
  selectFiltro.innerHTML =
    '<option value="">Selecione a Conta</option>' +
    '<option value="all">Todas as Contas</option>' +
    contas.map((c) => `<option value="${c.id}">${c.nome} (${c.banco})</option>`).join("");

  // Select de edição de transação
  if (selectModal)
    selectModal.innerHTML =
      '<option value="">Mudar Conta</option>' +
      contas.map((c) => `<option value="${c.id}">${c.nome} (${c.banco})</option>`).join("");

  // Mantém parâmetro da URL se existir
  const contaParam = new URL(window.location.href).searchParams.get("conta");
  if (contaParam && selectContas) selectContas.value = contaParam;
}

// =================== Carregar transações ===================
async function carregarTransacoes(forcarContaId = null) {
  const tabela = document.getElementById("tabela-transacoes");
  if (!tabela) return;

  // Se passou forcarContaId, usa ele; senão pega do filtro
  const contaFiltro = forcarContaId ?? document.getElementById("filter-conta")?.value;

  if (!contaFiltro || contaFiltro === "") {
    tabela.innerHTML = `<tr><td colspan="6" class="text-center text-gray-500">Selecione a conta nos filtros antes de carregar</td></tr>`;
    return;
  }

  const params = {};
  if (contaFiltro !== "all") {
    params.contaId = Number(contaFiltro);
  }

  try {
    const tipo = document.getElementById("filter-tipo")?.value || null;
    const sortDate = document.getElementById("sort-date")?.value || "desc";
    const minValue = document.getElementById("min-value")?.value;
    const maxValue = document.getElementById("max-value")?.value;

    if (tipo) params.tipo = tipo;
    if (minValue) params.inicio = minValue;
    if (maxValue) params.fim = maxValue;

    let transacoes = await window.profinanceAPI.queryTransacoes(params);

    transacoes.sort((a, b) => {
      const dataA = new Date(a.data);
      const dataB = new Date(b.data);
      return sortDate === "asc" ? dataA - dataB : dataB - dataA;
    });

    transacoesCache = transacoes;

    tabela.innerHTML = transacoes.length
      ? transacoes
          .map((t) => {
            const isCredito = t.tipo === "credito";
            const bgClass = isCredito ? "bg-green-600" : "bg-red-600";
            const tipoLabel = isCredito ? "Crédito" : "Débito";
            const valorText = `${isCredito ? "" : "-"}${formatBRL(t.valor)}`;
            return `
            <tr>
              <td>${formatDate(t.data)}</td>
              <td>${t.conta_nome || ""}</td>
              <td>${t.titulo || ""}</td>
              <td><span class="px-2 py-1 ${bgClass} text-white rounded">${tipoLabel}</span></td>
              <td class="text-right font-semibold">${valorText}</td>
              <td class="text-center">
                <button onclick="editarTransacao(${t.id})" class="bg-yellow-500 text-white rounded-full p-2">✏️</button>
                <button onclick="excluirTransacao(${t.id})" class="bg-red-600 text-white rounded-full p-2">🗑️</button>
              </td>
            </tr>
          `;
          })
          .join("")
      : `<tr><td colspan="6" class="text-center text-gray-500">Nenhuma transação encontrada.</td></tr>`;
  } catch (err) {
    console.error(err);
    showToast("Erro ao carregar transações", "error");
  }
}
window.carregarTransacoes = carregarTransacoes;



// Adicionar, editar, excluir transações e eventos associados
// Adicionar nova transação
document
  .getElementById("form-transacao")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const contaSelecionada = document.getElementById("conta").value;
    if (!contaSelecionada) {
      return showToast("Selecione uma conta antes de cadastrar", "info");
    }

    const transacao = {
      conta_id: Number(contaSelecionada),
      titulo: document.getElementById("titulo").value.trim(),
      valor: new Decimal(document.getElementById("valor").value || 0).toString(),
      tipo: document.getElementById("tipo").value,
      data:
        document.getElementById("data").value ||
        new Date().toISOString().slice(0, 10),
    };

    try {
      await window.profinanceAPI.addTransacao(transacao);
      showToast("Transação cadastrada com sucesso!", "success");

      await carregarTransacoes(transacao.conta_id);


      // Limpa apenas os campos específicos do formulário, mantendo a conta selecionada
      document.getElementById("titulo").value = "";
      document.getElementById("valor").value = "";
      document.getElementById("tipo").value = "";
      document.getElementById("data").valueAsDate = new Date();

      // Atualiza a tabela já filtrando pela conta selecionada
      document.getElementById("filter-conta").value = contaSelecionada;
      await carregarTransacoes();

      // Opcional: atualizar dashboard também, se quiser refletir o saldo
      await carregarDashboard();
    } catch (err) {
      console.error(err);
      showToast("Erro ao cadastrar transação!", "error");
    }
  });


document
  .getElementById("btn-carregar-transacoes")
  ?.addEventListener("click", async () => {
    await carregarTransacoes();
    fecharModalFiltros();
  });

document
  .getElementById("apply-filters")
  ?.addEventListener("click", async () => {
    await carregarTransacoes();
    fecharModalFiltros();
  });

document.getElementById("clear-filters")?.addEventListener("click", () => {
  document.getElementById("filter-conta").value = "";
  document.getElementById("filter-tipo").value = "";
  document.getElementById("sort-date").value = "desc";
  document.getElementById("min-value").value = "";
  document.getElementById("max-value").value = "";
  document.getElementById(
    "tabela-transacoes"
  ).innerHTML = `<tr><td colspan="6" class="text-center text-gray-500">Selecione a conta nos filtros antes de carregar</td></tr>`;
});

// Modal abrir/fechar
function abrirModalNovaTransacao() {
  document.getElementById("modal-nova-transacao").classList.remove("hidden");
  carregarContasTransacoes();
}
function fecharModalNovaTransacao() {
  document.getElementById("modal-nova-transacao").classList.add("hidden");
}

// Editar / Excluir Transação
function editarTransacao(id) {
  const t = transacoesCache.find((x) => x.id === id);
  if (!t) return showToast("Transação não encontrada", "error");
  transacaoEditandoId = id;
  document.getElementById("edit-conta").value = t.conta_id;
  document.getElementById("edit-titulo").value = t.titulo;
  document.getElementById("edit-valor").value = t.valor;
  document.getElementById("edit-tipo").value = t.tipo;
  document.getElementById("edit-data").value = t.data;
  document.getElementById("modal-transacao").classList.remove("hidden");
}
window.editarTransacao = editarTransacao;

function fecharModalTransacao() {
  document.getElementById("modal-transacao").classList.add("hidden");
  transacaoEditandoId = null;
}
window.fecharModalTransacao = fecharModalTransacao;

document
  .getElementById("form-editar-transacao")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!transacaoEditandoId) return;
    const transacaoAtualizada = {
      id: transacaoEditandoId,
      conta_id: Number(document.getElementById("edit-conta").value),
      titulo: document.getElementById("edit-titulo").value.trim(),
      valor: new Decimal(
        document.getElementById("edit-valor").value || 0
      ).toString(),
      tipo: document.getElementById("edit-tipo").value,
      data: document.getElementById("edit-data").value,
    };
    try {
      await window.profinanceAPI.atualizarTransacao(transacaoAtualizada);
      fecharModalTransacao();
      showToast("Transação atualizada!", "success");
      await carregarTransacoes();
      await carregarDashboard();
    } catch (err) {
      console.error(err);
      showToast("Erro ao atualizar transação", "error");
    }
  });

async function excluirTransacao(id) {
  if (!confirm("Confirma exclusão desta transação?")) return;
  try {
    await window.profinanceAPI.excluirTransacao(id);
    showToast("Transação excluída", "info");
    await carregarTransacoes();
    await carregarDashboard();
  } catch (err) {
    console.error(err);
    showToast("Erro ao excluir transação", "error");
  }
}
window.excluirTransacao = excluirTransacao;
// =================== Inicialização ===================
document.addEventListener("DOMContentLoaded", async () => {
  await atualizarCacheContas();
  await carregarDashboard();
  await carregarContasTransacoes();
  await carregarTransacoes();
});

// =================== RELATÓRIOS ===================

let relatorioTransacoes = [];

// Carrega contas no select
async function carregarContasRelatorio() {
  const contas = await window.profinanceAPI.listarContas();
  const select = document.getElementById("filtro-conta");
  if (!select) return;
  select.innerHTML =
    '<option value="">Todas as Contas</option>' +
    contas
      .map((c) => `<option value="${c.id}">${c.nome} (${c.banco})</option>`)
      .join("");
}

// Carrega relatório baseado nos filtros
async function carregarRelatorio(e) {
  if (e) e.preventDefault();
  const contaId =
    Number(document.getElementById("filtro-conta")?.value) || null;
  const tipo = document.getElementById("filtro-tipo")?.value || null;
  const dataInicio =
    document.getElementById("filtro-data-inicio")?.value || null;
  const dataFim = document.getElementById("filtro-data-fim")?.value || null;

  const params = {};
  if (contaId) params.contaId = contaId;
  if (tipo) params.tipo = tipo;
  if (dataInicio) params.inicio = dataInicio;
  if (dataFim) params.fim = dataFim;

  relatorioTransacoes = await window.profinanceAPI.queryTransacoes(params);

  atualizarResumo();
  atualizarExtrato();
  atualizarGraficos();
}

// Atualiza o resumo (total créditos, débitos e saldo final)
function atualizarResumo() {
  const totalCreditos = relatorioTransacoes
    .filter((t) => t.tipo === "credito")
    .reduce((acc, t) => acc.plus(new Decimal(t.valor)), new Decimal(0));

  const totalDebitos = relatorioTransacoes
    .filter((t) => t.tipo === "debito")
    .reduce((acc, t) => acc.plus(new Decimal(t.valor)), new Decimal(0));

  const saldoFinal = totalCreditos.minus(totalDebitos);

  document.getElementById("total-creditos").innerText =
    formatBRL(totalCreditos);
  document.getElementById("total-debitos").innerText = formatBRL(totalDebitos);
  document.getElementById("saldo-final").innerText = formatBRL(saldoFinal);
}

// Atualiza a tabela de extrato detalhado
function atualizarExtrato() {
  const tbody = document.getElementById("tabela-extrato");
  if (!tbody) return;

  tbody.innerHTML = relatorioTransacoes
    .map((t) => {
      const valorText = (t.tipo === "debito" ? "-" : "") + formatBRL(t.valor);
      const isCredito = t.tipo === "credito";
      const bgClass = isCredito ? "bg-green-600" : "bg-red-600";
      const tipoLabel = isCredito ? "Crédito" : "Débito";

      return `
    <tr>
      <td>${formatDate(t.data)}</td>
      <td>${t.conta_nome || ""}</td>
      <td>${t.titulo || ""}</td>
      <td><span class="px-2 py-1 ${bgClass} text-white rounded">${tipoLabel}</span></td>
      <td class="text-right font-semibold">${valorText}</td>
    </tr>
  `;
    })
    .join("");

  // Totais rodapé
  const totalCreditos = relatorioTransacoes
    .filter((t) => t.tipo === "credito")
    .reduce((acc, t) => acc.plus(new Decimal(t.valor)), new Decimal(0));

  const totalDebitos = relatorioTransacoes
    .filter((t) => t.tipo === "debito")
    .reduce((acc, t) => acc.plus(new Decimal(t.valor)), new Decimal(0));

  const saldoFinal = totalCreditos.minus(totalDebitos);

  document.getElementById("extrato-total-creditos").innerText =
    formatBRL(totalCreditos);
  document.getElementById("extrato-total-debitos").innerText =
    formatBRL(totalDebitos);
  document.getElementById("extrato-saldo-final").innerText =
    formatBRL(saldoFinal);
}

// =================== GRÁFICOS ===================
let graficoEntradasSaidas = null;
let graficoSaldo = null;

function atualizarGraficos() {
  const ctx1 = document
    .getElementById("grafico-entradas-saidas")
    .getContext("2d");
  const ctx2 = document.getElementById("grafico-saldo").getContext("2d");

  const datas = [...new Set(relatorioTransacoes.map((t) => t.data))].sort();

  // Entradas e saídas calculadas em Decimal
  const entradas = datas.map((d) =>
    relatorioTransacoes
      .filter((t) => t.data === d && t.tipo === "credito")
      .reduce((acc, t) => acc.plus(new Decimal(t.valor)), new Decimal(0))
  );

  const saidas = datas.map((d) =>
    relatorioTransacoes
      .filter((t) => t.data === d && t.tipo === "debito")
      .reduce((acc, t) => acc.plus(new Decimal(t.valor)), new Decimal(0))
  );

  // Saldo acumulado
  let saldoAcumulado = [];
  datas.forEach((d, i) => {
    const prev = i > 0 ? saldoAcumulado[i - 1] : new Decimal(0);
    saldoAcumulado.push(prev.plus(entradas[i]).minus(saidas[i]));
  });

  // Destroi gráficos antigos
  if (graficoEntradasSaidas) graficoEntradasSaidas.destroy();
  if (graficoSaldo) graficoSaldo.destroy();

  const opcoesBase = {
    responsive: true,
    plugins: { legend: { position: "top" } },
    scales: {
      x: {
        ticks: {
          autoSkip: true,
          maxTicksLimit: 10, //
        },  
      },
      y: {
        ticks: {
          callback: function (value) {
            return formatBRL(value); // formata eixo Y em BRL
          },
        },
      },
    },
  };

  // Gráfico de entradas/saídas
  graficoEntradasSaidas = new Chart(ctx1, {
    type: "bar",
    data: {
      labels: datas,
      datasets: [
        {
          label: "Créditos",
          data: entradas.map((v) => v.toNumber()),
          backgroundColor: "#10B981",
        },
        {
          label: "Débitos",
          data: saidas.map((v) => v.toNumber()),
          backgroundColor: "#EF4444",
        },
      ],
    },
    options: opcoesBase,
  });

  // Gráfico de saldo acumulado
  graficoSaldo = new Chart(ctx2, {
    type: "line",
    data: {
      labels: datas,
      datasets: [
        {
          label: "Saldo Acumulado",
          data: saldoAcumulado.map((v) => v.toNumber()),
          borderColor: "#3B82F6",
          backgroundColor: "#3B82F6",
          fill: false,
        },
      ],
    },
    options: opcoesBase,
  });
}


// =================== EXPORTAÇÃO ===================
async function exportarRelatorioPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("p", "pt", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let cursorY = 20;

  const logoPath = "assets/profinance.png";
  const headerHeight = 40;

  // Cabeçalho preto
  doc.setFillColor(20, 20, 20);
  doc.rect(0, 0, pageWidth, headerHeight, "F");

  // Logo
  const img = new Image();
  img.src = logoPath;
  await new Promise((resolve) => {
    img.onload = () => {
      const scale = (headerHeight / img.height) * 0.8;
      const logoWidth = img.width * scale;
      const logoHeight = img.height * scale;
      doc.addImage(
        img,
        "PNG",
        14,
        (headerHeight - logoHeight) / 2,
        logoWidth,
        logoHeight
      );
      resolve(true);
    };
    img.onerror = resolve;
  });

  // Título
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório | ProFinance", pageWidth / 2, headerHeight / 2 + 6, {
    align: "center",
  });

  cursorY = headerHeight + 20;

  // Extrato da tabela HTML
  const tabela = document.getElementById("tabela-extrato");
  const rows = Array.from(tabela.querySelectorAll("tr")).map((tr) =>
    Array.from(tr.querySelectorAll("td")).map((td) => td.innerText)
  );

  // Renderiza a tabela
  doc.autoTable({
    startY: cursorY,
    head: [["Data", "Conta", "Título", "Tipo", "Valor"]],
    body: rows,
    theme: "grid",
    headStyles: { fillColor: [40, 40, 40], textColor: 255, halign: "center" },
    bodyStyles: { halign: "center" },
    margin: { bottom: 80 }, // espaço para o footer
    didDrawPage: function (data) {
      // Rodapé fixo com numeração de páginas
      let str = "Página " + doc.internal.getNumberOfPages();
      doc.setFontSize(10);
      doc.setTextColor(120, 120, 120);
      doc.text(str, pageWidth / 2, pageHeight - 20, { align: "center" });
    },
  });

  // Adiciona o footer apenas na última página
  const totalPages = doc.internal.getNumberOfPages();
  doc.setPage(totalPages);

  const finalY = doc.lastAutoTable.finalY + 20;
  const totais = [
    {
      label: "Total Créditos",
      valor: document.getElementById("extrato-total-creditos").innerText,
      cor: [46, 204, 113],
    }, // verde suave
    {
      label: "Total Débitos",
      valor: document.getElementById("extrato-total-debitos").innerText,
      cor: [231, 76, 60],
    }, // vermelho suave
    {
      label: "Saldo Final",
      valor: document.getElementById("extrato-saldo-final").innerText,
      cor: [52, 152, 219],
    }, // azul suave
  ];

  let footerY = finalY;
  totais.forEach((item) => {
    doc.setFillColor(...item.cor);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.rect(40, footerY, pageWidth - 80, 20, "F");
    doc.text(item.label, 60, footerY + 14);
    doc.text(item.valor, pageWidth - 60, footerY + 14, { align: "right" });
    footerY += 25;
  });

  doc.save(`Relatorio-ProFinance-${new Date().toISOString().slice(0, 10)}.pdf`);
}

document
  .getElementById("btn-export-pdf")
  ?.addEventListener("click", exportarRelatorioPDF);

document
  .getElementById("btn-export-pdf")
  ?.addEventListener("click", exportarRelatorioPDF);

document.getElementById("btn-export-csv")?.addEventListener("click", () => {
  let csv = "Data,Conta,Título,Tipo,Valor\n";
  relatorioTransacoes.forEach((t) => {
    csv += `"${t.data}","${t.conta_nome}","${t.titulo}","${t.tipo}","${t.valor}"\n`;
  });
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "relatorio.csv";
  a.click();
  URL.revokeObjectURL(url);
});

// =================== BACKUP E RESTAURAÇÃO ===================
document.getElementById("btn-backup")?.addEventListener("click", async () => {
  try {
    const backupResult = await window.profinanceAPI.fazerBackup();

    if (!backupResult) {
      showToast("Backup cancelado pelo usuário", "warning");
      return;
    }

    showToast(
      `Backup realizado com sucesso! Arquivo: ${backupResult.fileName}`,
      "success"
    );
  } catch (err) {
    console.error(err);
    showToast("Erro ao realizar backup", "error");
  }
});

// =================== RESTAURAÇÃO ===================
document.getElementById("btn-restore")?.addEventListener("click", async () => {
  try {
    const restoreResult = await window.profinanceAPI.restaurarBackup();

    if (!restoreResult) {
      showToast("Restauração cancelada pelo usuário", "warning");
      return;
    }

    showToast(
      `Restauração realizada com sucesso! Arquivo: ${restoreResult.fileName}`,
      "success"
    );

    // Opcional: recarregar interface após restauração
    // location.reload();
  } catch (err) {
    console.error(err);
    showToast("Erro ao restaurar backup", "error");
  }
});

// =================== EVENTOS ===================
document
  .getElementById("form-relatorio")
  ?.addEventListener("submit", carregarRelatorio);
document.getElementById("btn-limpar")?.addEventListener("click", () => {
  document.getElementById("filtro-conta").value = "";
  document.getElementById("filtro-tipo").value = "";
  document.getElementById("filtro-data-inicio").value = "";
  document.getElementById("filtro-data-fim").value = "";
  carregarRelatorio();
});

// Inicialização
document.addEventListener("DOMContentLoaded", async () => {
  if (document.getElementById("cards-contas")) {
    await atualizarCacheContas();
    await carregarDashboard();
  }
  if (document.getElementById("tabela-transacoes")) {
    await carregarContasTransacoes();
    await carregarTransacoes();

     // 🔹 Novo: capturar conta da URL
    const contaParam = new URL(window.location.href).searchParams.get("conta");
    if (contaParam) {
      document.getElementById("filter-conta").value = contaParam;
      await carregarTransacoes(Number(contaParam)); // já abre filtrado
    } else {
      await carregarTransacoes();
    }
  
  }
  if (document.getElementById("form-relatorio")) {
  await carregarContasRelatorio();

  // Mantém resumo zerado
  document.getElementById("total-creditos").innerText = "R$ 0,00";
  document.getElementById("total-debitos").innerText = "R$ 0,00";
  document.getElementById("saldo-final").innerText = "R$ 0,00";

  // Placeholder no extrato
  const tbody = document.getElementById("tabela-extrato");
  if (tbody) {
    tbody.innerHTML = `<tr>
      <td colspan="5" class="text-center text-gray-500">
        Aplique os filtros para gerar o relatório.
      </td>
    </tr>`;
  }

  // Gráficos ficam vazios até aplicar filtros
  const ctx1 = document.getElementById("grafico-entradas-saidas")?.getContext("2d");
  const ctx2 = document.getElementById("grafico-saldo")?.getContext("2d");
  if (ctx1) {
    ctx1.font = "14px sans-serif";
    ctx1.fillStyle = "#888";
    ctx1.textAlign = "center";
    ctx1.fillText("Aplique os filtros para gerar", ctx1.canvas.width / 2, ctx1.canvas.height / 2);
  }
  if (ctx2) {
    ctx2.font = "14px sans-serif";
    ctx2.fillStyle = "#888";
    ctx2.textAlign = "center";
    ctx2.fillText("Aplique os filtros para gerar", ctx2.canvas.width / 2, ctx2.canvas.height / 2);
  }
}

});
// =================== NAVEGAÇÃO COM ANIMAÇÃO ===================
function navigateTo(url) {
  const app = document.getElementById("app");
  if (!app) {
    window.location.href = url;
    return;
  }

  // aplica fade-out
  app.classList.add("fade-out");

  // depois da transição, muda a página
  setTimeout(() => {
    window.location.href = url;
  }, 300); // mesmo tempo da transição CSS
}
