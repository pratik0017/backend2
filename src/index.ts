import { WebSocketServer, WebSocket } from "ws";

// A map to store rooms. The key is the roomId, and the value is a Set of WebSocket clients in that room.
const rooms = new Map<string, Set<WebSocket>>();

// A map to quickly look up which room a given client is in.
const clientToRoom = new Map<WebSocket, string>();

// Define a more specific type for our signaling messages for better type safety.
interface SignalMessage {
    type: "joinRoom" | "createOffer" | "createAnswer" | "iceCandidate" | "error";
    roomId?: string; // Used for the 'joinRoom' message
    sdp?: string; // Used for 'createOffer' and 'createAnswer'
    candidate?: any; // Used for 'iceCandidate'
    message?: string; // Used for 'error' messages
}

// Initialize the WebSocket server on port 8080.
const wss = new WebSocketServer({ port: 8080 });
console.log("✅ WebRTC Signaling Server started on ws://localhost:8080");

wss.on("connection", (ws: WebSocket) => {
    console.log("- Client connected.");

    // Handle incoming messages from this client
    ws.on("message", (data: any) => {
        let message: SignalMessage;

        // Safely parse the incoming message.
        try {
            message = JSON.parse(data.toString());
        } catch (error) {
            console.error("Error parsing JSON:", error);
            ws.send(JSON.stringify({ type: "error", message: "Invalid JSON format." }));
            return;
        }

        // The first message from a client MUST be 'joinRoom'.
        if (message.type === "joinRoom" && message.roomId) {
            handleJoinRoom(ws, message.roomId);
        } else {
            // For all other messages, broadcast them to the appropriate room.
            broadcastToRoom(ws, message);
        }
    });

    // Handle client disconnection.
    ws.on("close", () => {
        handleDisconnect(ws);
    });

    // Handle any errors that occur.
    ws.on("error", (error) => {
        console.error("WebSocket error:", error);
        handleDisconnect(ws); // Clean up on error as well.
    });
});

/**
 * Adds a new client to a specified room.
 * @param ws The WebSocket client to add.
 * @param roomId The ID of the room to join.
 */
function handleJoinRoom(ws: WebSocket, roomId: string) {
    // If the client is already in a room, do nothing.
    if (clientToRoom.has(ws)) {
        console.warn(`Client tried to join room '${roomId}' but is already in room '${clientToRoom.get(ws)}'.`);
        return;
    }

    // Get the set of clients for the room, or create a new set if the room doesn't exist.
    let room = rooms.get(roomId);
    if (!room) {
        room = new Set<WebSocket>();
        rooms.set(roomId, room);
    }

    // Add the client to the room and track which room the client is in.
    room.add(ws);
    clientToRoom.set(ws, roomId);

    console.log(`- Client joined room: '${roomId}'. Total clients in room: ${room.size}`);
}

/**
 * Broadcasts a message to all other clients in the same room as the sender.
 * @param senderWs The WebSocket of the client sending the message.
 * @param message The signaling message to broadcast.
 */
function broadcastToRoom(senderWs: WebSocket, message: SignalMessage) {
    // Find the room the sender is in.
    const roomId = clientToRoom.get(senderWs);

    // If the sender isn't in a room, they can't send messages.
    if (!roomId) {
        console.warn("Warning: Client not in any room tried to send a message.");
        senderWs.send(JSON.stringify({ type: "error", message: "You must join a room before sending messages." }));
        return;
    }

    // Get the room from the rooms map.
    const room = rooms.get(roomId);
    if (!room) {
        console.error(`Error: Room '${roomId}' not found for a client that should be in it.`);
        return;
    }

    // Send the message to every other client in the room.
    for (const clientWs of room) {
        if (clientWs !== senderWs && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify(message));
        }
    }
}

/**
 * Handles the cleanup when a client disconnects.
 * @param ws The WebSocket client that has disconnected.
 */
function handleDisconnect(ws: WebSocket) {
    // Find the room the client was in.
    const roomId = clientToRoom.get(ws);
    if (!roomId) {
        // This can happen if a client connects but never joins a room.
        console.log("- Client disconnected (was not in a room).");
        return;
    }

    // Remove the client from our lookup map.
    clientToRoom.delete(ws);

    // Get the room the client was in.
    const room = rooms.get(roomId);
    if (room) {
        // Remove the client from the room's set.
        room.delete(ws);
        console.log(`- Client disconnected from room: '${roomId}'. Total clients remaining: ${room.size}`);

        // If the room is now empty, remove it from the rooms map to free up memory.
        if (room.size === 0) {
            rooms.delete(roomId);
            console.log(`- Room '${roomId}' is now empty and has been closed.`);
        }
    }
}
