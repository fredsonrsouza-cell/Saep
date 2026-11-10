const express = require('express');
const session = require('express-session');
const multer = require('multer');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const pool = mysql.createPool({
  // 127.0.0.1 (e não 'localhost'): no Node 17+ 'localhost' pode virar ::1 (IPv6) e o MySQL/XAMPP não responde
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',          // ajuste se o seu MySQL tiver senha
  database: process.env.DB_NAME || 'saepvision',
  charset: 'utf8mb4'
});

const app = express();
app.use(express.json());
app.use(session({ secret: 'saepvision-segredo', resave: false, saveUninitialized: false }));
app.use(express.static(path.join(__dirname, 'public')));

const EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, 'public', 'uploads'),
    filename: (req, file, cb) => cb(null, 'u_' + Date.now() + path.extname(file.originalname).toLowerCase())
  })
});

const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const ERRO_LOGIN = 'Usuário não encontrado ou senha incorreta';

async function lista(uid, where, params) {
  const [rows] = await pool.query(
    `SELECT p.id, p.titulo, p.local, p.imagem, u.usuario,
       (SELECT COUNT(*) FROM curtidas c WHERE c.publicacao_id = p.id) AS curtidas,
       EXISTS(SELECT 1 FROM curtidas c WHERE c.publicacao_id = p.id AND c.usuario_id = ?) AS curtiu
     FROM publicacoes p JOIN usuarios u ON u.id = p.usuario_id ${where} ORDER BY p.id DESC`,
    [uid || 0, ...params]);
  return rows.map(r => ({ ...r, curtidas: Number(r.curtidas), curtiu: !!r.curtiu }));
}

// escolhe o multer só para a ação de cadastro (multipart)
app.all('/api', (req, res, next) => req.query.acao === 'cadastrar' ? upload.single('imagem')(req, res, next) : next());

app.all('/api', async (req, res) => {
  const acao = req.query.acao || '';
  const body = req.body || {};
  const out = (d, c = 200) => res.status(c).json(d);
  try {
    let u = null;
    if (req.session.uid) {
      const [r] = await pool.query('SELECT id, nome, usuario, tipo, foto FROM usuarios WHERE id = ?', [req.session.uid]);
      u = r[0] || null;
    }
    const soLogado = () => { if (!u) { out({ erro: 'Não autenticado' }, 401); return false; } return true; };
    const soFotografo = () => {
      if (!soLogado()) return false;
      if (u.tipo !== 'fotografo') { out({ erro: 'Apenas fotógrafos' }, 403); return false; }
      return true;
    };

    switch (acao) {
      case 'sessao': return out({ usuario: u });

      case 'login': {
        const email = String(body.email || '').trim(), senha = String(body.senha || '');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !senha) return out({ erro: ERRO_LOGIN }, 401);
        const [r] = await pool.query('SELECT id, nome, usuario, tipo, foto, senha FROM usuarios WHERE email = ?', [email]);
        if (!r[0] || r[0].senha !== sha256(senha)) return out({ erro: ERRO_LOGIN }, 401);
        const { senha: _, ...usuario } = r[0];
        return req.session.regenerate(() => { req.session.uid = usuario.id; out({ usuario }); });
      }

      case 'logout': return req.session.destroy(() => out({ ok: true }));

      case 'publicacoes': {
        const f = String(req.query.fotografo || '').trim().replace(/^@/, '');
        if (f) {
          const [r] = await pool.query("SELECT id FROM usuarios WHERE usuario = ? AND tipo = 'fotografo'", [f]);
          if (!r[0]) return out({ erro: 'Fotógrafo não encontrado' }, 404);
          return out(await lista(u && u.id, 'WHERE u.usuario = ?', [f]));
        }
        return out(await lista(u && u.id, '', []));
      }

      case 'minhas':
        if (!soFotografo()) return;
        return out(await lista(u.id, 'WHERE p.usuario_id = ?', [u.id]));

      case 'perfil': {
        if (!soFotografo()) return;
        const [[l]] = await pool.query('SELECT COUNT(*) AS n FROM curtidas c JOIN publicacoes p ON p.id = c.publicacao_id WHERE p.usuario_id = ?', [u.id]);
        const [[p]] = await pool.query('SELECT COUNT(*) AS n FROM publicacoes WHERE usuario_id = ?', [u.id]);
        return out({ likes: Number(l.n), publicacoes: Number(p.n) });
      }

      case 'curtir': { // alterna: nova curtida (máx. 1 por publicação) ou remoção da curtida do próprio usuário
        if (!soLogado()) return;
        const id = Number(body.id) || 0;
        const [r] = await pool.query('SELECT id FROM curtidas WHERE usuario_id = ? AND publicacao_id = ?', [u.id, id]);
        if (r[0]) await pool.query('DELETE FROM curtidas WHERE usuario_id = ? AND publicacao_id = ?', [u.id, id]);
        else await pool.query('INSERT IGNORE INTO curtidas (usuario_id, publicacao_id) VALUES (?, ?)', [u.id, id]);
        return out({ ok: true });
      }

      case 'cadastrar': {
        const apagaArquivo = () => { if (req.file) fs.unlink(req.file.path, () => {}); };
        if (!soFotografo()) return apagaArquivo();
        const e = {};
        const titulo = String(req.body.titulo || '').trim(), local = String(req.body.local || '').trim();
        if (!titulo) e.titulo = 'O título da imagem é obrigatório';
        if (!local) e.local = 'O local onde foi tirada é obrigatório';
        if (!req.file) e.imagem = 'Selecione uma imagem';
        else if (!EXTS.includes(path.extname(req.file.originalname).toLowerCase()) || !req.file.mimetype.startsWith('image/'))
          e.imagem = 'Formato inválido. Use JPG, JPEG, PNG, GIF ou WEBP';
        if (Object.keys(e).length) { apagaArquivo(); return out({ erros: e }, 422); }
        await pool.query('INSERT INTO publicacoes (usuario_id, titulo, local, imagem) VALUES (?, ?, ?, ?)',
          [u.id, titulo, local, 'uploads/' + req.file.filename]);
        return out({ ok: true });
      }

      case 'excluir': {
        if (!soFotografo()) return;
        const id = Number(body.id) || 0;
        const [r] = await pool.query('SELECT imagem FROM publicacoes WHERE id = ? AND usuario_id = ?', [id, u.id]);
        if (!r[0]) return out({ erro: 'Publicação não encontrada' }, 404);
        await pool.query('DELETE FROM publicacoes WHERE id = ?', [id]);
        if (r[0].imagem.startsWith('uploads/u_')) fs.unlink(path.join(__dirname, 'public', r[0].imagem), () => {});
        return out({ ok: true });
      }

      default: return out({ erro: 'Ação inválida' }, 400);
    }
  } catch (err) {
    console.error(err);
    out({ erro: 'Erro no servidor' }, 500);
  }
});

// testa o banco ao iniciar, para o erro aparecer claro no terminal
// remove publicações antigas de exemplo (imagens .svg sem foto) que ainda estejam no banco
pool.query("DELETE FROM publicacoes WHERE imagem LIKE 'uploads/foto_.svg'")
  .then(([r]) => { if (r.affectedRows) console.log('Publicações de exemplo removidas:', r.affectedRows); })
  .then(() => pool.query('SELECT COUNT(*) AS n FROM usuarios'))
  .then(([r]) => console.log('Banco OK - usuários cadastrados:', r[0].n))
  .catch(e => console.error('\n*** FALHA NO BANCO DE DADOS ***\n' + e.code + ' - ' + e.message +
    '\nVerifique: MySQL ligado? saepvision.sql importado? usuário/senha corretos no server.js?\n'));

app.listen(3000, () => console.log('SAEPVision rodando em http://localhost:3000'));
