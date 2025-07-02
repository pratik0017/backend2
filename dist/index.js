"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
// Start WebSocket server
const wss = new ws_1.WebSocketServer({ port: 8080 });
console.log("WebSocket server started on ws://localhost:8080");
// Store all connected peers
const peers = new Set();
wss.on("connection", (ws) => {
    console.log("New peer connected");
    peers.add(ws);
    ws.on("message", (data) => {
        let message;
        // Strict JSON parsing with error handling
        try {
            message = JSON.parse(data.toString());
        }
        catch (err) {
            console.error("Invalid JSON received:", err);
            ws.send(JSON.stringify({ type: "error", message: "Invalid JSON format" }));
            return;
        }
        if (typeof message.type !== "string") {
            ws.send(JSON.stringify({ type: "error", message: "Missing or invalid 'type' field" }));
            return;
        }
        switch (message.type) {
            case "createOffer":
            case "createAnswer":
            case "iceCandidate":
                broadcastToOthers(ws, message);
                break;
            default:
                ws.send(JSON.stringify({ type: "error", message: `Unknown message type: ${message.type}` }));
                break;
        }
    });
    ws.on("close", () => {
        console.log("Peer disconnected");
        peers.delete(ws);
    });
    ws.on("error", (err) => {
        console.error("WebSocket error:", err);
    });
});
function broadcastToOthers(sender, message) {
    for (const peer of peers) {
        if (peer !== sender && peer.readyState === ws_1.WebSocket.OPEN) {
            peer.send(JSON.stringify(message));
        }
    }
}
