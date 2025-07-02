import { WebSocketServer, WebSocket } from "ws";

// Start WebSocket server
const wss = new WebSocketServer({ port: 8080 });
console.log("WebSocket server started on ws://localhost:8080");

// Store all connected peers
const peers = new Set<WebSocket>();

// Strongly typed signaling message
interface SignalMessage {
    type: string;
    sdp?: string;
    candidate?: any;
}

wss.on("connection", (ws: WebSocket) => {
    console.log("New peer connected");
    peers.add(ws);

    ws.on("message", (data: any) => {
        let message: SignalMessage;

        // Strict JSON parsing with error handling
        try {
            message = JSON.parse(data.toString());
        } catch (err) {
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

    ws.on("error", (err: any) => {
        console.error("WebSocket error:", err);
    });
});

function broadcastToOthers(sender: WebSocket, message: SignalMessage) {
    for (const peer of peers) {
        if (peer !== sender && peer.readyState === WebSocket.OPEN) {
            peer.send(JSON.stringify(message));
        }
    }
}
