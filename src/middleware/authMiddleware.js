const jwt = require('jsonwebtoken');
const secret = process.env.JWT_SECRET;

exports.protectCliente = (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Não autorizado. Token não fornecido.' });
  }

  try {
    const decoded = jwt.verify(token, secret);
    req.cliente = decoded.cliente;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token inválido.' });
  }
};

exports.protectEmpresa = (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Não autorizado. Token de empresa não fornecido.' });
  }

  try {
    const decoded = jwt.verify(token, secret);
    req.empresa = decoded.empresa;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token de empresa inválido.' });
  }
};

exports.protectAdmin = (req, res, next) => {
  exports.protectEmpresa(req, res, () => {
    if (req.empresa.tipo === 'admin') {
      next();
    } else {
      res.status(403).json({ error: 'Acesso negado. Requer privilégios de administrador.' });
    }
  });
};