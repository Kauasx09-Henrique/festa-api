const express = require('express');
const router = express.Router();
const pedidoController = require('../controllers/pedidoController');
const { protectCliente, protectAdmin } = require('../middleware/authMiddleware');

router.post('/checkout', protectCliente, pedidoController.createPedidoFromCarrinho);
router.get('/meus-pedidos', protectCliente, pedidoController.getMeusPedidos);

router.get('/meus-pedidos/:id', protectCliente, pedidoController.getMeuPedidoDetalhes);

router.get('/pedidos', protectAdmin, pedidoController.getAllPedidos);
router.put('/pedidos/:id', protectAdmin, pedidoController.updatePedidoStatus);

module.exports = router;