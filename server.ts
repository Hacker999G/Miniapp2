import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Telegram Bot Verification
  app.post("/api/telegram/check-member", async (req, res) => {
    const { botToken, userId, channelId } = req.body;
    if (!botToken || !userId || !channelId) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${channelId}&user_id=${userId}`);
      const data = await response.json();
      
      if (data.ok) {
        const status = data.result.status;
        const isMember = ["creator", "administrator", "member"].includes(status);
        res.json({ isMember });
      } else {
        res.status(400).json({ error: data.description });
      }
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // API Route for Telegram Notifications
  app.post("/api/telegram/send-message", async (req, res) => {
    const { botToken, chatId, text, parseMode, replyMarkup } = req.body;
    if (!botToken || !chatId || !text) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: parseMode || "HTML",
          reply_markup: replyMarkup
        })
      });
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('/admin.html', (req, res) => {
      res.sendFile(path.join(distPath, 'admin.html'));
    });
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
