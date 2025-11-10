// src/controllers/clienteController.js
const db = require('../config/db'); // Nosso pool de conexão
const bcrypt = require('bcryptjs');

// --- CREATE (O que já fizemos) ---
exports.createCliente = async (req, res) => {
  const {
    nome, cpf, email, telefone, senha,
    cep, logradouro, numero, complemento, bairro, cidade, estado
  } = req.body;

  if (!nome || !cpf || !email || !senha || !cep || !logradouro) {
    return res.status(400).json({ error: 'Dados obrigatórios faltando.' });
  }

  const salt = await bcrypt.genSalt(10);
  const senhaHash = await bcrypt.hash(senha, salt);

  const client = await db.pool.connect(); // Pega uma conexão do pool

  try {
    await client.query('BEGIN'); // Inicia a transação
  // Etapa 1: Inserir Endereço
    const endQuery = `
      INSERT INTO endereco (cep, logradouro, numero, complemento, bairro, cidade, estado)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id_endereco;
    `;
    const endValues = [cep, logradouro, numero, complemento, bairro, cidade, estado];
    const resEndereco = await client.query(endQuery, endValues);
    const idEndereco = resEndereco.rows[0].id_endereco;

    // Etapa 2: Inserir Cliente
    const cliQuery = `
      INSERT INTO cliente (nome, cpf, email, telefone, senha, id_endereco)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id_cliente, nome, email, cpf;
    `;
    const cliValues = [nome, cpf, email, telefone, senhaHash, idEndereco];
    const resCliente = await client.query(cliQuery, cliValues);

    await client.query('COMMIT'); // Confirma a transação
    res.status(201).json({
      message: 'Cliente criado com sucesso!',
      cliente: resCliente.rows[0]
    });

  } catch (err) {
    await client.query('ROLLBACK'); // Reverte em caso de erro
    console.error('Erro ao criar cliente:', err.message);
    if (err.code === '23505') { // unique_violation
       return res.status(409).json({ error: `Erro: ${err.constraint} já existe.` });
    }
    res.status(500).json({ error: 'Erro interno do servidor.' });
  } finally {
    client.release(); // Libera a conexão
  }
};

// --- READ (Obter Todos os Clientes) ---
exports.getClientes = async (req, res) => {
  try {
    // Vamos trazer os clientes SEM o endereço para não poluir a lista
    const { rows } = await db.query('SELECT id_cliente, nome, cpf, email, telefone FROM cliente ORDER BY nome ASC');
    res.status(200).json(rows);
  } catch (err) {
    console.error('Erro ao buscar clientes:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// --- READ (Obter Cliente por ID com Endereço) ---
exports.getClientePorId = async (req, res) => {
  const { id } = req.params;
  try {
    // Usamos JOIN para buscar o cliente E seu endereço
    const query = `
      SELECT c.*, e.cep, e.logradouro, e.numero, e.complemento, e.bairro, e.cidade, e.estado
      FROM cliente c
      INNER JOIN endereco e ON c.id_endereco = e.id_endereco
      WHERE c.id_cliente = $1;
    `;
    const { rows } = await db.query(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado.' });
    }
    
    // Remove a senha do objeto antes de enviar
    delete rows[0].senha; 
    
    res.status(200).json(rows[0]);
  } catch (err) {
    console.error('Erro ao buscar cliente por ID:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// --- UPDATE (Atualizar Cliente) ---
// Observação: Esta função atualiza dados simples.
// Mudar senha ou endereço deve ter rotas próprias (ex: /clientes/:id/mudar-senha)
exports.updateCliente = async (req, res) => {
  const { id } = req.params;
  const { nome, cpf, email, telefone } = req.body;

  if (!nome || !cpf || !email) {
    return res.status(400).json({ error: 'Nome, CPF e Email são obrigatórios.' });
  }

  try {
    const query = `
      UPDATE cliente
      SET nome = $1, cpf = $2, email = $3, telefone = $4
      WHERE id_cliente = $5
      RETURNING id_cliente, nome, cpf, email, telefone;
    `;
    const values = [nome, cpf, email, telefone, id];
    const { rows } = await db.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado.' });
    }

    res.status(200).json(rows[0]);

  } catch (err) {
    console.error('Erro ao atualizar cliente:', err);
    if (err.code === '23505') { // unique_violation (cpf ou email)
       return res.status(409).json({ error: `Erro: ${err.constraint} já existe.` });
    }
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// --- DELETE (Deletar Cliente e Endereço) ---
exports.deleteCliente = async (req, res) => {
  const { id } = req.params;
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // Etapa 1: Deletar o cliente e pegar o id_endereco dele
    const delCliQuery = 'DELETE FROM cliente WHERE id_cliente = $1 RETURNING id_endereco, nome;';
    const { rows } = await client.query(delCliQuery, [id]);

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cliente não encontrado.' });
    }

    const idEndereco = rows[0].id_endereco;
    const nomeCliente = rows[0].nome;

    // Etapa 2: Deletar o endereço associado
    await client.query('DELETE FROM endereco WHERE id_endereco = $1;', [idEndereco]);

    await client.query('COMMIT');
    res.status(200).json({ message: `Cliente '${nomeCliente}' e seu endereço foram deletados.` });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao deletar cliente:', err);
    // Erro se o cliente tiver um carrinho (foreign key)
    if (err.code === '23503') {
      return res.status(409).json({ error: 'Cliente não pode ser deletado pois possui carrinhos associados.' });
    }
    res.status(500).json({ error: 'Erro interno do servidor.' });
  } finally {
    client.release();
  }
};