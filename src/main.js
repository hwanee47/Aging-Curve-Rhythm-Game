import { SONG, buildChart, findHit, judgeOffset, holdResult } from './chart.mjs';
import { keyLabelsForDifficulty, laneForCode, isPauseCode, normalizeName, insertRanking } from './rules.mjs';
import { advanceParticles } from './particles.mjs';

export function mountGame(app) {
const $ = selector => app.querySelector(selector);
const COLORS = ['#eaa07d', '#e5bc7f', '#d6d18b', '#8fc5bd', '#93b8d6', '#b4a6cf', '#d5a3af'];
const FOUR_COLORS = ['#eaa07d', '#e5bc7f', '#8fc5bd', '#b4a6cf'];
let keys = keyLabelsForDifficulty('normal'), laneColors = FOUR_COLORS;
const rankingMemory = new Map();
const HINTS = { easy: '4레인 · 편하게 리듬을 익히는 채보', normal: '4레인 · 엇박이 섞인 기본 채보', hard: '7레인 · 촘촘한 엇박과 동시 입력', superhard: '7레인 · 빠르고 빽빽한 최고 난도' };
const LEVEL_LABELS = { easy:'EASY', normal:'NORMAL', hard:'HARD', superhard:'SUPER HARD' };
const SPEEDS = [1, 1.25, 1.5, 1.75, 2];
app.innerHTML = `
<div class="shell">
  <header class="topbar">
    <div class="brand"><div class="logo">♫</div><div><b>에이징커브 테스트</b><small>RHYTHM ARCADE</small></div></div>
    <div class="top-middle"><i class="live-dot"></i> ORIGINAL SYNTH TRACK <span>·</span> <span id="laneCountLabel">4 LANES</span></div>
    <div class="top-actions"><button class="icon-button" id="soundBtn" aria-label="소리 끄기">♫</button><button class="icon-button" id="pauseBtn" aria-label="일시정지">Ⅱ</button></div>
  </header>
  <main class="layout">
    <aside class="side left">
      <section class="card hero"><div class="eyebrow">AGING CURVE TEST</div><h1>손끝으로<br><em>승부해요.</em></h1><p>노트가 판정선에 닿는 순간 키를 누르세요. 한 곡의 점수가 당신의 순위를 결정합니다.</p><div class="album"><div class="album-disc"></div><span class="album-caption">01 — MIDNIGHT SIGNAL</span></div></section>
      <section class="card track-card"><div class="eyebrow">NOW PLAYING</div><div class="track-head" style="margin-top:12px"><div class="track-thumb">✦</div><div><strong>${SONG.title}</strong><small>${SONG.artist}</small></div></div><div class="track-meta"><span>${SONG.bpm} BPM</span><span id="trackDuration">0:48</span><span>ORIGINAL</span></div></section>
      <section class="card difficulty"><div class="eyebrow">SELECTED LEVEL</div><h3 id="difficultyName">NORMAL</h3><div class="difficulty-hint" id="difficultyHint">${HINTS.normal}</div><div class="speed-summary">게임 속도 <b id="speedValue">1.00×</b></div></section>
    </aside>
    <section class="stage-column">
      <div class="stage-top"><div class="stage-title">✦ <span>LIVE</span> PERFORMANCE</div><div class="stage-tag" id="stageTag">NORMAL MODE</div></div>
      <div class="game-screen"><canvas id="game" width="560" height="660" aria-label="리듬게임 필드"></canvas><div class="game-top-overlay"><span>♪ <b>${SONG.title}</b></span><span id="gameClock">00:00 / 00:48</span></div><div class="judge-display" id="judgeDisplay"></div><div id="modalHost" class="modal-host"></div></div>
      <div class="keys" id="keys"></div>
      <div class="stage-foot" id="stageFoot"></div>
    </section>
    <aside class="side right">
      <section class="card score-card"><div class="eyebrow">YOUR PERFORMANCE</div><div class="player-name" id="playerBadge">PLAYER · GUEST</div><div class="score-number" id="score">000000<span>PTS</span></div><div class="score-divider"></div><div class="stat-pair"><div class="stat-box"><small>COMBO</small><b class="pink" id="combo">0</b></div><div class="stat-box"><small>ACCURACY</small><b class="cyan" id="accuracy">100.0%</b></div></div></section>
      <section class="card progress-card"><div class="progress-head"><span>TRACK PROGRESS</span><span id="progressPercent">0%</span></div><div class="progress-bar"><i id="progressFill"></i></div><div class="judgement-rows"><div class="judgement-row judge-perfect"><span>✦ PERFECT</span><b id="perfectCount">0</b></div><div class="judgement-row judge-great"><span>◆ GREAT</span><b id="greatCount">0</b></div><div class="judgement-row judge-good"><span>● GOOD</span><b id="goodCount">0</b></div><div class="judgement-row judge-miss"><span>× MISS</span><b id="missCount">0</b></div></div></section>
      <section class="card room-panel" id="roomPanel" hidden><div class="eyebrow">함께하기 랭킹 <span id="roomPanelCode"></span></div><div class="room-players" id="roomPlayers"></div></section>
      <section class="card solo-panel" id="soloPanel"><div class="eyebrow">혼자하기 랭킹</div><div class="solo-ranking-list" id="soloRankingList"></div><small>이 브라우저의 난이도별 기록</small></section>
      <section class="card help"><div class="eyebrow">HOW TO PLAY</div><h3>빛이 닿는 순간 눌러요</h3><div class="help-grid" id="helpGrid"></div><p id="helpText"></p></section>
      <section class="card control-card"><button id="restartBtn">↻ &nbsp; 다시 시작</button><button id="playPauseBtn">Ⅱ &nbsp; 일시정지</button></section>
    </aside>
  </main>
  <footer class="footer"><span>에이징커브 테스트 © 2026 · ORIGINAL BROWSER RHYTHM GAME</span><span>HEADPHONES RECOMMENDED ◌</span></footer>
</div>`;

const canvas = $('#game');
const ctx = canvas.getContext('2d');
let state, audioCtx, master, noiseBuffer, startAt;
let pressed = Array(keys.length).fill(0), particles = [], judgementUntil = 0;
let room = null, roomClockOffset = 0, lastProgressSent = 0;
const keyboardHeld = new Set(), pointerHeld = new Set();
const isLaneHeld = lane => keyboardHeld.has(lane) || pointerHeld.has(lane);

function setDifficulty(level) {
  if (state.mode !== 'idle' && state.mode !== 'lobby') return;
  state.difficulty = level;
  state.notes = buildChart(level);
  keys = keyLabelsForDifficulty(level);
  laneColors = keys.length === 4 ? FOUR_COLORS : COLORS;
  pressed = Array(keys.length).fill(0);keyboardHeld.clear();pointerHeld.clear();
  renderKeys();
  document.querySelectorAll('[data-difficulty]').forEach(button => {
    button.classList.toggle('active',button.dataset.difficulty === level);
    button.setAttribute('aria-pressed',button.dataset.difficulty === level ? 'true':'false');
  });
  $('#difficultyName').textContent = LEVEL_LABELS[level];
  $('#difficultyHint').textContent = HINTS[level];
  $('#stageTag').textContent = `${LEVEL_LABELS[level]} MODE`;
  $('#laneCountLabel').textContent=`${keys.length} LANES`;
  $('#game').setAttribute('aria-label',`${keys.length}레인의 리듬게임 필드`);
  renderSoloRanking();
  const modalHelp=$('#modalHost .modal-help');if(modalHelp)modalHelp.textContent=keys.join(' · ');
}
function setSpeed(speed) {
  if (state.mode !== 'idle' && state.mode !== 'lobby') return;
  if (!SPEEDS.includes(Number(speed))) return;
  state.speed = Number(speed);
  $('#speedValue').textContent=`${state.speed.toFixed(2)}×`;
  document.querySelectorAll('[data-speed]').forEach(button=>{
    const active=Number(button.dataset.speed)===state.speed;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',active?'true':'false');
  });
}
function renderKeys() {
  $('#keys').style.setProperty('--lanes',keys.length);
  $('#keys').innerHTML=keys.map((key,i)=>`<button class="key ${key==='SPACE'?'space':''}" data-lane="${i}" style="--color:${laneColors[i]}" aria-label="${key==='SPACE'?'스페이스바':key} 레인 치기">${key}<small>LANE ${i+1}</small></button>`).join('');
  $('#helpGrid').style.setProperty('--lanes',keys.length);
  $('#helpGrid').innerHTML=keys.map(key=>`<div class="help-key ${key==='SPACE'?'space':''}">${key}</div>`).join('');
  $('#helpText').textContent=`노트가 판정선에 닿을 때 ${keys.join(' · ')} 키를 누르세요. 긴 노트는 끝까지 누르고 있으세요. P는 일시정지입니다.`;
  $('#stageFoot').textContent=`${keys.join(' · ')}  |  긴 노트는 끝까지 누르기  |  P 일시정지`;
  document.querySelectorAll('[data-lane]').forEach(button=>{
    const lane=Number(button.dataset.lane);
    button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);pressLane(lane,pointerHeld);});
    button.addEventListener('pointerup',()=>releaseLane(lane,pointerHeld));
    button.addEventListener('pointercancel',()=>releaseLane(lane,pointerHeld));
  });
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character])); }
function rankingKey(level) { return `finger-champ-solo-v1-${level}`; }
function loadRanking(level) {
  try {
    const rows=JSON.parse(localStorage.getItem(rankingKey(level)) || '[]');
    if(Array.isArray(rows))return insertRanking(rows,undefined);
  } catch { /* Browser storage can be unavailable. */ }
  return rankingMemory.get(level) || [];
}
function saveRanking(level,entry) {
  const rows=insertRanking(loadRanking(level),entry);
  rankingMemory.set(level,rows);
  try { localStorage.setItem(rankingKey(level),JSON.stringify(rows)); } catch { /* Keep rankings for this session. */ }
  return rows;
}
function renderSoloRanking(){
  const rows=loadRanking(state.difficulty).slice(0,5);
  $('#soloRankingList').innerHTML=rows.length?rows.map((row,index)=>`<div class="solo-ranking-row"><span>${index+1}</span><b>${escapeHtml(row.name)}</b><strong>${Number(row.score).toLocaleString()}</strong></div>`).join(''):'<div class="ranking-empty">아직 기록이 없어요. 첫 기록을 남겨보세요!</div>';
}
function rankingHtml(rows,currentId) {
  const place=rows.findIndex(row=>row.id===currentId);
  return `<div class="ranking"><div class="ranking-heading"><b>혼자하기 · ${LEVEL_LABELS[state.difficulty]}</b><span>${place>=0?`내 순위 ${place+1}위`:'TOP 10 도전!'}</span></div><div class="ranking-list">${rows.slice(0,5).map((row,index)=>`<div class="ranking-row ${row.id===currentId?'mine':''}"><span>${String(index+1).padStart(2,'0')}</span><b>${escapeHtml(row.name)}</b><strong>${Number(row.score).toLocaleString()}</strong></div>`).join('')}</div><small>이 브라우저의 난이도별 혼자하기 기록</small></div>`;
}
function roomRankingHtml(snapshot){
  const players=[...snapshot.players].sort((a,b)=>b.score-a.score||b.accuracy-a.accuracy||a.name.localeCompare(b.name,'ko'));
  return `<div class="ranking room-ranking"><div class="ranking-heading"><b>함께하기 · 방 #${snapshot.code}</b><span>${snapshot.status==='finished'?'최종 순위':'실시간 순위'}</span></div><div class="ranking-list">${players.map((player,index)=>`<div class="ranking-row ${player.id===room.selfId?'mine':''}"><span>${String(index+1).padStart(2,'0')}</span><b>${escapeHtml(player.name)}</b><strong>${Number(player.score).toLocaleString()}</strong><small>${player.finished?'완료':`${Math.round(player.progress)}% 진행`}</small></div>`).join('')}</div><small>같은 방 참가자만 표시됩니다.</small></div>`;
}

function showModal(icon, eyebrow, title, body, button, action, extra = '', options = {}) {
  const setup=!icon&&!eyebrow&&!title&&!body;
  const heading=setup?'<h2 class="visually-hidden">게임 설정</h2>':`${options.compact?'':`<div class="modal-icon">${icon}</div><div class="eyebrow">${eyebrow}</div>`}<h2>${title}</h2><p>${body}</p>`;
  $('#modalHost').innerHTML = `<div class="modal ${setup?'setup-modal':''} ${options.compact?'compact-modal':''}"><div class="modal-scroll">${heading}${extra}</div><div class="modal-actions">${options.secondaryLabel?`<button type="button" class="modal-secondary" id="modalSecondary">${options.secondaryLabel}</button>`:''}<button class="primary-button" id="modalAction">${button}</button></div><span class="modal-help">${keys.join(' · ')}</span></div>`;
  $('#modalHost').style.display = 'grid';
  $('#modalAction').onclick = action;
  if(options.secondaryLabel)$('#modalSecondary').onclick=options.secondaryAction;
}
function hideModal() { $('#modalHost').style.display = 'none'; $('#modalHost').innerHTML = ''; }
function difficultyChoices(selected, attribute='data-difficulty') {
  return `<div class="difficulty-options" role="group" aria-label="난이도 선택">${Object.entries(LEVEL_LABELS).map(([level,label])=>`<button type="button" ${attribute}="${level}" class="${selected===level?'active':''}" aria-pressed="${selected===level}">${label}<small>${level==='easy'||level==='normal'?'4 LANES':'7 LANES'}</small></button>`).join('')}</div>`;
}
function speedChoices(selected, attribute='data-speed') {
  return `<div class="speed-options" role="group" aria-label="게임 속도">${SPEEDS.map(speed=>`<button type="button" ${attribute}="${speed}" class="${selected===speed?'active':''}" aria-pressed="${selected===speed}">${speed.toFixed(2)}×</button>`).join('')}</div>`;
}
function setupModeUI() {
  $('#soloPanel').hidden=state.playMode==='together';
  document.querySelectorAll('[data-play-mode]').forEach(button=>button.classList.toggle('active',button.dataset.playMode===state.playMode));
  document.querySelectorAll('[data-room-action]').forEach(button=>button.classList.toggle('active',button.dataset.roomAction===state.roomAction));
  $('#roomActionRow').hidden=state.playMode!=='together';
  $('#roomCodeRow').hidden=state.playMode!=='together'||state.roomAction!=='join';
  $('#setupSettings').hidden=state.playMode==='together'&&state.roomAction==='join';
  $('#modalAction').textContent=state.playMode==='solo'?'혼자 시작하기':state.roomAction==='create'?'방 만들기':'방 참여하기';
}
function reset() {
  if(room) leaveRoom();
  if (audioCtx) { audioCtx.close().catch(()=>{}); audioCtx = null; }
  master = null;
  state = { mode:'idle', playMode:state?.playMode || 'solo', roomAction:'create', difficulty:state?.difficulty || 'normal', speed:state?.speed || 1, playerName:state?.playerName || '', notes:[], score:0, combo:0, maxCombo:0, perfect:0, great:0, good:0, miss:0, weighted:0, sound:state?.sound ?? true, time:0, missCursor:0, startAtEpoch:0 };
  particles=[]; pressed=Array(keys.length).fill(0);keyboardHeld.clear();pointerHeld.clear();
  $('#roomPanel').hidden=true;roomClockOffset=0;
  $('#soloPanel').hidden=state.playMode==='together';
  setDifficulty(state.difficulty);
  setSpeed(state.speed);
  renderSoloRanking();
  updateHUD();
  const setup=`<label class="name-label" for="playerName">플레이어 이름</label><input id="playerName" class="name-input" maxlength="12" placeholder="이름을 입력하세요" value="${escapeHtml(state.playerName)}" autocomplete="nickname" /><div id="nameError" class="name-error"></div><div class="name-label">플레이 모드</div><div class="mode-options"><button type="button" data-play-mode="solo">혼자하기</button><button type="button" data-play-mode="together">함께하기</button></div><div class="mode-options" id="roomActionRow"><button type="button" data-room-action="create">방 만들기</button><button type="button" data-room-action="join">참여하기</button></div><div id="roomCodeRow"><label class="name-label" for="roomCodeInput">방번호 6자리</label><input id="roomCodeInput" class="name-input" inputmode="numeric" maxlength="6" placeholder="방번호 입력" /></div><div id="setupSettings"><div class="name-label">난이도 선택</div>${difficultyChoices(state.difficulty)}<div class="difficulty-hint" id="setupDifficultyHint">${HINTS[state.difficulty]}</div><div class="name-label">게임 속도</div>${speedChoices(state.speed)}</div><div class="setup-error" id="setupError"></div>`;
  showModal('','','','','혼자 시작하기',startGame,setup);
  document.querySelectorAll('[data-play-mode]').forEach(button=>button.onclick=()=>{state.playMode=button.dataset.playMode;setupModeUI();});
  document.querySelectorAll('[data-room-action]').forEach(button=>button.onclick=()=>{state.roomAction=button.dataset.roomAction;setupModeUI();});
  document.querySelectorAll('[data-difficulty]').forEach(button=>button.onclick=()=>{setDifficulty(button.dataset.difficulty);$('#setupDifficultyHint').textContent=HINTS[state.difficulty];});
  document.querySelectorAll('[data-speed]').forEach(button=>button.onclick=()=>setSpeed(button.dataset.speed));
  setupModeUI();
  $('#playerName').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();startGame();}});
  $('#pauseBtn').disabled=false;$('#playPauseBtn').disabled=false;
  $('#pauseBtn').textContent='Ⅱ'; $('#playPauseBtn').innerHTML='Ⅱ &nbsp; 일시정지';$('#restartBtn').innerHTML='↻ &nbsp; 다시 시작';
}

function makeTone(at, freq, length, type='triangle', volume=.1, endFreq) {
  const osc=audioCtx.createOscillator(), gain=audioCtx.createGain();
  osc.type=type; osc.frequency.setValueAtTime(freq,at);
  if(endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq,at+length);
  gain.gain.setValueAtTime(.0001,at); gain.gain.exponentialRampToValueAtTime(Math.max(.001,volume),at+.006);
  gain.gain.exponentialRampToValueAtTime(.0001,at+length);
  osc.connect(gain).connect(master);osc.start(at);osc.stop(at+length+.02);
}
function noise(at, length, volume, highpass) {
  const source=audioCtx.createBufferSource(),filter=audioCtx.createBiquadFilter(),gain=audioCtx.createGain();
  source.buffer=noiseBuffer;filter.type='highpass';filter.frequency.value=highpass;
  gain.gain.setValueAtTime(volume,at);gain.gain.exponentialRampToValueAtTime(.0001,at+length);
  source.connect(filter).connect(gain).connect(master);source.start(at);source.stop(at+length);
}
function scheduleMusic() {
  const roots=[110,87.31,130.81,98];
  const chords=[[220,261.63,329.63],[174.61,220,261.63],[261.63,329.63,392],[196,246.94,293.66]];
  const melody=[440,523.25,659.25,587.33,392,493.88,659.25,783.99];
  for(let bar=0;bar<SONG.bars+1;bar++){
    const chord=chords[bar%4],root=roots[bar%4];
    for(let beat=0;beat<4;beat++){
      const count=bar*4+beat,at=startAt+count*SONG.beat;
      if(at>startAt+SONG.duration-.7)continue;
      // Bass drum, clap, hi-hat, bass and a small repeating lead.
      if(beat%2===0)makeTone(at,140,.24,'sine',.45,47);
      if(beat%2===1){noise(at,.13,.14,1100);makeTone(at,185,.06,'triangle',.08,100);}
      noise(at,.055,.055,6500);noise(at+SONG.beat*.5,.035,.029,7500);
      makeTone(at,root,.33,'sawtooth',.075,root*.98);
      if(bar>=1){
        makeTone(at,melody[(bar*3+beat)%melody.length],.15,'triangle',.049);
        if(beat===0||beat===2)chord.forEach(freq=>makeTone(at,freq,.75,'sine',.027));
      }
    }
  }
}
function ensureAudio() {
  if (audioCtx) { audioCtx.resume().catch(()=>{}); return; }
  try {
    audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    audioCtx.resume().catch(()=>{});
    master=audioCtx.createGain();master.gain.value=state.sound ? .68 : 0;master.connect(audioCtx.destination);
    noiseBuffer=audioCtx.createBuffer(1,Math.round(audioCtx.sampleRate*.25),audioCtx.sampleRate);
    const data=noiseBuffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
  } catch { audioCtx=null; master=null; }
}
async function api(path,data) {
  const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error || '서버 연결에 실패했습니다.');
  return result;
}
function leaveRoom() {
  if(!room)return;
  const leaving=room;
  leaving.events?.close();room=null;
  api(`/api/rooms/${leaving.code}/leave`,{playerId:leaving.playerId}).catch(()=>{});
}
function postProgress(finished) {
  if(!room)return;
  const judged=state.perfect+state.great+state.good+state.miss;
  const data={playerId:room.playerId,round:room.currentRound,score:state.score,combo:state.combo,accuracy:judged?state.weighted/judged*100:100,progress:Math.min(100,state.time/SONG.duration*100),finished};
  api(`/api/rooms/${room.code}/progress`,data).catch(()=>{});
}
function renderRoomPanel(snapshot) {
  $('#roomPanel').hidden=false;
  $('#roomPanelCode').textContent=`#${snapshot.code}`;
  const ranked=[...snapshot.players].sort((a,b)=>b.score-a.score||b.accuracy-a.accuracy||a.name.localeCompare(b.name,'ko'));
  $('#roomPlayers').innerHTML=ranked.map((player,index)=>`<div class="room-player ${player.id===room.selfId?'mine':''}"><div class="room-player-head"><b><span class="room-rank">${index+1}위</span> ${escapeHtml(player.name)}${player.id===snapshot.hostId?' 👑':''}</b><strong>${player.score.toLocaleString()} PTS</strong></div><div class="room-player-stats"><span>${player.finished?'완료':`${Math.round(player.progress)}%`}</span><span>콤보 ${player.combo}</span><span>정확도 ${player.accuracy.toFixed(1)}%</span></div><div class="room-player-track"><i style="width:${player.progress}%"></i></div></div>`).join('');
}
function renderLobby(snapshot) {
  const host=room.selfId===snapshot.hostId;
  const players=`<div class="room-code">방번호 <strong>${snapshot.code}</strong></div><div class="room-lobby-players">${snapshot.players.map(player=>`<span>${escapeHtml(player.name)}${player.id===snapshot.hostId?' 👑':''}</span>`).join('')}</div>`;
  const controls=host?`<div class="name-label">난이도 선택</div>${difficultyChoices(snapshot.difficulty,'data-room-difficulty')}<div class="name-label room-speed-label">게임 속도</div>${speedChoices(snapshot.speed,'data-room-speed')}`:`<div class="room-wait">방장이 난이도와 속도를 정하고 시작할 때까지 기다려 주세요.<br>${LEVEL_LABELS[snapshot.difficulty]} · ${snapshot.speed.toFixed(2)}×</div>`;
  const extra=`${players}${controls}<div class="setup-error" id="lobbyError"></div>`;
  const title=snapshot.round>1?'다음 판 준비':host?'방을 만들었어요':'방에 참가했어요';
  const description=snapshot.round>1?'방번호와 참가자는 그대로예요. 방장이 설정한 뒤 다시 시작합니다.':host?'방번호를 친구에게 알려주세요.':'같은 방에서 함께 플레이할 수 있어요.';
  showModal('♫','TOGETHER MODE',title,description,host?'게임 시작':'방 나가기',host?startRoom:reset,extra,{compact:true,secondaryLabel:host?'방 나가기':null,secondaryAction:reset});
  if(host){
    document.querySelectorAll('[data-room-difficulty]').forEach(button=>button.onclick=()=>updateRoomSettings(button.dataset.roomDifficulty,snapshot.speed));
    document.querySelectorAll('[data-room-speed]').forEach(button=>button.onclick=()=>updateRoomSettings(snapshot.difficulty,Number(button.dataset.roomSpeed)));
  }
}
async function updateRoomSettings(difficulty,speed) {
  try { await api(`/api/rooms/${room.code}/settings`,{playerId:room.playerId,difficulty,speed}); }
  catch(error){const field=$('#lobbyError');if(field)field.textContent=error.message;}
}
async function startRoom() {
  try { await api(`/api/rooms/${room.code}/start`,{playerId:room.playerId}); }
  catch(error){const field=$('#lobbyError');if(field)field.textContent=error.message;}
}
function resetRound(snapshot){
  room.currentRound=snapshot.round;
  state.mode='lobby';state.time=0;state.startAtEpoch=0;state.missCursor=0;
  state.score=0;state.combo=0;state.maxCombo=0;
  state.perfect=0;state.great=0;state.good=0;state.miss=0;state.weighted=0;
  state.notes=buildChart(snapshot.difficulty);
  particles=[];pressed=Array(keys.length).fill(0);keyboardHeld.clear();pointerHeld.clear();
  document.querySelectorAll('[data-lane]').forEach(button=>button.classList.remove('pressed'));
  $('#judgeDisplay').classList.remove('show');judgementUntil=0;
  updateHUD();
}
async function replayRoom(){
  if(!room)return;
  const message=$('#replayMessage');
  if(room.selfId!==room.snapshot.hostId){
    if(message)message.textContent='방장이 다음 판을 준비할 때까지 같은 방에서 기다려 주세요.';
    $('#modalAction').disabled=true;
    $('#modalAction').textContent='방장 기다리는 중';
    return;
  }
  $('#modalAction').disabled=true;
  try{await api(`/api/rooms/${room.code}/replay`,{playerId:room.playerId});}
  catch(error){if(message)message.textContent=error.message;const button=$('#modalAction');if(button)button.disabled=false;}
}
function onRoomSnapshot(snapshot) {
  if(!room)return;
  room.snapshot=snapshot;
  if(snapshot.round!==room.currentRound)resetRound(snapshot);
  if(state.mode==='lobby')roomClockOffset=snapshot.serverNow-Date.now();
  renderRoomPanel(snapshot);
  const resultRanking=$('#resultRanking');
  if(resultRanking)resultRanking.innerHTML=roomRankingHtml(snapshot);
  const replayMessage=$('#replayMessage');
  if(replayMessage&&snapshot.status==='finished'&&room.selfId===snapshot.hostId)replayMessage.textContent='모든 참가자가 끝났어요. 다시하기를 누르면 같은 방에서 다음 판을 준비합니다.';
  if(snapshot.status==='lobby'){
    state.mode='lobby';
    if(state.difficulty!==snapshot.difficulty)setDifficulty(snapshot.difficulty);
    if(state.speed!==snapshot.speed)setSpeed(snapshot.speed);
    renderLobby(snapshot);
  } else if(state.mode==='lobby') {
    if(state.difficulty!==snapshot.difficulty)setDifficulty(snapshot.difficulty);
    if(state.speed!==snapshot.speed)setSpeed(snapshot.speed);
    beginCountdown(snapshot.startsAt);
  }
}
function connectRoom(data) {
  room={code:data.code,playerId:data.playerId,selfId:data.selfId,currentRound:data.snapshot.round,snapshot:data.snapshot,events:null};
  state.mode='lobby';
  onRoomSnapshot(data.snapshot);
  const events=new EventSource(`/api/rooms/${room.code}/events?playerId=${encodeURIComponent(room.playerId)}`);
  room.events=events;
  events.onmessage=event=>{try{onRoomSnapshot(JSON.parse(event.data));}catch{/* Ignore malformed updates. */}};
  events.onerror=()=>{$('#roomPanel .eyebrow').classList.add('reconnecting');};
  events.onopen=()=>{$('#roomPanel .eyebrow').classList.remove('reconnecting');};
}
async function startGame() {
  if(state.mode!=='idle')return;
  const playerName=normalizeName($('#playerName')?.value);
  if(!playerName){$('#nameError').textContent='이름을 입력해야 게임을 시작할 수 있어요.';$('#playerName')?.focus();return;}
  state.playerName=playerName;$('#playerBadge').textContent=`PLAYER · ${playerName}`;
  $('#soloPanel').hidden=state.playMode==='together';
  ensureAudio();
  if(state.playMode==='solo'){beginCountdown(Date.now()+3000);return;}
  const code=$('#roomCodeInput')?.value.trim();
  if(state.roomAction==='join'&&!/^\d{6}$/.test(code)){ $('#setupError').textContent='방번호 6자리를 입력해 주세요.';return; }
  $('#modalAction').disabled=true;
  try {
    const data=state.roomAction==='create'?await api('/api/rooms',{name:playerName}):await api(`/api/rooms/${code}/join`,{name:playerName});
    if(state.roomAction==='create')data.snapshot=await api(`/api/rooms/${data.code}/settings`,{playerId:data.playerId,difficulty:state.difficulty,speed:state.speed});
    connectRoom(data);
  } catch(error) { $('#setupError').textContent=error.message;$('#modalAction').disabled=false; }
}
function beginCountdown(startsAtEpoch) {
  state.startAtEpoch=startsAtEpoch;state.time=0;state.mode='countdown';
  if(audioCtx&&master){
    startAt=audioCtx.currentTime+Math.max(.02,(startsAtEpoch-Date.now()-roomClockOffset)/1000);
    scheduleMusic();
  }
  $('#modalHost').innerHTML='<div class="countdown"><small>GET READY</small><strong id="countdownNumber">3</strong><span>곧 시작합니다</span></div>';
  $('#modalHost').style.display='grid';
  $('#pauseBtn').disabled=state.playMode==='together';
  $('#playPauseBtn').disabled=state.playMode==='together';
  $('#playPauseBtn').textContent=state.playMode==='together'?'함께하기 진행 중':'Ⅱ   일시정지';
  $('#restartBtn').textContent=state.playMode==='together'?'방 나가기':'↻   다시 시작';
}
function currentTime() { return (Date.now()+roomClockOffset-state.startAtEpoch)/1000; }
function togglePause() {
  if(state.playMode==='together'||state.mode==='idle'||state.mode==='countdown'||state.mode==='lobby'||state.mode==='finished')return;
  if(state.mode==='running'){
    state.time=Math.max(0,currentTime());state.mode='paused';state.pauseStarted=Date.now();
    if(audioCtx)audioCtx.suspend();
    showModal('Ⅱ','TAKE A BREATH','잠시 멈췄어요','준비되면 이어서 연주하세요. 음악과 노트가 같은 자리에서 다시 시작됩니다.','계속하기',togglePause);
    $('#pauseBtn').textContent='▶';$('#playPauseBtn').innerHTML='▶ &nbsp; 계속하기';
  }else{
    state.startAtEpoch+=Date.now()-state.pauseStarted;
    if(audioCtx)audioCtx.resume().catch(()=>{});
    state.mode='running';hideModal();$('#pauseBtn').textContent='Ⅱ';$('#playPauseBtn').innerHTML='Ⅱ &nbsp; 일시정지';
  }
}
function finish() {
  state.mode='finished';
  if(room){
    const self=room.snapshot?.players.find(player=>player.id===room.selfId);
    if(self){self.score=state.score;self.combo=state.combo;self.progress=100;self.finished=true;renderRoomPanel(room.snapshot);}
  }
  postProgress(true);
  const accuracy=state.notes.length?state.weighted/state.notes.length:0;
  const rank=accuracy>=.95?'S':accuracy>=.85?'A':accuracy>=.70?'B':accuracy>=.55?'C':'D';
  let ranking;
  if(room)ranking=`<div id="resultRanking">${roomRankingHtml(room.snapshot)}</div>`;
  else{
    const id=`${Date.now()}-${Math.random()}`;
    const rows=saveRanking(state.difficulty,{id,name:state.playerName,score:state.score,accuracy,maxCombo:state.maxCombo,at:Date.now()});
    renderSoloRanking();
    ranking=rankingHtml(rows,id);
  }
  const extra=`<div class="result-rank">${rank}</div><div class="result-stats"><span>SCORE<b>${state.score.toLocaleString()}</b></span><span>ACCURACY<b>${(accuracy*100).toFixed(1)}%</b></span><span>MAX COMBO<b>${state.maxCombo}</b></span></div>${ranking}${room?'<div class="replay-message" id="replayMessage">같은 방에서 다시 시작할 수 있어요.</div>':''}`;
  showModal('✦','PERFORMANCE COMPLETE','무대가 끝났어요',`${escapeHtml(state.playerName)}님, 총 ${state.notes.length}개의 노트 중 ${state.perfect}개를 PERFECT로 맞혔어요.`, '다시하기',room?replayRoom:reset,extra,{secondaryLabel:room?'방 나가기':null,secondaryAction:reset});
  updateHUD();
}
function showJudgement(label,color){
  const element=$('#judgeDisplay');element.textContent=label;element.style.color=color;element.classList.add('show');judgementUntil=performance.now()+420;
}
function awardNote(note,judge){
  note.hit=true;note.holding=false;clearHoldSparks(note.lane);state.combo++;state.maxCombo=Math.max(state.maxCombo,state.combo);
  const value=judge==='PERFECT'?1:judge==='GREAT'?.7:.4;
  state.weighted+=value;state.score+=Math.round(value*(note.endT?1500:1000)+(Math.min(50,state.combo)*4));
  state[judge.toLowerCase()]++;
  showJudgement(note.endT?`${judge} HOLD`:judge,judge==='PERFECT'?'#ffe08b':judge==='GREAT'?'#7fe8ff':'#bba6ff');
  for(let i=0;i<14;i++){const angle=Math.random()*Math.PI*2,speed=2+Math.random()*5;particles.push({x:laneCenter(note.lane,548),y:548,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-2,life:1,color:laneColors[note.lane]});}
  if(audioCtx&&state.sound)makeTone(audioCtx.currentTime,600+note.lane*110,.09,'sine',.06);
  updateHUD();
}
function breakHold(note){
  note.holding=false;note.missed=true;clearHoldSparks(note.lane);state.miss++;state.combo=0;
  showJudgement('HOLD BREAK','#ff7c9a');updateHUD();
}
function settleHold(lane,time,isPressed){
  const note=state.notes.find(candidate=>candidate.lane===lane&&candidate.holding);
  if(!note)return;
  const result=holdResult(note,time,isPressed);
  if(result==='complete')awardNote(note,note.judge);
  if(result==='miss')breakHold(note);
}
function hitLane(lane){
  if(state.mode!=='running')return;
  const time=currentTime();pressed[lane]=performance.now()+130;
  const index=findHit(state.notes,lane,time);
  if(index<0)return;
  const note=state.notes[index],judge=judgeOffset(time-note.t);
  if(!judge)return;
  if(note.endT){note.holding=true;note.judge=judge;note.lastSparkAt=0;showJudgement('HOLD','#fff0ac');}
  else awardNote(note,judge);
}
function pressLane(lane,source){
  if(source.has(lane))return;
  const wasHeld=isLaneHeld(lane);source.add(lane);
  document.querySelector(`[data-lane="${lane}"]`).classList.add('pressed');
  if(!wasHeld)hitLane(lane);
}
function releaseLane(lane,source){
  source.delete(lane);
  if(isLaneHeld(lane))return;
  document.querySelector(`[data-lane="${lane}"]`).classList.remove('pressed');
  if(state.mode==='running')settleHold(lane,currentTime(),false);
}
function updateHUD(){
  $('#score').innerHTML=String(state.score).padStart(6,'0')+'<span>PTS</span>';
  $('#combo').textContent=state.combo;
  const judged=state.perfect+state.great+state.good+state.miss;
  $('#accuracy').textContent=`${(judged?state.weighted/judged*100:100).toFixed(1)}%`;
  $('#perfectCount').textContent=state.perfect;$('#greatCount').textContent=state.great;$('#goodCount').textContent=state.good;$('#missCount').textContent=state.miss;
  const progress=Math.min(100,Math.max(0,state.time/SONG.duration*100));
  $('#progressFill').style.width=`${progress}%`;$('#progressPercent').textContent=`${Math.round(progress)}%`;
  const format=t=>`${String(Math.floor(Math.max(0,t)/60)).padStart(2,'0')}:${String(Math.floor(Math.max(0,t)%60)).padStart(2,'0')}`;
  $('#gameClock').textContent=`${format(state.time)} / ${format(Math.ceil(SONG.duration))}`;
}

const W=560,H=660,HIT_Y=548,TRAVEL=270;
function clearHoldSparks(lane){particles=particles.filter(particle=>!(particle.spark&&particle.lane===lane));}
function emitHoldSparks(note,now){
  if(now-note.lastSparkAt<48)return;
  note.lastSparkAt=now;
  const x=laneCenter(note.lane,HIT_Y),width=(bounds().right-bounds().left)/keys.length;
  for(let i=0;i<3;i++){
    const side=i===0?-1:i===1?1:Math.random()>.5?1:-1;
    particles.push({spark:true,lane:note.lane,x:x+side*(width*.16+Math.random()*width*.24),y:HIT_Y-8+Math.random()*18,
      vx:side*(1.6+Math.random()*3),vy:-2.5-Math.random()*3,life:.75+Math.random()*.25,
      color:i===2?'#ffffff':laneColors[note.lane]});
  }
}
function travel(){return TRAVEL*state.speed;}
function bounds(){return {left:52,right:508};}
function laneCenter(lane,y){const b=bounds(y);return b.left+(b.right-b.left)*(lane+.5)/keys.length;}
function poly(points,fill,stroke,line=1){ctx.beginPath();ctx.moveTo(...points[0]);for(const p of points.slice(1))ctx.lineTo(...p);ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();}}
function line(x1,y1,x2,y2,color,width=1){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function roundRect(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
function drawBackground(time){
  const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#2b3546');bg.addColorStop(.5,'#263142');bg.addColorStop(1,'#192535');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  for(let i=0;i<35;i++){const x=(i*137+29)%W,y=(i*73+47)%H;ctx.globalAlpha=.08+(Math.sin(time+i)*.5+.5)*.12;ctx.fillStyle='#f5ead6';ctx.beginPath();ctx.arc(x,y,1,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
}
function drawRunway(time){
  poly([[52,0],[508,0],[508,H],[52,H]],'#1b2737','#a6b7b477',2);
  const floor=ctx.createLinearGradient(0,0,0,H);floor.addColorStop(0,'#293749');floor.addColorStop(1,'#344553');ctx.fillStyle=floor;ctx.fillRect(52,0,456,H);
  for(let lane=0;lane<keys.length;lane++){
    const b0=bounds(0),b1=bounds(H),a0=b0.left+(b0.right-b0.left)*lane/keys.length,a1=b1.left+(b1.right-b1.left)*lane/keys.length,z0=b0.left+(b0.right-b0.left)*(lane+1)/keys.length,z1=b1.left+(b1.right-b1.left)*(lane+1)/keys.length;
    poly([[a0,0],[z0,0],[z1,H],[a1,H]],`${laneColors[lane]}0c`);
  }
  for(let lane=0;lane<=keys.length;lane++){const b0=bounds(0),b1=bounds(H);line(b0.left+(b0.right-b0.left)*lane/keys.length,0,b1.left+(b1.right-b1.left)*lane/keys.length,H,'#d5e0db36',lane===0||lane===keys.length?2:1);}
  const beat=SONG.beat,from=Math.floor(time/beat)-1;
  for(let n=from;n<from+8;n++){
    const y=HIT_Y-(n*beat-time)*travel();if(y<0||y>H)continue;
    const b=bounds(y),alpha=Math.max(.08,Math.min(.5,y/H*.5));
    line(b.left,y,b.right,y,`rgba(222,231,221,${alpha})`,n%4===0?2:1);
  }
  const b=bounds(HIT_Y);
  ctx.shadowColor='#f1c692';ctx.shadowBlur=12;line(b.left-5,HIT_Y,b.right+5,HIT_Y,'#ffdfac',5);ctx.shadowBlur=0;
  line(b.left-5,HIT_Y+7,b.right+5,HIT_Y+7,'#f1c69266',2);
  for(let lane=0;lane<keys.length;lane++){const x=laneCenter(lane,HIT_Y),width=(b.right-b.left)/keys.length-5;roundRect(x-width/2,HIT_Y+20,width,51,8,'#243346',laneColors[lane]);}
  const vignette=ctx.createLinearGradient(0,0,0,H);vignette.addColorStop(0,'#19253566');vignette.addColorStop(.3,'#19253500');vignette.addColorStop(1,'#19253555');ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
}
function drawNote(note,time){
  const y=note.holding?HIT_Y:HIT_Y-(note.t-time)*travel();
  if(y<-25||y>HIT_Y+42)return;
  const b=bounds(y),width=(b.right-b.left)/keys.length*.82,x=laneCenter(note.lane,y),h=22,color=laneColors[note.lane];
  if(note.endT){
    const tailY=HIT_Y-(note.endT-time)*travel();
    const top=Math.max(-20,tailY),bottom=Math.min(HIT_Y+10,y);
    if(bottom>top){
      ctx.shadowColor=color;ctx.shadowBlur=14;
      roundRect(x-width*.32,top,width*.64,bottom-top,6,`${color}aa`,color);
      ctx.shadowBlur=0;
      line(x,top+3,x,bottom-3,'#ffffff88',3);
    }
    if(tailY>=-20&&tailY<=HIT_Y+10)roundRect(x-width*.4,tailY-5,width*.8,10,4,'#ffffffaa',color);
  }
  ctx.shadowColor=color;ctx.shadowBlur=18;roundRect(x-width/2,y-h/2,width,h,Math.min(9,h/2),color);ctx.shadowBlur=0;
  const shine=ctx.createLinearGradient(0,y-h/2,0,y+h/2);shine.addColorStop(0,'#ffffffdd');shine.addColorStop(.32,'#ffffff65');shine.addColorStop(1,'#ffffff00');roundRect(x-width/2+3,y-h/2+2,width-6,h*.48,5,shine);
  line(x-width/2+7,y+h/2-3,x+width/2-7,y+h/2-3,'#0b113774',2);
}
function drawHoldFeedback(note,time){
  const x=laneCenter(note.lane,HIT_Y),width=(bounds().right-bounds().left)/keys.length,color=laneColors[note.lane];
  const pulse=.8+Math.sin(time*18)*.2;
  ctx.save();
  ctx.globalCompositeOperation='lighter';
  const glow=ctx.createRadialGradient(x,HIT_Y,3,x,HIT_Y,width*.95);
  glow.addColorStop(0,`${color}cc`);glow.addColorStop(.45,`${color}66`);glow.addColorStop(1,`${color}00`);
  ctx.globalAlpha=pulse;ctx.fillStyle=glow;ctx.fillRect(x-width,HIT_Y-width,width*2,width*2);
  ctx.shadowColor=color;ctx.shadowBlur=26;
  line(x-width*.43,HIT_Y,x+width*.43,HIT_Y,'#ffffff',5+pulse*3);
  ctx.shadowBlur=0;
  ctx.globalAlpha=1;
  ctx.fillStyle='#ffffff';ctx.font='bold 12px system-ui, sans-serif';ctx.textAlign='center';
  ctx.shadowColor=color;ctx.shadowBlur=14;ctx.fillText('HOLD',x,HIT_Y-30);ctx.restore();
}
function render(time){
  drawBackground(time);drawRunway(time);
  const displayTime=state.mode==='idle'?((performance.now()/1000)%3):state.time;
  for(const note of state.notes){if(note.hit||note.missed)continue;if(!note.holding&&note.t<displayTime-.2)continue;if(note.t>displayTime+2.2)break;drawNote(note,displayTime);}
  if(state.mode==='running')for(const note of state.notes)if(note.holding&&isLaneHeld(note.lane))drawHoldFeedback(note,time);
  for(let lane=0;lane<keys.length;lane++)if(isLaneHeld(lane)||pressed[lane]>performance.now()){
    const x=laneCenter(lane,HIT_Y),b=bounds(HIT_Y),width=(b.right-b.left)/keys.length-5;
    ctx.shadowColor=laneColors[lane];ctx.shadowBlur=30;roundRect(x-width/2,HIT_Y+20,width,51,10,laneColors[lane]);ctx.shadowBlur=0;
  }
  ctx.save();
  for(const particle of particles){
    ctx.globalAlpha=particle.life;ctx.shadowColor=particle.color;ctx.shadowBlur=particle.spark?18:8;
    if(particle.spark){
      ctx.strokeStyle=particle.color;ctx.lineWidth=2.6*particle.life;ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(particle.x,particle.y);ctx.lineTo(particle.x-particle.vx*2.2,particle.y-particle.vy*2.2);ctx.stroke();
    }else{
      ctx.fillStyle=particle.color;ctx.beginPath();ctx.arc(particle.x,particle.y,2.5*particle.life,0,Math.PI*2);ctx.fill();
    }
    ctx.shadowBlur=0;
  }ctx.restore();
}
function loop(){
  if(state.mode==='countdown'){
    const remaining=Math.ceil((state.startAtEpoch-Date.now()-roomClockOffset)/1000);
    if(remaining>0){const number=$('#countdownNumber');if(number)number.textContent=remaining;}
    else {state.mode='running';hideModal();lastProgressSent=0;}
  }
  if(state.mode==='running'){
    state.time=Math.max(0,currentTime());
    for(const note of state.notes)if(note.holding)settleHold(note.lane,state.time,isLaneHeld(note.lane));
    const now=performance.now();
    for(const note of state.notes)if(note.holding&&isLaneHeld(note.lane))emitHoldSparks(note,now);
    while(state.missCursor<state.notes.length&&state.notes[state.missCursor].t<state.time-.19){
      const note=state.notes[state.missCursor++];if(!note.hit&&!note.holding&&!note.missed){note.missed=true;state.miss++;state.combo=0;showJudgement('MISS','#ff7c9a');}
    }
    if(state.time>=SONG.duration)finish();
    updateHUD();
    if(room&&performance.now()-lastProgressSent>250){lastProgressSent=performance.now();postProgress(false);}
  }
  particles=advanceParticles(particles);
  if(performance.now()>judgementUntil)$('#judgeDisplay').classList.remove('show');
  render(performance.now()/1000);frameId=requestAnimationFrame(loop);
}

const listeners = new AbortController();
window.addEventListener('keydown',event=>{
  if(event.target instanceof HTMLInputElement)return;
  const lane=laneForCode(event.code,state.difficulty);
  if(lane>=0){event.preventDefault();if(!event.repeat)pressLane(lane,keyboardHeld);}
  if(isPauseCode(event.code)){event.preventDefault();if(!event.repeat)togglePause();}
},{signal:listeners.signal});
window.addEventListener('keyup',event=>{
  const lane=laneForCode(event.code,state.difficulty);
  if(lane>=0){event.preventDefault();releaseLane(lane,keyboardHeld);}
},{signal:listeners.signal});
window.addEventListener('blur',()=>{
  for(const lane of [...keyboardHeld])releaseLane(lane,keyboardHeld);
  for(const lane of [...pointerHeld])releaseLane(lane,pointerHeld);
},{signal:listeners.signal});
window.addEventListener('pagehide',()=>{
  if(room)navigator.sendBeacon(`/api/rooms/${room.code}/leave`,new Blob([JSON.stringify({playerId:room.playerId})],{type:'application/json'}));
},{signal:listeners.signal});
$('#soundBtn').onclick=()=>{state.sound=!state.sound;$('#soundBtn').textContent=state.sound?'♫':'♪';$('#soundBtn').setAttribute('aria-label',state.sound?'소리 끄기':'소리 켜기');if(master)master.gain.setTargetAtTime(state.sound ? .68 : 0,audioCtx.currentTime,.02);};
$('#pauseBtn').onclick=togglePause;$('#playPauseBtn').onclick=togglePause;$('#restartBtn').onclick=reset;
let frameId;
reset();frameId=requestAnimationFrame(loop);
return () => {
  listeners.abort();
  cancelAnimationFrame(frameId);
  if(room)leaveRoom();
  if(audioCtx)audioCtx.close().catch(()=>{});
  app.replaceChildren();
};
}
