import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  Fish,
  Hand,
  HelpCircle,
  Layers,
  Link,
  Plus,
  RotateCcw,
  Shuffle,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { GO_FISH, type Action, type Card, type View } from "./game";
import { mode } from "./network";
import { initialSession, newSession, useTable, type Session } from "./useTable";

function CardFace({
  card,
  back = false,
  small = false,
}: {
  card?: Card;
  back?: boolean;
  small?: boolean;
}) {
  return (
    <div
      className={`card-face ${back ? "card-back" : ""} ${small ? "small" : ""}`}
      style={card ? { color: card.color } : undefined}
    >
      {back ? (
        <>
          <div className="back-border">
            <span>✳</span>
          </div>
        </>
      ) : (
        card && (
          <>
            {card.image && (
              <img
                className="card-art"
                src={card.image}
                alt=""
                draggable={false}
              />
            )}
            <span className="corner">
              <b>{card.rank}</b>
              <span>{card.suit}</span>
            </span>
            {!card.image && <span className="suit-center">{card.suit}</span>}
            <span className="corner bottom">
              <b>{card.rank}</b>
              <span>{card.suit}</span>
            </span>
          </>
        )
      )}
    </div>
  );
}
function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: React.ReactNode;
  close(): void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={close}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(initialSession);
  const table = useTable(session);
  const [name, setName] = useState(localStorage.getItem("gather.name") || "");
  const [code, setCode] = useState(
    location.hash.match(/join\/([A-Z2-9]{4})/i)?.[1]?.toUpperCase() || "",
  );
  const [homeError, setHomeError] = useState("");
  const [modal, setModal] = useState<
    "invite" | "rules" | "reset" | "leave" | null
  >(null);
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState("");
  const [activePiece, setActivePiece] = useState<string | null>(null);
  const [sort, setSort] = useState<"rank" | "suit">("rank");
  const file = useRef<HTMLInputElement>(null);
  const board = useRef<HTMLDivElement>(null);
  const v = table.view;
  const disabled = !table.online || table.pending;
  const isHost = session?.role === "host";
  const chosen = selected.filter((id) => v?.hand.some((c) => c.id === id));
  const others = v?.players.filter((p) => p.id !== v.you) ?? [];
  const recipient = others.some((p) => p.id === target)
    ? target
    : (others[0]?.id ?? "");
  const inviteUrl = session
    ? `${location.origin}${location.pathname}#/join/${session.code}`
    : "";

  function enter(role: "host" | "client") {
    if (!name.trim()) {
      setHomeError("What should we call you? Add your name first.");
      return;
    }
    if (role === "client" && !/^[A-Z2-9]{4}$/.test(code)) {
      setHomeError("Enter the four-character code from your host.");
      return;
    }
    localStorage.setItem("gather.name", name.trim());
    setHomeError("");
    setSelected([]);
    setSession(newSession(role, name, role === "client" ? code : undefined));
  }
  function send(a: Action) {
    if (!disabled) table.send(a);
  }
  function play(faceUp: boolean) {
    send({ type: "play", ids: chosen, faceUp });
    setSelected([]);
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }
  async function loadPack(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      if (f.size > 500000)
        throw Error(
          "Keep pack files under 500 KB. Images should use HTTPS URLs.",
        );
      send({ type: "loadPack", pack: JSON.parse(await f.text()) });
    } catch (error) {
      setHomeError((error as Error).message);
    }
    e.target.value = "";
  }
  function drag(
    e: ReactPointerEvent<HTMLButtonElement>,
    id: string,
    token = false,
  ) {
    if (disabled || !board.current) return;
    const button = e.currentTarget,
      startX = e.clientX,
      startY = e.clientY;
    const rect = board.current.getBoundingClientRect();
    let moved = false,
      x = 0,
      y = 0;
    button.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 5)
        moved = true;
      if (!moved) return;
      x = Math.max(
        5,
        Math.min(95, ((ev.clientX - rect.left) / rect.width) * 100),
      );
      y = Math.max(
        12,
        Math.min(88, ((ev.clientY - rect.top) / rect.height) * 100),
      );
      button.style.left = `${x}%`;
      button.style.top = `${y}%`;
    };
    const end = () => {
      button.removeEventListener("pointermove", move);
      button.removeEventListener("pointerup", end);
      button.removeEventListener("pointercancel", cancel);
      if (moved) send({ type: token ? "moveToken" : "move", id, x, y });
      else if (!token) setActivePiece(id);
    };
    const cancel = () => {
      button.removeEventListener("pointermove", move);
      button.removeEventListener("pointerup", end);
      button.removeEventListener("pointercancel", cancel);
    };
    button.addEventListener("pointermove", move);
    button.addEventListener("pointerup", end);
    button.addEventListener("pointercancel", cancel);
  }
  const rankOrder = [
    "A",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
  ];
  const cards = [...(v?.hand ?? [])].sort((a, b) =>
    sort === "suit"
      ? a.suit.localeCompare(b.suit) ||
        rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank)
      : rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank) ||
        a.suit.localeCompare(b.suit),
  );
  const selectedPiece = v?.table.find((p) => p.id === activePiece);

  return (
    <div
      className={session ? "app in-room" : "app"}
      style={
        {
          "--back-color": v?.pack.backColor || GO_FISH.backColor,
        } as React.CSSProperties
      }
    >
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            if (session) setModal("leave");
          }}
        >
          <span className="brand-symbol">♣</span> gather
          <span className="brand-dot">.</span>
        </a>
        <span className="brand-caption">A TABLE FOR FRIENDS</span>
        <div className="header-right">
          {session && (
            <span className={`connection ${table.online ? "live" : ""}`}>
              <i />
              {table.online ? "Table online" : "Connecting"}
            </span>
          )}
          <button className="text-button" onClick={() => setModal("rules")}>
            <HelpCircle size={17} />
            <span>How to play</span>
          </button>
          {session && (
            <button
              className="icon-button exit-button"
              title="Leave table"
              aria-label="Leave table"
              onClick={() => setModal("leave")}
            >
              <ArrowLeft size={18} />
            </button>
          )}
        </div>
      </header>

      {!session ? (
        <main className="welcome">
          <section className="welcome-copy">
            <div className="eyebrow">
              <span /> GOOD COMPANY. YOUR RULES.
            </div>
            <h1>
              Pull up
              <br />a chair.
            </h1>
            <p className="intro">
              Your favorite card games, around one little table. Bring your
              friends. We’ll bring the deck.
            </p>
            <div className="welcome-form">
              <label htmlFor="name">First, what should we call you?</label>
              <input
                id="name"
                maxLength={24}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="given-name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") enter(code ? "client" : "host");
                }}
              />
              <button className="primary large" onClick={() => enter("host")}>
                <Plus size={19} /> Create a table <ArrowRight size={19} />
              </button>
              <div className="or">
                <span /> or join your friends <span />
              </div>
              <div className="join-form">
                <input
                  aria-label="Room code"
                  maxLength={4}
                  placeholder="ROOM CODE"
                  value={code}
                  onChange={(e) =>
                    setCode(
                      e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ""),
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") enter("client");
                  }}
                />
                <button className="secondary" onClick={() => enter("client")}>
                  Join table <ArrowRight size={17} />
                </button>
              </div>
              {homeError && (
                <p className="inline-error" role="alert">
                  {homeError}
                </p>
              )}
            </div>
            <div className="welcome-notes">
              <span>
                <Users size={15} /> 2–8 friends
              </span>
              <span>
                <Link size={15} /> No accounts
              </span>
              <span>
                <Hand size={15} /> You make the rules
              </span>
            </div>
          </section>
          <section
            className="welcome-art"
            aria-label="Go Fish playing cards on a green table"
          >
            <span className="art-top">THE FIRST GAME ON THE TABLE</span>
            <div className="hero-cards">
              <div className="hero-card one">
                <CardFace card={{ ...GO_FISH.cards[12], id: "hero-1" }} />
              </div>
              <div className="hero-card two">
                <CardFace back />
              </div>
              <div className="hero-card three">
                <CardFace card={{ ...GO_FISH.cards[25], id: "hero-2" }} />
              </div>
            </div>
            <div className="art-title">
              <Fish size={28} />
              <h2>Go Fish</h2>
            </div>
            <p>Old-school cards. Anywhere friends.</p>
            <div className="art-pill">
              52 CARDS <span>·</span> ENDLESS “GOT ANY SEVENS?”
            </div>
            <span className="art-corner top-left">✦</span>
            <span className="art-corner bottom-right">✦</span>
          </section>
          <footer className="welcome-footer">
            <span>A shared tabletop, not a referee.</span>
            <span>MADE FOR A LITTLE MORE TOGETHER.</span>
          </footer>
        </main>
      ) : (
        <main className="room-layout">
          <section className="main-column">
            <div className="room-heading">
              <div>
                <div className="eyebrow">YOUR EVENING, DEALT IN</div>
                <h1>
                  {v?.pack.name ?? "Joining the table"}{" "}
                  <span className="tag">
                    {v?.started ? "FREE PLAY" : "GETTING READY"}
                  </span>
                </h1>
              </div>
              <button
                className="invite-button"
                onClick={() => setModal("invite")}
              >
                <Users size={16} />
                <span>Invite friends</span>
                <span className="room-code">{session.code}</span>
              </button>
            </div>
            {!table.online && (
              <div className="status-banner" role="status">
                {table.status}{" "}
                {isHost && "Keep this host tab open while playing."}
              </div>
            )}
            {(table.error || homeError) && (
              <div className="error-banner" role="alert">
                {table.error || homeError}
                <button
                  aria-label="Dismiss error"
                  className="icon-button"
                  onClick={() => {
                    table.clearError();
                    setHomeError("");
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            <div className="seats">
              {(v?.players ?? []).map((p, i) => (
                <div
                  className={`seat ${p.id === v?.you ? "you" : ""}`}
                  key={p.id}
                >
                  <div className={`avatar color-${i % 4}`}>
                    {p.name.slice(0, 1).toUpperCase()}
                    <i className={p.connected ? "online" : ""} />
                  </div>
                  <div>
                    <strong>
                      {p.name}
                      {p.id === v?.you && <span> (you)</span>}
                    </strong>
                    <small>
                      {p.connected ? `${p.count} cards` : "Reconnecting…"}
                      {p.id === v?.hostId ? " · host" : ""}
                    </small>
                  </div>
                  <div className="mini-hand" aria-hidden="true">
                    {Array.from({ length: Math.min(p.count, 4) }, (_, n) => (
                      <i key={n} />
                    ))}
                  </div>
                </div>
              ))}
              {(v?.players.length ?? 0) < 8 && (
                <button
                  className="empty-seat"
                  onClick={() => setModal("invite")}
                >
                  <Plus size={17} /> Open seat
                </button>
              )}
            </div>

            <div
              className={`table-surface ${!v?.started ? "not-started" : ""}`}
              ref={board}
              onClick={(e) => {
                if (e.target === e.currentTarget) setActivePiece(null);
              }}
            >
              <div className="table-outline" />
              <span className="table-label">THE SHARED TABLE</span>
              <span className="table-flourish">✦</span>
              {!v?.started ? (
                <div className="lobby-content">
                  <div className="lobby-card">
                    <CardFace back />
                  </div>
                  <h2>
                    {isHost
                      ? "Everyone at the table?"
                      : "Make yourself at home."}
                  </h2>
                  <p>
                    {isHost
                      ? "Invite your friends, then shuffle up and deal."
                      : "Your host will deal when everyone is ready."}
                  </p>
                  {isHost ? (
                    <button
                      className="cream-button"
                      disabled={disabled}
                      onClick={() => send({ type: "setup" })}
                    >
                      <Shuffle size={17} />
                      {(v?.players.length ?? 0) < 2
                        ? "Deal a practice hand"
                        : "Shuffle & deal"}
                    </button>
                  ) : (
                    <span className="waiting-pill">Waiting for the host</span>
                  )}
                  {isHost && (
                    <span className="lobby-hint">
                      Playing solo? Try the controls while your friends join.
                    </span>
                  )}
                </div>
              ) : (
                <>
                  <div className="draw-zone">
                    <button
                      className={`draw-pile ${v.deckCount === 0 ? "empty" : ""}`}
                      aria-label={`Draw a card, ${v.deckCount} remaining`}
                      disabled={disabled || v.deckCount === 0}
                      onClick={() => send({ type: "draw" })}
                    >
                      {v.deckCount > 0 ? (
                        <CardFace back />
                      ) : (
                        <span>
                          All out
                          <br />
                          of fish.
                        </span>
                      )}
                    </button>
                    <strong>
                      Draw pile <span>{v.deckCount}</span>
                    </strong>
                    <small>Tap to go fish</small>
                  </div>
                  {v.table.length === 0 && (
                    <div className="table-empty">
                      <Layers size={28} strokeWidth={1} />
                      <span>A place for your sets.</span>
                      <small>Select cards below to play them here.</small>
                    </div>
                  )}
                  {v.table.map((p) => (
                    <button
                      key={p.id}
                      className={`table-card ${activePiece === p.id ? "active" : ""}`}
                      style={{ left: `${p.x}%`, top: `${p.y}%` }}
                      aria-label={
                        p.card
                          ? `${p.card.rank} ${p.card.suit} on table`
                          : "Face-down card on table"
                      }
                      disabled={disabled}
                      onPointerDown={(e) => drag(e, p.id)}
                      onClick={(e) => {
                        if (e.detail === 0) setActivePiece(p.id);
                      }}
                      onKeyDown={(e) => {
                        const steps: Record<string, number[]> = {
                          ArrowLeft: [-3, 0],
                          ArrowRight: [3, 0],
                          ArrowUp: [0, -3],
                          ArrowDown: [0, 3],
                        };
                        if (steps[e.key]) {
                          e.preventDefault();
                          send({
                            type: "move",
                            id: p.id,
                            x: p.x + steps[e.key][0],
                            y: p.y + steps[e.key][1],
                          });
                        }
                      }}
                    >
                      <CardFace card={p.card} back={!p.faceUp} small />
                    </button>
                  ))}
                  {v.tokens.map((t) => (
                    <button
                      className="token"
                      key={t.id}
                      aria-label={`Move ${t.label} token`}
                      disabled={disabled}
                      style={{
                        background: t.color,
                        left: `${t.x}%`,
                        top: `${t.y}%`,
                      }}
                      onPointerDown={(e) => drag(e, t.id, true)}
                      onKeyDown={(e) => {
                        const steps: Record<string, number[]> = {
                          ArrowLeft: [-3, 0],
                          ArrowRight: [3, 0],
                          ArrowUp: [0, -3],
                          ArrowDown: [0, 3],
                        };
                        if (steps[e.key]) {
                          e.preventDefault();
                          send({
                            type: "moveToken",
                            id: t.id,
                            x: t.x + steps[e.key][0],
                            y: t.y + steps[e.key][1],
                          });
                        }
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                  {selectedPiece && (
                    <div className="piece-actions">
                      <span>
                        {selectedPiece.card
                          ? `${selectedPiece.card.rank}${selectedPiece.card.suit}`
                          : "Face-down card"}
                      </span>
                      <button
                        disabled={disabled}
                        onClick={() =>
                          send({ type: "flip", id: selectedPiece.id })
                        }
                      >
                        Flip
                      </button>
                      <button
                        disabled={disabled}
                        onClick={() => {
                          send({ type: "take", id: selectedPiece.id });
                          setActivePiece(null);
                        }}
                      >
                        To my hand
                      </button>
                      <button
                        disabled={disabled}
                        onClick={() => {
                          send({ type: "return", id: selectedPiece.id });
                          setActivePiece(null);
                        }}
                      >
                        To deck
                      </button>
                      <button
                        aria-label="Close card actions"
                        onClick={() => setActivePiece(null)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                  <div className="table-bottom">
                    <span>
                      <Hand size={14} /> Move freely. Play fairly.
                    </span>
                    <span>Drag to arrange · tap a card for actions</span>
                  </div>
                </>
              )}
            </div>

            <section className="hand-panel">
              <div className="hand-heading">
                <h2>
                  <Hand size={19} /> Your hand{" "}
                  <span>{v?.hand.length ?? 0}</span>
                </h2>
                <div>
                  <span className="private-label">ONLY YOU CAN SEE THESE</span>
                  <button
                    className="text-button"
                    onClick={() => setSort(sort === "rank" ? "suit" : "rank")}
                  >
                    Sort: {sort}
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>
              <div className="hand-cards">
                {cards.length ? (
                  cards.map((c) => (
                    <button
                      className={`hand-card ${chosen.includes(c.id) ? "selected" : ""}`}
                      aria-label={`${c.rank} ${c.suit}`}
                      aria-pressed={chosen.includes(c.id)}
                      key={c.id}
                      onClick={() =>
                        setSelected(
                          chosen.includes(c.id)
                            ? chosen.filter((id) => id !== c.id)
                            : [...chosen, c.id],
                        )
                      }
                    >
                      <CardFace card={c} />
                      <span className="selection-check">
                        <Check size={12} />
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="hand-empty">
                    {v?.started
                      ? "Your hand is empty. Draw a card or pick one up from the table."
                      : "Your cards will land here when the host deals."}
                  </div>
                )}
              </div>
              <div className="hand-toolbar">
                <span className="selection-label">
                  {chosen.length
                    ? `${chosen.length} selected`
                    : "Select cards to make your move"}
                  {chosen.length > 0 && (
                    <button onClick={() => setSelected([])}>Clear</button>
                  )}
                </span>
                <div className="hand-actions">
                  <button
                    className="secondary"
                    disabled={disabled || !chosen.length}
                    onClick={() => play(false)}
                  >
                    Face down
                  </button>
                  <button
                    className="primary"
                    disabled={disabled || !chosen.length}
                    onClick={() => play(true)}
                  >
                    <ArrowDownToLine size={16} /> Play to table
                  </button>
                  <div className="give-control">
                    <select
                      aria-label="Give cards to player"
                      disabled={!others.length}
                      value={recipient}
                      onChange={(e) => setTarget(e.target.value)}
                    >
                      {!others.length && (
                        <option value="">No other players</option>
                      )}
                      {others.map((p) => (
                        <option value={p.id} key={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={disabled || !chosen.length || !recipient}
                      onClick={() => {
                        send({ type: "give", ids: chosen, to: recipient });
                        setSelected([]);
                      }}
                    >
                      Give <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </section>

          <aside className="sidebar">
            <div className="pack-card">
              <div className="eyebrow">ON THE TABLE</div>
              <div className="pack-illustration">
                <Fish size={46} strokeWidth={1.3} />
                <span>✦</span>
              </div>
              <h2>{v?.pack.name ?? "Go Fish"}</h2>
              <p>{v?.pack.description ?? GO_FISH.description}</p>
              <div className="pack-meta">
                <span>
                  <Users size={14} /> Up to 8 players
                </span>
                <span>
                  <Layers size={14} /> Card pack
                </span>
              </div>
              <button className="text-button" onClick={() => setModal("rules")}>
                {v?.pack.id === "go-fish"
                  ? "A quick refresher"
                  : "Table basics"}{" "}
                <ArrowRight size={15} />
              </button>
            </div>
            <div className="table-tools">
              <h3>Table tools</h3>
              <button
                disabled={disabled || !v?.started || !v.deckCount}
                onClick={() => send({ type: "shuffle" })}
              >
                <Shuffle size={17} /> Shuffle draw pile
              </button>
              {isHost && (
                <button
                  disabled={disabled || !v?.started}
                  onClick={() => setModal("reset")}
                >
                  <RotateCcw size={17} /> Gather & redeal
                </button>
              )}
              {isHost && !v?.started && (
                <button
                  disabled={disabled}
                  onClick={() => file.current?.click()}
                >
                  <Plus size={17} /> Load a game pack
                </button>
              )}
              <input
                type="file"
                accept=".json,application/json"
                ref={file}
                hidden
                onChange={loadPack}
              />
            </div>
            <div className="activity">
              <h3>
                At the table <span>LIVE</span>
              </h3>
              <div className="activity-list">
                {v?.log.length ? (
                  v.log.slice(0, 7).map((entry, i) => (
                    <div
                      className={`activity-entry ${i === 0 ? "latest" : ""}`}
                      key={entry.id}
                    >
                      <i />
                      <p>{entry.text}</p>
                    </div>
                  ))
                ) : (
                  <p className="muted">A fresh table. A good place to start.</p>
                )}
              </div>
            </div>
            <div className="rules-note">
              <Sparkles size={18} />
              <p>
                A table, not a referee.
                <br />
                <span>You decide the turns, the rules, and who’s winning.</span>
              </p>
            </div>
            <div className="network-note">
              {mode() === "peer"
                ? "Peer-to-peer connection"
                : "Host-led · relay connection"}
              <br />
              The host keeps the table running.
            </div>
          </aside>
        </main>
      )}

      {modal === "invite" && (
        <Modal
          title="There’s room for your friends."
          close={() => setModal(null)}
        >
          <p>Scan the code or open the invitation link on another device.</p>
          <div className="qr-wrap">
            <QRCodeSVG value={inviteUrl} size={176} fgColor="#183e36" />
          </div>
          <div className="invite-code">{session?.code}</div>
          <p className="center muted">
            Or enter this room code on the home screen.
          </p>
          <div className="copy-row">
            <input
              readOnly
              aria-label="Invitation link"
              value={inviteUrl}
              onFocus={(e) => e.target.select()}
            />
            <button className="primary" onClick={copy}>
              {copied ? <Check size={18} /> : <Copy size={18} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          {location.hostname === "localhost" && (
            <p className="local-note">
              This link works on this computer. For phones on your Wi-Fi, open
              Gather using this computer’s network address first, then share
              that invitation.
            </p>
          )}
          <p className="muted center">
            Keep the host’s tab open. Friends who reconnect keep their hands.
          </p>
        </Modal>
      )}
      {modal === "rules" && (
        <Modal
          title={
            !v || v.pack.id === "go-fish"
              ? "A little Go Fish refresher."
              : "Make this table your own."
          }
          close={() => setModal(null)}
        >
          {(!v || v.pack.id === "go-fish") && (
            <>
              <p>
                Collect sets of four cards of the same rank. Most sets at the
                end wins.
              </p>
              <ol className="rules-list">
                <li>
                  <b>Deal everyone in.</b> Two or three players get 7 cards
                  each; four or more get 5. The rest form the draw pile.
                </li>
                <li>
                  <b>Ask a friend.</b> On your turn, ask someone for a rank
                  already in your hand. They give you all their cards of that
                  rank.
                </li>
                <li>
                  <b>No luck? Go fish.</b> Draw from the pile. If you get the
                  rank you asked for, show it and ask again. Otherwise the next
                  player goes.
                </li>
                <li>
                  <b>Put your sets down.</b> Select all four matching cards and
                  play them face up to the table. If your hand runs out, draw if
                  cards remain.
                </li>
              </ol>
            </>
          )}
          <div className="callout">
            Talk over your usual call or across the room. Gather doesn’t enforce
            turns, requests, or scoring—agree on your house rules together.
          </div>
          <p className="muted">
            Table basics: select cards in your hand to play or give them. Tap
            table cards to flip, pick up, or return them to the deck. Drag cards
            to arrange your sets; arrow keys also move a focused card.
          </p>
          <button className="primary wide" onClick={() => setModal(null)}>
            Got it. Let’s play.
          </button>
        </Modal>
      )}
      {modal === "reset" && (
        <Modal title="Deal a fresh game?" close={() => setModal(null)}>
          <p>
            This gathers every card from all hands and the table, shuffles the
            full deck, and deals new hands to everyone, including disconnected
            players.
          </p>
          <div className="modal-actions">
            <button className="secondary" onClick={() => setModal(null)}>
              Keep playing
            </button>
            <button
              className="primary"
              disabled={disabled}
              onClick={() => {
                send({ type: "setup" });
                setSelected([]);
                setActivePiece(null);
                setModal(null);
              }}
            >
              Shuffle & redeal
            </button>
          </div>
        </Modal>
      )}
      {modal === "leave" && (
        <Modal
          title={isHost ? "Close your table?" : "Leave the table?"}
          close={() => setModal(null)}
        >
          <p>
            {isHost
              ? "You’re hosting, so leaving ends this table for everyone. Reloading the page instead will keep the game and reconnect your friends."
              : "Leaving gives up your saved seat on this browser tab. To keep your hand, close this dialog and reload instead."}
          </p>
          <div className="modal-actions">
            <button className="secondary" onClick={() => setModal(null)}>
              Stay here
            </button>
            <button
              className="primary"
              onClick={() => {
                setSession(null);
                setModal(null);
                setSelected([]);
                setHomeError("");
                history.replaceState(null, "", location.pathname);
              }}
            >
              {isHost ? "Close table" : "Leave table"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
