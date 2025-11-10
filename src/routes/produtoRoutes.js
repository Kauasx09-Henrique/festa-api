// src/routes/produtoRoutes.js
const express = require('express');
const router = express.Router();
const produtoController = require('../controllers/produtoController');
const { protectEmpresa, protectAdmin } = require('../middleware/authMiddleware');
const upload = require('../config/multerConfig');

router.get('/produtos', produtoController.getProdutos);
router.get('/produtos/:id', produtoController.getProdutoPorId);

router.post(
  '/produtos', 
  protectEmpresa, 
  upload.single('logo'), 
  produtoController.createProduto
);

router.put(
  '/produtos/:id', 
  protectEmpresa, 
  upload.single('logo'), 
  produtoController.updateProduto
);

router.delete('/produtos/:id', protectAdmin, produtoController.deleteProduto);

module.exports = router;