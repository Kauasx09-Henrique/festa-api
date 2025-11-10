const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/auth/login-cliente', authController.loginCliente);
router.post('/auth/login-empresa', authController.loginEmpresa);

module.exports = router;