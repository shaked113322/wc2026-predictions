require('dotenv').config();

const express = require('express');
const { neon } = require('@neondatabase/serverless');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'wc2026admin';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── DB ────────────────────────────────────────────────────────────────────────
function getSQL() {
  const url = process.env.POSTGRES_URL;
  if (!url) throw new Error('POSTGRES_URL is not set');
  return neon(url);
}

// ── ESPN team abbreviation → our team names ───────────────────────────────────
const ESPN_MAP = {
  MEX:'Mexico', ZAF:'South Africa', RSA:'South Africa', KOR:'South Korea',
  CZE:'Czechia', CAN:'Canada', BIH:'Bosnia-Herz.', QAT:'Qatar',
  SUI:'Switzerland', SWI:'Switzerland', BRA:'Brazil', MAR:'Morocco',
  HTI:'Haiti', SCO:'Scotland', USA:'USA', PAR:'Paraguay', AUS:'Australia',
  TUR:'Türkiye', GER:'Germany', GBR:'Germany', CUW:'Curaçao', CIV:'Ivory Coast',
  ECU:'Ecuador', NED:'Netherlands', JPN:'Japan', SWE:'Sweden', TUN:'Tunisia',
  BEL:'Belgium', EGY:'Egypt', IRN:'Iran', NZL:'New Zealand', ESP:'Spain',
  CPV:'Cape Verde', KSA:'Saudi Arabia', SAU:'Saudi Arabia', URU:'Uruguay',
  FRA:'France', SEN:'Senegal', IRQ:'Iraq', NOR:'Norway', ARG:'Argentina',
  ALG:'Algeria', AUT:'Austria', JOR:'Jordan', POR:'Portugal', COD:'DR Congo',
  UZB:'Uzbekistan', COL:'Colombia', ENG:'England', CRO:'Croatia',
  GHA:'Ghana', PAN:'Panama',
};

// ── Setup tables + seed (runs once per cold start, idempotent) ────────────────
let initialized = false;
async function ensureInit() {
  if (initialized) return;
  const sql = getSQL();

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id       TEXT PRIMARY KEY,
      token    TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS matches (
      id         TEXT PRIMARY KEY,
      group_name TEXT,
      stage      TEXT,
      team1      TEXT,
      team2      TEXT,
      match_date TEXT,
      match_time TEXT,
      venue      TEXT,
      score1     INTEGER,
      score2     INTEGER,
      completed  BOOLEAN NOT NULL DEFAULT FALSE
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS predictions (
      id         TEXT PRIMARY KEY,
      user_match TEXT UNIQUE NOT NULL,
      user_id    TEXT NOT NULL,
      match_id   TEXT NOT NULL,
      score1     INTEGER,
      score2     INTEGER,
      points     INTEGER NOT NULL DEFAULT 0
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT
    )`;

  // Seed matches only if table is empty
  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM matches`;
  if (count === 0) await seedMatches(sql);

  initialized = true;
}

app.use(async (req, res, next) => {
  try { await ensureInit(); next(); }
  catch (e) { console.error(e); res.status(500).json({ error: 'DB init failed' }); }
});

// ════════════════════════════════════════════════════════════════
//  FIFA WORLD CUP 2026 — OFFICIAL DATA  (all times ET)
// ════════════════════════════════════════════════════════════════

const GROUPS = {
  A: { teams: ['Mexico',      'South Africa', 'South Korea', 'Czechia']       },
  B: { teams: ['Canada',      'Bosnia-Herz.', 'Qatar',       'Switzerland']   },
  C: { teams: ['Brazil',      'Morocco',      'Haiti',       'Scotland']      },
  D: { teams: ['USA',         'Paraguay',     'Australia',   'Türkiye']       },
  E: { teams: ['Germany',     'Curaçao',      'Ivory Coast', 'Ecuador']       },
  F: { teams: ['Netherlands', 'Japan',        'Sweden',      'Tunisia']       },
  G: { teams: ['Belgium',     'Egypt',        'Iran',        'New Zealand']   },
  H: { teams: ['Spain',       'Cape Verde',   'Saudi Arabia','Uruguay']       },
  I: { teams: ['France',      'Senegal',      'Iraq',        'Norway']        },
  J: { teams: ['Argentina',   'Algeria',      'Austria',     'Jordan']        },
  K: { teams: ['Portugal',    'DR Congo',     'Uzbekistan',  'Colombia']      },
  L: { teams: ['England',     'Croatia',      'Ghana',       'Panama']        },
};

const GROUP_MATCHES = [
  ['A','Mexico','South Africa','2026-06-11','15:00','Estadio Azteca, Mexico City'],
  ['A','South Korea','Czechia','2026-06-11','22:00','Estadio Akron, Guadalajara'],
  ['A','Czechia','South Africa','2026-06-18','12:00','Mercedes-Benz Stadium, Atlanta'],
  ['A','Mexico','South Korea','2026-06-18','21:00','Estadio Akron, Guadalajara'],
  ['A','Mexico','Czechia','2026-06-24','21:00','Estadio Azteca, Mexico City'],
  ['A','South Africa','South Korea','2026-06-24','21:00','Estadio BBVA, Monterrey'],
  ['B','Canada','Bosnia-Herz.','2026-06-12','15:00','BMO Field, Toronto'],
  ['B','Qatar','Switzerland','2026-06-13','12:00',"Levi's Stadium, Santa Clara"],
  ['B','Switzerland','Bosnia-Herz.','2026-06-18','15:00','SoFi Stadium, Los Angeles'],
  ['B','Canada','Qatar','2026-06-18','18:00','BC Place, Vancouver'],
  ['B','Canada','Switzerland','2026-06-25','15:00','BMO Field, Toronto'],
  ['B','Bosnia-Herz.','Qatar','2026-06-25','15:00',"Levi's Stadium, Santa Clara"],
  ['C','Brazil','Morocco','2026-06-13','18:00','MetLife Stadium, East Rutherford'],
  ['C','Haiti','Scotland','2026-06-13','21:00','Gillette Stadium, Foxborough'],
  ['C','Scotland','Morocco','2026-06-19','18:00','Gillette Stadium, Foxborough'],
  ['C','Brazil','Haiti','2026-06-19','20:30','Lincoln Financial Field, Philadelphia'],
  ['C','Morocco','Haiti','2026-06-24','18:00','Mercedes-Benz Stadium, Atlanta'],
  ['C','Scotland','Brazil','2026-06-24','18:00','Hard Rock Stadium, Miami'],
  ['D','USA','Paraguay','2026-06-12','21:00','SoFi Stadium, Los Angeles'],
  ['D','Australia','Türkiye','2026-06-13','21:00','BC Place, Vancouver'],
  ['D','USA','Australia','2026-06-19','15:00','Lumen Field, Seattle'],
  ['D','Paraguay','Türkiye','2026-06-20','12:00','Arrowhead Stadium, Kansas City'],
  ['D','USA','Türkiye','2026-06-26','18:00','MetLife Stadium, East Rutherford'],
  ['D','Paraguay','Australia','2026-06-26','18:00','AT&T Stadium, Arlington'],
  ['E','Germany','Curaçao','2026-06-14','13:00','NRG Stadium, Houston'],
  ['E','Ivory Coast','Ecuador','2026-06-14','19:00','Lincoln Financial Field, Philadelphia'],
  ['E','Germany','Ivory Coast','2026-06-20','16:00','BMO Field, Toronto'],
  ['E','Ecuador','Curaçao','2026-06-20','20:00','Arrowhead Stadium, Kansas City'],
  ['E','Ecuador','Germany','2026-06-25','16:00','MetLife Stadium, East Rutherford'],
  ['E','Curaçao','Ivory Coast','2026-06-25','16:00','Lincoln Financial Field, Philadelphia'],
  ['F','Netherlands','Japan','2026-06-14','16:00','AT&T Stadium, Arlington'],
  ['F','Sweden','Tunisia','2026-06-14','22:00','Estadio BBVA, Monterrey'],
  ['F','Netherlands','Sweden','2026-06-20','13:00','NRG Stadium, Houston'],
  ['F','Tunisia','Japan','2026-06-20','22:00','Estadio BBVA, Monterrey'],
  ['F','Japan','Sweden','2026-06-25','19:00','AT&T Stadium, Arlington'],
  ['F','Tunisia','Netherlands','2026-06-25','19:00','Arrowhead Stadium, Kansas City'],
  ['G','Belgium','Egypt','2026-06-15','15:00','Lumen Field, Seattle'],
  ['G','Iran','New Zealand','2026-06-15','21:00','SoFi Stadium, Los Angeles'],
  ['G','Belgium','Iran','2026-06-21','15:00','SoFi Stadium, Los Angeles'],
  ['G','Egypt','New Zealand','2026-06-21','21:00','Lumen Field, Seattle'],
  ['G','Belgium','New Zealand','2026-06-26','21:00','MetLife Stadium, East Rutherford'],
  ['G','Egypt','Iran','2026-06-26','21:00','Rose Bowl, Los Angeles'],
  ['H','Spain','Cape Verde','2026-06-15','12:00','Mercedes-Benz Stadium, Atlanta'],
  ['H','Saudi Arabia','Uruguay','2026-06-15','18:00','Hard Rock Stadium, Miami'],
  ['H','Spain','Saudi Arabia','2026-06-21','12:00','Mercedes-Benz Stadium, Atlanta'],
  ['H','Cape Verde','Uruguay','2026-06-22','18:00','Hard Rock Stadium, Miami'],
  ['H','Spain','Uruguay','2026-06-26','21:00',"Levi's Stadium, Santa Clara"],
  ['H','Cape Verde','Saudi Arabia','2026-06-26','21:00','Rose Bowl, Los Angeles'],
  ['I','France','Senegal','2026-06-16','15:00','MetLife Stadium, East Rutherford'],
  ['I','Iraq','Norway','2026-06-16','18:00','Gillette Stadium, Foxborough'],
  ['I','France','Iraq','2026-06-22','15:00','MetLife Stadium, East Rutherford'],
  ['I','Senegal','Norway','2026-06-22','18:00','Gillette Stadium, Foxborough'],
  ['I','France','Norway','2026-06-26','18:00','Lumen Field, Seattle'],
  ['I','Senegal','Iraq','2026-06-26','18:00','AT&T Stadium, Arlington'],
  ['J','Austria','Jordan','2026-06-14','21:00',"Levi's Stadium, Santa Clara"],
  ['J','Argentina','Algeria','2026-06-16','21:00','Arrowhead Stadium, Kansas City'],
  ['J','Argentina','Austria','2026-06-22','21:00','Arrowhead Stadium, Kansas City'],
  ['J','Algeria','Jordan','2026-06-22','18:00',"Levi's Stadium, Santa Clara"],
  ['J','Algeria','Austria','2026-06-27','22:00','Arrowhead Stadium, Kansas City'],
  ['J','Jordan','Argentina','2026-06-27','22:00','AT&T Stadium, Arlington'],
  ['K','Portugal','DR Congo','2026-06-17','13:00','NRG Stadium, Houston'],
  ['K','Uzbekistan','Colombia','2026-06-17','22:00','Estadio Azteca, Mexico City'],
  ['K','Portugal','Uzbekistan','2026-06-23','13:00','NRG Stadium, Houston'],
  ['K','Colombia','DR Congo','2026-06-23','22:00','Estadio Akron, Guadalajara'],
  ['K','Portugal','Colombia','2026-06-27','19:30','Hard Rock Stadium, Miami'],
  ['K','DR Congo','Uzbekistan','2026-06-27','19:30','Mercedes-Benz Stadium, Atlanta'],
  ['L','England','Croatia','2026-06-17','16:00','AT&T Stadium, Arlington'],
  ['L','Ghana','Panama','2026-06-18','15:00','Rose Bowl, Los Angeles'],
  ['L','England','Ghana','2026-06-23','16:00','Gillette Stadium, Foxborough'],
  ['L','Panama','Croatia','2026-06-23','19:00','BMO Field, Toronto'],
  ['L','Croatia','Ghana','2026-06-27','17:00','Lincoln Financial Field, Philadelphia'],
  ['L','Panama','England','2026-06-27','17:00','BC Place, Vancouver'],
];

const KNOCKOUT_MATCHES = [
  ['R32 Match 1','r32','2026-06-28','15:00','MetLife Stadium, East Rutherford'],
  ['R32 Match 2','r32','2026-06-28','19:00','SoFi Stadium, Los Angeles'],
  ['R32 Match 3','r32','2026-06-29','15:00','AT&T Stadium, Arlington'],
  ['R32 Match 4','r32','2026-06-29','19:00','Mercedes-Benz Stadium, Atlanta'],
  ['R32 Match 5','r32','2026-06-30','15:00','NRG Stadium, Houston'],
  ['R32 Match 6','r32','2026-06-30','19:00','Hard Rock Stadium, Miami'],
  ['R32 Match 7','r32','2026-07-01','15:00','Lumen Field, Seattle'],
  ['R32 Match 8','r32','2026-07-01','19:00','Gillette Stadium, Foxborough'],
  ['R32 Match 9','r32','2026-07-02','15:00','Rose Bowl, Los Angeles'],
  ['R32 Match 10','r32','2026-07-02','19:00','Arrowhead Stadium, Kansas City'],
  ['R32 Match 11','r32','2026-07-03','15:00','BMO Field, Toronto'],
  ['R32 Match 12','r32','2026-07-03','19:00','BC Place, Vancouver'],
  ['R32 Match 13','r32','2026-07-03','21:00','Estadio Azteca, Mexico City'],
  ['R32 Match 14','r32','2026-07-04','15:00','Lincoln Financial Field, Philadelphia'],
  ['R32 Match 15','r32','2026-07-04','19:00',"Levi's Stadium, Santa Clara"],
  ['R32 Match 16','r32','2026-07-04','21:00','Estadio Akron, Guadalajara'],
  ['R16 Match 1','r16','2026-07-05','15:00','MetLife Stadium, East Rutherford'],
  ['R16 Match 2','r16','2026-07-05','19:00','SoFi Stadium, Los Angeles'],
  ['R16 Match 3','r16','2026-07-06','15:00','AT&T Stadium, Arlington'],
  ['R16 Match 4','r16','2026-07-06','19:00','Mercedes-Benz Stadium, Atlanta'],
  ['R16 Match 5','r16','2026-07-07','15:00','NRG Stadium, Houston'],
  ['R16 Match 6','r16','2026-07-07','19:00','Hard Rock Stadium, Miami'],
  ['R16 Match 7','r16','2026-07-08','15:00','Rose Bowl, Los Angeles'],
  ['R16 Match 8','r16','2026-07-08','19:00','Arrowhead Stadium, Kansas City'],
  ['QF Match 1','qf','2026-07-09','15:00','MetLife Stadium, East Rutherford'],
  ['QF Match 2','qf','2026-07-09','19:00','AT&T Stadium, Arlington'],
  ['QF Match 3','qf','2026-07-11','15:00','Mercedes-Benz Stadium, Atlanta'],
  ['QF Match 4','qf','2026-07-11','19:00','SoFi Stadium, Los Angeles'],
  ['Semi Final 1','sf','2026-07-14','21:00','AT&T Stadium, Arlington'],
  ['Semi Final 2','sf','2026-07-15','21:00','Mercedes-Benz Stadium, Atlanta'],
  ['3rd Place','3rd','2026-07-18','18:00','Hard Rock Stadium, Miami'],
  ['FINAL 🏆','final','2026-07-19','15:00','MetLife Stadium, East Rutherford'],
];

async function seedMatches(sql) {
  for (const [grp,t1,t2,date,time,venue] of GROUP_MATCHES)
    await sql`INSERT INTO matches (id,group_name,stage,team1,team2,match_date,match_time,venue)
              VALUES (${uuidv4()},${`Group ${grp}`},'group',${t1},${t2},${date},${time},${venue})`;
  for (const [label,stage,date,time,venue] of KNOCKOUT_MATCHES)
    await sql`INSERT INTO matches (id,group_name,stage,team1,team2,match_date,match_time,venue)
              VALUES (${uuidv4()},${label},${stage},'TBD','TBD',${date},${time},${venue})`;
  console.log('✅ Seeded matches');
}

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username?.trim() || username.trim().length < 2)
      return res.status(400).json({ error: 'Name must be at least 2 characters' });
    const name = username.trim();
    const sql = getSQL();
    const rows = await sql`SELECT * FROM users WHERE username = ${name}`;
    if (rows.length) return res.json({ token: rows[0].token, username: rows[0].username });
    const token = uuidv4();
    await sql`INSERT INTO users (id, token, username) VALUES (${uuidv4()}, ${token}, ${name})`;
    res.json({ token, username: name });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Matches ───────────────────────────────────────────────────────────────────
app.get('/api/matches', async (req, res) => {
  try {
    const sql = getSQL();
    const rows = await sql`SELECT * FROM matches ORDER BY match_date, match_time`;
    res.json(rows.map(m => ({ ...m, id: m.id })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Groups + Standings ────────────────────────────────────────────────────────
app.get('/api/groups', async (req, res) => {
  try {
    const sql = getSQL();
    const completed = await sql`SELECT * FROM matches WHERE stage='group' AND completed=true`;
    const standings = {};
    for (const [letter,{teams}] of Object.entries(GROUPS))
      standings[letter] = teams.map(name => ({ name, played:0, won:0, drawn:0, lost:0, gf:0, ga:0, gd:0, points:0 }));
    for (const m of completed) {
      const letter = m.group_name?.replace('Group ','');
      if (!letter || !standings[letter]) continue;
      const s = standings[letter];
      const t1 = s.find(t => t.name === m.team1);
      const t2 = s.find(t => t.name === m.team2);
      if (!t1 || !t2) continue;
      t1.played++; t2.played++;
      t1.gf += m.score1; t1.ga += m.score2; t2.gf += m.score2; t2.ga += m.score1;
      t1.gd = t1.gf - t1.ga; t2.gd = t2.gf - t2.ga;
      if (m.score1 > m.score2)      { t1.won++; t1.points += 3; t2.lost++; }
      else if (m.score1 < m.score2) { t2.won++; t2.points += 3; t1.lost++; }
      else                          { t1.drawn++; t1.points++; t2.drawn++; t2.points++; }
    }
    for (const l of Object.keys(standings))
      standings[l].sort((a,b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
    res.json({ groups: GROUPS, standings });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Prediction stats ──────────────────────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  try {
    const sql = getSQL();
    const rows = await sql`SELECT match_id, score1, score2 FROM predictions`;
    const stats = {};
    for (const p of rows) {
      if (!stats[p.match_id]) stats[p.match_id] = { total:0, team1:0, draw:0, team2:0 };
      const s = stats[p.match_id];
      s.total++;
      if (p.score1 > p.score2) s.team1++;
      else if (p.score1 < p.score2) s.team2++;
      else s.draw++;
    }
    for (const id of Object.keys(stats)) {
      const s = stats[id];
      s.team1pct = s.total ? Math.round(s.team1 / s.total * 100) : 33;
      s.drawpct  = s.total ? Math.round(s.draw  / s.total * 100) : 34;
      s.team2pct = s.total ? Math.round(s.team2 / s.total * 100) : 33;
    }
    res.json(stats);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Submit prediction ─────────────────────────────────────────────────────────
app.post('/api/predictions', async (req, res) => {
  try {
    const { token, match_id, score1, score2 } = req.body;
    const sql = getSQL();
    const users = await sql`SELECT * FROM users WHERE token = ${token}`;
    if (!users.length) return res.status(401).json({ error: 'Invalid session' });
    const user = users[0];
    const matches = await sql`SELECT * FROM matches WHERE id = ${match_id}`;
    if (!matches.length) return res.status(404).json({ error: 'Match not found' });
    const match = matches[0];
    if (match.completed) return res.status(400).json({ error: 'Match already finished' });
    const kickoff = new Date(`${match.match_date}T${match.match_time}:00`);
    if (new Date() > new Date(kickoff.getTime() - 3600000))
      return res.status(400).json({ error: 'Predictions locked 1h before kickoff' });
    if (score1 == null || score2 == null || score1 < 0 || score2 < 0)
      return res.status(400).json({ error: 'Invalid scores' });
    const key = `${user.id}_${match.id}`;
    await sql`
      INSERT INTO predictions (id, user_match, user_id, match_id, score1, score2, points)
      VALUES (${uuidv4()}, ${key}, ${user.id}, ${match.id}, ${score1}, ${score2}, 0)
      ON CONFLICT (user_match) DO UPDATE SET score1 = ${score1}, score2 = ${score2}`;
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── My predictions ────────────────────────────────────────────────────────────
app.get('/api/predictions', async (req, res) => {
  try {
    const sql = getSQL();
    const users = await sql`SELECT * FROM users WHERE token = ${req.headers.authorization}`;
    if (!users.length) return res.status(401).json({ error: 'Invalid session' });
    const user = users[0];
    const rows = await sql`
      SELECT p.*, m.team1, m.team2, m.match_date, m.match_time,
             m.score1 AS result1, m.score2 AS result2,
             m.completed, m.stage, m.group_name, m.venue
      FROM predictions p
      JOIN matches m ON m.id = p.match_id
      WHERE p.user_id = ${user.id}
      ORDER BY m.match_date, m.match_time`;
    res.json(rows.map(r => ({ ...r, id: r.id })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Leaderboard ───────────────────────────────────────────────────────────────
app.get('/api/leaderboard', async (req, res) => {
  try {
    const sql = getSQL();
    const rows = await sql`
      SELECT u.id, u.username,
             COALESCE(SUM(p.points), 0)::int                                    AS total,
             COUNT(CASE WHEN p.points = 3 THEN 1 END)::int                      AS exact,
             COUNT(CASE WHEN p.points = 1 THEN 1 END)::int                      AS correct,
             COUNT(CASE WHEN m.completed = true THEN 1 END)::int                AS completed_preds,
             COUNT(CASE WHEN m.completed = true AND p.points > 0 THEN 1 END)::int AS correct_total,
             COUNT(p.id)::int                                                    AS predictions
      FROM users u
      LEFT JOIN predictions p ON p.user_id = u.id
      LEFT JOIN matches m ON m.id = p.match_id
      GROUP BY u.id, u.username
      ORDER BY total DESC, exact DESC, predictions DESC`;

    const board = [];
    for (const u of rows) {
      const streakRows = await sql`
        SELECT p.points FROM predictions p
        JOIN matches m ON m.id = p.match_id
        WHERE p.user_id = ${u.id} AND m.completed = true
        ORDER BY m.match_date DESC, m.match_time DESC`;
      let streak = 0;
      for (const p of streakRows) {
        if ((p.points || 0) > 0) streak++;
        else break;
      }
      const accuracy = u.completed_preds > 0
        ? Math.round(u.correct_total / u.completed_preds * 100) : 0;
      board.push({ ...u, streak, accuracy });
    }
    res.json(board);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Personal stats ────────────────────────────────────────────────────────────
app.get('/api/user/stats', async (req, res) => {
  try {
    const sql = getSQL();
    const users = await sql`SELECT * FROM users WHERE token = ${req.headers.authorization}`;
    if (!users.length) return res.status(401).json({ error: 'Invalid session' });
    const user = users[0];

    const preds = await sql`
      SELECT p.score1, p.score2, p.points, m.team1, m.team2,
             m.completed, m.match_date, m.match_time
      FROM predictions p
      JOIN matches m ON m.id = p.match_id
      WHERE p.user_id = ${user.id}
      ORDER BY m.match_date, m.match_time`;

    const done = preds.filter(p => p.completed);
    const correct = done.filter(p => p.points > 0);
    const exact = done.filter(p => p.points === 3);

    // Current streak (most recent first)
    const desc = [...done].sort((a,b) =>
      (b.match_date+b.match_time).localeCompare(a.match_date+a.match_time));
    let streak = 0;
    for (const p of desc) { if (p.points > 0) streak++; else break; }

    // Best streak
    let best = 0, cur = 0;
    for (const p of done) { p.points > 0 ? (cur++, best = Math.max(best,cur)) : (cur=0); }

    // Favorite team
    const tc = {};
    for (const p of preds) { tc[p.team1]=(tc[p.team1]||0)+1; tc[p.team2]=(tc[p.team2]||0)+1; }
    const favoriteTeam = Object.entries(tc).sort((a,b)=>b[1]-a[1])[0]?.[0] || null;

    res.json({
      total: preds.length,
      completed: done.length,
      correct: correct.length,
      exact: exact.length,
      accuracy: done.length ? Math.round(correct.length/done.length*100) : 0,
      exactRate: done.length ? Math.round(exact.length/done.length*100) : 0,
      streak,
      bestStreak: best,
      favoriteTeam,
      points: done.reduce((s,p) => s+(p.points||0), 0),
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Match predictions (visible 1h before kickoff) ─────────────────────────────
app.get('/api/match/:id/predictions', async (req, res) => {
  try {
    const sql = getSQL();
    const matches = await sql`SELECT * FROM matches WHERE id = ${req.params.id}`;
    if (!matches.length) return res.status(404).json({ error: 'Not found' });
    const m = matches[0];
    const kickoff = new Date(`${m.match_date}T${m.match_time}:00`);
    if (new Date() < new Date(kickoff.getTime() - 3600000) && !m.completed)
      return res.status(403).json({ error: 'locked' });
    const rows = await sql`
      SELECT u.username, p.score1, p.score2, p.points
      FROM predictions p
      JOIN users u ON u.id = p.user_id
      WHERE p.match_id = ${req.params.id}
      ORDER BY p.points DESC NULLS LAST, u.username`;
    res.json({ match: m, predictions: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Enter result (admin) ──────────────────────────────────────────────────────
app.post('/api/results', async (req, res) => {
  try {
    const { admin_key, match_id, score1, score2 } = req.body;
    if (admin_key !== ADMIN_KEY) return res.status(403).json({ error: 'Wrong admin key' });
    const sql = getSQL();
    const matches = await sql`SELECT * FROM matches WHERE id = ${match_id}`;
    if (!matches.length) return res.status(404).json({ error: 'Match not found' });
    await sql`UPDATE matches SET score1=${score1}, score2=${score2}, completed=true WHERE id=${match_id}`;
    const preds = await sql`SELECT * FROM predictions WHERE match_id = ${match_id}`;
    for (const p of preds) {
      let pts = 0;
      if (p.score1 === score1 && p.score2 === score2) pts = 3;
      else if (Math.sign(score1 - score2) === Math.sign(p.score1 - p.score2)) pts = 1;
      await sql`UPDATE predictions SET points = ${pts} WHERE id = ${p.id}`;
    }
    res.json({ ok: true, updated: preds.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin-check', (req, res) => {
  res.json({ valid: req.query.key === ADMIN_KEY });
});

// ── Auto-sync from ESPN (no API key needed) ───────────────────────────────────
app.get('/api/sync', async (req, res) => {
  try {
    const sql = getSQL();

    // Rate-limit: skip if synced within last 5 minutes
    const metaRows = await sql`SELECT value FROM meta WHERE key = 'last_sync'`;
    const lastSync = metaRows.length ? new Date(metaRows[0].value) : null;
    const now = new Date();
    if (lastSync && (now - lastSync) < 5 * 60 * 1000) {
      return res.json({ ok: true, skipped: true, nextSync: new Date(lastSync.getTime() + 5*60*1000) });
    }

    // Fetch today + yesterday from ESPN (covers matches finishing around midnight)
    const dates = [0, -1, 1].map(offset => {
      const d = new Date(now);
      d.setDate(d.getDate() + offset);
      return d.toISOString().slice(0, 10).replace(/-/g, '');
    });

    let totalUpdated = 0;
    for (const dateStr of dates) {
      try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${dateStr}`;
        const resp = await fetch(url, { headers: { 'User-Agent': 'WC2026Predictions/1.0' } });
        if (!resp.ok) continue;
        const data = await resp.json();

        for (const event of (data.events || [])) {
          const comp = event.competitions?.[0];
          if (!comp) continue;
          const status = comp.status?.type;
          if (!status?.completed) continue;

          const home = comp.competitors.find(c => c.homeAway === 'home');
          const away = comp.competitors.find(c => c.homeAway === 'away');
          if (!home || !away) continue;

          const score1 = parseInt(home.score);
          const score2 = parseInt(away.score);
          if (isNaN(score1) || isNaN(score2)) continue;

          const team1 = ESPN_MAP[home.team.abbreviation] || home.team.displayName;
          const team2 = ESPN_MAP[away.team.abbreviation] || away.team.displayName;

          const matchDate = event.date?.slice(0, 10);
          const rows = await sql`
            SELECT * FROM matches
            WHERE team1 = ${team1} AND team2 = ${team2}
              AND (match_date = ${matchDate} OR match_date = ${dateStr.slice(0,4)+'-'+dateStr.slice(4,6)+'-'+dateStr.slice(6,8)})
              AND completed = false`;

          if (!rows.length) continue;
          const match = rows[0];

          await sql`UPDATE matches SET score1=${score1}, score2=${score2}, completed=true WHERE id=${match.id}`;

          const preds = await sql`SELECT * FROM predictions WHERE match_id = ${match.id}`;
          for (const p of preds) {
            let pts = 0;
            if (p.score1 === score1 && p.score2 === score2) pts = 3;
            else if (Math.sign(score1 - score2) === Math.sign(p.score1 - p.score2)) pts = 1;
            await sql`UPDATE predictions SET points=${pts} WHERE id=${p.id}`;
          }
          totalUpdated++;
        }
      } catch (_) { /* skip failed date fetch */ }
    }

    await sql`INSERT INTO meta (key, value) VALUES ('last_sync', ${now.toISOString()})
              ON CONFLICT (key) DO UPDATE SET value = ${now.toISOString()}`;

    res.json({ ok: true, updated: totalUpdated, syncedAt: now });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n⚽  WC2026 → http://localhost:${PORT}\n`);
  });
}

module.exports = app;
