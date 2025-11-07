import express from "express";
import bodyParser from "body-parser";
import fs from "fs-extra";
import fetch from "node-fetch";
import dotenv from "dotenv";
import session from "express-session";
import cookieParser from "cookie-parser";
import bcrypt from "bcrypt";
import path from "path";

dotenv.config();

const app = express();
const saltRounds = 10;

// Middleware'ler
app.use(bodyParser.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "default_secret_key_lütfen_değiştirin",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 86400000 }, // 1 gün
  })
);

const USERS_PATH = "./data/users.json";
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

// Helper Fonksiyonlar
async function readUsers() {
  try {
    const data = await fs.readFile(USERS_PATH, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeUsers(users) {
  await fs.writeFile(USERS_PATH, JSON.stringify(users, null, 2));
}

// Yetkilendirme Middleware'leri
const checkAuth = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.status(401).json({ message: "Lütfen giriş yapın." });
  }
};

const checkAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ message: "Bu işlem için yetkiniz yok." });
  }
};


// --- API Rotaları ---

// --- API: Oturum Durumunu Kontrol Et ---
app.get("/api/session", (req, res) => {
  if (req.session.user) {
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    res.json({ loggedIn: false });
  }
});


// --- API: Kayıt ol ---
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "Kullanıcı adı ve şifre zorunludur." });
  }

  const users = await readUsers();
  if (users.find((u) => u.username === username)) {
    return res.status(400).json({ message: "Bu kullanıcı zaten kayıtlı." });
  }

  const hashedPassword = await bcrypt.hash(password, saltRounds);
  users.push({ username, password: hashedPassword, blocked: false });
  await writeUsers(users);
  res.status(201).json({ message: "Kayıt başarılı." });
});

// --- API: Giriş yap ---
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  // Admin girişi
  if (username === "admin" && password === "Ferhat4755__") {
    req.session.user = { username: "admin", role: "admin" };
    return res.json({ role: "admin" });
  }

  // Kullanıcı girişi
  const users = await readUsers();
  const user = users.find((u) => u.username === username);

  if (!user) {
    return res.status(401).json({ message: "Kullanıcı bulunamadı veya şifre yanlış." });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(401).json({ message: "Kullanıcı bulunamadı veya şifre yanlış." });
  }

  if (user.blocked) {
    return res.status(403).json({ message: "Hesabınız engellenmiş." });
  }

  req.session.user = { username: user.username, role: "user" };
  res.json({ role: "user" });
});

// --- API: Çıkış yap ---
app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ message: "Çıkış yapılamadı." });
        }
        res.clearCookie('connect.sid');
        res.json({ message: "Başarıyla çıkış yapıldı." });
    });
});


// --- API: Kullanıcıları listele (Admin Paneli) ---
app.get("/api/users", checkAuth, checkAdmin, async (req, res) => {
  const users = (await readUsers()).filter(u => u.username !== 'admin');
  res.json(users);
});

// --- API: Kullanıcıyı sil ---
app.delete("/api/users/:username", checkAuth, checkAdmin, async (req, res) => {
  const username = req.params.username;
  let users = await readUsers();
  users = users.filter((u) => u.username !== username);
  await writeUsers(users);
  res.json({ message: "Kullanıcı silindi." });
});

// --- API: Kullanıcı engelle ---
app.post("/api/users/block", checkAuth, checkAdmin, async (req, res) => {
  const { username, blocked } = req.body;
  const users = await readUsers();
  const user = users.find((u) => u.username === username);
  if (user) {
    user.blocked = blocked;
    await writeUsers(users);
    res.json({ message: blocked ? "Kullanıcı engellendi." : "Kullanıcının engeli kaldırıldı." });
  } else {
    res.status(404).json({ message: "Kullanıcı bulunamadı." });
  }
});

// --- API: Kimya Sorusu Çöz ---
app.post("/api/solve", checkAuth, async (req, res) => {
  const { parts } = req.body;
  const payload = {
    contents: [{ role: "user", parts }],
    systemInstruction: {
      parts: [
        {
          text: `Sen lise ve üniversite düzeyi kimya konularında uzman bir yapay zekasın.
Kullanıcının verdiği soruyu çöz, açıklayıcı anlat.
Yanıtını JSON formatında ver: {"konu": "...", "istenilen": "...", "verilenler": "...", "cozum": "...", "sonuc": "...", "konuOzet": "..."}.`
        }
      ]
    },
    tools: [{ google_search: {} }],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  try {
    const response = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("Gemini API Error:", errorText);
        return res.status(response.status).json({ error: `Gemini API hatası: ${errorText}` });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Server-side error:", err);
    res.status(500).json({ error: err.message });
  }
});


// Sayfa Yönlendirme ve Koruma
const protectedFile = (filePath) => (req, res) => {
    if (!req.session.user) {
        return res.redirect("/login.html");
    }
    // Admin sayfasına sadece admin erişebilir
    if (filePath.includes("admin.html") && req.session.user.role !== "admin") {
        return res.status(403).send("<h1>Bu sayfaya erişim yetkiniz yok.</h1><a href='/'>Ana Sayfa</a>");
    }
    res.sendFile(path.resolve(filePath));
};

app.get('/', protectedFile('public/index.html'));
app.get('/index.html', protectedFile('public/index.html'));
app.get('/library.html', protectedFile('public/library.html'));
app.get('/admin.html', protectedFile('public/admin.html'));


const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`✅ Server ${PORT} portunda çalışıyor`));
