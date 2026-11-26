import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  RotateCcw,
  Sparkles,
  PlusCircle,
  Shuffle,
  Eraser,
  Trophy,
  Lock,
  HelpCircle,
  Link2,
  Snowflake,
  Play,
} from "lucide-react";

const COLORS = [
  { id: "yellow", name: "Sarı", hex: "#facc15", dark: "#a16207", light: "#fef08a" },
  { id: "green", name: "Yeşil", hex: "#22c55e", dark: "#15803d", light: "#86efac" },
  { id: "cyan", name: "Turkuaz", hex: "#06b6d4", dark: "#0e7490", light: "#67e8f9" },
  { id: "red", name: "Kırmızı", hex: "#ef4444", dark: "#b91c1c", light: "#fca5a5" },
  { id: "orange", name: "Turuncu", hex: "#f97316", dark: "#c2410c", light: "#fdba74" },
  { id: "sand", name: "Kum", hex: "#d6b88c", dark: "#8c6d46", light: "#efe0c6" },
];

const ROWS = 7;
const COLS = 8;

function pickColor(seedIdx = 0) {
  return COLORS[Math.abs(seedIdx) % COLORS.length].id;
}

function getColorMeta(colorId) {
  return COLORS.find((c) => c.id === colorId) || COLORS[0];
}

function buildLevelData(level = 1) {
  const depth = Math.min(4, 2 + Math.floor((level - 1) / 2));
  const sizeX = 12;
  const sizeY = 12;

  // 3B izometrik voksel katmanlar: [z][y][x] -> colorId | null
  const voxels = [];
  for (let z = 0; z < depth; z++) {
    const layer = [];
    for (let y = 0; y < sizeY; y++) {
      const row = [];
      for (let x = 0; x < sizeX; x++) {
        // İç katmanlarda farklı bir desen / çekirdek renk oluştur
        if (z === depth - 1) {
          row.push(pickColor(x + y * 2 + level));
        } else if ((x + y + z) % 4 === 0) {
          row.push("yellow");
        } else if ((x * 2 + y) % 5 === 0) {
          row.push("cyan");
        } else {
          row.push(pickColor(x * 3 + y + z * 2 + level));
        }
      }
      row.push(row);
      layer.push(row.slice(0, sizeX));
    }
    voxels.push(layer);
  }

  // Alt ızgara taşları
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  const pairMap = {};

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const idx = r * COLS + c + level * 3;
      const color = pickColor(idx);
      const roll = (r * 13 + c * 7 + level * 5) % 29;

      let type = "normal";
      let lockCount = 0;
      let pairId = null;

      if (roll === 3 && c + 1 < COLS) {
        type = "paired";
        pairId = `pair_${r}_${c}`;
        grid[r][c] = {
          id: `t_${r}_${c}`,
          r,
          c,
          color,
          type,
          lockCount: 0,
          pairId,
          revealed: true,
        };
        grid[r][c + 1] = {
          id: `t_${r}_${c + 1}`,
          r,
          c: c + 1,
          color: pickColor(idx + 1),
          type,
          lockCount: 0,
          pairId,
          revealed: true,
        };
        pairMap[pairId] = [
          { r, c },
          { r, c: c + 1 },
        ];
        c += 1;
        continue;
      } else if (roll === 7) {
        type = "locked";
        lockCount = 2 + (level % 2);
      } else if (roll === 11) {
        type = "mystery";
      } else if (roll === 15) {
        type = "frozen";
      }

      grid[r][c] = {
        id: `t_${r}_${c}`,
        r,
        c,
        color,
        type,
        lockCount,
        pairId,
        revealed: type !== "mystery",
      };
    }
  }

  // Her rengin toplam voksel sayısına göre yuvalara dengeli kapasite paylaştır
  const colorTotals = {};
  voxels.forEach((layer) =>
    layer.forEach((row) =>
      row.forEach((colId) => {
        if (colId) colorTotals[colId] = (colorTotals[colId] || 0) + 1;
      })
    )
  );

  return { voxels, grid, pairMap, colorTotals };
}

function isTileExposed(grid, r, c) {
  const tile = grid[r]?.[c];
  if (!tile) return false;
  if (tile.type === "locked" && tile.lockCount > 0) return false;

  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  return dirs.some(([dr, dc]) => {
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return true;
    return grid[nr][nc] === null;
  });
}

function findExposedVoxelCoord(voxels, targetColor) {
  // En dış katmandan (z = 0) başlayarak hedef renkteki ilk açık kübü bul
  const depth = voxels.length;
  for (let z = 0; z < depth; z++) {
    const layer = voxels[z];
    const h = layer.length;
    const w = layer[0].length;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const val = layer[y][x];
        if (val !== targetColor) continue;
        // Dış kenarda veya üst/ön/yan yüzeyi açıksa vurulabilir
        const onOuterEdge = z === 0 || y === 0 || x === w - 1 || y === h - 1 || x === 0;
        const upperExposed = z > 0 && voxels[z - 1][y][x] === null;
        if (onOuterEdge || upperExposed) {
          return { z, y, x };
        }
      }
    }
  }
  return null;
}
export default function VoxelEritmeOyunu() {
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [maxSlots, setMaxSlots] = useState(6);
  const [slots, setSlots] = useState([]); // { id, color, ammo, totalAmmo }
  const [boosters, setBoosters] = useState({ addSlot: 2, shuffle: 2, zapColor: 2 });
  const [gameState, setGameState] = useState("playing"); // playing | won | lost
  const [hitFlash, setHitFlash] = useState(null);

  const initialData = useMemo(() => buildLevelData(level), [level]);
  const [voxels, setVoxels] = useState(initialData.voxels);
  const [grid, setGrid] = useState(initialData.grid);
  const [pairMap, setPairMap] = useState(initialData.pairMap);

  const resetLevel = useCallback(
    (targetLevel = level, keepScore = true) => {
      const fresh = buildLevelData(targetLevel);
      setVoxels(fresh.voxels);
      setGrid(fresh.grid);
      setPairMap(fresh.pairMap);
      setSlots([]);
      setMaxSlots(6);
      setGameState("playing");
      if (!keepScore) {
        setScore(0);
        setBoosters({ addSlot: 2, shuffle: 2, zapColor: 2 });
      }
    },
    [level]
  );

  useEffect(() => {
    resetLevel(level, true);
  }, [level, resetLevel]);

  const remainingVoxels = useMemo(() => {
    let count = 0;
    voxels.forEach((layer) =>
      layer.forEach((row) =>
        row.forEach((cell) => {
          if (cell) count += 1;
        })
      )
    );
    return count;
  }, [voxels]);

  const totalInitialVoxels = useMemo(() => {
    let count = 0;
    initialData.voxels.forEach((layer) =>
      layer.forEach((row) =>
        row.forEach((cell) => {
          if (cell) count += 1;
        })
      )
    );
    return Math.max(1, count);
  }, [initialData]);

  const progressPct = Math.min(
    100,
    Math.round(((totalInitialVoxels - remainingVoxels) / totalInitialVoxels) * 100)
  );

  // Kazanma / Kaybetme kontrolü
  useEffect(() => {
    if (gameState !== "playing") return;
    if (remainingVoxels === 0) {
      setGameState("won");
      return;
    }
    const hasAnyExposedTile = grid.some((row, r) =>
      row.some((tile, c) => tile && isTileExposed(grid, r, c))
    );
    if (slots.length >= maxSlots && !hasAnyExposedTile) {
      setGameState("lost");
    }
  }, [remainingVoxels, slots.length, maxSlots, grid, gameState]);

  // Aktif yuvalar üstteki voksellere otomatik ateş eder
  useEffect(() => {
    if (gameState !== "playing" || slots.length === 0 || remainingVoxels === 0) return;

    const timer = setInterval(() => {
      setSlots((prevSlots) => {
        if (prevSlots.length === 0) return prevSlots;
        let fired = false;
        const nextSlots = [...prevSlots];

        for (let i = 0; i < nextSlots.length; i++) {
          const s = nextSlots[i];
          if (!s || s.ammo <= 0) continue;

          let targetCoord = null;
          setVoxels((prevVoxels) => {
            const found = findExposedVoxelCoord(prevVoxels, s.color);
            if (!found) return prevVoxels;
            targetCoord = found;
            const copy = prevVoxels.map((layer) => layer.map((row) => row.slice()));
            copy[found.z][found.y][found.x] = null;
            return copy;
          });

          if (targetCoord) {
            fired = true;
            setHitFlash(`${targetCoord.z}-${targetCoord.y}-${targetCoord.x}`);
            setScore((sc) => sc + 15);
            const leftAmmo = s.ammo - 1;
            if (leftAmmo <= 0) {
              nextSlots.splice(i, 1);
            } else {
              nextSlots[i] = { ...s, ammo: leftAmmo };
            }
            break;
          }
        }

        return fired ? nextSlots : prevSlots;
      });
    }, 180);

    return () => clearInterval(timer);
  }, [gameState, slots.length, remainingVoxels]);

  function decrementLocksAround(nextGrid, r, c) {
    const dirs = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    dirs.forEach(([dr, dc]) => {
      const nr = r + dr;
      const nc = c + dc;
      const neighbor = nextGrid[nr]?.[nc];
      if (neighbor && neighbor.type === "locked" && neighbor.lockCount > 0) {
        const nextCount = neighbor.lockCount - 1;
        nextGrid[nr][nc] = {
          ...neighbor,
          lockCount: nextCount,
          type: nextCount === 0 ? "normal" : "locked",
        };
      }
    });
  }

  function handleTileClick(r, c) {
    if (gameState !== "playing") return;
    const tile = grid[r]?.[c];
    if (!tile || !isTileExposed(grid, r, c)) return;

    const neededSlots = tile.type === "paired" ? 2 : 1;
    if (slots.length + neededSlots > maxSlots) return;

    const nextGrid = grid.map((row) => row.slice());
    const collected = [tile];
    nextGrid[r][c] = null;
    decrementLocksAround(nextGrid, r, c);

    if (tile.type === "paired" && tile.pairId && pairMap[tile.pairId]) {
      pairMap[tile.pairId].forEach((coord) => {
        if (coord.r === r && coord.c === c) return;
        const partner = nextGrid[coord.r]?.[coord.c];
        if (partner) {
          collected.push(partner);
          nextGrid[coord.r][coord.c] = null;
          decrementLocksAround(nextGrid, coord.r, coord.c);
        }
      });
    }

    // Gizemli taşları açığa çıkar
    for (let rr = 0; rr < ROWS; rr++) {
      for (let cc = 0; cc < COLS; cc++) {
        const item = nextGrid[rr][cc];
        if (item && item.type === "mystery" && !item.revealed && isTileExposed(nextGrid, rr, cc)) {
          nextGrid[rr][cc] = { ...item, revealed: true };
        }
      }
    }

    setGrid(nextGrid);
    setSlots((prev) => [
      ...prev,
      ...collected.map((t, idx) => {
        const ammo = t.type === "frozen" ? 18 : 24 + level * 3;
        return {
          id: `${t.id}_${Date.now()}_${idx}`,
          color: t.color,
          ammo,
          totalAmmo: ammo,
        };
      }),
    ]);
    setScore((sc) => sc + 25 * collected.length);
  }

  function handleAddSlotBooster() {
    if (boosters.addSlot <= 0 || maxSlots >= 8 || gameState !== "playing") return;
    setBoosters((b) => ({ ...b, addSlot: b.addSlot - 1 }));
    setMaxSlots((m) => m + 1);
  }

  function handleShuffleBooster() {
    if (boosters.shuffle <= 0 || gameState !== "playing") return;
    setBoosters((b) => ({ ...b, shuffle: b.shuffle - 1 }));
    const pool = [];
    grid.forEach((row) =>
      row.forEach((tile) => {
        if (tile) pool.push(tile.color);
      })
    );
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    let idx = 0;
    setGrid((prev) =>
      prev.map((row) =>
        row.map((tile) => {
          if (!tile) return null;
          const nextColor = pool[idx++] || tile.color;
          return { ...tile, color: nextColor };
        })
      )
    );
  }

  function handleZapBooster() {
    if (boosters.zapColor <= 0 || gameState !== "playing") return;
    const activeColor = slots[0]?.color || COLORS[0].id;
    setBoosters((b) => ({ ...b, zapColor: b.zapColor - 1 }));
    let removed = 0;
    setVoxels((prev) =>
      prev.map((layer) =>
        layer.map((row) =>
          row.map((cell) => {
            if (cell === activeColor) {
              removed += 1;
              return null;
            }
            return cell;
          })
        )
      )
    );
    setScore((sc) => sc + removed * 10);
  }

  // Basit 2.5D izometrik üst katman önizlemesi (performanslı ve mobil uyumlu)
  const topLayer = voxels[0] || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#3f4691] via-[#353b7c] to-[#282d61] text-white flex flex-col items-center justify-between p-3 select-none">
      <div className="w-full max-w-md space-y-3">
        {/* Üst Bar: Seviye İlerlemesi, Skor ve Sıfırla */}
        <div className="flex items-center justify-between gap-2 bg-black/25 backdrop-blur-xs border border-white/15 rounded-2xl px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl bg-amber-400/20 border border-amber-300/40 text-xs font-black text-amber-200">
              Seviye {level}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-extrabold text-amber-300">
              <Trophy className="w-3.5 h-3.5" />
              {score}
            </span>
          </div>

          <div className="flex-1 mx-2 h-3 rounded-full bg-black/40 overflow-hidden border border-white/15">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-lime-300 transition-all duration-200"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <button
            type="button"
            onClick={() => resetLevel(level, false)}
            title="Yeniden Başlat"
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Üst Alan: 2.5D İzometrik Voksel Blok */}
        <div className="bg-black/20 border border-white/10 rounded-3xl p-3 flex flex-col items-center">
          <div className="w-full flex items-center justify-between text-[11px] text-indigo-100/80 mb-2 px-1">
            <span>Voksel Yapı • {progressPct}% Eritildi</span>
            <span>Kalan: {remainingVoxels}</span>
          </div>

          <div className="relative w-full h-44 overflow-hidden rounded-2xl bg-[#2c316b]/70 flex items-center justify-center">
            <div
              className="grid gap-0.5 p-2 rounded-xl shadow-2xl border-b-4 border-r-4 border-black/40"
              style={{
                gridTemplateColumns: `repeat(${topLayer[0]?.length || 12}, minmax(0, 1fr))`,
                transform: "perspective(500px) rotateX(28deg) rotateZ(-14deg)",
              }}
            >
              {topLayer.map((row, y) =>
                row.map((cellColor, x) => {
                  const meta = cellColor ? getColorMeta(cellColor) : null;
                  const key = `0-${y}-${x}`;
                  const isFlashing = hitFlash === key;
                  return (
                    <div
                      key={key}
                      className={`w-4 h-4 sm:w-5 sm:h-5 rounded-[3px] transition-transform duration-150 ${
                        isFlashing ? "scale-125 brightness-150" : ""
                      }`}
                      style={{
                        backgroundColor: meta ? meta.hex : "rgba(255,255,255,0.06)",
                        boxShadow: meta
                          ? `inset 0 2px 0 ${meta.light}, 0 2px 0 ${meta.dark}`
                          : "none",
                      }}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Orta Şerit: Nişancı Yuvaları + 3 Güçlendirici */}
        <div className="flex items-center justify-between gap-2 bg-black/25 border border-white/15 rounded-2xl p-2.5">
          <div className="flex items-center gap-1.5 flex-wrap flex-1">
            {Array.from({ length: maxSlots }).map((_, idx) => {
              const s = slots[idx];
              if (!s) {
                return (
                  <div
                    key={`empty_${idx}`}
                    className="w-10 h-11 rounded-xl bg-black/30 border border-dashed border-white/20 flex items-center justify-center text-[10px] text-white/30 font-bold"
                  >
                    +
                  </div>
                );
              }
              const meta = getColorMeta(s.color);
              return (
                <div
                  key={s.id}
                  className="w-10 h-11 rounded-xl flex flex-col items-center justify-center shadow-md border-b-2 border-black/40"
                  style={{ backgroundColor: meta.hex }}
                >
                  <span className="text-[11px] font-black text-slate-950 drop-shadow-2xs">
                    {s.ammo}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleAddSlotBooster}
              disabled={boosters.addSlot <= 0 || maxSlots >= 8}
              title="Ekstra Yuva"
              className="relative w-10 h-10 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-35 text-slate-950 flex items-center justify-center shadow"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="absolute -bottom-1 -right-1 px-1 rounded-full bg-slate-950 text-white text-[9px] font-black">
                {boosters.addSlot}
              </span>
            </button>

            <button
              type="button"
              onClick={handleShuffleBooster}
              disabled={boosters.shuffle <= 0}
              title="Taşları Karıştır"
              className="relative w-10 h-10 rounded-xl bg-sky-400 hover:bg-sky-300 disabled:opacity-35 text-slate-950 flex items-center justify-center shadow"
            >
              <Shuffle className="w-4 h-4" />
              <span className="absolute -bottom-1 -right-1 px-1 rounded-full bg-slate-950 text-white text-[9px] font-black">
                {boosters.shuffle}
              </span>
            </button>

            <button
              type="button"
              onClick={handleZapBooster}
              disabled={boosters.zapColor <= 0}
              title="Aktif Rengi Erit"
              className="relative w-10 h-10 rounded-xl bg-emerald-400 hover:bg-emerald-300 disabled:opacity-35 text-slate-950 flex items-center justify-center shadow"
            >
              <Eraser className="w-4 h-4" />
              <span className="absolute -bottom-1 -right-1 px-1 rounded-full bg-slate-950 text-white text-[9px] font-black">
                {boosters.zapColor}
              </span>
            </button>
          </div>
        </div>

        {/* Alt Izgara: Taş Seçme Alanı */}
        <div className="bg-black/25 border border-white/15 rounded-3xl p-2.5">
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
          >
            {grid.map((row, r) =>
              row.map((tile, c) => {
                if (!tile) {
                  return (
                    <div
                      key={`slot_${r}_${c}`}
                      className="aspect-square rounded-xl bg-black/20 border border-white/5"
                    />
                  );
                }

                const exposed = isTileExposed(grid, r, c);
                const meta = getColorMeta(tile.color);
                const isMysteryHidden = tile.type === "mystery" && !tile.revealed;

                return (
                  <button
                    key={tile.id}
                    type="button"
                    onClick={() => handleTileClick(r, c)}
                    disabled={!exposed}
                    className={`relative aspect-square rounded-xl flex items-center justify-center font-black text-xs transition ${
                      exposed
                        ? "opacity-100 active:scale-90 cursor-pointer shadow-md"
                        : "opacity-55 cursor-not-allowed"
                    }`}
                    style={{
                      backgroundColor: isMysteryHidden ? "#475569" : meta.hex,
                      color: isMysteryHidden ? "#f8fafc" : "#0f172a",
                      boxShadow: exposed
                        ? `inset 0 2px 0 ${isMysteryHidden ? "#94a3b8" : meta.light}, 0 3px 0 ${
                            isMysteryHidden ? "#1e293b" : meta.dark
                          }`
                        : "none",
                    }}
                  >
                    {isMysteryHidden && <HelpCircle className="w-4 h-4" />}
                    {!isMysteryHidden && tile.type === "locked" && (
                      <span className="inline-flex items-center gap-0.5 bg-slate-950/80 text-white px-1.5 py-0.5 rounded-md text-[10px]">
                        <Lock className="w-2.5 h-2.5" />
                        {tile.lockCount}
                      </span>
                    )}
                    {!isMysteryHidden && tile.type === "paired" && (
                      <Link2 className="w-3.5 h-3.5 text-slate-950/80" />
                    )}
                    {!isMysteryHidden && tile.type === "frozen" && (
                      <Snowflake className="w-3.5 h-3.5 text-sky-950" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Seviye Tamamlandı / Oyun Bitti Katmanı */}
      {gameState !== "playing" && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/15 rounded-3xl max-w-xs w-full p-5 text-center space-y-4 shadow-2xl">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-400/20 text-amber-300 mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black text-white">
              {gameState === "won" ? `Seviye ${level} Tamamlandı!` : "Yuvalar Doldu!"}
            </h3>
            <p className="text-xs text-slate-300">
              {gameState === "won"
                ? `Voksel yapı eritildi. Toplam skorun: ${score}`
                : `Açıkta taş kalmadı ve yuvalar doldu. Skorun: ${score}`}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => resetLevel(level, false)}
                className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white"
              >
                Tekrar Dene
              </button>
              <button
                type="button"
                onClick={() => {
                  if (gameState === "won") {
                    setLevel((l) => l + 1);
                  } else {
                    resetLevel(level, false);
                  }
                }}
                className="py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-black flex items-center justify-center gap-1"
              >
                <Play className="w-3.5 h-3.5" />
                {gameState === "won" ? "Sonraki" : "Yeniden"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
