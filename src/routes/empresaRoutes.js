// src/routes/empresaRoutes.js
const express = require('express');
const router = express.Router();
const empresaController = require('../controllers/empresaController');

// CREATE
router.post('/empresas', empresaController.createEmpresa);

// READ (Todas)
router.get('/empresas', empresaController.getEmpresas);

// READ (Por ID)
router.get('/empresas/:id', empresaController.getEmpresaPorId);

// UPDATE
router.put('/empresas/:id', empresaController.updateEmpresa);

// DELETE
router.delete('/empresas/:id', empresaController.deleteEmpresa);

module.exports = router;