import React, { useRef, useEffect, useState } from "react";
import "./App.css";

/**
 * Color palette
 */
const COLORS = {
  primary: "#4CAF50", // green
  accent: "#E91E63", // pink
  secondary: "#FFC107", // yellow
  background: "#fff",
  dark: "#212121",
  fruitStroke: "#fff",
  bomb: "#222",
  bombHighlight: "#666",
};

const FRUIT_TYPES = [
  {
    name: "watermelon",
    color: COLORS.primary,
    points: 3,
    sfx: "slice",
  },
  {
    name: "apple",
    color: COLORS.accent,
    points: 2,
    sfx: "slice",
  },
  {
    name: "lemon",
    color: COLORS.secondary,
    points: 1,
    sfx: "slice",
  },
];

const BOMB_TYPE = {
  name: "bomb",
  color: COLORS.bomb,
  sfx: "bomb",
};

const FRUIT_RADIUS = 38;
const BOMB_RADIUS = 32;
const FRUIT_GRAVITY: number = 0.25;
const LAUNCH_INTERVAL_MIN = 750;
const LAUNCH_INTERVAL_MAX = 1300;
const GAME_DURATION = 60; // seconds

const SFX_PATHS = {
  slice: "https://cdn.pixabay.com/audio/2022/10/16/audio_12d1fb2e61.mp3", // slicing sound (Pixabay, free)
  bomb: "https://cdn.pixabay.com/audio/2022/03/15/audio_115b5b2cde.mp3", // explosion (Pixabay, free)
  woosh: "https://cdn.pixabay.com/audio/2022/07/26/audio_124b37de06.mp3", // whoosh (Pixabay, free)
};

/**
 * Load an audio clip (once)
 */
function useSfx(url) {
  const ref = useRef();
  useEffect(() => {
    ref.current = new Audio(url);
  }, [url]);
  const play = () => {
    if (ref.current) {
      ref.current.currentTime = 0;
      ref.current.play();
    }
  };
  return play;
}

/**
 * Save leaderboard to localStorage
 */
function saveLeaderboard(leaderboard) {
  window.localStorage.setItem("fruitninja_leaderboard", JSON.stringify(leaderboard));
}
function getLeaderboard() {
  try {
    const val = window.localStorage.getItem("fruitninja_leaderboard");
    if (val) return JSON.parse(val);
    return [];
  } catch {
    return [];
  }
}

// PUBLIC_INTERFACE
/**
 * Main Fruit Ninja Game React Component
 */
function App() {
  // Game State
  const [score, setScore] = useState(0);
  const [highScores, setHighScores] = useState(getLeaderboard());
  const [gameOver, setGameOver] = useState(false);
  const [gameTime, setGameTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Canvas & resize
  const canvasRef = useRef(null);
  const parentRef = useRef(null);
  const [canvasDims, setCanvasDims] = useState({ width: 375, height: 650 });

  // Animation/gameplay
  const fruits = useRef([]); // {type, x, y, vx, vy, radius, isSliced, id}
  const slicingPath = useRef([]);
  const animationRef = useRef();
  const intervalRef = useRef();
  const timeIntervalRef = useRef();
  const lastLaunch = useRef(Date.now());

  // Sound effects
  const playSlice = useSfx(SFX_PATHS.slice);
  const playBomb = useSfx(SFX_PATHS.bomb);
  const playWoosh = useSfx(SFX_PATHS.woosh);

  // PUBLIC_INTERFACE
  useEffect(() => {
    function handleResize() {
      // Make canvas responsive (max 700x900, min 320x500, maintain aspect)
      let width = window.innerWidth;
      let height = window.innerHeight - 8;
      if (width > 700) width = 700;
      if (height > 900) height = 900;
      if (width < 320) width = 320;
      setCanvasDims({
        width: Math.floor(width),
        height: Math.floor(height),
      });
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // PUBLIC_INTERFACE
  // Core game animation loop
  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(animationRef.current);
      return;
    }
    let lastTimestamp = performance.now();

    function animate(ts) {
      const dt = ts - lastTimestamp;
      lastTimestamp = ts;
      updateGame(dt);
      drawGame();
      if (!gameOver && isPlaying) {
        animationRef.current = requestAnimationFrame(animate);
      }
    }
    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
    // eslint-disable-next-line
  }, [isPlaying, canvasDims, gameOver]);

  // PUBLIC_INTERFACE
  // Fruit/bomb launch interval
  useEffect(() => {
    if (!isPlaying) return;
    function launchFruit() {
      if (gameOver || !isPlaying) return;
      addRandomFruitOrBomb();
      // Schedule next launch in interval
      intervalRef.current = setTimeout(
        launchFruit,
        Math.random() * (LAUNCH_INTERVAL_MAX - LAUNCH_INTERVAL_MIN) +
          LAUNCH_INTERVAL_MIN
      );
    }
    launchFruit();
    return () => clearTimeout(intervalRef.current);
    // eslint-disable-next-line
  }, [isPlaying, canvasDims, gameOver]);

  // PUBLIC_INTERFACE
  // Game timer
  useEffect(() => {
    if (!isPlaying) return;
    setGameTime(0);
    timeIntervalRef.current = setInterval(() => {
      setGameTime((t) => {
        if (t + 1 >= GAME_DURATION) {
          handleGameOver();
          clearInterval(timeIntervalRef.current);
          return GAME_DURATION;
        }
        return t + 1;
      });
    }, 1000);
    return () => clearInterval(timeIntervalRef.current);
    // eslint-disable-next-line
  }, [isPlaying, gameOver]);

  // PUBLIC_INTERFACE
  function startGame() {
    setScore(0);
    setGameOver(false);
    fruits.current = [];
    slicingPath.current = [];
    setIsPlaying(true);
    setShowLeaderboard(false);
    setGameTime(0);
  }

  // PUBLIC_INTERFACE
  function handleGameOver() {
    setIsPlaying(false);
    setGameOver(true);
    // Save to leaderboard
    const newLeaderboard = [...highScores, { score, date: Date.now() }]
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    setHighScores(newLeaderboard);
    saveLeaderboard(newLeaderboard);
  }

  // PUBLIC_INTERFACE
  function addRandomFruitOrBomb() {
    const { width, height } = canvasDims;
    const isBomb = Math.random() < 0.17; // 17% chance
    const type = isBomb
      ? BOMB_TYPE
      : FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
    // Random X launch
    const spawnX = Math.random() * (width - 2 * FRUIT_RADIUS) + FRUIT_RADIUS;
    const radius = isBomb ? BOMB_RADIUS : FRUIT_RADIUS;
    const speed = (Math.random() * 2 + 10) * (height / 650); // scale w/ height
    const vx = (Math.random() - 0.5) * 8;
    const vy = -speed;
    fruits.current.push({
      type,
      x: spawnX,
      y: height + radius,
      vx,
      vy,
      radius,
      isSliced: false,
      id: Math.random() + Date.now(),
    });
  }

  // PUBLIC_INTERFACE
  function updateGame(dt) {
    const { width, height } = canvasDims;
    // Move fruits
    fruits.current.forEach((f) => {
      f.x += f.vx;
      f.y += f.vy;
      f.vy += FRUIT_GRAVITY * ((dt || 20) / 16.5);
    });

    // Remove objects that fall below
    fruits.current = fruits.current.filter(
      (f) => f.y - f.radius < height + 60 && !f.isDestroyed
    );
  }

  // PUBLIC_INTERFACE
  function drawGame() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw fruits & bombs with drop shadow
    fruits.current.forEach((f) => {
      ctx.save();
      ctx.shadowColor =
        f.type.name === "bomb" ? COLORS.bombHighlight : f.type.color;
      ctx.shadowBlur = 18;
      if (f.type.name === "bomb") {
        // Bomb: black ball + fuse
        drawBomb(ctx, f.x, f.y, f.radius);
      } else {
        // Fruit: colored circle + white highlight
        drawFruit(ctx, f.x, f.y, f.radius, f.type.color);
      }
      ctx.restore();
      if (f.isSliced) {
        // Sliced effect overlay
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.radius + 7, 0, 2 * Math.PI);
        ctx.fillStyle = COLORS.accent;
        ctx.fill();
        ctx.restore();
      }
    });

    // Draw current slice line
    if (slicingPath.current.length > 1) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.shadowColor = COLORS.primary;
      ctx.shadowBlur = 7;
      ctx.lineWidth = 9;
      ctx.strokeStyle = COLORS.primary;
      ctx.beginPath();
      const pts = slicingPath.current;
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i][0], pts[i][1]);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  // PUBLIC_INTERFACE
  function drawBomb(ctx, x, y, radius) {
    // Main bomb body
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = COLORS.bomb;
    ctx.fill();
    // Bomb highlight
    ctx.beginPath();
    ctx.arc(x - radius * 0.38, y - radius * 0.34, radius / 4, 0, 2 * Math.PI);
    ctx.fillStyle = COLORS.bombHighlight;
    ctx.fill();

    // Fuse
    ctx.save();
    ctx.strokeStyle = COLORS.secondary;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(-Math.PI / 3) * (radius * 0.82), y - radius * 0.82);
    ctx.lineTo(x + Math.cos(-Math.PI / 3) * (radius * 1.22), y - radius * 1.36);
    ctx.stroke();
    ctx.restore();

    // Spark
    ctx.save();
    ctx.fillStyle = COLORS.secondary;
    ctx.beginPath();
    ctx.arc(
      x + Math.cos(-Math.PI / 3) * (radius * 1.24),
      y - radius * 1.38,
      7,
      0,
      2 * Math.PI
    );
    ctx.fill();
    ctx.restore();
  }

  // PUBLIC_INTERFACE
  function drawFruit(ctx, x, y, radius, color) {
    // Main round
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = COLORS.fruitStroke;
    ctx.stroke();

    // Highlight
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.arc(x - radius / 3, y - radius / 3, radius / 2.5, 0, 2 * Math.PI);
    ctx.fillStyle = COLORS.background;
    ctx.fill();
    ctx.restore();

    // Stalk
    ctx.save();
    ctx.strokeStyle = "#6d4c16";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y - radius);
    ctx.lineTo(x, y - radius - 12);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Slicing - mouse/touch handlers
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!isPlaying || !canvas) return;
    let drawing = false;

    function sliceAt(x, y) {
      // Check for fruit intersection
      let slicedThisStroke = false;
      fruits.current.forEach((f) => {
        if (f.isSliced || f.isDestroyed) return;
        const dist = Math.hypot(f.x - x, f.y - y);
        if (dist < f.radius * 0.88) {
          if (f.type.name === "bomb") {
            // Bomb hit
            f.isDestroyed = true;
            playBomb();
            setTimeout(() => handleGameOver(), 200);
          } else {
            f.isSliced = true;
            playSlice();
            setScore((s) => s + f.type.points);
            slicedThisStroke = true;
            // slight poof
            setTimeout(() => (f.isDestroyed = true), 400);
          }
        }
      });
      if (slicedThisStroke) playWoosh();
    }

    function pointerDown(e) {
      drawing = true;
      let x, y;
      if (e.touches) {
        const touch = e.touches[0];
        x = (touch.clientX - canvas.getBoundingClientRect().left);
        y = (touch.clientY - canvas.getBoundingClientRect().top);
      } else {
        x = e.nativeEvent
          ? e.nativeEvent.offsetX
          : e.offsetX;
        y = e.nativeEvent
          ? e.nativeEvent.offsetY
          : e.offsetY;
      }
      slicingPath.current = [[x, y]];
      sliceAt(x, y);
    }
    function pointerMove(e) {
      if (!drawing) return;
      let x, y;
      if (e.touches) {
        const touch = e.touches[0];
        x = (touch.clientX - canvas.getBoundingClientRect().left);
        y = (touch.clientY - canvas.getBoundingClientRect().top);
      } else {
        x = e.nativeEvent
          ? e.nativeEvent.offsetX
          : e.offsetX;
        y = e.nativeEvent
          ? e.nativeEvent.offsetY
          : e.offsetY;
      }
      slicingPath.current.push([x, y]);
      if (slicingPath.current.length > 12) slicingPath.current.shift();
      sliceAt(x, y);
    }
    function pointerUp() {
      drawing = false;
      setTimeout(() => {
        slicingPath.current = [];
        drawGame();
      }, 80);
    }

    // PC
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    window.addEventListener("pointerup", pointerUp);

    // Touch
    canvas.addEventListener("touchstart", pointerDown);
    canvas.addEventListener("touchmove", pointerMove);
    window.addEventListener("touchend", pointerUp);

    return () => {
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("touchstart", pointerDown);
      canvas.removeEventListener("touchmove", pointerMove);
      window.removeEventListener("touchend", pointerUp);
    };
    // eslint-disable-next-line
  }, [isPlaying, canvasDims, gameOver]);

  /**
   * Draw leaderboard modal
   */
  function renderLeaderboard() {
    return (
      <div className="leaderboard-modal">
        <div className="leaderboard">
          <h2>Leaderboard</h2>
          {highScores.length === 0 && (
            <p style={{ color: "#666" }}>No scores yet. Be the first! 🍉</p>
          )}
          <ul>
            {highScores.map((e, i) => (
              <li key={e.date} style={{
                color: i === 0 ? COLORS.primary : i === 1 ? COLORS.accent : COLORS.secondary
              }}>
                <span>
                  #{i + 1}. {e.score} pts{" "}
                  <span
                    style={{
                      fontSize: "0.9em",
                      color: "#888",
                      marginLeft: "10px",
                    }}
                  >
                    {new Date(e.date).toLocaleString().split(",")[0]}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <button className="btn-score" style={{
            background: COLORS.primary,
            color: "#fff",
            marginTop: "1em"
          }} onClick={() => setShowLeaderboard(false)}>
            Close Leaderboard
          </button>
        </div>
      </div>
    );
  }

  /**
   * Main App render
   */
  return (
    <div
      className="fruitninja-app"
      ref={parentRef}
      style={{
        background: COLORS.background,
        minHeight: "100vh",
        width: "100vw",
        margin: 0,
        padding: 0,
        overflow: "hidden",
      }}
    >
      {/* Score bar */}
      <div
        style={{
          width: "100vw",
          maxWidth: canvasDims.width,
          margin: "0 auto",
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 4,
          display: "flex",
          flexDirection: "row",
          background: "rgba(255,255,255,0.89)",
          borderRadius: "0 0 22px 22px",
          boxShadow: "0 4px 18px rgba(0,0,0,0.06)",
          justifyContent: "space-between",
          alignItems: "center",
          minHeight: 54,
        }}
      >
        <span
          style={{
            marginLeft: 18,
            fontWeight: 700,
            fontSize: 24,
            color: COLORS.primary,
            textShadow: "0 2px 8px #fff6",
            fontFamily: '"Segoe UI", Verdana, Geneva, Tahoma, sans-serif',
            letterSpacing: "0.03em",
          }}
        >
          🍉 Fruit Ninja
        </span>
        <span
          style={{
            fontWeight: 700,
            letterSpacing: "0.03em",
            color: COLORS.accent,
            textShadow: "0 1px 8px #fff9",
            fontFamily: '"Segoe UI", Verdana, Geneva, Tahoma, sans-serif',
            fontSize: 22,
          }}
        >
          Score: {score}
        </span>
        <span
          style={{
            fontWeight: 600,
            color: COLORS.secondary,
            fontSize: 18,
            marginRight: 22,
            fontFamily: "inherit",
            background: "#fff6",
            borderRadius: 8,
            padding: "2px 10px",
            border: "1px solid #ffc10769",
          }}
        >
          {isPlaying
            ? `⏱ ${GAME_DURATION - gameTime}s`
            : !gameOver
            ? "\u00A0"
            : "⏱ 0s"}
        </span>
      </div>

      {/* Canvas area */}
      <div
        style={{
          width: "100vw",
          height: "100vh",
          minHeight: canvasDims.height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(140deg, #E3FFEF 0%, #FFD1F0 58%, #FFFEF3 100%)",
        }}
      >
        <canvas
          ref={canvasRef}
          width={canvasDims.width}
          height={canvasDims.height}
          style={{
            background: "linear-gradient(180deg, #fff 75%, #cafdff 100%)",
            borderRadius: 24,
            marginTop: 54,
            boxShadow:
              "0 12px 44px 16px #70b17f26, 0 1.5px 30px 0px #E91E6399",
            border: "2px solid #E91E6375",
            maxWidth: "97vw",
            maxHeight: "84vh",
            display: "block",
            outline: "none",
            touchAction: "none",
          }}
          tabIndex={0}
        />
        {/* Overlay screens */}
        {!isPlaying && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 98,
              width: Math.max(330, Math.floor(canvasDims.width * 0.8)),
              maxWidth: canvasDims.width - 25,
              transform: "translateX(-50%)",
              zIndex: 5,
              textAlign: "center",
              color: COLORS.primary,
              background: "rgba(255,255,255,0.97)",
              borderRadius: 18,
              boxShadow: "0 2px 22px 0px #E91E631a",
              padding: "38px 22px 30px 22px",
              fontFamily: '"Segoe UI", Verdana, Geneva, Tahoma, sans-serif',
              border: `3px solid ${COLORS.primary}30`,
              minHeight: 280,
            }}
          >
            {!gameOver ? (
              <>
                <h1
                  style={{
                    color: COLORS.primary,
                    fontSize: 44,
                    letterSpacing: "-0.03em",
                    margin: 0,
                    marginBottom: 6,
                    fontWeight: 900,
                  }}
                >
                  🍉 Fruit Ninja
                </h1>
                <div
                  style={{
                    color: COLORS.accent,
                    fontWeight: 600,
                    fontSize: 20,
                    margin: "2px 0 28px 0",
                  }}
                >
                  Slice the fruits, avoid the bombs!
                </div>
                <button
                  onClick={startGame}
                  className="btn-score"
                  style={{
                    background: COLORS.primary,
                    color: "#fff",
                    border: "none",
                    fontWeight: 700,
                    fontSize: 22,
                    borderRadius: 28,
                    padding: "13px 40px",
                    marginTop: 36,
                    cursor: "pointer",
                    boxShadow: `0 4px 18px ${COLORS.accent}22`,
                  }}
                >
                  Start Game
                </button>
                <div style={{
                  fontSize: 15,
                  color: "#9572ad", marginTop: 19, fontWeight: 500,
                }}>
                  Your highest:{" "}
                  <span style={{ color: COLORS.primary }}>
                    {highScores.length ? highScores[0].score : 0}
                  </span>
                </div>
                <button
                  onClick={() => setShowLeaderboard(true)}
                  style={{
                    marginTop: 18,
                    color: COLORS.accent,
                    background: "#fff",
                    border: `2px dashed ${COLORS.secondary}50`,
                    borderRadius: 16,
                    padding: "7px 20px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Show Leaderboard
                </button>
              </>
            ) : (
              <>
                <div
                  style={{
                    fontSize: 52,
                    fontWeight: 900,
                    letterSpacing: "-0.04em",
                    marginBottom: 12,
                  }}
                >
                  Game Over
                </div>
                <div
                  style={{
                    fontSize: 22,
                    color: COLORS.accent,
                    marginBottom: 17,
                    fontWeight: 700,
                  }}
                >
                  Final Score: {score}
                </div>
                <button
                  onClick={startGame}
                  className="btn-score"
                  style={{
                    background: COLORS.primary,
                    color: "#fff",
                    border: "none",
                    fontWeight: 700,
                    fontSize: 22,
                    borderRadius: 28,
                    padding: "13px 40px",
                    margin: "0 0 13px 0",
                    cursor: "pointer",
                    boxShadow: `0 4px 18px ${COLORS.accent}22`,
                  }}
                >
                  Restart
                </button>
                <div style={{
                  fontSize: 15, color: "#9572ad",
                  marginTop: 12,
                  fontWeight: 500
                }}>
                  {highScores.length ? `High Score: ${highScores[0].score}` : ""}
                </div>
                <button
                  onClick={() => setShowLeaderboard(true)}
                  style={{
                    marginTop: 13,
                    color: COLORS.accent,
                    background: "#fff",
                    border: `2px dashed ${COLORS.secondary}50`,
                    borderRadius: 16,
                    padding: "7px 20px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Show Leaderboard
                </button>
              </>
            )}
          </div>
        )}
        {showLeaderboard && renderLeaderboard()}
      </div>
      {/* Footer */}
      <footer
        style={{
          width: "100vw",
          position: "fixed",
          bottom: 0,
          left: 0,
          zIndex: 9,
          textAlign: "center",
          color: "#444",
          fontSize: 14,
          padding: "9px 0",
          background: "#fff8",
          letterSpacing: "0.02em",
          boxShadow: "0 -2px 14px #e3ffef26",
        }}
      >
        {`Fruit Ninja: Web React Edition | `}
        <a
          href="https://github.com/"
          style={{
            color: COLORS.primary,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          By 🍉 Ninja Dev
        </a>
      </footer>
      {/* Custom CSS for leaderboard */}
      <style>
        {`
          .leaderboard-modal {
            position: fixed; z-index: 99; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center;
          }
          .leaderboard {
            background: #fff;
            border-radius: 20px;
            max-width: 96vw;
            min-width: 290px;
            box-shadow: 0 18px 60px 0px #4caf50aa;
            padding: 34px 20px 29px 20px;
            text-align: center;
          }
          .leaderboard h2 {
            color: ${COLORS.primary};
            margin-top: 0;
            font-weight: 800;
            margin-bottom: 18px;
          }
          .leaderboard ul {
            list-style: none;
            padding: 0;
          }
          .leaderboard li {
            font-weight: 700;
            padding: 6px 0 2px 0;
            font-size: 1.18em;
            letter-spacing: 0.01em;
          }
          .btn-score {
            border: none;
            outline: none;
            border-radius: 18px;
            background: ${COLORS.primary};
            box-shadow: 0 3px 10px 0px #4caf5040;
            color: #fff;
            font-size: 1.08em;
            padding: 10px 26px;
            font-weight: 600;
            cursor: pointer;
            transition: box-shadow .18s, background .18s;
          }
          .btn-score:hover {
            background: ${COLORS.accent};
            box-shadow: 0 6px 26px 6px #e91e6345;
            color: #fff;
          }

          @media (max-width: 650px) {
            .btn-score { font-size: 1em; padding: 8px 13vw;}
            .leaderboard {padding: 14px 5vw;}
          }
          `}
      </style>
    </div>
  );
}

export default App;
