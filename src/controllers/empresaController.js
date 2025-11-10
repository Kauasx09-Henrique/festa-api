const db = require('../config/db');
const bcrypt = require('bcryptjs');

exports.createEmpresa = async (req, res) => {
  const {
    nome, cnpj, telefone, email, tipo, senha,
    cep, logradouro, numero, complemento, bairro, cidade, estado
  } = req.body;

  if (!nome || !cnpj || !cep || !logradouro || !email || !senha) {
    return res.status(400).json({ error: 'Nome, CNPJ, Email, Senha, CEP e Logradouro são obrigatórios.' });
  }

  const salt = await bcrypt.genSalt(10);
  const senhaHash = await bcrypt.hash(senha, salt);

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const endQuery = `
      INSERT INTO endereco (cep, logradouro, numero, complemento, bairro, cidade, estado)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id_endereco;
    `;
    const endValues = [cep, logradouro, numero, complemento, bairro, cidade, estado];
    const resEndereco = await client.query(endQuery, endValues);
    const idEndereco = resEndereco.rows[0].id_endereco;

    const empQuery = `
      INSERT INTO empresa (nome, cnpj, telefone, email, tipo, senha, id_endereco)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const empValues = [nome, cnpj, telefone, email, tipo || 'funcionario', senhaHash, idEndereco];
    const resEmpresa = await client.query(empQuery, empValues);

    await client.query('COMMIT');
    
    delete resEmpresa.rows[0].senha; 
    
    res.status(201).json({
      message: 'Empresa criada com sucesso!',
      empresa: resEmpresa.rows[0]
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao criar empresa:', err.message);
    if (err.code === '23505') { 
       return res.status(409).json({ error: `Erro: ${err.constraint} já existe.` });
    }
    res.status(500).json({ error: 'Erro interno do servidor.' });
  } finally {
    client.release();
  }
};

exports.getEmpresas = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id_empresa, nome, cnpj, email, tipo FROM empresa ORDER BY nome ASC');
    res.status(200).json(rows);
  } catch (err) {
    console.error('Erro ao buscar empresas:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

exports.getEmpresaPorId = async (req, res) => {
  const { id } = req.params;
  try {
    const query = `
      SELECT e.*, en.cep, en.logradouro, en.numero, en.complemento, en.bairro, en.cidade, en.estado
      FROM empresa e
      INNER JOIN endereco en ON e.id_endereco = en.id_endereco
      WHERE e.id_empresa = $1;
    `;
    const { rows } = await db.query(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Empresa não encontrada.' });
    }
    delete rows[0].senha;
    res.status(200).json(rows[0]);
  } catch (err) {
    console.error('Erro ao buscar empresa por ID:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

exports.updateEmpresa = async (req, res) => {
  const { id } = req.params;
  const { nome, cnpj, telefone, email, tipo } = req.body;

  if (!nome || !cnpj) {
    return res.status(400).json({ error: 'Nome e CNPJ são obrigatórios.' });
  }

  try {
    const query = `
      UPDATE empresa
      SET nome = $1, cnpj = $2, telefone = $3, email = $4, tipo = $5
      WHERE id_empresa = $6
      RETURNING *;
    `;
    const values = [nome, cnpj, telefone, email, tipo, id];
    const { rows } = await db.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Empresa não encontrada.' });
    }
    delete rows[0].senha;
    res.status(200).json(rows[0]);

  } catch (err) {
    console.error('Erro ao atualizar empresa:', err);
    if (err.code === '23505') {
       return res.status(409).json({ error: `Erro: ${err.constraint} já existe.` });
    }
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

exports.deleteEmpresa = async (req, res) => {
  const { id } = req.params;
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const delQuery = 'DELETE FROM empresa WHERE id_empresa = $1 RETURNING id_endereco, nome;';
    const { rows } = await client.query(delQuery, [id]);

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Empresa não encontrada.' });
    }

    const idEndereco = rows[0].id_endereco;
    const nomeEmpresa = rows[0].nome;

    await client.query('DELETE FROM endereco WHERE id_endereco = $1;', [idEndereco]);

    await client.query('COMMIT');
    res.status(200).json({ message: `Empresa '${nomeEmpresa}' e seu endereço foram deletados.` });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao deletar empresa:', err);
    if (err.code === '23503') {
      return res.status(409).json({ error: 'Empresa não pode ser deletada pois possui produtos associados.' });
    }
    res.status(500).json({ error: 'Erro interno do servidor.' });
  } finally {
    client.release();
  }
};