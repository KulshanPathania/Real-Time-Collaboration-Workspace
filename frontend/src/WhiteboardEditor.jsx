import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import {
  ArrowLeft,
  MousePointer,
  Pen,
  Square,
  Circle,
  StickyNote,
  Trash2,
  ZoomIn,
  ZoomOut,
  Wifi,
  WifiOff,
} from "lucide-react";
import "./WhiteboardEditor.css";

const COLORS = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#111827"];
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const WS_BASE = API_BASE.replace(/^http/, "ws");

const MSG_SYNC_STATE = 0;
const MSG_UPDATE = 1;
const MSG_AWARENESS = 2;

function encodeBinary(type, payload) {
  const out = new Uint8Array(1 + payload.length);
  out[0] = type;
  out.set(payload, 1);
  return out;
}

export default function WhiteboardEditor({ document, currentUser, onBack, onTitleChange }) {
  const roomId = `board-${document.id}`;
  const canvasRef = useRef(null);

  const [title, setTitle] = useState(document.title || "Untitled Whiteboard");
  const [tool, setTool] = useState("pen"); // "select" | "pen" | "rect" | "circle" | "note"
  const [color, setColor] = useState("#2563eb");
  const [elements, setElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [editingNoteId, setEditingNoteId] = useState(null);

  // Pan & zoom state
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [isSpaceDown, setIsSpaceDown] = useState(false);

  // Multiplayer awareness & connection status
  const [connected, setConnected] = useState(false);
  const [remotePeers, setRemotePeers] = useState({});

  const ydocRef = useRef(null);
  const yElementsRef = useRef(null);
  const wsRef = useRef(null);
  const dragStateRef = useRef(null);
  const lastCursorSentRef = useRef(0);

  const localIdentity = useMemo(() => {
    const palette = ["#2563eb", "#db2777", "#059669", "#d97706", "#7c3aed"];
    const name = currentUser?.name || currentUser?.email?.split("@")[0] || `User-${Math.floor(Math.random() * 900 + 100)}`;
    const peerColor = palette[Math.floor(Math.random() * palette.length)];
    return {
      clientId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      color: peerColor,
    };
  }, [currentUser]);

  useEffect(() => {
    setTitle(document.title || "Untitled Whiteboard");
  }, [document.id, document.title]);

  // Spacebar shortcut for panning
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === "Space" && window.document.activeElement?.tagName !== "TEXTAREA" && window.document.activeElement?.tagName !== "INPUT") {
        setIsSpaceDown(true);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId && !editingNoteId && window.document.activeElement?.tagName !== "INPUT") {
        yElementsRef.current?.delete(selectedId);
        setSelectedId(null);
      }
    };
    const onKeyUp = (e) => {
      if (e.code === "Space") setIsSpaceDown(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [selectedId, editingNoteId]);

  // Initialize Yjs + IndexedDB offline persistence + WebSocket sync
  useEffect(() => {
    const ydoc = new Y.Doc();
    const yElements = ydoc.getMap("elements");
    ydocRef.current = ydoc;
    yElementsRef.current = yElements;

      const syncReactFromYMap = () => {
          const list = Array.from(yElements.values())
              .map((item) => ({
                  ...item,
                  points: Array.isArray(item.points) ? item.points.map((p) => ({ ...p })) : item.points,
              }))
              .sort((a, b) => (a.order || 0) - (b.order || 0));
          setElements(list);
      };

    yElements.observe(syncReactFromYMap);

    // Offline-first persistence in IndexedDB
    const indexeddbProvider = new IndexeddbPersistence(roomId, ydoc);
    indexeddbProvider.on("synced", () => {
      syncReactFromYMap();
    });

    let ws;
    let reconnectTimer;
    let cancelled = false;

    const connectWebSocket = () => {
      if (cancelled) return;
      ws = new WebSocket(`${WS_BASE}/collab/${encodeURIComponent(roomId)}`);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        // Push local offline edits to server on reconnect
        const fullLocalUpdate = Y.encodeStateAsUpdate(ydoc);
        ws.send(encodeBinary(MSG_UPDATE, fullLocalUpdate));
      };

        ws.onmessage = async (event) => {
            const rawBuffer =
                event.data instanceof ArrayBuffer
                    ? event.data
                    : await event.data.arrayBuffer();
            const buf = new Uint8Array(rawBuffer);
        if (buf.length < 2) return;
        const msgType = buf[0];
        const payload = buf.slice(1);

        if (msgType === MSG_SYNC_STATE || msgType === MSG_UPDATE) {
          Y.applyUpdate(ydoc, payload, "remote");
          // If server didn't have our offline changes yet, push state back once
          if (msgType === MSG_SYNC_STATE && yElements.size > 0) {
            ws.send(encodeBinary(MSG_UPDATE, Y.encodeStateAsUpdate(ydoc)));
          }
        } else if (msgType === MSG_AWARENESS) {
          try {
            const peer = JSON.parse(new TextDecoder().decode(payload));
            if (peer.clientId === localIdentity.clientId) return;
            if (peer.offline) {
              setRemotePeers((prev) => {
                const copy = { ...prev };
                delete copy[peer.clientId];
                return copy;
              });
            } else {
              setRemotePeers((prev) => ({
                ...prev,
                [peer.clientId]: { ...peer, lastSeen: Date.now() },
              }));
            }
          } catch {
            // Ignore malformed awareness packets
          }
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (!cancelled) {
          reconnectTimer = setTimeout(connectWebSocket, 2000);
        }
      };
    };

    const handleLocalYDocUpdate = (update, origin) => {
      if (origin === "remote") return;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(encodeBinary(MSG_UPDATE, update));
      }
    };

    ydoc.on("update", handleLocalYDocUpdate);
    connectWebSocket();

    // Prune stale remote cursors
    const pruneInterval = setInterval(() => {
      const now = Date.now();
      setRemotePeers((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [id, peer] of Object.entries(next)) {
          if (now - peer.lastSeen > 8000) {
            delete next[id];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 3000);

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer);
      clearInterval(pruneInterval);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const bye = new TextEncoder().encode(
          JSON.stringify({ clientId: localIdentity.clientId, offline: true })
        );
        wsRef.current.send(encodeBinary(MSG_AWARENESS, bye));
        wsRef.current.close();
      }
      ydoc.off("update", handleLocalYDocUpdate);
      yElements.unobserve(syncReactFromYMap);
      indexeddbProvider.destroy();
      ydoc.destroy();
    };
  }, [roomId, localIdentity]);

  const sendCursorAwareness = (worldPt) => {
    const now = Date.now();
    if (now - lastCursorSentRef.current < 35) return;
    lastCursorSentRef.current = now;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const payload = new TextEncoder().encode(
        JSON.stringify({
          clientId: localIdentity.clientId,
          name: localIdentity.name,
          color: localIdentity.color,
          x: worldPt.x,
          y: worldPt.y,
          tool,
        })
      );
      wsRef.current.send(encodeBinary(MSG_AWARENESS, payload));
    }
  };

  // Render canvas elements with pan + zoom transform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.save();
    ctx.translate(viewport.x, viewport.y);
    ctx.scale(viewport.zoom, viewport.zoom);

    for (const el of elements) {
      ctx.save();
      ctx.strokeStyle = el.color || "#2563eb";
      ctx.lineWidth = el.strokeWidth || 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (el.type === "pen" && Array.isArray(el.points) && el.points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(el.points[0].x, el.points[0].y);
        for (let i = 1; i < el.points.length; i++) {
          ctx.lineTo(el.points[i].x, el.points[i].y);
        }
        ctx.stroke();

        if (el.id === selectedId) {
          const xs = el.points.map((p) => p.x);
          const ys = el.points.map((p) => p.y);
          ctx.strokeStyle = "#3b82f6";
          ctx.lineWidth = 1.5 / viewport.zoom;
          ctx.setLineDash([5, 4]);
          ctx.strokeRect(
            Math.min(...xs) - 6,
            Math.min(...ys) - 6,
            Math.max(...xs) - Math.min(...xs) + 12,
            Math.max(...ys) - Math.min(...ys) + 12
          );
        }
      } else if (el.type === "rect") {
        ctx.strokeRect(el.x, el.y, el.w, el.h);
        if (el.id === selectedId) {
          ctx.strokeStyle = "#3b82f6";
          ctx.lineWidth = 1.5 / viewport.zoom;
          ctx.setLineDash([5, 4]);
          ctx.strokeRect(el.x - 5, el.y - 5, el.w + 10, el.h + 10);
        }
      } else if (el.type === "circle") {
        const rx = Math.abs(el.w) / 2;
        const ry = Math.abs(el.h) / 2;
        const cx = el.x + el.w / 2;
        const cy = el.y + el.h / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
        ctx.stroke();

        if (el.id === selectedId) {
          ctx.strokeStyle = "#3b82f6";
          ctx.lineWidth = 1.5 / viewport.zoom;
          ctx.setLineDash([5, 4]);
          ctx.strokeRect(
            Math.min(el.x, el.x + el.w) - 5,
            Math.min(el.y, el.y + el.h) - 5,
            Math.abs(el.w) + 10,
            Math.abs(el.h) + 10
          );
        }
      }

      ctx.restore();
    }

    ctx.restore();
  }, [elements, selectedId, viewport]);

  const screenToWorld = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - viewport.x) / viewport.zoom,
      y: (e.clientY - rect.top - viewport.y) / viewport.zoom,
    };
  };

  const hitTestCanvasElement = (pt) => {
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      if (el.type === "rect" || el.type === "circle") {
        const minX = Math.min(el.x, el.x + el.w) - 6;
        const maxX = Math.max(el.x, el.x + el.w) + 6;
        const minY = Math.min(el.y, el.y + el.h) - 6;
        const maxY = Math.max(el.y, el.y + el.h) + 6;
        if (pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY) {
          return el;
        }
      } else if (el.type === "pen" && Array.isArray(el.points)) {
        if (el.points.some((p) => Math.hypot(p.x - pt.x, p.y - pt.y) <= 10)) {
          return el;
        }
      }
    }
    return null;
  };

  const upsertYElement = (element) => {
    yElementsRef.current?.set(element.id, element);
  };

  const handlePointerDown = (e) => {
    // Middle-click or Space + Left-click pans the canvas
    if (e.button === 1 || (e.button === 0 && isSpaceDown)) {
      dragStateRef.current = {
        mode: "pan",
        startClient: { x: e.clientX, y: e.clientY },
        startViewport: { ...viewport },
      };
      return;
    }

    if (e.button !== 0) return;
    const pt = screenToWorld(e);
    setEditingNoteId(null);

    if (tool === "note") {
      const id = `note-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      const newNote = {
        id,
        type: "note",
        order: Date.now(),
        x: pt.x,
        y: pt.y,
        w: 170,
        h: 130,
        text: "Idea...",
        color: "#fef08a",
      };
      upsertYElement(newNote);
      setSelectedId(id);
      setEditingNoteId(id);
      setTool("select");
      return;
    }

    if (tool === "select") {
      const hit = hitTestCanvasElement(pt);
      if (hit) {
        setSelectedId(hit.id);
        dragStateRef.current = {
          mode: "move",
          targetId: hit.id,
          startPt: pt,
        };
      } else {
        setSelectedId(null);
      }
      return;
    }

    const id = `${tool}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    dragStateRef.current = {
      mode: "create",
      tool,
      id,
      startPt: pt,
    };

    if (tool === "pen") {
      upsertYElement({
        id,
        type: "pen",
        order: Date.now(),
        color,
        strokeWidth: 3,
        points: [pt],
      });
    } else if (tool === "rect" || tool === "circle") {
      upsertYElement({
        id,
        type: tool,
        order: Date.now(),
        color,
        strokeWidth: 3,
        x: pt.x,
        y: pt.y,
        w: 0,
        h: 0,
      });
    }
  };

  const handlePointerMove = (e) => {
    const pt = screenToWorld(e);
    sendCursorAwareness(pt);

    const drag = dragStateRef.current;
    if (!drag) return;

    if (drag.mode === "pan") {
      setViewport({
        ...drag.startViewport,
        x: drag.startViewport.x + (e.clientX - drag.startClient.x),
        y: drag.startViewport.y + (e.clientY - drag.startClient.y),
      });
      return;
    }

    const yElements = yElementsRef.current;
    if (!yElements) return;

    if (drag.mode === "move") {
      const current = yElements.get(drag.targetId);
      if (!current) return;
      const dx = pt.x - drag.startPt.x;
      const dy = pt.y - drag.startPt.y;
      drag.startPt = pt;

      if (current.type === "pen") {
        upsertYElement({
          ...current,
          points: current.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
        });
      } else {
        upsertYElement({ ...current, x: current.x + dx, y: current.y + dy });
      }
      return;
    }

    if (drag.mode === "create") {
      const current = yElements.get(drag.id);
      if (!current) return;
      if (current.type === "pen") {
        upsertYElement({ ...current, points: [...current.points, pt] });
      } else {
        upsertYElement({
          ...current,
          w: pt.x - drag.startPt.x,
          h: pt.y - drag.startPt.y,
        });
      }
    }
  };

  const handlePointerUp = () => {
    dragStateRef.current = null;
  };

  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      setViewport((prev) => ({
        ...prev,
        zoom: Math.min(3, Math.max(0.3, Number((prev.zoom * factor).toFixed(2)))),
      }));
    } else {
      setViewport((prev) => ({
        ...prev,
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  };

  const handleNoteMouseDown = (e, note) => {
    if (editingNoteId === note.id) return;
    e.stopPropagation();
    setSelectedId(note.id);
    dragStateRef.current = {
      mode: "move-note",
      targetId: note.id,
      startClient: { x: e.clientX, y: e.clientY },
    };
  };

  useEffect(() => {
    const onWindowMove = (e) => {
      const drag = dragStateRef.current;
      if (!drag || drag.mode !== "move-note") return;
      const current = yElementsRef.current?.get(drag.targetId);
      if (!current) return;

      const dx = (e.clientX - drag.startClient.x) / viewport.zoom;
      const dy = (e.clientY - drag.startClient.y) / viewport.zoom;
      drag.startClient = { x: e.clientX, y: e.clientY };

      upsertYElement({ ...current, x: current.x + dx, y: current.y + dy });
    };

    const onWindowUp = () => {
      if (dragStateRef.current?.mode === "move-note") {
        dragStateRef.current = null;
      }
    };

    window.addEventListener("pointermove", onWindowMove);
    window.addEventListener("pointerup", onWindowUp);
    return () => {
      window.removeEventListener("pointermove", onWindowMove);
      window.removeEventListener("pointerup", onWindowUp);
    };
  }, [viewport.zoom]);

  const handleClear = () => {
    const yElements = yElementsRef.current;
    if (!yElements || yElements.size === 0) return;
    if (window.confirm("Clear all items from this shared whiteboard?")) {
      ydocRef.current.transact(() => {
        for (const key of Array.from(yElements.keys())) {
          yElements.delete(key);
        }
      });
      setSelectedId(null);
    }
  };

  const notes = elements.filter((el) => el.type === "note");
  const peersList = Object.values(remotePeers);

  return (
    <div className="whiteboard-page">
      <header className="whiteboard-topbar">
        <button className="wb-btn" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>

        <input
          className="wb-title-input"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            onTitleChange?.(e.target.value);
          }}
          aria-label="Whiteboard title"
        />

        <div className="wb-actions">
          <div className="wb-presence-row" title="Active collaborators on this board">
            <span
              className="wb-avatar-pill"
              style={{ backgroundColor: localIdentity.color }}
            >
              {localIdentity.name[0]?.toUpperCase()} (You)
            </span>
            {peersList.map((peer) => (
              <span
                key={peer.clientId}
                className="wb-avatar-pill"
                style={{ backgroundColor: peer.color }}
              >
                {peer.name}
              </span>
            ))}
          </div>

          <span className={`wb-sync-badge ${connected ? "online" : "offline"}`}>
            {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
            {connected ? "Live" : "Offline (Saved locally)"}
          </span>

          <button
            className="wb-btn wb-danger"
            onClick={handleClear}
            disabled={elements.length === 0}
            title="Clear board"
          >
            <Trash2 size={16} />
            <span>Clear</span>
          </button>
        </div>
      </header>

      <div className="whiteboard-toolbar">
        <button
          className={`wb-tool-btn ${tool === "select" ? "active" : ""}`}
          onClick={() => setTool("select")}
        >
          <MousePointer size={16} />
          <span>Select</span>
        </button>
        <button
          className={`wb-tool-btn ${tool === "pen" ? "active" : ""}`}
          onClick={() => setTool("pen")}
        >
          <Pen size={16} />
          <span>Pen</span>
        </button>
        <button
          className={`wb-tool-btn ${tool === "rect" ? "active" : ""}`}
          onClick={() => setTool("rect")}
        >
          <Square size={16} />
          <span>Rectangle</span>
        </button>
        <button
          className={`wb-tool-btn ${tool === "circle" ? "active" : ""}`}
          onClick={() => setTool("circle")}
        >
          <Circle size={16} />
          <span>Ellipse</span>
        </button>
        <button
          className={`wb-tool-btn ${tool === "note" ? "active" : ""}`}
          onClick={() => setTool("note")}
        >
          <StickyNote size={16} />
          <span>Sticky Note</span>
        </button>

        <div className="wb-divider" />

        <div className="wb-colors">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`wb-color-swatch ${color === c ? "selected" : ""}`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>

        <div className="wb-divider" />

        <div className="wb-zoom-controls">
          <button
            className="wb-tool-btn"
            onClick={() =>
              setViewport((v) => ({ ...v, zoom: Math.max(0.3, Number((v.zoom - 0.1).toFixed(2))) }))
            }
            title="Zoom Out"
          >
            <ZoomOut size={15} />
          </button>
          <span className="wb-zoom-label">{Math.round(viewport.zoom * 100)}%</span>
          <button
            className="wb-tool-btn"
            onClick={() =>
              setViewport((v) => ({ ...v, zoom: Math.min(3, Number((v.zoom + 0.1).toFixed(2))) }))
            }
            title="Zoom In"
          >
            <ZoomIn size={15} />
          </button>
        </div>
      </div>

      <div
        className="whiteboard-stage"
        style={{ cursor: isSpaceDown ? "grab" : tool === "select" ? "default" : "crosshair" }}
        onWheel={handleWheel}
      >
        <canvas
          ref={canvasRef}
          className="whiteboard-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />

        {/* Transformed overlay layer for sticky notes + live remote cursors */}
        <div
          className="wb-world-layer"
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {notes.map((note) => (
            <div
              key={note.id}
              className={`wb-sticky-note ${selectedId === note.id ? "selected" : ""}`}
              style={{
                left: note.x,
                top: note.y,
                width: note.w,
                minHeight: note.h,
                backgroundColor: note.color || "#fef08a",
              }}
              onPointerDown={(e) => handleNoteMouseDown(e, note)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditingNoteId(note.id);
              }}
            >
              {editingNoteId === note.id ? (
                <textarea
                  autoFocus
                  className="wb-note-textarea"
                  value={note.text}
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    upsertYElement({ ...note, text: e.target.value });
                  }}
                  onBlur={() => setEditingNoteId(null)}
                />
              ) : (
                <div className="wb-note-text">{note.text}</div>
              )}
            </div>
          ))}

          {peersList.map((peer) => (
            <div
              key={peer.clientId}
              className="wb-remote-cursor"
              style={{
                left: peer.x,
                top: peer.y,
                color: peer.color,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1 1l13 5.5-5.5 2L6.5 14 1 1z" />
              </svg>
              <span
                className="wb-cursor-label"
                style={{ backgroundColor: peer.color }}
              >
                {peer.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}