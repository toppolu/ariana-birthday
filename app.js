

// Debug / preview mode: add ?preview=1 to the URL to unlock all doors anytime
const PREVIEW_MODE = new URLSearchParams(window.location.search).has("preview");
// 17 Crystal Quest — mobile-first, single-file app (no frameworks)
// NOTE: Gift card codes in client-side JS are NOT secure. Use placeholders here and store real codes server-side.

const PT_TZ = "America/Los_Angeles";

// ---------- Config ----------
function getPTDateParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: PT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = fmt.formatToParts(date).reduce((acc, p) => (acc[p.type] = p.value, acc), {});
  return { y: Number(parts.year), m: Number(parts.month), d: Number(parts.day) };
}

function getQuestYear() {
  // Choose the next March 17 in PT. If today is after Mar 17, use next year.
  const { y, m, d } = getPTDateParts();
  if (m > 3 || (m === 3 && d > 17)) return y + 1;
  return y;
}

const QUEST = {
  year: getQuestYear(),
  month: 3, // March
  startDay: 1,
  endDay: 17,
};

const DAYS = [
  // day: 1..17
  { type: "intro", title: "Welcome to Crystal Quest! 🔮", crystalName: "Quest Crystal", affirm: "Your adventure begins today — let's go! 🚀" },
  { type: "starparty_duo", title: "Star Party Puzzle ⭐", crystalName: "Wisdom Crystal", affirm: "Your cleverness amazes everyone around you." },
  { type: "mcd_gift", title: "Bubble Pop Math!", crystalName: "Star Crystal", affirm: "Your quick thinking is a superpower." },

  { type: "letter1", title: "A Message for You", crystalName: "Heart Crystal", affirm: "You are important. You are deeply loved." },

  { type: "spatial", title: "Shape Fit Puzzle", crystalName: "Spatial Crystal", affirm: "You can solve problems from different angles." },

  { type: "maze1", title: "Strategy Maze", crystalName: "Strategy Crystal", affirm: "You planned ahead — great thinking!" },

  { type: "surprise", title: "A Special Surprise! 🎁", crystalName: "Surprise Crystal", affirm: "Every single day with you is a gift. 💖" },
  { type: "mosaic", title: "Sticker Mosaic", crystalName: "Balance Crystal", affirm: "You create beauty with smart choices." },
  { type: "memory", title: "Memory Galaxy", crystalName: "Focus Crystal", affirm: "Your focus is strong." },
  { type: "escape", title: "Mini Escape Room", crystalName: "Solver Crystal", affirm: "Step by step, you solve hard things." },

  { type: "next", title: "What Comes Next?", crystalName: "Reasoning Crystal", affirm: "You think deeply and carefully." },

  { type: "cipher", title: "Secret Codebreaker", crystalName: "Code Crystal", affirm: "You cracked the code — wow!" },

  { type: "amazon_gift", title: "Odd One Out!", crystalName: "Planner Crystal", affirm: "You spot what others miss — super smart! 🔍" },
  { type: "pattern2", title: "Creative Pattern Builder", crystalName: "Builder Crystal", affirm: "You build order from ideas." },
  { type: "logicgrid", title: "Logic Grid", crystalName: "Truth Crystal", affirm: "You use clues like a detective." },

  { type: "letter2", title: "A Message for You", crystalName: "Worth Crystal", affirm: "Your worth never changes. Ever." },

  { type: "birthday_finale", title: "Final Mastermind (Reward)", crystalName: "Master Crystal", affirm: "You are brilliant — and you earned this!" },
];

// Gift card rewards keyed by day type
const GIFT_CARDS = {
  mcd_gift: {
    label: "McDonald's Gift Card 🍟",
    note: "Ask your mom to help redeem this 💖",
  },
  amazon_gift: {
    label: "Amazon Gift Card 🎁",
    note: "Ask your mom to help redeem this 💖",
  },
  surprise: {
    label: "Surprise Gift 🎁",
    isSurprise: true,
  },
  birthday_finale: {
    label: "Final Birthday Surprise 🌟",
    isFinale: true,
  },
};

// ---------- State ----------
const LS_KEY = "crystalQuestState_v1";

function defaultState() {
  return {
    opened: {},      // day -> true
    crystals: {},    // day -> true
    soundOn: true,
    // Track rewards claimed (so code reveal requires re-click)
    rewards: {},     // type -> true
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  } catch {
    return defaultState();
  }
}
function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

let state = loadState();
let currentDay = null;
let currentGame = null;

// ---------- DOM ----------
const homeEl = document.getElementById("home");
const stageEl = document.getElementById("stage");
const vaultEl = document.getElementById("vault");

const doorGrid = document.getElementById("doorGrid");
const vaultGrid = document.getElementById("vaultGrid");

const progressPill = document.getElementById("progressPill");
const todayLabel = document.getElementById("todayLabel");
const subtitle = document.getElementById("subtitle");

const soundBtn = document.getElementById("soundBtn");
const soundIcon = document.getElementById("soundIcon");

const vaultBtn = document.getElementById("vaultBtn");
const resetBtn = document.getElementById("resetBtn");

const backBtn = document.getElementById("backBtn");
const vaultBackBtn = document.getElementById("vaultBackBtn");
const stageTitle = document.getElementById("stageTitle");
const stageBody = document.getElementById("stageBody");
const hintText = document.getElementById("hintText");
const restartBtn = document.getElementById("restartBtn");
const claimBtn = document.getElementById("claimBtn");

const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const modalActions = document.getElementById("modalActions");
const modalOkBtn = document.getElementById("modalOkBtn");
const modalBackdrop = document.getElementById("modalBackdrop");

// ---------- Shared AudioContext (one instance, reused to avoid Chrome crash) ----------
let _sharedAudioCtx = null;
function getAudioCtx() {
  if (!_sharedAudioCtx || _sharedAudioCtx.state === "closed") {
    _sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (_sharedAudioCtx.state === "suspended") _sharedAudioCtx.resume();
  return _sharedAudioCtx;
}

// ---------- Helpers ----------
function playChime() {
  if (!state.soundOn) return;
  const ctx = getAudioCtx();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.value = 880;
  g.gain.value = 0.06;
  o.connect(g).connect(ctx.destination);
  o.start();
  setTimeout(() => { o.frequency.value = 1320; }, 110);
  setTimeout(() => { o.stop(); }, 220);
}

function showModal(title, html, actions = null) {
  modalTitle.textContent = title;
  modalBody.innerHTML = html;
  // Actions: if provided, render custom buttons; else OK button
  modalActions.innerHTML = "";
  if (actions && actions.length) {
    actions.forEach(a => {
      const b = document.createElement("button");
      b.className = "btn " + (a.primary ? "btn--primary" : "btn--secondary");
      b.textContent = a.label;
      b.addEventListener("click", () => { a.onClick?.(); hideModal(); });
      modalActions.appendChild(b);
    });
  } else {
    const b = document.createElement("button");
    b.className = "btn btn--primary";
    b.textContent = "OK";
    b.addEventListener("click", hideModal);
    modalActions.appendChild(b);
  }
  modal.classList.remove("hidden");
}

function hideModal() {
  modal.classList.add("hidden");
}

function setView(view) {
  homeEl.classList.toggle("hidden", view !== "home");
  stageEl.classList.toggle("hidden", view !== "stage");
  vaultEl.classList.toggle("hidden", view !== "vault");
}

function formatTodayLabel() {
  const { y, m, d } = getPTDateParts();
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `Today (PT): ${y}-${mm}-${dd}`;
}

function questDayNumber() {
  const { y, m, d } = getPTDateParts();
  if (y !== QUEST.year || m !== QUEST.month) return null;
  if (d < QUEST.startDay || d > QUEST.endDay) return null;
  return d;
}

function isUnlocked(dayNum) {
  if (PREVIEW_MODE) return true;
  // Doors unlock based on PT date: all days <= today in March of quest year
  const today = questDayNumber();
  if (today === null) return false;
  return dayNum <= today;
}

function crystalsCount() {
  return Object.keys(state.crystals).length;
}

function updateTop() {
  progressPill.textContent = `✨ ${crystalsCount()}/${QUEST.endDay}`;
  todayLabel.textContent = formatTodayLabel();
  subtitle.textContent = PREVIEW_MODE ? `Preview mode ON — all doors unlocked 🧪` : `Next door opens at midnight PT • March ${QUEST.startDay}–${QUEST.endDay}, ${QUEST.year}`;
  soundIcon.textContent = state.soundOn ? "🔊" : "🔇";
}

// ---------- Render Home ----------
function renderDoors() {
  doorGrid.innerHTML = "";
  const today = questDayNumber();

  // === Doors 1–16: Nintendo collage image + transparent click overlays ===
  const imgWrap = document.createElement("div");
  imgWrap.className = "nintendo-doors-wrap";

  const img = document.createElement("img");
  img.src = "./16doors.png?v=20260223a";
  img.alt = "Nintendo Doors 1–16";
  img.className = "nintendo-doors-img";
  imgWrap.appendChild(img);

  const overlay = document.createElement("div");
  overlay.className = "nintendo-doors-overlay";
  imgWrap.appendChild(overlay);

  for (let i = 1; i <= 16; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("aria-label", `Door ${i}`);
    btn.className = "door-zone";

    const badge = document.createElement("div");
    badge.className = "door__badge";
    btn.appendChild(badge);

    const unlocked = isUnlocked(i);
    const opened = !!state.opened[i];

    if (!unlocked) {
      btn.classList.add("door-zone--locked");
      badge.textContent = "🔒";
      btn.disabled = true;
    } else {
      btn.disabled = false;
      badge.textContent = opened ? "✅" : "✨";
      if (opened) btn.classList.add("door-zone--opened");
      if (today === i) btn.classList.add("door-zone--today");
      btn.addEventListener("click", () => openDay(i));
    }

    overlay.appendChild(btn);
  }

  doorGrid.appendChild(imgWrap);

  // === Door 17 (Finale) — image-based, same pattern as doors 1–16 ===
  const wrap17 = document.createElement("div");
  wrap17.className = "door17-wrap";
  wrap17.style.gridColumn = "2 / 4";

  const img17 = document.createElement("img");
  img17.src = "./door17.png?v=20260223c";
  img17.alt = "Door 17";
  img17.className = "door17-img";
  wrap17.appendChild(img17);

  const btn17 = document.createElement("button");
  btn17.type = "button";
  btn17.setAttribute("aria-label", "Door 17");
  btn17.className = "door-zone door17-zone";

  const badge17 = document.createElement("div");
  badge17.className = "door__badge";
  btn17.appendChild(badge17);

  const unlocked17 = isUnlocked(17);
  const opened17 = !!state.opened[17];

  if (!unlocked17) {
    btn17.classList.add("door-zone--locked");
    badge17.textContent = "🔒";
    btn17.disabled = true;
  } else {
    btn17.disabled = false;
    badge17.textContent = opened17 ? "✅" : "✨";
    if (opened17) btn17.classList.add("door-zone--opened");
    if (today === 17) btn17.classList.add("door-zone--today");
    btn17.addEventListener("click", () => openDay(17));
  }

  wrap17.appendChild(btn17);
  doorGrid.appendChild(wrap17);
}

// ---------- Vault ----------
function renderVault() {
  vaultGrid.innerHTML = "";
  for (let i = 1; i <= QUEST.endDay; i++) {
    const b = document.createElement("button");
    b.className = "vaultCrystal";
    b.type = "button";

    const got = !!state.crystals[i];
    if (!got) b.classList.add("vaultCrystal--empty");
    b.textContent = got ? "💎" : "◇";

    b.addEventListener("click", () => {
      if (!got) return;
      const dayDef = DAYS[i - 1];
      showModal(dayDef.crystalName, `<div>${dayDef.affirm}</div><div class="small" style="margin-top:8px">Unlocked on Day ${i}: ${dayDef.title}</div>`);
    });

    vaultGrid.appendChild(b);
  }
}

// ---------- Open Day ----------
function openDay(dayNum) {
  currentDay = dayNum;
  state.opened[dayNum] = true;
  saveState();
  updateTop();
  renderDoors();

  const def = DAYS[dayNum - 1];
  stageTitle.textContent = `Day ${dayNum} • ${def.title}`;
  claimBtn.disabled = true;
  hintText.textContent = "Tip: take your time — you’ve got this.";
  stageBody.innerHTML = "";
  setView("stage");

  // Birthday countdown strip (Day 17 = birthday, so D-(17-dayNum))
  (function() {
    const chip = document.getElementById("bdCountdown");
    if (!chip) return;
    const daysLeft = 17 - dayNum;
    if (daysLeft > 0) {
      chip.innerHTML = `<span class="bd-countdown-d">D-${daysLeft}</span>&nbsp;until Ariana’s birthday 🎂`;
    } else {
      chip.innerHTML = "";
    }
  })();

  // Mount activity
  currentGame = buildActivity(def);
  currentGame.mount(stageBody);

  // Replay: crystal already earned — pre-enable so she can claim again without replaying
  if (state.crystals[dayNum]) {
    claimBtn.disabled = false;
    hintText.textContent = "You already earned this crystal — you can claim again (just for fun) 🏆";
  }
}

// ---------- Claim ----------
function claimCrystal() {
  const def = DAYS[currentDay - 1];

  state.crystals[currentDay] = true;
  saveState();
  updateTop();
  pillPopAnim();
  triggerConfetti();

  // 🎂 Special birthday celebration on Day 17!
  if (currentDay === 17) {
    showBirthdayCelebration(def);
    return;
  }

  playChime();

  // Reward flow for gift-card / surprise days
  const gift = GIFT_CARDS[def.type];
  if (gift) {
    const rewardBody = gift.isSurprise ? `
      <svg viewBox="0 0 200 155" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:230px;display:block;margin:6px auto 4px;">
        <defs><linearGradient id="mBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6ab4f0"/><stop offset="100%" stop-color="#b8e0f8"/></linearGradient></defs>
        <rect width="200" height="155" fill="url(#mBg)" rx="16"/>
        <rect x="0" y="133" width="200" height="22" fill="#5ab552"/><rect x="0" y="141" width="200" height="14" fill="#3d8b40"/>
        <ellipse cx="20" cy="133" rx="12" ry="4" fill="#6dc95c"/><ellipse cx="60" cy="133" rx="10" ry="3" fill="#6dc95c"/><ellipse cx="140" cy="133" rx="10" ry="3" fill="#6dc95c"/><ellipse cx="182" cy="133" rx="12" ry="4" fill="#6dc95c"/>
        <rect x="14" y="55" width="24" height="24" fill="#e8a000" rx="3"/><rect x="14" y="55" width="24" height="24" fill="none" stroke="#c47800" stroke-width="1.5" rx="3"/>
        <text x="26" y="72" font-size="13" fill="#fff" text-anchor="middle" font-weight="900" font-family="Arial">?</text>
        <circle cx="170" cy="63" r="11" fill="#ffd700"/><circle cx="170" cy="63" r="8" fill="#e6a800"/><circle cx="170" cy="63" r="5" fill="#ffcc00"/>
        <text x="6" y="40" font-size="16" opacity=".9">⭐</text><text x="166" y="42" font-size="15" opacity=".9">🍄</text>
        <rect x="28" y="52" width="22" height="72" rx="10" fill="#e4000f"/><rect x="28" y="52" width="22" height="72" rx="10" fill="none" stroke="#b80010" stroke-width="1.2"/>
        <circle cx="39" cy="67" r="6.5" fill="#c00010"/><circle cx="39" cy="67" r="4.5" fill="#a00010"/>
        <rect x="34" y="81" width="10" height="3" rx="1.5" fill="#b80010"/>
        <rect x="48" y="58" width="3" height="6" rx="1.5" fill="#cc0015"/><rect x="48" y="68" width="3" height="6" rx="1.5" fill="#cc0015"/>
        <rect x="34" y="88" width="10" height="3.5" rx="1.5" fill="#b80010"/><rect x="37.5" y="85" width="3.5" height="9.5" rx="1.5" fill="#b80010"/>
        <rect x="50" y="47" width="100" height="82" fill="#2c2c2c" rx="5"/>
        <rect x="54" y="52" width="92" height="72" fill="#141414" rx="3"/>
        <rect x="57" y="55" width="86" height="66" fill="#5c94fc" rx="2"/>
        <rect x="62" y="60" width="20" height="10" fill="#fff" rx="5" opacity=".9"/><rect x="65" y="57" width="14" height="10" fill="#fff" rx="5" opacity=".9"/>
        <rect x="118" y="63" width="18" height="8" fill="#fff" rx="4" opacity=".9"/><rect x="120" y="61" width="12" height="8" fill="#fff" rx="4" opacity=".9"/>
        <rect x="57" y="107" width="86" height="14" fill="#5ab552"/><rect x="57" y="113" width="86" height="8" fill="#3d8b40"/>
        <rect x="62" y="93" width="12" height="12" fill="#c84c0c" rx="1"/>
        <rect x="76" y="93" width="12" height="12" fill="#e8a000" rx="1"/>
        <text x="82" y="103" font-size="8" fill="#fff" text-anchor="middle" font-weight="bold" font-family="Arial">?</text>
        <rect x="90" y="93" width="12" height="12" fill="#c84c0c" rx="1"/>
        <circle cx="82" cy="80" r="4" fill="#ffd700"/>
        <rect x="117" y="69" width="12" height="5" fill="#e4000f" rx="1"/>
        <rect x="115" y="73" width="16" height="3.5" fill="#e4000f" rx="1"/>
        <rect x="115" y="76" width="4" height="3" fill="#6b3a1f"/>
        <rect x="115" y="76.5" width="16" height="7" fill="#ffb347" rx="1.5"/>
        <rect x="116" y="83" width="14" height="9" fill="#1a3fff" rx="1"/>
        <rect x="113" y="85" width="4" height="7" fill="#e4000f"/><rect x="127" y="85" width="4" height="7" fill="#e4000f"/>
        <circle cx="120" cy="85.5" r="1.5" fill="#fff8"/><circle cx="126" cy="85.5" r="1.5" fill="#fff8"/>
        <rect x="115" y="92" width="6" height="9" fill="#1a3fff"/><rect x="125" y="92" width="6" height="9" fill="#1a3fff"/>
        <rect x="113" y="101" width="8" height="6" fill="#5c3010" rx="1"/><rect x="123" y="101" width="8" height="6" fill="#5c3010" rx="1"/>
        <rect x="150" y="52" width="22" height="72" rx="10" fill="#0048c8"/><rect x="150" y="52" width="22" height="72" rx="10" fill="none" stroke="#0030a0" stroke-width="1.2"/>
        <rect x="149" y="58" width="3" height="6" rx="1.5" fill="#0038b0"/><rect x="149" y="68" width="3" height="6" rx="1.5" fill="#0038b0"/>
        <circle cx="161" cy="67" r="4" fill="#0044cc"/><text x="161" y="70" font-size="6" fill="#fff" text-anchor="middle" font-weight="bold">X</text>
        <circle cx="169" cy="75" r="4" fill="#dd0000"/><text x="169" y="78" font-size="6" fill="#fff" text-anchor="middle" font-weight="bold">A</text>
        <circle cx="161" cy="83" r="4" fill="#e8a000"/><text x="161" y="86" font-size="6" fill="#fff" text-anchor="middle" font-weight="bold">B</text>
        <circle cx="153" cy="75" r="4" fill="#00aa44"/><text x="153" y="78" font-size="6" fill="#fff" text-anchor="middle" font-weight="bold">Y</text>
        <rect x="155" y="59" width="10" height="3" rx="1.5" fill="#0030a8"/><rect x="158.5" y="56.5" width="3" height="8" rx="1.5" fill="#0030a8"/>
        <circle cx="161" cy="100" r="6.5" fill="#0030a8"/><circle cx="161" cy="100" r="4.5" fill="#0020a0"/>
        <text x="100" y="148" font-size="7.5" fill="white" text-anchor="middle" font-weight="bold" opacity=".85" letter-spacing=".5">LET'S-A GO! 🍄</text>
      </svg>
      <div style="font-weight:900; font-size:16px; text-align:center; color:#e4000f; margin:2px 0 3px; letter-spacing:.3px;">🍄 Super Star Surprise! ⭐</div>
      <div style="font-weight:800; font-size:13px; text-align:center; line-height:1.7; color:#1a1a60;">
        Wahoo! Something legendary is waiting for you...<br>Ask your sister and baba 🎁
      </div>
    ` : `
      <div><b>🎁 Bonus Reward:</b> ${gift.label}</div>
      <div style="margin-top:10px; background:#fff0fa; border:1.5px solid rgba(192,96,216,.2); border-radius:14px; padding:12px; text-align:center;">
        <div style="font-size:22px">💌</div>
        <div style="font-weight:900; margin-top:4px">Ask your mom to help redeem this!</div>
      </div>
    `;
    showModal("🎉 Achievement Unlocked!", `
      <div><b>${def.crystalName}</b> 💎</div>
      <div style="margin-top:8px">${def.affirm}</div>
      <div class="sep"></div>
      ${rewardBody}
    `, [
      { label: "🏠 Back Home", primary: true, onClick: () => goHome() }
    ]);
    return;
  }

  showModal("✨ Magic Unlocked!", `
    <div class="center" style="gap:10px; margin:8px 0 4px">
      <div class="big">💎</div>
      <div>
        <div style="font-weight:900">${def.crystalName}</div>
        <div class="small" style="margin-top:4px">${def.affirm}</div>
      </div>
    </div>
  `, [
    { label: "🏠 Back Home", primary: true, onClick: () => goHome() },
    { label: "🌟 Treasure Vault", primary: false, onClick: () => openVault() },
  ]);
}


function goHome() {
  setView("home");
  renderDoors();
}

function openVault() {
  renderVault();
  setView("vault");
}

// ---------- Intro Game (Day 1) ----------
function introGame() {
  const steps = [
    { emoji: "🎂", text: "Happy early birthday, Ariana!" },
    { emoji: "🗓️", text: "Every day from March 1st to March 17th, a brand-new door opens just for you." },
    { emoji: "🧩", text: "Behind each door is a fun puzzle or activity. Solve it to earn your reward!" },
    { emoji: "💎", text: "Finish the activity → earn a shiny crystal. There are 17 to collect!" },
    { emoji: "🎁", text: "Some doors hide extra-special surprises and gifts along the way… 👀" },
    { emoji: "🚀", text: "Can you collect all 17 crystals by your birthday on March 17th? Let's find out!" },
  ];

  function mount(root) {
    showIntro(root);
  }

  // ── Phase 1: Intro cards ─────────────────────────────────
  function showIntro(root) {
    root.innerHTML = `
      <div class="gameTitle">Your Birthday Crystal Quest 🔮</div>
      <div class="small" style="text-align:center">Here's how it works — read each card!</div>
      <div class="sep"></div>
      <div id="introSteps" style="display:flex;flex-direction:column;gap:10px"></div>
      <div class="sep"></div>
      <button class="btn btn--primary" id="introBtn" style="width:100%;font-size:16px;display:none">
        I'm ready — show me how! 🎮
      </button>
    `;
    setClaimEnabled(false, "Read all the cards first!");
    const container = document.getElementById("introSteps");
    steps.forEach(({ emoji, text }, i) => {
      const card = document.createElement("div");
      card.style.cssText = "display:flex;align-items:flex-start;gap:12px;background:rgba(255,255,255,.8);border-radius:16px;padding:12px 14px;opacity:0;transform:translateY(10px);transition:opacity .35s ease,transform .35s ease";
      card.innerHTML = `<span style="font-size:28px;line-height:1;flex-shrink:0">${emoji}</span><span style="font-size:14px;font-weight:700;line-height:1.5;color:#3a1060">${text}</span>`;
      container.appendChild(card);
      setTimeout(() => {
        card.style.opacity = "1"; card.style.transform = "translateY(0)";
        if (i === steps.length - 1) setTimeout(() => { playChime(); const b = document.getElementById("introBtn"); if (b) b.style.display = ""; }, 400);
      }, 300 + i * 420);
    });
    document.getElementById("introBtn").addEventListener("click", () => showP1(root));
  }

  // ── Shared: practice frame renderer ─────────────────────
  function practiceFrame(root, num, title, hint) {
    root.innerHTML = `
      <div class="gameTitle">${title}</div>
      <div style="text-align:center;font-weight:900;font-size:12px;color:var(--accent);letter-spacing:.5px;margin-bottom:10px">PRACTICE ${num} / 3</div>
      <div style="background:rgba(106,76,147,.1);border-radius:16px;padding:11px 14px;margin-bottom:14px;display:flex;gap:10px;align-items:center">
        <span style="font-size:22px;flex-shrink:0">1️⃣</span>
        <span style="font-weight:700;font-size:14px;color:#3a1060;line-height:1.45">${hint}</span>
      </div>
      <div id="practiceBody"></div>
      <div class="small" style="text-align:center;min-height:20px;margin-top:10px" id="practiceMsg"></div>
    `;
    setClaimEnabled(false, "Solve the puzzle to keep going! 💎");
    return document.getElementById("practiceBody");
  }

  function wrongTap(b, msg, text) {
    b.style.transition = "transform .08s"; b.style.transform = "scale(.88)";
    setTimeout(() => { b.style.transform = "scale(1)"; }, 160);
    if (msg) { msg.textContent = text; setTimeout(() => { if (msg) msg.textContent = ""; }, 1100); }
  }

  // ── Practice 1: Find the crystal 💎 ─────────────────────
  function showP1(root) {
    const body = practiceFrame(root, 1, "Practice 1 — Find It! 🔍", "Tap the crystal! Which one is the 💎?");
    const choices = shuffle(["💎", "🌸", "⭐", "🎵"]);
    const grid = document.createElement("div");
    grid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:260px;margin:0 auto";
    choices.forEach(item => {
      const b = document.createElement("button");
      b.className = "chip";
      b.style.cssText = "font-size:42px;padding:14px;border-radius:20px;width:100%;aspect-ratio:1/1;display:flex;align-items:center;justify-content:center";
      b.textContent = item;
      b.onclick = () => {
        const msg = document.getElementById("practiceMsg");
        if (item === "💎") {
          playChime();
          b.style.transform = "scale(1.25)"; b.style.boxShadow = "0 0 0 4px #a855f7";
          grid.querySelectorAll("button").forEach(x => x.disabled = true);
          if (msg) msg.textContent = "✅ You found it!";
          setTimeout(() => showP2(root), 900);
        } else { wrongTap(b, msg, "Not that one — try again! 🙂"); }
      };
      grid.appendChild(b);
    });
    body.appendChild(grid);
  }

  // ── Practice 2: Count & Pick ⭐ ──────────────────────────
  function showP2(root) {
    const TARGET = "⭐", FILLER = "🌸", TOTAL = 9;
    const count = 3 + Math.floor(Math.random() * 4); // 3–6
    const items = shuffle([...Array(count).fill(TARGET), ...Array(TOTAL - count).fill(FILLER)]);
    const choices = shuffle([count, count > 1 ? count - 1 : count + 2, count < TOTAL ? count + 1 : count - 2]);

    const body = practiceFrame(root, 2, "Practice 2 — Count It! 🔢", "How many ⭐ do you see? Count them all, then tap the right number!");

    const emojiGrid = document.createElement("div");
    emojiGrid.style.cssText = "display:grid;grid-template-columns:repeat(3,1fr);gap:6px;max-width:210px;margin:0 auto 16px";
    items.forEach(em => {
      const s = document.createElement("span");
      s.style.cssText = "font-size:30px;text-align:center;line-height:1.3";
      s.textContent = em;
      emojiGrid.appendChild(s);
    });
    body.appendChild(emojiGrid);

    const choiceRow = document.createElement("div");
    choiceRow.style.cssText = "display:flex;gap:14px;justify-content:center";
    choices.forEach(n => {
      const b = document.createElement("button");
      b.className = "chip";
      b.style.cssText = "font-size:24px;font-weight:900;padding:12px 22px";
      b.textContent = n;
      b.onclick = () => {
        const msg = document.getElementById("practiceMsg");
        if (n === count) {
          playChime();
          b.style.transform = "scale(1.2)"; b.style.boxShadow = "0 0 0 4px #a855f7";
          choiceRow.querySelectorAll("button").forEach(x => x.disabled = true);
          if (msg) msg.textContent = `✅ Yes! There are ${count}!`;
          setTimeout(() => showP3(root), 900);
        } else { wrongTap(b, msg, "Count again — you've got this! 🙂"); }
      };
      choiceRow.appendChild(b);
    });
    body.appendChild(choiceRow);
  }

  // ── Practice 3: Tap 1 → 5 in order ─────────────────────
  function showP3(root) {
    const body = practiceFrame(root, 3, "Practice 3 — Tap in Order! 🔢", "Tap the numbers in order from 1 to 5!");
    let next = 1;

    const numGrid = document.createElement("div");
    numGrid.style.cssText = "display:flex;gap:14px;flex-wrap:wrap;justify-content:center;max-width:280px;margin:0 auto 6px";
    shuffle([1, 2, 3, 4, 5]).forEach(n => {
      const b = document.createElement("button");
      b.className = "chip";
      b.style.cssText = "font-size:26px;font-weight:900;width:58px;height:58px;display:flex;align-items:center;justify-content:center;border-radius:50%;padding:0";
      b.textContent = n;
      b.onclick = () => {
        const msg = document.getElementById("practiceMsg");
        if (n === next) {
          playChime();
          b.style.background = "linear-gradient(135deg,#a855f7,#7c3aed)";
          b.style.color = "#fff"; b.disabled = true;
          next++;
          if (next > 5) {
            if (msg) msg.textContent = "✅ Perfect order!";
            setTimeout(() => {
              root.insertAdjacentHTML("beforeend", `
                <div style="background:rgba(106,76,147,.1);border-radius:16px;padding:11px 14px;margin-top:14px">
                  <div style="display:flex;gap:10px;align-items:center;margin-bottom:6px">
                    <span style="font-size:22px;flex-shrink:0">2️⃣</span>
                    <span style="font-weight:700;font-size:14px;color:#3a1060;line-height:1.45">Amazing! Now tap the purple <b>Claim Crystal</b> button below to earn your first 💎!</span>
                  </div>
                  <div style="text-align:center;font-size:24px">👇</div>
                </div>
              `);
              setClaimEnabled(true, "👆 Tap here to claim your Quest Crystal! 💎");
            }, 700);
          } else {
            if (msg) msg.textContent = `${next - 1}… now tap ${next}!`;
          }
        } else {
          const msg = document.getElementById("practiceMsg");
          wrongTap(b, msg, `Tap ${next} first! 🙂`);
        }
      };
      numGrid.appendChild(b);
    });
    body.appendChild(numGrid);
  }

  function reset(root) { mount(root); }
  return { mount, reset, isComplete: () => claimBtn.disabled === false };
}

// ---------- Activities (Simple implementations + placeholders) ----------
function buildActivity(def) {
  switch (def.type) {
    case "intro":   return introGame();
    case "pattern": return patternGame({ rounds: 7, title: "Pattern Architect" });
    case "pattern2": return patternGame({ rounds: 9, title: "Pattern Architect" });

    case "spatial": return spatialFitGame();
    case "logicgrid": return logicGridGame();
    case "logicgrid2": return logicGrid2Game();
    case "starparty_duo": return starPartyDuoGame();
    case "next": return whatNextGame();

    case "memory": return memoryGame();
    case "dressup": return dressUpGame();
    case "math": return mathQuestGame();

    case "pet": return petSalonGame();
    case "mosaic": return stickerMosaicGame();

    case "escape": return miniEscapeRoom();

    case "mcd_gift": return mathQuestGame();
    case "maze1": return mazeMovesGame({ targetMoves: 12, size: 5 });
    case "gift_mcd": return mazeMovesGame({ targetMoves: 12, size: 5 }); // legacy
    case "surprise": return petSalonGame();
    case "amazon_gift": return finaleMastermindGame();
    case "maze2": return mazeMovesGame({ targetMoves: 14, size: 6 });
    case "gift_movies": return cipherGame();
    case "cipher": return cipherGame();

    case "birthday_finale": return birthdayFinaleGame();
    case "gift_amazon_finale": return birthdayFinaleGame(); // legacy

    case "letter1": return letterGame({
      title: "A Message for You",
      lines: [
        "You are important.",
        "You are deeply loved.",
        "I’m proud of how you keep trying."
      ]
    });
    case "letter2": return letterGame({
      title: "A Message for You",
      photo: "ariana-ilu2.png",
      lines: [
        "Your worth never changes. Ever.",
        "You are important just the way you are.",
        "You have so many people who love you — always.",
        "That will never ever change.",
        "Always remember that 💜"
      ]
    });
    default: return placeholderGame(def.title);
  }
}

function setClaimEnabled(ok, tip = null) {
  claimBtn.disabled = !ok;
  if (tip) hintText.textContent = tip;
}

// ---- Pattern Game ----
function patternGame({ rounds = 6, hard = true, title = "Pattern Architect" } = {}) {
  let round = 1;

  const symbols = ["🦄","🌈","⭐","💖","🍭","🎀","☁️","🧁"];
  const nums = [1,2,3,4,5,6,7,8,9];

  // ── Hardcoded pattern pools by difficulty ──────────────────
  const EASY = [
    { seq:['🦄','🌈','🦄','🌈','🦄','🌈','🦄'],              answer:'🌈', prompt:'It goes back and forth!' },
    { seq:['⭐','💖','⭐','💖','⭐','💖','⭐'],               answer:'💖', prompt:'Back and forth!' },
    { seq:['🎀','🦄','🌈','🎀','🦄','🌈','🎀'],              answer:'🦄', prompt:'It repeats every 3!' },
    { seq:['🍭','🍭','🌈','🍭','🍭','🌈','🍭','🍭'],         answer:'🌈', prompt:'Two, then one different!' },
    { seq:['1','2','3','4','5','6'],                          answer:'7',  prompt:'Count up!' },
    { seq:['2','4','6','8','10'],                             answer:'12', prompt:'Count by 2s!' },
    { seq:['🧁','🎀','🧁','🎀','🧁','🎀'],                   answer:'🧁', prompt:'Back and forth!' },
    { seq:['💖','💖','🦄','💖','💖','🦄','💖','💖'],         answer:'🦄', prompt:'Two, then one different!' },
    { seq:['🌈','🌈','🌈','⭐','🌈','🌈','🌈','⭐','🌈','🌈','🌈'], answer:'⭐', prompt:'Three, then one different!' },
  ];
  const MEDIUM = [
    { seq:['🦄','🦄','🌈','🌈','🦄','🦄','🌈','🌈','🦄','🦄'], answer:'🌈', prompt:'Two of each!' },
    { seq:['🌈','🦄','🦄','🌈','🌈','🦄','🦄','🌈'],          answer:'🌈', prompt:'ABBA!' },
    { seq:['1','3','5','7','9','11'],                          answer:'13', prompt:'Count by 2s!' },
    { seq:['🍭','🎀','⭐','🍭','🎀','⭐','🍭','🎀'],          answer:'⭐', prompt:'Repeats every 3!' },
    { seq:['🦄','🌈','🦄','🦄','🌈','🦄','🦄','🦄'],         answer:'🌈', prompt:'One more unicorn each time!' },
    { seq:['5','10','15','20','25'],                           answer:'30', prompt:'Count by 5s!' },
    { seq:['💖','⭐','⭐','💖','⭐','⭐','💖'],                answer:'⭐', prompt:'One, then two!' },
    { seq:['10','9','8','7','6','5'],                          answer:'4',  prompt:'Count down!' },
    { seq:['🎀','🎀','🧁','🎀','🎀','🧁','🎀','🎀'],         answer:'🧁', prompt:'Two, then one!' },
  ];
  const HARD = [
    { seq:['1','2','4','7','11','16'],                          answer:'22', prompt:'The step grows by 1 each time: +1, +2, +3...' },
    { seq:['🦄','🌈','⭐','💖','🦄','🌈','⭐','💖','🦄'],     answer:'🌈', prompt:'It repeats every 4!' },
    { seq:['🦄','🌈','🌈','🧁','🧁','🧁','🦄','🌈','🌈'],    answer:'🧁', prompt:'Groups of 1, then 2, then 3!' },
    { seq:['1','1','2','3','5','8','13'],                       answer:'21', prompt:'Add the two numbers before it!' },
    { seq:['2','4','8','16','32'],                              answer:'64', prompt:'Each number doubles!' },
    { seq:['64','32','16','8','4'],                             answer:'2',  prompt:'Each number is half of the one before!' },
    { seq:['1','3','7','15','31'],                              answer:'63', prompt:'Double it, then add 1!' },
  ];

  // Build session: 1 easy, 1 medium, rest hard
  const easyN = 1;
  const medN  = 1;
  const hardN = rounds - 2;
  const sessionPatterns = [
    ...shuffle([...EASY]).slice(0, easyN),
    ...shuffle([...MEDIUM]).slice(0, medN),
    ...shuffle([...HARD]).slice(0, hardN),
  ];

  let current = null;

  function newRound() {
    current = sessionPatterns[round - 1];
  }

  function mount(root) {
    round = 1;
    newRound();
    root.innerHTML = `
      <div class="gameTitle" id="pgTitle">${title}</div>
      <div class="small">Round <b id="r">1</b> / ${rounds}</div>
      <div class="sep"></div>
      <div class="big center" id="seq" style="padding:10px 0; gap:10px; flex-wrap:wrap"></div>
      <div class="small">What comes next?</div>
      <div class="row" id="opts" style="margin-top:8px"></div>
      <div class="sep"></div>
      <div class="small" id="msg"></div>
      <button class="btn btn--ghost" id="hintBtn" style="width:100%; margin-top:10px">Hint</button>
    `;
    render();
    setClaimEnabled(false, "Solve all rounds to claim your crystal 💎");
    document.getElementById("hintBtn").addEventListener("click", ()=>{
      setMsg("Hint: " + (current.prompt || "Look for the rule."));
    });
  }

  function render() {
    document.getElementById("r").textContent = String(round);
    const tier = round <= easyN ? '· ⭐ Easy' : round <= easyN + medN ? '· ⭐⭐ Medium' : '· ⭐⭐⭐ Hard';
    document.getElementById("pgTitle").textContent = `Pattern Architect ${tier}`;
    const seqEl = document.getElementById("seq");
    seqEl.innerHTML = "";
    current.seq.forEach(s=>{
      const span=document.createElement("div");
      span.textContent = s;
      seqEl.appendChild(span);
    });

    const optsEl = document.getElementById("opts");
    optsEl.innerHTML = "";

    // Always include items from the sequence as distractors, type-matched (no numbers for emoji patterns)
    const seqDistractors = [...new Set(current.seq)].filter(x => x !== current.answer);
    const isSymbolAnswer = symbols.includes(current.answer);
    let otherPool;
    if (isSymbolAnswer) {
      otherPool = symbols.filter(x => x !== current.answer && !seqDistractors.includes(x));
    } else {
      const ansNum = Number(current.answer);
      const nearby = [-4,-3,-2,-1,1,2,3,4,5,6].map(d => String(ansNum + d)).filter(x => Number(x) > 0 && x !== current.answer);
      otherPool = [...new Set([...nums.map(String), ...nearby])].filter(x => x !== current.answer && !seqDistractors.includes(x));
    }
    const distractors = shuffle([...seqDistractors, ...pickN(otherPool, 4)]).slice(0, 4);
    const options = shuffle(unique([current.answer, ...distractors])).slice(0, 5);

    options.forEach(opt=>{
      const b=document.createElement("button");
      b.className="chip";
      b.textContent = opt;
      b.addEventListener("click", ()=>choose(opt));
      optsEl.appendChild(b);
    });

    setMsg("Take your time. You’ve got this.");
  }

  function choose(opt) {
    if (opt === current.answer) {
      playChime();
      setMsg("Correct! 🎉");
      round++;
      if (round > rounds) {
        setClaimEnabled(true, "Claim your crystal 💎");
        return;
      }
      newRound();
      render();
    } else {
      setMsg("Not quite — look for the rule and try again 🙂");
    }
  }

  function setMsg(t){ document.getElementById("msg").textContent=t; }
  function reset(root){ mount(root); }

  return { mount, reset, isComplete: () => claimBtn.disabled === false };
}

function randInt(min, maxInclusive){
  return Math.floor(Math.random() * (maxInclusive - min + 1)) + min;
}


// ---- Memory Game ----
function memoryGame() {
  const symbols = ["🦄","🌈","⭐","💖","🍭","🎀","☁️","🧁"];
  let seq = [];
  let input = [];
  let level = 1;
  let showing = false;

  function nextLevel() {
    // add 1 symbol
    seq.push(randPick(symbols));
    input = [];
  }

  function mount(root) {
    seq = [];
    level = 1;
    nextLevel();
    root.innerHTML = `
      <div class="gameTitle">Memory Galaxy</div>
      <div class="small">Repeat the sequence. Level <b id="lvl">1</b>/7</div>
      <div class="sep"></div>
      <div class="center big" id="display" style="height:80px">✨</div>
      <div class="row" id="pad" style="margin-top:10px"></div>
      <div class="sep"></div>
      <div class="small" id="msg"></div>
      <button class="btn btn--secondary" id="showBtn" style="width:100%; margin-top:10px">Peek (3s)</button>
    `;
    renderPad();
    setClaimEnabled(false, "Finish Level 7 to claim your crystal 💎");
    document.getElementById("showBtn").addEventListener("click", showSequence);
  }

  function renderPad() {
    const pad = document.getElementById("pad");
    pad.innerHTML = "";
    symbols.forEach(s=>{
      const b=document.createElement("button");
      b.className="chip";
      b.textContent = s;
      b.addEventListener("click", ()=>tap(s));
      pad.appendChild(b);
    });
  }

  async function showSequence() {
    if (showing) return;
    showing = true;
    const display = document.getElementById("display");
    // Show whole sequence briefly (hard mode)
    display.textContent = seq.join(" ");
    setMsg("Peek! 👀");
    await sleep(3000);
    display.textContent = "✨";
    setMsg("Your turn!");
    showing = false;
  }

  function tap(s) {
    if (showing) return;
    input.push(s);
    const idx = input.length - 1;
    if (s !== seq[idx]) {
      setMsg("Oops — try again. Tap “Peek (3s)” 💛");
      input = [];
      return;
    }
    if (input.length === seq.length) {
      playChime();
      if (level >= 7) {
        setMsg("Amazing memory! You did it 🎉");
        setClaimEnabled(true, "Claim your crystal 💎");
      } else {
        level++;
        document.getElementById("lvl").textContent = level;
        setMsg("Nice! Next level…");
        nextLevel();
      }
    } else {
      setMsg(`Good! ${input.length}/${seq.length}`);
    }
  }

  function setMsg(t){ document.getElementById("msg").textContent = t; }
  function reset(root){ mount(root); }

  return { mount, reset, isComplete: () => claimBtn.disabled === false };
}

// ---- Dress Up ----
function dressUpGame() {
  const themes = [
    { name:"Royal Explorer", must:["🧢 Hat","🧥 Jacket","🥾 Boots"] },
    { name:"Starlight Party", must:["👗 Dress","✨ Sparkle","👠 Shoes"] },
    { name:"Rainbow Picnic", must:["👚 Top","🩳 Shorts","🎀 Bow"] },
  ];

  const items = {
    "Hair": ["💇 Hair A","💇‍♀️ Hair B","💇‍♀️ Hair C"],
    "Outfit": ["👗 Dress","🧥 Jacket","👚 Top","🧦 Cozy Set"],
    "Shoes": ["👟 Sneakers","🥾 Boots","👠 Shoes"],
    "Extras": ["🎀 Bow","✨ Sparkle","🧢 Hat","👜 Bag"]
  };

  let theme = null;
  let chosen = new Set();

  function mount(root) {
    theme = randPick(themes);
    chosen = new Set();
    root.innerHTML = `
      <div class="gameTitle">Unicorn Dress-Up</div>
      <div class="small">Theme: <b>${theme.name}</b> — choose the 3 matching items.</div>
      <div class="sep"></div>
      <div class="center" style="gap:10px">
        <div class="big">🦄</div>
        <div>
          <div style="font-weight:900">Your Unicorn</div>
          <div class="small" id="chosenLine">Chosen: none</div>
        </div>
      </div>
      <div class="sep"></div>
      <div id="tabs" class="row"></div>
      <div id="tray" class="row" style="margin-top:10px"></div>
      <div class="sep"></div>
      <div class="small" id="msg"></div>
      <button class="btn btn--secondary" id="doneBtn" style="width:100%; margin-top:10px" disabled>Done</button>
    `;
    renderTabs(root);
    renderTray("Outfit");
    setMsg("Pick items that match the theme.");
    setClaimEnabled(false, "Match the theme to claim your crystal 💎");

    document.getElementById("doneBtn").addEventListener("click", () => {
      // require exactly theme.must
      const ok = theme.must.every(x => chosen.has(x)) && chosen.size === 3;
      if (ok) {
        playChime();
        setMsg("Perfect theme match! 🎉");
        setClaimEnabled(true, "Claim your crystal 💎");
      } else {
        setMsg("Almost! Try to match the theme items exactly.");
      }
    });
  }

  function renderTabs() {
    const tabs = document.getElementById("tabs");
    tabs.innerHTML = "";
    Object.keys(items).forEach(cat=>{
      const b=document.createElement("button");
      b.className="chip";
      b.textContent=cat;
      b.addEventListener("click", ()=>renderTray(cat));
      tabs.appendChild(b);
    });
  }

  function renderTray(cat) {
    const tray = document.getElementById("tray");
    tray.innerHTML = "";
    items[cat].forEach(item=>{
      const b=document.createElement("button");
      b.className="chip";
      const selected = chosen.has(item);
      b.textContent = selected ? `✅ ${item}` : item;
      b.addEventListener("click", ()=>toggle(item));
      tray.appendChild(b);
    });
  }

  function toggle(item) {
    if (chosen.has(item)) chosen.delete(item);
    else {
      if (chosen.size >= 3) { setMsg("You can only choose 3 items."); return; }
      chosen.add(item);
    }
    const chosenLine = document.getElementById("chosenLine");
    chosenLine.textContent = chosen.size ? `Chosen: ${Array.from(chosen).join(", ")}` : "Chosen: none";
    document.getElementById("doneBtn").disabled = chosen.size !== 3;
    setMsg("When you’re ready, tap Done.");

    // re-render current tray to show checkmarks
    // (simple: rerender Outfit; good enough)
    // In a full app we’d track active tab.
    renderTray("Outfit");
  }

  function setMsg(t){ document.getElementById("msg").textContent = t; }
  function reset(root){ mount(root); }

  return { mount, reset, isComplete: () => claimBtn.disabled === false };
}

// ---- Music Maker (simple) ----
function musicMaker() {
  let steps = Array(8).fill(false);

  function mount(root) {
    steps = Array(8).fill(false);
    root.innerHTML = `
      <div class="gameTitle">Make a Mini Song</div>
      <div class="small">Tap squares to turn notes on/off. Then press Play 🎵</div>
      <div class="sep"></div>
      <div id="grid" style="display:grid; grid-template-columns:repeat(8,1fr); gap:8px;"></div>
      <div class="sep"></div>
      <div class="row" style="justify-content:space-between">
        <button class="btn btn--secondary" id="playBtn" style="flex:1">Play</button>
        <button class="btn btn--ghost" id="saveBtn" style="flex:1">Save</button>
      </div>
      <div class="small" id="msg" style="margin-top:10px"></div>
    `;
    render();
    setClaimEnabled(false, "Create a song you like, then Save to claim 💎");
    document.getElementById("playBtn").addEventListener("click", play);
    document.getElementById("saveBtn").addEventListener("click", save);
  }

  function render() {
    const g = document.getElementById("grid");
    g.innerHTML = "";
    steps.forEach((on, i)=>{
      const b=document.createElement("button");
      b.className="door"; // reuse style
      b.style.borderRadius = "14px";
      b.style.fontSize = "16px";
      b.textContent = on ? "🎵" : "·";
      b.addEventListener("click", ()=>{ steps[i]=!steps[i]; render(); });
      g.appendChild(b);
    });
  }

  function play() {
    const onIdx = steps.map((v,i)=>v?i:null).filter(v=>v!==null);
    if (!onIdx.length) { setMsg("Turn on a few notes first 🙂"); return; }
    setMsg("Playing… 🎶");
    // simple audio: click tones for ON steps
    const ctx = getAudioCtx();
    let t = ctx.currentTime;
    onIdx.forEach(i=>{
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type="triangle";
      o.frequency.value = 440 + i*30;
      g.gain.value = 0.04;
      o.connect(g).connect(ctx.destination);
      o.start(t + i*0.12);
      o.stop(t + i*0.12 + 0.08);
    });
  }

  function save() {
    const onCount = steps.filter(Boolean).length;
    if (onCount < 3) { setMsg("Make it a bit richer — try 3+ notes 🙂"); return; }
    playChime();
    setMsg("Saved! That sounded awesome ✨");
    setClaimEnabled(true, "Claim your crystal 💎");
  }

  function setMsg(t){ document.getElementById("msg").textContent = t; }
  function reset(root){ mount(root); }

  return { mount, reset, isComplete: () => claimBtn.disabled === false };
}

// ---- Maze Moves Game ----
function mazeMovesGame({ targetMoves = 12, size = 5 } = {}) {
  // Simple grid maze: 0 empty, 1 wall
  let grid = [];
  let pos = {x:0,y:0};
  let goal = {x:size-1,y:size-1};
  let moves = 0;

  function genMaze() {
    // simple random walls but ensure a path (for demo)
    grid = Array.from({length:size}, ()=>Array.from({length:size}, ()=>0));
    // add some walls
    for (let y=0;y<size;y++){
      for(let x=0;x<size;x++){
        if ((x===0 && y===0) || (x===goal.x && y===goal.y)) continue;
        if (Math.random() < 0.18) grid[y][x]=1;
      }
    }
    // carve a simple diagonal path
    for (let i=0;i<size;i++){
      grid[i][i]=0;
    }
    pos={x:0,y:0};
    moves=0;
  }

  function mount(root) {
    genMaze();
    root.innerHTML = `
      <div class="gameTitle">Strategy Maze</div>
      <div class="small">Reach the crystal in <b>${targetMoves}</b> moves.</div>
      <div class="sep"></div>
      <div id="maze" style="display:grid; grid-template-columns:repeat(${size},1fr); gap:6px;"></div>
      <div class="sep"></div>
      <div class="row" style="justify-content:space-between">
        <button class="chip" id="up">⬆️</button>
        <button class="chip" id="left">⬅️</button>
        <button class="chip" id="down">⬇️</button>
        <button class="chip" id="right">➡️</button>
      </div>
      <div class="small" id="msg" style="margin-top:10px"></div>
    `;
    render();
    setClaimEnabled(false, `Plan ahead — exactly ${targetMoves} moves to win 💎`);
    bind();
    setMsg(`Moves: ${moves}`);
  }

  function bind(){
    document.getElementById("up").onclick = ()=>step(0,-1);
    document.getElementById("down").onclick = ()=>step(0,1);
    document.getElementById("left").onclick = ()=>step(-1,0);
    document.getElementById("right").onclick = ()=>step(1,0);
  }

  function step(dx,dy){
    const nx = pos.x + dx, ny = pos.y + dy;
    if (nx<0||ny<0||nx>=size||ny>=size) return;
    if (grid[ny][nx]===1) { setMsg(`Bump! Wall. Moves: ${moves}`); return; }
    pos={x:nx,y:ny};
    moves++;
    render();
    if (pos.x===goal.x && pos.y===goal.y) {
      if (moves===targetMoves) {
        playChime();
        setMsg(`Perfect! ${moves}/${targetMoves} 🎉`);
        setClaimEnabled(true, "You earned it! Claim your reward 💎");
      } else {
        setMsg(`You reached it in ${moves} moves. Try again for exactly ${targetMoves}.`);
      }
    } else {
      setMsg(`Moves: ${moves}`);
    }
  }

  function render(){
    const maze = document.getElementById("maze");
    maze.innerHTML="";
    for(let y=0;y<size;y++){
      for(let x=0;x<size;x++){
        const cell=document.createElement("div");
        cell.style.aspectRatio="1/1";
        cell.style.borderRadius="12px";
        cell.style.display="flex";
        cell.style.alignItems="center";
        cell.style.justifyContent="center";
        cell.style.fontSize="18px";
        cell.style.background = grid[y][x]===1 ? "rgba(106,76,147,.20)" : "rgba(255,255,255,.9)";
        cell.style.border="1px solid rgba(106,76,147,.12)";
        if (x===goal.x && y===goal.y) cell.textContent="💎";
        if (x===pos.x && y===pos.y) cell.textContent="🦄";
        maze.appendChild(cell);
      }
    }
  }

  function setMsg(t){ document.getElementById("msg").textContent=t; }
  function reset(root){ mount(root); }
  return { mount, reset, isComplete: () => claimBtn.disabled === false };
}

// ---- Cipher Game (reward) ----
function cipherGame(){
  // Stage 1: SMILE anagrams (find 2)
  // Stage 2: UNICORN unscramble (find 1)
  // Stage 3: Emoji alphabet decoder (full sentence)
  let stage = 1;

  const stage1 = {
    label: "Word Builder 1",
    letters: "SMILE",
    need: 1,
    valid: ["SMILE","MILES","SLIME"],
    found: new Set(),
    prompt: "Unscramble ALL the letters to make a word! 😊"
  };

  const stage2 = {
    label: "Word Builder 2",
    letters: "UNICORN",
    need: 1,
    valid: ["UNICORN"],
    found: new Set(),
    prompt: "Unscramble ALL the letters to make a magical word! 🦄"
  };

  const EMOJI_MAP = {
    "🦄":"D",
    "🌈":"O",
    "⭐":"N",
    "💖":"T",
    "🟣":"B",
    "🟥":"E",
    "🔷":"A",
    "🟢":"F",
    "🟡":"R",
    "🟠":"I",
    "🔴":"M",
    "✨":"K",
    "🎀":"S",
    "☁️":"Y",
    "🧁":"U",
    "🌙":"G"
  };

  const TARGET_SENTENCE = "DO NOT BE AFRAID OF MAKING MISTAKES. YOU GOT IT.";

  
  function scrambledLetters(word){
    const arr = word.split("");
    // Fisher–Yates shuffle
    for(let i=arr.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    return arr.join(" ");
  }
function mount(root){
    stage = 1;
    delete stage1._bank;
    delete stage2._bank;
    stage1.found = new Set();
    stage2.found = new Set();
    setClaimEnabled(false, "Finish all decoding stages 💎");
    render(root);
  }

  function render(root){
    if(stage === 1) return renderWordStage(root, stage1, () => { stage = 2; render(root); });
    if(stage === 2) return renderWordStage(root, stage2, () => { stage = 3; render(root); });
    return renderEmojiDecoder(root);
  }

  function renderWordStage(root, cfg, onDone){
    const WORD_LEN = cfg.valid[0].length;
    // Shuffle bank once per stage (persist on cfg so restart re-shuffles)
    if (!cfg._bank) cfg._bank = shuffle(cfg.letters.split(""));
    const bankLetters = cfg._bank;
    let slots = Array(WORD_LEN).fill(null);

    function renderUI() {
      // Available = bank minus what’s placed
      const usedPool = slots.filter(s => s !== null);
      const available = [...bankLetters];
      usedPool.forEach(l => { const i = available.indexOf(l); if (i !== -1) available.splice(i, 1); });

      root.innerHTML = `
        <div class="gameTitle">${cfg.label}</div>
        <div class="small" style="margin-bottom:10px">${cfg.prompt}</div>

        <div class="answer-slots" id="answerSlots">
          ${slots.map((l, i) => `
            <div class="answer-slot ${l ? "answer-slot--filled" : ""}" data-slot="${i}">
              ${l ? `<button class="letter-tile letter-tile--placed" data-action="remove" data-slot="${i}" aria-label="Remove ${l}">${l}</button>` : ""}
            </div>`).join("")}
        </div>

        <div style="text-align:center; margin:6px 0 10px">
          <button class="btn btn--ghost" id="wbClear" style="font-size:12px; padding:5px 14px">✕ Clear</button>
        </div>

        <div class="letter-bank" id="letterBank">
          ${available.length
            ? available.map(l => `<button class="letter-tile" data-action="place" data-letter="${l}" aria-label="${l}">${l}</button>`).join("")
            : `<div class="small" style="color:var(--muted);padding:8px 0">All letters placed!</div>`}
        </div>

        <div class="sep"></div>
        <div id="wbMsg" class="small" style="min-height:18px; text-align:center"></div>
        ${cfg.found.size > 0 ? `
          <div class="row" style="margin-top:8px; justify-content:center">
            ${[...cfg.found].map(w => `<div class="chip" style="font-size:13px">✅ ${w}</div>`).join("")}
          </div>` : ""}
        <button class="btn btn--secondary" style="width:100%; margin-top:14px" id="wbNext" ${cfg.found.size >= cfg.need ? "" : "disabled"}>Next →</button>
      `;

      root.querySelectorAll('[data-action="place"]').forEach(btn => {
        btn.addEventListener("click", () => {
          const firstEmpty = slots.indexOf(null);
          if (firstEmpty === -1) return;
          slots[firstEmpty] = btn.dataset.letter;
          renderUI();
          if (slots.every(s => s !== null)) checkWord();
        });
      });

      root.querySelectorAll('[data-action="remove"]').forEach(btn => {
        btn.addEventListener("click", () => {
          const idx = parseInt(btn.dataset.slot);
          slots[idx] = null;
          const remaining = slots.filter(s => s !== null);
          slots = [...remaining, ...Array(WORD_LEN - remaining.length).fill(null)];
          renderUI();
        });
      });

      const clearBtn = root.querySelector("#wbClear");
      if (clearBtn) clearBtn.addEventListener("click", () => { slots = Array(WORD_LEN).fill(null); renderUI(); });

      const nextBtn = root.querySelector("#wbNext");
      if (nextBtn) nextBtn.addEventListener("click", onDone);
    }

    function checkWord() {
      const word = slots.join("");
      const msgEl = document.getElementById("wbMsg");

      if (!cfg.valid.includes(word)) {
        if (msgEl) msgEl.textContent = "Almost! Try rearranging the letters 🙂";
        const slotsEl = document.getElementById("answerSlots");
        if (slotsEl) slotsEl.classList.add("answer-slots--shake");
        setTimeout(() => { slots = Array(WORD_LEN).fill(null); renderUI(); }, 500);
        return;
      }
      if (cfg.found.has(word)) {
        if (msgEl) msgEl.textContent = "You already found that one 🙂";
        setTimeout(() => { slots = Array(WORD_LEN).fill(null); renderUI(); }, 700);
        return;
      }
      cfg.found.add(word);
      playChime();
      if (msgEl) msgEl.textContent = `✨ ${word}! You got it!`;
      if (cfg.found.size >= cfg.need) {
        setTimeout(onDone, 900);
      } else {
        setTimeout(() => { slots = Array(WORD_LEN).fill(null); renderUI(); }, 900);
      }
    }

    renderUI();
  }

  function renderEmojiDecoder(root){
    root.innerHTML = `
      <div class="gameTitle">Emoji Alphabet Decoder</div>
      <div class="small">Use the map to decode the message.</div>
      <div class="sep"></div>

      <div class="mapBox" id="mapBox"></div>

      <div class="sep"></div>
      <div class="puzzleBox" id="puzzleBox"></div>

      <div class="sep"></div>
      <input id="ans" placeholder="Type the sentence..." style="width:100%; padding:12px; border-radius:14px; border:1px solid rgba(106,76,147,.18); font-size:16px">
      <button class="btn btn--primary" style="width:100%; margin-top:10px" id="check">Check</button>
      <div class="small" id="msg" style="margin-top:10px"></div>
    `;

    const mapBox = document.getElementById("mapBox");
    mapBox.innerHTML = `<div class="small" style="font-weight:900; margin-bottom:8px">Map</div>`;
    const entries = Object.entries(EMOJI_MAP);
    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(4, 1fr)";
    grid.style.gap = "8px";
    entries.forEach(([e,l])=>{
      const cell = document.createElement("div");
      cell.className = "chip";
      cell.style.justifyContent = "center";
      cell.textContent = `${e} = ${l}`;
      grid.appendChild(cell);
    });
    mapBox.appendChild(grid);

    const enc = encodeSentence(TARGET_SENTENCE);
    const puzzleBox = document.getElementById("puzzleBox");
    puzzleBox.innerHTML = "";
    enc.forEach(tok=>{
      const span = document.createElement("span");
      span.className = "tok";
      if(tok === " ") {
        span.classList.add("tokSpace");
        span.innerHTML = "&nbsp;";
      } else {
        span.textContent = tok;
      }
      puzzleBox.appendChild(span);
    });

    const msg = document.getElementById("msg");
    document.getElementById("check").onclick = ()=>{
      const v = (document.getElementById("ans").value || "").trim().toUpperCase().replace(/\s+/g," ");
      const want = TARGET_SENTENCE.toUpperCase();
      if(v === want){
        playChime();
        msg.textContent = "Yes!! 💜 You decoded it perfectly.";
        setClaimEnabled(true, "Claim reward 💎");
      } else {
        msg.textContent = "Not yet — look for spaces and punctuation 🙂";
      }
    };

    msg.textContent = "Tip: Write the letters as you decode each emoji.";
  }

  function encodeSentence(text){
    const rev = {};
    Object.entries(EMOJI_MAP).forEach(([emo,letter])=>{ rev[letter]=emo; });

    const out = [];
    for(const ch of text.toUpperCase()){
      if(ch === " ") { out.push(" "); continue; }
      if(ch === ".") { out.push("·"); continue; }
      const emo = rev[ch];
      out.push(emo || "□");
    }
    return out;
  }

  function reset(root){ mount(root); }
  return { mount, reset, isComplete: () => claimBtn.disabled === false };
}

// ---- Letter Game ----
function letterGame({ title, lines, photo = "ariana-ilu.png" }) {
  let opened = false;

  function mount(root) {
    opened = false;
    root.innerHTML = `
      <div class="gameTitle">${title}</div>
      <div class="small">Tap the envelope to open.</div>
      <div class="sep"></div>
      <div class="center" style="padding:16px 0">
        <button class="door letter-envelope" id="env" aria-label="Open envelope">
          <div class="letter-env-flap">▼</div>
          <div class="letter-env-body">
            <span class="letter-env-emoji">✉️</span>
            <span class="letter-env-hint">A special message…</span>
          </div>
        </button>
      </div>
      <div id="letter" class="hidden letter-card">
        <div class="letter-header">For you 💖</div>
        <div class="sep"></div>
        <div id="letterImg" style="opacity:0; transform:translateY(8px); transition:opacity .5s ease, transform .5s ease;">
          <img src="./${photo}" alt="Ariana" class="letter-photo" />
        </div>
        <div class="sep"></div>
        <div id="lines" class="letter-lines"></div>
      </div>
      <div class="small" id="msg"></div>
    `;
    setClaimEnabled(false, "Open the letter to claim your crystal 💎");
    document.getElementById("env").addEventListener("click", open);
  }

  function open() {
    if (opened) return;
    opened = true;
    playChime();
    document.getElementById("letter").classList.remove("hidden");
    // Photo fades in first
    setTimeout(() => {
      const imgEl = document.getElementById("letterImg");
      if (imgEl) { imgEl.style.opacity = "1"; imgEl.style.transform = "translateY(0)"; }
    }, 80);
    // Then text lines animate in after photo
    const linesEl = document.getElementById("lines");
    linesEl.innerHTML = "";
    lines.forEach((t, i) => {
      const p = document.createElement("div");
      p.textContent = t;
      p.style.opacity = "0";
      p.style.transform = "translateY(6px)";
      p.style.transition = "opacity .25s ease, transform .25s ease";
      linesEl.appendChild(p);
      setTimeout(() => { p.style.opacity="1"; p.style.transform="translateY(0)"; }, 350 + 140*i);
    });
    document.getElementById("msg").textContent = "Keep this in your heart 💛";
    setClaimEnabled(true, "Claim your crystal 💎");
  }

  function reset(root){ mount(root); }
  return { mount, reset, isComplete: () => claimBtn.disabled === false };
}


// ---- Spatial Fit Game ----
function spatialFitGame() {
  // Harder: "Crystal Blueprint" = choose shapes that match BOTH:
  // (1) exact number of shapes
  // (2) point total
  // (3) a constraint (e.g., include/exclude, exactly two pointy, etc.)
  // This is still simple UI, but much more reasoning-heavy.
  const SHAPES = [
    { id:"tri", emoji:"🔺", name:"Triangle", points:2, tags:["pointy"] },
    { id:"sq", emoji:"🟥", name:"Square", points:3, tags:["blocky"] },
    { id:"dia", emoji:"🔷", name:"Diamond", points:4, tags:["shiny","pointy"] },
    { id:"cir", emoji:"🟣", name:"Circle", points:5, tags:["round"] },
    { id:"star", emoji:"⭐", name:"Star", points:6, tags:["sparkle","pointy"] },
    { id:"heart", emoji:"💖", name:"Heart", points:7, tags:["love","round"] },
  ];

  // Each round: pick EXACTLY k pieces; the total points must equal target; plus a rule.
  // Solutions are designed to be unique-ish and kid-solvable with hints.
  const ROUNDS = [
    { name:"Blueprint A", k:4, target:14,
      rule:"Exactly 2 pointy pieces.",
      hint:"Pick one each of 2-pt, 3-pt, 4-pt AND 5-pt pieces — they add up to 14! (2 of those are pointy 😊)" },
    { name:"Blueprint B", k:3, target:15,
      rule:"Must include 1 round piece.",
      hint:"Round pieces are 🟣 or 💖." },
    { name:"Blueprint C", k:4, target:18,
      rule:"Must include a sparkle piece (⭐).",
      hint:"⭐ is 6 points. What makes the rest sum to 12 with 3 pieces?" },
    { name:"Blueprint D", k:3, target:13,
      rule:"No blocky pieces (🟥).",
      hint:"Avoid the 3-point square. Use smaller + larger." },
    { name:"Blueprint E", k:5, target:23,
      rule:"At least 1 shiny piece (🔷).",
      hint:"🔷 is 4 points. Use that and build to 23 with 4 more." },
  ];

  // For each round, allow duplicates (like having two triangles).
  // We'll cap duplicates to 3 per shape to keep it reasonable.
  const DUP_CAP = 3;

  let r = 0;
  let chosen = []; // array of ids

  function mount(root) {
    r = 0;
    chosen = [];
    root.innerHTML = `
      <div class="gameTitle">Crystal Blueprint</div>
      <div class="small">Build the crystal by matching the blueprint rules.</div>
      <div class="sep"></div>

      <div id="blue" style="background:#ffffffdd; border:1px solid rgba(106,76,147,.14); border-radius:18px; padding:12px">
        <div style="font-weight:900" id="blueName"></div>
        <div class="small" id="blueReq" style="margin-top:6px"></div>
        <div class="small" id="blueHint" style="margin-top:6px"></div>
        <div class="sep"></div>
        <div class="small" style="font-weight:900">Your Pieces</div>
        <div class="center" id="slots" style="gap:10px; padding:10px 0; flex-wrap:wrap"></div>
        <div class="small" id="scoreLine"></div>
      </div>

      <div class="sep"></div>
      <div class="row" id="shapeTray"></div>

      <div class="sep"></div>
      <div class="small" id="msg"></div>

      <button class="btn btn--secondary" id="checkBtn" style="width:100%; margin-top:10px" disabled>Check Blueprint</button>
      <button class="btn btn--ghost" id="undoBtn" style="width:100%; margin-top:10px">Undo</button>
      <button class="btn btn--ghost" id="clearBtn" style="width:100%; margin-top:10px">Clear</button>
    `;

    renderRound();
    setClaimEnabled(false, "Finish all 5 blueprints to claim your crystal 💎");

    document.getElementById("checkBtn").addEventListener("click", check);
    document.getElementById("undoBtn").addEventListener("click", undo);
    document.getElementById("clearBtn").addEventListener("click", clearAll);
  }

  function renderRound() {
    chosen = [];
    const round = ROUNDS[r];
    document.getElementById("blueName").textContent = `Round ${r+1}/5: ${round.name}`;
    document.getElementById("blueReq").innerHTML = `
      Pick <b>${round.k}</b> pieces • Total points must be <b>${round.target}</b><br/>
      Rule: <b>${round.rule}</b>
    `;
    document.getElementById("blueHint").textContent = `Hint: ${round.hint}`;
    renderSlots();
    renderTray();
    renderScore();
    setMsg(`Pick exactly ${round.k} pieces.`);
    document.getElementById("checkBtn").disabled = true;
  }

  function renderSlots() {
    const slots = document.getElementById("slots");
    slots.innerHTML = "";
    const round = ROUNDS[r];
    for (let i=0;i<round.k;i++){
      const s=document.createElement("div");
      s.style.width="56px";
      s.style.height="56px";
      s.style.borderRadius="16px";
      s.style.border="2px dashed rgba(106,76,147,.25)";
      s.style.display="flex";
      s.style.alignItems="center";
      s.style.justifyContent="center";
      s.style.fontSize="22px";
      s.textContent = chosen[i] ? shapeById(chosen[i]).emoji : " ";
      slots.appendChild(s);
    }
  }

  function renderTray() {
    const tray = document.getElementById("shapeTray");
    tray.innerHTML = "";
    SHAPES.forEach(sh=>{
      const count = chosen.filter(x=>x===sh.id).length;
      const b=document.createElement("button");
      b.className="chip";
      b.textContent = `${sh.emoji} ${sh.name} (${sh.points})` + (count>0 ? ` x${count}` : "");
      b.addEventListener("click", ()=>pick(sh.id));
      tray.appendChild(b);
    });
  }

  function renderScore() {
    const round = ROUNDS[r];
    const total = chosen.reduce((sum,id)=>sum + shapeById(id).points, 0);
    const left = round.k - chosen.length;
    document.getElementById("scoreLine").innerHTML = `Pieces left: <b>${left}</b> • Points: <b>${total}</b> / ${round.target}`;
  }

  function pick(id) {
    const round = ROUNDS[r];
    if (chosen.length >= round.k) { setMsg("You picked enough pieces — tap Check."); return; }
    const count = chosen.filter(x=>x===id).length;
    if (count >= DUP_CAP) { setMsg("Too many of that piece 🙂 Try another."); return; }

    chosen.push(id);
    playChime();
    renderSlots();
    renderTray();
    renderScore();
    document.getElementById("checkBtn").disabled = chosen.length !== round.k;
  }

  function undo() {
    if (chosen.length === 0) return;
    chosen.pop();
    renderSlots(); renderTray(); renderScore();
    document.getElementById("checkBtn").disabled = true;
  }

  function clearAll() {
    chosen = [];
    renderSlots(); renderTray(); renderScore();
    document.getElementById("checkBtn").disabled = true;
  }

  function check() {
    const round = ROUNDS[r];
    if (chosen.length !== round.k) return;

    const total = chosen.reduce((sum,id)=>sum + shapeById(id).points, 0);
    if (total !== round.target) {
      setMsg("Points don’t match yet — adjust your pieces 🙂");
      return;
    }

    if (!ruleOk(round.rule)) {
      setMsg("The points match, but the RULE doesn’t — re-check the rule 🙂");
      return;
    }

    playChime();
    r++;
    if (r >= ROUNDS.length) {
      setMsg("All blueprints solved! You’re super smart 🎉");
      setClaimEnabled(true, "Claim your crystal 💎");
    } else {
      setMsg("Blueprint solved! Next one…");
      setTimeout(renderRound, 500);
    }
  }

  function ruleOk(rule) {
    const tags = chosen.flatMap(id => shapeById(id).tags);
    const pointyCount = tags.filter(t=>t==="pointy").length;
    const roundCount = tags.filter(t=>t==="round").length;

    if (rule.includes("Exactly 2 pointy")) return pointyCount === 2;
    if (rule.includes("Must include 1 round")) return roundCount >= 1;
    if (rule.includes("sparkle")) return chosen.includes("star");
    if (rule.includes("No blocky")) return !chosen.includes("sq");
    if (rule.includes("shiny")) return chosen.includes("dia");
    return true;
  }

  function shapeById(id) { return SHAPES.find(s=>s.id===id); }
  function setMsg(t){ document.getElementById("msg").textContent=t; }
  function reset(root){ mount(root); }

  return { mount, reset, isComplete: () => claimBtn.disabled === false };
}



// ---- Pet Salon Sequence Game ----
function petSalonGame() {
  const steps = [
    { id:"wash", label:"🫧 Wash" },
    { id:"dry", label:"🧴 Dry" },
    { id:"brush", label:"🪮 Brush" },
    { id:"bow", label:"🎀 Bow" },
    { id:"sparkle", label:"✨ Sparkles" },
  ];

  const rounds = [
    { seq:["wash","dry","brush","bow","sparkle"], name:"Round 1" },
    { seq:["brush","wash","dry","sparkle","bow"], name:"Round 2" },
    { seq:["sparkle","wash","bow","dry","brush"], name:"Round 3" },
  ];
  const PETS = ["🐶","🐱","🐰"];

  let r = 0;
  let idx = 0;
  let pet = "🐶";

  function mount(root) {
    r=0; idx=0; pet = PETS[0];
    root.innerHTML = `
      <div class="gameTitle">Pet Salon Sequence</div>
      <div class="small">Follow the salon steps in order. 3 rounds.</div>
      <div class="sep"></div>
      <div class="center" style="gap:12px; padding:6px 0 10px;">
        <div class="big" id="pet">${pet}</div>
        <div>
          <div style="font-weight:900">Your Pet</div>
          <div class="small" id="status"></div>
        </div>
      </div>
      <div class="sep"></div>
      <div class="small" style="font-weight:800">Memorize:</div>
      <div class="row" id="seqLine" style="margin-top:8px; flex-wrap:nowrap; justify-content:center;"></div>
      <button class="btn btn--secondary" id="peekBtn" style="width:100%; margin-top:10px">👀 Peek (3s)</button>
      <div class="sep"></div>
      <div class="small" style="font-weight:800">Do the steps:</div>
      <div class="row" id="stepBtns" style="margin-top:8px; flex-wrap:nowrap; justify-content:center; gap:6px;"></div>
      <div class="sep"></div>
      <div class="small" id="msg"></div>
    `;

    renderSeq(false);
    renderButtons();
    setClaimEnabled(false, "Finish all 3 rounds to claim your crystal 💎");
    document.getElementById("peekBtn").addEventListener("click", peekOnce);
    // Start hidden by default
    renderSeq(false);
    updateStatus();
    setMsg("Tap Peek (3s) to see the steps, then do them!");
  }

  async function peekOnce() {
    // show for 3 seconds, then hide again
    renderSeq(true);
    setMsg("Peek! 👀");
    await sleep(3000);
    renderSeq(false);
    setMsg("Go! Follow the order.");
  }

  function renderSeq(show) {
    const line = document.getElementById("seqLine");
    line.innerHTML = "";
    const seq = rounds[r].seq;
    seq.forEach((id, i)=>{
      const c=document.createElement("div");
      c.className="chip";
      c.textContent = show ? stepEmoji(id) : (i+1);
      line.appendChild(c);
    });
  }

  function renderButtons() {
    const box = document.getElementById("stepBtns");
    box.innerHTML = "";
    steps.forEach(s=>{
      const b=document.createElement("button");
      b.className="chip";
      b.style.cssText = "padding:7px 10px; font-size:13px; flex-shrink:1;";
      b.textContent = s.label;
      b.addEventListener("click", ()=>tap(s.id));
      box.appendChild(b);
    });
  }

  function tap(id) {
    const seq = rounds[r].seq;
    if (id === seq[idx]) {
      idx++;
      playChime();
      wigglePet();
      if (idx === seq.length) {
        r++;
        if (r >= rounds.length) {
          setMsg("Salon complete! All 3 pets look amazing 🎉");
          setClaimEnabled(true, "Claim your crystal 💎");
        } else {
          pet = PETS[r];
          const petEl = document.getElementById("pet");
          if (petEl) petEl.textContent = pet;
          setMsg(`Round ${r} done! ✅ Next up: ${pet} — memorize again 🐾`);
          idx = 0;
          renderSeq(false);
          updateStatus();
        }
      } else {
        setMsg(`Good! ${idx}/${seq.length}`);
      }
    } else {
      setMsg("Oops — wrong step. Try again from the start 🙂");
      idx = 0;
    }
    updateStatus();
  }

  function updateStatus() {
    const s = document.getElementById("status");
    if (!s) return;
    const roundNum = Math.min(r + 1, rounds.length);
    s.textContent = `Round ${roundNum}/3 ${PETS[Math.min(r, PETS.length-1)]} • Step ${idx}/5`;
  }

  function wigglePet(){
    const el = document.getElementById("pet");
    el.animate([{transform:"rotate(-6deg)"},{transform:"rotate(6deg)"},{transform:"rotate(0deg)"}], {duration:220});
  }

  function stepEmoji(id){
    return ({wash:"🫧",dry:"🧴",brush:"🪮",bow:"🎀",sparkle:"✨"})[id] || "•";
  }

  function setMsg(t){ document.getElementById("msg").textContent=t; }
  function reset(root){ mount(root); }

  return { mount, reset, isComplete: () => claimBtn.disabled === false };
}

// ---- Sticker Mosaic (Symmetry + Balance) ----
function stickerMosaicGame() {
  const size = 5;
  const stickers = ["⭐","💖","🌈","🦄"];
  let board = Array.from({length:size}, ()=>Array(size).fill(""));
  let target = null;
  let round = 1;
  let selectedSticker = "⭐";

  function genTarget() {
    const t = Array.from({length:size}, ()=>Array(size).fill(""));
    for (let y=0;y<size;y++){
      for (let x=0;x<size;x++){
        if (Math.random()<0.4){
          const s = stickers[Math.floor(Math.random()*stickers.length)];
          t[y][x]=s;
          t[size-1-y][size-1-x]=s; // 180° symmetry (harder than mirror)
        }
      }
    }
    return t;
  }

  function mount(root) {
    round=1;
    board = Array.from({length:size}, ()=>Array(size).fill(""));
    target = genTarget();
    root.innerHTML = `
      <div class="gameTitle">Sticker Mosaic</div>
      <div class="small">Copy the pattern below into your mosaic! Round <b id="roundNum">1</b>/3</div>
      <div class="sep"></div>
      <div class="small" style="font-weight:800; margin-bottom:6px">✨ Pattern to copy:</div>
      <div id="targetGrid" style="display:grid; grid-template-columns:repeat(${size},1fr); gap:6px;"></div>
      <div class="sep"></div>
      <div class="small" style="font-weight:800; margin-bottom:6px">🎨 Your mosaic:</div>
      <div id="your" style="display:grid; grid-template-columns:repeat(${size},1fr); gap:6px;"></div>
      <div class="sep"></div>
      <div class="row" id="tray"></div>
      <div class="small" id="msg" style="margin-top:10px"></div>
      <button class="btn btn--secondary" id="checkBtn" style="width:100%; margin-top:10px">Check ✓</button>
    `;
    renderTarget(); renderYour(); renderTray();
    setClaimEnabled(false,"Complete 3 mosaics 💎");
    document.getElementById("checkBtn").onclick=check;
  }

  function renderTarget(){
    const tEl=document.getElementById("targetGrid");
    tEl.innerHTML="";
    for(let y=0;y<size;y++){
      for(let x=0;x<size;x++){
        const c=document.createElement("div");
        c.style.aspectRatio="1/1";
        c.style.borderRadius="12px";
        c.style.background="rgba(106,76,147,.08)";
        c.style.border="1px solid rgba(106,76,147,.18)";
        c.style.display="flex";
        c.style.alignItems="center";
        c.style.justifyContent="center";
        c.style.fontSize="18px";
        c.textContent=target[y][x]||"";
        tEl.appendChild(c);
      }
    }
  }

  function renderYour(){
    const yEl=document.getElementById("your");
    yEl.innerHTML="";
    for(let y=0;y<size;y++){
      for(let x=0;x<size;x++){
        const c=document.createElement("button");
        c.style.aspectRatio="1/1";
        c.style.borderRadius="12px";
        c.style.fontSize="18px";
        c.textContent=board[y][x]||" ";
        c.onclick=()=>{board[y][x]=selectedSticker; renderYour();};
        yEl.appendChild(c);
      }
    }
  }

  function renderTray(){
    const tray=document.getElementById("tray");
    tray.innerHTML="";
    stickers.forEach(s=>{
      const b=document.createElement("button");
      b.className="chip";
      b.textContent=s;
      b.onclick=()=>{selectedSticker=s;};
      tray.appendChild(b);
    });
  }

  function check(){
    for(let y=0;y<size;y++){
      for(let x=0;x<size;x++){
        if(board[y][x]!==target[y][x]){document.getElementById("msg").textContent="Not quite 🙂";return;}
      }
    }
    round++;
    if(round>3){
      document.getElementById("msg").textContent="Amazing symmetry skills 🎉";
      setClaimEnabled(true,"Claim crystal 💎");
    } else {
      board = Array.from({length:size}, ()=>Array(size).fill(""));
      target = genTarget();
      document.getElementById("roundNum").textContent = round;
      renderTarget(); renderYour();
      document.getElementById("msg").textContent="Nice! Next pattern…";
    }
  }

  function reset(root){mount(root);}
  return {mount,reset,isComplete:()=>claimBtn.disabled===false};
}

// ---- Mini Escape Room (3 locks) ----
function miniEscapeRoom() {
  let step = 1;

  function mount(root) {
    step = 1;
    root.innerHTML = `
      <div class="gameTitle">Mini Escape Room</div>
      <div class="small">Solve 3 locks to escape!</div>
      <div class="sep"></div>
      <div class="center" style="gap:10px; padding:10px 0">
        <div class="big">🧰</div>
        <div>
          <div style="font-weight:900" id="lockTitle">Lock 1/3</div>
          <div class="small" id="lockDesc"></div>
        </div>
      </div>
      <div id="panel" style="background:#ffffffdd; border:1px solid rgba(106,76,147,.14); border-radius:18px; padding:12px"></div>
      <div class="sep"></div>
      <div class="small" id="msg"></div>
    `;
    setClaimEnabled(false, "Open the chest to claim your crystal 💎");
    renderStep();
  }

  function renderStep() {
    const title = document.getElementById("lockTitle");
    const desc = document.getElementById("lockDesc");
    const panel = document.getElementById("panel");
    panel.innerHTML = "";
    setMsg("");

    if (step === 1) {
      title.textContent = "Lock 1/3";
      desc.textContent = "What number comes next?";
      const q = document.createElement("div");
      q.className = "big center";
      q.style.gap="10px";
      q.style.flexWrap="wrap";
      q.textContent = "2  4  6  8  10  12  ?";
      panel.appendChild(q);

      const input = mkInput("Type the number…");
      panel.appendChild(input);

      const btn = mkBtn("Unlock");
      btn.onclick = () => {
        if ((input.value||"").trim() === "14") {
          playChime();
          step = 2;
          renderStep();
        } else setMsg("Almost! It’s counting by 2 🙂");
      };
      panel.appendChild(btn);
    } else if (step === 2) {
      title.textContent = "Lock 2/3";
      desc.textContent = "Decode the emoji letters.";
      const map = document.createElement("div");
      map.innerHTML = `<div class="small">🍭 = C &nbsp;&nbsp; 🌟 = I &nbsp;&nbsp; 🦋 = M &nbsp;&nbsp; 🌿 = G &nbsp;&nbsp; 🌸 = A</div>`;
      panel.appendChild(map);

      const q = document.createElement("div");
      q.className="big center";
      q.style.marginTop="10px";
      q.textContent = "🦋🌸🌿🌟🍭";
      panel.appendChild(q);

      const input = mkInput("Type the word…");
      panel.appendChild(input);

      const btn = mkBtn("Unlock");
      btn.onclick = () => {
        const v = (input.value||"").trim().toUpperCase();
        if (v === "MAGIC") {
          playChime();
          step = 3;
          renderStep();
        } else setMsg("Hint: It’s a magical word ✨");
      };
      panel.appendChild(btn);
    } else {
      title.textContent = "Lock 3/3";
      desc.textContent = "Final riddle.";
      const q = document.createElement("div");
      q.className="small";
      q.style.fontWeight="800";
      q.textContent = "I have keys but no doors. I can play songs. What am I?";
      panel.appendChild(q);

      const input = mkInput("Answer…");
      panel.appendChild(input);

      const hintBtn = document.createElement("button");
      hintBtn.className = "btn btn--ghost";
      hintBtn.style.width = "100%";
      hintBtn.style.marginTop = "10px";
      hintBtn.textContent = "💡 Hint";
      const hintReveal = document.createElement("div");
      hintReveal.className = "small";
      hintReveal.style.marginTop = "8px";
      hintReveal.style.display = "none";
      hintReveal.textContent = "🎹";
      hintBtn.onclick = () => { hintReveal.style.display = "block"; };
      panel.appendChild(hintBtn);
      panel.appendChild(hintReveal);

      const btn = mkBtn("Escaped! 🚪");
      btn.onclick = () => {
        const v = (input.value||"").trim().toLowerCase();
        if (v.includes("piano") || v.includes("keyboard")) {
          playChime();
          setMsg("You escaped! 🎉");
          setClaimEnabled(true, "Claim your crystal 💎");
        } else setMsg("Try again 🙂");
      };
      panel.appendChild(btn);
    }
  }

  function mkInput(ph){
    const input=document.createElement("input");
    input.placeholder=ph;
    input.style.width="100%";
    input.style.padding="14px 12px";
    input.style.borderRadius="14px";
    input.style.border="1px solid rgba(106,76,147,.18)";
    input.style.fontSize="16px";
    input.style.marginTop="10px";
    return input;
  }
  function mkBtn(label){
    const btn=document.createElement("button");
    btn.className="btn btn--primary";
    btn.style.width="100%";
    btn.style.marginTop="10px";
    btn.textContent=label;
    return btn;
  }
  function setMsg(t){ document.getElementById("msg").textContent=t; }
  function reset(root){ mount(root); }

  return { mount, reset, isComplete: () => claimBtn.disabled === false };
}

// ---- What Comes Next? (Reasoning set) ----
function whatNextGame() {
  const qs = [
    { seq:["🟥","🟦","🟥","🟦","🟥"], ans:"🟦", hint:"Alternating colors." },
    { seq:["1","2","4","7","11"], ans:"16", hint:"+1, +2, +3, +4…" },
    { seq:["⭐","💖","⭐","💖","⭐","💖"], ans:"⭐", hint:"Repeat pattern." },
    { seq:["A","C","E","G"], ans:"I", hint:"Skip one letter each time." },
    { seq:["🦄","🌈","⭐","🦄","🌈"], ans:"⭐", hint:"Cycle of 3." },
  ];
  let i = 0;
  let correct = 0;

  function mount(root) {
    i = 0; correct = 0;
    root.innerHTML = `
      <div class="gameTitle">What Comes Next?</div>
      <div class="small">Answer 5. Get 4 correct to win.</div>
      <div class="sep"></div>
      <div id="qbox" style="background:#ffffffdd; border:1px solid rgba(106,76,147,.14); border-radius:18px; padding:12px"></div>
      <div class="sep"></div>
      <div class="small" id="msg"></div>
    `;
    setClaimEnabled(false, "Solve 4/5 to claim your crystal 💎");
    render();
  }

  function render() {
    const q = qs[i];
    const box = document.getElementById("qbox");
    box.innerHTML = `
      <div class="small">Question ${i+1}/5</div>
      <div class="big center" style="gap:10px; flex-wrap:wrap; padding:10px 0">${q.seq.join(" ")}</div>
      <div class="small" style="font-weight:800">What’s next?</div>
    `;

    const opts = shuffle([q.ans, ...makeDistractors(q.ans)]).slice(0,4);
    const row = document.createElement("div");
    row.className = "row";
    row.style.marginTop = "10px";
    opts.forEach(o=>{
      const b=document.createElement("button");
      b.className="chip";
      b.textContent=o;
      b.onclick=()=>choose(o);
      row.appendChild(b);
    });
    box.appendChild(row);

    const hintBtn = document.createElement("button");
    hintBtn.className="btn btn--ghost";
    hintBtn.style.width="100%";
    hintBtn.style.marginTop="10px";
    hintBtn.textContent="Hint";
    hintBtn.onclick=()=>setMsg("Hint: " + q.hint);
    box.appendChild(hintBtn);

    setMsg(`Score: ${correct}/${i}`);
  }

  function choose(o) {
    const q = qs[i];
    if (String(o) === String(q.ans)) {
      correct++;
      playChime();
      setMsg("Correct! 🎉");
    } else {
      setMsg("Close! Keep going 🙂");
    }
    i++;
    if (i >= qs.length) {
      if (correct >= 4) {
        setMsg(`You got ${correct}/5! Amazing 🎉`);
        setClaimEnabled(true, "Claim your crystal 💎");
      } else {
        setMsg(`You got ${correct}/5. Try again — you can do it!`);
      }
    } else {
      render();
    }
  }

  function makeDistractors(ans) {
    const a = String(ans);
    if (/^\d+$/.test(a)) {
      const n = Number(a);
      return [String(n-1), String(n+1), String(n+2)];
    }
    const pool = ["🟥","🟦","🟩","🟨","⭐","💖","🌈","🦄","A","B","C","D","E","F","G","H","I"];
    return shuffle(pool.filter(x=>x!==a)).slice(0,3);
  }

  function setMsg(t){ document.getElementById("msg").textContent=t; }
  function reset(root){ mount(root); }
  return { mount, reset, isComplete: () => claimBtn.disabled === false };
}

// ---- Logic Grid (Detective) ----
function logicGridGame() {
  let selected = { Ava:null, Mia:null, Luna:null };
  const names = ["Ava","Mia","Luna"];
  const pets = ["🐰 Bunny","🐱 Kitten","🐉 Dragon"];

  function mount(root) {
    selected = { Ava:null, Mia:null, Luna:null };
    root.innerHTML = `
      <div class="gameTitle">Logic Grid</div>
      <div class="small">Use the clues to match each girl to a pet.</div>
      <div class="sep"></div>
      <div style="background:#ffffffdd; border:1px solid rgba(106,76,147,.14); border-radius:18px; padding:12px">
        <div class="small" style="font-weight:800">Clues</div>
        <ul class="small" style="margin:8px 0 0 18px; padding:0; color:var(--ink); font-weight:700">
          <li>Ava does <b>not</b> have the Dragon.</li>
          <li>The Bunny belongs to <b>Luna</b>.</li>
          <li>Mia does <b>not</b> have the Kitten.</li>
        </ul>
      </div>
      <div class="sep"></div>
      <div id="grid" style="display:flex; flex-direction:column; gap:10px"></div>
      <div class="sep"></div>
      <div class="small" id="msg"></div>
      <button class="btn btn--secondary" id="checkBtn" style="width:100%; margin-top:10px">Check</button>
    `;
    renderRows();
    setClaimEnabled(false, "Solve the logic puzzle to claim your crystal 💎");
    setMsg("Choose a pet for each girl.");
    document.getElementById("checkBtn").onclick = check;
  }

  function renderRows() {
    const g = document.getElementById("grid");
    g.innerHTML = "";
    names.forEach(name=>{
      const row = document.createElement("div");
      row.style.display="flex";
      row.style.gap="10px";
      row.style.alignItems="center";
      const label = document.createElement("div");
      label.style.width="64px";
      label.style.fontWeight="900";
      label.textContent=name;
      row.appendChild(label);

      pets.forEach(p=>{
        const b=document.createElement("button");
        b.className="chip";
        b.textContent = selected[name]===p ? `✅ ${p}` : p;
        b.onclick=()=>{ selected[name]=p; renderRows(); };
        row.appendChild(b);
      });
      g.appendChild(row);
    });
  }

  function check() {
    const vals = Object.values(selected);
    if (vals.some(v=>v===null)) { setMsg("Pick a pet for everyone 🙂"); return; }
    if (new Set(vals).size !== 3) { setMsg("Each pet can only belong to one girl 🙂"); return; }

    if (selected["Luna"] !== "🐰 Bunny") { setMsg("Check the clue about Luna and the Bunny 🙂"); return; }
    if (selected["Ava"] === "🐉 Dragon") { setMsg("Ava can’t have the Dragon 🙂"); return; }
    if (selected["Mia"] === "🐱 Kitten") { setMsg("Mia can’t have the Kitten 🙂"); return; }

    playChime();
    setMsg("Solved! You’re a detective 🎉");
    setClaimEnabled(true, "Claim your crystal 💎");
  }

  function setMsg(t){ document.getElementById("msg").textContent=t; }
  function reset(root){ mount(root); }
  return { mount, reset, isComplete: () => claimBtn.disabled === false };
}

// ---- Star Party Duo (Day 2: Part 1 easy → Part 2 hard) ----
function starPartyDuoGame() {
  let rootEl = null;
  function mount(root) {
    rootEl = root;
    showPhase1();
  }

  function makeGrid(containerId, names, snacks, icons, selected, onSelect) {
    const g = document.getElementById(containerId);
    if (!g) return;
    g.innerHTML = "";
    names.forEach(name => {
      const block = document.createElement("div");
      block.style.cssText = "background:#ffffffcc;border:1.5px solid rgba(192,96,216,.18);border-radius:16px;padding:10px 12px";
      const label = document.createElement("div");
      label.style.cssText = "font-weight:900;font-size:14px;margin-bottom:8px";
      label.textContent = `${icons[name]} ${name}`;
      block.appendChild(label);
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:5px;flex-wrap:nowrap";
      snacks.forEach(s => {
        const b = document.createElement("button");
        b.className = "chip";
        const chosen = selected[name] === s;
        b.style.cssText = `padding:5px 7px;font-size:11px;flex:1;${chosen ? "background:linear-gradient(135deg,#e8d5ff,#ffd6f5);border-color:rgba(192,96,216,.6);" : ""}`;
        b.textContent = chosen ? `✅ ${s}` : s;
        b.onclick = () => onSelect(name, s);
        row.appendChild(b);
      });
      block.appendChild(row);
      g.appendChild(block);
    });
  }

  // ── Part 1: 3 unicorns, 3 snacks — easy clues ──────────
  function showPhase1() {
    const names  = ["Twinkle","Starfall","Moonbeam"];
    const snacks = ["🍓 Strawberry","🍪 Cookie","🍰 Cake"];
    const icons  = { Twinkle:"🌟", Starfall:"⭐", Moonbeam:"🌙" };
    let sel = { Twinkle:null, Starfall:null, Moonbeam:null };

    rootEl.innerHTML = `
      <div class="gameTitle">⭐ Star Party — Part 1 of 2</div>
      <div class="small">Three unicorns brought different snacks. Use the clues to figure out who brought what!</div>
      <div class="sep"></div>
      <div style="background:#ffffffdd;border:1px solid rgba(106,76,147,.14);border-radius:18px;padding:12px">
        <div class="small" style="font-weight:800">🔎 Clues</div>
        <ul class="small" style="margin:8px 0 0 18px;padding:0;color:var(--ink);font-weight:700;line-height:2">
          <li>Moonbeam brought the <b>round</b> snack (🍪).</li>
          <li>Twinkle did <b>not</b> bring Strawberry.</li>
          <li>Starfall did <b>not</b> bring Cake.</li>
        </ul>
      </div>
      <div class="sep"></div>
      <div id="p1grid" style="display:flex;flex-direction:column;gap:12px"></div>
      <div class="sep"></div>
      <div class="small" id="p1msg">Choose a snack for each unicorn 🦄</div>
      <button class="btn btn--secondary" id="p1check" style="width:100%;margin-top:10px">✅ Check My Answer</button>
    `;
    setClaimEnabled(false, "Solve both parts to claim your Wisdom Crystal 💎");

    const render = () => makeGrid("p1grid", names, snacks, icons, sel, (name, s) => { sel[name] = s; render(); });
    render();

    document.getElementById("p1check").onclick = () => {
      const msg = document.getElementById("p1msg");
      const vals = Object.values(sel);
      if (vals.some(v => v === null))          { msg.textContent = "Pick a snack for every unicorn 🙂"; return; }
      if (new Set(vals).size !== 3)            { msg.textContent = "Each snack can only belong to one unicorn 🙂"; return; }
      if (sel["Moonbeam"] !== "🍪 Cookie")    { msg.textContent = "Re-read the clue about Moonbeam 🙂"; return; }
      if (sel["Twinkle"]  === "🍓 Strawberry"){ msg.textContent = "Check the clue about Twinkle 🙂"; return; }
      if (sel["Starfall"] === "🍰 Cake")       { msg.textContent = "Check the clue about Starfall 🙂"; return; }
      playChime();
      msg.textContent = "🎉 Part 1 solved! A fourth unicorn just arrived… get ready!";
      document.getElementById("p1check").disabled = true;
      setTimeout(() => showPhase2(), 1600);
    };
  }

  // ── Part 2: 4 unicorns, 4 snacks — harder clues ────────
  function showPhase2() {
    const names  = ["Twinkle","Starfall","Moonbeam","Comet"];
    const snacks = ["🍓 Strawberry","🍪 Cookie","🍰 Cake","🍬 Candy"];
    const icons  = { Twinkle:"⭐", Starfall:"🌟", Moonbeam:"🌙", Comet:"☄️" };
    // Solution: Twinkle=Cake, Starfall=Candy, Moonbeam=Strawberry, Comet=Cookie
    let sel = { Twinkle:null, Starfall:null, Moonbeam:null, Comet:null };

    rootEl.innerHTML = `
      <div class="gameTitle">⭐ Star Party — Part 2 of 2</div>
      <div class="small">A fourth unicorn joined the party! The clues are trickier — think carefully! 🧠</div>
      <div class="sep"></div>
      <div style="background:#ffffffdd;border:1px solid rgba(106,76,147,.14);border-radius:18px;padding:12px">
        <div class="small" style="font-weight:800">🔎 Clues</div>
        <ul class="small" style="margin:8px 0 0 18px;padding:0;color:var(--ink);font-weight:700;line-height:2">
          <li>Starfall and Comet did <b>not</b> bring anything fruity.</li>
          <li>Moonbeam's snack is <b>never</b> baked.</li>
          <li>Twinkle's snack has <b>frosting and candles</b> on top.</li>
          <li>Comet's snack is <b>perfectly round</b>.</li>
        </ul>
      </div>
      <div class="sep"></div>
      <div id="p2grid" style="display:flex;flex-direction:column;gap:12px"></div>
      <div class="sep"></div>
      <div class="small" id="p2msg">Four unicorns, four snacks — you've got this! 🦄</div>
      <button class="btn btn--secondary" id="p2check" style="width:100%;margin-top:10px">✅ Check My Answer</button>
    `;

    const render = () => makeGrid("p2grid", names, snacks, icons, sel, (name, s) => { sel[name] = s; render(); });
    render();

    document.getElementById("p2check").onclick = () => {
      const msg = document.getElementById("p2msg");
      const vals = Object.values(sel);
      if (vals.some(v => v === null))           { msg.textContent = "Pick a snack for every unicorn 🙂"; return; }
      if (new Set(vals).size !== 4)             { msg.textContent = "Each snack can only belong to one unicorn 🙂"; return; }
      if (sel["Twinkle"]  !== "🍰 Cake")        { msg.textContent = "Re-read the clue about Twinkle's snack 🙂"; return; }
      if (sel["Comet"]    !== "🍪 Cookie")      { msg.textContent = "Re-read the clue about Comet's snack 🙂"; return; }
      if (sel["Moonbeam"] === "🍪 Cookie" || sel["Moonbeam"] === "🍰 Cake") { msg.textContent = "Remember — Moonbeam's snack is never baked 🙂"; return; }
      if (sel["Starfall"] === "🍓 Strawberry")  { msg.textContent = "Check the clue about fruity snacks 🙂"; return; }
      playChime();
      msg.textContent = "🎉 Incredible detective work! You solved BOTH puzzles!";
      setClaimEnabled(true, "Claim your Wisdom Crystal 💎");
    };
  }

  function reset(root) { mount(root); }
  return { mount, reset, isComplete: () => claimBtn.disabled === false };
}

// ---- Logic Grid 2 (Star Party Puzzle — Day 2) ----
function logicGrid2Game() {
  const names  = ["Twinkle","Starfall","Moonbeam"];
  const snacks = ["🍓 Strawberry","🍪 Cookie","🍰 Cake"];
  // Solution: Twinkle=Cake, Starfall=Strawberry, Moonbeam=Cookie
  let selected = { Twinkle:null, Starfall:null, Moonbeam:null };

  function mount(root) {
    selected = { Twinkle:null, Starfall:null, Moonbeam:null };
    root.innerHTML = `
      <div class="gameTitle">⭐ Star Party Puzzle</div>
      <div class="small">Three unicorns brought different snacks to the party. Use the clues to figure out who brought what!</div>
      <div class="sep"></div>
      <div style="background:#ffffffdd; border:1px solid rgba(106,76,147,.14); border-radius:18px; padding:12px">
        <div class="small" style="font-weight:800">🔎 Clues</div>
        <ul class="small" style="margin:8px 0 0 18px; padding:0; color:var(--ink); font-weight:700; line-height:2">
          <li>Moonbeam brought the <b>round</b> snack (🍪).</li>
          <li>Twinkle did <b>not</b> bring Strawberry.</li>
          <li>Starfall did <b>not</b> bring Cake.</li>
        </ul>
      </div>
      <div class="sep"></div>
      <div id="lgrid2" style="display:flex; flex-direction:column; gap:12px"></div>
      <div class="sep"></div>
      <div class="small" id="msg2"></div>
      <button class="btn btn--secondary" id="checkBtn2" style="width:100%; margin-top:10px">✅ Check My Answer</button>
    `;
    renderRows();
    setClaimEnabled(false, "Solve the star puzzle to claim your crystal 💎");
    setMsg("Choose a snack for each unicorn 🦄");
    document.getElementById("checkBtn2").onclick = check;
  }

  function renderRows() {
    const g = document.getElementById("lgrid2");
    if (!g) return;
    g.innerHTML = "";
    const icons = { Twinkle:"🌟", Starfall:"⭐", Moonbeam:"🌙" };
    names.forEach(name => {
      const block = document.createElement("div");
      block.style.cssText = "background:#ffffffcc; border:1.5px solid rgba(192,96,216,.18); border-radius:16px; padding:10px 12px;";

      // Name header
      const label = document.createElement("div");
      label.style.cssText = "font-weight:900; font-size:14px; margin-bottom:8px;";
      label.textContent = `${icons[name]} ${name}`;
      block.appendChild(label);

      // Snack chips in one row
      const row = document.createElement("div");
      row.style.cssText = "display:flex; gap:6px; flex-wrap:nowrap;";
      snacks.forEach(s => {
        const b = document.createElement("button");
        b.className = "chip";
        const chosen = selected[name] === s;
        b.style.cssText = `padding:6px 8px; font-size:12px; flex:1; ${chosen ? "background:linear-gradient(135deg,#e8d5ff,#ffd6f5); border-color:rgba(192,96,216,.6);" : ""}`;
        b.textContent = chosen ? `✅ ${s}` : s;
        b.onclick = () => { selected[name] = s; renderRows(); };
        row.appendChild(b);
      });
      block.appendChild(row);
      g.appendChild(block);
    });
  }

  function check() {
    const vals = Object.values(selected);
    if (vals.some(v => v === null)) { setMsg("Pick a snack for every unicorn 🙂"); return; }
    if (new Set(vals).size !== 3)   { setMsg("Each snack can only belong to one unicorn 🙂"); return; }

    if (selected["Moonbeam"] !== "🍪 Cookie") { setMsg("Re-read the clue about Moonbeam and the round snack 🙂"); return; }
    if (selected["Twinkle"]  === "🍓 Strawberry") { setMsg("Check the clue about Twinkle 🙂"); return; }
    if (selected["Starfall"] === "🍰 Cake")        { setMsg("Check the clue about Starfall 🙂"); return; }

    playChime();
    setMsg("🎉 Amazing! You solved the Star Party Puzzle!");
    setClaimEnabled(true, "Claim your Wisdom Crystal 💎");
  }

  function setMsg(t) {
    const el = document.getElementById("msg2");
    if (el) el.textContent = t;
  }
  function reset(root) { mount(root); }
  return { mount, reset, isComplete: () => claimBtn.disabled === false };
}

// ---- Mastermind Challenge (Amazon reward day) ----
function finaleMastermindGame() {
  let rootEl = null;
  let stage = 1;

  // ── Stage 1: Odd One Out ────────────────────────────────
  const ODD_ROUNDS = [
    { items: ["🍎","🍊","🍋","🐶"], odd: "🐶",  hint: "Three of these are fruits. Which one is NOT a fruit?" },
    { items: ["🐶","🐱","🐸","🚗"], odd: "🚗",  hint: "Three of these are animals. Which one is NOT an animal?" },
    { items: ["⭐","🌙","🌈","🍕"], odd: "🍕",  hint: "Three of these are in the sky. Which one is NOT?" },
    { items: ["🎵","🎸","🥁","🌺"], odd: "🌺",  hint: "Three of these make music. Which one does NOT?" },
    { items: ["🚂","🚀","🚗","🍔"], odd: "🍔",  hint: "Three of these are vehicles. Which one is NOT?" },
  ];
  let s1Round = 0;

  function s1Init() { s1Round = 0; }

  function s1Mount() {
    rootEl.innerHTML = `
      <div class="gameTitle">Stage 1 / 3 — Odd One Out 🔍</div>
      <div class="small">Find the one that doesn't belong — 4 rounds!</div>
      <div class="sep"></div>
      <div id="s1panel"></div>
      <div class="small" style="margin-top:12px;text-align:center;min-height:20px" id="s1msg"></div>
    `;
    setClaimEnabled(false, "Complete all 3 stages to unlock your reward 💎");
    s1Render();
  }

  function s1Render() {
    const panel = document.getElementById("s1panel");
    if (!panel) return;
    const r = ODD_ROUNDS[s1Round];
    panel.innerHTML = "";

    const roundLabel = document.createElement("div");
    roundLabel.style.cssText = "text-align:center;font-weight:900;font-size:13px;color:var(--accent);margin-bottom:8px";
    roundLabel.textContent = `Round ${s1Round + 1} / ${ODD_ROUNDS.length}`;
    panel.appendChild(roundLabel);

    const hint = document.createElement("div");
    hint.style.cssText = "text-align:center;font-weight:700;font-size:14px;margin-bottom:16px;line-height:1.4";
    hint.textContent = r.hint;
    panel.appendChild(hint);

    const grid = document.createElement("div");
    grid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:270px;margin:0 auto";
    shuffle([...r.items]).forEach(item => {
      const b = document.createElement("button");
      b.className = "chip";
      b.style.cssText = "font-size:42px;padding:14px;border-radius:20px;width:100%;aspect-ratio:1/1;display:flex;align-items:center;justify-content:center";
      b.textContent = item;
      b.onclick = () => s1Tap(b, item);
      grid.appendChild(b);
    });
    panel.appendChild(grid);
  }

  function s1Tap(btn, item) {
    const r = ODD_ROUNDS[s1Round];
    const msg = document.getElementById("s1msg");
    if (item === r.odd) {
      playChime();
      btn.style.transform = "scale(1.25)";
      btn.style.boxShadow = "0 0 0 4px #a855f7";
      if (msg) msg.textContent = "✅ That's the one!";
      s1Round++;
      if (s1Round >= ODD_ROUNDS.length) {
        setTimeout(() => { stage = 2; s2Mount(); }, 900);
      } else {
        setTimeout(() => { if (msg) msg.textContent = ""; s1Render(); }, 750);
      }
    } else {
      btn.style.transition = "transform .08s";
      btn.style.transform = "scale(.88)";
      setTimeout(() => { btn.style.transform = "scale(1)"; }, 160);
      if (msg) { msg.textContent = "Hmm, try again! 🙂"; setTimeout(() => { if (msg) msg.textContent = ""; }, 1100); }
    }
  }

  // ── Stage 2: Flash Memory ───────────────────────────────
  const MEM_POOL = ["⭐","🦄","🌈","💎","🌸","🎀","🧁","🎵"];
  const MEM_LEN = 5;
  let memSeq = [], memInput = [], memBusy = false;

  function s2Mount() {
    memSeq = shuffle([...MEM_POOL]).slice(0, MEM_LEN);
    memInput = []; memBusy = false;
    rootEl.innerHTML = `
      <div class="gameTitle">Stage 2 / 3 — Flash Memory ⚡</div>
      <div class="small">Watch the sequence flash one by one, then tap them back in order!</div>
      <div class="sep"></div>
      <div class="center" id="flasher" style="font-size:66px;min-height:84px;transition:transform .15s ease,opacity .15s ease">👁️</div>
      <div class="sep"></div>
      <div class="row center" id="memBtns" style="justify-content:center;gap:10px;flex-wrap:wrap"></div>
      <button class="btn btn--secondary" id="replayBtn" style="width:100%;margin-top:12px;display:none">👁️ Replay sequence</button>
      <div class="small" style="margin-top:12px;text-align:center;min-height:20px" id="memMsg">Get ready…</div>
    `;
    setClaimEnabled(false, "Complete all 3 stages to unlock your reward 💎");
    setTimeout(() => s2ShowSeq(), 700);
  }

  async function s2ShowSeq() {
    memBusy = true; memInput = [];
    const flasher = document.getElementById("flasher");
    const btns = document.getElementById("memBtns");
    const msg = document.getElementById("memMsg");
    const replay = document.getElementById("replayBtn");
    if (btns) btns.innerHTML = "";
    if (replay) replay.style.display = "none";
    if (msg) msg.textContent = "Watch carefully… 👀";
    for (let i = 0; i < memSeq.length; i++) {
      await sleep(280);
      if (!document.getElementById("flasher")) return;
      if (flasher) { flasher.textContent = memSeq[i]; flasher.style.transform = "scale(1.35)"; flasher.style.opacity = "1"; }
      await sleep(660);
      if (!document.getElementById("flasher")) return;
      if (flasher) { flasher.style.transform = "scale(1)"; flasher.style.opacity = "0.15"; flasher.textContent = "·"; }
      await sleep(240);
    }
    memBusy = false;
    if (document.getElementById("flasher")) {
      if (flasher) { flasher.textContent = "❓"; flasher.style.opacity = "1"; }
      if (msg) msg.textContent = "Now tap them in order! 👇";
      const replayBtn = document.getElementById("replayBtn");
      if (replayBtn) { replayBtn.style.display = ""; replayBtn.onclick = () => s2ShowSeq(); }
      s2RenderBtns();
    }
  }

  function s2RenderBtns() {
    const btns = document.getElementById("memBtns");
    if (!btns) return;
    btns.innerHTML = "";
    shuffle([...memSeq]).forEach(e => {
      const b = document.createElement("button");
      b.className = "chip";
      b.style.fontSize = "26px";
      b.textContent = e;
      b.onclick = () => s2Tap(e);
      btns.appendChild(b);
    });
  }

  function s2Tap(e) {
    if (memBusy) return;
    const flasher = document.getElementById("flasher");
    const msg = document.getElementById("memMsg");
    if (e !== memSeq[memInput.length]) {
      memInput = [];
      if (flasher) { flasher.textContent = "❌"; flasher.style.transform = "scale(1.25)"; }
      if (msg) msg.textContent = "Not quite — watch again! 👁️";
      const btns = document.getElementById("memBtns");
      if (btns) btns.innerHTML = "";
      setTimeout(() => { if (flasher) flasher.style.transform = "scale(1)"; s2ShowSeq(); }, 900);
    } else {
      memInput.push(e);
      if (flasher) { flasher.textContent = e; flasher.style.transform = "scale(1.2)"; }
      setTimeout(() => { if (flasher) flasher.style.transform = "scale(1)"; }, 200);
      if (memInput.length === memSeq.length) {
        playChime();
        if (msg) msg.textContent = "🎉 Perfect memory!";
        setTimeout(() => { stage = 3; s3Mount(); }, 900);
      } else {
        if (msg) msg.textContent = `${memInput.length} / ${memSeq.length} — keep going!`;
      }
    }
  }

  // ── Stage 3: Emoji Cipher ───────────────────────────────
  // Decode: 🌟=S  🦄=M  💎=A  🌺=R  ⭐=T  → SMART
  const CIPHER_MAP = [
    { em: "🌟", lt: "S" }, { em: "🦄", lt: "M" }, { em: "💎", lt: "A" },
    { em: "🌺", lt: "R" }, { em: "⭐", lt: "T" },
  ];
  const CIPHER_ENCODED = ["🌟","🦄","💎","🌺","⭐"];
  const CIPHER_ANSWER  = "SMART";
  let s3Input = [];

  function s3Mount() {
    s3Input = [];
    const keyHtml = shuffle([...CIPHER_MAP]).map(({ em, lt }) =>
      `<span style="font-size:20px">${em}</span><span style="font-weight:900;color:var(--accent);font-size:14px"> = ${lt}</span>`
    ).join(" &nbsp; ");
    rootEl.innerHTML = `
      <div class="gameTitle">Stage 3 / 3 — Crystal Decoder 🔑</div>
      <div class="small">Use the key to decode the secret word — tap letters in order!</div>
      <div class="sep"></div>
      <div style="background:#fff8ff;border-radius:14px;padding:10px 14px;text-align:center;line-height:2.6;margin-bottom:4px">${keyHtml}</div>
      <div class="center" style="gap:10px;font-size:36px;margin:10px 0">${CIPHER_ENCODED.map(e=>`<span>${e}</span>`).join("")}</div>
      <div class="small" style="text-align:center;margin-bottom:6px">↓ Tap the decoded letters in order ↓</div>
      <div class="center" id="s3draft" style="gap:8px;margin:10px 0;min-height:44px;flex-wrap:wrap"></div>
      <div class="row center" id="s3btns" style="justify-content:center;gap:8px;margin-top:8px;flex-wrap:wrap"></div>
      <button class="btn btn--secondary" id="s3clr" style="width:100%;margin-top:10px">Clear</button>
      <div class="small" style="margin-top:10px;text-align:center;min-height:20px" id="s3msg">Decode the emoji word above!</div>
    `;
    setClaimEnabled(false, "Decode the word to claim your reward 💎");
    s3RenderBtns();
    s3UpdateDraft();
    document.getElementById("s3clr").onclick = () => { s3Input = []; s3UpdateDraft(); };
  }

  function s3RenderBtns() {
    const btns = document.getElementById("s3btns");
    if (!btns) return;
    btns.innerHTML = "";
    shuffle(CIPHER_MAP.map(x => x.lt)).forEach(lt => {
      const b = document.createElement("button");
      b.className = "chip";
      b.style.fontSize = "18px";
      b.style.fontWeight = "900";
      b.textContent = lt;
      b.onclick = () => s3Tap(lt);
      btns.appendChild(b);
    });
  }

  function s3Tap(lt) {
    if (s3Input.length >= CIPHER_ENCODED.length) return;
    s3Input.push(lt);
    s3UpdateDraft();
    if (s3Input.length === CIPHER_ENCODED.length) {
      const msg = document.getElementById("s3msg");
      if (s3Input.join("") === CIPHER_ANSWER) {
        playChime();
        if (msg) msg.textContent = `🎉 You decoded "${CIPHER_ANSWER}"! You’re so smart!`;
        setClaimEnabled(true, "Claim your Amazon reward 💎");
      } else {
        if (msg) msg.textContent = "Not quite — try again!";
        setTimeout(() => { s3Input = []; s3UpdateDraft(); if (msg) msg.textContent = "Decode the emoji word above!"; }, 850);
      }
    }
  }

  function s3UpdateDraft() {
    const draft = document.getElementById("s3draft");
    if (!draft) return;
    draft.innerHTML = CIPHER_ENCODED.map((_, i) => {
      const filled = !!s3Input[i];
      return `<span style="font-size:22px;font-weight:900;width:30px;text-align:center;border-bottom:3px solid rgba(106,76,147,.3);display:inline-block;padding-bottom:2px;color:${filled ? "var(--accent)" : "inherit"}">${s3Input[i] || "_"}</span>`;
    }).join("");
  }

  // ── Root ────────────────────────────────────────────────
  function mount(root) { rootEl = root; stage = 1; s1Init(); s1Mount(); }
  function reset(root) { mount(root); }
  return { mount, reset, isComplete: () => claimBtn.disabled === false };
}


// ---- Rainbow Math Quest ----
function mathQuestGame() {
  // Gamified Bubble Pop Math — tap the bubble with the right answer!
  const ROUNDS = 7;
  const BUBBLE_COLORS = [
    { bg: "linear-gradient(145deg,#FFD6E8,#FF9EC9)", shadow: "rgba(255,110,180,.35)", text: "#6B1E4A" },
    { bg: "linear-gradient(145deg,#C8F7D6,#7EE8A2)", shadow: "rgba(100,220,150,.35)", text: "#1A5230" },
    { bg: "linear-gradient(145deg,#CCE8FF,#7EC8FF)", shadow: "rgba(100,180,255,.35)", text: "#1A3F6B" },
    { bg: "linear-gradient(145deg,#FFE8C0,#FFB84D)", shadow: "rgba(255,180,60,.35)",  text: "#5E3800" },
  ];
  const WINS  = ["Brilliant! 🌟","You got it! 💖","Pop! ⭐","Yes! 🦄","Nailed it! 🌈","Correct! 🎉","Awesome! ✨"];
  const MISSES = ["Oops — try again! 🤔","Not that one! You’ve got this 💪","Almost — keep going! 🌸"];
  let round = 0;
  let current = null;
  let rootEl = null;

  function makeQ() {
    const op = randPick(["+", "-", "×"]);
    let a = randInt(2, 12), b = randInt(2, 12);
    if (op === "×") { a = randInt(2, 9); b = randInt(2, 9); }
    if (op === "-" && b > a) [a, b] = [b, a];
    const ans = op === "+" ? a + b : op === "-" ? a - b : a * b;
    const wrongs = shuffle(unique(
      [ans+1, ans-1, ans+2, ans-2, ans+3, ans-3].filter(x => x >= 0 && x !== ans)
    )).slice(0, 3);
    current = { a, b, op, ans, choices: shuffle([ans, ...wrongs]) };
  }

  function starsHTML() {
    return `<div class="star-row">${
      Array.from({ length: ROUNDS }, (_, i) =>
        `<span class="${i < round ? "earned" : ""}">${i < round ? "⭐" : "✦"}</span>`
      ).join("")
    }</div>`;
  }

  function render(root) {
    rootEl = root;
    root.innerHTML = `
      <div class="gameTitle">🫧 Bubble Pop Math!</div>
      ${starsHTML()}
      <div class="center" style="flex-direction:column; gap:4px; margin-bottom:14px">
        <div class="small">Round ${round + 1} of ${ROUNDS} — pop the right bubble!</div>
        <div style="font-family:Nunito,sans-serif; font-weight:900; font-size:38px; letter-spacing:3px; color:var(--ink)">
          ${current.a} ${current.op} ${current.b}
        </div>
        <div class="small">= ?</div>
      </div>
      <div class="bubble-grid" id="bubbleGrid"></div>
      <div class="small center" style="margin-top:14px; min-height:20px" id="bubbleMsg">Tap the right bubble! 🌈</div>
    `;
    renderBubbles(root);
  }

  function renderBubbles(root) {
    const grid = root.querySelector("#bubbleGrid");
    current.choices.forEach((n, idx) => {
      const col = BUBBLE_COLORS[idx];
      const btn = document.createElement("button");
      btn.className = "bubble";
      btn.style.cssText = `background:${col.bg}; color:${col.text}; box-shadow:0 8px 24px ${col.shadow},inset 0 -4px 8px rgba(0,0,0,.08),inset 0 4px 10px rgba(255,255,255,.55); animation-delay:${idx * 0.25}s`;
      btn.textContent = String(n);
      btn.dataset.val = n;
      btn.onclick = () => popBubble(btn, n);
      grid.appendChild(btn);
    });
  }

  function popBubble(btn, n) {
    if (btn.disabled) return;
    const allBtns = rootEl.querySelectorAll(".bubble");
    allBtns.forEach(b => { b.disabled = true; });

    if (n === current.ans) {
      btn.classList.add("bubble--pop");
      playChime();
      document.getElementById("bubbleMsg").textContent = randPick(WINS);
      round++;
      // Update stars immediately
      const starEls = rootEl.querySelectorAll(".star-row span");
      if (starEls[round - 1]) {
        starEls[round - 1].textContent = "⭐";
        starEls[round - 1].classList.add("earned");
      }
      if (round >= ROUNDS) {
        setTimeout(() => {
          document.getElementById("bubbleMsg").textContent = "You popped every one! 🎉 Math star!";
          setClaimEnabled(true, "You’re amazing — claim your crystal! 💎");
        }, 420);
        return;
      }
      setTimeout(() => { makeQ(); render(rootEl); }, 650);
    } else {
      btn.classList.add("bubble--wrong");
      document.getElementById("bubbleMsg").textContent = randPick(MISSES);
      setTimeout(() => {
        btn.classList.remove("bubble--wrong");
        allBtns.forEach(b => { b.disabled = false; });
      }, 520);
    }
  }

  function mount(root) {
    round = 0;
    makeQ();
    setClaimEnabled(false, "Pop all the right bubbles to win! 🫧");
    render(root);
  }

  function reset(root) { mount(root); }
  return { mount, reset, isComplete: () => claimBtn.disabled === false };
}

// ---- Birthday Finale (Day 17) ----
function birthdayFinaleGame() {
  const PAGES = [
    {
      anim:"float",
      decos:[{e:"✨",l:"-28px",t:"18px"},{e:"🌟",l:"118%",t:"22px"},{e:"✨",l:"44%",t:"-26px"}],
      title:"Once upon a time…",
      text:"There was a girl named Ariana. Seven years old. And completely, absolutely magical.",
    },
    {
      anim:"pop",
      decos:[{e:"🗺️",l:"-30px",t:"40px"},{e:"⭐",l:"116%",t:"14px"},{e:"🔮",l:"44%",t:"-26px"}],
      title:"17 magical doors appeared.",
      text:"Each one held a challenge — a puzzle, a mystery, a riddle. All of them designed just for her.",
    },
    {
      anim:"glow",
      decos:[{e:"💎",l:"-26px",t:"50px"},{e:"🧩",l:"114%",t:"36px"},{e:"🔐",l:"44%",t:"-24px"}],
      title:"She never gave up.",
      text:"Patterns. Codes. Mazes. Logic grids. She solved them all — and got smarter with every single one.",
    },
    {
      anim:"glow",
      decos:[{e:"🌈",l:"-28px",t:"28px"},{e:"💜",l:"116%",t:"46px"},{e:"✨",l:"44%",t:"-26px"}],
      title:"She found the secret.",
      text:"The magic was never hidden in the crystals. It was inside her all along. It always was.",
    },
    {
      anim:"zoom",
      full:true,
      decos:[{e:"🎂",l:"-30px",t:"60px"},{e:"🎉",l:"116%",t:"18px"},{e:"🌟",l:"44%",t:"-26px"}],
      title:"Today is her birthday.",
      text:"You're not just 7 — you're 7 levels of awesomeness! 🌟<br><br>Warning: this girl causes excessive sparkle wherever she goes. ✨",
    },
    {
      anim:"float",
      decos:[],
      title:"She is so loved.",
      text:"More than words can say. More than all the crystals in the world. Forever and always. 💜",
      last:true,
    },
  ];

  const CANDLES = [
    {color:"#FF6EB4", h:58, msg:"You are BRAVE. 🦁"},
    {color:"#FFB347", h:50, msg:"You are CREATIVE. 🎨"},
    {color:"#FFE066", h:62, msg:"You are CURIOUS. 🔭"},
    {color:"#A8E6CF", h:54, msg:"You are KIND. 💜"},
    {color:"#A2D2FF", h:66, msg:"You SPREAD JOY. 😊"},
    {color:"#C3B1E1", h:52, msg:"You are LOVED. 💖"},
    {color:"#FF9A9E", h:60, msg:"You are MAGIC. ✨"},
  ];

  function mount(root) {
    setClaimEnabled(false, "Experience your special birthday finale 🎂");
    renderStory(root);
  }

  // ── Scene SVGs: Ghibli-style animated scenes ──────────
  function getSceneSVG(idx) {
    const S = [
// ── Scene 0: Starry Night ("Once upon a time…") ─────
`<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg"><image href="./day17_1.png" x="0" y="0" width="160" height="160" preserveAspectRatio="xMidYMid slice"/><circle cx="42" cy="70" r="2.5" fill="#ffe97a"><animate attributeName="opacity" values="1;.2;1" dur="1.2s" repeatCount="indefinite"/><animate attributeName="r" values="2.5;3.5;2.5" dur="1.2s" repeatCount="indefinite"/></circle><g><animateTransform attributeName="transform" type="translate" values="0,0;0,0;-68,45;-68,45" keyTimes="0;0.54;0.82;1" dur="5s" repeatCount="indefinite"/><line x1="148" y1="13" x2="158" y2="7" stroke="white" stroke-width="2" stroke-linecap="round"><animate attributeName="opacity" values="0;0;.9;.6;0;0" keyTimes="0;0.53;0.57;0.82;0.86;1" dur="5s" repeatCount="indefinite"/></line></g></svg>`,
// ── Scene 1: Magic Forest Doors ("17 magical doors appeared.") ──
`<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="bg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1e0a3c"/><stop offset="70%" stop-color="#2d1854"/><stop offset="100%" stop-color="#1a2840"/></linearGradient><radialGradient id="dgl1" cx="50%" cy="40%" r="55%"><stop offset="0%" stop-color="#64ffda" stop-opacity=".35"/><stop offset="100%" stop-color="#64ffda" stop-opacity="0"/></radialGradient></defs><rect width="160" height="160" fill="url(#bg1)"/><ellipse cx="80" cy="118" rx="95" ry="18" fill="rgba(180,126,255,.1)"/><rect x="-5" y="48" width="18" height="110" fill="#05100a"/><ellipse cx="4" cy="50" rx="20" ry="32" fill="#05100a"/><rect x="14" y="62" width="15" height="95" fill="#05100a"/><ellipse cx="21" cy="63" rx="16" ry="26" fill="#091508"/><rect x="147" y="48" width="18" height="110" fill="#05100a"/><ellipse cx="156" cy="50" rx="20" ry="32" fill="#05100a"/><rect x="131" y="62" width="15" height="95" fill="#05100a"/><ellipse cx="139" cy="63" rx="16" ry="26" fill="#091508"/><path d="M55,160 Q80,102 105,160" fill="#1a2840"/><path d="M60,160 Q80,110 100,160" fill="#21344e"/><ellipse cx="80" cy="98" rx="28" ry="36" fill="url(#dgl1)"><animate attributeName="opacity" values=".7;1;.7" dur="2.2s" repeatCount="indefinite"/></ellipse><rect x="62" y="68" width="36" height="52" rx="4" fill="none" stroke="#64ffda" stroke-width="2.5"/><path d="M62,78 Q80,58 98,78" fill="none" stroke="#64ffda" stroke-width="2.5"/><rect x="64" y="70" width="32" height="48" rx="3" fill="#64ffda" opacity=".07"/><line x1="80" y1="70" x2="80" y2="118" stroke="#64ffda" stroke-width=".8" opacity=".4"/><line x1="63" y1="94" x2="97" y2="94" stroke="#64ffda" stroke-width=".8" opacity=".4"/><circle cx="80" cy="100" r="3" fill="#64ffda" opacity=".75"/><path d="M78,103 L80,111 L82,103" fill="#64ffda" opacity=".75"/><rect x="18" y="80" width="22" height="38" rx="3" fill="none" stroke="#b47eff" stroke-width="1.5" opacity=".5"/><path d="M18,90 Q29,76 40,90" fill="none" stroke="#b47eff" stroke-width="1.5" opacity=".5"/><rect x="120" y="80" width="22" height="38" rx="3" fill="none" stroke="#b47eff" stroke-width="1.5" opacity=".5"/><path d="M120,90 Q131,76 142,90" fill="none" stroke="#b47eff" stroke-width="1.5" opacity=".5"/><circle cx="46" cy="68" r="2.2" fill="#ffe97a"><animate attributeName="opacity" values=".9;.15;.9" dur="1.8s" repeatCount="indefinite"/><animate attributeName="cy" values="68;59;68" dur="1.8s" repeatCount="indefinite"/></circle><circle cx="114" cy="64" r="1.6" fill="#64ffda"><animate attributeName="opacity" values=".8;.1;.8" dur="2.2s" begin=".7s" repeatCount="indefinite"/><animate attributeName="cy" values="64;55;64" dur="2.2s" begin=".7s" repeatCount="indefinite"/></circle><circle cx="80" cy="50" r="1.9" fill="#fff"><animate attributeName="opacity" values=".9;.2;.9" dur="1.5s" begin="1.1s" repeatCount="indefinite"/><animate attributeName="cy" values="50;42;50" dur="1.5s" begin="1.1s" repeatCount="indefinite"/></circle><circle cx="34" cy="90" r="1.3" fill="#b47eff"><animate attributeName="opacity" values=".8;.1;.8" dur="2.6s" begin=".3s" repeatCount="indefinite"/><animate attributeName="cy" values="90;81;90" dur="2.6s" begin=".3s" repeatCount="indefinite"/></circle><circle cx="126" cy="86" r="1.5" fill="#ffe97a"><animate attributeName="opacity" values=".8;.15;.8" dur="1.9s" begin="1.5s" repeatCount="indefinite"/><animate attributeName="cy" values="86;78;86" dur="1.9s" begin="1.5s" repeatCount="indefinite"/></circle><circle cx="62" cy="56" r="1.2" fill="#64ffda"><animate attributeName="opacity" values=".7;.1;.7" dur="2.8s" begin=".9s" repeatCount="indefinite"/><animate attributeName="cy" values="56;47;56" dur="2.8s" begin=".9s" repeatCount="indefinite"/></circle></svg>`,
// ── Scene 2: Crystal Mountain ("She never gave up.") ────
`<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg"><image href="./day17_3.png" x="0" y="0" width="160" height="160" preserveAspectRatio="xMidYMid slice"/></svg>`,
// ── Scene 3: Inner Light ("She found the secret.") ──────
`<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg"><image href="./day17_4.png" x="0" y="0" width="160" height="160" preserveAspectRatio="xMidYMid slice"/></svg>`,
// ── Scene 4: Birthday Cake ("Today is her birthday.") ───
`<div style="width:100%;max-width:260px;margin:0 auto;"><img src="./ariana_birthday cake.png" style="width:100%;height:auto;display:block;border-radius:20px;box-shadow:0 8px 28px rgba(192,96,216,.4);"/></div>`,
// ── Scene 5: Sunset Love ("She is so loved.") ───────────
`<svg viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg"><image href="./day17_6.png" x="0" y="0" width="220" height="220" preserveAspectRatio="xMidYMid slice"/></svg>`,
    ];
    return S[Math.min(idx, S.length - 1)] || S[0];
  }

  // ── ACT 1: STORYBOOK ──────────────────────────────────
  function renderStory(root) {
    let page = 0;
    let flipping = false;
    root.innerHTML = `
      <div class="book">
        <div class="book-binding">
          <div class="book-bdot"></div>
          <div class="book-bdot"></div>
          <div class="book-bdot"></div>
          <div class="book-bdot"></div>
          <div class="book-bdot"></div>
        </div>
        <div class="book-pages-wrap">
          <div id="bookPage" class="book-pg"></div>
        </div>
      </div>
      <div class="story-dots" id="sbDots"></div>
      <button class="btn btn--primary" id="sbNext" style="width:100%;margin-top:10px">Next →</button>
    `;
    showPage(0);
    document.getElementById("sbNext").addEventListener("click", () => {
      if (flipping) return;
      const next = page + 1;
      if (next >= PAGES.length) { renderCeremony(root); return; }
      flipping = true;
      const el = document.getElementById("bookPage");
      el.classList.add("bk-flip-out");
      setTimeout(() => {
        page = next;
        showPage(page);
        const el2 = document.getElementById("bookPage");
        el2.classList.add("bk-flip-in");
        el2.addEventListener("animationend", () => {
          el2.classList.remove("bk-flip-in");
          flipping = false;
        }, { once: true });
      }, 300);
    });

    function showPage(i) {
      const p = PAGES[i];
      const el = document.getElementById("bookPage");
      el.classList.remove("bk-flip-out");

      const decosHtml = p.decos.map((d, di) =>
        `<div class="story-deco" style="left:${d.l};top:${d.t};animation-delay:${di * 0.28}s">${d.e}</div>`
      ).join("");
      const heartsHtml = p.anim === "heart"
        ? [0,1,2].map(hi => `<div class="story-heart-float" style="left:${25+hi*22}%;bottom:0;animation-delay:${hi*0.8}s">💜</div>`).join("")
        : "";

      const sceneHtml = p.full
        ? `<div class="story-scene-full">${decosHtml}${getSceneSVG(i)}</div>`
        : `<div class="story-portrait-wrap">
            ${decosHtml}${heartsHtml}
            <div class="story-portrait story-scene story-portrait--${p.anim}">${getSceneSVG(i)}</div>
          </div>`;

      el.innerHTML = `
        ${sceneHtml}
        <div class="story-title">${p.title}</div>
        <div class="story-text">${p.text}</div>
        <div class="book-pg-footer">
          <span class="book-pg-num">${i + 1} / ${PAGES.length}</span>
        </div>
      `;

      document.getElementById("sbDots").innerHTML = PAGES.map((_,di) =>
        `<div class="story-dot${di===i?" story-dot--on":""}"></div>`
      ).join("");
      document.getElementById("sbNext").textContent = p.last ? "💎 Crystal Ceremony" : "Next →";
    }
  }

  // ── ACT 2: CRYSTAL CEREMONY ───────────────────────────
  function renderCeremony(root) {
    root.innerHTML = `
      <div class="gameTitle" style="margin-bottom:4px">💎 Crystal Ceremony</div>
      <div class="ceremony-msg" id="cMsg">
        <div class="small" style="color:var(--muted)">Watch your crystals light up… ✨</div>
      </div>
      <div class="ceremony-crystals" id="cGrid"></div>
      <button class="btn btn--primary" id="cNext" style="width:100%;margin-top:12px;display:none">🕯️ Blow Out the Candles →</button>
    `;
    const grid = document.getElementById("cGrid");
    DAYS.forEach((_, i) => {
      const el = document.createElement("div");
      el.className = "ceremony-crystal";
      el.id = `cc${i}`;
      el.textContent = "💎";
      grid.appendChild(el);
    });

    let i = 0;
    const timer = setInterval(() => {
      if (i >= DAYS.length) {
        clearInterval(timer);
        const msg = document.getElementById("cMsg");
        if (msg) msg.innerHTML = `<div style="font-weight:900;color:var(--accent);font-size:15px">All 17 crystals — all yours, Ariana. 💜</div>`;
        const btn = document.getElementById("cNext");
        if (btn) { btn.style.display = ""; playChime(); }
        return;
      }
      const el = document.getElementById(`cc${i}`);
      if (el) el.classList.add("ceremony-crystal--lit");
      const msg = document.getElementById("cMsg");
      if (msg) msg.innerHTML = `
        <div style="font-weight:900;font-size:13px;color:var(--accent)">${DAYS[i].crystalName}</div>
        <div class="small" style="margin-top:2px">${DAYS[i].affirm}</div>
      `;
      playChime();
      i++;
    }, 3000);

    document.getElementById("cNext").addEventListener("click", () => renderCandles(root));
  }

  // ── ACT 3: BLOW OUT THE CANDLES ───────────────────────
  function renderCandles(root) {
    const blown = Array(7).fill(false);
    root.innerHTML = `
      <div class="gameTitle">🎂 Make a Wish!</div>
      <div class="small" style="text-align:center;margin-bottom:4px">Tap each candle to blow it out.</div>
      <div id="candleReveal" class="candle-reveal" style="visibility:hidden">placeholder</div>
      <div class="candle-scene" id="candleRow"></div>
      <div class="small" style="text-align:center;color:var(--muted);margin-top:6px" id="candleCount">0 / 7</div>
    `;
    const row = document.getElementById("candleRow");
    CANDLES.forEach((cd, i) => {
      const el = document.createElement("div");
      el.className = "candle";
      el.innerHTML = `
        <div class="candle__flame">🔥</div>
        <div class="candle__body" style="height:${cd.h}px;background:linear-gradient(to bottom,${cd.color}55,${cd.color}cc)"></div>
        <div class="candle__smoke">💨</div>
      `;
      el.addEventListener("click", () => {
        if (blown[i]) return;
        blown[i] = true;
        el.classList.add("candle--out");
        playChime();
        const rev = document.getElementById("candleReveal");
        if (rev) {
          rev.style.visibility = "visible";
          rev.style.animation = "none";
          void rev.offsetWidth;
          rev.style.animation = "";
          rev.textContent = cd.msg;
        }
        const count = blown.filter(Boolean).length;
        document.getElementById("candleCount").textContent = `${count} / 7`;
        if (count === 7) setTimeout(() => setClaimEnabled(true, "🎂 Happy Birthday, Ariana! Claim your crystal! 💎"), 700);
      });
      row.appendChild(el);
    });
  }

  function reset(root) { mount(root); }
  return { mount, reset, isComplete: () => claimBtn.disabled === false };
}

// ---- Placeholder for remaining activities ----
function placeholderGame(title) {
  function mount(root) {
    root.innerHTML = `
      <div class="gameTitle">${title}</div>
      <div class="small">This activity is scaffolded. Want me to implement this one next?</div>
      <div class="sep"></div>
      <div class="center" style="padding:24px 0; flex-direction:column; gap:12px">
        <div class="big">🦄🌈</div>
        <div style="font-weight:800; text-align:center">Pick which activity you want here (escape room, logic grid, pet salon, mosaic…)</div>
        <div class="small">For now, tap “Claim Crystal” to continue testing the flow.</div>
      </div>
    `;
    setClaimEnabled(true, "Demo mode: claim enabled.");
  }
  function reset(root){ mount(root); }
  return { mount, reset, isComplete: () => true };
}

// ---------- Wiring ----------
soundBtn.addEventListener("click", () => {
  state.soundOn = !state.soundOn;
  saveState();
  updateTop();
});

vaultBtn.addEventListener("click", openVault);
vaultBackBtn.addEventListener("click", goHome);

backBtn.addEventListener("click", goHome);

resetBtn.addEventListener("click", () => {
  showModal("Reset?", `<div>This clears all progress on this device.</div>`, [
    { label: "Cancel", primary: false, onClick: () => {} },
    { label: "Reset", primary: true, onClick: () => { state = defaultState(); saveState(); updateTop(); renderDoors(); } },
  ]);
});

restartBtn.addEventListener("click", () => {
  if (!currentGame || !currentDay) return;
  claimBtn.disabled = true;
  stageBody.innerHTML = "";
  const def = DAYS[currentDay - 1];
  currentGame = buildActivity(def);
  currentGame.mount(stageBody);
});

claimBtn.addEventListener("click", () => {
  if (!currentDay) return;
  claimCrystal();
});

modalOkBtn.addEventListener("click", hideModal);
modalBackdrop.addEventListener("click", hideModal);

// ─── Birthday Celebration (Day 17) ───────────────────────────────────────────

function playBirthdaySong() {
  if (!state.soundOn) return;
  const ctx = getAudioCtx();
  const BEAT = 60 / 126; // tempo

  // Happy Birthday in G: [freq_Hz, duration_beats]
  const S = 0; // rest
  const song = [
    [392,  .75],[392,  .25],[440, 1],[392, 1],[523.25, 1],[493.88, 2],[S, .5],
    [392,  .75],[392,  .25],[440, 1],[392, 1],[587.33, 1],[523.25, 2],[S, .5],
    [392,  .75],[392,  .25],[783.99,1],[659.25,1],[523.25,1],[493.88,1],[440,2],[S,.5],
    [698.46,.75],[698.46,.25],[659.25,1],[523.25,1],[587.33,1],[523.25,2.5],
  ];

  let t = ctx.currentTime + 0.05;
  song.forEach(([freq, beats]) => {
    const dur = beats * BEAT;
    if (freq > 0) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.07, t + 0.03);
      g.gain.setValueAtTime(0.07, t + dur - 0.06);
      g.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + dur);
    }
    t += dur;
  });
}

function startFireworks(overlay) {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;";
  overlay.insertBefore(canvas, overlay.firstChild);
  canvas.width  = overlay.clientWidth  || 375;
  canvas.height = overlay.clientHeight || 780;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;

  const COLORS = ["#FF6EB4","#FFB347","#FFE066","#A8E6CF","#A2D2FF","#fff","#C3B1E1","#FF8A80","#C060D8","#7EE8A2"];

  class Rocket {
    constructor() {
      this.x  = W * (0.1 + Math.random() * 0.8);
      this.y  = H;
      this.tx = W * (0.1 + Math.random() * 0.8);
      this.ty = H * (0.06 + Math.random() * 0.44);
      const ang = Math.atan2(this.ty - this.y, this.tx - this.x);
      const sp  = 9 + Math.random() * 5;
      this.vx   = Math.cos(ang) * sp;
      this.vy   = Math.sin(ang) * sp;
      this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
      this.done  = false;
    }
    update() {
      this.x += this.vx; this.y += this.vy;
      if (Math.hypot(this.x - this.tx, this.y - this.ty) < 15) { this.burst(); this.done = true; }
    }
    burst() {
      const count = 55 + Math.floor(Math.random() * 30);
      for (let i = 0; i < count; i++) sparks.push(new Spark(this.x, this.y, this.color));
    }
    draw() {
      ctx.beginPath(); ctx.arc(this.x, this.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = this.color; ctx.fill();
    }
  }

  class Spark {
    constructor(x, y, color) {
      this.x = x; this.y = y;
      const a = Math.random() * Math.PI * 2;
      const s = 1.5 + Math.random() * 5.5;
      this.vx = Math.cos(a) * s; this.vy = Math.sin(a) * s;
      this.alpha = 1;
      this.decay = 0.011 + Math.random() * 0.016;
      this.r     = 1 + Math.random() * 2.5;
      this.color = Math.random() < 0.28 ? COLORS[Math.floor(Math.random() * COLORS.length)] : color;
    }
    update() {
      this.vy += 0.09;
      this.vx *= 0.97; this.vy *= 0.97;
      this.x += this.vx; this.y += this.vy;
      this.alpha -= this.decay;
    }
    draw() {
      ctx.globalAlpha = Math.max(0, this.alpha);
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = this.color; ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  const rockets = [], sparks = [];
  let rafId, lastLaunch = 0;

  function frame(ts) {
    ctx.clearRect(0, 0, W, H);
    if (ts - lastLaunch > 520) {
      rockets.push(new Rocket());
      if (Math.random() < 0.45) rockets.push(new Rocket());
      lastLaunch = ts;
    }
    for (let i = rockets.length - 1; i >= 0; i--) {
      rockets[i].update(); rockets[i].draw();
      if (rockets[i].done) rockets.splice(i, 1);
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      sparks[i].update(); sparks[i].draw();
      if (sparks[i].alpha <= 0) sparks.splice(i, 1);
    }
    rafId = requestAnimationFrame(frame);
  }
  rafId = requestAnimationFrame(frame);
  return () => { cancelAnimationFrame(rafId); };
}

function showBirthdayCelebration(def) {
  playBirthdaySong();

  // Massive multi-wave confetti
  [0, 350, 750, 1400, 2200, 3200].forEach(d => setTimeout(triggerConfetti, d));

  const floaterSymbols = ["🦄","🌈","⭐","💖","✨","🎀","🎊","🍭","🎈","🌟","🎂","💎","🎁","🧁","🫧"];

  const wish = "Officially leveled up to 7. The world has no idea what's coming. 🦄";

  const overlay = document.createElement("div");
  overlay.id = "birthdayOverlay";
  overlay.innerHTML = `
    <div class="bd-floaters" id="bdFloaters"></div>
    <div class="bd-content">
      <div class="bd-cake">🎂</div>
      <div class="bd-title">🎉 Happy Birthday!</div>
      <div class="bd-name">Ariana</div>
      <div class="bd-sub">${wish}</div>
      <button class="bd-btn" id="bdBtn">I'm Amazing! 🌟</button>
    </div>
  `;
  document.body.appendChild(overlay);
  const stopFireworks = startFireworks(overlay);

  // Scatter floating emojis around the overlay
  const container = document.getElementById("bdFloaters");
  for (let i = 0; i < 16; i++) {
    const el = document.createElement("div");
    el.className = "bd-floater";
    el.textContent = floaterSymbols[i % floaterSymbols.length];
    el.style.cssText = [
      `left:${randInt(2, 92)}%`,
      `top:${randInt(2, 88)}%`,
      `font-size:${randInt(18, 38)}px`,
      `animation-delay:-${randInt(0, 300)/100}s`,
      `animation-duration:${randInt(220, 420)/100}s`,
    ].join(";");
    container.appendChild(el);
  }

  document.getElementById("bdBtn").addEventListener("click", () => {
    stopFireworks();
    overlay.style.animation = "bdOut .4s ease both";
    setTimeout(() => {
      overlay.remove();
      // Show gift reveal after birthday screen
      const gift = GIFT_CARDS[def.type];
      if (gift) {
        const rewardBody = gift.isFinale ? `
          <img src="rosalina.png" alt="Rosalina" style="width:100%;max-width:220px;display:block;margin:6px auto 4px;border-radius:16px;"/>
          <div style="font-weight:900; font-size:16px; text-align:center; color:#7eceed; margin:4px 0 3px; letter-spacing:.3px; text-shadow:0 0 10px #7eceed66;">⭐ Rosalina's Cosmic Gift! 🌟</div>
          <div style="font-weight:800; font-size:13px; text-align:center; line-height:1.7; color:#1a1060;">
            The stars led you here, little one!<br>Your legendary surprise is waiting...<br>Ask your mom to redeem the gift 🎁
          </div>
        ` : gift.isSurprise ? `
          <svg viewBox="0 0 200 155" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:230px;display:block;margin:6px auto 4px;">
            <defs><linearGradient id="mBg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6ab4f0"/><stop offset="100%" stop-color="#b8e0f8"/></linearGradient></defs>
            <rect width="200" height="155" fill="url(#mBg2)" rx="16"/>
            <rect x="0" y="133" width="200" height="22" fill="#5ab552"/><rect x="0" y="141" width="200" height="14" fill="#3d8b40"/>
            <ellipse cx="20" cy="133" rx="12" ry="4" fill="#6dc95c"/><ellipse cx="60" cy="133" rx="10" ry="3" fill="#6dc95c"/><ellipse cx="140" cy="133" rx="10" ry="3" fill="#6dc95c"/><ellipse cx="182" cy="133" rx="12" ry="4" fill="#6dc95c"/>
            <rect x="14" y="55" width="24" height="24" fill="#e8a000" rx="3"/><rect x="14" y="55" width="24" height="24" fill="none" stroke="#c47800" stroke-width="1.5" rx="3"/>
            <text x="26" y="72" font-size="13" fill="#fff" text-anchor="middle" font-weight="900" font-family="Arial">?</text>
            <circle cx="170" cy="63" r="11" fill="#ffd700"/><circle cx="170" cy="63" r="8" fill="#e6a800"/><circle cx="170" cy="63" r="5" fill="#ffcc00"/>
            <text x="6" y="40" font-size="16" opacity=".9">⭐</text><text x="166" y="42" font-size="15" opacity=".9">🍄</text>
            <rect x="28" y="52" width="22" height="72" rx="10" fill="#e4000f"/><rect x="28" y="52" width="22" height="72" rx="10" fill="none" stroke="#b80010" stroke-width="1.2"/>
            <circle cx="39" cy="67" r="6.5" fill="#c00010"/><circle cx="39" cy="67" r="4.5" fill="#a00010"/>
            <rect x="34" y="81" width="10" height="3" rx="1.5" fill="#b80010"/>
            <rect x="48" y="58" width="3" height="6" rx="1.5" fill="#cc0015"/><rect x="48" y="68" width="3" height="6" rx="1.5" fill="#cc0015"/>
            <rect x="34" y="88" width="10" height="3.5" rx="1.5" fill="#b80010"/><rect x="37.5" y="85" width="3.5" height="9.5" rx="1.5" fill="#b80010"/>
            <rect x="50" y="47" width="100" height="82" fill="#2c2c2c" rx="5"/>
            <rect x="54" y="52" width="92" height="72" fill="#141414" rx="3"/>
            <rect x="57" y="55" width="86" height="66" fill="#5c94fc" rx="2"/>
            <rect x="62" y="60" width="20" height="10" fill="#fff" rx="5" opacity=".9"/><rect x="65" y="57" width="14" height="10" fill="#fff" rx="5" opacity=".9"/>
            <rect x="118" y="63" width="18" height="8" fill="#fff" rx="4" opacity=".9"/><rect x="120" y="61" width="12" height="8" fill="#fff" rx="4" opacity=".9"/>
            <rect x="57" y="107" width="86" height="14" fill="#5ab552"/><rect x="57" y="113" width="86" height="8" fill="#3d8b40"/>
            <rect x="62" y="93" width="12" height="12" fill="#c84c0c" rx="1"/>
            <rect x="76" y="93" width="12" height="12" fill="#e8a000" rx="1"/>
            <text x="82" y="103" font-size="8" fill="#fff" text-anchor="middle" font-weight="bold" font-family="Arial">?</text>
            <rect x="90" y="93" width="12" height="12" fill="#c84c0c" rx="1"/>
            <circle cx="82" cy="80" r="4" fill="#ffd700"/>
            <rect x="117" y="69" width="12" height="5" fill="#e4000f" rx="1"/>
            <rect x="115" y="73" width="16" height="3.5" fill="#e4000f" rx="1"/>
            <rect x="115" y="76" width="4" height="3" fill="#6b3a1f"/>
            <rect x="115" y="76.5" width="16" height="7" fill="#ffb347" rx="1.5"/>
            <rect x="116" y="83" width="14" height="9" fill="#1a3fff" rx="1"/>
            <rect x="113" y="85" width="4" height="7" fill="#e4000f"/><rect x="127" y="85" width="4" height="7" fill="#e4000f"/>
            <circle cx="120" cy="85.5" r="1.5" fill="#fff8"/><circle cx="126" cy="85.5" r="1.5" fill="#fff8"/>
            <rect x="115" y="92" width="6" height="9" fill="#1a3fff"/><rect x="125" y="92" width="6" height="9" fill="#1a3fff"/>
            <rect x="113" y="101" width="8" height="6" fill="#5c3010" rx="1"/><rect x="123" y="101" width="8" height="6" fill="#5c3010" rx="1"/>
            <rect x="150" y="52" width="22" height="72" rx="10" fill="#0048c8"/><rect x="150" y="52" width="22" height="72" rx="10" fill="none" stroke="#0030a0" stroke-width="1.2"/>
            <rect x="149" y="58" width="3" height="6" rx="1.5" fill="#0038b0"/><rect x="149" y="68" width="3" height="6" rx="1.5" fill="#0038b0"/>
            <circle cx="161" cy="67" r="4" fill="#0044cc"/><text x="161" y="70" font-size="6" fill="#fff" text-anchor="middle" font-weight="bold">X</text>
            <circle cx="169" cy="75" r="4" fill="#dd0000"/><text x="169" y="78" font-size="6" fill="#fff" text-anchor="middle" font-weight="bold">A</text>
            <circle cx="161" cy="83" r="4" fill="#e8a000"/><text x="161" y="86" font-size="6" fill="#fff" text-anchor="middle" font-weight="bold">B</text>
            <circle cx="153" cy="75" r="4" fill="#00aa44"/><text x="153" y="78" font-size="6" fill="#fff" text-anchor="middle" font-weight="bold">Y</text>
            <rect x="155" y="59" width="10" height="3" rx="1.5" fill="#0030a8"/><rect x="158.5" y="56.5" width="3" height="8" rx="1.5" fill="#0030a8"/>
            <circle cx="161" cy="100" r="6.5" fill="#0030a8"/><circle cx="161" cy="100" r="4.5" fill="#0020a0"/>
            <text x="100" y="148" font-size="7.5" fill="white" text-anchor="middle" font-weight="bold" opacity=".85" letter-spacing=".5">LET'S-A GO! 🍄</text>
          </svg>
          <div style="font-weight:900; font-size:16px; text-align:center; color:#e4000f; margin:2px 0 3px; letter-spacing:.3px;">🍄 Super Star Surprise! ⭐</div>
          <div style="font-weight:800; font-size:13px; text-align:center; line-height:1.7; color:#1a1a60;">
            Wahoo! Something legendary is waiting for you...<br>Ask your sister and baba 🎁
          </div>
        ` : `
          <div><b>🎁 Bonus Reward:</b> ${gift.label}</div>
          <div style="margin-top:10px; background:#fff0fa; border:1.5px solid rgba(192,96,216,.2); border-radius:14px; padding:12px; text-align:center;">
            <div style="font-size:22px">💌</div>
            <div style="font-weight:900; margin-top:4px">Ask your mom to help redeem this!</div>
          </div>
        `;
        showModal("🎉 Achievement Unlocked!", `
          <div><b>${def.crystalName}</b> 💎</div>
          <div style="margin-top:8px">${def.affirm}</div>
          <div class="sep"></div>
          ${rewardBody}
        `, [
          { label: "🏠 Back Home", primary: true, onClick: () => goHome() }
        ]);
      } else {
        goHome();
      }
    }, 420);
  });
}

// ─── Visual FX ───────────────────────────────────────────────────────────────

function createSparkles() {
  const symbols = ["✦", "✧", "⋆", "✦", "⭐", "✧", "✦", "·", "✦"];
  const colors  = ["#FF6EB4","#C060D8","#FFB347","#A2D2FF","#A8E6CF","#FFE066"];
  for (let i = 0; i < 12; i++) {
    const el = document.createElement("div");
    el.className = "sparkle-particle";
    el.textContent = randPick(symbols);
    el.style.cssText = [
      `left:${randInt(2,94)}%`,
      `bottom:-10px`,
      `font-size:${randInt(10,20)}px`,
      `color:${randPick(colors)}`,
      `opacity:${randInt(18,45)/100}`,
      `animation-duration:${randInt(10,22)}s`,
      `animation-delay:-${randInt(0,14)}s`,
    ].join(";");
    document.body.appendChild(el);
  }
}

function triggerConfetti() {
  const colors = ["#FF6EB4","#FFB347","#FFE066","#A8E6CF","#A2D2FF","#C3B1E1","#FF8A80","#C060D8"];
  const originX = 50; // % from left
  const originY = 35; // % from top
  for (let i = 0; i < 55; i++) {
    const el = document.createElement("div");
    el.className = "confetti-piece";
    const size = randInt(6, 11);
    el.style.cssText = [
      `left:${randInt(originX - 28, originX + 28)}%`,
      `top:${randInt(originY - 10, originY + 10)}%`,
      `width:${size}px`,
      `height:${randInt(6, size + 4)}px`,
      `background:${randPick(colors)}`,
      `animation-duration:${(randInt(9,15)/10)}s`,
      `animation-delay:${(randInt(0,5)/10)}s`,
      `border-radius:${randInt(0,1) ? "50%" : "3px"}`,
      `transform:rotate(${randInt(0,360)}deg)`,
    ].join(";");
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  }
}

function pillPopAnim() {
  progressPill.classList.remove("pill--pop");
  void progressPill.offsetWidth; // reflow to restart
  progressPill.classList.add("pill--pop");
  setTimeout(() => progressPill.classList.remove("pill--pop"), 450);
}

// Initial
createSparkles();
updateTop();
renderDoors();
setView("home");

// ---------- utilities ----------
function randPick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function shuffle(arr){
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
function unique(arr){ return Array.from(new Set(arr)); }
function pickN(arr, n){
  const s=shuffle(arr);
  return s.slice(0,n);
}
function sleep(ms){ return new Promise(res=>setTimeout(res, ms)); }
