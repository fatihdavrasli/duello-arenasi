import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
  Clock,
  Shield,
  Trash2,
  Ban,
  Flag,
  Lock,
  EyeOff,
  Eye,
  HelpCircle,
  UserPlus,
  Play,
  CornerUpLeft,
  Shuffle,
  Undo2,
  SkipForward,
  Layers,
} from "lucide-react";

const FIREBASE_CONFIG =
  typeof window !== "undefined" && window.__FIREBASE_CONFIG__
    ? window.__FIREBASE_CONFIG__
    : null;

const MESSAGE_TTL_MS = 60 * 60 * 1000; // 1 saat

const GAMES_META = [
  { id: "bluff", name: "Blöf", desc: "3+ kişilik kelime & blöf oyunu", badge: "3+ Kişi", icon: EyeOff },
  { id: "battleship", name: "Amiral Battı", desc: "6x6 hızlı deniz savaşı", badge: "Strateji", icon: Ship },
  { id: "rps", name: "Taş Kağıt Makas", desc: "5 turluk düello", badge: "5 Tur", icon: Swords },
  { id: "ttt", name: "Tic Tac Toe", desc: "3x3 sıra tabanlı XOX", badge: "Klasik", icon: Hash },
  { id: "wordle", name: "Kelime Bulma", desc: "5 harfli Türkçe kelime yarışı", badge: "Kelime", icon: Type },
  { id: "sudoku", name: "Sudoku", desc: "4x4 mini sudoku hız yarışı", badge: "Zeka", icon: Grid },
  { id: "kelimelik", name: "Kelimelik", desc: "7x7 tahtada kelime kur & puan topla", badge: "Yeni", icon: Layers },
];

const RANDOM_DUEL_GAME_IDS = [
  "kelimelik",
  "battleship",
  "rps",
  "ttt",
  "wordle",
  "sudoku",
];

const LOBBY_BOT_PLAYERS = [
  { id: "bot_efe", name: "Efe", isBot: true, status: "online", wins: 5, lastSeenAt: Date.now() - 1000 * 40 },
  { id: "bot_defne", name: "Defne", isBot: true, status: "online", wins: 7, lastSeenAt: Date.now() - 1000 * 75 },
  { id: "bot_arda", name: "Arda", isBot: true, status: "online", wins: 3, lastSeenAt: Date.now() - 1000 * 110 },
  { id: "bot_elif", name: "Elif", isBot: true, status: "online", wins: 6, lastSeenAt: Date.now() - 1000 * 150 },
  { id: "bot_kuzey", name: "Kuzey", isBot: true, status: "online", wins: 4, lastSeenAt: Date.now() - 1000 * 210 },
  { id: "bot_mira", name: "Mira", isBot: true, status: "online", wins: 8, lastSeenAt: Date.now() - 1000 * 260 },
];

const LOBBY_BOT_ID_SET = new Set(LOBBY_BOT_PLAYERS.map((b) => b.id));

const KELIMELIK_SIZE = 7;

const KELIMELIK_BONUS_MAP = {
  "0,0": "K2",
  "0,6": "K2",
  "6,0": "K2",
  "6,6": "K2",
  "1,3": "H2",
  "3,1": "H2",
  "3,5": "H2",
  "5,3": "H2",
  "3,3": "STAR",
};

const LETTER_POINTS_TR = {
  A: 1, E: 1, İ: 1, I: 1, K: 1, L: 1, R: 1, S: 1, T: 1, N: 1, U: 1, Ü: 1,
  B: 2, D: 2, M: 2, O: 2, Ö: 2, Y: 2,
  C: 3, Ç: 3, G: 3, H: 3, P: 3, Ş: 3, V: 3, Z: 3,
  F: 5, Ğ: 5, J: 7,
};

const KELIMELIK_STARTERS = ["KALE", "DENİZ", "BULUT", "MASAL", "MÜZİK", "ŞEHİR"];

const KELIMELIK_BOT_WORDS = [
  "KALE", "DENİZ", "BULUT", "MASAL", "MÜZİK", "ŞEHİR", "BARIŞ", "MARTI",
  "DALGA", "SAHİL", "LİMAN", "ORMAN", "TARLA", "RADYO", "MELEK", "GÜNEŞ",
  "KAVUN", "KEDİ", "ARABA", "KİTAP", "KALEM", "SAAT", "PASTA", "UÇAK",
];

function getLetterPoint(ch) {
  if (!ch) return 1;
  const upper = ch === "i" ? "İ" : String(ch).toLocaleUpperCase("tr");
  return LETTER_POINTS_TR[upper] || 1;
}

function drawKelimelikRack(count = 7) {
  const bag = [
    "A", "A", "A", "E", "E", "İ", "İ", "I", "K", "K", "L", "L", "R", "R",
    "S", "T", "N", "U", "Ü", "B", "D", "M", "O", "Ö", "Y", "C", "Ç", "G",
    "H", "P", "Ş", "V", "Z", "F", "Ğ",
  ];
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(bag[Math.floor(Math.random() * bag.length)]);
  }
  return out;
}

function createInitialKelimelikBoard() {
  const board = Array.from({ length: KELIMELIK_SIZE }, () =>
    Array.from({ length: KELIMELIK_SIZE }, () => null)
  );
  const starterWord =
    KELIMELIK_STARTERS[Math.floor(Math.random() * KELIMELIK_STARTERS.length)];
  const chars = Array.from(starterWord);
  const startCol = Math.max(0, Math.floor((KELIMELIK_SIZE - chars.length) / 2));
  chars.forEach((ch, idx) => {
    const c = Math.min(KELIMELIK_SIZE - 1, startCol + idx);
    board[3][c] = {
      letter: ch,
      points: getLetterPoint(ch),
      locked: true,
    };
  });
  return board;
}

function evaluateKelimelikPlacement(board, draftCells) {
  if (!Array.isArray(draftCells) || draftCells.length === 0) {
    return { ok: false, reason: "Tahtaya en az 1 harf yerleştir." };
  }

  const sameRow = draftCells.every((d) => d.r === draftCells[0].r);
  const sameCol = draftCells.every((d) => d.c === draftCells[0].c);
  if (!sameRow && !sameCol) {
    return { ok: false, reason: "Harfleri tek bir yatay veya dikey çizgide diz." };
  }

  let touchesExisting = false;
  for (const d of draftCells) {
    const neighbors = [
      [d.r - 1, d.c],
      [d.r + 1, d.c],
      [d.r, d.c - 1],
      [d.r, d.c + 1],
    ];
    for (const [nr, nc] of neighbors) {
      if (nr >= 0 && nr < KELIMELIK_SIZE && nc >= 0 && nc < KELIMELIK_SIZE) {
        if (board[nr][nc] && board[nr][nc].letter) {
          touchesExisting = true;
        }
      }
    }
  }
  if (!touchesExisting) {
    return { ok: false, reason: "Yeni harfler tahtadaki mevcut harflere temas etmeli." };
  }

  const draftMap = new Map();
  draftCells.forEach((d) => draftMap.set(`${d.r},${d.c}`, d));

  let wordLetters = [];
  let baseSum = 0;
  let wordMultiplier = 1;

  if (sameRow || draftCells.length === 1) {
    const r = draftCells[0].r;
    const cols = draftCells.map((d) => d.c);
    let minC = Math.min(...cols);
    let maxC = Math.max(...cols);
    while (minC - 1 >= 0 && (board[r][minC - 1]?.letter || draftMap.has(`${r},${minC - 1}`))) {
      minC--;
    }
    while (
      maxC + 1 < KELIMELIK_SIZE &&
      (board[r][maxC + 1]?.letter || draftMap.has(`${r},${maxC + 1}`))
    ) {
      maxC++;
    }
    for (let c = minC; c <= maxC; c++) {
      const key = `${r},${c}`;
      const draftItem = draftMap.get(key);
      const lockedItem = board[r][c];
      const ch = draftItem ? draftItem.letter : lockedItem?.letter;
      if (!ch) {
        return { ok: false, reason: "Harfler arasında boş kare bırakma." };
      }
      wordLetters.push(ch);
      const pt = getLetterPoint(ch);
      if (draftItem) {
        const bonus = KELIMELIK_BONUS_MAP[key];
        if (bonus === "H2") baseSum += pt * 2;
        else baseSum += pt;
        if (bonus === "K2") wordMultiplier *= 2;
      } else {
        baseSum += pt;
      }
    }
  }

  if (wordLetters.length < 2 && (sameCol || draftCells.length === 1)) {
    wordLetters = [];
    baseSum = 0;
    wordMultiplier = 1;
    const c = draftCells[0].c;
    const rows = draftCells.map((d) => d.r);
    let minR = Math.min(...rows);
    let maxR = Math.max(...rows);
    while (minR - 1 >= 0 && (board[minR - 1][c]?.letter || draftMap.has(`${minR - 1},${c}`))) {
      minR--;
    }
    while (
      maxR + 1 < KELIMELIK_SIZE &&
      (board[maxR + 1][c]?.letter || draftMap.has(`${maxR + 1},${c}`))
    ) {
      maxR++;
    }
    for (let r = minR; r <= maxR; r++) {
      const key = `${r},${c}`;
      const draftItem = draftMap.get(key);
      const lockedItem = board[r][c];
      const ch = draftItem ? draftItem.letter : lockedItem?.letter;
      if (!ch) {
        return { ok: false, reason: "Harfler arasında boş kare bırakma." };
      }
      wordLetters.push(ch);
      const pt = getLetterPoint(ch);
      if (draftItem) {
        const bonus = KELIMELIK_BONUS_MAP[key];
        if (bonus === "H2") baseSum += pt * 2;
        else baseSum += pt;
        if (bonus === "K2") wordMultiplier *= 2;
      } else {
        baseSum += pt;
      }
    }
  }

  if (wordLetters.length < 2) {
    return { ok: false, reason: "En az 2 harfli bir kelime oluştur." };
  }

  return {
    ok: true,
    word: wordLetters.join(""),
    points: baseSum * wordMultiplier,
  };
}

const BLUFF_WORD_BANK = [
  { word: "Araba", clues: ["Tekerlek", "Direksiyon", "Yolculuk", "Motor", "Trafik", "Benzin"] },
  { word: "Güneş", clues: ["Sıcak", "Yaz", "Gökyüzü", "Işık", "Sabah", "Sahil"] },
  { word: "Karpuz", clues: ["Yaz", "Çekirdek", "Kırmızı", "Dilim", "Soğuk", "Bostan"] },
  { word: "Doktor", clues: ["Hastane", "Stetoskop", "Muayene", "Reçete", "Sağlık", "Nöbet"] },
  { word: "Uçak", clues: ["Bulut", "Kanat", "Havalimanı", "Pilot", "Bilet", "Gökyüzü"] },
  { word: "Piyano", clues: ["Tuş", "Nota", "Konser", "Melodi", "Müzik", "Siyah Beyaz"] },
  { word: "Şemsiye", clues: ["Yağmur", "Islak", "Bulut", "Sonbahar", "Rüzgar", "Açılır"] },
  { word: "Pasta", clues: ["Doğum Günü", "Mum", "Krema", "Dilim", "Kutlama", "Tatlı"] },
  { word: "Dağ", clues: ["Zirve", "Kar", "Tırmanış", "Bulut", "Yayla", "Yüksek"] },
  { word: "Kedi", clues: ["Miyav", "Bıyık", "Pati", "Tüy", "Süt", "Mırıldanma"] },
  { word: "Kalem", clues: ["Defter", "Yazı", "Silgi", "Uç", "Okul", "Çizgi"] },
  { word: "Bilgisayar", clues: ["Klavye", "Ekran", "Fare", "İnternet", "Yazılım", "Masa"] },
  { word: "Bisiklet", clues: ["Pedal", "Kask", "Zincir", "İki Teker", "Park", "Gidon"] },
  { word: "Saat", clues: ["Zaman", "Akrep", "Yelkovan", "Bilek", "Dakika", "Alarm"] },
  { word: "Kitap", clues: ["Sayfa", "Yazar", "Kütüphane", "Roman", "Kapak", "Okumak"] },
  { word: "Futbol", clues: ["Kale", "Top", "Hakem", "Stadyum", "Gol", "Ofsayt"] },
  { word: "Şapka", clues: ["Baş", "Güneş", "Bere", "Kasket", "Aksesuar", "Siper"] },
  { word: "Ateş", clues: ["Duman", "Kıvılcım", "Kamp", "Sıcak", "Köz", "Alev"] },
  { word: "Müzik", clues: ["Ritim", "Şarkı", "Kulaklık", "Melodi", "Enstrüman", "Ses"] },
  { word: "Robot", clues: ["Yapay Zeka", "Metal", "Sensör", "Otomasyon", "Kod", "Gelecek"] },
];

const BLUFF_FAKE_CLUES = [
  "Klasik", "Günlük", "Önemli", "Tanıdık", "Hareketli", "Evde", "Dışarıda",
  "Renkli", "Hızlı", "Keyifli", "Sıradan", "Farklı", "Ortak", "Eski", "Yeni",
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

const KEYBOARD_ROWS = [
  ["E", "R", "T", "Y", "U", "I", "O", "P", "Ğ", "Ü"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ş", "İ"],
  ["GIR", "Z", "C", "V", "B", "N", "M", "Ö", "Ç", "SIL"],
];

const VALID_WORDLE_KEYS = new Set([
  "A", "B", "C", "Ç", "D", "E", "F", "G", "Ğ", "H", "I", "İ",
  "J", "K", "L", "M", "N", "O", "Ö", "P", "R", "S", "Ş", "T",
  "U", "Ü", "V", "Y", "Z",
]);

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

const INITIAL_KNOWN_PLAYERS = [
  { id: "bot_efe", name: "Efe", wins: 5, lastSeenAt: Date.now() - 1000 * 40 },
  { id: "bot_defne", name: "Defne", wins: 7, lastSeenAt: Date.now() - 1000 * 75 },
  { id: "bot_arda", name: "Arda", wins: 3, lastSeenAt: Date.now() - 1000 * 110 },
  { id: "bot_elif", name: "Elif", wins: 6, lastSeenAt: Date.now() - 1000 * 150 },
  { id: "bot_kuzey", name: "Kuzey", wins: 4, lastSeenAt: Date.now() - 1000 * 210 },
  { id: "bot_mira", name: "Mira", wins: 8, lastSeenAt: Date.now() - 1000 * 260 },
];

const QUICK_REPLIES = ["İyi hamle! 👏", "Şanslıydın 😄", "Çok yakındı! 🔥", "Rövanş? 🔄"];
const EMOJIS = ["👏", "😂", "🔥", "😱", "🤔", "👑"];

const BOT_CHAT_POOLS = {
  greeting: [
    "Selam! Nasılsın, keyifler nasıl?",
    "Hey, hoş geldin! Bugün günün nasıl geçiyor?",
    "Selamlar, tam vaktinde denk geldik 😄",
    "Selam! Hazırsan hem oynayalım hem sohbet edelim.",
    "Heyy, nasılsın? Ben de tam yeni el açmıştım.",
    "Selam! Akşamın nasıl geçiyor, dinleniyor musun?",
  ],
  warmCasual: [
    "Haha harbi mi, hiç öyle düşünmemiştim 😄",
    "Bence de ya, bayağı sarıyor şu an.",
    "Aynen öyle, ben de tam onu diyecektim!",
    "Vayy iyi yakaladın, gözünden kaçmıyor hiç.",
    "Olur olur, hiç acelem yok, rahat takılalım.",
    "Çok iyiymiş, valla keyfim yerine geldi.",
    "Bence bu işin tadı böyle çıkıyor zaten.",
    "Sana katılıyorum, birazdan işler kızışır gibi.",
  ],
  playfulBanter: [
    "Şansın bu sefer yaver gidiyor gibi ama bakalım 😂",
    "Gözüm üzerinde, boş bırakmayacağım seni 👀",
    "İddialı konuşuyorsun, beğendim bu özgüveni 😄",
    "Birazdan taşlar yerine oturur, görürsün!",
    "Tamam şampiyon, bu eli al bakalım şimdilik 😉",
    "Heyecan yaptırmıyorsun hiç, soğukkanlısın bayağı.",
  ],
  questionOrCuriosity: [
    "Valla şu an hem oyuna odaklandım hem muhabbet güzel gidiyor, sen ne yapıyorsun?",
    "Bence ikisi de mantıklı ama duruma göre değişir, sence?",
    "Şu an fena değil, senden ne haber, nasıl gidiyor?",
    "Açıkçası hiç beklemediğim bir yerden geldi, sen ne dersin?",
  ],
  rematchOrPace: [
    "Biter bitmez bir el daha atarız, sıkıntı yok!",
    "Aynen, rövanş her zaman var, önce şu eli bitirelim.",
    "Biraz daha tempo artar gibi, bakalım kim önde bitirecek.",
    "Tamam, ne zaman istersen tekrar deneriz.",
  ],
  gameSpecific: {
    kelimelik: [
      "K2 veya H2 karesi denk gelirse skor bir anda değişir.",
      "Elimdeki harflerle güzel bir kelime çıkarabilecek miyim bakalım.",
      "Tahtadaki harflere bağlanmak en mantıklısı gibi duruyor.",
      "Kelimelikte ufak bir harf bile oyunun yönünü değiştiriyor.",
    ],
    battleship: [
      "Radarlarım açık, bakalım hangi kareyi vuracaksın.",
      "Gemilerim sağlam duruyor ama belli de olmaz.",
      "İsabet alırsan işim zorlaşır, dikkatli atış yap 😄",
      "Denizde sessizlik var, sıradaki hamleni bekliyorum.",
    ],
    rps: [
      "5 tur çabuk geçiyor, her elde ters köşe mümkün.",
      "Bu tur ne seçeceğimi ben de son anda kararlaştırdım.",
      "Taş kağıt makasta en sevdiğim şey tamamen psikoloji olması.",
      "Bakalım bu tur kim üstün gelecek!",
    ],
    ttt: [
      "Ortayı kapmak veya köşeleri kollamak klasik ama işe yarıyor.",
      "3x3 hızlı ama tek hatada maç biter, dikkatli olalım.",
      "Güzel hamleydi, sırayı bozmadan devam edelim.",
      "Bakalım üçlemeyi kim önce kuracak.",
    ],
    wordle: [
      "İlk tahminde sesli harf denemek genelde iş yapıyor.",
      "Yeşil ve turuncu harfler gelince tablo netleşiyor.",
      "5 harfte bazen en tanıdık kelime gözden kaçabiliyor 😄",
      "İpuçlarını iyi birleştirirsen çabuk çözersin.",
    ],
    sudoku: [
      "Satır, sütun ve 2x2 kutuyu aynı anda kontrol etmek lazım.",
      "4x4 hızlı ama tek çakışma kafa karıştırabiliyor.",
      "Güzel ilerliyorsun, bakalım kim önce bitirecek.",
      "Rakamları yerleştirdikçe tablo açılıyor.",
    ],
  },
};

const recentBotRepliesRef = [];

function detectMessageTone(text) {
  const lower = String(text || "").toLocaleLowerCase("tr").trim();
  const hasQuestion = lower.includes("?") || /\b(mi|mı|mu|mü|nasıl|neden|niye|ne|kim|nerede|kaç)\b/.test(lower);
  const isGreeting = /\b(selam|merhaba|slm|mrb|hey|günaydın|iyi akşamlar|iyi geceler|naber|nasılsın)\b/.test(lower);
  const isPlayful = /[😄😂😉😜😎🔥👏]|(şaka|espri|iddia|şans|yenicem|kazanıcam|kolay|hadi bakalım|blöf)/.test(lower);
  const isWarm = /(kanka|dostum|hocam|ya|valla|harbi|aynen|bence|super|süper|güzel|iyi|eyvallah|sağol|teşekkür)/.test(lower);
  const isRematch = /\b(rövanş|tekrar|bir daha|yeniden|devam|bitti|bitince)\b/.test(lower);

  if (isRematch) return "rematch";
  if (hasQuestion) return "question";
  if (isGreeting) return "greeting";
  if (isPlayful) return "playful";
  if (isWarm) return "warm";
  return "general";
}

function pickNonRepeatingFromPool(pool) {
  if (!Array.isArray(pool) || pool.length === 0) return "Bence de, güzel gidiyor!";
  const candidates = pool.filter((item) => !recentBotRepliesRef.includes(item));
  const source = candidates.length > 0 ? candidates : pool;
  const chosen = source[Math.floor(Math.random() * source.length)];
  recentBotRepliesRef.push(chosen);
  if (recentBotRepliesRef.length > 14) {
    recentBotRepliesRef.shift();
  }
  return chosen;
}

function getBotChatReply(text, gameType) {
  const tone = detectMessageTone(text);
  const gamePool = BOT_CHAT_POOLS.gameSpecific[gameType] || [];
  const shouldMentionGame = Math.random() < 0.35 && gamePool.length > 0 && tone !== "greeting";

  if (shouldMentionGame) {
    return pickNonRepeatingFromPool(gamePool);
  }
  if (tone === "greeting") {
    return pickNonRepeatingFromPool(BOT_CHAT_POOLS.greeting);
  }
  if (tone === "question") {
    return pickNonRepeatingFromPool([...BOT_CHAT_POOLS.questionOrCuriosity, ...BOT_CHAT_POOLS.warmCasual]);
  }
  if (tone === "playful") {
    return pickNonRepeatingFromPool(BOT_CHAT_POOLS.playfulBanter);
  }
  if (tone === "rematch") {
    return pickNonRepeatingFromPool(BOT_CHAT_POOLS.rematchOrPace);
  }
  if (tone === "warm") {
    return pickNonRepeatingFromPool([...BOT_CHAT_POOLS.warmCasual, ...BOT_CHAT_POOLS.greeting.slice(2)]);
  }
  return pickNonRepeatingFromPool([...BOT_CHAT_POOLS.warmCasual, ...BOT_CHAT_POOLS.questionOrCuriosity]);
}

function computeHumanBotDelayMs(text) {
  const len = String(text || "").trim().length;
  const base = 1200 + Math.min(len * 35, 1400);
  const jitter = Math.floor(Math.random() * 1200);
  return Math.min(3800, Math.max(1200, base + jitter));
}

function pickRandomTenBluffWords() {
  const shuffled = [...BLUFF_WORD_BANK].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 10).map((item) => item.word);
}

function getBotClueForBluff(secretWord, isBluffer, existingClues = []) {
  const usedLower = new Set(existingClues.map((c) => String(c.text || "").toLocaleLowerCase("tr")));
  if (!isBluffer && secretWord) {
    const entry = BLUFF_WORD_BANK.find(
      (b) => b.word.toLocaleLowerCase("tr") === String(secretWord).toLocaleLowerCase("tr")
    );
    if (entry) {
      const available = entry.clues.filter((c) => !usedLower.has(c.toLocaleLowerCase("tr")));
      if (available.length > 0) {
        return available[Math.floor(Math.random() * available.length)];
      }
    }
  }
  const fakePool = BLUFF_FAKE_CLUES.filter((c) => !usedLower.has(c.toLocaleLowerCase("tr")));
  const pool = fakePool.length > 0 ? fakePool : BLUFF_FAKE_CLUES;
  return pool[Math.floor(Math.random() * pool.length)];
}

function createInitialBluffState(participants, roundNum = 1, prevScores = {}) {
  const list = participants.map((p) => ({
    id: p.id,
    name: p.name,
    isBot: Boolean(p.isBot),
    score: Number(prevScores[p.id] ?? p.score ?? 0),
  }));
  const count = Math.max(3, list.length);
  const starterIndex = (roundNum - 1) % count;
  const starterId = list[starterIndex].id;

  const blufferOffset = 1 + ((roundNum - 1) % Math.max(1, count - 1));
  const blufferIndex = (starterIndex + blufferOffset) % count;
  const blufferId = list[blufferIndex].id;

  return {
    round: roundNum,
    players: list,
    starterId,
    blufferId,
    wordOptions: pickRandomTenBluffWords(),
    secretWord: null,
    phase: "selecting_word",
    clues: [],
    votePromptVotes: {},
    guesses: {},
    roundSummary: null,
  };
}

function isReservedFdName(rawName) {
  return String(rawName || "").trim().toLocaleUpperCase("tr") === "FD";
}

function hashSecret(secret) {
  const input = `fd_arena_salt::${String(secret || "")}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

function formatRelativeTime(ts) {
  const numericTs = Number(ts || 0);
  if (!numericTs) return "Az önce";
  const diffSec = Math.max(0, Math.floor((Date.now() - numericTs) / 1000));
  if (diffSec < 60) return "Az önce";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} dk önce`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} sa önce`;
  return `${Math.floor(diffHr / 24)} gün önce`;
}

function normalizeTrChar(ch) {
  if (!ch) return "";
  const upper = String(ch).toLocaleUpperCase("tr");
  if (upper === "İ" || upper === "I") return "I";
  if (upper === "Ş" || upper === "S") return "S";
  if (upper === "Ğ" || upper === "G") return "G";
  if (upper === "Ü" || upper === "U") return "U";
  if (upper === "Ö" || upper === "O") return "O";
  if (upper === "Ç" || upper === "C") return "C";
  return upper;
}

function toWordleUpperChar(raw) {
  if (!raw) return null;
  if (raw === "i" || raw === "İ") return "İ";
  if (raw === "I") return "I";
  const upper = String(raw).toLocaleUpperCase("tr");
  return VALID_WORDLE_KEYS.has(upper) ? upper : null;
}

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
  const res = Array(5).fill("red");
  const targetArr = Array.from(target);
  const guessArr = Array.from(guess);
  const targetNorm = targetArr.map(normalizeTrChar);
  const guessNorm = guessArr.map(normalizeTrChar);
  const remainingTargetCounts = {};

  for (let i = 0; i < 5; i++) {
    if (guessNorm[i] === targetNorm[i]) {
      res[i] = "green";
    } else {
      const k = targetNorm[i];
      remainingTargetCounts[k] = (remainingTargetCounts[k] || 0) + 1;
    }
  }

  for (let i = 0; i < 5; i++) {
    if (res[i] === "green") continue;
    const k = guessNorm[i];
    if ((remainingTargetCounts[k] || 0) > 0) {
      res[i] = "orange";
      remainingTargetCounts[k] -= 1;
    } else {
      res[i] = "red";
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
  const [fdPasswordInput, setFdPasswordInput] = useState("");
  const [fdPasswordConfirm, setFdPasswordConfirm] = useState("");
  const [loginError, setLoginError] = useState("");
  const [storedFdAuth, setStoredFdAuth] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem("duello_fd_auth");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [isFdAuthenticated, setIsFdAuthenticated] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("duello_fd_authed") === "1";
  });

  const [enteredLobby, setEnteredLobby] = useState(() => {
    if (typeof window === "undefined") return false;
    const savedName = window.localStorage.getItem("duello_nickname") || "";
    const wasEntered = window.localStorage.getItem("duello_entered_lobby") === "1";
    if (!wasEntered || !savedName.trim()) return false;
    if (isReservedFdName(savedName) && window.localStorage.getItem("duello_fd_authed") !== "1") {
      return false;
    }
    return true;
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

  const [knownPlayers, setKnownPlayers] = useState(() => {
    if (typeof window === "undefined") return INITIAL_KNOWN_PLAYERS;
    try {
      const raw = window.localStorage.getItem("duello_known_players");
      if (!raw) return INITIAL_KNOWN_PLAYERS;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_KNOWN_PLAYERS;
    } catch {
      return INITIAL_KNOWN_PLAYERS;
    }
  });

  const [users, setUsers] = useState([]);
  const [bannedUsers, setBannedUsers] = useState({});
  const [reportsList, setReportsList] = useState([]);
  const [reportTargetUser, setReportTargetUser] = useState(null);
  const [reportReason, setReportReason] = useState("");

  const [bluffTableId, setBluffTableId] = useState(null);
  const [bluffLobbyOpen, setBluffLobbyOpen] = useState(false);
  const [bluffInvitedIds, setBluffInvitedIds] = useState({});
  const [bluffJoinedMembers, setBluffJoinedMembers] = useState([]);
  const [joinedBluffTable, setJoinedBluffTable] = useState(null);

  const [incomingInvite, setIncomingInvite] = useState(null);
  const [outgoingInvite, setOutgoingInvite] = useState(null);
  const [noticeBanner, setNoticeBanner] = useState(null);
  const [selectedTargetUser, setSelectedTargetUser] = useState(null);
  const [selectedGameForInvite, setSelectedGameForInvite] = useState("kelimelik");

  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [resumableMatch, setResumableMatch] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem("duello_resumable_match");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

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

  // Blöf state
  const [bluffState, setBluffState] = useState(null);
  const [bluffClueInput, setBluffClueInput] = useState("");
  const [bluffSelectedSuspect, setBluffSelectedSuspect] = useState(null);

  // Kelimelik state
  const [klBoard, setKlBoard] = useState(() => createInitialKelimelikBoard());
  const [klRack, setKlRack] = useState(() => drawKelimelikRack(7));
  const [klDraftCells, setKlDraftCells] = useState([]);
  const [klSelectedTilePos, setKlSelectedTilePos] = useState([3, 2]);
  const [klMyScore, setKlMyScore] = useState(0);
  const [klOppScore, setKlOppScore] = useState(0);
  const [klTurn, setKlTurn] = useState("me");
  const [klRound, setKlRound] = useState(1);
  const [klStatus, setKlStatus] = useState("Tahtada boş kare seç ve alttan harf koyarak kelime kur!");
  const [klWinner, setKlWinner] = useState(null);
  const [klLastWordInfo, setKlLastWordInfo] = useState(null);

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
  const [wordStatus, setWordStatus] = useState(
    "5 harfli kelimeyi bul! Yeşil: doğru yer, Turuncu: farklı yer, Kırmızı: yok."
  );
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
  const botKlTimerRef = useRef(null);
  const bluffBotTimerRef = useRef(null);
  const botChatTimerRef = useRef(null);
  const processedLiveRoundRef = useRef(0);
  const awardedMatchIdRef = useRef(null);
  const leftNoticeShownRef = useRef(false);
  const myStatus = activeMatch ? "in_game" : "online";

  const isFdAdmin = enteredLobby && isReservedFdName(nickname) && isFdAuthenticated;
  const typingFdName = isReservedFdName(nickname);
  const isMyBanned = Boolean(bannedUsers && bannedUsers[myId]);

  const upsertKnownPlayer = useCallback((playerRecord) => {
    if (!playerRecord || !playerRecord.id) return;
    setKnownPlayers((prev) => {
      const existing = prev.find((p) => p.id === playerRecord.id);
      const nextWins =
        typeof playerRecord.wins === "number"
          ? Math.max(existing?.wins || 0, playerRecord.wins)
          : existing?.wins || 0;
      const nextSeen = Math.max(
        Number(existing?.lastSeenAt || 0),
        Number(playerRecord.lastSeenAt || 0)
      );
      const mergedItem = {
        id: playerRecord.id,
        name: playerRecord.name || existing?.name || "Oyuncu",
        wins: nextWins,
        lastSeenAt: nextSeen || Date.now(),
      };
      const filtered = prev.filter((p) => p.id !== playerRecord.id);
      const nextList = [mergedItem, ...filtered].slice(0, 50);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("duello_known_players", JSON.stringify(nextList));
      }
      return nextList;
    });
  }, []);

  function clearAllGameTimers() {
    if (rpsTimerRef.current) { clearTimeout(rpsTimerRef.current); rpsTimerRef.current = null; }
    if (botBsTimerRef.current) { clearTimeout(botBsTimerRef.current); botBsTimerRef.current = null; }
    if (botTttTimerRef.current) { clearTimeout(botTttTimerRef.current); botTttTimerRef.current = null; }
    if (botWordTimerRef.current) { clearTimeout(botWordTimerRef.current); botWordTimerRef.current = null; }
    if (botSudokuTimerRef.current) { clearTimeout(botSudokuTimerRef.current); botSudokuTimerRef.current = null; }
    if (botKlTimerRef.current) { clearTimeout(botKlTimerRef.current); botKlTimerRef.current = null; }
    if (bluffBotTimerRef.current) { clearTimeout(bluffBotTimerRef.current); bluffBotTimerRef.current = null; }
    if (botChatTimerRef.current) { clearTimeout(botChatTimerRef.current); botChatTimerRef.current = null; }
  }

  function showNotice(title, text) {
    setNoticeBanner({ title, text, ts: Date.now() });
  }

  function adjustMyGlobalWins(delta, uniqueKey = null) {
    if (uniqueKey) {
      if (awardedMatchIdRef.current === uniqueKey) return;
      awardedMatchIdRef.current = uniqueKey;
    }
    const nowTs = Date.now();
    const displayName = isReservedFdName(nickname) ? "FD" : nickname.trim();
    setMyWins((prev) => {
      const next = Math.max(0, prev + delta);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("duello_my_wins", String(next));
      }
      upsertKnownPlayer({
        id: myId,
        name: displayName,
        wins: next,
        lastSeenAt: nowTs,
      });
      if (dbRef.current) {
        update(ref(dbRef.current, `users/${myId}`), {
          wins: next,
          lastSeenAt: nowTs,
          updatedAt: nowTs,
        });
        set(ref(dbRef.current, `players_history/${myId}`), {
          id: myId,
          name: displayName,
          wins: next,
          lastSeenAt: nowTs,
        });
      }
      return next;
    });
  }

  function awardWinPoint(matchKey) {
    adjustMyGlobalWins(1, matchKey);
  }

  useEffect(() => {
    return () => clearAllGameTimers();
  }, []);

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
    window.localStorage.setItem("duello_fd_authed", isFdAuthenticated ? "1" : "0");
  }, [nickname, enteredLobby, isFdAuthenticated]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (activeMatch) {
      window.localStorage.setItem("duello_active_match", JSON.stringify(activeMatch));
    } else {
      window.localStorage.removeItem("duello_active_match");
    }
  }, [activeMatch]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (resumableMatch) {
      window.localStorage.setItem("duello_resumable_match", JSON.stringify(resumableMatch));
    } else {
      window.localStorage.removeItem("duello_resumable_match");
    }
  }, [resumableMatch]);

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
    if (!dbRef.current) return;
    const unsubAdmin = onValue(ref(dbRef.current, "admin_config/fd"), (snap) => {
      const val = snap.val();
      if (val && val.passwordHash) {
        setStoredFdAuth(val);
        if (typeof window !== "undefined") {
          window.localStorage.setItem("duello_fd_auth", JSON.stringify(val));
        }
      }
    });

    const unsubBans = onValue(ref(dbRef.current, "banned_users"), (snap) => {
      const val = snap.val() || {};
      setBannedUsers(val);
    });

    return () => {
      unsubAdmin();
      unsubBans();
    };
  }, []);

  useEffect(() => {
    if (!isMyBanned || isFdAdmin) return;
    clearAllGameTimers();
    if (dbRef.current) {
      remove(ref(dbRef.current, `users/${myId}`));
    }
    setActiveMatch(null);
    setResumableMatch(null);
    setExitConfirmOpen(false);
    setBluffLobbyOpen(false);
    setBluffTableId(null);
    setJoinedBluffTable(null);
    setEnteredLobby(false);
    setLoginError("Yönetici (FD) tarafından siteden uzaklaştırıldınız.");
  }, [isMyBanned, isFdAdmin, myId]);

  function handleJoinLobby(e) {
    if (e) e.preventDefault();
    setLoginError("");
    const trimmed = nickname.trim();

    if (!trimmed) {
      setLoginError("Takma ad boş bırakılamaz. Lütfen bir takma ad girin.");
      return;
    }

    if (isMyBanned && !isReservedFdName(trimmed)) {
      setLoginError("Bu hesap yönetici tarafından engellenmiştir.");
      return;
    }

    if (isReservedFdName(trimmed)) {
      const pass = fdPasswordInput.trim();
      if (pass.length < 4) {
        setLoginError("FD hesabı için en az 4 karakterli şifre girin.");
        return;
      }

      const incomingHash = hashSecret(pass);

      if (!storedFdAuth || !storedFdAuth.passwordHash) {
        if (fdPasswordConfirm.trim() !== pass) {
          setLoginError("FD şifre tekrarı eşleşmiyor.");
          return;
        }
        const authRecord = {
          passwordHash: incomingHash,
          ownerId: myId,
          createdAt: Date.now(),
        };
        setStoredFdAuth(authRecord);
        if (typeof window !== "undefined") {
          window.localStorage.setItem("duello_fd_auth", JSON.stringify(authRecord));
        }
        if (dbRef.current) {
          set(ref(dbRef.current, "admin_config/fd"), authRecord);
        }
        setNickname("FD");
        setIsFdAuthenticated(true);
        setEnteredLobby(true);
        return;
      }

      if (incomingHash !== storedFdAuth.passwordHash) {
        setLoginError("FD takma adı korumalıdır. Girdiğiniz şifre hatalı!");
        return;
      }

      setNickname("FD");
      setIsFdAuthenticated(true);
      setEnteredLobby(true);
      return;
    }

    setIsFdAuthenticated(false);
    setNickname(trimmed);
    setEnteredLobby(true);
  }

  useEffect(() => {
    if (!enteredLobby) return;
    const cleanName = isReservedFdName(nickname) ? "FD" : nickname.trim();
    if (!cleanName) return;
    const nowTs = Date.now();

    upsertKnownPlayer({
      id: myId,
      name: cleanName,
      wins: myWins,
      lastSeenAt: nowTs,
    });

    if (dbRef.current) {
      const userRef = ref(dbRef.current, `users/${myId}`);
      const historyRef = ref(dbRef.current, `players_history/${myId}`);

      set(userRef, {
        id: myId,
        name: cleanName,
        status: myStatus,
        wins: myWins,
        isAdmin: isFdAdmin,
        lastSeenAt: nowTs,
        updatedAt: nowTs,
      });
      set(historyRef, {
        id: myId,
        name: cleanName,
        wins: myWins,
        lastSeenAt: nowTs,
      });
      onDisconnect(userRef).remove();

      const unsubUsers = onValue(ref(dbRef.current, "users"), (snap) => {
        const val = snap.val() || {};
        const allList = Object.values(val).filter(Boolean);
        setUsers(allList.filter((u) => u.id !== myId));
        allList.forEach((u) => {
          upsertKnownPlayer({
            id: u.id,
            name: u.name,
            wins: Number(u.wins || 0),
            lastSeenAt: Number(u.lastSeenAt || u.updatedAt || Date.now()),
          });
        });
      });

      const unsubHistory = onValue(ref(dbRef.current, "players_history"), (snap) => {
        const val = snap.val() || {};
        Object.values(val)
          .filter(Boolean)
          .forEach((p) => {
            upsertKnownPlayer({
              id: p.id,
              name: p.name,
              wins: Number(p.wins || 0),
              lastSeenAt: Number(p.lastSeenAt || 0),
            });
          });
      });

      const unsubReports = onValue(ref(dbRef.current, "reports"), (snap) => {
        const val = snap.val() || {};
        const arr = Object.entries(val)
          .map(([key, item]) => ({ id: key, ...item }))
          .sort((a, b) => (b.ts || 0) - (a.ts || 0));
        setReportsList(arr);
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
        const arr = validEntries
          .map(([fbKey, m]) => ({ ...m, fbKey }))
          .sort((a, b) => (a.ts || 0) - (b.ts || 0));
        setGlobalMessages(arr.slice(-50));
        if (arr.length > 0) {
          const last = arr[arr.length - 1];
          if (last && last.senderId !== myId && !globalChatOpen) {
            setGlobalUnread((c) => c + 1);
          }
        }
      });

      return () => {
        unsubUsers();
        unsubHistory();
        unsubReports();
        unsubInvite();
        unsubGlobal();
      };
    } else {
      setUsers([]);
    }
  }, [enteredLobby, nickname, myId, myStatus, myWins, isFdAdmin, globalChatOpen, upsertKnownPlayer]);

  const activeLobbyPlayers = useMemo(() => {
    const map = new Map();
    LOBBY_BOT_PLAYERS.forEach((bot) => {
      map.set(bot.id, { ...bot, isBot: true });
    });
    users.forEach((u) => {
      if (u && u.id && u.id !== myId) {
        map.set(u.id, {
          ...u,
          isBot: Boolean(u.isBot || LOBBY_BOT_ID_SET.has(u.id)),
          status: u.status || "online",
        });
      }
    });
    return Array.from(map.values());
  }, [users, myId]);

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

  const syncBluffState = useCallback(
    (nextBluff) => {
      setBluffState(nextBluff);
      if (dbRef.current && activeMatch && !activeMatch.isBot) {
        update(ref(dbRef.current, `matches/${activeMatch.roomId}/gameState`), {
          bluff: nextBluff,
        });
      }
    },
    [activeMatch]
  );

  const finalizeBluffRound = useCallback(
    (stateSnapshot, guessesMap) => {
      const players = stateSnapshot.players || [];
      const blufferId = stateSnapshot.blufferId;
      const nonBluffers = players.filter((p) => p.id !== blufferId);

      let transferredToBluffer = 0;
      const playerDeltas = {};
      players.forEach((p) => {
        playerDeltas[p.id] = 0;
      });

      const details = [];

      nonBluffers.forEach((voter) => {
        const guessedId = guessesMap[voter.id];
        const guessedPlayer = players.find((p) => p.id === guessedId);
        if (guessedId === blufferId) {
          playerDeltas[voter.id] = 1;
          details.push(`${voter.name} Blöfçüyü doğru bildi (+1 puan)`);
        } else {
          const actualDeduction = voter.score > 0 ? 1 : 0;
          playerDeltas[voter.id] = -actualDeduction;
          transferredToBluffer += actualDeduction;
          details.push(
            `${voter.name} yanlış tahmin etti (${guessedPlayer?.name || "?"}) → ${
              actualDeduction > 0 ? "-1 puan Blöfçüye geçti" : "0 puanı vardı, puan düşemedi"
            }`
          );
        }
      });

      playerDeltas[blufferId] = (playerDeltas[blufferId] || 0) + transferredToBluffer;

      const updatedPlayers = players.map((p) => ({
        ...p,
        score: Math.max(0, Number(p.score || 0) + (playerDeltas[p.id] || 0)),
      }));

      const myDelta = playerDeltas[myId] || 0;
      if (myDelta !== 0) {
        adjustMyGlobalWins(myDelta, `${activeMatch?.roomId}_bluff_r${stateSnapshot.round}_${myId}`);
      }

      const blufferObj = players.find((p) => p.id === blufferId);
      const nextState = {
        ...stateSnapshot,
        players: updatedPlayers,
        guesses: guessesMap,
        phase: "round_result",
        roundSummary: {
          blufferId,
          blufferName: blufferObj?.name || "Blöfçü",
          secretWord: stateSnapshot.secretWord,
          transferredToBluffer,
          playerDeltas,
          details,
        },
      };
      syncBluffState(nextState);
    },
    [myId, activeMatch, syncBluffState]
  );
  useEffect(() => {
    if (!activeMatch || activeMatch.gameType !== "bluff" || !bluffState) return;
    if (!activeMatch.isHost) return;

    if (bluffBotTimerRef.current) {
      clearTimeout(bluffBotTimerRef.current);
      bluffBotTimerRef.current = null;
    }

    const players = bluffState.players || [];
    const clues = bluffState.clues || [];

    if (bluffState.phase === "selecting_word") {
      const starter = players.find((p) => p.id === bluffState.starterId);
      if (starter && starter.isBot) {
        bluffBotTimerRef.current = setTimeout(() => {
          const opts = bluffState.wordOptions || pickRandomTenBluffWords();
          const chosen = opts[Math.floor(Math.random() * opts.length)];
          syncBluffState({
            ...bluffState,
            secretWord: chosen,
            phase: "cluing",
          });
        }, 900);
      }
      return;
    }

    if (bluffState.phase === "cluing") {
      const activePlayer = players[clues.length % players.length];
      if (activePlayer && activePlayer.isBot) {
        bluffBotTimerRef.current = setTimeout(() => {
          const botWord = getBotClueForBluff(
            bluffState.secretWord,
            activePlayer.id === bluffState.blufferId,
            clues
          );
          const nextClues = [
            ...clues,
            {
              playerId: activePlayer.id,
              playerName: activePlayer.name,
              text: botWord,
              cycle: Math.floor(clues.length / players.length) + 1,
              ts: Date.now(),
            },
          ];
          const everyoneDidAtLeastTwo =
            nextClues.length >= players.length * 2 && nextClues.length % players.length === 0;

          syncBluffState({
            ...bluffState,
            clues: nextClues,
            phase: everyoneDidAtLeastTwo ? "ask_vote" : "cluing",
            votePromptVotes: {},
          });
        }, 1050);
      }
      return;
    }

    if (bluffState.phase === "ask_vote") {
      const currentVotes = bluffState.votePromptVotes || {};
      const pendingBot = players.find((p) => p.isBot && !currentVotes[p.id]);
      if (pendingBot) {
        bluffBotTimerRef.current = setTimeout(() => {
          const updatedVotes = {
            ...currentVotes,
            [pendingBot.id]: "yes",
          };
          const allVoted = players.every((p) => Boolean(updatedVotes[p.id]));
          if (!allVoted) {
            syncBluffState({
              ...bluffState,
              votePromptVotes: updatedVotes,
            });
          } else {
            const yesCount = Object.values(updatedVotes).filter((v) => v === "yes").length;
            const majorityYes = yesCount > players.length / 2;
            syncBluffState({
              ...bluffState,
              votePromptVotes: updatedVotes,
              phase: majorityYes ? "voting" : "cluing",
              guesses: {},
            });
          }
        }, 750);
      }
      return;
    }

    if (bluffState.phase === "voting") {
      const nonBluffers = players.filter((p) => p.id !== bluffState.blufferId);
      const currentGuesses = bluffState.guesses || {};
      const pendingBotVoter = nonBluffers.find((p) => p.isBot && !currentGuesses[p.id]);
      if (pendingBotVoter) {
        bluffBotTimerRef.current = setTimeout(() => {
          const candidates = players.filter((p) => p.id !== pendingBotVoter.id);
          const guessTargetId =
            Math.random() < 0.6
              ? bluffState.blufferId
              : candidates[Math.floor(Math.random() * candidates.length)].id;

          const nextGuesses = {
            ...currentGuesses,
            [pendingBotVoter.id]: guessTargetId,
          };
          const allGuessed = nonBluffers.every((p) => Boolean(nextGuesses[p.id]));
          if (!allGuessed) {
            syncBluffState({
              ...bluffState,
              guesses: nextGuesses,
            });
          } else {
            finalizeBluffRound(bluffState, nextGuesses);
          }
        }, 900);
      }
    }
  }, [activeMatch, bluffState, syncBluffState, finalizeBluffRound]);

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
        setResumableMatch(null);
        setExitConfirmOpen(false);
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

        if (activeMatch.gameType === "bluff" && gs.bluff) {
          setBluffState(gs.bluff);
          if (gs.bluff.phase === "round_result" && gs.bluff.roundSummary?.playerDeltas) {
            const myDelta = Number(gs.bluff.roundSummary.playerDeltas[myId] || 0);
            if (myDelta !== 0) {
              adjustMyGlobalWins(myDelta, `${activeMatch.roomId}_bluff_sync_r${gs.bluff.round}_${myId}`);
            }
          }
        } else if (activeMatch.gameType === "kelimelik" && gs.kelimelik) {
          const kl = gs.kelimelik;
          if (Array.isArray(kl.board)) setKlBoard(kl.board);
          setKlMyScore(isP1 ? Number(kl.p1Score || 0) : Number(kl.p2Score || 0));
          setKlOppScore(isP1 ? Number(kl.p2Score || 0) : Number(kl.p1Score || 0));
          setKlRound(Number(kl.round || 1));
          const turnSide = kl.turn || "p1";
          const myTurnNow = (isP1 && turnSide === "p1") || (!isP1 && turnSide === "p2");
          setKlTurn(myTurnNow ? "me" : "opp");
          if (kl.lastWordInfo) setKlLastWordInfo(kl.lastWordInfo);
          if (kl.status) setKlStatus(kl.status);
          if (kl.winner) {
            const wonMe = (isP1 && kl.winner === "p1") || (!isP1 && kl.winner === "p2");
            setKlWinner(wonMe ? "me" : kl.winner === "draw" ? "draw" : "opp");
            if (wonMe) awardWinPoint(`${activeMatch.roomId}_kl_win`);
          }
        } else if (activeMatch.gameType === "battleship") {
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
        startMatch(targetOpp, gId, false, rId, true, true);
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

  useEffect(() => {
    if (!dbRef.current || !bluffLobbyOpen || !bluffTableId) return;
    const membersRef = ref(dbRef.current, `bluff_tables/${bluffTableId}/members`);
    const unsub = onValue(membersRef, (snap) => {
      const val = snap.val() || {};
      const joinedList = Object.values(val).filter((m) => m && m.id && m.id !== myId);
      setBluffJoinedMembers(joinedList);
      setBluffInvitedIds((prev) => {
        const next = { ...prev };
        joinedList.forEach((m) => {
          next[m.id] = "accepted";
        });
        return next;
      });
    });
    return () => unsub();
  }, [bluffLobbyOpen, bluffTableId, myId]);

  useEffect(() => {
    const invitedEntries = Object.entries(bluffInvitedIds || {});
    if (invitedEntries.length === 0) return;

    if (!dbRef.current) {
      const pendingIds = invitedEntries.filter(([, st]) => st === "pending").map(([id]) => id);
      if (pendingIds.length === 0) return;
      const timer = setTimeout(() => {
        pendingIds.forEach((uid) => {
          const found = activeLobbyPlayers.find((u) => u.id === uid);
          if (found) {
            setBluffInvitedIds((prev) => ({ ...prev, [uid]: "accepted" }));
            setBluffJoinedMembers((prev) =>
              prev.some((m) => m.id === found.id) ? prev : [...prev, { id: found.id, name: found.name }]
            );
          }
        });
      }, 1200);
      return () => clearTimeout(timer);
    }

    const unsubs = invitedEntries.map(([uid, status]) => {
      if (status !== "pending") return () => {};
      const invRef = ref(dbRef.current, `invites/${uid}`);
      return onValue(invRef, (snap) => {
        const val = snap.val();
        if (!val || val.fromId !== myId || val.gameId !== "bluff") return;
        if (val.status === "accepted") {
          setBluffInvitedIds((prev) => ({ ...prev, [uid]: "accepted" }));
          setBluffJoinedMembers((prev) =>
            prev.some((m) => m.id === uid)
              ? prev
              : [...prev, { id: uid, name: val.acceptedByName || val.toName || "Oyuncu" }]
          );
          remove(invRef);
        } else if (val.status === "declined") {
          setBluffInvitedIds((prev) => ({ ...prev, [uid]: "declined" }));
          remove(invRef);
        }
      });
    });

    return () => {
      unsubs.forEach((fn) => fn && fn());
    };
  }, [bluffInvitedIds, activeLobbyPlayers, myId]);

  useEffect(() => {
    if (!dbRef.current || !joinedBluffTable || !joinedBluffTable.tableId) return;
    const tableRef = ref(dbRef.current, `bluff_tables/${joinedBluffTable.tableId}`);
    const unsub = onValue(tableRef, (snap) => {
      const val = snap.val();
      if (!val) {
        setJoinedBluffTable(null);
        showNotice("Blöf Masası Kapatıldı", "Masa kurucusu Blöf masasını kapattı.");
        return;
      }

      const membersObj = val.members || {};
      const memberNames = Object.values(membersObj)
        .filter(Boolean)
        .map((m) => m.name);
      setJoinedBluffTable((prev) =>
        prev ? { ...prev, memberNames, status: val.status || "waiting" } : null
      );

      if (val.status === "started" && val.roomId) {
        const rId = val.roomId;
        const hostId = val.hostId || joinedBluffTable.hostId;
        const hostName = val.hostName || joinedBluffTable.hostName;
        const initialBluff = val.initialBluff || null;
        const allPlayers = Array.isArray(val.players) ? val.players : [];

        setJoinedBluffTable(null);
        setResumableMatch(null);
        setExitConfirmOpen(false);
        clearAllGameTimers();
        processedLiveRoundRef.current = 0;
        awardedMatchIdRef.current = null;
        leftNoticeShownRef.current = false;

        if (initialBluff) {
          setBluffState(initialBluff);
        }
        setBluffClueInput("");
        setBluffSelectedSuspect(null);
        setMatchMessages([
          {
            id: "m_" + Date.now(),
            senderId: "sys",
            senderName: "Sistem",
            text: `Blöf oyunu ${Math.max(3, allPlayers.length)} oyuncuyla başladı!`,
            ts: Date.now(),
          },
        ]);
        setMatchUnread(0);
        setMatchDrawerOpen(true);
        setFloatingReaction(null);

        setActiveMatch({
          roomId: rId,
          gameType: "bluff",
          isBot: false,
          isHost: false,
          opponent: { id: hostId, name: hostName },
        });
      }
    });
    return () => unsub();
  }, [joinedBluffTable]);

  function triggerBotKelimelikTurn(currentBoard, currentMyScore, currentOppScore, currentRound) {
    if (botKlTimerRef.current) clearTimeout(botKlTimerRef.current);
    botKlTimerRef.current = setTimeout(() => {
      const nextBoard = currentBoard.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
      const candidateWords = KELIMELIK_BOT_WORDS.filter((w) => Array.from(w).length >= 3);
      const chosenWord = candidateWords[Math.floor(Math.random() * candidateWords.length)] || "KALE";
      const chars = Array.from(chosenWord);

      let placed = false;
      for (let r = 0; r < KELIMELIK_SIZE && !placed; r++) {
        for (let c = 0; c <= KELIMELIK_SIZE - chars.length && !placed; c++) {
          let touches = false;
          let canFit = true;
          for (let k = 0; k < chars.length; k++) {
            const existing = nextBoard[r][c + k];
            if (existing && existing.letter !== chars[k]) {
              canFit = false;
              break;
            }
            if (existing) touches = true;
            const adj = [
              [r - 1, c + k],
              [r + 1, c + k],
              [r, c + k - 1],
              [r, c + k + 1],
            ];
            for (const [ar, ac] of adj) {
              if (
                ar >= 0 &&
                ar < KELIMELIK_SIZE &&
                ac >= 0 &&
                ac < KELIMELIK_SIZE &&
                nextBoard[ar][ac]?.letter
              ) {
                touches = true;
              }
            }
          }
          if (canFit && touches) {
            let earned = 0;
            for (let k = 0; k < chars.length; k++) {
              const pt = getLetterPoint(chars[k]);
              const bonus = KELIMELIK_BONUS_MAP[`${r},${c + k}`];
              earned += bonus === "H2" ? pt * 2 : pt;
              nextBoard[r][c + k] = {
                letter: chars[k],
                points: pt,
                locked: true,
              };
            }
            const nextOpp = currentOppScore + earned;
            setKlBoard(nextBoard);
            setKlOppScore(nextOpp);
            setKlLastWordInfo({ by: activeMatch?.opponent?.name || "Rakip", word: chosenWord, points: earned });
            if (nextOpp >= 40) {
              setKlWinner("opp");
              setKlStatus(`Rakip "${chosenWord}" ile +${earned} puan aldı ve 40 puana ulaştı!`);
            } else {
              setKlTurn("me");
              setKlRound(currentRound + 1);
              setKlStatus(`Rakip "${chosenWord}" (+${earned}p) oynadı. Sıra sende!`);
            }
            placed = true;
          }
        }
      }

      if (!placed) {
        setKlTurn("me");
        setKlRound(currentRound + 1);
        setKlStatus("Rakip pas geçti. Sıra sende!");
      }
    }, 850);
  }

  function handleKlPlaceLetter(rackIdx) {
    if (klWinner || klTurn !== "me") return;
    const letter = klRack[rackIdx];
    if (!letter) return;

    const [sr, sc] = klSelectedTilePos;
    let targetR = sr;
    let targetC = sc;

    const isOccupiedOrDraft = (r, c) =>
      Boolean(klBoard[r]?.[c]?.letter) || klDraftCells.some((d) => d.r === r && d.c === c);

    if (isOccupiedOrDraft(targetR, targetC)) {
      let found = false;
      for (let r = 0; r < KELIMELIK_SIZE && !found; r++) {
        for (let c = 0; c < KELIMELIK_SIZE && !found; c++) {
          if (!isOccupiedOrDraft(r, c)) {
            targetR = r;
            targetC = c;
            found = true;
          }
        }
      }
      if (!found) return;
    }

    const nextDraft = [
      ...klDraftCells,
      { r: targetR, c: targetC, letter, rackIdx },
    ];
    const nextRack = klRack.map((item, idx) => (idx === rackIdx ? null : item));

    setKlDraftCells(nextDraft);
    setKlRack(nextRack);

    if (targetC + 1 < KELIMELIK_SIZE && !isOccupiedOrDraft(targetR, targetC + 1)) {
      setKlSelectedTilePos([targetR, targetC + 1]);
    }
  }

  function handleKlUndoDraft() {
    if (klDraftCells.length === 0) return;
    const last = klDraftCells[klDraftCells.length - 1];
    setKlDraftCells((prev) => prev.slice(0, -1));
    setKlRack((prev) =>
      prev.map((item, idx) => (idx === last.rackIdx ? last.letter : item))
    );
    setKlSelectedTilePos([last.r, last.c]);
    setKlStatus("Son yerleştirilen harf geri alındı.");
  }

  function handleKlShuffleRack() {
    setKlRack((prev) => {
      const copy = [...prev];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    });
  }

  function handleKlPassTurn() {
    if (klWinner || klTurn !== "me") return;
    handleKlUndoDraft();
    const freshRack = drawKelimelikRack(7);
    setKlRack(freshRack);
    const nextRound = klRound + 1;

    if (activeMatch && !activeMatch.isBot && dbRef.current) {
      setKlTurn("opp");
      setKlRound(nextRound);
      setKlStatus("Pas geçtin. Rakibin hamlesi bekleniyor...");
      update(ref(dbRef.current, `matches/${activeMatch.roomId}/gameState/kelimelik`), {
        turn: activeMatch.isHost ? "p2" : "p1",
        round: nextRound,
        status: `${nickname.trim()} pas geçti. Sıra sende!`,
      });
      return;
    }

    setKlTurn("opp");
    setKlRound(nextRound);
    setKlStatus("Pas geçtin, harflerin yenilendi. Rakip oynuyor...");
    triggerBotKelimelikTurn(klBoard, klMyScore, klOppScore, nextRound);
  }

  function handleKlSubmitWord() {
    if (klWinner || klTurn !== "me") return;
    const evalRes = evaluateKelimelikPlacement(klBoard, klDraftCells);
    if (!evalRes.ok) {
      setKlStatus(evalRes.reason);
      return;
    }

    const nextBoard = klBoard.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
    klDraftCells.forEach((d) => {
      nextBoard[d.r][d.c] = {
        letter: d.letter,
        points: getLetterPoint(d.letter),
        locked: true,
      };
    });

    const nextMyScore = klMyScore + evalRes.points;
    const nextRack = drawKelimelikRack(7);
    const nextRound = klRound + 1;

    setKlBoard(nextBoard);
    setKlDraftCells([]);
    setKlRack(nextRack);
    setKlMyScore(nextMyScore);
    setKlLastWordInfo({ by: nickname.trim(), word: evalRes.word, points: evalRes.points });

    const wonNow = nextMyScore >= 40;
    if (wonNow) {
      setKlWinner("me");
      setKlStatus(`"${evalRes.word}" ile +${evalRes.points} puan! 40 puana ulaştın ve kazandın! (+1 Puan)`);
      awardWinPoint(`${activeMatch?.roomId}_kl_win_${nextMyScore}`);
    } else {
      setKlTurn("opp");
      setKlRound(nextRound);
      setKlStatus(`"${evalRes.word}" (+${evalRes.points} puan) eklendi! Sıra rakipte...`);
    }

    if (activeMatch && !activeMatch.isBot && dbRef.current) {
      const isP1 = activeMatch.isHost;
      update(ref(dbRef.current, `matches/${activeMatch.roomId}/gameState/kelimelik`), {
        board: nextBoard,
        p1Score: isP1 ? nextMyScore : klOppScore,
        p2Score: isP1 ? klOppScore : nextMyScore,
        turn: wonNow ? (isP1 ? "p1" : "p2") : isP1 ? "p2" : "p1",
        round: nextRound,
        winner: wonNow ? (isP1 ? "p1" : "p2") : null,
        lastWordInfo: { by: nickname.trim(), word: evalRes.word, points: evalRes.points },
        status: wonNow
          ? `${nickname.trim()} "${evalRes.word}" ile oyunu kazandı!`
          : `${nickname.trim()} "${evalRes.word}" (+${evalRes.points}p) oynadı. Sıra sende!`,
      });
      return;
    }

    if (!wonNow && activeMatch?.isBot) {
      triggerBotKelimelikTurn(nextBoard, nextMyScore, klOppScore, nextRound);
    }
  }

  function openBluffTable(initialInvitee = null) {
    setSelectedTargetUser(null);
    const newTableId = `bt_${myId}_${Date.now()}`;
    const hostName = nickname.trim() || "Oyuncu";
    setBluffTableId(newTableId);
    setBluffLobbyOpen(true);
    setBluffJoinedMembers([]);

    if (dbRef.current) {
      set(ref(dbRef.current, `bluff_tables/${newTableId}`), {
        tableId: newTableId,
        hostId: myId,
        hostName,
        status: "waiting",
        createdAt: Date.now(),
        members: {
          [myId]: { id: myId, name: hostName },
        },
      });
    }

    if (initialInvitee && initialInvitee.id) {
      setBluffInvitedIds({ [initialInvitee.id]: "pending" });
      if (dbRef.current && !initialInvitee.isBot) {
        set(ref(dbRef.current, `invites/${initialInvitee.id}`), {
          fromId: myId,
          fromName: hostName,
          toId: initialInvitee.id,
          toName: initialInvitee.name,
          gameId: "bluff",
          gameName: "Blöf",
          lobbyMode: "bluff_table",
          tableId: newTableId,
          status: "pending",
          ts: Date.now(),
        });
      }
    } else {
      setBluffInvitedIds({});
    }
  }

  function closeBluffTable() {
    if (dbRef.current && bluffTableId) {
      remove(ref(dbRef.current, `bluff_tables/${bluffTableId}`));
    }
    setBluffLobbyOpen(false);
    setBluffTableId(null);
    setBluffInvitedIds({});
    setBluffJoinedMembers([]);
  }

  function sendBluffInviteToUser(targetUser) {
    if (!targetUser || !targetUser.id || targetUser.status === "in_game") return;
    if (bluffInvitedIds[targetUser.id] === "pending" || bluffInvitedIds[targetUser.id] === "accepted") {
      return;
    }
    const activeTableId = bluffTableId || `bt_${myId}_${Date.now()}`;
    if (!bluffTableId) {
      setBluffTableId(activeTableId);
      if (dbRef.current) {
        set(ref(dbRef.current, `bluff_tables/${activeTableId}`), {
          tableId: activeTableId,
          hostId: myId,
          hostName: nickname.trim() || "Oyuncu",
          status: "waiting",
          createdAt: Date.now(),
          members: {
            [myId]: { id: myId, name: nickname.trim() || "Oyuncu" },
          },
        });
      }
    }

    setBluffInvitedIds((prev) => ({ ...prev, [targetUser.id]: "pending" }));
    if (dbRef.current && !targetUser.isBot) {
      set(ref(dbRef.current, `invites/${targetUser.id}`), {
        fromId: myId,
        fromName: nickname.trim(),
        toId: targetUser.id,
        toName: targetUser.name,
        gameId: "bluff",
        gameName: "Blöf",
        lobbyMode: "bluff_table",
        tableId: activeTableId,
        status: "pending",
        ts: Date.now(),
      });
    }
  }

  function buildBluffParticipantsFromTable(customHumanMembers = null) {
    const cleanMyName = nickname.trim() || "Sen";
    const list = [{ id: myId, name: cleanMyName, isBot: false, score: 0 }];
    const humans = customHumanMembers !== null ? customHumanMembers : bluffJoinedMembers;
    humans.forEach((m) => {
      if (m && m.id && m.id !== myId && !list.some((x) => x.id === m.id)) {
        list.push({ id: m.id, name: m.name, isBot: false, score: 0 });
      }
    });

    const botPool = LOBBY_BOT_PLAYERS.slice(0, 3).map((b) => ({
      id: b.id,
      name: b.name,
      isBot: true,
      score: 0,
    }));
    let idx = 0;
    while (list.length < 3 && idx < botPool.length) {
      list.push(botPool[idx]);
      idx++;
    }
    return list;
  }

  function handleStartBluffFromTable() {
    const participants = buildBluffParticipantsFromTable(bluffJoinedMembers);
    const hasOnlyBotsAsOthers = participants.every((p) => p.id === myId || p.isBot);
    const firstOpp =
      participants.find((p) => p.id !== myId && !p.isBot) ||
      participants.find((p) => p.id !== myId) || {
        id: "bot_efe",
        name: "Efe",
      };
    const roomId = `bluff_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const initialBluff = createInitialBluffState(participants, 1, {});
    const currentTableId = bluffTableId;

    setBluffLobbyOpen(false);
    setBluffTableId(null);
    setBluffInvitedIds({});
    setBluffJoinedMembers([]);
    setResumableMatch(null);
    setExitConfirmOpen(false);
    clearAllGameTimers();
    processedLiveRoundRef.current = 0;
    awardedMatchIdRef.current = null;
    leftNoticeShownRef.current = false;

    setBluffState(initialBluff);
    setBluffClueInput("");
    setBluffSelectedSuspect(null);
    setMatchMessages([
      {
        id: "m_" + Date.now(),
        senderId: "sys",
        senderName: "Sistem",
        text: `Blöf oyunu ${participants.length} oyuncuyla başladı!`,
        ts: Date.now(),
      },
    ]);
    setMatchUnread(0);
    setMatchDrawerOpen(true);
    setFloatingReaction(null);

    setActiveMatch({
      roomId,
      gameType: "bluff",
      isBot: hasOnlyBotsAsOthers,
      isHost: true,
      opponent: { id: firstOpp.id, name: firstOpp.name },
    });

    if (dbRef.current && !hasOnlyBotsAsOthers) {
      set(ref(dbRef.current, `matches/${roomId}`), {
        roomId,
        gameType: "bluff",
        players: participants.map((p) => p.id),
        createdAt: Date.now(),
        leftBy: null,
        chatList: [],
        gameState: {
          bluff: initialBluff,
        },
      });

      if (currentTableId) {
        update(ref(dbRef.current, `bluff_tables/${currentTableId}`), {
          status: "started",
          roomId,
          players: participants,
          initialBluff,
          startedAt: Date.now(),
        });
      }
    } else if (dbRef.current && currentTableId) {
      remove(ref(dbRef.current, `bluff_tables/${currentTableId}`));
    }
  }

  function resetAllGameStates(
    gameType,
    isBotMatch = false,
    roomIdForSync = null,
    isHostForSync = true,
    opponentObj = null,
    openChatByDefault = false
  ) {
    clearAllGameTimers();
    processedLiveRoundRef.current = 0;
    awardedMatchIdRef.current = null;
    leftNoticeShownRef.current = false;

    const freshKlBoard = createInitialKelimelikBoard();
    setKlBoard(freshKlBoard);
    setKlRack(drawKelimelikRack(7));
    setKlDraftCells([]);
    setKlSelectedTilePos([3, 2]);
    setKlMyScore(0);
    setKlOppScore(0);
    setKlTurn("me");
    setKlRound(1);
    setKlStatus("Tahtada boş kare seç ve alttan harf koyarak kelime kur! (Hedef: 40 puan)");
    setKlWinner(null);
    setKlLastWordInfo(null);

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
    setWordStatus("5 harfli kelimeyi bul! Yeşil: doğru yer, Turuncu: farklı yer, Kırmızı: yok.");
    setWordFinished(false);
    setOppWordProgress(0);

    const nextIdx = (sudokuIndex + 1) % SUDOKU_PUZZLES.length;
    setSudokuIndex(nextIdx);
    setSudokuBoard(SUDOKU_PUZZLES[nextIdx].puzzle.map((r) => [...r]));
    setSelectedCell([0, 1]);
    setSudokuMessage("Boş kareye 1-4 arası rakam yerleştir.");
    setSudokuWinner(null);
    setOppSudokuProgress(0);

    const existingHumans =
      bluffState && Array.isArray(bluffState.players)
        ? bluffState.players.filter((p) => !p.isBot && p.id !== myId).map((p) => ({ id: p.id, name: p.name }))
        : !isBotMatch && opponentObj && opponentObj.id && !LOBBY_BOT_ID_SET.has(opponentObj.id)
        ? [{ id: opponentObj.id, name: opponentObj.name }]
        : [];
    const participants = buildBluffParticipantsFromTable(existingHumans);
    const initialBluff = createInitialBluffState(participants, 1, {});
    setBluffState(initialBluff);
    setBluffClueInput("");
    setBluffSelectedSuspect(null);

    if (!isBotMatch && dbRef.current && roomIdForSync && isHostForSync) {
      update(ref(dbRef.current, `matches/${roomIdForSync}/gameState`), {
        phase: "picking",
        bluff: initialBluff,
        kelimelik: {
          board: freshKlBoard,
          p1Score: 0,
          p2Score: 0,
          turn: "p1",
          round: 1,
          winner: null,
          lastWordInfo: null,
          status: "Tahtada boş kare seç ve alttan harf koyarak kelime kur!",
        },
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
    setMatchDrawerOpen(Boolean(openChatByDefault));
    setFloatingReaction(null);

    if (isBotMatch && gameType === "sudoku") {
      botSudokuTimerRef.current = setTimeout(() => setOppSudokuProgress(40), 2200);
    }

    return initialBluff;
  }

  function startMatch(
    opponent,
    gameType,
    isBot = false,
    customRoomId = null,
    isHost = true,
    openChatByDefault = false
  ) {
    const resolvedIsBot = Boolean(isBot || opponent?.isBot || LOBBY_BOT_ID_SET.has(opponent?.id));
    const roomId = customRoomId || `room_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const matchObj = {
      roomId,
      gameType,
      isBot: resolvedIsBot,
      isHost,
      opponent: { id: opponent.id, name: opponent.name },
    };
    const initialBluff = resetAllGameStates(
      gameType,
      resolvedIsBot,
      roomId,
      isHost,
      opponent,
      openChatByDefault
    );
    setResumableMatch(null);
    setExitConfirmOpen(false);
    setActiveMatch(matchObj);
    setSelectedTargetUser(null);
    setOutgoingInvite(null);
    setIncomingInvite(null);

    if (dbRef.current && !resolvedIsBot && isHost) {
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
          bluff: initialBluff,
          kelimelik: {
            board: createInitialKelimelikBoard(),
            p1Score: 0,
            p2Score: 0,
            turn: "p1",
            round: 1,
            winner: null,
            lastWordInfo: null,
            status: "Tahtada boş kare seç ve alttan harf koyarak kelime kur!",
          },
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

  function handleRandomMatch() {
    const chosenGame =
      RANDOM_DUEL_GAME_IDS[Math.floor(Math.random() * RANDOM_DUEL_GAME_IDS.length)];
    const availableHumans = users.filter(
      (u) =>
        u &&
        u.id &&
        u.id !== myId &&
        !u.isBot &&
        !LOBBY_BOT_ID_SET.has(u.id) &&
        (u.status || "online") === "online"
    );

    if (availableHumans.length > 0 && dbRef.current) {
      const pickedHuman =
        availableHumans[Math.floor(Math.random() * availableHumans.length)];
      const gameMeta = GAMES_META.find((g) => g.id === chosenGame) || GAMES_META[0];
      acceptedHandledRef.current = false;
      const invitePayload = {
        fromId: myId,
        fromName: nickname.trim(),
        toId: pickedHuman.id,
        toName: pickedHuman.name,
        gameId: gameMeta.id,
        gameName: gameMeta.name,
        openChat: true,
        status: "pending",
        ts: Date.now(),
      };
      set(ref(dbRef.current, `invites/${pickedHuman.id}`), invitePayload);
      setOutgoingInvite(invitePayload);
      return;
    }

    const pickedBot =
      LOBBY_BOT_PLAYERS[Math.floor(Math.random() * LOBBY_BOT_PLAYERS.length)];
    startMatch(pickedBot, chosenGame, true, null, true, true);
  }

  function sendGameInvite(targetUser, gameId) {
    if (gameId === "bluff") {
      openBluffTable(targetUser);
      return;
    }

    if (targetUser.isBot || LOBBY_BOT_ID_SET.has(targetUser.id)) {
      startMatch(targetUser, gameId, true, null, true, false);
      return;
    }

    acceptedHandledRef.current = false;
    const gameMeta = GAMES_META.find((g) => g.id === gameId) || GAMES_META[0];
    const invitePayload = {
      fromId: myId,
      fromName: nickname.trim(),
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
      startMatch(targetUser, gameMeta.id, false, `local_${Date.now()}`, true, false);
    }
  }

  function acceptIncomingInvite() {
    if (!incomingInvite) return;
    const isBluffTableInvite =
      incomingInvite.gameId === "bluff" && incomingInvite.lobbyMode === "bluff_table";

    if (isBluffTableInvite) {
      const cleanMyName = nickname.trim() || "Oyuncu";
      const tId = incomingInvite.tableId;
      if (dbRef.current) {
        if (tId) {
          set(ref(dbRef.current, `bluff_tables/${tId}/members/${myId}`), {
            id: myId,
            name: cleanMyName,
          });
        }
        update(ref(dbRef.current, `invites/${myId}`), {
          status: "accepted",
          acceptedById: myId,
          acceptedByName: cleanMyName,
          ts: Date.now(),
        });
      }
      const hostInfo = { id: incomingInvite.fromId, name: incomingInvite.fromName };
      setIncomingInvite(null);
      if (tId) {
        setJoinedBluffTable({
          tableId: tId,
          hostId: hostInfo.id,
          hostName: hostInfo.name,
          memberNames: [hostInfo.name, cleanMyName],
          status: "waiting",
        });
      } else {
        showNotice(
          "Blöf Masasına Katıldın",
          `${hostInfo.name} masasında diğer oyuncuların katılımı ve oyunun başlatılması bekleniyor.`
        );
      }
      return;
    }

    const roomId = `room_${Date.now()}`;
    const inviter = { id: incomingInvite.fromId, name: incomingInvite.fromName };
    const gameId = incomingInvite.gameId;
    const shouldOpenChat = Boolean(incomingInvite.openChat);
    if (dbRef.current) {
      update(ref(dbRef.current, `invites/${myId}`), { status: "accepted", roomId });
    }
    setIncomingInvite(null);
    startMatch(inviter, gameId, false, roomId, false, shouldOpenChat);
  }

  function declineIncomingInvite() {
    if (!incomingInvite) return;
    if (dbRef.current) {
      update(ref(dbRef.current, `invites/${myId}`), { status: "declined", ts: Date.now() });
    }
    setIncomingInvite(null);
  }

  function leaveJoinedBluffTable() {
    if (dbRef.current && joinedBluffTable?.tableId) {
      remove(ref(dbRef.current, `bluff_tables/${joinedBluffTable.tableId}/members/${myId}`));
    }
    setJoinedBluffTable(null);
  }

  function confirmLeaveMatchToLobby() {
    if (!activeMatch) return;
    clearAllGameTimers();
    setExitConfirmOpen(false);
    setMatchDrawerOpen(false);
    setResumableMatch({
      ...activeMatch,
      savedAt: Date.now(),
    });
    setActiveMatch(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("duello_active_match");
    }
  }

  function handleResumeSavedMatch() {
    if (!resumableMatch) return;
    const restored = {
      roomId: resumableMatch.roomId,
      gameType: resumableMatch.gameType,
      isBot: Boolean(resumableMatch.isBot || LOBBY_BOT_ID_SET.has(resumableMatch.opponent?.id)),
      isHost: Boolean(resumableMatch.isHost),
      opponent: resumableMatch.opponent || { id: "bot_efe", name: "Efe" },
    };
    if (restored.gameType === "bluff" && !bluffState) {
      const participants = buildBluffParticipantsFromTable(
        !restored.isBot && restored.opponent?.id && !LOBBY_BOT_ID_SET.has(restored.opponent.id)
          ? [{ id: restored.opponent.id, name: restored.opponent.name }]
          : []
      );
      setBluffState(createInitialBluffState(participants, 1, {}));
    }
    setResumableMatch(null);
    setActiveMatch(restored);
  }

  function handleDismissResumableMatch() {
    if (dbRef.current && resumableMatch && !resumableMatch.isBot) {
      update(ref(dbRef.current, `matches/${resumableMatch.roomId}`), { leftBy: myId });
    }
    setResumableMatch(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("duello_resumable_match");
    }
  }

  function handleRequestNewMatch(gameType) {
    if (!activeMatch) return;
    if (activeMatch.isBot) {
      resetAllGameStates(
        gameType,
        true,
        activeMatch.roomId,
        activeMatch.isHost,
        activeMatch.opponent,
        matchDrawerOpen
      );
      return;
    }
    const targetOpp = activeMatch.opponent;
    if (dbRef.current) {
      update(ref(dbRef.current, `matches/${activeMatch.roomId}`), { leftBy: myId });
    }
    clearAllGameTimers();
    setActiveMatch(null);
    setResumableMatch(null);
    setExitConfirmOpen(false);
    setMatchDrawerOpen(false);
    sendGameInvite(targetOpp, gameType);
  }

  function handleBluffSelectSecretWord(chosenWord) {
    if (!bluffState || bluffState.phase !== "selecting_word" || bluffState.starterId !== myId) return;
    syncBluffState({
      ...bluffState,
      secretWord: chosenWord,
      phase: "cluing",
    });
  }

  function handleBluffSubmitClue(e) {
    e.preventDefault();
    if (!bluffState || bluffState.phase !== "cluing") return;
    const players = bluffState.players || [];
    const clues = bluffState.clues || [];
    const activePlayer = players[clues.length % players.length];
    if (!activePlayer || activePlayer.id !== myId) return;

    const cleanClue = bluffClueInput.trim();
    if (!cleanClue) return;

    setBluffClueInput("");
    const nextClues = [
      ...clues,
      {
        playerId: myId,
        playerName: nickname.trim() || "Sen",
        text: cleanClue,
        cycle: Math.floor(clues.length / players.length) + 1,
        ts: Date.now(),
      },
    ];
    const everyoneDidAtLeastTwo =
      nextClues.length >= players.length * 2 && nextClues.length % players.length === 0;

    syncBluffState({
      ...bluffState,
      clues: nextClues,
      phase: everyoneDidAtLeastTwo ? "ask_vote" : "cluing",
      votePromptVotes: {},
    });
  }

  function handleBluffVotePromptAnswer(answer) {
    if (!bluffState || bluffState.phase !== "ask_vote") return;
    const players = bluffState.players || [];
    const currentVotes = bluffState.votePromptVotes || {};
    if (currentVotes[myId]) return;

    const updatedVotes = {
      ...currentVotes,
      [myId]: answer,
    };
    const allVoted = players.every((p) => Boolean(updatedVotes[p.id]));
    if (!allVoted) {
      syncBluffState({
        ...bluffState,
        votePromptVotes: updatedVotes,
      });
    } else {
      const yesCount = Object.values(updatedVotes).filter((v) => v === "yes").length;
      const majorityYes = yesCount > players.length / 2;
      syncBluffState({
        ...bluffState,
        votePromptVotes: updatedVotes,
        phase: majorityYes ? "voting" : "cluing",
        guesses: {},
      });
    }
  }

  function handleBluffSubmitGuess() {
    if (!bluffState || bluffState.phase !== "voting" || !bluffSelectedSuspect) return;
    if (myId === bluffState.blufferId) return;
    const players = bluffState.players || [];
    const nonBluffers = players.filter((p) => p.id !== bluffState.blufferId);
    const currentGuesses = bluffState.guesses || {};
    if (currentGuesses[myId]) return;

    const nextGuesses = {
      ...currentGuesses,
      [myId]: bluffSelectedSuspect,
    };
    setBluffSelectedSuspect(null);

    const allGuessed = nonBluffers.every((p) => Boolean(nextGuesses[p.id]));
    if (!allGuessed) {
      syncBluffState({
        ...bluffState,
        guesses: nextGuesses,
      });
    } else {
      finalizeBluffRound(bluffState, nextGuesses);
    }
  }

  function handleBluffNextRound() {
    if (!bluffState) return;
    const currentPlayers = bluffState.players || [];
    const scoreMap = {};
    currentPlayers.forEach((p) => {
      scoreMap[p.id] = p.score || 0;
    });
    const nextRoundNum = Number(bluffState.round || 1) + 1;
    const nextState = createInitialBluffState(currentPlayers, nextRoundNum, scoreMap);
    setBluffClueInput("");
    setBluffSelectedSuspect(null);
    syncBluffState(nextState);
  }

  function handleSendGlobalMessage(e) {
    e.preventDefault();
    const text = globalInput.trim();
    if (!text) return;
    const msg = {
      id: "g_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      senderId: myId,
      senderName: nickname.trim(),
      text,
      ts: Date.now(),
    };
    setGlobalInput("");
    if (dbRef.current) push(ref(dbRef.current, "chats/global"), msg);
    else setGlobalMessages((prev) => [...prev.slice(-49), msg]);
  }

  function handleDeleteGlobalMessage(msg) {
    if (!isFdAdmin || !msg) return;
    setGlobalMessages((prev) => prev.filter((item) => item.id !== msg.id && item.fbKey !== msg.fbKey));
    if (dbRef.current && msg.fbKey) {
      remove(ref(dbRef.current, `chats/global/${msg.fbKey}`));
    }
  }

  function handleSubmitReport(e) {
    e.preventDefault();
    if (!reportTargetUser) return;
    const reasonText = reportReason.trim() || "Uygunsuz davranış / sohbet";
    const reportEntry = {
      targetId: reportTargetUser.id,
      targetName: reportTargetUser.name,
      reporterId: myId,
      reporterName: nickname.trim(),
      reason: reasonText,
      ts: Date.now(),
    };
    if (dbRef.current) {
      push(ref(dbRef.current, "reports"), reportEntry);
    } else {
      setReportsList((prev) => [{ id: "rep_" + Date.now(), ...reportEntry }, ...prev]);
    }
    setReportTargetUser(null);
    setReportReason("");
    showNotice("Şikayet İletildi", `${reportTargetUser.name} hakkındaki şikayet FD yönetimine iletildi.`);
  }

  function handleKickAndBanUser(targetUser, reportIdToClear = null) {
    if (!isFdAdmin || !targetUser || !targetUser.id || targetUser.id === myId) return;
    const banPayload = {
      id: targetUser.id,
      name: targetUser.name || "Oyuncu",
      bannedBy: "FD",
      bannedAt: Date.now(),
    };

    setUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
    setBannedUsers((prev) => ({ ...prev, [targetUser.id]: banPayload }));

    if (dbRef.current) {
      set(ref(dbRef.current, `banned_users/${targetUser.id}`), banPayload);
      remove(ref(dbRef.current, `users/${targetUser.id}`));
      remove(ref(dbRef.current, `invites/${targetUser.id}`));
      if (reportIdToClear) {
        remove(ref(dbRef.current, `reports/${reportIdToClear}`));
      }
    }
    if (reportIdToClear) {
      setReportsList((prev) => prev.filter((r) => r.id !== reportIdToClear));
    }
    showNotice("Kullanıcı Atıldı", `${targetUser.name} siteden uzaklaştırıldı ve engellendi.`);
  }

  function handleUnbanUser(userId) {
    if (!isFdAdmin || !userId) return;
    setBannedUsers((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
    if (dbRef.current) {
      remove(ref(dbRef.current, `banned_users/${userId}`));
    }
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
    const peerSnapshot = dmTarget;
    const msg = {
      id: "dm_" + Date.now(),
      senderId: myId,
      senderName: nickname.trim(),
      text,
      ts: Date.now(),
    };
    setDmInput("");

    if (peerSnapshot.isBot || LOBBY_BOT_ID_SET.has(peerSnapshot.id)) {
      setDmMessagesByPeer((prev) => ({
        ...prev,
        [peerSnapshot.id]: [...(prev[peerSnapshot.id] || []), msg],
      }));
      const delayMs = computeHumanBotDelayMs(text);
      setTimeout(() => {
        const replyMsg = {
          id: "dm_b_" + Date.now(),
          senderId: peerSnapshot.id,
          senderName: peerSnapshot.name,
          text: getBotChatReply(text, "general"),
          ts: Date.now(),
        };
        setDmMessagesByPeer((prev) => ({
          ...prev,
          [peerSnapshot.id]: [...(prev[peerSnapshot.id] || []), replyMsg],
        }));
      }, delayMs);
      return;
    }

    if (dbRef.current) {
      const threadId = [myId, peerSnapshot.id].sort().join("__");
      push(ref(dbRef.current, `chats/dm/${threadId}`), msg);
    } else {
      setDmMessagesByPeer((prev) => ({
        ...prev,
        [peerSnapshot.id]: [...(prev[peerSnapshot.id] || []), msg],
      }));
    }
  }

  function sendMatchChatText(rawText) {
    const text = (rawText || "").trim();
    if (!text || !activeMatch) return;
    const msg = {
      id: "mc_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      senderId: myId,
      senderName: nickname.trim(),
      text,
      ts: Date.now(),
    };
    const nextList = [...matchMessages, msg];
    setMatchMessages(nextList);
    setMatchInput("");

    if (activeMatch.isBot || LOBBY_BOT_ID_SET.has(activeMatch.opponent?.id)) {
      if (botChatTimerRef.current) clearTimeout(botChatTimerRef.current);
      const delayMs = computeHumanBotDelayMs(text);
      const replyText = getBotChatReply(text, activeMatch.gameType);
      botChatTimerRef.current = setTimeout(() => {
        const botMsg = {
          id: "mc_bot_" + Date.now() + "_" + Math.random().toString(36).slice(2, 4),
          senderId: activeMatch.opponent.id || "bot",
          senderName: activeMatch.opponent.name,
          text: replyText,
          ts: Date.now(),
        };
        setMatchMessages((prev) => [...prev, botMsg]);
        if (!matchDrawerOpen) setMatchUnread((u) => u + 1);
      }, delayMs);
      return;
    }

    if (dbRef.current) {
      update(ref(dbRef.current, `matches/${activeMatch.roomId}`), {
        chatList: nextList.slice(-60),
      });
    }
  }

  function handleSendEmojiReaction(emoji) {
    const reaction = { emoji, fromName: nickname.trim(), ts: Date.now() };
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

  const handleWordKey = useCallback(
    (key) => {
      if (wordFinished) return;
      if (key === "SIL") {
        setCurrentGuess((g) => Array.from(g).slice(0, -1).join(""));
        return;
      }
      if (key === "GIR") {
        const chars = Array.from(currentGuess);
        if (chars.length !== 5) {
          setWordStatus("Lütfen 5 harf girin.");
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

        if (normalizeTrChar(normalizedGuess) === normalizeTrChar(wordTarget)) {
          setWordStatus(`Tebrikler! "${wordTarget}" kelimesini buldun! (+1 Puan)`);
          setWordFinished(true);
          awardWinPoint(`${activeMatch?.roomId}_wordle_${wordTarget}`);
        } else if (nextGuesses.length >= 6) {
          setWordStatus(`6 deneme hakkın doldu. Aranan kelime: ${wordTarget}`);
          setWordFinished(true);
        } else {
          const greenCount = evalRow.filter((s) => s === "green").length;
          const orangeCount = evalRow.filter((s) => s === "orange").length;
          setWordStatus(
            `${nextGuesses.length}/6 deneme: ${greenCount} yeşil, ${orangeCount} turuncu ipucu bulundu. Alt satırdan devam et!`
          );
        }
        return;
      }

      const mappedLetter = toWordleUpperChar(key);
      if (!mappedLetter) return;
      if (Array.from(currentGuess).length < 5) {
        setCurrentGuess((g) => g + mappedLetter);
      }
    },
    [wordFinished, currentGuess, wordTarget, wordGuesses, activeMatch]
  );

  useEffect(() => {
    if (!activeMatch || activeMatch.gameType !== "wordle" || wordFinished) return;
    const onPhysicalKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Enter") {
        e.preventDefault();
        handleWordKey("GIR");
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleWordKey("SIL");
      } else {
        const mapped = toWordleUpperChar(e.key);
        if (mapped) {
          e.preventDefault();
          handleWordKey(mapped);
        }
      }
    };
    window.addEventListener("keydown", onPhysicalKeyDown);
    return () => window.removeEventListener("keydown", onPhysicalKeyDown);
  }, [activeMatch, wordFinished, handleWordKey]);

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

  const wordLetterClues = useMemo(() => {
    const greenSet = new Set();
    const orangeSet = new Set();
    const redSet = new Set();

    for (const g of wordGuesses) {
      const letters = Array.from(g.word);
      letters.forEach((ch, idx) => {
        const norm = normalizeTrChar(ch);
        const st = g.eval[idx];
        if (st === "green") {
          greenSet.add(ch);
          orangeSet.delete(ch);
          redSet.delete(ch);
        } else if (st === "orange") {
          if (!greenSet.has(ch) && !Array.from(greenSet).some((x) => normalizeTrChar(x) === norm)) {
            orangeSet.add(ch);
          }
          redSet.delete(ch);
        } else if (st === "red") {
          const isGreenOrOrangeElsewhere =
            Array.from(greenSet).some((x) => normalizeTrChar(x) === norm) ||
            Array.from(orangeSet).some((x) => normalizeTrChar(x) === norm);
          if (!isGreenOrOrangeElsewhere) {
            redSet.add(ch);
          }
        }
      });
    }

    return {
      green: Array.from(greenSet),
      orange: Array.from(orangeSet),
      red: Array.from(redSet),
    };
  }, [wordGuesses]);

  const wordLetterStatuses = useMemo(() => {
    const map = {};
    const priority = { red: 1, orange: 2, green: 3 };
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

  const onlineIdSet = useMemo(() => {
    const s = new Set(activeLobbyPlayers.map((u) => u.id));
    if (enteredLobby) s.add(myId);
    return s;
  }, [activeLobbyPlayers, enteredLobby, myId]);

  const combinedPlayersForLists = useMemo(() => {
    const cleanName = isReservedFdName(nickname) ? "FD" : nickname.trim();
    const map = new Map();

    INITIAL_KNOWN_PLAYERS.forEach((p) => {
      map.set(p.id, { ...p });
    });

    knownPlayers.forEach((p) => {
      const prev = map.get(p.id);
      map.set(p.id, {
        id: p.id,
        name: p.name || prev?.name || "Oyuncu",
        wins: Math.max(Number(prev?.wins || 0), Number(p.wins || 0)),
        lastSeenAt: Math.max(Number(prev?.lastSeenAt || 0), Number(p.lastSeenAt || 0)),
      });
    });

    users.forEach((u) => {
      const prev = map.get(u.id);
      map.set(u.id, {
        id: u.id,
        name: u.name || prev?.name || "Oyuncu",
        wins: Math.max(Number(prev?.wins || 0), Number(u.wins || 0)),
        lastSeenAt: Math.max(
          Number(prev?.lastSeenAt || 0),
          Number(u.lastSeenAt || u.updatedAt || Date.now())
        ),
      });
    });

    if (enteredLobby && cleanName) {
      const prevMe = map.get(myId);
      map.set(myId, {
        id: myId,
        name: cleanName,
        wins: Math.max(Number(prevMe?.wins || 0), Number(myWins || 0)),
        lastSeenAt: Math.max(Number(prevMe?.lastSeenAt || 0), Date.now()),
      });
    }

    return Array.from(map.values()).map((p) => ({
      ...p,
      isOnline: onlineIdSet.has(p.id),
      isMe: p.id === myId,
    }));
  }, [knownPlayers, users, enteredLobby, myId, nickname, myWins, onlineIdSet]);

  const topFiveWinners = useMemo(() => {
    return [...combinedPlayersForLists]
      .sort((a, b) => b.wins - a.wins || b.lastSeenAt - a.lastSeenAt)
      .slice(0, 5);
  }, [combinedPlayersForLists]);

  const lastFiveOnlinePlayers = useMemo(() => {
    return [...combinedPlayersForLists]
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt || b.wins - a.wins)
      .slice(0, 5);
  }, [combinedPlayersForLists]);

  if (!enteredLobby) {
    const needsFirstTimeFdSetup = typingFdName && (!storedFdAuth || !storedFdAuth.passwordHash);

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-5 select-none">
        <div className="max-w-md w-full mx-auto my-auto space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 mb-1">
              <Gamepad2 className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Düello Arenası</h1>
            <p className="text-sm text-slate-400">
              Aktif oyuncularla eşleş, sohbet et ve 7 farklı oyunda yarış.
            </p>
          </div>

          <form
            onSubmit={handleJoinLobby}
            className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl"
          >
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Takma Adın
              </label>
              <input
                type="text"
                maxLength={18}
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value);
                  if (loginError) setLoginError("");
                }}
                placeholder="Örn: Emirhan"
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-base"
              />
            </div>

            {typingFdName && (
              <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  <Lock className="w-4 h-4" />
                  {needsFirstTimeFdSetup
                    ? "FD Yönetici Şifresi Oluştur"
                    : "FD Korumalı Yönetici Girişi"}
                </div>
                <input
                  type="password"
                  value={fdPasswordInput}
                  onChange={(e) => {
                    setFdPasswordInput(e.target.value);
                    if (loginError) setLoginError("");
                  }}
                  placeholder={needsFirstTimeFdSetup ? "Yeni FD şifresi belirleyin" : "FD şifrenizi girin"}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 text-sm"
                />
                {needsFirstTimeFdSetup && (
                  <input
                    type="password"
                    value={fdPasswordConfirm}
                    onChange={(e) => {
                      setFdPasswordConfirm(e.target.value);
                      if (loginError) setLoginError("");
                    }}
                    placeholder="FD şifresini tekrar girin"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 text-sm"
                  />
                )}
              </div>
            )}

            {loginError && (
              <p className="text-xs font-semibold text-rose-400 bg-rose-950/50 border border-rose-500/40 rounded-xl px-3 py-2">
                {loginError}
              </p>
            )}

            <button
              type="submit"
              disabled={!nickname.trim()}
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-45 disabled:cursor-not-allowed active:scale-[0.99] transition font-bold text-white flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25"
            >
              <Sparkles className="w-4 h-4" />
              Lobiye Katıl
            </button>
          </form>

          <div className="grid grid-cols-3 gap-2 text-center text-xs text-slate-400">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5">
              <div className="font-semibold text-slate-200">7 Oyun</div>
              <div>Kelimelik, Blöf...</div>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5">
              <div className="font-semibold text-slate-200">1 Saatlik Sohbet</div>
              <div>Otomatik temizlenir</div>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5">
              <div className="font-semibold text-slate-200">İlk 5 Listeler</div>
              <div>Puan & Son Online</div>
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
    const gameInfo = GAMES_META.find((g) => g.id === activeMatch.gameType) || GAMES_META[0];
    const shownMyPick = rpsMyPick || rpsLastShownMyPick;
    const shownOppPick = rpsOppPick || rpsLastShownOppPick;
    const totalShipCells = countShipCells(enemyGridForBot);
    const myHitCells = countHitsOnGrid(myShotsOnEnemy);

    const bluffPlayers = bluffState?.players || [];
    const bluffClues = bluffState?.clues || [];
    const amIBluffer = bluffState?.blufferId === myId;
    const amIBluffStarter = bluffState?.starterId === myId;
    const bluffStarterObj = bluffPlayers.find((p) => p.id === bluffState?.starterId);
    const activeBluffCluer =
      bluffState?.phase === "cluing" && bluffPlayers.length > 0
        ? bluffPlayers[bluffClues.length % bluffPlayers.length]
        : null;
    const isMyBluffClueTurn = activeBluffCluer?.id === myId;
    const myPromptVote = bluffState?.votePromptVotes?.[myId] || null;
    const myBluffGuess = bluffState?.guesses?.[myId] || null;

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
            </div>
            <p className="text-sm font-semibold text-white">
              {activeMatch.gameType === "bluff"
                ? `${bluffPlayers.length} Oyuncu • Tur ${bluffState?.round || 1}`
                : `${nickname.trim()} vs ${activeMatch.opponent.name}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                resetAllGameStates(
                  activeMatch.gameType,
                  activeMatch.isBot,
                  activeMatch.roomId,
                  activeMatch.isHost,
                  activeMatch.opponent,
                  matchDrawerOpen
                )
              }
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setExitConfirmOpen(true)}
              className="px-3 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              Lobi
            </button>
          </div>
        </header>

        {exitConfirmOpen && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl text-center">
              <div className="w-11 h-11 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-300 flex items-center justify-center mx-auto">
                <LogOut className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-white">Oyundan çıkmak istiyor musun?</h3>
                <p className="text-xs text-slate-400">
                  Lobiye dönersen istersen lobiden bu maça tekrar geri dönebilirsin.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => setExitConfirmOpen(false)}
                  className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold text-xs text-slate-200"
                >
                  Vazgeç
                </button>
                <button
                  onClick={confirmLeaveMatchToLobby}
                  className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-xs text-white"
                >
                  Evet, Çık
                </button>
              </div>
            </div>
          </div>
        )}

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
          {activeMatch.gameType === "kelimelik" && (
            <div className="space-y-3">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between text-center">
                  <div className="flex-1">
                    <div className="text-[11px] text-slate-400">Sen</div>
                    <div className="text-2xl font-extrabold text-indigo-400">{klMyScore}</div>
                  </div>
                  <div className="px-2.5 py-1 rounded-full bg-slate-800 text-[11px] font-bold text-amber-300">
                    TUR {klRound} • HEDEF 40
                  </div>
                  <div className="flex-1">
                    <div className="text-[11px] text-slate-400">{activeMatch.opponent.name}</div>
                    <div className="text-2xl font-extrabold text-rose-400">{klOppScore}</div>
                  </div>
                </div>

                <p className="text-xs text-center font-medium text-slate-200">{klStatus}</p>

                {klLastWordInfo && (
                  <div className="text-[11px] text-center text-emerald-300 bg-slate-950/70 rounded-xl py-1 px-2 border border-slate-800">
                    Son Kelime: <strong>{klLastWordInfo.word}</strong> ({klLastWordInfo.by} • +{klLastWordInfo.points}p)
                  </div>
                )}

                {klWinner && (
                  <div className="pt-1 text-center space-y-2">
                    <div className="text-sm font-extrabold text-emerald-400">
                      {klWinner === "me"
                        ? "KELİMELİK DÜELLOSUNU KAZANDIN! (+1 Puan) 🎉"
                        : klWinner === "draw"
                        ? "Berabere!"
                        : "Rakip Kazandı!"}
                    </div>
                    <button
                      onClick={() => handleRequestNewMatch("kelimelik")}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white"
                    >
                      {activeMatch.isBot ? "Yeni Kelimelik Maçı" : "Yeni Maç Daveti Gönder"}
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-7 gap-1 bg-slate-900 p-2 rounded-2xl border border-slate-800">
                {klBoard.map((row, r) =>
                  row.map((cell, c) => {
                    const draftObj = klDraftCells.find((d) => d.r === r && d.c === c);
                    const displayLetter = draftObj ? draftObj.letter : cell?.letter || "";
                    const displayPts = displayLetter ? getLetterPoint(displayLetter) : null;
                    const bonus = KELIMELIK_BONUS_MAP[`${r},${c}`];
                    const isSelected = klSelectedTilePos[0] === r && klSelectedTilePos[1] === c;

                    return (
                      <button
                        key={`kl-${r}-${c}`}
                        disabled={Boolean(klWinner) || klTurn !== "me" || Boolean(cell?.letter)}
                        onClick={() => setKlSelectedTilePos([r, c])}
                        className={`aspect-square rounded-lg border relative flex flex-col items-center justify-center transition ${
                          draftObj
                            ? "bg-amber-500/30 border-amber-400 text-amber-200"
                            : cell?.letter
                            ? "bg-indigo-600/30 border-indigo-400/60 text-white"
                            : isSelected
                            ? "bg-sky-900/70 border-sky-400 text-sky-100"
                            : bonus === "K2"
                            ? "bg-rose-950/60 border-rose-500/40 text-rose-300"
                            : bonus === "H2"
                            ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                            : "bg-slate-950/80 border-slate-800 text-slate-400"
                        }`}
                      >
                        {displayLetter ? (
                          <>
                            <span className="text-sm font-black leading-none">{displayLetter}</span>
                            <span className="text-[9px] font-bold opacity-80 leading-none mt-0.5">
                              {displayPts}
                            </span>
                          </>
                        ) : (
                          <span className="text-[9px] font-bold">
                            {bonus === "K2" ? "K2" : bonus === "H2" ? "H2" : bonus === "STAR" ? "★" : ""}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2.5">
                <div className="grid grid-cols-7 gap-1.5">
                  {klRack.map((ch, idx) => (
                    <button
                      key={`rack-${idx}-${ch || "empty"}`}
                      disabled={!ch || Boolean(klWinner) || klTurn !== "me"}
                      onClick={() => handleKlPlaceLetter(idx)}
                      className={`aspect-square rounded-xl border flex flex-col items-center justify-center transition active:scale-95 ${
                        ch
                          ? "bg-amber-400 text-slate-950 border-amber-200 shadow"
                          : "bg-slate-950/60 border-slate-800 text-transparent"
                      }`}
                    >
                      {ch && (
                        <>
                          <span className="text-base font-black leading-none">{ch}</span>
                          <span className="text-[10px] font-extrabold leading-none mt-0.5">
                            {getLetterPoint(ch)}
                          </span>
                        </>
                      )}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    onClick={handleKlUndoDraft}
                    disabled={klDraftCells.length === 0}
                    className="py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-[11px] font-bold text-slate-200 flex items-center justify-center gap-1"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    Geri Al
                  </button>
                  <button
                    onClick={handleKlShuffleRack}
                    className="py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-200 flex items-center justify-center gap-1"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    Karıştır
                  </button>
                  <button
                    onClick={handleKlPassTurn}
                    disabled={Boolean(klWinner) || klTurn !== "me"}
                    className="py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-[11px] font-bold text-amber-300 flex items-center justify-center gap-1"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                    Pas
                  </button>
                  <button
                    onClick={handleKlSubmitWord}
                    disabled={Boolean(klWinner) || klTurn !== "me" || klDraftCells.length === 0}
                    className="py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-[11px] font-extrabold text-white"
                  >
                    Gönder
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeMatch.gameType === "bluff" && bluffState && (
            <div className="space-y-3">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-300">
                    Tur {bluffState.round} • Blöf Masası
                  </span>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold">
                    {bluffPlayers.length} Oyuncu
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {bluffPlayers.map((p) => {
                    const isTurnNow =
                      (bluffState.phase === "selecting_word" && bluffState.starterId === p.id) ||
                      (bluffState.phase === "cluing" && activeBluffCluer?.id === p.id);
                    return (
                      <div
                        key={p.id}
                        className={`px-2.5 py-1 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
                          isTurnNow
                            ? "bg-amber-500/20 border-amber-400/60 text-amber-200"
                            : "bg-slate-950 border-slate-800 text-slate-300"
                        }`}
                      >
                        <span>{p.id === myId ? `${p.name} (Sen)` : p.name}</span>
                        <span className="text-[11px] px-1.5 py-0.2 rounded bg-slate-800 text-emerald-300">
                          {p.score}p
                        </span>
                      </div>
                    );
                  })}
                </div>

                {bluffState.secretWord ? (
                  amIBluffer ? (
                    <div className="p-2.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200 font-semibold">
                      Gizli rolün: <strong className="text-white">BLÖFÇÜ</strong> — Kelimeyi bilmiyorsun, çaktırmadan uyumlu bir çağrışım uydur!
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between">
                      <span className="text-xs text-emerald-200 font-medium">Gizli Kelimen:</span>
                      <span className="text-base font-extrabold text-white tracking-wide">
                        {bluffState.secretWord}
                      </span>
                    </div>
                  )
                ) : (
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                    {amIBluffStarter
                      ? "Bu turun ilk oyuncusu sensin! Aşağıdaki 10 kelimeden birini gizli kelime olarak seç."
                      : `${bluffStarterObj?.name || "İlk oyuncu"} bu turun gizli kelimesini seçiyor...`}
                  </div>
                )}
              </div>

              {bluffState.phase === "selecting_word" && amIBluffStarter && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
                  <div className="text-xs font-bold text-indigo-300">
                    10 Kelimeden Birini Seç (Sadece kelimeyi bilenler görecek)
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(bluffState.wordOptions || []).map((w) => (
                      <button
                        key={w}
                        onClick={() => handleBluffSelectSecretWord(w)}
                        className="py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-indigo-600/30 border border-slate-700 hover:border-indigo-400 text-xs font-bold text-white transition text-center"
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {bluffClues.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2">
                  <div className="text-xs font-bold text-slate-300">Söylenen Çağrışımlar</div>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto">
                    {bluffClues.map((c, idx) => (
                      <div
                        key={`${c.playerId}_${idx}_${c.ts}`}
                        className="flex items-center justify-between bg-slate-950/90 border border-slate-800/80 rounded-xl px-3 py-2 text-xs"
                      >
                        <div>
                          <span className="font-bold text-indigo-300">
                            {c.playerId === myId ? `${c.playerName} (Sen)` : c.playerName}:
                          </span>{" "}
                          <span className="text-white font-semibold">{c.text}</span>
                        </div>
                        <span className="text-[10px] text-slate-500">{c.cycle || 1}. tur</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {bluffState.phase === "cluing" && bluffState.secretWord && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
                  {isMyBluffClueTurn ? (
                    <form onSubmit={handleBluffSubmitClue} className="space-y-2">
                      <label className="block text-xs font-bold text-amber-300">
                        Sıra Sende! Tek kelimelik / kısa bir çağrışım yaz:
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          maxLength={28}
                          value={bluffClueInput}
                          onChange={(e) => setBluffClueInput(e.target.value)}
                          placeholder={amIBluffer ? "Blöf çağrışımın..." : "Kelimeyle ilgili çağrışım..."}
                          className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          type="submit"
                          disabled={!bluffClueInput.trim()}
                          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs font-bold text-white"
                        >
                          Gönder
                        </button>
                      </div>
                    </form>
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-1">
                      Şu an <strong className="text-slate-200">{activeBluffCluer?.name}</strong> çağrışım söylüyor...
                    </p>
                  )}
                </div>
              )}

              {bluffState.phase === "ask_vote" && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 text-center">
                  <div className="text-sm font-extrabold text-white">
                    Oylamaya geçilsin mi?
                  </div>
                  <p className="text-xs text-slate-400">
                    Herkes en az 2 çağrışım turunu tamamladı. Çoğunluk &ldquo;Evet&rdquo; derse Blöfçü oylaması başlar, &ldquo;Hayır&rdquo; derse yeni çağrışım turu açılır.
                  </p>
                  {!myPromptVote ? (
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        onClick={() => handleBluffVotePromptAnswer("yes")}
                        className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white"
                      >
                        Evet, Oylayalım
                      </button>
                      <button
                        onClick={() => handleBluffVotePromptAnswer("no")}
                        className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200"
                      >
                        Hayır, Devam
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs font-semibold text-indigo-300">
                      Senin oyun: <strong>{myPromptVote === "yes" ? "Evet" : "Hayır"}</strong>. Diğer oyuncular bekleniyor...
                    </div>
                  )}
                </div>
              )}

              {bluffState.phase === "voting" && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="text-sm font-extrabold text-white">
                    Blöfçü Kim? (Tahmin Oylaması)
                  </div>
                  <p className="text-xs text-slate-400">
                    Doğru bilirsen <strong className="text-emerald-300">+1 puan</strong> alırsın. Bilemezsen <strong className="text-rose-300">-1 puanın</strong> (varsa) Blöfçüye geçer!
                  </p>

                  {amIBluffer ? (
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-amber-300 font-semibold text-center">
                      Sen Blöfçüsün! Diğer oyuncuların seni tahmin etmesi bekleniyor...
                    </div>
                  ) : myBluffGuess ? (
                    <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/40 text-xs text-indigo-200 font-semibold text-center">
                      Tahminin alındı! Diğer oyuncuların oylaması bekleniyor...
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        {bluffPlayers
                          .filter((p) => p.id !== myId)
                          .map((cand) => {
                            const selected = bluffSelectedSuspect === cand.id;
                            return (
                              <button
                                key={cand.id}
                                onClick={() => setBluffSelectedSuspect(cand.id)}
                                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition ${
                                  selected
                                    ? "bg-rose-600/30 border-rose-400 text-white"
                                    : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600"
                                }`}
                              >
                                {cand.name}
                              </button>
                            );
                          })}
                      </div>
                      <button
                        disabled={!bluffSelectedSuspect}
                        onClick={handleBluffSubmitGuess}
                        className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-xs font-extrabold text-white"
                      >
                        Tahmini Gönder
                      </button>
                    </div>
                  )}
                </div>
              )}

              {bluffState.phase === "round_result" && bluffState.roundSummary && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="text-center space-y-1">
                    <div className="text-xs uppercase tracking-wider font-bold text-amber-300">
                      {bluffState.round}. Tur Sonucu
                    </div>
                    <div className="text-base font-extrabold text-white">
                      Blöfçü: <span className="text-rose-400">{bluffState.roundSummary.blufferName}</span>
                    </div>
                    <div className="text-xs text-slate-300">
                      Gizli Kelime: <strong className="text-emerald-300">{bluffState.roundSummary.secretWord}</strong>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {(bluffState.roundSummary.details || []).map((line, i) => (
                      <div
                        key={i}
                        className="text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                      >
                        {line}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleBluffNextRound}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-extrabold text-white"
                  >
                    Sonraki Tura Geç
                  </button>
                </div>
              )}
            </div>
          )}

          {activeMatch.gameType === "battleship" && (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 text-center space-y-1.5">
                <p className="text-sm font-semibold text-amber-300">{bsStatus}</p>
                <p className="text-[11px] text-slate-400">
                  Düşman İsabet: {myHitCells}/{totalShipCells || 7}
                </p>
                {bsWinner && (
                  <div className="pt-2 flex flex-col items-center gap-2">
                    <span
                      className={`text-sm font-extrabold ${
                        bsWinner === "me" ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {bsWinner === "me" ? "KAZANDIN! (+1 Puan)" : "KAYBETTİN!"}
                    </span>
                    <button
                      onClick={() => handleRequestNewMatch("battleship")}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white"
                    >
                      {activeMatch.isBot ? "Yeni Maç Başlat" : "Yeni Maç Daveti Gönder"}
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-rose-300">Düşman Denizi (Saldır)</span>
                  <span className="text-slate-400">
                    {bsTurn === "me" && !bsWinner ? "Atış sırası sende" : "Bekleniyor"}
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {myShotsOnEnemy.map((row, r) =>
                    row.map((cell, c) => {
                      let content = "";
                      let cls = "bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-400";
                      if (cell === 2) {
                        content = "💥";
                        cls = "bg-rose-950/90 border-rose-500/60 text-rose-200";
                      } else if (cell === 1) {
                        content = "•";
                        cls = "bg-slate-800/80 border-slate-700 text-slate-400";
                      }
                      return (
                        <button
                          key={`en-${r}-${c}`}
                          disabled={bsTurn !== "me" || Boolean(bsWinner) || cell !== 0}
                          onClick={() => handleBattleshipAttack(r, c)}
                          className={`aspect-square rounded-xl border font-bold text-sm flex items-center justify-center transition active:scale-95 ${cls}`}
                        >
                          {content}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-cyan-300">Senin Filo Haritan</span>
                  <span className="text-slate-400">Gemilerin</span>
                </div>
                <div className="grid grid-cols-6 gap-1">
                  {myShipGrid.map((row, r) =>
                    row.map((val, c) => {
                      const shotVal = enemyShotsOnMe[r][c];
                      let cls = "bg-slate-950 border-slate-800/80";
                      let mark = "";
                      if (val === 1 && shotVal === 2) {
                        cls = "bg-rose-950 border-rose-500";
                        mark = "🔥";
                      } else if (val === 1) {
                        cls = "bg-cyan-500/25 border-cyan-400/50";
                        mark = "🚢";
                      } else if (shotVal === 1) {
                        cls = "bg-slate-800/60 border-slate-700";
                        mark = "•";
                      }
                      return (
                        <div
                          key={`my-${r}-${c}`}
                          className={`aspect-square rounded-lg border text-xs flex items-center justify-center ${cls}`}
                        >
                          {mark}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {activeMatch.gameType === "rps" && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 text-center">
              <div className="flex items-center justify-around bg-slate-950/80 border border-slate-800 rounded-2xl py-3 px-2">
                <div>
                  <div className="text-[11px] text-slate-400">Sen</div>
                  <div className="text-2xl font-extrabold text-indigo-400">{rpsMyScore}</div>
                </div>
                <div className="text-xs font-bold px-3 py-1 rounded-full bg-slate-800 text-slate-300">
                  TUR {rpsRound}/{RPS_TOTAL_ROUNDS}
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">{activeMatch.opponent.name}</div>
                  <div className="text-2xl font-extrabold text-rose-400">{rpsOppScore}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-1">
                  <div className="text-[11px] text-slate-400">Senin Seçimin</div>
                  <div className="text-3xl h-10 flex items-center justify-center">
                    {rpsPhase === "picking" && !rpsMyPick ? "🤔" : getRPSEmoji(shownMyPick)}
                  </div>
                  <div className="text-xs font-semibold text-slate-200">
                    {rpsPhase === "picking" && !rpsMyPick ? "Seçim bekleniyor" : getRPSLabel(shownMyPick)}
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-1">
                  <div className="text-[11px] text-slate-400">{activeMatch.opponent.name}</div>
                  <div className="text-3xl h-10 flex items-center justify-center">
                    {rpsPhase === "picking" ? "❓" : getRPSEmoji(shownOppPick)}
                  </div>
                  <div className="text-xs font-semibold text-slate-200">
                    {rpsPhase === "picking"
                      ? rpsMyPick
                        ? "Seçimini yaptı / bekleniyor"
                        : "Kapalı"
                      : getRPSLabel(shownOppPick)}
                  </div>
                </div>
              </div>

              <p className="text-sm font-bold text-amber-300 min-h-[2.5rem] flex items-center justify-center">
                {rpsRoundText}
              </p>

              {rpsHistory.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {rpsHistory.map((h) => (
                    <span
                      key={h.round}
                      className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold ${
                        h.resultForP1 === "win"
                          ? "bg-emerald-950/70 border-emerald-500/40 text-emerald-300"
                          : h.resultForP1 === "lose"
                          ? "bg-rose-950/70 border-rose-500/40 text-rose-300"
                          : "bg-slate-800 border-slate-700 text-slate-300"
                      }`}
                    >
                      T{h.round}: {h.label}
                    </span>
                  ))}
                </div>
              )}

              {!rpsMatchWinner ? (
                <div className="grid grid-cols-3 gap-2.5 pt-1">
                  {RPS_CHOICES.map((ch) => {
                    const isSelectedThisRound = rpsMyPick === ch.id;
                    return (
                      <button
                        key={ch.id}
                        disabled={rpsPhase !== "picking" || Boolean(rpsMyPick)}
                        onClick={() => handleRPSPick(ch.id)}
                        className={`py-3.5 rounded-2xl border disabled:opacity-50 active:scale-95 transition flex flex-col items-center gap-1 ${
                          isSelectedThisRound
                            ? "bg-indigo-600/30 border-indigo-400 ring-2 ring-indigo-400/40"
                            : "bg-slate-800 hover:bg-slate-700 border-slate-700"
                        }`}
                      >
                        <span className="text-2xl">{ch.emoji}</span>
                        <span className="text-xs font-bold">{ch.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2.5 pt-1">
                  <div
                    className={`text-base font-extrabold ${
                      rpsMatchWinner === "me"
                        ? "text-emerald-400"
                        : rpsMatchWinner === "draw"
                        ? "text-amber-300"
                        : "text-rose-400"
                    }`}
                  >
                    {rpsMatchWinner === "me"
                      ? `SERİYİ KAZANDIN! (${rpsMyScore}-${rpsOppScore}) (+1 Puan)`
                      : rpsMatchWinner === "draw"
                      ? `SERİ BERABERE! (${rpsMyScore}-${rpsOppScore})`
                      : `SERİYİ KAYBETTİN! (${rpsMyScore}-${rpsOppScore})`}
                  </div>
                  <button
                    onClick={() => handleRequestNewMatch("rps")}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white"
                  >
                    {activeMatch.isBot ? "Yeni 5 Turluk Seri" : "Yeni Seri Daveti Gönder"}
                  </button>
                </div>
              )}
            </div>
          )}

          {activeMatch.gameType === "ttt" && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 text-center">
              <div className="text-sm font-semibold text-slate-300">
                {tttResult ? (
                  <span className="text-emerald-400 font-extrabold">
                    {tttResult.winner === "draw"
                      ? "Berabere!"
                      : tttResult.winner === (activeMatch.isBot || activeMatch.isHost ? "X" : "O")
                      ? "Kazandın! (+1 Puan)"
                      : "Rakip Kazandı!"}
                  </span>
                ) : (
                  <span>
                    Sıra:{" "}
                    <strong className="text-indigo-400">
                      {tttTurn === (activeMatch.isBot || activeMatch.isHost ? "X" : "O")
                        ? "Sende"
                        : activeMatch.opponent.name}
                    </strong>{" "}
                    ({tttTurn})
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 max-w-[270px] mx-auto">
                {tttBoard.map((val, idx) => {
                  const winCell = tttResult?.line?.includes(idx);
                  return (
                    <button
                      key={idx}
                      disabled={Boolean(val) || Boolean(tttResult)}
                      onClick={() => handleTTTMove(idx)}
                      className={`aspect-square rounded-2xl border text-3xl font-black flex items-center justify-center transition active:scale-95 ${
                        winCell
                          ? "bg-emerald-600/30 border-emerald-400 text-emerald-300"
                          : "bg-slate-950 hover:bg-slate-800/80 border-slate-800 text-white"
                      }`}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>

              {tttResult && (
                <button
                  onClick={() => handleRequestNewMatch("ttt")}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white"
                >
                  {activeMatch.isBot ? "Tekrar Oyna" : "Yeni Maç Daveti Gönder"}
                </button>
              )}
            </div>
          )}

          {activeMatch.gameType === "wordle" && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Tahmin: {wordGuesses.length}/6</span>
                {activeMatch.isBot && <span>Rakip İlerleme: %{oppWordProgress}</span>}
              </div>

              <p className="text-xs text-center text-amber-300 font-medium">{wordStatus}</p>

              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-2.5 space-y-1.5 text-[11px]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold">
                    Doğru Yer
                  </span>
                  <span className="text-slate-200 font-semibold">
                    {wordLetterClues.green.length > 0 ? wordLetterClues.green.join(", ") : "-"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold">
                    Farklı Yer
                  </span>
                  <span className="text-slate-200 font-semibold">
                    {wordLetterClues.orange.length > 0 ? wordLetterClues.orange.join(", ") : "-"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-rose-700 text-white font-bold">
                    Kelimede Yok
                  </span>
                  <span className="text-slate-300 font-medium">
                    {wordLetterClues.red.length > 0 ? wordLetterClues.red.join(", ") : "-"}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 max-w-[260px] mx-auto">
                {Array.from({ length: 6 }).map((_, rowIdx) => {
                  const guessObj = wordGuesses[rowIdx];
                  const isCurrent = rowIdx === wordGuesses.length && !wordFinished;
                  const activeChars = isCurrent ? Array.from(currentGuess) : [];
                  const guessChars = guessObj ? Array.from(guessObj.word) : [];

                  return (
                    <div key={rowIdx} className="grid grid-cols-5 gap-1.5">
                      {Array.from({ length: 5 }).map((__, colIdx) => {
                        let ch = "";
                        let boxCls = "bg-slate-950 border-slate-800 text-white";
                        if (guessObj) {
                          ch = guessChars[colIdx] || "";
                          const st = guessObj.eval[colIdx];
                          if (st === "green") boxCls = "bg-emerald-600 border-emerald-500 text-white";
                          else if (st === "orange") boxCls = "bg-amber-500 border-amber-400 text-slate-950";
                          else boxCls = "bg-rose-900/80 border-rose-700 text-rose-100";
                        } else if (isCurrent) {
                          ch = activeChars[colIdx] || "";
                          boxCls = ch
                            ? "bg-slate-800 border-indigo-400 text-white"
                            : "bg-slate-950 border-slate-700 text-white";
                        }
                        return (
                          <div
                            key={colIdx}
                            className={`h-10 rounded-xl border font-extrabold text-base flex items-center justify-center ${boxCls}`}
                          >
                            {ch}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {wordFinished && (
                <div className="text-center">
                  <button
                    onClick={() => handleRequestNewMatch("wordle")}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white"
                  >
                    Yeni Kelime Oyunu
                  </button>
                </div>
              )}

              <div className="space-y-1.5 pt-1">
                {KEYBOARD_ROWS.map((row, rIdx) => (
                  <div key={rIdx} className="flex justify-center gap-1">
                    {row.map((k) => {
                      const isSpecial = k === "GIR" || k === "SIL";
                      const st = wordLetterStatuses[k];
                      let keyCls = "bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700";
                      if (!isSpecial) {
                        if (st === "green") keyCls = "bg-emerald-600 text-white border-emerald-500";
                        else if (st === "orange") keyCls = "bg-amber-500 text-slate-950 border-amber-400";
                        else if (st === "red") keyCls = "bg-rose-950/80 text-rose-300 border-rose-800/70";
                      } else if (k === "GIR") {
                        keyCls = "bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500";
                      }
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => handleWordKey(k)}
                          className={`${
                            isSpecial ? "px-2.5 text-[11px] font-extrabold" : "w-7 sm:w-8 text-xs font-bold"
                          } h-9 rounded-lg border active:scale-95 transition flex items-center justify-center ${keyCls}`}
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
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3.5 text-center">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>4x4 Hız Sudoku</span>
                {activeMatch.isBot && <span>Rakip: %{oppSudokuProgress}</span>}
              </div>

              <p className="text-xs font-semibold text-amber-300">{sudokuMessage}</p>

              <div className="grid grid-cols-4 gap-1.5 max-w-[240px] mx-auto">
                {sudokuBoard.map((row, r) =>
                  row.map((val, c) => {
                    const isFixed = SUDOKU_PUZZLES[sudokuIndex].puzzle[r][c] !== 0;
                    const isSel = selectedCell[0] === r && selectedCell[1] === c;
                    const conflict = !isFixed && val !== 0 && hasSudokuConflict(sudokuBoard, r, c, val);
                    return (
                      <button
                        key={`${r}-${c}`}
                        onClick={() => setSelectedCell([r, c])}
                        className={`aspect-square rounded-xl border text-xl font-extrabold flex items-center justify-center transition ${
                          conflict
                            ? "bg-rose-950/90 border-rose-500 text-rose-300"
                            : isSel
                            ? "bg-indigo-600/30 border-indigo-400 text-white"
                            : isFixed
                            ? "bg-slate-800/90 border-slate-700 text-cyan-300"
                            : "bg-slate-950 border-slate-800 text-white"
                        }`}
                      >
                        {val || ""}
                      </button>
                    );
                  })
                )}
              </div>

              <div className="grid grid-cols-4 gap-2 max-w-[240px] mx-auto">
                {[1, 2, 3, 4].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleSudokuNumber(num)}
                    className="py-2.5 rounded-xl bg-slate-800 hover:bg-indigo-600 font-extrabold text-sm text-white transition"
                  >
                    {num}
                  </button>
                ))}
              </div>

              {sudokuWinner && (
                <button
                  onClick={() => handleRequestNewMatch("sudoku")}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white"
                >
                  Yeni Sudoku
                </button>
              )}
            </div>
          )}
        </main>

        <div className="fixed bottom-0 inset-x-0 z-40 max-w-md mx-auto">
          <div className="bg-slate-900 border-t border-x border-slate-800 rounded-t-2xl shadow-2xl">
            <button
              onClick={() => {
                setMatchDrawerOpen((o) => !o);
                setMatchUnread(0);
              }}
              className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-slate-200"
            >
              <span className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-indigo-400" />
                Maç Sohbeti ({activeMatch.opponent.name})
                {matchUnread > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px]">
                    {matchUnread}
                  </span>
                )}
              </span>
              {matchDrawerOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>

            {matchDrawerOpen && (
              <div className="px-3.5 pb-3.5 space-y-2.5 border-t border-slate-800/80 pt-2.5">
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {QUICK_REPLIES.map((qr) => (
                    <button
                      key={qr}
                      onClick={() => sendMatchChatText(qr)}
                      className="shrink-0 px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 border border-slate-700"
                    >
                      {qr}
                    </button>
                  ))}
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {matchMessages.map((m) => {
                    const mine = m.senderId === myId;
                    const sys = m.senderId === "sys";
                    if (sys) {
                      return (
                        <div key={m.id} className="text-[11px] text-center text-slate-400 py-0.5">
                          {m.text}
                        </div>
                      );
                    }
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
                      >
                        <span className="text-[10px] text-slate-500 px-1">
                          {mine ? "Sen" : m.senderName}
                        </span>
                        <div
                          className={`px-3 py-1.5 rounded-2xl text-xs max-w-[82%] ${
                            mine
                              ? "bg-indigo-600 text-white rounded-br-sm"
                              : "bg-slate-800 text-slate-100 rounded-bl-sm"
                          }`}
                        >
                          {m.text}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendMatchChatText(matchInput);
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={matchInput}
                    onChange={(e) => setMatchInput(e.target.value)}
                    placeholder="Mesaj yaz..."
                    className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-10">
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-extrabold text-white leading-tight">Düello Arenası</h1>
              {isFdAdmin && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-[10px] font-bold text-amber-300">
                  <Shield className="w-3 h-3" />
                  Yönetici
                </span>
              )}
            </div>
            <p className="text-xs text-emerald-400 font-medium">
              • {nickname.trim()} • {myWins} Puan
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            clearAllGameTimers();
            if (dbRef.current) {
              remove(ref(dbRef.current, `users/${myId}`));
            }
            setEnteredLobby(false);
            setIsFdAuthenticated(false);
            setFdPasswordInput("");
            setFdPasswordConfirm("");
            setActiveMatch(null);
            setResumableMatch(null);
            setExitConfirmOpen(false);
            setBluffLobbyOpen(false);
            setBluffTableId(null);
            setJoinedBluffTable(null);
            setDmTarget(null);
            setIncomingDm(null);
            if (typeof window !== "undefined") {
              window.localStorage.setItem("duello_entered_lobby", "0");
              window.localStorage.setItem("duello_fd_authed", "0");
              window.localStorage.removeItem("duello_active_match");
              window.localStorage.removeItem("duello_resumable_match");
            }
          }}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
        >
          Çıkış
        </button>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-5">
        {noticeBanner && (
          <div className="bg-indigo-950/70 border border-indigo-500/40 rounded-2xl p-3.5 flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-extrabold text-indigo-200">{noticeBanner.title}</div>
              <p className="text-xs text-slate-200">{noticeBanner.text}</p>
            </div>
            <button
              onClick={() => setNoticeBanner(null)}
              className="p-1 rounded-lg bg-slate-900/70 text-slate-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {resumableMatch && (
          <div className="bg-amber-950/45 border border-amber-500/40 rounded-2xl p-3.5 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-extrabold text-amber-300">Yarım Kalan Maçın Var</div>
              <p className="text-xs text-slate-200">
                {GAMES_META.find((g) => g.id === resumableMatch.gameType)?.name || "Oyun"} •{" "}
                {resumableMatch.opponent?.name || "Rakip"}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleResumeSavedMatch}
                className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold flex items-center gap-1"
              >
                <Play className="w-3.5 h-3.5" />
                Dön
              </button>
              <button
                onClick={handleDismissResumableMatch}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300"
                title="Maçı kapat"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {incomingDm && !dmTarget && (
          <div className="bg-slate-900 border border-indigo-500/50 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-lg">
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-indigo-400">
                Yeni Özel Mesaj • {incomingDm.peer.name}
              </div>
              <p className="text-xs text-white truncate">{incomingDm.text}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => openDirectMessage(incomingDm.peer)}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white"
              >
                Aç
              </button>
              <button
                onClick={() => setIncomingDm(null)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {joinedBluffTable && (
          <div className="bg-indigo-950/50 border border-indigo-400/50 rounded-2xl p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-300">
                Blöf Masasındasın
              </span>
              <button
                onClick={leaveJoinedBluffTable}
                className="px-2.5 py-1 rounded-lg bg-slate-900/80 text-[11px] font-semibold text-slate-300 hover:text-white"
              >
                Masadan Ayrıl
              </button>
            </div>
            <p className="text-xs text-slate-200">
              Kurucu: <strong className="text-white">{joinedBluffTable.hostName}</strong> • Oyunun başlatılması bekleniyor...
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(joinedBluffTable.memberNames || []).map((mName, idx) => (
                <span
                  key={`${mName}_${idx}`}
                  className="px-2.5 py-1 rounded-full bg-slate-900 border border-indigo-500/30 text-[11px] font-semibold text-indigo-200"
                >
                  {mName}
                </span>
              ))}
            </div>
          </div>
        )}

        {incomingInvite && (
          <div className="bg-indigo-950/60 border border-indigo-500/50 rounded-2xl p-4 space-y-3 shadow-xl">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
              <Bell className="w-4 h-4 animate-bounce" />
              GELEN OYUN DAVETİ
            </div>
            <p className="text-sm text-white">
              <strong className="text-indigo-300">{incomingInvite.fromName}</strong> seni{" "}
              <strong className="text-amber-300">{incomingInvite.gameName}</strong> oyununa davet ediyor!
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
            <div className="text-xs text-amber-200">
              <strong>{outgoingInvite.toName}</strong> kişisine{" "}
              <strong>{outgoingInvite.gameName}</strong> daveti gönderildi...
            </div>
            <button
              onClick={() => {
                if (dbRef.current && outgoingInvite.toId) {
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

        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-300 flex items-center gap-1.5">
              <Swords className="w-4 h-4 text-indigo-400" />
              Hızlı Eşleş veya Oyun Seç
            </h2>
            <span className="text-[11px] text-slate-500">Bot veya Canlı</span>
          </div>

          <button
            onClick={handleRandomMatch}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-[0.99] transition shadow-lg shadow-indigo-600/25 flex items-center justify-between text-white"
          >
            <span className="flex items-center gap-2.5 text-sm font-extrabold">
              <Shuffle className="w-4 h-4" />
              Rastgele Eşleş
            </span>
            <span className="text-[11px] font-semibold bg-white/15 px-2.5 py-0.5 rounded-full">
              Oyun + Sohbet
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            {GAMES_META.map((g) => {
              const IconComp = g.icon;
              return (
                <button
                  key={g.id}
                  onClick={() => {
                    if (g.id === "bluff") {
                      openBluffTable(null);
                    } else {
                      const pickedBot =
                        LOBBY_BOT_PLAYERS[Math.floor(Math.random() * LOBBY_BOT_PLAYERS.length)];
                      startMatch(pickedBot, g.id, true, null, true, false);
                    }
                  }}
                  className="bg-slate-900 hover:bg-slate-800/90 border border-slate-800 hover:border-indigo-500/40 rounded-2xl p-3.5 text-left transition active:scale-[0.98] space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <IconComp className="w-4 h-4 text-indigo-400" />
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      {g.badge}
                    </span>
                  </div>
                  <div className="font-bold text-sm text-white">{g.name}</div>
                  <div className="text-[11px] text-slate-400 leading-snug">{g.desc}</div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              Aktif Oyuncular ({activeLobbyPlayers.length})
            </h2>
            <span className="text-[11px] text-slate-400">Davet et veya mesaj at</span>
          </div>

          <div className="space-y-2">
            {activeLobbyPlayers.map((u) => {
              const inGame = u.status === "in_game";
              const unreadForPeer = dmUnreadByPeer[u.id] || 0;
              return (
                <div
                  key={u.id}
                  className="flex items-center justify-between bg-slate-950/80 border border-slate-800/90 rounded-xl px-3 py-2.5 gap-2"
                >
                  <button
                    onClick={() => {
                      if (inGame) return;
                      setSelectedGameForInvite("kelimelik");
                      setSelectedTargetUser(u);
                    }}
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        inGame ? "bg-amber-400" : "bg-emerald-400"
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{u.name}</div>
                      <div className="text-[11px] text-slate-400">
                        {inGame ? "Oyunda" : "Çevrim içi"} • {u.wins || 0} Puan
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => openDirectMessage(u)}
                      className="relative px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-indigo-400" />
                      DM
                      {unreadForPeer > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-indigo-600 text-[10px] text-white">
                          {unreadForPeer}
                        </span>
                      )}
                    </button>

                    {!u.isBot && (
                      <button
                        onClick={() => {
                          setReportTargetUser(u);
                          setReportReason("");
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-950/70 text-slate-400 hover:text-amber-300"
                        title="Şikayet Et"
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {isFdAdmin && !u.isBot && (
                      <button
                        onClick={() => handleKickAndBanUser(u)}
                        className="p-1.5 rounded-lg bg-rose-950/70 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30"
                        title="Siteden At ve Engelle"
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {!inGame && (
                      <button
                        onClick={() => {
                          setSelectedGameForInvite("kelimelik");
                          setSelectedTargetUser(u);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/30 text-xs font-semibold text-indigo-300"
                      >
                        Davet
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              En Çok Kazananlar (İlk 5)
            </h2>
            <span className="text-[11px] text-slate-400">Online olmasalar bile görünür</span>
          </div>

          <div className="space-y-1.5">
            {topFiveWinners.map((player, idx) => (
              <div
                key={player.id}
                className="flex items-center justify-between bg-slate-950/75 border border-slate-800/80 rounded-xl px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center font-extrabold text-[11px] ${
                      idx === 0
                        ? "bg-amber-400 text-slate-950"
                        : idx === 1
                        ? "bg-slate-300 text-slate-950"
                        : idx === 2
                        ? "bg-amber-700 text-white"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      player.isOnline ? "bg-emerald-400" : "bg-slate-600"
                    }`}
                  />
                  <span className="font-semibold text-white truncate">
                    {player.name} {player.isMe ? "(Sen)" : ""}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {player.isOnline ? "Online" : "Çevrimdışı"}
                  </span>
                </div>
                <span className="font-extrabold text-amber-300 shrink-0">{player.wins} Puan</span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-400" />
              Son Online Olanlar (İlk 5)
            </h2>
            <span className="text-[11px] text-slate-400">Güncel aktivite</span>
          </div>

          <div className="space-y-1.5">
            {lastFiveOnlinePlayers.map((player, idx) => (
              <div
                key={`recent_${player.id}`}
                className="flex items-center justify-between bg-slate-950/75 border border-slate-800/80 rounded-xl px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-[11px] font-bold text-slate-500 w-4">{idx + 1}.</span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      player.isOnline ? "bg-emerald-400" : "bg-slate-600"
                    }`}
                  />
                  <span className="font-semibold text-white truncate">
                    {player.name} {player.isMe ? "(Sen)" : ""}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 shrink-0">
                  {player.isOnline ? "Şu an online" : formatRelativeTime(player.lastSeenAt)}
                </span>
              </div>
            ))}
          </div>
        </section>

        {isFdAdmin && (
          <section className="bg-amber-950/25 border border-amber-500/40 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-amber-300 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                FD Yönetim Paneli
              </h2>
              <span className="text-[11px] text-amber-200/80">
                Şikayet: {reportsList.length} • Engelli: {Object.keys(bannedUsers).length}
              </span>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-300">Gelen Şikayetler</div>
              {reportsList.length === 0 ? (
                <p className="text-xs text-slate-400 bg-slate-950/70 rounded-xl p-2.5 border border-slate-800">
                  Henüz şikayet kaydı yok.
                </p>
              ) : (
                reportsList.map((rep) => (
                  <div
                    key={rep.id}
                    className="bg-slate-950/90 border border-slate-800 rounded-xl p-2.5 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <strong className="text-rose-300">{rep.targetName}</strong>{" "}
                        <span className="text-slate-400">({rep.reporterName} şikayet etti)</span>
                      </div>
                      <span className="text-[10px] text-slate-500">{formatRelativeTime(rep.ts)}</span>
                    </div>
                    <p className="text-slate-200">{rep.reason}</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          handleKickAndBanUser({ id: rep.targetId, name: rep.targetName }, rep.id)
                        }
                        className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px]"
                      >
                        Siteden At & Engelle
                      </button>
                      <button
                        onClick={() => {
                          setReportsList((prev) => prev.filter((x) => x.id !== rep.id));
                          if (dbRef.current) remove(ref(dbRef.current, `reports/${rep.id}`));
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px]"
                      >
                        Kapat
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {Object.keys(bannedUsers).length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-slate-300">Engellenen Kullanıcılar</div>
                {Object.values(bannedUsers).map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs"
                  >
                    <span className="text-rose-300 font-semibold">{b.name}</span>
                    <button
                      onClick={() => handleUnbanUser(b.id)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-emerald-300"
                    >
                      Engeli Kaldır
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden">
          <button
            onClick={() => {
              setGlobalChatOpen((o) => !o);
              setGlobalUnread(0);
            }}
            className="w-full px-4 py-3 flex items-center justify-between text-sm font-bold text-white"
          >
            <span className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-indigo-400" />
              Genel Lobi Sohbeti
              {globalUnread > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-[11px] text-white">
                  {globalUnread}
                </span>
              )}
            </span>
            {globalChatOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {globalChatOpen && (
            <div className="px-4 pb-4 space-y-3 border-t border-slate-800/80 pt-3">
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {visibleGlobalMessages.map((m) => {
                  const mine = m.senderId === myId;
                  const canDelete = isFdAdmin && m.senderId !== "sys";
                  return (
                    <div
                      key={m.id}
                      className={`text-xs rounded-xl px-3 py-2 flex items-start justify-between gap-2 ${
                        m.senderId === "sys"
                          ? "bg-indigo-950/40 text-indigo-200 border border-indigo-500/20"
                          : mine
                          ? "bg-indigo-600/25 text-white border border-indigo-500/30"
                          : "bg-slate-950 text-slate-200 border border-slate-800"
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-indigo-300 mr-1.5">
                          {m.senderName}
                          {m.senderName === "FD" ? " 🛡️" : ""}:
                        </span>
                        <span className="break-words">{m.text}</span>
                      </div>
                      {canDelete && (
                        <button
                          onClick={() => handleDeleteGlobalMessage(m)}
                          className="p-1 rounded-lg bg-rose-950/70 hover:bg-rose-600 text-rose-300 hover:text-white shrink-0"
                          title="Mesajı Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
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
                  className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center gap-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  Gönder
                </button>
              </form>
            </div>
          )}
        </section>
      </main>

      {bluffLobbyOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-white">Blöf Masası Kur</h3>
                <p className="text-xs text-slate-400">
                  En az 3 kişiyle oynanır. Eksik kalan yerler botlarla tamamlanır.
                </p>
              </div>
              <button
                onClick={closeBluffTable}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3 space-y-2">
              <div className="text-[11px] font-bold text-indigo-300">
                Masadaki Oyuncular ({1 + bluffJoinedMembers.length}/4)
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="px-2.5 py-1 rounded-full bg-indigo-600/30 border border-indigo-400/50 text-xs font-bold text-white">
                  {nickname.trim()} (Sen)
                </span>
                {bluffJoinedMembers.map((m) => (
                  <span
                    key={m.id}
                    className="px-2.5 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-xs font-semibold text-emerald-200"
                  >
                    {m.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-indigo-400" />
                Aktif Oyuncuları Masaya Davet Et
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {activeLobbyPlayers.map((u) => {
                  const invState = bluffInvitedIds[u.id];
                  const busy = u.status === "in_game";
                  return (
                    <div
                      key={u.id}
                      className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs"
                    >
                      <span className="font-semibold text-white">{u.name}</span>
                      <button
                        disabled={busy || invState === "pending" || invState === "accepted"}
                        onClick={() => sendBluffInviteToUser(u)}
                        className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${
                          invState === "accepted"
                            ? "bg-emerald-600/30 text-emerald-300"
                            : invState === "pending"
                            ? "bg-amber-500/20 text-amber-300"
                            : busy
                            ? "bg-slate-800 text-slate-500"
                            : "bg-indigo-600 hover:bg-indigo-500 text-white"
                        }`}
                      >
                        {invState === "accepted"
                          ? "Katıldı"
                          : invState === "pending"
                          ? "Davet Edildi"
                          : busy
                          ? "Oyunda"
                          : "Davet Et"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleStartBluffFromTable}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-extrabold text-xs text-white shadow-lg"
            >
              Blöf Oyununu Başlat ({Math.max(3, 1 + bluffJoinedMembers.length)} Kişi)
            </button>
          </div>
        </div>
      )}

      {selectedTargetUser && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-white">{selectedTargetUser.name}</h3>
                <p className="text-xs text-slate-400">Oyun daveti göndermek için oyun seç</p>
              </div>
              <button
                onClick={() => setSelectedTargetUser(null)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {GAMES_META.map((g) => {
                const active = selectedGameForInvite === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGameForInvite(g.id)}
                    className={`p-2.5 rounded-xl border text-left text-xs font-bold transition ${
                      active
                        ? "bg-indigo-600/25 border-indigo-400 text-white"
                        : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <div>{g.name}</div>
                    <div className="text-[10px] font-normal text-slate-400">{g.badge}</div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => {
                  const peer = selectedTargetUser;
                  setSelectedTargetUser(null);
                  openDirectMessage(peer);
                }}
                className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold text-xs text-slate-200"
              >
                Özel Mesaj
              </button>
              <button
                onClick={() => sendGameInvite(selectedTargetUser, selectedGameForInvite)}
                className="py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-xs text-white"
              >
                Davet Gönder
              </button>
            </div>
          </div>
        </div>
      )}

      {reportTargetUser && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitReport}
            className="bg-slate-900 border border-slate-700 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-white">
                {reportTargetUser.name} Kullanıcısını Şikayet Et
              </h3>
              <button
                type="button"
                onClick={() => setReportTargetUser(null)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Şikayet Sebebi</label>
              <input
                type="text"
                maxLength={120}
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Örn: Uygunsuz sohbet mesajı"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setReportTargetUser(null)}
                className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300"
              >
                İptal
              </button>
              <button
                type="submit"
                className="py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-extrabold text-slate-950"
              >
                Şikayeti Gönder
              </button>
            </div>
          </form>
        </div>
      )}

      {dmTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div>
                <h3 className="text-sm font-extrabold text-white">{dmTarget.name}</h3>
                <p className="text-[11px] text-slate-400">Özel Sohbet • 1 saat sonra silinir</p>
              </div>
              <button
                onClick={() => setDmTarget(null)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="h-60 overflow-y-auto space-y-2 pr-1">
              {activeDmList.length === 0 ? (
                <div className="text-xs text-slate-500 text-center py-10">
                  Henüz mesaj yok. İlk mesajı sen gönder!
                </div>
              ) : (
                activeDmList.map((m) => {
                  const mine = m.senderId === myId;
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`px-3 py-2 rounded-2xl text-xs max-w-[82%] ${
                          mine
                            ? "bg-indigo-600 text-white rounded-br-sm"
                            : "bg-slate-800 text-slate-100 rounded-bl-sm"
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleSendDirectMessage} className="flex items-center gap-2">
              <input
                type="text"
                value={dmInput}
                onChange={(e) => setDmInput(e.target.value)}
                placeholder={`${dmTarget.name} kişisine mesaj yaz...`}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white"
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
