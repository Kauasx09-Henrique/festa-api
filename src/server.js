require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path'); 

const clienteRoutes = require('./routes/clienteRoutes');
const produtoRoutes = require('./routes/produtoRoutes');
const empresaRoutes = require('./routes/empresaRoutes');
const authRoutes = require('./routes/authRoutes');
const carrinhoRoutes = require('./routes/carrinhoRoutes');
const pedidoRoutes = require('./routes/pedidoRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('API da Loja DB rodando!');
});

app.use('/api', clienteRoutes);
app.use('/api', produtoRoutes);
app.use('/api', empresaRoutes);
app.use('/api', authRoutes);
app.use('/api', carrinhoRoutes);
app.use('/api', pedidoRoutes);
app.use('/api', dashboardRoutes);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});