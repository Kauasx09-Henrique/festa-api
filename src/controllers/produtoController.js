const db = require('../config/db');

exports.createProduto = async (req, res) => {
  const { nome, descricao, preco, estoque, id_empresa } = req.body;
  
  let logoPath = null;
  if (req.file) {
    logoPath = req.file.path.replace(/\\/g, "/");
  }

  if (!nome || !preco || !id_empresa) {
    return res.status(400).json({ error: 'Nome, preço e id_empresa são obrigatórios.' });
  }

  try {
    const query = `
      INSERT INTO produto (nome, descricao, preco, estoque, logo, id_empresa)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const values = [nome, descricao, preco, estoque, logoPath, id_empresa];

    const { rows } = await db.query(query, values);
    res.status(201).json(rows[0]);

  } catch (err) {
    console.error('Erro ao criar produto:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

exports.getProdutos = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM produto ORDER BY nome ASC');
    res.status(200).json(rows);
  } catch (err) {
    console.error('Erro ao buscar produtos:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

exports.getProdutoPorId = async (req, res) => {
  const { id } = req.params; 
  try {
    const { rows } = await db.query('SELECT * FROM produto WHERE id_produto = $1', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }

    res.status(200).json(rows[0]);
  } catch (err) {
    console.error('Erro ao buscar produto por ID:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

exports.updateProduto = async (req, res) => {
  const { id } = req.params;
  const { nome, descricao, preco, estoque, id_empresa } = req.body;

  let logoPath = req.body.logo; 
  if (req.file) {
    logoPath = req.file.path.replace(/\\/g, "/");
  }

  if (!nome || !preco || !id_empresa) {
    return res.status(400).json({ error: 'Nome, preço e id_empresa são obrigatórios.' });
  }

  try {
    const query = `
      UPDATE produto
      SET nome = $1, descricao = $2, preco = $3, estoque = $4, logo = $5, id_empresa = $6
      WHERE id_produto = $7
      RETURNING *;
    `;
    const values = [nome, descricao, preco, estoque, logoPath, id_empresa, id];

    const { rows } = await db.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }

    res.status(200).json(rows[0]);

  } catch (err) {
    console.error('Erro ao atualizar produto:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

exports.deleteProduto = async (req, res) => {
  const { id } = req.params;

  try {
    const query = 'DELETE FROM produto WHERE id_produto = $1 RETURNING *;';
    const { rows } = await db.query(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }
    
    res.status(200).json({ message: 'Produto deletado com sucesso.', produto: rows[0] });

  } catch (err) {
    console.error('Erro ao deletar produto:', err);
    if (err.code === '23503') {
      return res.status(409).json({ error: 'Este produto não pode ser deletado, pois está associado a um carrinho.' });
    }
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};