import { WebSocketServer, WebSocket } from "ws";
import * as Y from "yjs";
import { DocUpdate, Snapshot } from "./models/BoardState.js";

const rooms = new Map();
const COMPACT_EVERY = 50;

// Simple binary envelope:
// 0x00 = full Yjs state sync, 0x01 = incremental Yjs update, 0x02 = JSON awareness
const MSG_SYNC_STATE = 0;
const MSG_UPDATE = 1;
const MSG_AWARENESS = 2;

function encodeMessage(type, payloadUint8) {
  const out = new Uint8Array(1 + payloadUint8.length);
  out[0] = type;
  out.set(payloadUint8, 1);
  return out;
}

async function getOrCreateRoom(documentId) {
  if (rooms.has(documentId)) {
    return rooms.get(documentId);
  }

  const ydoc = new Y.Doc();
  const latestSnapshot = await Snapshot.findOne({ documentId }).sort({ version: -1 });
  if (latestSnapshot?.state) {
    Y.applyUpdate(ydoc, new Uint8Array(latestSnapshot.state));
  }

  const pendingUpdates = await DocUpdate.find({ documentId }).sort({ seq: 1 });
  for (const entry of pendingUpdates) {
    Y.applyUpdate(ydoc, new Uint8Array(entry.update));
  }

  const room = {
    documentId,
    ydoc,
    clients: new Set(),
    seq: pendingUpdates.length > 0 ? pendingUpdates[pendingUpdates.length - 1].seq : 0,
    version: latestSnapshot ? latestSnapshot.version : 0,
    writeQueue: Promise.resolve(),
  };

  rooms.set(documentId, room);
  return room;
}

function broadcast(room, data, excludeWs = null) {
  for (const client of room.clients) {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

export function attachCollabServer(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const match = url.pathname.match(/^\/collab\/([^/]+)$/);

    if (!match) {
      socket.destroy();
      return;
    }

    const documentId = decodeURIComponent(match[1]);
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, documentId);
    });
  });

  wss.on("connection", async (ws, _req, documentId) => {
    const room = await getOrCreateRoom(documentId);
    room.clients.add(ws);

    // Send initial persisted Yjs document state to the newly joined client
    const initialState = Y.encodeStateAsUpdate(room.ydoc);
    ws.send(encodeMessage(MSG_SYNC_STATE, initialState));

    ws.on("message", (raw) => {
      const buf = new Uint8Array(raw);
      if (buf.length < 2) return;

      const msgType = buf[0];
      const payload = buf.slice(1);

      if (msgType === MSG_AWARENESS) {
        // Transient cursor/presence data: broadcast only, never persisted
        broadcast(room, buf, ws);
        return;
      }

      if (msgType === MSG_UPDATE) {
        Y.applyUpdate(room.ydoc, payload);
        broadcast(room, buf, ws);

        room.writeQueue = room.writeQueue
          .then(async () => {
            room.seq += 1;
            await DocUpdate.create({
              documentId,
              update: Buffer.from(payload),
              seq: room.seq,
            });

            if (room.seq % COMPACT_EVERY === 0) {
              room.version += 1;
              const fullState = Buffer.from(Y.encodeStateAsUpdate(room.ydoc));
              await Snapshot.create({
                documentId,
                state: fullState,
                version: room.version,
                label: `Snapshot v${room.version}`,
              });
              await DocUpdate.deleteMany({ documentId, seq: { $lte: room.seq } });
            }
          })
          .catch((err) => console.error("Failed persisting Yjs update:", err));
      }
    });

    ws.on("close", () => {
      room.clients.delete(ws);
      if (room.clients.size === 0) {
        setTimeout(() => {
          if (room.clients.size === 0) {
            room.ydoc.destroy();
            rooms.delete(documentId);
          }
        }, 30_000);
      }
    });
  });
}  