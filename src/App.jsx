import React, { useState, useEffect, useRef, useMemo } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
  getDatabase,
  ref,
  set,
  onValue,
  push,
  onDisconnect,
  remove,
  update,
} from "firebase/database";
import {
  Users,
  Swords,
  MessageCircle,
  Send,
  X,
  Check,
  Bot,
  Trophy,
  RotateCcw,
  LogOut,
  Gamepad2,
  Sparkles,
  CircleDot,
  Grid,
  Ship,
  Hash,
  Type,
  ChevronDown,
  ChevronUp,
  Bell,
} from "lucide-react";

const FIREBASE_CONFIG =
  typeof window !== "undefined" && window.__FIREBASE_CONFIG__
    ? window.__FIREBASE_CONFIG__
    : null;

const MESSAGE_TTL_MS = 60 * 60 * 1000; // 1 saat

const GAMES_META = [
  { id: "battleship", name: "Amiral Battı", desc: "6x6 hızlı deniz savaşı", badge: "Strateji", icon: Ship },
  { id: "rps", name: "Taş Kağıt Makas", desc: "5 turluk düello", badge: "5 Tur", icon: Swords },
  { id: "ttt", name: "Tic Tac Toe", desc: "3x3 sıra tabanlı XOX", badge: "Klasik", icon: Hash },
  { id: "wordle", name: "Kelime Bulma", desc: "5 harfli Türkçe kelime yarışı", badge: "Kelime", icon: Type },
  { id: "sudoku", name: "Sudoku", desc: "4x4 mini sudoku hız yarışı", badge: "Zeka", icon: Grid },
];

const RPS_TOTAL_ROUNDS = 5;

const RPS_CHOICES = [
  { id: "rock", emoji: "🪨", label: "Taş" },
  { id: "paper", emoji: "📄", label: "Kağıt" },
  { id: "scissors", emoji: "✂️", label: "Makas" },
];

const FINAL_WORDS = [
  "KALEM", "KİTAP", "DENİZ", "BULUT", "MASAL", "BAHÇE", "ŞEHİR", "MÜZİK",
  "SABAH", "ORMAN", "LİMAN", "SAHİL", "KAVUN", "BARIŞ", "MARTI", "DALGA",
  "RADYO", "MELEK", "TARLA", "GÜNEŞ",
];

const SUDOKU_PUZZLES = [
  {
    puzzle: [
      [1, 0, 0, 4],
      [0, 0, 1, 0],
      [0, 4, 0, 0],
      [2, 0, 0, 3],
    ],
    solution: [
      [1, 2, 3, 4],
      [4, 3, 1, 2],
      [3, 4, 2, 1],
      [2, 1, 4, 3],
    ],
  },
  {
    puzzle: [
      [0, 3, 0, 1],
      [2, 0, 0, 0],
      [0, 0, 0, 3],
      [4, 0, 2, 0],
    ],
    solution: [
      [4, 3, 2, 1],
      [2, 1, 3, 4],
      [1, 2, 4, 3],
      [3, 4, 1, 2],
    ],
  },
];

const QUICK_REPLIES = ["İyi hamle! 👏", "Şanslıydın 😄", "Çok yakındı! 🔥", "Rövanş? 🔄"];
const EMOJIS = ["👏", "😂", "🔥", "😱", "🤔", "👑"];

function isWithinOneHour(ts, nowMs = Date.now()) {
  const numericTs = Number(ts || 0);
  if (!numericTs) return false;
  return nowMs - numericTs < MESSAGE_TTL_MS;
}

function createEmptyGrid(size = 6) {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

function autoPlaceShips(size = 6) {
  const grid = createEmptyGrid(size);
  const shipLengths = [3, 2, 2];
  for (const len of shipLengths) {
    let placed = false;
    let safety = 0;
    while (!placed && safety < 200) {
      safety++;
      const horizontal = Math.random() > 0.5;
      const r = Math.floor(Math.random() * (horizontal ? size : size - len + 1));
      const c = Math.floor(Math.random() * (horizontal ? size - len + 1 : size));
      let fits = true;
      for (let i = 0; i < len; i++) {
        const nr = r + (horizontal ? 0 : i);
        const nc = c + (horizontal ? i : 0);
        if (grid[nr][nc] !== 0) {
          fits = false;
          break;
        }
      }
      if (fits) {
        for (let i = 0; i < len; i++) {
          const nr = r + (horizontal ? 0 : i);
          const nc = c + (horizontal ? i : 0);
          grid[nr][nc] = 1;
        }
        placed = true;
      }
    }
  }
  return grid;
}

function countShipCells(grid) {
  if (!Array.isArray(grid)) return 0;
  return grid.reduce(
    (sum, row) => sum + row.reduce((s, cell) => s + (cell === 1 ? 1 : 0), 0),
    0
  );
}

function countHitsOnGrid(shotsGrid) {
  if (!Array.isArray(shotsGrid)) return 0;
  return shotsGrid.reduce(
    (sum, row) => sum + row.reduce((s, cell) => s + (cell === 2 ? 1 : 0), 0),
    0
  );
}

function getBotChatReply(text, gameType) {
  const lower = (text || "").toLocaleLowerCase("tr");
  if (lower.includes("rövanş") || lower.includes("tekrar")) return "Hemen bir rövanş daha atalım, hazırım! 🔥";
  if (lower.includes("şans") || lower.includes("nasıl")) return "Tamamen hesaplanmış strateji 😄";
  if (gameType === "battleship") return "Radarlarım açık, gemilerim sağlam! 🚢";
  if (gameType === "wordle") return "Harfleri iyi analiz et, 5 harf seni bekliyor! 🔤";
  if (gameType === "sudoku") return "Satır ve sütunlara dikkat, hızlanıyorum! 🧠";
  return "Güzel gidiyor, bakalım kim kazanacak! 👏";
}

function checkTTTWinner(board) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: [a, b, c] };
    }
  }
  if (board.every((cell) => Boolean(cell))) return { winner: "draw", line: [] };
  return null;
}

function evaluateWordleGuess(guess, target) {
  const res = Array(5).fill("absent");
  const targetArr = Array.from(target);
  const guessArr = Array.from(guess);
  const used = Array(5).fill(false);

  for (let i = 0; i < 5; i++) {
    if (guessArr[i] === targetArr[i]) {
      res[i] = "correct";
      used[i] = true;
    }
  }
  for (let i = 0; i < 5; i++) {
    if (res[i] === "correct") continue;
    for (let j = 0; j < 5; j++) {
      if (!used[j] && guessArr[i] === targetArr[j]) {
        res[i] = "present";
        used[j] = true;
        break;
      }
    }
  }
  return res;
}

function hasSudokuConflict(board, r, c, val) {
  if (!val) return false;
  for (let i = 0; i < 4; i++) {
    if (i !== c && board[r][i] === val) return true;
    if (i !== r && board[i][c] === val) return true;
  }
  const br = Math.floor(r / 2) * 2;
  const bc = Math.floor(c / 2) * 2;
  for (let i = br; i < br + 2; i++) {
    for (let j = bc; j < bc + 2; j++) {
      if ((i !== r || j !== c) && board[i][j] === val) return true;
    }
  }
  return false;
}

function getRPSLabel(choice) {
  if (choice === "rock") return "Taş";
  if (choice === "paper") return "Kağıt";
  if (choice === "scissors") return "Makas";
  return "-";
}

function getRPSEmoji(choice) {
  if (choice === "rock") return "🪨";
  if (choice === "paper") return "📄";
  if (choice === "scissors") return "✂️";
  return "❔";
}

function evaluateRPSRound(p1Pick, p2Pick) {
  if (!p1Pick || !p2Pick) return "draw";
  if (p1Pick === p2Pick) return "draw";
  if (
    (p1Pick === "rock" && p2Pick === "scissors") ||
    (p1Pick === "paper" && p2Pick === "rock") ||
    (p1Pick === "scissors" && p2Pick === "paper")
  ) {
    return "p1";
  }
  return "p2";
}

export default function App() {
  const [nickname, setNickname] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("duello_nickname") || "";
  });
  const [enteredLobby, setEnteredLobby] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("duello_entered_lobby") === "1";
  });
  const [myId] = useState(() => {
    if (typeof window === "undefined") return "usr_guest";
    const existing = window.localStorage.getItem("duello_my_id");
    if (existing) return existing;
    const created = "usr_" + Math.random().toString(36).slice(2, 9);
    window.localStorage.setItem("duello_my_id", created);
    return created;
  });

  const [myWins, setMyWins] = useState(() => {
    if (typeof window === "undefined") return 0;
    const raw = Number(window.localStorage.getItem("duello_my_wins") || "0");
    return Number.isFinite(raw) && raw >= 0 ? raw : 0;
  });

  const [users, setUsers] = useState([]);
  const [incomingInvite, setIncomingInvite] = useState(null);
  const [outgoingInvite, setOutgoingInvite] = useState(null);
  const [noticeBanner, setNoticeBanner] = useState(null);
  const [selectedTargetUser, setSelectedTargetUser] = useState(null);
  const [selectedGameForInvite, setSelectedGameForInvite] = useState("rps");

  const [globalChatOpen, setGlobalChatOpen] = useState(true);
  const [globalMessages, setGlobalMessages] = useState([
    {
      id: "m_init_1",
      senderId: "sys",
      senderName: "Arena Botu",
      text: "Düello Arenası'na hoş geldin! Sohbet mesajları 1 saat sonra otomatik silinir.",
      ts: Date.now() - 10000,
    },
  ]);
  const [globalInput, setGlobalInput] = useState("");
  const [globalUnread, setGlobalUnread] = useState(0);

  const [dmTarget, setDmTarget] = useState(null);
  const [dmMessagesByPeer, setDmMessagesByPeer] = useState({});
  const [dmUnreadByPeer, setDmUnreadByPeer] = useState({});
  const [dmInput, setDmInput] = useState("");
  const [incomingDm, setIncomingDm] = useState(null);

  const [matchDrawerOpen, setMatchDrawerOpen] = useState(false);
  const [matchMessages, setMatchMessages] = useState([]);
  const [matchInput, setMatchInput] = useState("");
  const [matchUnread, setMatchUnread] = useState(0);
  const [floatingReaction, setFloatingReaction] = useState(null);

  const [activeMatch, setActiveMatch] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = window.localStorage.getItem("duello_active_match");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Amiral Battı state
  const [myShipGrid, setMyShipGrid] = useState(() => autoPlaceShips(6));
  const [myShotsOnEnemy, setMyShotsOnEnemy] = useState(() => createEmptyGrid(6));
  const [enemyGridForBot, setEnemyGridForBot] = useState(() => autoPlaceShips(6));
  const [enemyShotsOnMe, setEnemyShotsOnMe] = useState(() => createEmptyGrid(6));
  const [bsTurn, setBsTurn] = useState("me");
  const [bsStatus, setBsStatus] = useState("Sıra sende! Düşman denizinde bir kare seç.");
  const [bsWinner, setBsWinner] = useState(null);

  // Taş Kağıt Makas state
  const [rpsRound, setRpsRound] = useState(1);
  const [rpsMyScore, setRpsMyScore] = useState(0);
  const [rpsOppScore, setRpsOppScore] = useState(0);
  const [rpsMyPick, setRpsMyPick] = useState(null);
  const [rpsOppPick, setRpsOppPick] = useState(null);
  const [rpsLastShownMyPick, setRpsLastShownMyPick] = useState(null);
  const [rpsLastShownOppPick, setRpsLastShownOppPick] = useState(null);
  const [rpsPhase, setRpsPhase] = useState("picking");
  const [rpsRoundText, setRpsRoundText] = useState(`1/${RPS_TOTAL_ROUNDS}. Tur: Seçimini yap!`);
  const [rpsMatchWinner, setRpsMatchWinner] = useState(null);
  const [rpsHistory, setRpsHistory] = useState([]);

  // Tic Tac Toe state
  const [tttBoard, setTttBoard] = useState(Array(9).fill(""));
  const [tttTurn, setTttTurn] = useState("X");
  const [tttResult, setTttResult] = useState(null);

  // Kelime Bulma state
  const [wordTarget, setWordTarget] = useState(
    () => FINAL_WORDS[Math.floor(Math.random() * FINAL_WORDS.length)]
  );
  const [wordGuesses, setWordGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [wordStatus, setWordStatus] = useState("5 harfli kelimeyi bulmak için tahmin gir!");
  const [wordFinished, setWordFinished] = useState(false);
  const [oppWordProgress, setOppWordProgress] = useState(0);

  // Sudoku state
  const [sudokuIndex, setSudokuIndex] = useState(0);
  const [sudokuBoard, setSudokuBoard] = useState(() =>
    SUDOKU_PUZZLES[0].puzzle.map((r) => [...r])
  );
  const [selectedCell, setSelectedCell] = useState([0, 1]);
  const [sudokuMessage, setSudokuMessage] = useState("Boş kareye 1-4 arası rakam yerleştir.");
  const [sudokuWinner, setSudokuWinner] = useState(null);
  const [oppSudokuProgress, setOppSudokuProgress] = useState(0);

  const dbRef = useRef(null);
  const acceptedHandledRef = useRef(false);
  const rpsTimerRef = useRef(null);
  const botBsTimerRef = useRef(null);
  const botTttTimerRef = useRef(null);
  const botWordTimerRef = useRef(null);
  const botSudokuTimerRef = useRef(null);
  const processedLiveRoundRef = useRef(0);
  const awardedMatchIdRef = useRef(null);
  const leftNoticeShownRef = useRef(false);
  const myStatus = activeMatch ? "in_game" : "online";

  function clearAllGameTimers() {
    if (rpsTimerRef.current) {
      clearTimeout(rpsTimerRef.current);
      rpsTimerRef.current = null;
    }
    if (botBsTimerRef.current) {
      clearTimeout(botBsTimerRef.current);
      botBsTimerRef.current = null;
    }
    if (botTttTimerRef.current) {
      clearTimeout(botTttTimerRef.current);
      botTttTimerRef.current = null;
    }
    if (botWordTimerRef.current) {
      clearTimeout(botWordTimerRef.current);
      botWordTimerRef.current = null;
    }
    if (botSudokuTimerRef.current) {
      clearTimeout(botSudokuTimerRef.current);
      botSudokuTimerRef.current = null;
    }
  }

  function showNotice(title, text) {
    setNoticeBanner({ title, text, ts: Date.now() });
  }

  function awardWinPoint(matchKey) {
    if (!matchKey || awardedMatchIdRef.current === matchKey) return;
    awardedMatchIdRef.current = matchKey;
    setMyWins((prev) => {
      const next = prev + 1;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("duello_my_wins", String(next));
      }
      if (dbRef.current) {
        update(ref(dbRef.current, `users/${myId}`), { wins: next });
      }
      return next;
    });
  }

  useEffect(() => {
    return () => clearAllGameTimers();
  }, []);

  // 1 saatlik sohbet mesajlarını periyodik temizleme
  useEffect(() => {
    const pruneExpiredMessages = () => {
      const nowMs = Date.now();
      setGlobalMessages((prev) =>
        prev.filter((m) => m.senderId === "sys" || isWithinOneHour(m.ts, nowMs))
      );
      setDmMessagesByPeer((prev) => {
        const nextMap = {};
        for (const [peerId, list] of Object.entries(prev)) {
          nextMap[peerId] = (list || []).filter((m) => isWithinOneHour(m.ts, nowMs));
        }
        return nextMap;
      });
      setIncomingDm((prev) => (prev && isWithinOneHour(prev.ts, nowMs) ? prev : null));

      if (dbRef.current) {
        onValue(
          ref(dbRef.current, "chats/global"),
          (snap) => {
            const val = snap.val() || {};
            for (const [key, msg] of Object.entries(val)) {
              if (!isWithinOneHour(msg?.ts, nowMs)) {
                remove(ref(dbRef.current, `chats/global/${key}`));
              }
            }
          },
          { onlyOnce: true }
        );
      }
    };

    pruneExpiredMessages();
    const interval = setInterval(pruneExpiredMessages, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("duello_nickname", nickname);
    window.localStorage.setItem("duello_entered_lobby", enteredLobby ? "1" : "0");
  }, [nickname, enteredLobby]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (activeMatch) {
      window.localStorage.setItem("duello_active_match", JSON.stringify(activeMatch));
    } else {
      window.localStorage.removeItem("duello_active_match");
    }
  }, [activeMatch]);

  useEffect(() => {
    if (!FIREBASE_CONFIG || !FIREBASE_CONFIG.databaseURL) return;
    try {
      const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
      dbRef.current = getDatabase(app);
    } catch (err) {
      console.error("Firebase başlatılamadı:", err);
    }
  }, []);

  useEffect(() => {
    if (!enteredLobby) return;
    const cleanName = nickname.trim() || "Oyuncu";

    if (dbRef.current) {
      const userRef = ref(dbRef.current, `users/${myId}`);
      set(userRef, {
        id: myId,
        name: cleanName,
        status: myStatus,
        wins: myWins,
        updatedAt: Date.now(),
      });
      onDisconnect(userRef).remove();

      const unsubUsers = onValue(ref(dbRef.current, "users"), (snap) => {
        const val = snap.val() || {};
        setUsers(Object.values(val).filter((u) => u && u.id !== myId));
      });

      const unsubInvite = onValue(ref(dbRef.current, `invites/${myId}`), (snap) => {
        const val = snap.val();
        if (val && val.status === "pending") setIncomingInvite(val);
        else setIncomingInvite(null);
      });

      const unsubGlobal = onValue(ref(dbRef.current, "chats/global"), (snap) => {
        const val = snap.val() || {};
        const nowMs = Date.now();
        const validEntries = Object.entries(val).filter(([, m]) => isWithinOneHour(m?.ts, nowMs));
        for (const [key, m] of Object.entries(val)) {
          if (!isWithinOneHour(m?.ts, nowMs)) {
            remove(ref(dbRef.current, `chats/global/${key}`));
          }
        }
        const arr = validEntries.map(([, m]) => m).sort((a, b) => (a.ts || 0) - (b.ts || 0));
        if (arr.length > 0) {
          setGlobalMessages(arr.slice(-50));
          const last = arr[arr.length - 1];
          if (last && last.senderId !== myId && !globalChatOpen) {
            setGlobalUnread((c) => c + 1);
          }
        }
      });

      return () => {
        unsubUsers();
        unsubInvite();
        unsubGlobal();
      };
    } else {
      setUsers([
        { id: "demo_alice", name: "Zeynep", status: "online", wins: 4 },
        { id: "demo_mert", name: "Mert", status: "online", wins: 2 },
        { id: "demo_eda", name: "Eda", status: "in_game", wins: 6 },
      ]);
    }
  }, [enteredLobby, nickname, myId, myStatus, myWins, globalChatOpen]);

  useEffect(() => {
    if (!dbRef.current || !enteredLobby || users.length === 0) return;

    const unsubs = users.map((peer) => {
      if (!peer || !peer.id) return () => {};
      const threadId = [myId, peer.id].sort().join("__");
      const dmRef = ref(dbRef.current, `chats/dm/${threadId}`);
      let initialized = false;

      return onValue(dmRef, (snap) => {
        const val = snap.val() || {};
        const nowMs = Date.now();
        const validPairs = Object.entries(val).filter(([, m]) => isWithinOneHour(m?.ts, nowMs));
        for (const [key, m] of Object.entries(val)) {
          if (!isWithinOneHour(m?.ts, nowMs)) {
            remove(ref(dbRef.current, `chats/dm/${threadId}/${key}`));
          }
        }

        const arr = validPairs.map(([, m]) => m).sort((a, b) => (a.ts || 0) - (b.ts || 0));

        if (!initialized) {
          initialized = true;
          setDmMessagesByPeer((prev) => ({
            ...prev,
            [peer.id]: arr.slice(-60),
          }));
          return;
        }

        setDmMessagesByPeer((prev) => {
          const oldArr = prev[peer.id] || [];
          const oldLastTs = oldArr.length ? oldArr[oldArr.length - 1]?.ts || 0 : 0;
          const newIncoming = arr.filter(
            (m) => m && m.senderId !== myId && (m.ts || 0) > oldLastTs
          );

          if (newIncoming.length > 0) {
            const latest = newIncoming[newIncoming.length - 1];
            const isViewingThisThread = dmTarget && dmTarget.id === peer.id;

            if (!isViewingThisThread) {
              setDmUnreadByPeer((uPrev) => ({
                ...uPrev,
                [peer.id]: (uPrev[peer.id] || 0) + newIncoming.length,
              }));
              setIncomingDm({
                peer: { id: peer.id, name: latest.senderName || peer.name },
                text: latest.text,
                ts: latest.ts || Date.now(),
              });
            }
          }

          return {
            ...prev,
            [peer.id]: arr.slice(-60),
          };
        });
      });
    });

    return () => {
      unsubs.forEach((fn) => fn && fn());
    };
  }, [enteredLobby, users, myId, dmTarget]);

  useEffect(() => {
    if (!dbRef.current || !enteredLobby || !dmTarget) return;
    const threadId = [myId, dmTarget.id].sort().join("__");
    const dmRef = ref(dbRef.current, `chats/dm/${threadId}`);
    const unsub = onValue(dmRef, (snap) => {
      const val = snap.val() || {};
      const nowMs = Date.now();
      const arr = Object.values(val)
        .filter((m) => isWithinOneHour(m?.ts, nowMs))
        .sort((a, b) => (a.ts || 0) - (b.ts || 0));
      setDmMessagesByPeer((prev) => ({
        ...prev,
        [dmTarget.id]: arr.slice(-60),
      }));
    });
    return () => unsub();
  }, [enteredLobby, dmTarget, myId]);

  useEffect(() => {
    if (!dbRef.current || !activeMatch || activeMatch.isBot) return;
    const roomRef = ref(dbRef.current, `matches/${activeMatch.roomId}`);
    const unsub = onValue(roomRef, (snap) => {
      const data = snap.val();
      if (!data) return;

      if (data.leftBy && data.leftBy !== myId && !leftNoticeShownRef.current) {
        leftNoticeShownRef.current = true;
        clearAllGameTimers();
        setActiveMatch(null);
        setMatchDrawerOpen(false);
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("duello_active_match");
        }
        showNotice(
          "Rakip Oyundan Çıktı",
          `${activeMatch.opponent.name} maçtan ayrıldı ve lobiye döndü.`
        );
        return;
      }

      if (Array.isArray(data.chatList)) {
        setMatchMessages((prev) => {
          if (data.chatList.length > prev.length && !matchDrawerOpen) {
            const added = data.chatList.slice(prev.length);
            const fromOther = added.filter((m) => m.senderId !== myId).length;
            if (fromOther > 0) setMatchUnread((u) => u + fromOther);
          }
          return data.chatList;
        });
      }

      if (data.reaction && data.reaction.ts) {
        setFloatingReaction((prev) => (!prev || prev.ts !== data.reaction.ts ? data.reaction : prev));
      }

      if (data.gameState) {
        const gs = data.gameState;
        const isP1 = activeMatch.isHost;

        if (activeMatch.gameType === "battleship") {
          const p1Ships = Array.isArray(gs.p1Ships) ? gs.p1Ships : autoPlaceShips(6);
          const p2Ships = Array.isArray(gs.p2Ships) ? gs.p2Ships : autoPlaceShips(6);
          const p1Shots = Array.isArray(gs.p1Shots) ? gs.p1Shots : createEmptyGrid(6);
          const p2Shots = Array.isArray(gs.p2Shots) ? gs.p2Shots : createEmptyGrid(6);
          const turnSide = gs.bsTurn || "p1";

          setMyShipGrid(isP1 ? p1Ships : p2Ships);
          setMyShotsOnEnemy(isP1 ? p1Shots : p2Shots);
          setEnemyShotsOnMe(isP1 ? p2Shots : p1Shots);

          const myTurnNow = (isP1 && turnSide === "p1") || (!isP1 && turnSide === "p2");
          setBsTurn(myTurnNow ? "me" : "opp");

          if (gs.bsWinner) {
            const wonMe = (isP1 && gs.bsWinner === "p1") || (!isP1 && gs.bsWinner === "p2");
            setBsWinner(wonMe ? "me" : "opp");
            setBsStatus(
              wonMe
                ? "Tebrikler! Düşman filosunu tamamen batırdın!"
                : "Rakip tüm gemilerini batırdı!"
            );
            if (wonMe) {
              awardWinPoint(`${activeMatch.roomId}_bs_final`);
            }
          } else {
            setBsStatus(
              gs.bsStatus ||
                (myTurnNow ? "Sıra sende! Düşman denizinde bir kare seç." : "Rakibin hamlesi bekleniyor...")
            );
          }
        } else if (activeMatch.gameType === "ttt" && Array.isArray(gs.board)) {
          setTttBoard(gs.board);
          setTttTurn(gs.turn || "X");
          setTttResult(gs.result || null);
          if (gs.result && gs.result.winner && gs.result.winner !== "draw") {
            const myMark = isP1 ? "X" : "O";
            if (gs.result.winner === myMark) {
              awardWinPoint(`${activeMatch.roomId}_ttt_win`);
            }
          }
        } else if (activeMatch.gameType === "rps") {
          const roundNum = gs.round || 1;
          const p1Score = gs.p1Score || 0;
          const p2Score = gs.p2Score || 0;
          const myPickRemote = isP1 ? gs.p1Pick || null : gs.p2Pick || null;
          const oppPickRemote = isP1 ? gs.p2Pick || null : gs.p1Pick || null;

          setRpsRound(roundNum);
          setRpsMyScore(isP1 ? p1Score : p2Score);
          setRpsOppScore(isP1 ? p2Score : p1Score);
          setRpsMyPick(myPickRemote);
          setRpsOppPick(oppPickRemote);
          if (Array.isArray(gs.history)) setRpsHistory(gs.history);

          if (gs.winner) {
            setRpsPhase("finished");
            const winnerMe =
              (isP1 && gs.winner === "p1") || (!isP1 && gs.winner === "p2");
            setRpsMatchWinner(
              gs.winner === "draw" ? "draw" : winnerMe ? "me" : "opp"
            );
            if (winnerMe) {
              awardWinPoint(`${activeMatch.roomId}_rps_final`);
            }
            if (gs.roundText) setRpsRoundText(gs.roundText);
          } else if (
            isP1 &&
            gs.p1Pick &&
            gs.p2Pick &&
            processedLiveRoundRef.current !== roundNum
          ) {
            processedLiveRoundRef.current = roundNum;
            const winSide = evaluateRPSRound(gs.p1Pick, gs.p2Pick);
            const nextP1Score = p1Score + (winSide === "p1" ? 1 : 0);
            const nextP2Score = p2Score + (winSide === "p2" ? 1 : 0);

            const rText =
              winSide === "p1"
                ? `${roundNum}/${RPS_TOTAL_ROUNDS}. Tur: ${getRPSLabel(gs.p1Pick)} > ${getRPSLabel(gs.p2Pick)} — Sen kazandın!`
                : winSide === "p2"
                ? `${roundNum}/${RPS_TOTAL_ROUNDS}. Tur: ${getRPSLabel(gs.p1Pick)} < ${getRPSLabel(gs.p2Pick)} — Rakip aldı!`
                : `${roundNum}/${RPS_TOTAL_ROUNDS}. Tur: İkiniz de ${getRPSLabel(gs.p1Pick)} seçtiniz — Berabere!`;

            const newEntry = {
              round: roundNum,
              resultForP1: winSide === "p1" ? "win" : winSide === "p2" ? "lose" : "draw",
              label: `${getRPSEmoji(gs.p1Pick)} vs ${getRPSEmoji(gs.p2Pick)}`,
            };
            const nextHistory = [
              ...(Array.isArray(gs.history) ? gs.history.filter((h) => h.round !== roundNum) : []),
              newEntry,
            ].sort((a, b) => a.round - b.round);

            if (rpsTimerRef.current) clearTimeout(rpsTimerRef.current);
            update(ref(dbRef.current, `matches/${activeMatch.roomId}/gameState`), {
              phase: "revealing",
              p1Score: nextP1Score,
              p2Score: nextP2Score,
              history: nextHistory,
              roundText: rText,
            });

            if (roundNum >= RPS_TOTAL_ROUNDS) {
              const finalSide =
                nextP1Score > nextP2Score
                  ? "p1"
                  : nextP2Score > nextP1Score
                  ? "p2"
                  : "draw";
              const finalText =
                finalSide === "draw"
                  ? `${RPS_TOTAL_ROUNDS} tur sonunda skor eşit (${nextP1Score}-${nextP2Score}) — Berabere!`
                  : finalSide === "p1"
                  ? `${RPS_TOTAL_ROUNDS} tur sonunda ${nextP1Score}-${nextP2Score} ile kazandın!`
                  : `${RPS_TOTAL_ROUNDS} tur sonunda ${nextP1Score}-${nextP2Score} ile rakip kazandı!`;

              rpsTimerRef.current = setTimeout(() => {
                update(ref(dbRef.current, `matches/${activeMatch.roomId}/gameState`), {
                  phase: "finished",
                  p1Score: nextP1Score,
                  p2Score: nextP2Score,
                  history: nextHistory,
                  winner: finalSide,
                  roundText: finalText,
                });
              }, 2200);
            } else {
              const nextRoundNum = roundNum + 1;
              rpsTimerRef.current = setTimeout(() => {
                update(ref(dbRef.current, `matches/${activeMatch.roomId}/gameState`), {
                  phase: "picking",
                  round: nextRoundNum,
                  p1Score: nextP1Score,
                  p2Score: nextP2Score,
                  p1Pick: null,
                  p2Pick: null,
                  history: nextHistory,
                  roundText: `${nextRoundNum}/${RPS_TOTAL_ROUNDS}. Tur: Seçimini yap!`,
                });
              }, 2600);
            }
          } else {
            if (myPickRemote) setRpsLastShownMyPick(myPickRemote);
            if (oppPickRemote) setRpsLastShownOppPick(oppPickRemote);

            if (gs.phase === "revealing") {
              setRpsPhase("revealing");
              if (gs.roundText) setRpsRoundText(gs.roundText);
            } else if (myPickRemote && !oppPickRemote) {
              setRpsPhase("picking");
              setRpsRoundText(`${roundNum}/${RPS_TOTAL_ROUNDS}. Tur: Seçimin alındı, rakip bekleniyor...`);
            } else {
              setRpsPhase("picking");
              setRpsRoundText(gs.roundText || `${roundNum}/${RPS_TOTAL_ROUNDS}. Tur: Seçimini yap!`);
            }
          }
        }
      }
    });
    return () => unsub();
  }, [activeMatch, myId, matchDrawerOpen]);

  useEffect(() => {
    if (!dbRef.current || !outgoingInvite || !outgoingInvite.toId) {
      acceptedHandledRef.current = false;
      return;
    }
    const targetInviteRef = ref(dbRef.current, `invites/${outgoingInvite.toId}`);
    const unsub = onValue(targetInviteRef, (snap) => {
      const val = snap.val();
      if (!val) return;
      if (val.status === "accepted" && val.roomId && !acceptedHandledRef.current) {
        acceptedHandledRef.current = true;
        const targetOpp = { id: outgoingInvite.toId, name: outgoingInvite.toName };
        const gId = outgoingInvite.gameId;
        const rId = val.roomId;
        setOutgoingInvite(null);
        remove(targetInviteRef);
        startMatch(targetOpp, gId, false, rId, true);
      } else if (val.status === "declined") {
        const declName = outgoingInvite.toName;
        const declGame = outgoingInvite.gameName;
        setOutgoingInvite(null);
        remove(targetInviteRef);
        showNotice(
          "Davet Reddedildi",
          `${declName} ${declGame} davetini kabul etmedi.`
        );
      }
    });
    return () => unsub();
  }, [outgoingInvite]);

  function resetAllGameStates(gameType, isBotMatch = false, roomIdForSync = null, isHostForSync = true) {
    clearAllGameTimers();
    processedLiveRoundRef.current = 0;
    awardedMatchIdRef.current = null;
    leftNoticeShownRef.current = false;

    const freshMyShips = autoPlaceShips(6);
    const freshOppShips = autoPlaceShips(6);
    const emptyShotsA = createEmptyGrid(6);
    const emptyShotsB = createEmptyGrid(6);

    setMyShipGrid(freshMyShips);
    setMyShotsOnEnemy(emptyShotsA);
    setEnemyGridForBot(freshOppShips);
    setEnemyShotsOnMe(emptyShotsB);
    setBsTurn("me");
    setBsStatus("Sıra sende! Düşman denizinde bir kare seç.");
    setBsWinner(null);

    setRpsRound(1);
    setRpsMyScore(0);
    setRpsOppScore(0);
    setRpsMyPick(null);
    setRpsOppPick(null);
    setRpsLastShownMyPick(null);
    setRpsLastShownOppPick(null);
    setRpsPhase("picking");
    setRpsRoundText(`1/${RPS_TOTAL_ROUNDS}. Tur: Seçimini yap!`);
    setRpsMatchWinner(null);
    setRpsHistory([]);

    setTttBoard(Array(9).fill(""));
    setTttTurn("X");
    setTttResult(null);

    setWordTarget(FINAL_WORDS[Math.floor(Math.random() * FINAL_WORDS.length)]);
    setWordGuesses([]);
    setCurrentGuess("");
    setWordStatus("5 harfli kelimeyi bulmak için tahmin gir!");
    setWordFinished(false);
    setOppWordProgress(0);

    const nextIdx = (sudokuIndex + 1) % SUDOKU_PUZZLES.length;
    setSudokuIndex(nextIdx);
    setSudokuBoard(SUDOKU_PUZZLES[nextIdx].puzzle.map((r) => [...r]));
    setSelectedCell([0, 1]);
    setSudokuMessage("Boş kareye 1-4 arası rakam yerleştir.");
    setSudokuWinner(null);
    setOppSudokuProgress(0);

    if (!isBotMatch && dbRef.current && roomIdForSync && isHostForSync) {
      update(ref(dbRef.current, `matches/${roomIdForSync}/gameState`), {
        phase: "picking",
        bsTurn: "p1",
        bsWinner: null,
        bsStatus: "Sıra sende! Düşman denizinde bir kare seç.",
        p1Ships: freshMyShips,
        p2Ships: freshOppShips,
        p1Shots: emptyShotsA,
        p2Shots: emptyShotsB,
        board: Array(9).fill(""),
        turn: "X",
        result: null,
        round: 1,
        p1Score: 0,
        p2Score: 0,
        p1Pick: null,
        p2Pick: null,
        history: [],
        winner: null,
        roundText: `1/${RPS_TOTAL_ROUNDS}. Tur: Seçimini yap!`,
      });
    }

    setMatchMessages([
      {
        id: "m_" + Date.now(),
        senderId: "sys",
        senderName: "Sistem",
        text: `${GAMES_META.find((g) => g.id === gameType)?.name || "Oyun"} maçı başladı! Başarılar.`,
        ts: Date.now(),
      },
    ]);
    setMatchUnread(0);
    setMatchDrawerOpen(false);
    setFloatingReaction(null);

    if (isBotMatch && gameType === "sudoku") {
      botSudokuTimerRef.current = setTimeout(() => setOppSudokuProgress(40), 2200);
    }
  }

  function startMatch(opponent, gameType, isBot = false, customRoomId = null, isHost = true) {
    const roomId = customRoomId || `room_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const matchObj = {
      roomId,
      gameType,
      isBot,
      isHost,
      opponent: { id: opponent.id, name: opponent.name },
    };
    resetAllGameStates(gameType, isBot, roomId, isHost);
    setActiveMatch(matchObj);
    setSelectedTargetUser(null);
    setOutgoingInvite(null);
    setIncomingInvite(null);

    if (dbRef.current && !isBot && isHost) {
      set(ref(dbRef.current, `matches/${roomId}`), {
        roomId,
        gameType,
        players: [myId, opponent.id],
        createdAt: Date.now(),
        leftBy: null,
        chatList: [
          {
            id: "m_" + Date.now(),
            senderId: "sys",
            senderName: "Sistem",
            text: "Maç odası oluşturuldu! Sohbetten mesaj gönderebilirsin.",
            ts: Date.now(),
          },
        ],
        gameState: {
          phase: "picking",
          bsTurn: "p1",
          bsWinner: null,
          bsStatus: "Sıra sende! Düşman denizinde bir kare seç.",
          p1Ships: autoPlaceShips(6),
          p2Ships: autoPlaceShips(6),
          p1Shots: createEmptyGrid(6),
          p2Shots: createEmptyGrid(6),
          board: Array(9).fill(""),
          turn: "X",
          result: null,
          round: 1,
          p1Score: 0,
          p2Score: 0,
          p1Pick: null,
          p2Pick: null,
          history: [],
          winner: null,
          roundText: `1/${RPS_TOTAL_ROUNDS}. Tur: Seçimini yap!`,
        },
      });
    }
  }

  function sendGameInvite(targetUser, gameId) {
    acceptedHandledRef.current = false;
    const gameMeta = GAMES_META.find((g) => g.id === gameId) || GAMES_META[1];
    const invitePayload = {
      fromId: myId,
      fromName: nickname.trim() || "Oyuncu",
      toId: targetUser.id,
      toName: targetUser.name,
      gameId: gameMeta.id,
      gameName: gameMeta.name,
      status: "pending",
      ts: Date.now(),
    };

    if (dbRef.current) {
      set(ref(dbRef.current, `invites/${targetUser.id}`), invitePayload);
      setOutgoingInvite(invitePayload);
      setSelectedTargetUser(null);
    } else {
      setOutgoingInvite(invitePayload);
      setSelectedTargetUser(null);
      setTimeout(() => startMatch(targetUser, gameMeta.id, false, `local_${Date.now()}`, true), 900);
    }
  }

  function acceptIncomingInvite() {
    if (!incomingInvite) return;
    const roomId = `room_${Date.now()}`;
    const inviter = { id: incomingInvite.fromId, name: incomingInvite.fromName };
    const gameId = incomingInvite.gameId;
    if (dbRef.current) {
      update(ref(dbRef.current, `invites/${myId}`), { status: "accepted", roomId });
    }
    setIncomingInvite(null);
    startMatch(inviter, gameId, false, roomId, false);
  }

  function declineIncomingInvite() {
    if (!incomingInvite) return;
    if (dbRef.current) {
      update(ref(dbRef.current, `invites/${myId}`), { status: "declined", ts: Date.now() });
    }
    setIncomingInvite(null);
  }

  function leaveMatch() {
    clearAllGameTimers();
    if (dbRef.current && activeMatch && !activeMatch.isBot) {
      update(ref(dbRef.current, `matches/${activeMatch.roomId}`), { leftBy: myId });
    }
    setActiveMatch(null);
    setMatchDrawerOpen(false);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("duello_active_match");
    }
  }

  function handleRequestNewMatch(gameType) {
    if (!activeMatch) return;
    if (activeMatch.isBot) {
      resetAllGameStates(gameType, true, activeMatch.roomId, activeMatch.isHost);
      return;
    }
    const targetOpp = activeMatch.opponent;
    leaveMatch();
    sendGameInvite(targetOpp, gameType);
  }

  function handleSendGlobalMessage(e) {
    e.preventDefault();
    const text = globalInput.trim();
    if (!text) return;
    const msg = {
      id: "g_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      senderId: myId,
      senderName: nickname.trim() || "Oyuncu",
      text,
      ts: Date.now(),
    };
    setGlobalInput("");
    if (dbRef.current) push(ref(dbRef.current, "chats/global"), msg);
    else setGlobalMessages((prev) => [...prev.slice(-49), msg]);
  }

  function openDirectMessage(peer) {
    setDmTarget(peer);
    setIncomingDm(null);
    setDmUnreadByPeer((prev) => ({ ...prev, [peer.id]: 0 }));
  }

  function handleSendDirectMessage(e) {
    e.preventDefault();
    if (!dmTarget) return;
    const text = dmInput.trim();
    if (!text) return;
    const msg = {
      id: "dm_" + Date.now(),
      senderId: myId,
      senderName: nickname.trim() || "Oyuncu",
      text,
      ts: Date.now(),
    };
    setDmInput("");
    if (dbRef.current) {
      const threadId = [myId, dmTarget.id].sort().join("__");
      push(ref(dbRef.current, `chats/dm/${threadId}`), msg);
    } else {
      setDmMessagesByPeer((prev) => ({
        ...prev,
        [dmTarget.id]: [...(prev[dmTarget.id] || []), msg],
      }));
    }
  }

  function sendMatchChatText(rawText) {
    const text = (rawText || "").trim();
    if (!text || !activeMatch) return;
    const msg = {
      id: "mc_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      senderId: myId,
      senderName: nickname.trim() || "Sen",
      text,
      ts: Date.now(),
    };
    const nextList = [...matchMessages, msg];
    setMatchMessages(nextList);
    setMatchInput("");

    if (dbRef.current && !activeMatch.isBot) {
      update(ref(dbRef.current, `matches/${activeMatch.roomId}`), {
        chatList: nextList.slice(-60),
      });
    } else if (activeMatch.isBot) {
      setTimeout(() => {
        const botMsg = {
          id: "mc_bot_" + Date.now(),
          senderId: "bot",
          senderName: activeMatch.opponent.name,
          text: getBotChatReply(text, activeMatch.gameType),
          ts: Date.now(),
        };
        setMatchMessages((prev) => [...prev, botMsg]);
        if (!matchDrawerOpen) setMatchUnread((u) => u + 1);
      }, 750);
    }
  }

  function handleSendEmojiReaction(emoji) {
    const reaction = { emoji, fromName: nickname.trim() || "Sen", ts: Date.now() };
    setFloatingReaction(reaction);
    if (dbRef.current && activeMatch && !activeMatch.isBot) {
      update(ref(dbRef.current, `matches/${activeMatch.roomId}`), { reaction });
    }
  }

  function handleBattleshipAttack(r, c) {
    if (bsWinner || bsTurn !== "me" || myShotsOnEnemy[r][c] !== 0) return;

    if (activeMatch && !activeMatch.isBot && dbRef.current) {
      const roomGsRef = ref(dbRef.current, `matches/${activeMatch.roomId}/gameState`);
      onValue(
        roomGsRef,
        (snap) => {
          const gs = snap.val() || {};
          const isP1 = activeMatch.isHost;
          const enemyShips = isP1 ? gs.p2Ships || autoPlaceShips(6) : gs.p1Ships || autoPlaceShips(6);
          const currentMyShots = (isP1 ? gs.p1Shots : gs.p2Shots) || createEmptyGrid(6);
          if (gs.bsWinner || currentMyShots[r][c] !== 0) return;

          const hit = enemyShips[r][c] === 1;
          const nextShots = currentMyShots.map((row, ri) =>
            row.map((val, ci) => (ri === r && ci === c ? (hit ? 2 : 1) : val))
          );
          const totalEnemyShips = countShipCells(enemyShips);
          const myTotalHits = countHitsOnGrid(nextShots);
          const wonNow = totalEnemyShips > 0 && myTotalHits >= totalEnemyShips;

          update(roomGsRef, {
            [isP1 ? "p1Shots" : "p2Shots"]: nextShots,
            bsWinner: wonNow ? (isP1 ? "p1" : "p2") : null,
            bsTurn: wonNow ? (isP1 ? "p1" : "p2") : isP1 ? "p2" : "p1",
            bsStatus: wonNow
              ? "Tebrikler! Düşman filosunu tamamen batırdın!"
              : hit
              ? `İSABET (${r + 1},${c + 1})! Rakibin sırası...`
              : `ISKA (${r + 1},${c + 1})! Rakibin sırası...`,
          });
        },
        { onlyOnce: true }
      );
      return;
    }

    const hit = enemyGridForBot[r][c] === 1;
    const nextShots = myShotsOnEnemy.map((row, ri) =>
      row.map((val, ci) => (ri === r && ci === c ? (hit ? 2 : 1) : val))
    );
    setMyShotsOnEnemy(nextShots);

    const totalShips = countShipCells(enemyGridForBot);
    const myHits = countHitsOnGrid(nextShots);
    if (totalShips > 0 && myHits >= totalShips) {
      setBsWinner("me");
      setBsStatus("Tebrikler! Düşman filosunu tamamen batırdın!");
      awardWinPoint(`${activeMatch?.roomId}_bs_win`);
      return;
    }

    setBsTurn("opp");
    setBsStatus(hit ? "İSABET! Rakip karşı saldırıya hazırlanıyor..." : "ISKA! Rakibin sırası...");

    if (botBsTimerRef.current) clearTimeout(botBsTimerRef.current);
    botBsTimerRef.current = setTimeout(() => {
      let er = Math.floor(Math.random() * 6);
      let ec = Math.floor(Math.random() * 6);
      let guard = 0;
      while (enemyShotsOnMe[er][ec] !== 0 && guard < 120) {
        er = Math.floor(Math.random() * 6);
        ec = Math.floor(Math.random() * 6);
        guard++;
      }
      if (enemyShotsOnMe[er][ec] !== 0) {
        for (let i = 0; i < 6; i++) {
          for (let j = 0; j < 6; j++) {
            if (enemyShotsOnMe[i][j] === 0) {
              er = i;
              ec = j;
              break;
            }
          }
        }
      }
      const oppHit = myShipGrid[er][ec] === 1;
      const nextOppShots = enemyShotsOnMe.map((row, ri) =>
        row.map((val, ci) => (ri === er && ci === ec ? (oppHit ? 2 : 1) : val))
      );
      setEnemyShotsOnMe(nextOppShots);

      const myTotal = countShipCells(myShipGrid);
      const oppHits = countHitsOnGrid(nextOppShots);
      if (myTotal > 0 && oppHits >= myTotal) {
        setBsWinner("opp");
        setBsStatus("Rakip tüm gemilerini batırdı! Rövanş ister misin?");
        return;
      }

      setBsTurn("me");
      setBsStatus(
        oppHit
          ? `Rakip gemine isabet aldı (${er + 1},${ec + 1})! Sıra sende.`
          : `Rakip ıskaladı (${er + 1},${ec + 1}). Sıra sende!`
      );
    }, 650);
  }

  function handleRPSPick(choice) {
    if (rpsPhase !== "picking" || rpsMatchWinner || rpsMyPick) return;

    setRpsLastShownMyPick(choice);

    if (activeMatch && !activeMatch.isBot && dbRef.current) {
      setRpsMyPick(choice);
      setRpsRoundText(`${rpsRound}/${RPS_TOTAL_ROUNDS}. Tur: Seçimin alındı, rakip bekleniyor...`);
      update(ref(dbRef.current, `matches/${activeMatch.roomId}/gameState`), {
        [activeMatch.isHost ? "p1Pick" : "p2Pick"]: choice,
      });
      return;
    }

    if (rpsTimerRef.current) clearTimeout(rpsTimerRef.current);
    const choices = ["rock", "paper", "scissors"];
    const oppChoice = choices[Math.floor(Math.random() * choices.length)];
    const currentRoundNum = rpsRound;

    setRpsMyPick(choice);
    setRpsOppPick(oppChoice);
    setRpsLastShownOppPick(oppChoice);
    setRpsPhase("revealing");

    const winSide = evaluateRPSRound(choice, oppChoice);
    const roundOutcome = winSide === "draw" ? "draw" : winSide === "p1" ? "win" : "lose";
    const nextMyScore = rpsMyScore + (roundOutcome === "win" ? 1 : 0);
    const nextOppScore = rpsOppScore + (roundOutcome === "lose" ? 1 : 0);

    setRpsMyScore(nextMyScore);
    setRpsOppScore(nextOppScore);

    const msg =
      roundOutcome === "win"
        ? `${currentRoundNum}/${RPS_TOTAL_ROUNDS}. Tur: ${getRPSLabel(choice)} > ${getRPSLabel(oppChoice)} — Sen kazandın!`
        : roundOutcome === "lose"
        ? `${currentRoundNum}/${RPS_TOTAL_ROUNDS}. Tur: ${getRPSLabel(choice)} < ${getRPSLabel(oppChoice)} — Rakip aldı!`
        : `${currentRoundNum}/${RPS_TOTAL_ROUNDS}. Tur: İkiniz de ${getRPSLabel(choice)} seçtiniz — Berabere!`;
    setRpsRoundText(msg);

    const nextHistory = [
      ...rpsHistory.filter((h) => h.round !== currentRoundNum),
      {
        round: currentRoundNum,
        resultForP1: roundOutcome,
        label: `${getRPSEmoji(choice)} vs ${getRPSEmoji(oppChoice)}`,
      },
    ].sort((a, b) => a.round - b.round);
    setRpsHistory(nextHistory);

    if (currentRoundNum >= RPS_TOTAL_ROUNDS) {
      rpsTimerRef.current = setTimeout(() => {
        const winnerVal =
          nextMyScore > nextOppScore ? "me" : nextOppScore > nextMyScore ? "opp" : "draw";
        setRpsPhase("finished");
        setRpsMatchWinner(winnerVal);
        if (winnerVal === "me") {
          awardWinPoint(`${activeMatch?.roomId}_bot_rps_${currentRoundNum}`);
        }
        setRpsRoundText(
          winnerVal === "me"
            ? `${RPS_TOTAL_ROUNDS} tur sonunda ${nextMyScore}-${nextOppScore} ile kazandın!`
            : winnerVal === "opp"
            ? `${RPS_TOTAL_ROUNDS} tur sonunda ${nextMyScore}-${nextOppScore} ile rakip kazandı!`
            : `${RPS_TOTAL_ROUNDS} tur sonunda ${nextMyScore}-${nextOppScore} berabere!`
        );
      }, 2200);
    } else {
      const upcomingRound = currentRoundNum + 1;
      rpsTimerRef.current = setTimeout(() => {
        setRpsRound(upcomingRound);
        setRpsMyPick(null);
        setRpsOppPick(null);
        setRpsPhase("picking");
        setRpsRoundText(`${upcomingRound}/${RPS_TOTAL_ROUNDS}. Tur: Seçimini yap!`);
      }, 2600);
    }
  }

  function handleTTTMove(idx) {
    if (tttResult || tttBoard[idx]) return;

    if (activeMatch && !activeMatch.isBot) {
      const myMark = activeMatch.isHost ? "X" : "O";
      if (tttTurn !== myMark) return;

      const nextBoard = [...tttBoard];
      nextBoard[idx] = myMark;
      const res = checkTTTWinner(nextBoard);
      const nextTurn = myMark === "X" ? "O" : "X";

      setTttBoard(nextBoard);
      setTttTurn(nextTurn);
      setTttResult(res);

      if (res && res.winner === myMark) {
        awardWinPoint(`${activeMatch.roomId}_ttt_${nextBoard.join("")}`);
      }

      if (dbRef.current) {
        update(ref(dbRef.current, `matches/${activeMatch.roomId}/gameState`), {
          board: nextBoard,
          turn: nextTurn,
          result: res,
        });
      }
      return;
    }

    const nextBoard = [...tttBoard];
    nextBoard[idx] = "X";
    const res = checkTTTWinner(nextBoard);
    setTttBoard(nextBoard);
    setTttResult(res);

    if (res) {
      if (res.winner === "X") {
        awardWinPoint(`${activeMatch?.roomId}_ttt_bot_${nextBoard.join("")}`);
      }
      return;
    }

    setTttTurn("O");
    if (botTttTimerRef.current) clearTimeout(botTttTimerRef.current);
    botTttTimerRef.current = setTimeout(() => {
      const emptyIndices = nextBoard
        .map((v, i) => (v === "" ? i : -1))
        .filter((i) => i !== -1);
      if (emptyIndices.length === 0) return;

      const winLines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6],
      ];
      let chosen = null;
      for (const [a, b, c] of winLines) {
        const lineVals = [nextBoard[a], nextBoard[b], nextBoard[c]];
        if (lineVals.filter((x) => x === "O").length === 2 && lineVals.includes("")) {
          chosen = [a, b, c][lineVals.indexOf("")];
          break;
        }
      }
      if (chosen === null) {
        for (const [a, b, c] of winLines) {
          const lineVals = [nextBoard[a], nextBoard[b], nextBoard[c]];
          if (lineVals.filter((x) => x === "X").length === 2 && lineVals.includes("")) {
            chosen = [a, b, c][lineVals.indexOf("")];
            break;
          }
        }
      }
      if (chosen === null) {
        chosen = emptyIndices.includes(4)
          ? 4
          : emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
      }

      const afterBot = [...nextBoard];
      afterBot[chosen] = "O";
      const botRes = checkTTTWinner(afterBot);
      setTttBoard(afterBot);
      setTttTurn("X");
      setTttResult(botRes);
    }, 450);
  }

  function handleWordKey(key) {
    if (wordFinished) return;
    if (key === "SIL") {
      setCurrentGuess((g) => Array.from(g).slice(0, -1).join(""));
      return;
    }
    if (key === "GIR") {
      const chars = Array.from(currentGuess);
      if (chars.length !== 5) {
        setWordStatus("Lütfen 5 harf gir.");
        return;
      }
      const normalizedGuess = chars.join("");
      const evalRow = evaluateWordleGuess(normalizedGuess, wordTarget);
      const nextGuesses = [...wordGuesses, { word: normalizedGuess, eval: evalRow }];
      setWordGuesses(nextGuesses);
      setCurrentGuess("");

      if (activeMatch?.isBot) {
        if (botWordTimerRef.current) clearTimeout(botWordTimerRef.current);
        botWordTimerRef.current = setTimeout(() => {
          setOppWordProgress((p) => Math.min(100, p + 25));
        }, 500);
      }

      if (normalizedGuess === wordTarget) {
        setWordStatus(`Harika! "${wordTarget}" kelimesini buldun!`);
        setWordFinished(true);
        awardWinPoint(`${activeMatch?.roomId}_wordle_${wordTarget}`);
      } else if (nextGuesses.length >= 6) {
        setWordStatus(`Hakların bitti! Doğru kelime: ${wordTarget}`);
        setWordFinished(true);
      } else {
        setWordStatus(`${6 - nextGuesses.length} tahmin hakkın kaldı.`);
      }
      return;
    }
    if (Array.from(currentGuess).length < 5) {
      setCurrentGuess((g) => g + key);
    }
  }

  function handleSudokuNumber(num) {
    if (sudokuWinner) return;
    const [r, c] = selectedCell;
    const puzzle = SUDOKU_PUZZLES[sudokuIndex];
    if (puzzle.puzzle[r][c] !== 0) {
      setSudokuMessage("Sabit verilen rakamlar değiştirilemez.");
      return;
    }
    const nextBoard = sudokuBoard.map((row, ri) =>
      row.map((val, ci) => (ri === r && ci === c ? num : val))
    );
    setSudokuBoard(nextBoard);

    const conflict = hasSudokuConflict(nextBoard, r, c, num);
    let filledCount = 0;
    let allCorrect = true;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        if (nextBoard[i][j] !== 0) filledCount++;
        if (nextBoard[i][j] !== puzzle.solution[i][j]) allCorrect = false;
      }
    }

    if (allCorrect) {
      setSudokuWinner("me");
      setSudokuMessage("4x4 Sudoku'yu hatasız tamamladın! Kazandın!");
      awardWinPoint(`${activeMatch?.roomId}_sudoku_${sudokuIndex}`);
    } else if (conflict) {
      setSudokuMessage(`(${r + 1},${c + 1}) konumunda satır, sütun veya 2x2 kutuda çakışma var!`);
    } else if (filledCount === 16) {
      setSudokuMessage("Tüm kareler dolu ama bazı rakamlar farklı, tekrar kontrol et!");
    } else {
      setSudokuMessage(`İlerleme: %${Math.round((filledCount / 16) * 100)}`);
    }
  }

  const wordLetterStatuses = useMemo(() => {
    const map = {};
    const priority = { absent: 1, present: 2, correct: 3 };
    for (const g of wordGuesses) {
      const letters = Array.from(g.word);
      letters.forEach((ch, i) => {
        const st = g.eval[i];
        const prev = map[ch];
        if (!prev || priority[st] > priority[prev]) {
          map[ch] = st;
        }
      });
    }
    return map;
  }, [wordGuesses]);

  const activeDmList = useMemo(() => {
    if (!dmTarget) return [];
    const nowMs = Date.now();
    return (dmMessagesByPeer[dmTarget.id] || []).filter((m) => isWithinOneHour(m.ts, nowMs));
  }, [dmTarget, dmMessagesByPeer]);

  const visibleGlobalMessages = useMemo(() => {
    const nowMs = Date.now();
    return globalMessages.filter((m) => m.senderId === "sys" || isWithinOneHour(m.ts, nowMs));
  }, [globalMessages]);

  const leaderboardList = useMemo(() => {
    const cleanName = nickname.trim() || "Oyuncu";
    const meEntry = {
      id: myId,
      name: cleanName,
      wins: myWins,
      status: myStatus,
      isMe: true,
    };
    const others = users.map((u) => ({
      id: u.id,
      name: u.name || "Oyuncu",
      wins: Number(u.wins || 0),
      status: u.status || "online",
      isMe: false,
    }));
    return [meEntry, ...others].sort((a, b) => b.wins - a.wins);
  }, [nickname, myId, myWins, myStatus, users]);

  if (!enteredLobby) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-5 select-none">
        <div className="max-w-md w-full mx-auto my-auto space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 mb-1">
              <Gamepad2 className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Düello Arenası</h1>
            <p className="text-sm text-slate-400">
              Aktif oyuncularla eşleş, sohbet et ve 5 farklı oyunda yarış.
            </p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Takma Adın
            </label>
            <input
              type="text"
              maxLength={18}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Örn: Emirhan"
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-base"
            />
            <button
              onClick={() => setEnteredLobby(true)}
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] transition font-bold text-white flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25"
            >
              <Sparkles className="w-4 h-4" />
              Lobiye Katıl
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs text-slate-400">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5">
              <div className="font-semibold text-slate-200">5 Oyun</div>
              <div>Amiral Battı, Sudoku...</div>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5">
              <div className="font-semibold text-slate-200">1 Saatlik Sohbet</div>
              <div>Otomatik temizlenir</div>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5">
              <div className="font-semibold text-slate-200">Liderlik</div>
              <div>Her galibiyet +1 puan</div>
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-500">
          {FIREBASE_CONFIG?.databaseURL
            ? "Firebase Realtime Database bağlı"
            : "Yerel & Bot modu aktif"}
        </p>
      </div>
    );
  }

  if (activeMatch) {
    const gameInfo = GAMES_META.find((g) => g.id === activeMatch.gameType) || GAMES_META[1];
    const shownMyPick = rpsMyPick || rpsLastShownMyPick;
    const shownOppPick = rpsOppPick || rpsLastShownOppPick;
    const totalShipCells = countShipCells(enemyGridForBot);
    const myHitCells = countHitsOnGrid(myShotsOnEnemy);

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-20 relative">
        {floatingReaction && (
          <div className="fixed top-20 right-5 z-50 bg-slate-900/95 border border-slate-700 px-3.5 py-2 rounded-2xl shadow-2xl flex items-center gap-2 animate-bounce">
            <span className="text-2xl">{floatingReaction.emoji}</span>
            <span className="text-xs font-medium text-slate-300">{floatingReaction.fromName}</span>
          </div>
        )}

        <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                {gameInfo.name}
              </span>
              {activeMatch.isBot && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Bot
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-white">
              {nickname.trim() || "Sen"} vs {activeMatch.opponent.name}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                resetAllGameStates(
                  activeMatch.gameType,
                  activeMatch.isBot,
                  activeMatch.roomId,
                  activeMatch.isHost
                )
              }
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={leaveMatch}
              className="px-3 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              Lobi
            </button>
          </div>
        </header>

        <div className="px-4 py-2 bg-slate-900/50 border-b border-slate-800/70 flex items-center justify-between gap-2 overflow-x-auto">
          <span className="text-[11px] text-slate-400 shrink-0">Tepki:</span>
          <div className="flex items-center gap-1.5">
            {EMOJIS.map((em) => (
              <button
                key={em}
                onClick={() => handleSendEmojiReaction(em)}
                className="w-8 h-8 rounded-lg bg-slate-800/90 hover:bg-slate-700 active:scale-90 transition flex items-center justify-center text-base"
              >
                {em}
              </button>
            ))}
          </div>
        </div>

        <main className="flex-1 max-w-md w-full mx-auto p-4 space-y-4">
          {activeMatch.gameType === "battleship" && (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 text-center space-y-1">
                <p className="text-sm font-semibold text-indigo-300">{bsStatus}</p>
                <p className="text-[11px] text-slate-400">
                  Düşman Hedef İsabeti: {myHitCells}/{totalShipCells}
                </p>
                {bsWinner && (
                  <div className="pt-2 space-y-2">
                    <p className="text-base font-extrabold text-emerald-400">
                      {bsWinner === "me" ? "KAZANDIN! (+1 Puan) 🎉" : "RAKİP KAZANDI!"}
                    </p>
                    <button
                      onClick={() => handleRequestNewMatch("battleship")}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white"
                    >
                      {activeMatch.isBot ? "Yeni Amiral Battı Maçı" : "Yeni Maç Daveti Gönder"}
                    </button>
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-400 mb-1.5 flex justify-between">
                  <span>DÜŞMAN DENİZİ</span>
                  <span>{bsTurn === "me" ? "Sıra Sende" : "Rakibin Sırası"}</span>
                </div>
                <div className="grid grid-cols-6 gap-1.5 bg-slate-900 p-2.5 rounded-2xl border border-slate-800">
                  {myShotsOnEnemy.map((row, r) =>
                    row.map((cell, c) => (
                      <button
                        key={`atk-${r}-${c}`}
                        disabled={Boolean(bsWinner) || bsTurn !== "me" || cell !== 0}
                        onClick={() => handleBattleshipAttack(r, c)}
                        className={`aspect-square rounded-lg font-bold text-sm flex items-center justify-center transition ${
                          cell === 2
                            ? "bg-rose-600 text-white"
                            : cell === 1
                            ? "bg-slate-700 text-slate-400"
                            : "bg-sky-950/80 hover:bg-sky-900 disabled:opacity-60 border border-sky-800/50 text-sky-200"
                        }`}
                      >
                        {cell === 2 ? "💥" : cell === 1 ? "•" : ""}
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-400 mb-1.5">SENİN FİLON</div>
                <div className="grid grid-cols-6 gap-1 bg-slate-900/70 p-2 rounded-2xl border border-slate-800/80">
                  {myShipGrid.map((row, r) =>
                    row.map((cell, c) => {
                      const hitByOpp = enemyShotsOnMe[r][c] === 2;
                      const missByOpp = enemyShotsOnMe[r][c] === 1;
                      return (
                        <div
                          key={`def-${r}-${c}`}
                          className={`aspect-square rounded-md text-xs flex items-center justify-center ${
                            hitByOpp
                              ? "bg-rose-600/80 text-white"
                              : cell === 1
                              ? "bg-indigo-600/70 text-white"
                              : missByOpp
                              ? "bg-slate-800 text-slate-500"
                              : "bg-slate-950/70"
                          }`}
                        >
                          {hitByOpp ? "🔥" : cell === 1 ? "🚢" : missByOpp ? "•" : ""}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {activeMatch.gameType === "rps" && (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-center">
                  <div className="flex-1">
                    <div className="text-xs text-slate-400">Sen</div>
                    <div className="text-3xl font-extrabold text-indigo-400">{rpsMyScore}</div>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-slate-800 text-xs font-bold text-slate-300">
                    TUR {Math.min(rpsRound, RPS_TOTAL_ROUNDS)}/{RPS_TOTAL_ROUNDS}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-slate-400">{activeMatch.opponent.name}</div>
                    <div className="text-3xl font-extrabold text-rose-400">{rpsOppScore}</div>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-1.5 pt-1">
                  {Array.from({ length: RPS_TOTAL_ROUNDS }).map((_, idx) => {
                    const rNum = idx + 1;
                    const item = rpsHistory.find((h) => h.round === rNum);
                    const myOutcome = item
                      ? activeMatch.isHost
                        ? item.resultForP1
                        : item.resultForP1 === "win"
                        ? "lose"
                        : item.resultForP1 === "lose"
                        ? "win"
                        : "draw"
                      : null;

                    const badgeStyle =
                      myOutcome === "win"
                        ? "bg-emerald-600/25 border-emerald-500/60 text-emerald-300"
                        : myOutcome === "lose"
                        ? "bg-rose-600/25 border-rose-500/60 text-rose-300"
                        : myOutcome === "draw"
                        ? "bg-amber-500/20 border-amber-400/50 text-amber-200"
                        : rNum === rpsRound && !rpsMatchWinner
                        ? "bg-indigo-600/20 border-indigo-400/60 text-indigo-200"
                        : "bg-slate-950/70 border-slate-800 text-slate-500";
                    return (
                      <div
                        key={rNum}
                        className={`rounded-xl border py-1.5 px-1 text-center flex flex-col items-center justify-center ${badgeStyle}`}
                      >
                        <span className="text-[10px] font-bold">T{rNum}</span>
                        <span className="text-[10px] leading-tight mt-0.5">
                          {item ? item.label : rNum === rpsRound && !rpsMatchWinner ? "•" : "-"}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <p className="text-center text-sm font-medium text-slate-200">{rpsRoundText}</p>
              </div>

              {(shownMyPick || shownOppPick) && (
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-slate-900/90 border border-indigo-500/30 rounded-2xl p-4">
                    <div className="text-xs text-slate-400 mb-1">
                      Seçimin ({shownMyPick ? getRPSLabel(shownMyPick) : "Bekleniyor"})
                    </div>
                    <div className="text-4xl">{shownMyPick ? getRPSEmoji(shownMyPick) : "⏳"}</div>
                  </div>
                  <div className="bg-slate-900/90 border border-rose-500/30 rounded-2xl p-4">
                    <div className="text-xs text-slate-400 mb-1">
                      Rakip (
                      {rpsPhase === "revealing" || rpsPhase === "finished" || activeMatch.isBot
                        ? shownOppPick
                          ? getRPSLabel(shownOppPick)
                          : "-"
                        : rpsOppPick
                        ? "Seçti"
                        : "Düşünüyor"}
                      )
                    </div>
                    <div className="text-4xl">
                      {rpsPhase === "revealing" || rpsPhase === "finished" || activeMatch.isBot
                        ? shownOppPick
                          ? getRPSEmoji(shownOppPick)
                          : "⏳"
                        : rpsOppPick
                        ? "✅"
                        : "⏳"}
                    </div>
                  </div>
                </div>
              )}

              {rpsMatchWinner ? (
                <div className="bg-emerald-950/50 border border-emerald-500/40 rounded-2xl p-5 text-center space-y-3">
                  <Trophy className="w-10 h-10 text-amber-400 mx-auto" />
                  <div className="text-xl font-extrabold text-white">
                    {rpsMatchWinner === "me"
                      ? `5 Turu Kazandın! (+1 Puan) (${rpsMyScore}-${rpsOppScore})`
                      : rpsMatchWinner === "opp"
                      ? `${activeMatch.opponent.name} Kazandı! (${rpsMyScore}-${rpsOppScore})`
                      : `5 Tur Berabere Bitti! (${rpsMyScore}-${rpsOppScore})`}
                  </div>
                  <button
                    onClick={() => handleRequestNewMatch("rps")}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm text-white"
                  >
                    {activeMatch.isBot ? "Yeni 5 Turluk Maç" : "Yeni 5 Turluk Maç (Davet Gönder)"}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {RPS_CHOICES.map((item) => {
                    const isPicked = rpsMyPick === item.id;
                    return (
                      <button
                        key={item.id}
                        disabled={rpsPhase !== "picking" || Boolean(rpsMyPick)}
                        onClick={() => handleRPSPick(item.id)}
                        className={`py-5 rounded-2xl border flex flex-col items-center gap-2 transition active:scale-95 ${
                          isPicked
                            ? "bg-indigo-600/30 border-indigo-400 ring-2 ring-indigo-500/40"
                            : "bg-slate-900 hover:bg-indigo-600/20 border-slate-800 hover:border-indigo-500/50 disabled:opacity-50"
                        }`}
                      >
                        <span className="text-3xl">{item.emoji}</span>
                        <span className="text-xs font-bold text-slate-200">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeMatch.gameType === "ttt" && (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 text-center space-y-2">
                {tttResult ? (
                  <>
                    <p className="text-base font-extrabold text-emerald-400">
                      {tttResult.winner === "draw"
                        ? "Berabere!"
                        : tttResult.winner === (activeMatch.isBot || activeMatch.isHost ? "X" : "O")
                        ? "Kazandın! (+1 Puan)"
                        : "Rakip Kazandı!"}
                    </p>
                    <button
                      onClick={() => handleRequestNewMatch("ttt")}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white"
                    >
                      {activeMatch.isBot ? "Yeni Tic Tac Toe Maçı" : "Yeni Maç Daveti Gönder"}
                    </button>
                  </>
                ) : (
                  <p className="text-sm font-semibold text-slate-200">
                    Sıra: <span className="text-indigo-400 font-bold">{tttTurn}</span>{" "}
                    <span className="text-xs text-slate-400">
                      (Senin taşın: {activeMatch.isBot || activeMatch.isHost ? "X" : "O"})
                    </span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2.5 aspect-square max-w-[320px] mx-auto">
                {tttBoard.map((cell, idx) => {
                  const isWinCell = tttResult?.line?.includes(idx);
                  return (
                    <button
                      key={idx}
                      disabled={Boolean(tttResult) || Boolean(cell)}
                      onClick={() => handleTTTMove(idx)}
                      className={`rounded-2xl text-4xl font-black flex items-center justify-center border transition ${
                        isWinCell
                          ? "bg-emerald-600/30 border-emerald-400 text-emerald-300"
                          : "bg-slate-900 hover:bg-slate-800 border-slate-800 text-white"
                      }`}
                    >
                      {cell === "X" ? (
                        <span className="text-indigo-400">X</span>
                      ) : cell === "O" ? (
                        <span className="text-rose-400">O</span>
                      ) : (
                        ""
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeMatch.gameType === "wordle" && (
            <div className="space-y-3">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2">
                <p className="text-xs font-medium text-slate-200 text-center">{wordStatus}</p>
                {activeMatch.isBot && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>{activeMatch.opponent.name} İlerlemesi</span>
                      <span>%{oppWordProgress}</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 transition-all" style={{ width: `${oppWordProgress}%` }} />
                    </div>
                  </div>
                )}
                {wordFinished && (
                  <div className="pt-1 text-center">
                    <button
                      onClick={() => handleRequestNewMatch("wordle")}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white"
                    >
                      {activeMatch.isBot ? "Yeni Kelime Turu" : "Yeni Maç Daveti Gönder"}
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 max-w-[290px] mx-auto">
                {Array.from({ length: 6 }).map((_, rowIdx) => {
                  const guessObj = wordGuesses[rowIdx];
                  const isCurrentRow = rowIdx === wordGuesses.length && !wordFinished;
                  const currentChars = Array.from(currentGuess);
                  return (
                    <div key={rowIdx} className="grid grid-cols-5 gap-1.5">
                      {Array.from({ length: 5 }).map((__, colIdx) => {
                        const guessChars = guessObj ? Array.from(guessObj.word) : [];
                        const letter = guessObj
                          ? guessChars[colIdx] || ""
                          : isCurrentRow
                          ? currentChars[colIdx] || ""
                          : "";
                        const status = guessObj ? guessObj.eval[colIdx] : null;
                        const colorClass =
                          status === "correct"
                            ? "bg-emerald-600 border-emerald-500 text-white"
                            : status === "present"
                            ? "bg-amber-500 border-amber-400 text-slate-950"
                            : status === "absent"
                            ? "bg-slate-800 border-slate-700 text-slate-400"
                            : "bg-slate-900 border-slate-700 text-white";
                        return (
                          <div
                            key={colIdx}
                            className={`aspect-square rounded-xl border font-extrabold text-xl flex items-center justify-center ${colorClass}`}
                          >
                            {letter}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              <div className="space-y-1.5 pt-1">
                {[
                  ["E", "R", "T", "Y", "U", "I", "O", "P", "Ğ", "Ü"],
                  ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ş", "İ"],
                  ["GIR", "Z", "C", "V", "B", "N", "M", "Ö", "Ç", "SIL"],
                ].map((kRow, rIdx) => (
                  <div key={rIdx} className="flex justify-center gap-1">
                    {kRow.map((k) => {
                      const keySt = wordLetterStatuses[k];
                      const keyStyle =
                        keySt === "correct"
                          ? "bg-emerald-600 text-white"
                          : keySt === "present"
                          ? "bg-amber-500 text-slate-950"
                          : keySt === "absent"
                          ? "bg-slate-900 text-slate-500 border border-slate-800"
                          : "bg-slate-800 hover:bg-slate-700 text-slate-100";
                      return (
                        <button
                          key={k}
                          onClick={() => handleWordKey(k)}
                          className={`${
                            k === "GIR" || k === "SIL" ? "px-2.5 text-[11px]" : "w-7 text-xs"
                          } h-9 rounded-lg ${keyStyle} font-bold active:scale-95`}
                        >
                          {k === "GIR" ? "GİR" : k === "SIL" ? "⌫" : k}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeMatch.gameType === "sudoku" && (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2">
                <p className="text-sm font-semibold text-center text-indigo-300">{sudokuMessage}</p>
                {activeMatch.isBot && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>{activeMatch.opponent.name} İlerlemesi</span>
                      <span>%{oppSudokuProgress}</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400 transition-all" style={{ width: `${oppSudokuProgress}%` }} />
                    </div>
                  </div>
                )}
                {sudokuWinner && (
                  <div className="pt-1 text-center">
                    <button
                      onClick={() => handleRequestNewMatch("sudoku")}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white"
                    >
                      {activeMatch.isBot ? "Yeni Sudoku Bulmacası" : "Yeni Maç Daveti Gönder"}
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2 max-w-[280px] mx-auto bg-slate-900 p-2.5 rounded-2xl border border-slate-800">
                {sudokuBoard.map((row, r) =>
                  row.map((val, c) => {
                    const isFixed = SUDOKU_PUZZLES[sudokuIndex].puzzle[r][c] !== 0;
                    const isSelected = selectedCell[0] === r && selectedCell[1] === c;
                    const conflict = !isFixed && val !== 0 && hasSudokuConflict(sudokuBoard, r, c, val);
                    return (
                      <button
                        key={`${r}-${c}`}
                        onClick={() => setSelectedCell([r, c])}
                        className={`aspect-square rounded-xl text-xl font-extrabold flex items-center justify-center border transition ${
                          conflict
                            ? "border-rose-500 bg-rose-950/60 text-rose-300"
                            : isSelected
                            ? "border-indigo-400 bg-indigo-600/30 text-white"
                            : isFixed
                            ? "border-slate-700 bg-slate-800/90 text-amber-300"
                            : "border-slate-800 bg-slate-950 text-slate-100"
                        }`}
                      >
                        {val || ""}
                      </button>
                    );
                  })
                )}
              </div>

              <div className="grid grid-cols-4 gap-2 max-w-[280px] mx-auto">
                {[1, 2, 3, 4].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleSudokuNumber(num)}
                    className="py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-extrabold text-lg text-white active:scale-95"
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          )}
        </main>

        {matchDrawerOpen && (
          <div className="fixed inset-x-0 bottom-14 z-40 max-w-md mx-auto bg-slate-900 border-t border-x border-slate-700 rounded-t-3xl shadow-2xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-indigo-400" />
                Maç Sohbeti ({activeMatch.opponent.name})
              </span>
              <button onClick={() => setMatchDrawerOpen(false)} className="p-1 rounded-lg bg-slate-800 text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="h-44 overflow-y-auto space-y-2 pr-1">
              {matchMessages.map((m) => {
                const mine = m.senderId === myId;
                if (m.senderId === "sys") {
                  return <div key={m.id} className="text-center text-[11px] text-slate-400 py-1">{m.text}</div>;
                }
                return (
                  <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                    <span className="text-[10px] text-slate-400 mb-0.5">{m.senderName}</span>
                    <div className={`px-3 py-1.5 rounded-2xl text-xs max-w-[80%] ${mine ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-100"}`}>
                      {m.text}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {QUICK_REPLIES.map((qr) => (
                <button
                  key={qr}
                  onClick={() => sendMatchChatText(qr)}
                  className="shrink-0 px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-indigo-300 border border-slate-700"
                >
                  {qr}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMatchChatText(matchInput);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={matchInput}
                onChange={(e) => setMatchInput(e.target.value)}
                placeholder="Rakibine mesaj yaz..."
                className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
              <button type="submit" className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        <div className="fixed bottom-0 inset-x-0 z-30 bg-slate-950/95 border-t border-slate-800 p-2.5">
          <div className="max-w-md mx-auto">
            <button
              onClick={() => {
                setMatchDrawerOpen((o) => !o);
                setMatchUnread(0);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 flex items-center justify-between text-sm font-semibold"
            >
              <span className="flex items-center gap-2 text-indigo-300">
                <MessageCircle className="w-4 h-4" />
                Maç Sohbeti
              </span>
              <div className="flex items-center gap-2">
                {matchUnread > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[11px] font-bold">
                    {matchUnread}
                  </span>
                )}
                {matchDrawerOpen ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-12">
      <header className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold leading-tight text-white">Düello Arenası</h1>
            <p className="text-xs text-emerald-400">
              ● {nickname.trim() || "Oyuncu"} • {myWins} Puan
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setEnteredLobby(false);
            if (typeof window !== "undefined") {
              window.localStorage.setItem("duello_entered_lobby", "0");
            }
          }}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300"
        >
          Çıkış
        </button>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-5">
        {noticeBanner && (
          <div className="bg-amber-950/70 border border-amber-500/50 rounded-2xl p-3.5 shadow-xl flex items-start justify-between gap-2">
            <div className="space-y-0.5">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
                {noticeBanner.title}
              </div>
              <p className="text-xs text-white">{noticeBanner.text}</p>
            </div>
            <button
              onClick={() => setNoticeBanner(null)}
              className="p-1 rounded-lg bg-slate-900/70 text-slate-300 hover:text-white shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {incomingInvite && (
          <div className="bg-indigo-950/70 border border-indigo-500/50 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
              <Bell className="w-4 h-4" />
              Gelen Meydan Okuma
            </div>
            <p className="text-sm text-white">
              <span className="font-bold">{incomingInvite.fromName}</span> seni{" "}
              <span className="font-bold text-amber-300">{incomingInvite.gameName}</span> oynamaya davet ediyor!
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={acceptIncomingInvite}
                className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Kabul Et
              </button>
              <button
                onClick={declineIncomingInvite}
                className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold text-xs text-slate-200 flex items-center justify-center gap-1.5"
              >
                <X className="w-4 h-4" />
                Reddet
              </button>
            </div>
          </div>
        )}

        {incomingDm && (
          <div className="bg-emerald-950/70 border border-emerald-500/50 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider">
                <MessageCircle className="w-4 h-4" />
                Gelen Özel Mesaj
              </div>
              <span className="text-[11px] font-semibold text-emerald-200">{incomingDm.peer.name}</span>
            </div>
            <p className="text-sm text-white bg-slate-950/70 border border-emerald-500/20 rounded-xl px-3 py-2">
              {incomingDm.text}
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => {
                  const peerToOpen = incomingDm.peer;
                  setIncomingDm(null);
                  openDirectMessage(peerToOpen);
                }}
                className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white flex items-center justify-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4" />
                Mesajı Aç
              </button>
              <button
                onClick={() => setIncomingDm(null)}
                className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold text-xs text-slate-200 flex items-center justify-center gap-1.5"
              >
                <X className="w-4 h-4" />
                Kapat
              </button>
            </div>
          </div>
        )}

        {outgoingInvite && (
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-3.5 flex items-center justify-between">
            <div className="text-xs">
              <span className="text-amber-300 font-bold">{outgoingInvite.toName}</span> kişisine{" "}
              <span className="font-semibold text-white">{outgoingInvite.gameName}</span> daveti gönderildi...
            </div>
            <button
              onClick={() => {
                if (dbRef.current) remove(ref(dbRef.current, `invites/${outgoingInvite.toId}`));
                setOutgoingInvite(null);
              }}
              className="text-xs text-slate-400 hover:text-white underline ml-2"
            >
              İptal
            </button>
          </div>
        )}

        <section className="bg-gradient-to-br from-indigo-950/70 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-indigo-400" />
              <h2 className="text-sm font-bold text-white">Pratik Yap (Botla Oyna)</h2>
            </div>
            <span className="text-[11px] text-indigo-300 font-medium">Anında Başla</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {GAMES_META.map((g) => {
              const IconComp = g.icon;
              return (
                <button
                  key={g.id}
                  onClick={() => startMatch({ id: "bot_arena", name: "Arena Botu" }, g.id, true, null, true)}
                  className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-indigo-600/20 border border-slate-800 hover:border-indigo-500/40 text-left flex items-center gap-2.5 transition active:scale-[0.98]"
                >
                  <IconComp className="w-4 h-4 text-indigo-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{g.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">{g.badge}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              Aktif Oyuncular ({users.length})
            </h2>
            <span className="text-[11px] text-slate-400">Davet et veya mesaj at</span>
          </div>

          {users.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 text-center">
              Şu an lobide başka oyuncu görünmüyor. Arkadaşına site linkini gönder veya Bot ile oyna!
            </p>
          ) : (
            <div className="space-y-2">
              {users.map((u) => {
                const isBusy = u.status === "in_game";
                const unreadDm = dmUnreadByPeer[u.id] || 0;
                return (
                  <div
                    key={u.id}
                    className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CircleDot className={`w-3.5 h-3.5 shrink-0 ${isBusy ? "text-amber-400" : "text-emerald-400"}`} />
                      <div className="truncate">
                        <div className="text-sm font-semibold text-white truncate">
                          {u.name} <span className="text-xs text-amber-300 font-bold">({Number(u.wins || 0)}p)</span>
                        </div>
                        <div className="text-[11px] text-slate-400">{isBusy ? "Oyunda" : "Müsait"}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => openDirectMessage(u)}
                        className="relative p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200"
                      >
                        <MessageCircle className="w-4 h-4" />
                        {unreadDm > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-[10px] font-bold flex items-center justify-center text-white">
                            {unreadDm}
                          </span>
                        )}
                      </button>

                      <button
                        disabled={isBusy}
                        onClick={() => {
                          setSelectedTargetUser(u);
                          setSelectedGameForInvite("rps");
                        }}
                        className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs font-bold text-white flex items-center gap-1"
                      >
                        <Swords className="w-3.5 h-3.5" />
                        Davet Et
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              En Çok Kazananlar
            </h2>
            <span className="text-[11px] text-slate-400">Galibiyet = +1 Puan</span>
          </div>

          <div className="space-y-1.5">
            {leaderboardList.slice(0, 5).map((entry, idx) => (
              <div
                key={entry.id}
                className={`px-3 py-2 rounded-xl border flex items-center justify-between text-xs ${
                  entry.isMe
                    ? "bg-indigo-950/50 border-indigo-500/40 text-white"
                    : "bg-slate-950/70 border-slate-800 text-slate-200"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-amber-300 font-extrabold text-[11px] flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="font-semibold truncate">
                    {entry.name} {entry.isMe ? "(Sen)" : ""}
                  </span>
                </div>
                <span className="font-extrabold text-amber-300 shrink-0">{entry.wins} Puan</span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <button
            onClick={() => {
              setGlobalChatOpen((o) => !o);
              setGlobalUnread(0);
            }}
            className="w-full flex items-center justify-between text-left"
          >
            <span className="text-sm font-bold text-white flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-indigo-400" />
              Lobi Genel Sohbeti
              {globalUnread > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-600 text-[10px] font-bold text-white">
                  {globalUnread}
                </span>
              )}
            </span>
            {globalChatOpen ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {globalChatOpen && (
            <>
              <div className="h-44 overflow-y-auto space-y-2 pr-1 bg-slate-950/60 rounded-xl p-2.5 border border-slate-800/70">
                {visibleGlobalMessages.map((m) => {
                  const mine = m.senderId === myId;
                  return (
                    <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                      <span className="text-[10px] text-slate-400 mb-0.5">{m.senderName}</span>
                      <div className={`px-3 py-1.5 rounded-2xl text-xs max-w-[82%] ${mine ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-100"}`}>
                        {m.text}
                      </div>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={handleSendGlobalMessage} className="flex gap-2">
                <input
                  type="text"
                  value={globalInput}
                  onChange={(e) => setGlobalInput(e.target.value)}
                  placeholder="Lobiye mesaj yaz (1 saatte silinir)..."
                  className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
                <button type="submit" className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white">
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          )}
        </section>
      </main>

      {selectedTargetUser && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-white">{selectedTargetUser.name} kişisine davet gönder</h3>
                <p className="text-xs text-slate-400">Oynamak istediğiniz oyunu seçin</p>
              </div>
              <button onClick={() => setSelectedTargetUser(null)} className="p-1.5 rounded-xl bg-slate-800 text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {GAMES_META.map((g) => {
                const IconComp = g.icon;
                const active = selectedGameForInvite === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGameForInvite(g.id)}
                    className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition ${
                      active
                        ? "bg-indigo-600/20 border-indigo-500 text-white"
                        : "bg-slate-950/70 border-slate-800 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <IconComp className="w-5 h-5 text-indigo-400" />
                      <div>
                        <div className="text-sm font-bold">{g.name}</div>
                        <div className="text-xs text-slate-400">{g.desc}</div>
                      </div>
                    </div>
                    {active && <Check className="w-4 h-4 text-indigo-400" />}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => sendGameInvite(selectedTargetUser, selectedGameForInvite)}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-sm text-white"
            >
              Daveti Gönder
            </button>
          </div>
        </div>
      )}

      {dmTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div>
                <h3 className="text-sm font-extrabold text-white">{dmTarget.name}</h3>
                <p className="text-[11px] text-emerald-400">Özel Sohbet • 1 saatte silinir</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    const target = dmTarget;
                    setDmTarget(null);
                    setSelectedTargetUser(target);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-bold"
                >
                  Oyun Daveti
                </button>
                <button onClick={() => setDmTarget(null)} className="p-1.5 rounded-xl bg-slate-800 text-slate-300">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="h-52 overflow-y-auto space-y-2 p-2 bg-slate-950/70 rounded-2xl border border-slate-800">
              {activeDmList.length === 0 ? (
                <p className="text-center text-xs text-slate-500 pt-16">
                  {dmTarget.name} ile ilk mesajı sen gönder.
                </p>
              ) : (
                activeDmList.map((m) => {
                  const mine = m.senderId === myId;
                  return (
                    <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                      <div className={`px-3 py-1.5 rounded-2xl text-xs max-w-[80%] ${mine ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-100"}`}>
                        {m.text}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleSendDirectMessage} className="flex gap-2">
              <input
                type="text"
                value={dmInput}
                onChange={(e) => setDmInput(e.target.value)}
                placeholder={`${dmTarget.name} kişisine yaz...`}
                className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
              <button type="submit" className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
