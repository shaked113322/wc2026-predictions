// ── State ─────────────────────────────────────────────────────────────────────
const State = {
  token:         null,
  username:      null,
  isAdmin:       false,
  currentMatch:  null,
  currentResult: null,
  scores:        [0, 0],
  resScores:     [0, 0],
  matches:       [],
  stats:         {},
  myPreds:       [],
  activeFilter:  'upcoming',
  activeTab:     'markets',
};

// ── Flags ─────────────────────────────────────────────────────────────────────
const FLAGS = {
  'Mexico':'🇲🇽','South Africa':'🇿🇦','South Korea':'🇰🇷','Czechia':'🇨🇿',
  'Canada':'🇨🇦','Bosnia-Herz.':'🇧🇦','Qatar':'🇶🇦','Switzerland':'🇨🇭',
  'Brazil':'🇧🇷','Morocco':'🇲🇦','Haiti':'🇭🇹','Scotland':'🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'USA':'🇺🇸','Paraguay':'🇵🇾','Australia':'🇦🇺','Türkiye':'🇹🇷',
  'Germany':'🇩🇪','Curaçao':'🇨🇼','Ivory Coast':'🇨🇮','Ecuador':'🇪🇨',
  'Netherlands':'🇳🇱','Japan':'🇯🇵','Sweden':'🇸🇪','Tunisia':'🇹🇳',
  'Belgium':'🇧🇪','Egypt':'🇪🇬','Iran':'🇮🇷','New Zealand':'🇳🇿',
  'Spain':'🇪🇸','Cape Verde':'🇨🇻','Saudi Arabia':'🇸🇦','Uruguay':'🇺🇾',
  'France':'🇫🇷','Senegal':'🇸🇳','Iraq':'🇮🇶','Norway':'🇳🇴',
  'Argentina':'🇦🇷','Algeria':'🇩🇿','Austria':'🇦🇹','Jordan':'🇯🇴',
  'Portugal':'🇵🇹','DR Congo':'🇨🇩','Uzbekistan':'🇺🇿','Colombia':'🇨🇴',
  'England':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Croatia':'🇭🇷','Ghana':'🇬🇭','Panama':'🇵🇦',
  'TBD':'❓',
};
const flag = t => FLAGS[t] || '🏳️';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T12:00:00');
  return dt.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' });
}

function stageLabel(s) {
  return { group:'Group Stage', r32:'Round of 32', r16:'Round of 16',
           qf:'Quarter-Final', sf:'Semi-Final', '3rd':'3rd Place', final:'Final 🏆' }[s] || s;
}

function avatar(name) {
  return name ? name.charAt(0).toUpperCase() : '?';
}

async function api(method, path, body, token) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers['Authorization'] = token;
  if (body)  opts.body = JSON.stringify(body);
  const res  = await fetch(path, opts);
  const data = await res.json();
  if (res.status === 401) {
    localStorage.clear();
    location.reload();
    throw new Error('Session expired');
  }
  if (!res.ok) throw new Error(data.error || 'Error');
  return data;
}

function showErr(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}
function hideErr(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

// ── Countdown helpers ─────────────────────────────────────────────────────────
let countdownInterval = null;

function startCountdowns() {
  if (countdownInterval) clearInterval(countdownInterval);
  updateCountdowns();
  countdownInterval = setInterval(updateCountdowns, 1000);
}

function updateCountdowns() {
  const now = Date.now();
  document.querySelectorAll('.countdown[data-kickoff]').forEach(el => {
    const kickoff = parseInt(el.dataset.kickoff, 10);
    const diff = kickoff - now;
    if (diff <= 0) {
      el.textContent = '🔴 LIVE';
      el.className = 'countdown live';
      return;
    }
    const totalMins = Math.floor(diff / 60000);
    const days  = Math.floor(totalMins / 1440);
    const hours = Math.floor((totalMins % 1440) / 60);
    const mins  = totalMins % 60;
    const secs  = Math.floor((diff % 60000) / 1000);

    let txt;
    if (days > 0)       txt = `${days}d ${hours}h`;
    else if (hours > 0) txt = `${hours}h ${mins}m`;
    else                txt = `${mins}m ${secs}s`;

    el.textContent = `⏱ ${txt}`;
    el.className = 'countdown' + (totalMins < 60 ? ' soon' : '');
  });
}

// ── Confetti ──────────────────────────────────────────────────────────────────
function showConfetti() {
  const colors = ['#ffd700','#ff6b6b','#4ecdc4','#45b7d1','#96ceb4','#ff9f43'];
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.cssText = `
      left:${Math.random()*100}vw;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      animation-duration:${0.8 + Math.random()*1.4}s;
      animation-delay:${Math.random()*0.5}s;
      width:${6 + Math.random()*8}px;
      height:${6 + Math.random()*8}px;
      border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
    `;
    document.body.appendChild(piece);
    piece.addEventListener('animationend', () => piece.remove());
  }
}

// ── App ───────────────────────────────────────────────────────────────────────
const App = {

  // ── Init ───────────────────────────────────────────────────────────────────
  init() {
    State.token    = localStorage.getItem('wc_token');
    State.username = localStorage.getItem('wc_username');
    State.isAdmin  = localStorage.getItem('wc_admin') === '1';
    State.adminKey = localStorage.getItem('wc_admin_key') || '';

    if (State.token && State.username) {
      this.enterApp();
    }

    document.getElementById('login-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') this.login();
    });

    document.querySelectorAll('.tab').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    document.querySelectorAll('.f-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.f-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        State.activeFilter = btn.dataset.filter;
        this.renderMarkets();
      });
    });

    document.getElementById('admin-key-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') this.submitAdminKey();
    });
  },

  // ── Login ──────────────────────────────────────────────────────────────────
  async login() {
    hideErr('login-error');
    const username = document.getElementById('login-input').value.trim();
    if (!username || username.length < 2)
      return showErr('login-error', 'Enter at least 2 characters');
    try {
      const data = await api('POST', '/api/login', { username });
      State.token    = data.token;
      State.username = data.username;
      localStorage.setItem('wc_token',    data.token);
      localStorage.setItem('wc_username', data.username);
      this.enterApp();
    } catch (e) {
      showErr('login-error', e.message);
    }
  },

  logout() {
    localStorage.clear();
    location.reload();
  },

  // ── Enter App ──────────────────────────────────────────────────────────────
  enterApp() {
    document.getElementById('screen-login').classList.remove('active');
    document.getElementById('screen-app').classList.add('active');
    document.getElementById('topbar-username').textContent = State.username;
    document.getElementById('user-avatar').textContent     = avatar(State.username);

    document.getElementById('admin-tab').style.display = '';

    if (State.isAdmin) {
      document.getElementById('pts-pill').style.display = 'none';
    }

    this.switchTab('markets');
    this.startPolling();
    this.refreshPoints();
  },

  // ── Points in topbar ───────────────────────────────────────────────────────
  async refreshPoints() {
    try {
      const preds = await api('GET', '/api/predictions', null, State.token);
      const pts   = preds.reduce((s, p) => s + (p.points || 0), 0);
      document.getElementById('topbar-pts').textContent = pts;
      document.getElementById('pts-pill').style.display = '';
    } catch (_) {}
  },

  // ── Tab switching ──────────────────────────────────────────────────────────
  switchTab(tab) {
    if (tab === 'admin' && !State.isAdmin) {
      this.openAdminModal();
      return;
    }

    State.activeTab = tab;
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));

    if (tab === 'markets')     this.loadMarkets();
    if (tab === 'leaderboard') this.loadLeaderboard();
    if (tab === 'mybets')      this.loadMyBets();
    if (tab === 'groups')      this.loadGroups();
    if (tab === 'admin')       this.loadAdmin();
  },

  // ── Polling + auto-sync ────────────────────────────────────────────────────
  startPolling() {
    this.syncData();
    setInterval(() => this.syncData(), 5 * 60 * 1000);

    setInterval(() => {
      if (State.activeTab === 'markets')     this.loadMarkets();
      if (State.activeTab === 'leaderboard') this.loadLeaderboard();
    }, 30000);
  },

  async syncData() {
    try {
      const data = await fetch('/api/sync').then(r => r.json());
      if (data.updated > 0) {
        await this.loadMarkets();
        this.refreshPoints();
        if (State.activeTab === 'leaderboard') this.loadLeaderboard();
      }
    } catch (_) {}
  },

  // ── MARKETS ────────────────────────────────────────────────────────────────
  async loadMarkets() {
    const el = document.getElementById('markets-list');
    try {
      const [matches, stats, myPreds] = await Promise.all([
        api('GET', '/api/matches'),
        api('GET', '/api/stats'),
        api('GET', '/api/predictions', null, State.token),
      ]);
      State.matches = matches;
      State.stats   = stats;
      State.myPreds = myPreds;
      this.renderMarkets();
    } catch (e) {
      el.innerHTML = `<div class="empty-msg">⚠️ ${e.message}</div>`;
    }
  },

  renderMarkets() {
    const el = document.getElementById('markets-list');
    const now = new Date();
    let list = State.matches;

    const f = State.activeFilter;
    if (f === 'upcoming')  list = list.filter(m => !m.completed && new Date(`${m.match_date}T${m.match_time}`) > now);
    if (f === 'group')     list = list.filter(m => m.stage === 'group');
    if (f === 'knockout')  list = list.filter(m => m.stage !== 'group');
    if (f === 'completed') list = list.filter(m => m.completed);

    if (!list.length) {
      el.innerHTML = '<div class="empty-msg">No matches to show</div>';
      return;
    }

    const predMap = {};
    State.myPreds.forEach(p => predMap[p.match_id] = p);

    let lastDate = null;
    el.innerHTML = list.map(m => {
      let sep = '';
      if (m.match_date !== lastDate) {
        lastDate = m.match_date;
        sep = `<div class="date-divider">${fmtDate(m.match_date)}</div>`;
      }
      return sep + this._marketCard(m, predMap[m.id]);
    }).join('');

    startCountdowns();
  },

  _marketCard(m, pred) {
    const isTBD = m.team1 === 'TBD';
    const s     = State.stats[m.id] || { team1pct:33, drawpct:34, team2pct:33, total:0 };
    const stageTxt = m.stage === 'group' ? m.group_name : stageLabel(m.stage);

    // Kickoff timestamp for countdown
    const kickoffMs = new Date(`${m.match_date}T${m.match_time || '12:00:00'}`).getTime();
    const now       = Date.now();
    const isLive    = !m.completed && kickoffMs <= now && (now - kickoffMs) < 2 * 60 * 60 * 1000;
    const upcoming  = !m.completed && kickoffMs > now;

    // Countdown html
    let countdownHtml = '';
    if (upcoming) {
      countdownHtml = `<span class="countdown" data-kickoff="${kickoffMs}">⏱</span>`;
    } else if (isLive) {
      countdownHtml = `<span class="countdown live">🔴 LIVE</span>`;
    }

    // Venue
    const venueHtml = m.venue ? `<div class="match-venue">📍 ${m.venue}</div>` : '';

    // Score display for completed matches
    let scoreHtml = '';
    if (m.completed) {
      scoreHtml = `<div class="market-result">${m.score1} : ${m.score2}</div>`;
    }

    // Outcome buttons
    let outcomesHtml = '';
    if (!isTBD && !m.completed) {
      const userOut = pred ? (pred.score1 > pred.score2 ? 'team1' : pred.score1 < pred.score2 ? 'team2' : 'draw') : null;
      const t1Short = m.team1.split(' ')[0];
      const t2Short = m.team2.split(' ')[0];
      outcomesHtml = `
        <div class="outcome-row">
          <button class="out-btn${userOut==='team1'?' selected':''}" onclick="App.openDrawer('${m.id}')">
            <span class="out-label">${t1Short}</span>
            <span class="out-pct">${s.team1pct}%</span>
          </button>
          <button class="out-btn${userOut==='draw'?' selected':''}" onclick="App.openDrawer('${m.id}')">
            <span class="out-label">Draw</span>
            <span class="out-pct">${s.drawpct}%</span>
          </button>
          <button class="out-btn${userOut==='team2'?' selected':''}" onclick="App.openDrawer('${m.id}')">
            <span class="out-label">${t2Short}</span>
            <span class="out-pct">${s.team2pct}%</span>
          </button>
        </div>
        <div class="dist-bar">
          <div class="dist-team1" style="width:${s.team1pct}%"></div>
          <div class="dist-draw"  style="width:${s.drawpct}%"></div>
          <div class="dist-team2" style="width:${s.team2pct}%"></div>
        </div>`;
    } else if (m.completed && !isTBD) {
      const correctOut = m.score1 > m.score2 ? 'team1' : m.score1 < m.score2 ? 'team2' : 'draw';
      const t1Short = m.team1.split(' ')[0];
      const t2Short = m.team2.split(' ')[0];
      outcomesHtml = `
        <div class="outcome-row">
          <button class="out-btn${correctOut==='team1'?' correct':''}" disabled>
            <span class="out-label">${t1Short}</span>
            <span class="out-pct">${s.team1pct}%</span>
          </button>
          <button class="out-btn${correctOut==='draw'?' correct':''}" disabled>
            <span class="out-label">Draw</span>
            <span class="out-pct">${s.drawpct}%</span>
          </button>
          <button class="out-btn${correctOut==='team2'?' correct':''}" disabled>
            <span class="out-label">${t2Short}</span>
            <span class="out-pct">${s.team2pct}%</span>
          </button>
        </div>
        <div class="dist-bar">
          <div class="dist-team1" style="width:${s.team1pct}%"></div>
          <div class="dist-draw"  style="width:${s.drawpct}%"></div>
          <div class="dist-team2" style="width:${s.team2pct}%"></div>
        </div>`;
    }

    // User's prediction badge
    let predBadge = '';
    if (pred && !isTBD) {
      if (m.completed) {
        const pts = pred.points || 0;
        const cls = pts === 3 ? 'badge-exact' : pts === 1 ? 'badge-correct' : 'badge-wrong';
        const icon = pts === 3 ? '✅' : pts === 1 ? '☑️' : '❌';
        predBadge = `<div class="pred-badge ${cls}">${icon} Your pick: ${pred.score1}–${pred.score2} · ${pts > 0 ? '+' + pts : '0'} pts</div>`;
      } else {
        predBadge = `<div class="pred-badge badge-pending">🎯 Your pick: ${pred.score1}–${pred.score2} · <span onclick="App.openDrawer('${m.id}')" class="edit-link">Edit</span></div>`;
      }
    } else if (!isTBD && !m.completed) {
      predBadge = `<div class="pred-badge badge-empty" onclick="App.openDrawer('${m.id}')">+ Add prediction</div>`;
    }

    // Actions row (see predictions button for completed matches)
    let actionsHtml = '';
    if (m.completed && !isTBD && s.total > 0) {
      actionsHtml = `
        <div class="card-actions">
          <button class="see-preds-btn" onclick="App.openMatchPreds('${m.id}')">👁 See everyone's predictions</button>
        </div>`;
    }

    return `
      <div class="market-card${m.completed ? ' completed' : ''}${isTBD ? ' tbd' : ''}">
        <div class="market-header">
          <span class="market-stage">${stageTxt}</span>
          <div class="market-header-right">
            ${countdownHtml}
            <span class="market-time">${fmtDate(m.match_date)} · ${m.match_time?.slice(0,5)} ET</span>
          </div>
        </div>
        <div class="market-teams">
          <div class="market-team">
            <span class="mflag">${flag(m.team1)}</span>
            <span class="mname">${m.team1}</span>
          </div>
          ${scoreHtml}
          <div class="market-team right">
            <span class="mname">${m.team2}</span>
            <span class="mflag">${flag(m.team2)}</span>
          </div>
        </div>
        ${venueHtml}
        ${outcomesHtml}
        ${predBadge}
        ${actionsHtml}
        ${s.total > 0 ? `<div class="market-meta">${s.total} prediction${s.total!==1?'s':''}</div>` : ''}
      </div>`;
  },

  // ── Predict Drawer ─────────────────────────────────────────────────────────
  openDrawer(matchId) {
    const m = State.matches.find(x => x.id === matchId || x._id === matchId);
    if (!m || m.completed) return;

    State.currentMatch = m;
    const pred = State.myPreds.find(p => p.match_id === matchId);
    State.scores = pred ? [pred.score1, pred.score2] : [0, 0];

    const stageTxt = m.stage === 'group' ? m.group_name : stageLabel(m.stage);
    document.getElementById('drawer-match-info').innerHTML =
      `<div class="drawer-teams">${flag(m.team1)} <b>${m.team1}</b> vs <b>${m.team2}</b> ${flag(m.team2)}</div>
       <div class="drawer-meta">${fmtDate(m.match_date)} · ${m.match_time?.slice(0,5)} ET · ${stageTxt}</div>`;

    const s = State.stats[matchId] || { team1pct:33, drawpct:34, team2pct:33, total:0 };
    document.getElementById('drawer-outcomes').innerHTML =
      `<div class="dist-summary">
         <span class="ds-item ds-t1">${m.team1.split(' ')[0]} ${s.team1pct}%</span>
         <span class="ds-item ds-draw">Draw ${s.drawpct}%</span>
         <span class="ds-item ds-t2">${s.team2pct}% ${m.team2.split(' ')[0]}</span>
       </div>`;

    document.getElementById('sc-team1').textContent = m.team1;
    document.getElementById('sc-team2').textContent = m.team2;
    document.getElementById('sc-val1').textContent  = State.scores[0];
    document.getElementById('sc-val2').textContent  = State.scores[1];

    const submitBtn = document.getElementById('drawer-submit');
    submitBtn.textContent = pred ? 'Update Prediction ⚡' : 'Save Prediction ⚡';

    hideErr('drawer-error');
    document.getElementById('drawer-overlay').style.display = '';
    document.getElementById('predict-drawer').style.display = '';
    document.getElementById('predict-drawer').classList.add('open');
  },

  closeDrawer() {
    document.getElementById('drawer-overlay').style.display  = 'none';
    document.getElementById('predict-drawer').style.display  = 'none';
    document.getElementById('predict-drawer').classList.remove('open');
    State.currentMatch = null;
  },

  stepScore(idx, delta) {
    State.scores[idx] = Math.max(0, (State.scores[idx] || 0) + delta);
    document.getElementById(`sc-val${idx + 1}`).textContent = State.scores[idx];
  },

  async submitPrediction() {
    const m = State.currentMatch;
    if (!m) return;
    hideErr('drawer-error');
    try {
      await api('POST', '/api/predictions', {
        token: State.token,
        match_id: m.id || m._id,
        score1: State.scores[0],
        score2: State.scores[1],
      });
      const s1 = State.scores[0], s2 = State.scores[1];
      const matchSnap = { ...m };
      this.closeDrawer();
      await this.loadMarkets();
      this.refreshPoints();
      // Show WhatsApp share prompt
      this._showShareDrawer(matchSnap, s1, s2);
    } catch (e) {
      showErr('drawer-error', e.message);
    }
  },

  // ── WhatsApp Share ─────────────────────────────────────────────────────────
  _showShareDrawer(m, s1, s2) {
    const text = `⚽ WC 2026 Prediction\n${flag(m.team1)} ${m.team1} ${s1} – ${s2} ${m.team2} ${flag(m.team2)}\n🎯 Predicted by ${State.username}\nJoin me: ${location.origin}`;
    const url  = `https://wa.me/?text=${encodeURIComponent(text)}`;

    // Insert a temporary share banner below the card
    const existing = document.getElementById('wa-share-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'wa-share-banner';
    banner.className = 'wa-share-banner';
    banner.innerHTML = `
      <span>Prediction saved! 🎉 Share it?</span>
      <a class="wa-btn" href="${url}" target="_blank" rel="noopener">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.117 1.524 5.852L0 24l6.336-1.498A11.96 11.96 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.647-.493-5.168-1.355l-.371-.219-3.762.888.927-3.648-.242-.381A9.944 9.944 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
        Share on WhatsApp
      </a>
      <button class="wa-dismiss" onclick="document.getElementById('wa-share-banner').remove()">✕</button>
    `;
    document.getElementById('markets-list').prepend(banner);
    setTimeout(() => { if (document.getElementById('wa-share-banner')) document.getElementById('wa-share-banner').remove(); }, 12000);
  },

  shareWhatsApp(matchId, s1, s2) {
    const m    = State.matches.find(x => x.id === matchId);
    if (!m) return;
    const text = `⚽ WC 2026 Prediction\n${flag(m.team1)} ${m.team1} ${s1} – ${s2} ${m.team2} ${flag(m.team2)}\n🎯 Predicted by ${State.username}\nJoin me: ${location.origin}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  },

  // ── Match Predictions Modal ────────────────────────────────────────────────
  async openMatchPreds(matchId) {
    const m = State.matches.find(x => x.id === matchId);
    if (!m) return;

    document.getElementById('match-preds-overlay').style.display = '';
    document.getElementById('match-preds-modal').style.display   = '';
    document.getElementById('match-preds-header').innerHTML = `
      <div class="mp-header">
        <div class="mp-match-teams">${flag(m.team1)} ${m.team1} <span class="mp-result">${m.score1}–${m.score2}</span> ${m.team2} ${flag(m.team2)}</div>
        <div class="mp-sub">What everyone predicted</div>
      </div>`;
    document.getElementById('match-preds-list').innerHTML = '<div class="empty-msg">Loading…</div>';

    try {
      const preds = await api('GET', `/api/match/${matchId}/predictions`, null, State.token);
      if (!preds.length) {
        document.getElementById('match-preds-list').innerHTML = '<div class="empty-msg">No predictions for this match</div>';
        return;
      }
      document.getElementById('match-preds-list').innerHTML = preds.map(p => {
        const pts = p.points || 0;
        const cls = pts === 3 ? 'mp-exact' : pts === 1 ? 'mp-correct' : 'mp-wrong';
        const icon = pts === 3 ? '✅' : pts === 1 ? '☑️' : '❌';
        const isMe = p.username === State.username;
        return `
          <div class="mp-row ${cls}${isMe ? ' mp-me' : ''}">
            <div class="mp-avatar">${avatar(p.username)}</div>
            <div class="mp-name">${p.username}${isMe ? ' <span class="you-tag">you</span>' : ''}</div>
            <div class="mp-score">${p.score1}–${p.score2}</div>
            <div class="mp-pts">${icon} +${pts}</div>
          </div>`;
      }).join('');
      if (preds.some(p => p.points === 3 && p.username === State.username)) {
        showConfetti();
      }
    } catch (e) {
      document.getElementById('match-preds-list').innerHTML = `<div class="empty-msg">⚠️ ${e.message}</div>`;
    }
  },

  closeMatchPreds() {
    document.getElementById('match-preds-overlay').style.display = 'none';
    document.getElementById('match-preds-modal').style.display   = 'none';
  },

  // ── Leaderboard ────────────────────────────────────────────────────────────
  async loadLeaderboard() {
    const el = document.getElementById('lb-list');
    el.innerHTML = '<div class="empty-msg">Loading…</div>';
    try {
      const board = await api('GET', '/api/leaderboard');
      if (!board.length) {
        el.innerHTML = '<div class="empty-msg">No players yet</div>';
        document.getElementById('lb-sub').textContent = '';
        return;
      }
      document.getElementById('lb-sub').textContent = `${board.length} player${board.length !== 1 ? 's' : ''}`;
      el.innerHTML = board.map((u, i) => {
        const medal = ['🥇','🥈','🥉'][i] || '';
        const isMe  = u.username === State.username;
        const streakBadge = u.streak >= 3
          ? `<span class="streak-badge">🔥 ${u.streak}</span>`
          : '';
        const accuracyTxt = u.predictions > 0
          ? `${Math.round((u.exact + u.correct) / u.predictions * 100)}% acc`
          : '';
        return `
          <div class="lb-row${isMe ? ' lb-me' : ''}">
            <div class="lb-rank">${medal || `<span class="rank-num">${i+1}</span>`}</div>
            <div class="lb-avatar">${avatar(u.username)}</div>
            <div class="lb-info">
              <div class="lb-name">${u.username}${isMe ? ' <span class="you-tag">you</span>' : ''} ${streakBadge}</div>
              <div class="lb-detail">${u.exact} exact · ${u.correct} correct · ${accuracyTxt}</div>
            </div>
            <div class="lb-pts">${u.total}<span class="pts-label">pts</span></div>
          </div>`;
      }).join('');
    } catch (e) {
      el.innerHTML = `<div class="empty-msg">⚠️ ${e.message}</div>`;
    }
  },

  // ── My Bets ────────────────────────────────────────────────────────────────
  async loadMyBets() {
    const el      = document.getElementById('mybets-list');
    const statsEl = document.getElementById('my-stats-grid');
    el.innerHTML      = '<div class="empty-msg">Loading…</div>';
    statsEl.innerHTML = '';

    try {
      const [preds, userStats] = await Promise.all([
        api('GET', '/api/predictions', null, State.token),
        api('GET', '/api/user/stats',   null, State.token),
      ]);

      // Stats grid
      if (userStats && userStats.predictions > 0) {
        const streakHtml = userStats.streak >= 3
          ? `<span class="streak-badge" style="font-size:0.75rem">🔥 ${userStats.streak}</span>`
          : userStats.streak || '—';
        statsEl.innerHTML = `
          <div class="stat-card">
            <div class="stat-val green">${userStats.accuracy ?? 0}%</div>
            <div class="stat-lbl">Accuracy</div>
          </div>
          <div class="stat-card">
            <div class="stat-val gold">${userStats.exactRate ?? 0}%</div>
            <div class="stat-lbl">Exact Score</div>
          </div>
          <div class="stat-card">
            <div class="stat-val blue">${streakHtml}</div>
            <div class="stat-lbl">Current Streak</div>
          </div>
          <div class="stat-card">
            <div class="stat-val red">${userStats.bestStreak ?? 0}</div>
            <div class="stat-lbl">Best Streak</div>
          </div>
          ${userStats.favoriteTeam ? `
          <div class="stat-card" style="grid-column:1/-1">
            <div class="stat-fav">${flag(userStats.favoriteTeam)} ${userStats.favoriteTeam}</div>
            <div class="stat-lbl">Most predicted team</div>
          </div>` : ''}
        `;
      }

      if (!preds.length) {
        el.innerHTML = '<div class="empty-msg">No predictions yet — go to Markets and predict!</div>';
        return;
      }

      let lastDate = null;
      el.innerHTML = preds.map(p => {
        let sep = '';
        if (p.match_date !== lastDate) {
          lastDate = p.match_date;
          sep = `<div class="date-divider">${fmtDate(p.match_date)}</div>`;
        }
        const pts = p.points || 0;
        let badge = '', cls = '';
        if (p.completed) {
          cls   = pts === 3 ? 'badge-exact' : pts === 1 ? 'badge-correct' : 'badge-wrong';
          badge = pts === 3 ? `✅ Exact! +3` : pts === 1 ? `☑️ Correct result +1` : `❌ Wrong +0`;
        } else {
          cls = 'badge-pending'; badge = '⏳ Pending';
        }
        const stageTxt = p.stage === 'group' ? p.group_name : stageLabel(p.stage);

        // WhatsApp share for pending predictions
        const waBtn = !p.completed ? `
          <button class="wa-btn-sm" onclick="App.shareWhatsApp('${p.match_id}',${p.score1},${p.score2})">
            Share 📲
          </button>` : '';

        return sep + `
          <div class="mybet-card${p.completed ? ' completed' : ''}">
            <div class="mybet-top">
              <span class="market-stage">${stageTxt}</span>
              <span class="market-time">${fmtDate(p.match_date)} · ${p.match_time?.slice(0,5)} ET</span>
            </div>
            <div class="mybet-row">
              <div class="mybet-teams">
                ${flag(p.team1)} ${p.team1} vs ${p.team2} ${flag(p.team2)}
              </div>
              <div class="mybet-scores">
                <span class="pick-score">${p.score1}–${p.score2}</span>
                ${p.completed ? `<span class="result-score">(${p.result1}–${p.result2})</span>` : ''}
              </div>
            </div>
            <div class="mybet-footer">
              <div class="pred-badge ${cls}">${badge}</div>
              ${waBtn}
            </div>
          </div>`;
      }).join('');
    } catch (e) {
      el.innerHTML = `<div class="empty-msg">⚠️ ${e.message}</div>`;
    }
  },

  // ── Groups ─────────────────────────────────────────────────────────────────
  async loadGroups() {
    const el = document.getElementById('groups-grid');
    el.innerHTML = '<div class="empty-msg">Loading…</div>';
    try {
      const { groups, standings } = await api('GET', '/api/groups');
      el.innerHTML = Object.entries(groups).map(([letter, { teams }]) => {
        const rows = (standings[letter] || teams.map(n => ({ name:n, played:0, won:0, drawn:0, lost:0, gf:0, ga:0, gd:0, points:0 })))
          .map((t, i) => `
            <tr>
              <td><span class="trow-pos">${i+1}</span> ${i < 2 ? '<span class="adv-dot"></span>' : ''} ${flag(t.name)} ${t.name}</td>
              <td>${t.played}</td><td>${t.won}</td><td>${t.drawn}</td><td>${t.lost}</td>
              <td>${t.gf}</td><td>${t.ga}</td>
              <td class="pts-cell">${t.points}</td>
            </tr>`).join('');
        return `
          <div class="group-card">
            <div class="group-title">Group ${letter}</div>
            <table class="group-table">
              <thead><tr><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>Pts</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`;
      }).join('');
    } catch (e) {
      el.innerHTML = `<div class="empty-msg">⚠️ ${e.message}</div>`;
    }
  },

  // ── Admin Key Modal ────────────────────────────────────────────────────────
  openAdminModal() {
    document.getElementById('admin-modal-overlay').style.display = '';
    document.getElementById('admin-modal').style.display = '';
    hideErr('admin-key-error');
    document.getElementById('admin-key-input').value = '';
    setTimeout(() => document.getElementById('admin-key-input').focus(), 100);
  },

  closeAdminModal() {
    document.getElementById('admin-modal-overlay').style.display = 'none';
    document.getElementById('admin-modal').style.display = 'none';
  },

  async submitAdminKey() {
    hideErr('admin-key-error');
    const key = document.getElementById('admin-key-input').value.trim();
    if (!key) return;
    try {
      const { valid } = await api('GET', `/api/admin-check?key=${encodeURIComponent(key)}`);
      if (!valid) return showErr('admin-key-error', 'Wrong key — try again');
      State.isAdmin   = true;
      State.adminKey  = key;
      localStorage.setItem('wc_admin',     '1');
      localStorage.setItem('wc_admin_key', key);
      this.closeAdminModal();
      this.switchTab('admin');
    } catch (e) {
      showErr('admin-key-error', e.message);
    }
  },

  // ── Admin Tab ──────────────────────────────────────────────────────────────
  async loadAdmin() {
    const el = document.getElementById('admin-list');
    el.innerHTML = '<div class="empty-msg">Loading…</div>';
    try {
      State.matches = await api('GET', '/api/matches');
      const relevant = State.matches.filter(m => m.team1 !== 'TBD');
      if (!relevant.length) {
        el.innerHTML = '<div class="empty-msg">No matches available</div>';
        return;
      }
      let lastDate = null;
      el.innerHTML = relevant.map(m => {
        let sep = '';
        if (m.match_date !== lastDate) {
          lastDate = m.match_date;
          sep = `<div class="date-divider">${fmtDate(m.match_date)}</div>`;
        }
        const stageTxt = m.stage === 'group' ? m.group_name : stageLabel(m.stage);
        const statusHtml = m.completed
          ? `<span class="admin-done">✅ ${m.score1}–${m.score2}</span>`
          : `<button class="enter-result-btn" onclick="App.openResultDrawer('${m.id || m._id}')">Enter Result</button>`;
        return sep + `
          <div class="admin-card${m.completed ? ' completed' : ''}">
            <div class="admin-card-left">
              <div class="admin-match">${flag(m.team1)} ${m.team1} vs ${m.team2} ${flag(m.team2)}</div>
              <div class="admin-meta">${stageTxt} · ${fmtDate(m.match_date)} ${m.match_time?.slice(0,5)}</div>
            </div>
            <div class="admin-card-right">${statusHtml}</div>
          </div>`;
      }).join('');
    } catch (e) {
      el.innerHTML = `<div class="empty-msg">⚠️ ${e.message}</div>`;
    }
  },

  // ── Result Drawer ──────────────────────────────────────────────────────────
  openResultDrawer(matchId) {
    const m = State.matches.find(x => x.id === matchId || x._id === matchId);
    if (!m) return;
    State.currentResult = m;
    State.resScores = [m.score1 ?? 0, m.score2 ?? 0];

    const stageTxt = m.stage === 'group' ? m.group_name : stageLabel(m.stage);
    document.getElementById('result-match-info').innerHTML =
      `<div class="drawer-teams">${flag(m.team1)} <b>${m.team1}</b> vs <b>${m.team2}</b> ${flag(m.team2)}</div>
       <div class="drawer-meta">${stageTxt} · ${fmtDate(m.match_date)}</div>`;

    document.getElementById('res-team1').textContent = m.team1;
    document.getElementById('res-team2').textContent = m.team2;
    document.getElementById('res-val1').textContent  = State.resScores[0];
    document.getElementById('res-val2').textContent  = State.resScores[1];

    hideErr('result-error');
    document.getElementById('result-drawer-overlay').style.display = '';
    document.getElementById('result-drawer').style.display = '';
    document.getElementById('result-drawer').classList.add('open');
  },

  closeResultDrawer() {
    document.getElementById('result-drawer-overlay').style.display = 'none';
    document.getElementById('result-drawer').style.display = 'none';
    document.getElementById('result-drawer').classList.remove('open');
    State.currentResult = null;
  },

  stepResult(idx, delta) {
    State.resScores[idx] = Math.max(0, (State.resScores[idx] || 0) + delta);
    document.getElementById(`res-val${idx + 1}`).textContent = State.resScores[idx];
  },

  async submitResult() {
    const m = State.currentResult;
    if (!m) return;
    hideErr('result-error');
    try {
      await api('POST', '/api/results', {
        admin_key: State.adminKey || localStorage.getItem('wc_admin_key') || '',
        match_id:  m.id || m._id,
        score1:    State.resScores[0],
        score2:    State.resScores[1],
      });
      this.closeResultDrawer();
      this.loadAdmin();
    } catch (e) {
      showErr('result-error', e.message);
    }
  },
};

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());
