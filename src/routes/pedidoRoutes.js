const express = require('express');
const router = express.Router();
const pedidoController = require('../controllers/pedidoController');
const { protectCliente, protectAdmin } = require('../middleware/authMiddleware');

router.post('/checkout', protectCliente, pedidoController.createPedidoFromCarrinho);
router.get('/pedidos', protectAdmin, pedidoController.getAllPedidos);
router.put('/pedidos/:id', protectAdmin, pedidoController.updatePedidoStatus);

module.exports = router;