const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error('Variável de ambiente JWT_SECRET não definida!');
}

exports.loginCliente = async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
  }

  try {
    const { rows } = await db.query('SELECT * FROM cliente WHERE email = $1', [email]);
    const cliente = rows[0];

    if (!cliente) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const senhaCorreta = await bcrypt.compare(senha, cliente.senha);

    if (!senhaCorreta) {
      return res.status(401).json({ error: 'Email ou senha inválidos.' });
    }

    const payload = {
      cliente: {
        id: cliente.id_cliente,
        email: cliente.email
      }
    };

    const token = jwt.sign(payload, secret, {
      expiresIn: '7d',
    });

    res.status(200).json({
      message: 'Login bem-sucedido!',
      token: token
    });

  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

exports.loginEmpresa = async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
  }

  try {
    const { rows } = await db.query('SELECT * FROM empresa WHERE email = $1', [email]);
    const empresa = rows[0];

    if (!empresa) {
      return res.status(404).json({ error: 'Usuário da empresa não encontrado.' });
    }
    
    if (!empresa.senha) {
      return res.status(400).json({ error: 'Esta conta de empresa não tem uma senha configurada.' });
    }

    const senhaCorreta = await bcrypt.compare(senha, empresa.senha);

    if (!senhaCorreta) {
      return res.status(401).json({ error: 'Email ou senha inválidos.' });
    }

    const payload = {
      empresa: {
        id: empresa.id_empresa,
        email: empresa.email,
        tipo: empresa.tipo
      }
    };

    const token = jwt.sign(payload, secret, {
      expiresIn: '1d',
    });

    res.status(200).json({
      message: 'Login de administrador bem-sucedido!',
      token: token,
      empresa: {
        id: empresa.id_empresa,
        nome: empresa.nome,
        email: empresa.email,
        tipo: empresa.tipo
      }
    });

  } catch (err) {
    console.error('Erro no login da empresa:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};