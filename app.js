const $ = s => document.querySelector(s);
const esc = t => String(t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const HEART = '<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
const TRASH = '<svg viewBox="0 0 24 24"><path d="M9 3h6l1 2h4v2H4V5h4l1-2zm-3 6h12l-1 12H7L6 9z"/></svg>';
let user = null, filtro = null, view = 'galeria', ultimo = '';

async function api(acao, opt = {}, qs = '') {
  try {
    const r = await fetch('/api?acao=' + acao + qs, opt);
    let d = {}; try { d = await r.json(); } catch (_) {}
    return { ok: r.ok, status: r.status, d };
  } catch (_) {
    return { ok: false, status: 0, d: { erro: 'Servidor indisponível' } };
  }
}
const post = (acao, body) => api(acao, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

/* ---------- sessão / cabeçalho ---------- */
function renderSessao() {
  $('#avatar').src = user ? user.foto : 'assets/perfis/saepvision.jpg';
  $('#nomeUsuario').textContent = user ? user.nome : '@SAEPVision';
  $('#btnPerfil').disabled = !(user && user.tipo === 'fotografo');
  $('#btnLogin').textContent = user ? 'Logout' : 'Login';
  $('#busca').placeholder = user ? 'Digite o nome do fotógrafo' : 'Digite o nome do fotógrafo... ex: @fotografo1';
}
async function logout() { await api('logout'); location.href = 'index.html'; }
$('#btnLogin').onclick = () => user ? logout() : abrirLogin();
$('#btnLogout').onclick = logout;
$('#empresa').onclick = () => { filtro = null; $('#busca').value = ''; $('#msgBusca').textContent = ''; mostrar('galeria'); };

/* ---------- login ---------- */
function abrirLogin() { $('#overlay').hidden = false; $('#email').focus(); }
function fecharLogin() { $('#overlay').hidden = true; $('#formLogin').reset(); ['#eEmail', '#eSenha', '#eLogin'].forEach(s => $(s).textContent = ''); }
$('#fecharLogin').onclick = $('#cancelar').onclick = fecharLogin;
$('#formLogin').onsubmit = async e => {
  e.preventDefault();
  const email = $('#email').value.trim(), senha = $('#senha').value;
  const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  $('#eEmail').textContent = okEmail ? '' : 'E-mail inválido ou vazio';
  $('#eSenha').textContent = senha ? '' : 'A senha é obrigatória';
  $('#eLogin').textContent = '';
  if (!okEmail || !senha) return;
  const { ok, status, d } = await post('login', { email, senha });
  if (!ok) {
    $('#eLogin').textContent = status === 401 ? 'Usuário não encontrado ou senha incorreta'
      : 'Erro no servidor/banco de dados. Veja o terminal do Node.';
    return;
  }
  user = d.usuario; fecharLogin(); renderSessao(); carregar(true);
};

/* ---------- galeria ---------- */
function cardHTML(p) {
  return `<article class="card"><div class="img"><img class="foto-pub" src="${esc(p.imagem)}" alt="${esc(p.titulo)}">
    <div class="tip">Foto tirada por: @${esc(p.usuario)}<br>Local: ${esc(p.local)}</div></div>
    <div class="info"><strong>${esc(p.titulo)}</strong>
    <button class="curtida ${p.curtiu ? 'sim' : ''}" data-id="${p.id}" aria-label="Curtir">${HEART}<span>${p.curtidas}</span></button></div></article>`;
}
async function carregar(forcar = false) {
  if (view === 'galeria') {
    const { ok, d } = await api('publicacoes', {}, filtro ? '&fotografo=' + encodeURIComponent(filtro) : '');
    if (!ok) return;
    const json = JSON.stringify(d);
    if (!forcar && json === ultimo) return;       // só redesenha se algo mudou (curtidas em tempo real)
    ultimo = json; $('#galeria').innerHTML = d.map(cardHTML).join('');
  } else if (user && user.tipo === 'fotografo') {
    const { d } = await api('minhas');
    $('#minhas').innerHTML = d.map(p => `<div class="minha"><span>${esc(p.titulo)}</span><button data-del="${p.id}" aria-label="Excluir">${TRASH}</button></div>`).join('');
  }
}
$('#galeria').onclick = async e => {
  const b = e.target.closest('.curtida'); if (!b) return;
  if (!user) return abrirLogin();
  await post('curtir', { id: +b.dataset.id }); carregar(true);
};

/* ---------- busca ---------- */
async function buscar() {
  if (!user) return abrirLogin();
  const v = $('#busca').value.trim().replace(/^@/, '');
  const msg = $('#msgBusca'); msg.textContent = '';
  if (v === '') { filtro = null; return carregar(true); }
  if (!/^[\w.]+$/.test(v)) { msg.textContent = 'Formato inválido (exemplo: fotografo1)'; return; }
  const { ok } = await api('publicacoes', {}, '&fotografo=' + encodeURIComponent(v));
  if (!ok) { msg.textContent = 'Fotógrafo não encontrado'; return; }
  filtro = v; carregar(true);
};
$('#btnBusca').onclick = buscar;
$('#busca').onkeydown = e => { if (e.key === 'Enter') buscar(); };
$('#busca').onfocus = e => { if (!user) { e.target.blur(); abrirLogin(); } };

/* ---------- menu lateral ---------- */
$('#btnPerfil').onclick = async () => {
  const { ok, d } = await api('perfil'); if (!ok) return;
  $('#menuFoto').src = user.foto; $('#menuNome').textContent = '@' + user.usuario;
  $('#menuLikes').textContent = d.likes + ' Likes';
  $('#menuPubs').textContent = d.publicacoes + ' Publicações';
  $('#menu').hidden = false; document.body.classList.add('menu-aberto');
};
$('#fecharMenu').onclick = () => { $('#menu').hidden = true; document.body.classList.remove('menu-aberto'); };
$('#btnSuas').onclick = () => mostrar('registro');
function mostrar(v) {
  view = v; $('#viewGaleria').hidden = v !== 'galeria'; $('#viewRegistro').hidden = v !== 'registro'; carregar(true);
}

/* ---------- registro de fotografia ---------- */
$('#arquivo').onchange = e => { $('#nomeArquivo').textContent = e.target.files[0] ? e.target.files[0].name : 'Nenhum arquivo escolhido'; };
$('#formFoto').onsubmit = async e => {
  e.preventDefault();
  const titulo = $('#titulo').value.trim(), local = $('#local').value.trim(), f = $('#arquivo').files[0];
  const ext = f ? f.name.split('.').pop().toLowerCase() : '';
  const erros = {
    eTitulo: titulo ? '' : 'O título da imagem é obrigatório',
    eLocal: local ? '' : 'O local onde foi tirada é obrigatório',
    eImagem: !f ? 'Selecione uma imagem' : (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? '' : 'Formato inválido. Use JPG, JPEG, PNG, GIF ou WEBP')
  };
  for (const k in erros) $('#' + k).textContent = erros[k];
  if (Object.values(erros).some(Boolean)) return;
  const fd = new FormData(); fd.append('titulo', titulo); fd.append('local', local); fd.append('imagem', f);
  const { ok, d } = await api('cadastrar', { method: 'POST', body: fd });
  if (!ok) { const m = d.erros || {}; $('#eTitulo').textContent = m.titulo || ''; $('#eLocal').textContent = m.local || ''; $('#eImagem').textContent = m.imagem || d.erro || ''; return; }
  e.target.reset(); $('#nomeArquivo').textContent = 'Nenhum arquivo escolhido';
  const p = await api('perfil'); if (p.ok) $('#menuPubs').textContent = p.d.publicacoes + ' Publicações';
  carregar(true);
};
$('#minhas').onclick = async e => {
  const b = e.target.closest('[data-del]'); if (!b) return;
  await post('excluir', { id: +b.dataset.del });
  const p = await api('perfil'); if (p.ok) { $('#menuPubs').textContent = p.d.publicacoes + ' Publicações'; $('#menuLikes').textContent = p.d.likes + ' Likes'; }
  carregar(true);
};

/* ---------- inicialização e atualização automática ---------- */
(async () => { const { d } = await api('sessao'); user = d.usuario || null; renderSessao(); carregar(true); setInterval(carregar, 3000); })();
