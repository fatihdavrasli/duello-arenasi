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

// İstersen kendi Firebase Realtime Database config bilgilerini buraya yaz:
const FIREBASE_CONFIG =
  typeof window !== "undefined" && window.__FIREBASE_CONFIG__
    ? window.__FIREBASE_CONFIG__
    : null;

const GAMES_META = [
  {
    id: "battleship",
    name: "Amiral Battı",
    desc: "6x6 hızlı deniz savaşı",
    badge: "Strateji",
    icon: Ship,
  },
  {
    id: "rps",
    name: "Taş Kağıt Makas",
    desc: "3 turluk refleks düellosu",
    badge: "Hızlı",
    icon: Swords,
  },
  {
    id: "ttt",
    name: "Tic Tac Toe",
    desc: "3x3 sıra tabanlı XOX",
    badge: "Klasik",
    icon: Hash,
  },
  {
    id: "wordle",
    name: "Kelime Bulma",
    desc: "5 harfli Türkçe kelime yarışı",
    badge: "Kelime",
    icon: Type,
  },
  {
    id: "sudoku",
    name: "Sudoku",
    desc: "4x4 mini sudoku hız yarışı",
    badge: "Zeka",
    icon: Grid,
  },
];

const TURKISH_WORDS = [
  "KALEM",
  "KITAP",
  "DENIZ",
  "BULUT",
  "MASAL",
  "YILDIZ",
  "BAHCE",
  "SEHIR",
  "MUZIK",
  "SABAH",
  "RÜZGAR",
  "GÜNES",
  "KÖPRÜ",
  "ORMAN",
  "LIMAN",
  "SAHIL",
  "KAVUN",
  "ÇICEK",
  "BARIS",
  "UMUTL",
].map((w) => w.slice(0, 5));

const WORD_POOL = [
  "KALEM",
  "KITAP",
  "DENIZ",
  "BULUT",
  "MASAL",
  "BAHCE",
  "SEHIR",
  "MUZIK",
  "SABAH",
  "ORMAN",
  "LIMAN",
  "SAHIL",
  "KAVUN",
  "BARIS",
  "MARTI",
  "KÖPEK",
  "KEDİC",
  "DALGA",
  "TOPRAK",
  "KULEL",
].map((w) => w.slice(0, 5));

const CLEAN_WORDS = [
  "KALEM",
  "KITAP",
  "DENIZ",
  "BULUT",
  "MASAL",
  "BAHCE",
  "SEHIR",
  "MUZIK",
  "SABAH",
  "ORMAN",
  "LIMAN",
  "SAHIL",
  "KAVUN",
  "BARIS",
  "MARTI",
  "DALGA",
  "YAPRAK",
  "KAPIK",
  "GÖZLÜ",
  "SEVGİ",
].map((w) => w.slice(0, 5));

const FINAL_WORDS = [
  "KALEM",
  "KITAP",
  "DENIZ",
  "BULUT",
  "MASAL",
  "BAHCE",
  "SEHIR",
  "MUZIK",
  "SABAH",
  "ORMAN",
  "LIMAN",
  "SAHIL",
  "KAVUN",
  "BARIS",
  "MARTI",
  "DALGA",
  "KAVUS",
  "RADYO",
  "MELEK",
  "TARLA",
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

const QUICK_REPLIES = [
  "İyi hamle! 👏",
  "Şanslıydın 😄",
  "Çok yakındı! 🔥",
  "Rövanş? 🔄",
];

const EMOJIS = ["👏", "😂", "🔥", "😱", "🤔", "👑"];

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

function getBotChatReply(text, gameType) {
  const lower = (text || "").toLowerCase();
  if (lower.includes("rövanş") || lower.includes("tekrar")) {
    return "Hemen bir rövanş daha atalım, hazırım! 🔥";
  }
  if (lower.includes("şans") || lower.includes("nasıl")) {
    return "Tamamen hesaplanmış strateji 😄";
  }
  if (gameType === "battleship") {
    return "Radarlarım açık, gemilerim sağlam! 🚢";
  }
  if (gameType === "wordle") {
    return "Harfleri iyi analiz et, 5 harf seni bekliyor! 🔤";
  }
  if (gameType === "sudoku") {
    return "Satır ve sütunlara dikkat, hızlanıyorum! 🧠";
  }
  return "Güzel gidiyor, bakalım kim kazanacak! 👏";
}

function checkTTTWinner(board) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: [a, b, c] };
    }
  }
  if (board.every((cell) => Boolean(cell))) {
    return { winner: "draw", line: [] };
  }
  return null;
}

function evaluateWordleGuess(guess, target) {
  const res = Array(5).fill("absent");
  const targetArr = target.split("");
  const guessArr = guess.split("");
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
export default function App() {
  const [nickname, setNickname] = useState("");
  const [enteredLobby, setEnteredLobby] = useState(false);
  const [myId] = useState(() => {
    const existing =
      typeof window !== "undefined"
        ? window.sessionStorage.getItem("duello_my_id")
        : null;
    if (existing) return existing;
    const created = "usr_" + Math.random().toString(36).slice(2, 9);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("duello_my_id", created);
    }
    return created;
  });

  const [users, setUsers] = useState([]);
  const [incomingInvite, setIncomingInvite] = useState(null);
  const [outgoingInvite, setOutgoingInvite] = useState(null);
  const [selectedTargetUser, setSelectedTargetUser] = useState(null);
  const [selectedGameForInvite, setSelectedGameForInvite] = useState("rps");

  // Sohbet durumları
  const [globalChatOpen, setGlobalChatOpen] = useState(true);
  const [globalMessages, setGlobalMessages] = useState([
    {
      id: "m_init_1",
      senderId: "sys",
      senderName: "Arena Botu",
      text: "Düello Arenası'na hoş geldin! Aktif oyuncularla sohbet edebilir veya meydan okuyabilirsin.",
      ts: Date.now() - 60000,
    },
  ]);
  const [globalInput, setGlobalInput] = useState("");
  const [globalUnread, setGlobalUnread] = useState(0);

  const [dmTarget, setDmTarget] = useState(null);
  const [dmMessagesByPeer, setDmMessagesByPeer] = useState({});
  const [dmUnreadByPeer, setDmUnreadByPeer] = useState({});
  const [dmInput, setDmInput] = useState("");

  const [matchDrawerOpen, setMatchDrawerOpen] = useState(false);
  const [matchMessages, setMatchMessages] = useState([]);
  const [matchInput, setMatchInput] = useState("");
  const [matchUnread, setMatchUnread] = useState(0);
  const [floatingReaction, setFloatingReaction] = useState(null);

  // Aktif maç durumu
  const [activeMatch, setActiveMatch] = useState(null);

  // Oyun 1: Amiral Battı (6x6)
  const [myShipGrid, setMyShipGrid] = useState(() => autoPlaceShips(6));
  const [myShotsOnEnemy, setMyShotsOnEnemy] = useState(() => createEmptyGrid(6));
  const [enemyGridForBot, setEnemyGridForBot] = useState(() => autoPlaceShips(6));
  const [enemyShotsOnMe, setEnemyShotsOnMe] = useState(() => createEmptyGrid(6));
  const [bsTurn, setBsTurn] = useState("me");
  const [bsStatus, setBsStatus] = useState("Sıra sende! Düşman denizinde bir kare seç.");
  const [bsWinner, setBsWinner] = useState(null);

  // Oyun 2: Taş Kağıt Makas (3 tur)
  const [rpsRound, setRpsRound] = useState(1);
  const [rpsMyScore, setRpsMyScore] = useState(0);
  const [rpsOppScore, setRpsOppScore] = useState(0);
  const [rpsMyPick, setRpsMyPick] = useState(null);
  const [rpsOppPick, setRpsOppPick] = useState(null);
  const [rpsRoundText, setRpsRoundText] = useState("1. Tur: Seçimini yap!");
  const [rpsMatchWinner, setRpsMatchWinner] = useState(null);

  // Oyun 3: Tic Tac Toe (3x3)
  const [tttBoard, setTttBoard] = useState(Array(9).fill(""));
  const [tttTurn, setTttTurn] = useState("X");
  const [tttResult, setTttResult] = useState(null);

  // Oyun 4: Kelime Bulma (5 harfli Türkçe)
  const [wordTarget, setWordTarget] = useState(() => {
    return FINAL_WORDS[Math.floor(Math.random() * FINAL_WORDS.length)];
  });
  const [wordGuesses, setWordGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [wordStatus, setWordStatus] = useState("5 harfli kelimeyi bulmak için tahmin gir!");
  const [wordFinished, setWordFinished] = useState(false);
  const [oppWordProgress, setOppWordProgress] = useState(0);

  // Oyun 5: Sudoku (4x4)
  const [sudokuIndex, setSudokuIndex] = useState(0);
  const [sudokuBoard, setSudokuBoard] = useState(() =>
    SUDOKU_PUZZLES[0].puzzle.map((r) => [...r])
  );
  const [selectedCell, setSelectedCell] = useState([0, 1]);
  const [sudokuMessage, setSudokuMessage] = useState("Boş kareye 1-4 arası rakam yerleştir.");
  const [sudokuWinner, setSudokuWinner] = useState(null);
  const [oppSudokuProgress, setOppSudokuProgress] = useState(0);

  const dbRef = useRef(null);
  const activeMatchRef = useRef(null);
  activeMatchRef.current = activeMatch;

  const myStatus = activeMatch ? "in_game" : "online";

  // Firebase bağlantısı (opsiyonel; yoksa yerel/bot modda çalışır)
  useEffect(() => {
    if (!FIREBASE_CONFIG || !FIREBASE_CONFIG.databaseURL) return;
    try {
      const app = getApps().length
        ? getApps()[0]
        : initializeApp(FIREBASE_CONFIG);
      const db = getDatabase(app);
      dbRef.current = db;
    } catch (err) {
      console.error("Firebase başlatılamadı:", err);
    }
  }, []);

  // Lobi presence ve aktif kullanıcı listesi
  useEffect(() => {
    if (!enteredLobby) return;
    const cleanName = nickname.trim() || "Oyuncu";

    if (dbRef.current) {
      const userRef = ref(dbRef.current, `users/${myId}`);
      set(userRef, {
        id: myId,
        name: cleanName,
        status: myStatus,
        updatedAt: Date.now(),
      });
      onDisconnect(userRef).remove();

      const allUsersRef = ref(dbRef.current, "users");
      const unsubUsers = onValue(allUsersRef, (snap) => {
        const val = snap.val() || {};
        const list = Object.values(val).filter((u) => u && u.id !== myId);
        setUsers(list);
      });

      const inviteRef = ref(dbRef.current, `invites/${myId}`);
      const unsubInvite = onValue(inviteRef, (snap) => {
        const val = snap.val();
        if (val && val.status === "pending") {
          setIncomingInvite(val);
        } else {
          setIncomingInvite(null);
        }
      });

      const globalRef = ref(dbRef.current, "chats/global");
      const unsubGlobal = onValue(globalRef, (snap) => {
        const val = snap.val() || {};
        const arr = Object.values(val).sort((a, b) => (a.ts || 0) - (b.ts || 0));
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
      // Yerel test modu için örnek çevrimiçi rakipler
      setUsers([
        { id: "demo_alice", name: "Zeynep", status: "online" },
        { id: "demo_mert", name: "Mert", status: "online" },
        { id: "demo_eda", name: "Eda", status: "in_game" },
      ]);
    }
  }, [enteredLobby, nickname, myId, myStatus, globalChatOpen]);

  // Firebase maç odası senkronizasyonu
  useEffect(() => {
    if (!dbRef.current || !activeMatch || activeMatch.isBot) return;
    const roomId = activeMatch.roomId;
    const roomRef = ref(dbRef.current, `matches/${roomId}`);
    const unsub = onValue(roomRef, (snap) => {
      const data = snap.val();
      if (!data) return;

      if (Array.isArray(data.chatList)) {
        setMatchMessages((prev) => {
          if (data.chatList.length > prev.length && !matchDrawerOpen) {
            const added = data.chatList.slice(prev.length);
            const fromOther = added.filter((m) => m.senderId !== myId).length;
            if (fromOther > 0) {
              setMatchUnread((u) => u + fromOther);
            }
          }
          return data.chatList;
        });
      }

      if (data.reaction && data.reaction.ts) {
        setFloatingReaction((prev) => {
          if (!prev || prev.ts !== data.reaction.ts) {
            return data.reaction;
          }
          return prev;
        });
      }

      if (data.gameState) {
        const gs = data.gameState;
        const isP1 = activeMatch.isHost;
        if (activeMatch.gameType === "ttt" && Array.isArray(gs.board)) {
          setTttBoard(gs.board);
          setTttTurn(gs.turn || "X");
          setTttResult(gs.result || null);
        } else if (activeMatch.gameType === "rps") {
          setRpsRound(gs.round || 1);
          setRpsMyScore(isP1 ? gs.p1Score || 0 : gs.p2Score || 0);
          setRpsOppScore(isP1 ? gs.p2Score || 0 : gs.p1Score || 0);
          setRpsMyPick(isP1 ? gs.p1Pick || null : gs.p2Pick || null);
          setRpsOppPick(isP1 ? gs.p2Pick || null : gs.p1Pick || null);
          if (gs.roundText) setRpsRoundText(gs.roundText);
          setRpsMatchWinner(gs.winner || null);
        }
      }
    });

    return () => unsub();
  }, [activeMatch, myId, matchDrawerOpen]);

  function resetAllGameStates(gameType, isBotMatch = false) {
    const freshShips = autoPlaceShips(6);
    setMyShipGrid(freshShips);
    setMyShotsOnEnemy(createEmptyGrid(6));
    setEnemyGridForBot(autoPlaceShips(6));
    setEnemyShotsOnMe(createEmptyGrid(6));
    setBsTurn("me");
    setBsStatus("Sıra sende! Düşman denizinde bir kare seç.");
    setBsWinner(null);

    setRpsRound(1);
    setRpsMyScore(0);
    setRpsOppScore(0);
    setRpsMyPick(null);
    setRpsOppPick(null);
    setRpsRoundText("1. Tur: Seçimini yap!");
    setRpsMatchWinner(null);

    setTttBoard(Array(9).fill(""));
    setTttTurn("X");
    setTttResult(null);

    const chosenWord =
      FINAL_WORDS[Math.floor(Math.random() * FINAL_WORDS.length)];
    setWordTarget(chosenWord);
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

    setMatchMessages([
      {
        id: "m_" + Date.now(),
        senderId: "sys",
        senderName: "Sistem",
        text: `${
          GAMES_META.find((g) => g.id === gameType)?.name || "Oyun"
        } maçı başladı! Başarılar.`,
        ts: Date.now(),
      },
    ]);
    setMatchUnread(0);
    setMatchDrawerOpen(false);
    setFloatingReaction(null);

    if (isBotMatch && gameType === "sudoku") {
      setTimeout(() => {
        setOppSudokuProgress(35);
      }, 2500);
    }
  }

  function startMatch(opponent, gameType, isBot = false, customRoomId = null) {
    const roomId =
      customRoomId ||
      `room_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const matchObj = {
      roomId,
      gameType,
      isBot,
      isHost: true,
      opponent: {
        id: opponent.id,
        name: opponent.name,
      },
    };
    resetAllGameStates(gameType, isBot);
    setActiveMatch(matchObj);
    setSelectedTargetUser(null);
    setOutgoingInvite(null);
    setIncomingInvite(null);

    if (dbRef.current && !isBot) {
      set(ref(dbRef.current, `matches/${roomId}`), {
        roomId,
        gameType,
        players: [myId, opponent.id],
        createdAt: Date.now(),
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
          board: Array(9).fill(""),
          turn: "X",
          round: 1,
          p1Score: 0,
          p2Score: 0,
        },
      });
    }
  }

  function sendGameInvite(targetUser, gameId) {
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
      // Yerel/demo modda davet gönderildiğinde hızlıca maç başlatma seçeneği sun
      setOutgoingInvite(invitePayload);
      setSelectedTargetUser(null);
      setTimeout(() => {
        startMatch(targetUser, gameMeta.id, false, `local_${Date.now()}`);
      }, 900);
    }
  }

  function acceptIncomingInvite() {
    if (!incomingInvite) return;
    const roomId = `room_${Date.now()}`;
    if (dbRef.current) {
      set(ref(dbRef.current, `invites/${myId}`), null);
    }
    const matchObj = {
      roomId,
      gameType: incomingInvite.gameId,
      isBot: false,
      isHost: false,
      opponent: {
        id: incomingInvite.fromId,
        name: incomingInvite.fromName,
      },
    };
    resetAllGameStates(incomingInvite.gameId, false);
    setActiveMatch(matchObj);
    setIncomingInvite(null);
  }

  function declineIncomingInvite() {
    if (!incomingInvite) return;
    if (dbRef.current) {
      set(ref(dbRef.current, `invites/${myId}`), null);
    }
    setIncomingInvite(null);
  }

  function leaveMatch() {
    if (dbRef.current && activeMatch && !activeMatch.isBot) {
      update(ref(dbRef.current, `matches/${activeMatch.roomId}`), {
        leftBy: myId,
      });
    }
    setActiveMatch(null);
    setMatchDrawerOpen(false);
  }

  // Lobi Genel Sohbet Gönderme
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

    if (dbRef.current) {
      push(ref(dbRef.current, "chats/global"), msg);
    } else {
      setGlobalMessages((prev) => [...prev.slice(-49), msg]);
    }
  }

  // Özel Sohbet (DM) Gönderme
  function openDirectMessage(peer) {
    setDmTarget(peer);
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

    setDmMessagesByPeer((prev) => ({
      ...prev,
      [dmTarget.id]: [...(prev[dmTarget.id] || []), msg],
    }));
    setDmInput("");

    if (dbRef.current) {
      const threadId = [myId, dmTarget.id].sort().join("__");
      push(ref(dbRef.current, `chats/dm/${threadId}`), msg);
    } else {
      setTimeout(() => {
        const reply = {
          id: "dm_rep_" + Date.now(),
          senderId: dmTarget.id,
          senderName: dmTarget.name,
          text: `Selam ${nickname.trim() || "dostum"}! İstersen hemen bir oyun daveti atabilirsin 🎮`,
          ts: Date.now(),
        };
        setDmMessagesByPeer((prev) => ({
          ...prev,
          [dmTarget.id]: [...(prev[dmTarget.id] || []), reply],
        }));
        setDmUnreadByPeer((prev) => ({
          ...prev,
          [dmTarget.id]:
            dmTarget?.id === dmTarget.id ? 0 : (prev[dmTarget.id] || 0) + 1,
        }));
      }, 900);
    }
  }

  // Oyun İçi Maç Sohbeti & Emoji Tepkisi
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
        if (!matchDrawerOpen) {
          setMatchUnread((u) => u + 1);
        }
      }, 750);
    }
  }

  function handleSendEmojiReaction(emoji) {
    const reaction = {
      emoji,
      fromName: nickname.trim() || "Sen",
      ts: Date.now(),
    };
    setFloatingReaction(reaction);
    if (dbRef.current && activeMatch && !activeMatch.isBot) {
      update(ref(dbRef.current, `matches/${activeMatch.roomId}`), {
        reaction,
      });
    }
  }
    // --- OYUN 1: AMİRAL BATTI ---
  function handleBattleshipAttack(r, c) {
    if (bsWinner || bsTurn !== "me") return;
    if (myShotsOnEnemy[r][c] !== 0) return;

    const targetGrid = activeMatch?.isBot ? enemyGridForBot : enemyGridForBot;
    const hit = targetGrid[r][c] === 1;

    const nextShots = myShotsOnEnemy.map((row, ri) =>
      row.map((val, ci) => (ri === r && ci === c ? (hit ? 2 : 1) : val))
    );
    setMyShotsOnEnemy(nextShots);

    const totalShips = countShipCells(targetGrid);
    const myHits = nextShots.reduce(
      (sum, row) => sum + row.reduce((s, cell) => s + (cell === 2 ? 1 : 0), 0),
      0
    );

    if (totalShips > 0 && myHits >= totalShips) {
      setBsWinner("me");
      setBsStatus("Tebrikler! Düşman filosunu tamamen batırdın!");
      return;
    }

    setBsTurn("opp");
    setBsStatus(
      hit
        ? "İSABET! Rakip karşı saldırıya hazırlanıyor..."
        : "ISKA! Rakibin sırası..."
    );

    setTimeout(() => {
      let er = Math.floor(Math.random() * 6);
      let ec = Math.floor(Math.random() * 6);
      let guard = 0;
      while (enemyShotsOnMe[er][ec] !== 0 && guard < 100) {
        er = Math.floor(Math.random() * 6);
        ec = Math.floor(Math.random() * 6);
        guard++;
      }
      const oppHit = myShipGrid[er][ec] === 1;
      const nextOppShots = enemyShotsOnMe.map((row, ri) =>
        row.map((val, ci) => (ri === er && ci === ec ? (oppHit ? 2 : 1) : val))
      );
      setEnemyShotsOnMe(nextOppShots);

      const myTotal = countShipCells(myShipGrid);
      const oppHits = nextOppShots.reduce(
        (sum, row) => sum + row.reduce((s, cell) => s + (cell === 2 ? 1 : 0), 0),
        0
      );
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

  // --- OYUN 2: TAŞ KAĞIT MAKAS ---
  function handleRPSPick(choice) {
    if (rpsMatchWinner || rpsMyPick) return;
    const choices = ["rock", "paper", "scissors"];
    const oppChoice = choices[Math.floor(Math.random() * choices.length)];
    setRpsMyPick(choice);
    setRpsOppPick(oppChoice);

    let outcome = "draw";
    if (
      (choice === "rock" && oppChoice === "scissors") ||
      (choice === "paper" && oppChoice === "rock") ||
      (choice === "scissors" && oppChoice === "paper")
    ) {
      outcome = "win";
    } else if (choice !== oppChoice) {
      outcome = "lose";
    }

    const nextMyScore = rpsMyScore + (outcome === "win" ? 1 : 0);
    const nextOppScore = rpsOppScore + (outcome === "lose" ? 1 : 0);
    setRpsMyScore(nextMyScore);
    setRpsOppScore(nextOppScore);

    const labelMap = {
      rock: "Taş",
      paper: "Kağıt",
      scissors: "Makas",
    };

    const msg =
      outcome === "win"
        ? `Tur ${rpsRound}: ${labelMap[choice]} > ${labelMap[oppChoice]} — Sen kazandın!`
        : outcome === "lose"
        ? `Tur ${rpsRound}: ${labelMap[choice]} < ${labelMap[oppChoice]} — Rakip aldı!`
        : `Tur ${rpsRound}: İkiniz de ${labelMap[choice]} seçtiniz — Berabere!`;
    setRpsRoundText(msg);

    if (dbRef.current && activeMatch && !activeMatch.isBot) {
      update(ref(dbRef.current, `matches/${activeMatch.roomId}/gameState`), {
        round: rpsRound,
        p1Score: activeMatch.isHost ? nextMyScore : nextOppScore,
        p2Score: activeMatch.isHost ? nextOppScore : nextMyScore,
        roundText: msg,
      });
    }

    if (rpsRound >= 3 || nextMyScore === 2 || nextOppScore === 2) {
      setTimeout(() => {
        if (nextMyScore > nextOppScore) {
          setRpsMatchWinner("me");
        } else if (nextOppScore > nextMyScore) {
          setRpsMatchWinner("opp");
        } else {
          setRpsMatchWinner("draw");
        }
      }, 700);
    } else {
      setTimeout(() => {
        setRpsRound((r) => r + 1);
        setRpsMyPick(null);
        setRpsOppPick(null);
        setRpsRoundText(`${rpsRound + 1}. Tur: Seçimini yap!`);
      }, 1100);
    }
  }

  // --- OYUN 3: TİC TAC TOE ---
  function handleTTTMove(idx) {
    if (tttResult || tttBoard[idx]) return;
    if (!activeMatch?.isBot && tttTurn !== "X") return;

    const nextBoard = [...tttBoard];
    nextBoard[idx] = tttTurn;
    const res = checkTTTWinner(nextBoard);
    const nextTurn = tttTurn === "X" ? "O" : "X";

    setTttBoard(nextBoard);
    setTttTurn(nextTurn);
    setTttResult(res);

    if (dbRef.current && activeMatch && !activeMatch.isBot) {
      update(ref(dbRef.current, `matches/${activeMatch.roomId}/gameState`), {
        board: nextBoard,
        turn: nextTurn,
        result: res,
      });
    }

    if (!res && activeMatch?.isBot && nextTurn === "O") {
      setTimeout(() => {
        const emptyIndices = nextBoard
          .map((v, i) => (v === "" ? i : -1))
          .filter((i) => i !== -1);
        if (emptyIndices.length === 0) return;
        const botChoice =
          emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
        const afterBot = [...nextBoard];
        afterBot[botChoice] = "O";
        const botRes = checkTTTWinner(afterBot);
        setTttBoard(afterBot);
        setTttTurn("X");
        setTttResult(botRes);
      }, 450);
    }
  }

  // --- OYUN 4: KELİME BULMA ---
  function handleWordKey(key) {
    if (wordFinished) return;
    if (key === "SIL") {
      setCurrentGuess((g) => g.slice(0, -1));
      return;
    }
    if (key === "GIR") {
      if (currentGuess.length !== 5) {
        setWordStatus("Lütfen 5 harf gir.");
        return;
      }
      const evalRow = evaluateWordleGuess(currentGuess, wordTarget);
      const nextGuesses = [
        ...wordGuesses,
        { word: currentGuess, eval: evalRow },
      ];
      setWordGuesses(nextGuesses);
      setCurrentGuess("");

      if (activeMatch?.isBot) {
        setOppWordProgress((p) => Math.min(100, p + 22));
      }

      if (currentGuess === wordTarget) {
        setWordStatus(`Harika! "${wordTarget}" kelimesini buldun!`);
        setWordFinished(true);
      } else if (nextGuesses.length >= 6) {
        setWordStatus(`Hakların bitti! Doğru kelime: ${wordTarget}`);
        setWordFinished(true);
      } else {
        setWordStatus(`${6 - nextGuesses.length} tahmin hakkın kaldı.`);
      }
      return;
    }
    if (currentGuess.length < 5) {
      setCurrentGuess((g) => g + key);
    }
  }

  // --- OYUN 5: 4x4 SUDOKU ---
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

    let filledCount = 0;
    let allCorrect = true;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        if (nextBoard[i][j] !== 0) filledCount++;
        if (nextBoard[i][j] !== puzzle.solution[i][j]) {
          allCorrect = false;
        }
      }
    }

    if (allCorrect) {
      setSudokuWinner("me");
      setSudokuMessage("4x4 Sudoku'yu hatasız tamamladın! Kazandın!");
    } else if (filledCount === 16) {
      setSudokuMessage("Bazı karelerde çakışma var, kontrol et!");
    } else {
      setSudokuMessage(`İlerleme: ${Math.round((filledCount / 16) * 100)}%`);
    }
  }

  const activeDmList = useMemo(() => {
    if (!dmTarget) return [];
    return dmMessagesByPeer[dmTarget.id] || [];
  }, [dmTarget, dmMessagesByPeer]);
    // --- GİRİŞ EKRANI ---
  if (!enteredLobby) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-5 select-none">
        <div className="max-w-md w-full mx-auto my-auto space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 mb-1">
              <Gamepad2 className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Düello Arenası
            </h1>
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
              <div className="font-semibold text-slate-200">Canlı Sohbet</div>
              <div>Lobi, DM & Maç İçi</div>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5">
              <div className="font-semibold text-slate-200">Bot Modu</div>
              <div>Tek başına test et</div>
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-500">
          {FIREBASE_CONFIG?.databaseURL
            ? "Firebase Realtime Database bağlı"
            : "Yerel & Bot modu aktif (Firebase eklendiğinde çoklu cihaz senkronize çalışır)"}
        </p>
      </div>
    );
  }

  // --- AKTİF MAÇ EKRANI ---
  if (activeMatch) {
    const gameInfo =
      GAMES_META.find((g) => g.id === activeMatch.gameType) || GAMES_META[1];

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-20 relative">
        {floatingReaction && (
          <div className="fixed top-20 right-5 z-50 bg-slate-900/95 border border-slate-700 px-3.5 py-2 rounded-2xl shadow-2xl flex items-center gap-2 animate-bounce">
            <span className="text-2xl">{floatingReaction.emoji}</span>
            <span className="text-xs font-medium text-slate-300">
              {floatingReaction.fromName}
            </span>
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
              onClick={() => resetAllGameStates(activeMatch.gameType, activeMatch.isBot)}
              title="Yeniden Başlat"
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
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 text-center">
                <p className="text-sm font-semibold text-indigo-300">{bsStatus}</p>
                {bsWinner && (
                  <p className="mt-1 text-base font-extrabold text-emerald-400">
                    {bsWinner === "me" ? "KAZANDIN! 🎉" : "RAKİP KAZANDI!"}
                  </p>
                )}
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-400 mb-1.5 flex justify-between">
                  <span>DÜŞMAN DENİZİ (Saldırmak için dokun)</span>
                  <span>{bsTurn === "me" ? "Sıra Sende" : "Rakibin Sırası"}</span>
                </div>
                <div className="grid grid-cols-6 gap-1.5 bg-slate-900 p-2.5 rounded-2xl border border-slate-800">
                  {myShotsOnEnemy.map((row, r) =>
                    row.map((cell, c) => (
                      <button
                        key={`atk-${r}-${c}`}
                        onClick={() => handleBattleshipAttack(r, c)}
                        className={`aspect-square rounded-lg font-bold text-sm flex items-center justify-center transition ${
                          cell === 2
                            ? "bg-rose-600 text-white"
                            : cell === 1
                            ? "bg-slate-700 text-slate-400"
                            : "bg-sky-950/80 hover:bg-sky-900 border border-sky-800/50 text-sky-200"
                        }`}
                      >
                        {cell === 2 ? "💥" : cell === 1 ? "•" : ""}
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-400 mb-1.5">
                  SENİN FİLON
                </div>
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
            <div className="space-y-5">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center justify-between text-center">
                  <div className="flex-1">
                    <div className="text-xs text-slate-400">Sen</div>
                    <div className="text-3xl font-extrabold text-indigo-400">
                      {rpsMyScore}
                    </div>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-slate-800 text-xs font-bold text-slate-300">
                    TUR {Math.min(rpsRound, 3)}/3
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-slate-400">
                      {activeMatch.opponent.name}
                    </div>
                    <div className="text-3xl font-extrabold text-rose-400">
                      {rpsOppScore}
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-center text-sm font-medium text-slate-200">
                  {rpsRoundText}
                </p>
              </div>

              {(rpsMyPick || rpsOppPick) && (
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                    <div className="text-xs text-slate-400 mb-1">Seçimin</div>
                    <div className="text-4xl">
                      {rpsMyPick === "rock"
                        ? "🪨"
                        : rpsMyPick === "paper"
                        ? "📄"
                        : "✂️"}
                    </div>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                    <div className="text-xs text-slate-400 mb-1">Rakip</div>
                    <div className="text-4xl">
                      {rpsOppPick === "rock"
                        ? "🪨"
                        : rpsOppPick === "paper"
                        ? "📄"
                        : "✂️"}
                    </div>
                  </div>
                </div>
              )}

              {rpsMatchWinner ? (
                <div className="bg-emerald-950/50 border border-emerald-500/40 rounded-2xl p-5 text-center space-y-3">
                  <Trophy className="w-10 h-10 text-amber-400 mx-auto" />
                  <div className="text-xl font-extrabold text-white">
                    {rpsMatchWinner === "me"
                      ? "Düelloyu Kazandın!"
                      : rpsMatchWinner === "opp"
                      ? `${activeMatch.opponent.name} Kazandı!`
                      : "Maç Berabere Bitti!"}
                  </div>
                  <button
                    onClick={() => resetAllGameStates("rps", activeMatch.isBot)}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm text-white"
                  >
                    Yeni Maç Başlat
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "rock", emoji: "🪨", label: "Taş" },
                    { id: "paper", emoji: "📄", label: "Kağıt" },
                    { id: "scissors", emoji: "✂️", label: "Makas" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      disabled={Boolean(rpsMyPick)}
                      onClick={() => handleRPSPick(item.id)}
                      className="py-5 rounded-2xl bg-slate-900 hover:bg-indigo-600/20 border border-slate-800 hover:border-indigo-500/50 disabled:opacity-50 flex flex-col items-center gap-2 transition active:scale-95"
                    >
                      <span className="text-3xl">{item.emoji}</span>
                      <span className="text-xs font-bold text-slate-200">
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeMatch.gameType === "ttt" && (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 text-center">
                {tttResult ? (
                  <p className="text-base font-extrabold text-emerald-400">
                    {tttResult.winner === "draw"
                      ? "Berabere!"
                      : tttResult.winner === "X"
                      ? "X (Sen) Kazandın!"
                      : "O (Rakip) Kazandı!"}
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-slate-200">
                    Sıra:{" "}
                    <span className="text-indigo-400 font-bold">{tttTurn}</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2.5 aspect-square max-w-[320px] mx-auto">
                {tttBoard.map((cell, idx) => {
                  const isWinCell = tttResult?.line?.includes(idx);
                  return (
                    <button
                      key={idx}
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
                <p className="text-xs font-medium text-slate-200 text-center">
                  {wordStatus}
                </p>
                {activeMatch.isBot && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>{activeMatch.opponent.name} İlerlemesi</span>
                      <span>%{oppWordProgress}</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 transition-all"
                        style={{ width: `${oppWordProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 max-w-[290px] mx-auto">
                {Array.from({ length: 6 }).map((_, rowIdx) => {
                  const guessObj = wordGuesses[rowIdx];
                  const isCurrentRow = rowIdx === wordGuesses.length && !wordFinished;
                  return (
                    <div key={rowIdx} className="grid grid-cols-5 gap-1.5">
                      {Array.from({ length: 5 }).map((__, colIdx) => {
                        const letter = guessObj
                          ? guessObj.word[colIdx]
                          : isCurrentRow
                          ? currentGuess[colIdx] || ""
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
                    {kRow.map((k) => (
                      <button
                        key={k}
                        onClick={() => handleWordKey(k)}
                        className={`${
                          k === "GIR" || k === "SIL" ? "px-2.5 text-[11px]" : "w-7 text-xs"
                        } h-9 rounded-lg bg-slate-800 hover:bg-slate-700 font-bold text-slate-100 active:scale-95`}
                      >
                        {k === "GIR" ? "GİR" : k === "SIL" ? "⌫" : k}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeMatch.gameType === "sudoku" && (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2">
                <p className="text-sm font-semibold text-center text-indigo-300">
                  {sudokuMessage}
                </p>
                {activeMatch.isBot && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>{activeMatch.opponent.name} İlerlemesi</span>
                      <span>%{oppSudokuProgress}</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 transition-all"
                        style={{ width: `${oppSudokuProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2 max-w-[280px] mx-auto bg-slate-900 p-2.5 rounded-2xl border border-slate-800">
                {sudokuBoard.map((row, r) =>
                  row.map((val, c) => {
                    const isFixed = SUDOKU_PUZZLES[sudokuIndex].puzzle[r][c] !== 0;
                    const isSelected = selectedCell[0] === r && selectedCell[1] === c;
                    return (
                      <button
                        key={`${r}-${c}`}
                        onClick={() => setSelectedCell([r, c])}
                        className={`aspect-square rounded-xl text-xl font-extrabold flex items-center justify-center border transition ${
                          isSelected
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

        {/* Oyun İçi Sohbet Çekmecesi */}
        {matchDrawerOpen && (
          <div className="fixed inset-x-0 bottom-14 z-40 max-w-md mx-auto bg-slate-900 border-t border-x border-slate-700 rounded-t-3xl shadow-2xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-indigo-400" />
                Maç Sohbeti ({activeMatch.opponent.name})
              </span>
              <button
                onClick={() => setMatchDrawerOpen(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="h-44 overflow-y-auto space-y-2 pr-1">
              {matchMessages.map((m) => {
                const mine = m.senderId === myId;
                const sys = m.senderId === "sys";
                if (sys) {
                  return (
                    <div
                      key={m.id}
                      className="text-center text-[11px] text-slate-400 py-1"
                    >
                      {m.text}
                    </div>
                  );
                }
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${
                      mine ? "items-end" : "items-start"
                    }`}
                  >
                    <span className="text-[10px] text-slate-400 mb-0.5">
                      {m.senderName}
                    </span>
                    <div
                      className={`px-3 py-1.5 rounded-2xl text-xs max-w-[80%] ${
                        mine
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-800 text-slate-100"
                      }`}
                    >
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
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white"
              >
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
    // --- LOBİ EKRANI ---
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-12">
      <header className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold leading-tight text-white">
              Düello Arenası
            </h1>
            <p className="text-xs text-emerald-400">
              ● {nickname.trim() || "Oyuncu"} (Çevrimiçi)
            </p>
          </div>
        </div>

        <button
          onClick={() => setEnteredLobby(false)}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300"
        >
          Çıkış
        </button>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-5">
        {incomingInvite && (
          <div className="bg-indigo-950/70 border border-indigo-500/50 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
              <Bell className="w-4 h-4" />
              Gelen Meydan Okuma
            </div>
            <p className="text-sm text-white">
              <span className="font-bold">{incomingInvite.fromName}</span> seni{" "}
              <span className="font-bold text-amber-300">
                {incomingInvite.gameName}
              </span>{" "}
              oynamaya davet ediyor!
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

        {outgoingInvite && (
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-3.5 flex items-center justify-between">
            <div className="text-xs">
              <span className="text-amber-300 font-bold">
                {outgoingInvite.toName}
              </span>{" "}
              kişisine{" "}
              <span className="font-semibold text-white">
                {outgoingInvite.gameName}
              </span>{" "}
              daveti gönderildi...
            </div>
            <button
              onClick={() => {
                if (dbRef.current) {
                  remove(ref(dbRef.current, `invites/${outgoingInvite.toId}`));
                }
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
              <h2 className="text-sm font-bold text-white">
                Pratik Yap (Botla Oyna)
              </h2>
            </div>
            <span className="text-[11px] text-indigo-300 font-medium">
              Anında Başla
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {GAMES_META.map((g) => {
              const IconComp = g.icon;
              return (
                <button
                  key={g.id}
                  onClick={() =>
                    startMatch({ id: "bot_arena", name: "Arena Botu" }, g.id, true)
                  }
                  className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-indigo-600/20 border border-slate-800 hover:border-indigo-500/40 text-left flex items-center gap-2.5 transition active:scale-[0.98]"
                >
                  <IconComp className="w-4 h-4 text-indigo-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">
                      {g.name}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {g.badge}
                    </div>
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
            <span className="text-[11px] text-slate-400">
              Davet et veya mesaj at
            </span>
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
                      <CircleDot
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isBusy ? "text-amber-400" : "text-emerald-400"
                        }`}
                      />
                      <div className="truncate">
                        <div className="text-sm font-semibold text-white truncate">
                          {u.name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {isBusy ? "Oyunda" : "Müsait"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => openDirectMessage(u)}
                        className="relative p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200"
                        title="Özel Mesaj"
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
                {globalMessages.map((m) => {
                  const mine = m.senderId === myId;
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${
                        mine ? "items-end" : "items-start"
                      }`}
                    >
                      <span className="text-[10px] text-slate-400 mb-0.5">
                        {m.senderName}
                      </span>
                      <div
                        className={`px-3 py-1.5 rounded-2xl text-xs max-w-[82%] ${
                          mine
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-800 text-slate-100"
                        }`}
                      >
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
                  placeholder="Lobiye mesaj yaz..."
                  className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white"
                >
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
                <h3 className="text-base font-extrabold text-white">
                  {selectedTargetUser.name} kişisine davet gönder
                </h3>
                <p className="text-xs text-slate-400">
                  Oynamak istediğiniz oyunu seçin
                </p>
              </div>
              <button
                onClick={() => setSelectedTargetUser(null)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-300"
              >
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
              onClick={() =>
                sendGameInvite(selectedTargetUser, selectedGameForInvite)
              }
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
                <h3 className="text-sm font-extrabold text-white">
                  {dmTarget.name}
                </h3>
                <p className="text-[11px] text-emerald-400">Özel Sohbet</p>
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
                <button
                  onClick={() => setDmTarget(null)}
                  className="p-1.5 rounded-xl bg-slate-800 text-slate-300"
                >
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
                    <div
                      key={m.id}
                      className={`flex flex-col ${
                        mine ? "items-end" : "items-start"
                      }`}
                    >
                      <div
                        className={`px-3 py-1.5 rounded-2xl text-xs max-w-[80%] ${
                          mine
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-800 text-slate-100"
                        }`}
                      >
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
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
