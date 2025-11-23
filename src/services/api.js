const API_URL = 'http://localhost:3000';

class ApiService {
  constructor() {
    this.token = localStorage.getItem('token');
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('token');
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
      ...options.headers,
    };

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Error en la petición');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  decodeToken(token) {
    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      return decoded;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }

  // Auth
  async register(username, email, password) {
    try {
      const data = await this.request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password }),
      });
      
      if (data.token && !data.user) {
        this.setToken(data.token);
        const decoded = this.decodeToken(data.token);
        
        return {
          token: data.token,
          user: {
            id: decoded?.id || decoded?.userId || 'unknown',
            username: username,
            email: email
          }
        };
      }
      
      if (data.token) {
        this.setToken(data.token);
      }
      
      return {
        token: data.token,
        user: data.user || { 
          username: username, 
          email: email,
          id: data.userId || data.id || 'unknown'
        }
      };
    } catch (error) {
      console.error('Register error:', error);
      throw new Error(error.message || 'Error al registrar usuario');
    }
  }

  async login(email, password) {
    try {
      const data = await this.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      
      if (data.token && !data.user) {
        this.setToken(data.token);
        const decoded = this.decodeToken(data.token);
        
        return {
          token: data.token,
          user: {
            id: decoded?.id || decoded?.userId || 'unknown',
            username: decoded?.username || email.split('@')[0],
            email: email
          }
        };
      }
      
      if (data.token) {
        this.setToken(data.token);
      }
      
      return {
        token: data.token,
        user: data.user || { 
          email: email,
          id: data.userId || data.id || 'unknown',
          username: data.username || email.split('@')[0]
        }
      };
    } catch (error) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Error al iniciar sesión');
    }
  }

  // Rooms
  async listRooms() {
    try {
      return await this.request('/rooms', { method: 'GET' });
    } catch (error) {
      console.error('Error listing rooms:', error);
      return [];
    }
  }

  async createRoom(name, isPrivate) {
    return this.request('/rooms', {
      method: 'POST',
      body: JSON.stringify({ name, isPrivate }),
    });
  }

  async joinRoom(roomId) {
    return this.request(`/rooms/${roomId}/join`, { method: 'POST' });
  }

  async leaveRoom(roomId) {
    return this.request(`/rooms/${roomId}/leave`, { method: 'POST' });
  }

  // Messages
  async getHistory(roomId, page = 1, limit = 50) {
    return this.request(`/messages/${roomId}/history?page=${page}&limit=${limit}`);
  }
}

export const api = new ApiService();