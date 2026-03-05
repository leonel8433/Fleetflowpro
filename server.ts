import express from "express";
import mysql from "mysql2/promise";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Configuração do Banco de Dados
  // Nota: Certifique-se de que as variáveis de ambiente estejam configuradas no AI Studio
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'test',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  // Rotas da API para 'produtos'

  // GET /api/produtos - Listar todos os produtos
  app.get("/api/produtos", async (req, res) => {
    try {
      const [rows] = await pool.query("SELECT * FROM produtos");
      res.json(rows);
    } catch (error: any) {
      console.error("Erro ao buscar produtos:", error);
      res.status(500).json({ error: "Erro ao buscar produtos no banco de dados" });
    }
  });

  // POST /api/produtos - Criar um novo produto
  app.post("/api/produtos", async (req, res) => {
    const { nome, preco, descricao } = req.body;
    
    if (!nome || preco === undefined) {
      return res.status(400).json({ error: "Nome e preço são campos obrigatórios" });
    }

    try {
      const [result]: any = await pool.query(
        "INSERT INTO produtos (nome, preco, descricao) VALUES (?, ?, ?)",
        [nome, preco, descricao || null]
      );
      
      res.status(201).json({ 
        message: "Produto criado com sucesso",
        id: result.insertId, 
        nome, 
        preco, 
        descricao 
      });
    } catch (error: any) {
      console.error("Erro ao inserir produto:", error);
      res.status(500).json({ error: "Erro ao salvar o produto no banco de dados" });
    }
  });

  // Rota de saúde da API
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "API está ativa" });
  });

  // Integração com Vite (Middleware para servir o frontend em desenvolvimento)
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Em produção, servir arquivos estáticos da pasta dist
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`API disponível em http://localhost:${PORT}/api/produtos`);
  });
}

startServer().catch((err) => {
  console.error("Falha ao iniciar o servidor:", err);
});
