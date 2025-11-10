// src/controllers/carrinhoController.js
const db = require('../config/db');

/**
 * Função auxiliar interna para obter o carrinho 'aberto' de um cliente.
 * Se não existir, um novo carrinho é criado.
 * Esta função é projetada para ser usada DENTRO de uma transação.
 */
const getOrCreateCart = async (clienteId, transactionClient) => {
  // 1. Tenta encontrar um carrinho 'aberto'
  let cartQuery = await transactionClient.query(
    "SELECT id_carrinho FROM carrinho WHERE id_cliente = $1 AND status = 'aberto'",
    [clienteId]
  );

  let id_carrinho;

  if (cartQuery.rows.length > 0) {
    // 2. Se encontrou, usa o ID
    id_carrinho = cartQuery.rows[0].id_carrinho;
  } else {
    // 3. Se não encontrou, cria um novo
    let newCartQuery = await transactionClient.query(
      "INSERT INTO carrinho (id_cliente, status) VALUES ($1, 'aberto') RETURNING id_carrinho",
      [clienteId]
    );
    id_carrinho = newCartQuery.rows[0].id_carrinho;
  }

  return id_carrinho;
};


// --- Adicionar Item ao Carrinho (A LÓGICA PRINCIPAL) ---
exports.addItemAoCarrinho = async (req, res) => {
  // O ID do cliente vem do middleware de autenticação
  const id_cliente = req.cliente.id; 
  const { id_produto, quantidade } = req.body;

  if (!id_produto || !quantidade || quantidade <= 0) {
    return res.status(400).json({ error: 'ID do produto e quantidade (maior que 0) são obrigatórios.' });
  }

  const client = await db.pool.connect(); // Pega uma conexão para a transação

  try {
    await client.query('BEGIN'); // Inicia a transação

    // 1. Pega o ID do carrinho (ou cria um novo)
    const id_carrinho = await getOrCreateCart(id_cliente, client);

    // 2. Busca o preço e o estoque do produto (e "trava" a linha para a transação)
    const produtoQuery = await client.query(
      'SELECT preco, estoque FROM produto WHERE id_produto = $1 FOR UPDATE',
      [id_produto]
    );
    
    if (produtoQuery.rows.length === 0) {
      throw new Error('Produto não encontrado.');
    }

    const { preco, estoque } = produtoQuery.rows[0];

    // 3. Verifica se o item JÁ EXISTE no carrinho
    const itemExistenteQuery = await client.query(
      'SELECT id_item, quantidade FROM item_carrinho WHERE id_carrinho = $1 AND id_produto = $2',
      [id_carrinho, id_produto]
    );

    let novaQuantidade;
    if (itemExistenteQuery.rows.length > 0) {
      // --- Se JÁ EXISTE: Vamos atualizar ---
      const item = itemExistenteQuery.rows[0];
      novaQuantidade = item.quantidade + quantidade;

      // 4. VERIFICA ESTOQUE
      if (novaQuantidade > estoque) {
        throw new Error('Estoque insuficiente para a quantidade solicitada.');
      }
      
      // 5. ATUALIZA a quantidade do item
      await client.query(
        'UPDATE item_carrinho SET quantidade = $1, preco_unitario = $2 WHERE id_item = $3',
        [novaQuantidade, preco, item.id_item]
      );
    } else {
      // --- Se NÃO EXISTE: Vamos inserir ---
      novaQuantidade = quantidade;

      // 4. VERIFICA ESTOQUE
      if (novaQuantidade > estoque) {
        throw new Error('Estoque insuficiente para a quantidade solicitada.');
      }

      // 5. INSERE o novo item
      await client.query(
        'INSERT INTO item_carrinho (id_carrinho, id_produto, quantidade, preco_unitario) VALUES ($1, $2, $3, $4)',
        [id_carrinho, id_produto, novaQuantidade, preco]
      );
    }

    await client.query('COMMIT'); // Confirma todas as operações
    res.status(201).json({ message: 'Item adicionado ao carrinho com sucesso.' });

  } catch (err) {
    await client.query('ROLLBACK'); // Desfaz tudo em caso de erro
    console.error('Erro ao adicionar item:', err.message);
    // Retorna a mensagem de erro específica (ex: 'Estoque insuficiente')
    res.status(400).json({ error: err.message || 'Erro ao adicionar item ao carrinho.' });
  } finally {
    client.release(); // Libera a conexão
  }
};


// --- Buscar o Carrinho Ativo do Cliente (com itens e total) ---
exports.getMeuCarrinho = async (req, res) => {
  const id_cliente = req.cliente.id;

  try {
    // Este JOIN complexo busca o carrinho, os itens e os detalhes dos produtos
    const query = `
      SELECT
        c.id_carrinho,
        c.status,
        ic.id_item,
        ic.quantidade,
        ic.preco_unitario,
        p.id_produto,
        p.nome AS nome_produto,
        p.logo,
        (ic.quantidade * ic.preco_unitario) AS subtotal_item
      FROM carrinho c
      JOIN item_carrinho ic ON c.id_carrinho = ic.id_carrinho
      JOIN produto p ON ic.id_produto = p.id_produto
      WHERE c.id_cliente = $1 AND c.status = 'aberto'
      ORDER BY p.nome;
    `;
    const { rows } = await db.query(query, [id_cliente]);

    // Se não houver linhas, o carrinho está vazio
    if (rows.length === 0) {
      return res.status(200).json({
        carrinho: null,
        items: [],
        total: "0.00"
      });
    }

    // Calcula o total
    const total = rows
      .reduce((acc, item) => acc + parseFloat(item.subtotal_item), 0)
      .toFixed(2);

    const carrinhoInfo = {
      id_carrinho: rows[0].id_carrinho,
      status: rows[0].status
    };

    res.status(200).json({ carrinho: carrinhoInfo, items: rows, total: total });

  } catch (err) {
    console.error('Erro ao buscar carrinho:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};


// --- Atualizar Quantidade de um Item ---
exports.updateItemQuantidade = async (req, res) => {
  const id_cliente = req.cliente.id;
  const { id_item } = req.params; // ID do item_carrinho
  const { quantidade } = req.body;

  if (!quantidade || quantidade <= 0) {
    // Se a quantidade for 0 ou menos, use a rota de remoção
    return res.status(400).json({ error: 'Quantidade deve ser maior que 0. Para remover, use a rota DELETE.' });
  }

  try {
    // 1. Pegar o ID do produto e estoque para verificar
    // (Esta query também valida se o item pertence ao cliente)
    const itemInfoQuery = `
      SELECT ic.id_produto, p.estoque
      FROM item_carrinho ic
      JOIN produto p ON ic.id_produto = p.id_produto
      JOIN carrinho c ON ic.id_carrinho = c.id_carrinho
      WHERE ic.id_item = $1 AND c.id_cliente = $2 AND c.status = 'aberto';
    `;
    const { rows: itemInfo } = await db.query(itemInfoQuery, [id_item, id_cliente]);

    if (itemInfo.length === 0) {
      return res.status(404).json({ error: 'Item não encontrado no seu carrinho.' });
    }

    // 2. Verificar estoque
    const { estoque } = itemInfo[0];
    if (quantidade > estoque) {
      return res.status(400).json({ error: 'Estoque insuficiente.' });
    }

    // 3. Atualizar a quantidade
    const { rows } = await db.query(
      'UPDATE item_carrinho SET quantidade = $1 WHERE id_item = $2 RETURNING *',
      [quantidade, id_item]
    );

    res.status(200).json(rows[0]);

  } catch (err) {
    console.error('Erro ao atualizar item:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};


// --- Remover Item do Carrinho ---
exports.removeItemDoCarrinho = async (req, res) => {
  const id_cliente = req.cliente.id;
  const { id_item } = req.params; // ID do item_carrinho

  try {
    // Esta query complexa garante que só deletemos um item
    // que pertença a um carrinho 'aberto' do cliente logado.
    const query = `
      DELETE FROM item_carrinho
      WHERE id_item = $1
      AND id_carrinho = (
        SELECT id_carrinho
        FROM carrinho
        WHERE id_cliente = $2 AND status = 'aberto'
      )
      RETURNING *;
    `;
    const { rows } = await db.query(query, [id_item, id_cliente]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Item não encontrado no seu carrinho.' });
    }

    res.status(200).json({ message: 'Item removido com sucesso.', item: rows[0] });

  } catch (err) {
    console.error('Erro ao remover item:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};