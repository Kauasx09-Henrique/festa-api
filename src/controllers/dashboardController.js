
const db = require('../config/db');
exports.getStats = async (req, res) => {
    try {
        const totalVendasQuery = await db.query(
            "SELECT SUM(total_pedido) as total FROM pedidos WHERE status_pedido = 'Concluído'"
        );
        const totalPedidosQuery = await db.query(
            "SELECT COUNT(id_pedido) as total FROM pedidos"
        );
        const totalClientesQuery = await db.query(
            "SELECT COUNT(id_cliente) as total FROM cliente"
        );
        const topProdutosQuery = await db.query(`
      SELECT p.nome, SUM(pi.quantidade) as total_vendido
      FROM pedido_itens pi
      JOIN produto p ON pi.id_produto = p.id_produto
      GROUP BY p.nome
      ORDER BY total_vendido DESC
      LIMIT 5;
    `);

        res.status(200).json({
            totalVendas: totalVendasQuery.rows[0].total || 0,
            totalPedidos: totalPedidosQuery.rows[0].total || 0,
            totalClientes: totalClientesQuery.rows[0].total || 0,
            topProdutos: topProdutosQuery.rows,
        });
    } catch (err) {
        console.error('Erro ao buscar estatísticas:', err);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
};