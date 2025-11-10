// src/routes/carrinhoRoutes.js
const express = require('express');
const router = express.Router();
const carrinhoController = require('../controllers/carrinhoController');
const { protectCliente } = require('../middleware/authMiddleware');

// --- APLICAR O MIDDLEWARE DE AUTENTICAÇÃO EM TODAS AS ROTAS ABAIXO ---
router.use(protectCliente);

// GET /api/carrinho - Buscar o carrinho atual do cliente
router.get('/carrinho', carrinhoController.getMeuCarrinho);

// POST /api/carrinho - Adicionar um item ao carrinho
router.post('/carrinho', carrinhoController.addItemAoCarrinho);

// PUT /api/carrinho/item/:id_item - Atualizar a quantidade de um item
router.put('/carrinho/item/:id_item', carrinhoController.updateItemQuantidade);

// DELETE /api/carrinho/item/:id_item - Remover um item do carrinho
router.delete('/carrinho/item/:id_item', carrinhoController.removeItemDoCarrinho);

module.exports = router;