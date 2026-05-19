require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'wc2026admin';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── MongoDB connection (cached for serverless warm starts) ─────────────────────
let _connected = false;
async function connectDB() {
  if (_connected) return;
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(process.env.MONGODB_URI);
  _connected = true;
}

// ── Models ────────────────────────────────────────────────────────────────────
const UserSchema = new mongoose.Schema({
  _id:      { type: String },
  token:    { type: String, unique: true, required: true },
  username: { type: String, unique: true, required: true },
}, { _id: false });

const MatchSchema = new mongoose.Schema({
  _id:        { type: String },
  group_name: String,
  stage:      String,
  team1:      String,
  team2:      String,
  match_date: String,
  match_time: String,
  venue:      String,
  score1:     { type: Number, default: null },
  score2:     { type: Number, default: null },
  completed:  { type: Boolean, default: false },
}, { _id: false });

const PredictionSchema = new mongoose.Schema({
  _id:        { type: String },
  user_match: { type: String, unique: true, required: true },
  user_id:    { type: String, required: true },
  match_id:   { type: String, required: true },
  score1:     Number,
  score2:     Number,
  points:     { type: Number, default: 0 },
}, { _id: false });

const User       = mongoose.models.User       || mongoose.model('User',       UserSchema);
const Match      = mongoose.models.Match      || mongoose.model('Match',      MatchSchema);
const Prediction = mongoose.models.Prediction || mongoose.model('Prediction', PredictionSchema);

// ── Middleware: ensure DB is connected + matches are seeded ───────────────────
let seeded = false;
app.use(async (req, res, next) => {
  try {
    await connectDB();
    if (!seeded) {
      await seedMatches();
      seeded = true;
    }
    next();
  } catch (e) {
    console.error('DB error:', e.message);
    res.status(500).json({ error: 'Database connection failed' });
  }
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
  ['R32 Match 1', 'r32','2026-06-28','15:00','MetLife Stadium, East Rutherford'],
  ['R32 Match 2', 'r32','2026-06-28','19:00','SoFi Stadium, Los Angeles'],
  ['R32 Match 3', 'r32','2026-06-29','15:00','AT&T Stadium, Arlington'],
  ['R32 Match 4', 'r32','2026-06-29','19:00','Mercedes-Benz Stadium, Atlanta'],
  ['R32 Match 5', 'r32','2026-06-30','15:00','NRG Stadium, Houston'],
  ['R32 Match 6', 'r32','2026-06-30','19:00','Hard Rock Stadium, Miami'],
  ['R32 Match 7', 'r32','2026-07-01','15:00','Lumen Field, Seattle'],
  ['R32 Match 8', 'r32','2026-07-01','19:00','Gillette Stadium, Foxborough'],
  ['R32 Match 9', 'r32','2026-07-02','15:00','Rose Bowl, Los Angeles'],
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

async function seedMatches() {
  const n = await Match.countDocuments();
  if (n > 0) return;
  const docs = [];
  for (const [grp,t1,t2,date,time,venue] of GROUP_MATCHES)
    docs.push({ _id:uuidv4(), group_name:`Group ${grp}`, stage:'group', team1:t1, team2:t2, match_date:date, match_time:time, venue, score1:null, score2:null, completed:false });
  for (const [label,stage,date,time,venue] of KNOCKOUT_MATCHES)
    docs.push({ _id:uuidv4(), group_name:label, stage, team1:'TBD', team2:'TBD', match_date:date, match_time:time, venue, score1:null, score2:null, completed:false });
  await Match.insertMany(docs);
  console.log(`✅ Seeded ${docs.length} matches`);
}

// ── Auth ─────────────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username?.trim() || username.trim().length < 2)
      return res.status(400).json({ error: 'Name must be at least 2 characters' });
    const name = username.trim();
    const existing = await User.findOne({ username: name }).lean();
    if (existing) return res.json({ token: existing.token, username: existing.username });
    const token = uuidv4();
    await User.create({ _id: uuidv4(), token, username: name });
    res.json({ token, username: name });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Matches ───────────────────────────────────────────────────────────────────
app.get('/api/matches', async (req, res) => {
  try {
    const matches = await Match.find({}).lean();
    matches.sort((a,b) => (a.match_date+a.match_time) < (b.match_date+b.match_time) ? -1 : 1);
    res.json(matches.map(m => ({ ...m, id: m._id })));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Groups + Standings ────────────────────────────────────────────────────────
app.get('/api/groups', async (req, res) => {
  try {
    const completed = await Match.find({ stage:'group', completed:true }).lean();
    const standings = {};
    for (const [letter,{teams}] of Object.entries(GROUPS))
      standings[letter] = teams.map(name => ({ name, played:0, won:0, drawn:0, lost:0, gf:0, ga:0, gd:0, points:0 }));
    for (const m of completed) {
      const letter = m.group_name?.replace('Group ','');
      if (!letter || !standings[letter]) continue;
      const s=standings[letter], t1=s.find(t=>t.name===m.team1), t2=s.find(t=>t.name===m.team2);
      if (!t1||!t2) continue;
      t1.played++; t2.played++;
      t1.gf+=m.score1; t1.ga+=m.score2; t2.gf+=m.score2; t2.ga+=m.score1;
      t1.gd=t1.gf-t1.ga; t2.gd=t2.gf-t2.ga;
      if (m.score1>m.score2)      { t1.won++;t1.points+=3;t2.lost++; }
      else if (m.score1<m.score2) { t2.won++;t2.points+=3;t1.lost++; }
      else                        { t1.drawn++;t1.points++;t2.drawn++;t2.points++; }
    }
    for (const l of Object.keys(standings))
      standings[l].sort((a,b) => b.points-a.points || b.gd-a.gd || b.gf-a.gf);
    res.json({ groups:GROUPS, standings });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Prediction stats (distribution) ──────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  try {
    const allPreds = await Prediction.find({}).lean();
    const stats = {};
    for (const p of allPreds) {
      if (!stats[p.match_id]) stats[p.match_id] = { total:0, team1:0, draw:0, team2:0 };
      const s = stats[p.match_id];
      s.total++;
      if (p.score1 > p.score2) s.team1++;
      else if (p.score1 < p.score2) s.team2++;
      else s.draw++;
    }
    for (const id of Object.keys(stats)) {
      const s = stats[id];
      if (s.total > 0) {
        s.team1pct = Math.round(s.team1/s.total*100);
        s.drawpct  = Math.round(s.draw /s.total*100);
        s.team2pct = Math.round(s.team2/s.total*100);
      } else {
        s.team1pct = 33; s.drawpct = 34; s.team2pct = 33;
      }
    }
    res.json(stats);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Submit prediction ─────────────────────────────────────────────────────────
app.post('/api/predictions', async (req, res) => {
  try {
    const { token, match_id, score1, score2 } = req.body;
    const user = await User.findOne({ token }).lean();
    if (!user) return res.status(401).json({ error: 'Invalid session' });
    const match = await Match.findOne({ _id: match_id }).lean();
    if (!match) return res.status(404).json({ error: 'Match not found' });
    if (match.completed) return res.status(400).json({ error: 'Match already finished' });
    const kickoff = new Date(`${match.match_date}T${match.match_time}:00`);
    if (new Date() > new Date(kickoff.getTime() - 3600000))
      return res.status(400).json({ error: 'Predictions locked 1h before kickoff' });
    if (score1 == null || score2 == null || score1 < 0 || score2 < 0)
      return res.status(400).json({ error: 'Invalid scores' });
    const key = `${user._id}_${match._id}`;
    await Prediction.findOneAndUpdate(
      { user_match: key },
      { $set: { score1, score2 }, $setOnInsert: { _id: uuidv4(), user_id: user._id, match_id: match._id, points: 0 } },
      { upsert: true, new: true }
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── My predictions ────────────────────────────────────────────────────────────
app.get('/api/predictions', async (req, res) => {
  try {
    const user = await User.findOne({ token: req.headers.authorization }).lean();
    if (!user) return res.status(401).json({ error: 'Invalid session' });
    const preds = await Prediction.find({ user_id: user._id }).lean();
    const out = [];
    for (const p of preds) {
      const m = await Match.findOne({ _id: p.match_id }).lean();
      if (!m) continue;
      out.push({ ...p, id:p._id, team1:m.team1, team2:m.team2,
        match_date:m.match_date, match_time:m.match_time,
        result1:m.score1, result2:m.score2, completed:m.completed,
        stage:m.stage, group_name:m.group_name, venue:m.venue });
    }
    out.sort((a,b) => (a.match_date+a.match_time) < (b.match_date+b.match_time) ? -1 : 1);
    res.json(out);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Leaderboard ───────────────────────────────────────────────────────────────
app.get('/api/leaderboard', async (req, res) => {
  try {
    const users = await User.find({}).lean();
    const board = [];
    for (const u of users) {
      const preds = await Prediction.find({ user_id: u._id }).lean();
      const total   = preds.reduce((s,p) => s+(p.points||0), 0);
      const exact   = preds.filter(p => p.points===3).length;
      const correct = preds.filter(p => p.points===1).length;
      board.push({ id:u._id, username:u.username, total, exact, correct, predictions:preds.length });
    }
    board.sort((a,b) => b.total-a.total || b.exact-a.exact || b.predictions-a.predictions);
    res.json(board);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Enter result (admin) ──────────────────────────────────────────────────────
app.post('/api/results', async (req, res) => {
  try {
    const { admin_key, match_id, score1, score2 } = req.body;
    if (admin_key !== ADMIN_KEY) return res.status(403).json({ error: 'Wrong admin key' });
    const match = await Match.findOne({ _id: match_id }).lean();
    if (!match) return res.status(404).json({ error: 'Match not found' });
    await Match.updateOne({ _id: match_id }, { $set: { score1, score2, completed: true } });
    const preds = await Prediction.find({ match_id }).lean();
    for (const p of preds) {
      let pts = 0;
      if (p.score1===score1 && p.score2===score2) pts = 3;
      else if (Math.sign(score1-score2) === Math.sign(p.score1-p.score2)) pts = 1;
      await Prediction.updateOne({ _id: p._id }, { $set: { points: pts } });
    }
    res.json({ ok: true, updated: preds.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin-check', (req, res) => {
  res.json({ valid: req.query.key === ADMIN_KEY });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ── Local dev server (not used by Vercel) ─────────────────────────────────────
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n⚽  World Cup 2026 Predictions`);
    console.log(`   → http://localhost:${PORT}`);
    console.log(`   → Admin key: ${ADMIN_KEY}\n`);
  });
}

module.exports = app;
