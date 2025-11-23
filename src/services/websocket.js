const WS_URL = 'ws://localhost:3000';

class WebSocketService {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
  }

  connect(token) {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`${WS_URL}?token=${token}`);

      this.ws.onopen = () => {
        console.log('✅ WebSocket conectado');
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('❌ Error en WebSocket:', error);
        reject(error);
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          // 🔥 Log útil para ver qué envía el backend
          console.log("📩 Evento recibido:", message.event, message.data);

          this.notifyListeners(message);
        } catch (error) {
          console.error('Error parseando mensaje:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('🔌 WebSocket desconectado');
      };
    });
  }

  send(event, data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, data }));
    }
  }

  joinRoom(roomId) {
    this.send('join_room', { roomId });
  }

  leaveRoom(roomId) {
    this.send('leave_room', { roomId });
  }

  sendMessage(roomId, content) {
    this.send('send_message', { roomId, content });
  }

  // 🟦 Aquí registras eventos como: room_created, rooms_update, message_received, etc
  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);
  }

  off(eventType, callback) {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // 🔥 Redirige los mensajes según el "event" que venga del backend
  notifyListeners(message) {
    const { event, data } = message;
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(callback => callback(data));
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const ws = new WebSocketService();
