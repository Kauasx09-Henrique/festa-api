const db = require('../config/db');

exports.createPedidoFromCarrinho = async (req, res) => {
  const id_cliente = req.cliente.id;
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const clienteQuery = await client.query('SELECT id_endereco FROM cliente WHERE id_cliente = $1', [id_cliente]);
    const id_endereco_entrega = clienteQuery.rows[0].id_endereco;

    const carrinhoQuery = await client.query(
      "SELECT id_carrinho FROM carrinho WHERE id_cliente = $1 AND status = 'aberto'",
      [id_cliente]
    );

    if (carrinhoQuery.rows.length === 0) {
      throw new Error('Carrinho vazio.');
    }
    const id_carrinho = carrinhoQuery.rows[0].id_carrinho;

    const itemsQuery = await client.query(
      'SELECT ic.*, p.estoque FROM item_carrinho ic JOIN produto p ON ic.id_produto = p.id_produto WHERE ic.id_carrinho = $1',
      [id_carrinho]
    );

    if (itemsQuery.rows.length === 0) {
      throw new Error('Carrinho vazio.');
    }
    const items = itemsQuery.rows;

    let total_pedido = 0;

    for (const item of items) {
      if (item.quantidade > item.estoque) {
        throw new Error(`Estoque insuficiente para o produto ID ${item.id_produto}.`);
      }
      total_pedido += item.preco_unitario * item.quantidade;
    }

    const pedidoInsert = await client.query(
      'INSERT INTO pedidos (id_cliente, id_endereco_entrega, total_pedido, status_pedido) VALUES ($1, $2, $3, $4) RETURNING id_pedido, data_pedido',
      [id_cliente, id_endereco_entrega, total_pedido, 'Processando']
    );
    const novoPedido = pedidoInsert.rows[0];

    for (const item of items) {
      await client.query(
        'INSERT INTO pedido_itens (id_pedido, id_produto, quantidade, preco_unitario_pago) VALUES ($1, $2, $3, $4)',
        [novoPedido.id_pedido, item.id_produto, item.quantidade, item.preco_unitario]
      );
      
      await client.query(
        'UPDATE produto SET estoque = estoque - $1 WHERE id_produto = $2',
        [item.quantidade, item.id_produto]
      );
    }

    await client.query("DELETE FROM item_carrinho WHERE id_carrinho = $1", [id_carrinho]);
    await client.query("UPDATE carrinho SET status = 'concluido' WHERE id_carrinho = $1", [id_carrinho]);

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Pedido realizado com sucesso!',
      pedido: novoPedido
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro no checkout:', err.message);
    res.status(400).json({ error: err.message || 'Erro ao processar pedido.' });
  } finally {
    client.release();
  }
};

exports.getAllPedidos = async (req, res) => {
  try {
    const query = `
      SELECT p.*, c.nome as nome_cliente, c.email as email_cliente
      FROM pedidos p
      JOIN cliente c ON p.id_cliente = c.id_cliente
      ORDER BY data_pedido DESC;
    `;
    const { rows } = await db.query(query);
    res.status(200).json(rows);
  } catch (err) {
    console.error('Erro ao buscar pedidos:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

exports.updatePedidoStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status é obrigatório.' });
  }

  try {
    const { rows } = await db.query(
      'UPDATE pedidos SET status_pedido = $1 WHERE id_pedido = $2 RETURNING *',
      [status, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    res.status(200).json(rows[0]);
  } catch (err) {
    console.error('Erro ao atualizar status:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

exports.getMeusPedidos = async (req, res) => {
  const id_cliente = req.cliente.id;

  try {
    const query = `
      SELECT
        p.id_pedido,
        p.data_pedido,
        p.total_pedido,
        p.status_pedido,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'nome_produto', pr.nome,
            'quantidade', pi.quantidade,
            'preco_pago', pi.preco_unitario_pago,
            'logo', pr.logo
          ))
          FROM pedido_itens pi
          JOIN produto pr ON pi.id_produto = pr.id_produto
          WHERE pi.id_pedido = p.id_pedido),
          '[]'::json
        ) as items
      FROM pedidos p
      WHERE p.id_cliente = $1
      ORDER BY p.data_pedido DESC;
    `;
    const { rows } = await db.query(query, [id_cliente]);
    res.status(200).json(rows);
  } catch (err) {
    console.error('Erro ao buscar pedidos do cliente:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};
exports.getMeuPedidoDetalhes = async (req, res) => {
  const id_cliente = req.cliente.id;
  const { id } = req.params;

  try {
    const pedidoQuery = await db.query(
      'SELECT * FROM pedidos WHERE id_pedido = $1 AND id_cliente = $2',
      [id, id_cliente]
    );

    if (pedidoQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado ou não pertence a você.' });
    }

    const itemsQuery = await db.query(
      `SELECT pi.*, p.nome as nome_produto, p.logo
       FROM pedido_itens pi
       JOIN produto p ON pi.id_produto = p.id_produto
       WHERE pi.id_pedido = $1`,
      [id]
    );

    res.status(200).json({
      pedido: pedidoQuery.rows[0],
      itens: itemsQuery.rows
    });

  } catch (err) {
    console.error('Erro ao buscar detalhes do pedido:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};