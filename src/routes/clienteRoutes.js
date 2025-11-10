// src/routes/clienteRoutes.js
const express = require('express');
const router = express.Router();
const clienteController = require('../controllers/clienteController');

// CREATE - Criar um novo cliente (e seu endereço)
router.post('/clientes', clienteController.createCliente);

// READ - Obter todos os clientes
router.get('/clientes', clienteController.getClientes);

// READ - Obter um único cliente pelo ID (com endereço)
router.get('/clientes/:id', clienteController.getClientePorId);

// UPDATE - Atualizar dados de um cliente (exceto senha/endereço)
router.put('/clientes/:id', clienteController.updateCliente);

// DELETE - Deletar um cliente (e seu endereço)
router.delete('/clientes/:id', clienteController.deleteCliente);

module.exports = router;