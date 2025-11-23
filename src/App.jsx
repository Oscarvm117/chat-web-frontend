import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Send, Users, LogOut, Plus, Hash, Lock, Globe, X, RefreshCw } from 'lucide-react';
import { api } from './services/api';
import { ws } from './services/websocket';

function LoginPage({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        const data = await api.login(email, password);
        await ws.connect(data.token);
        onLogin(data.user);
      } else {
        const data = await api.register(username, email, password);
        await ws.connect(data.token);
        onLogin(data.user);
      }
    } catch (err) {
      setError(err?.message || 'Error de autenticación');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-8 border border-slate-700">
        <div className="flex items-center justify-center mb-8">
          <div className="bg-gradient-to-r from-purple-500 to-blue-500 p-3 rounded-xl">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-white text-center mb-2">
          {isLogin ? 'Bienvenido' : 'Crear Cuenta'}
        </h1>
        <p className="text-slate-400 text-center mb-8">
          {isLogin ? 'Inicia sesión para continuar' : 'Únete a la comunidad'}
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
            <X className="w-5 h-5" />
            {error}
          </div>
        )}

        <div className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Nombre de usuario</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-slate-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                placeholder="johndoe"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-slate-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:outline-none"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-slate-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold py-3 rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Cargando...' : isLogin ? 'Iniciar Sesión' : 'Registrarse'}
          </button>
        </div>

        <div className="mt-6 text-center">
          <button onClick={() => setIsLogin(!isLogin)} className="text-purple-400 hover:text-purple-300 text-sm">
            {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatApp({ user, onLogout }) {
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showJoinPrivate, setShowJoinPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Helper: evitar duplicados y normalizar estructura de la sala
  const addRoomIfNotExists = useCallback((room) => {
    setRooms(prev => {
      if (!room || !room.id) return prev;
      if (prev.some(r => String(r.id) === String(room.id))) return prev;
      return [...prev, {
        id: room.id,
        name: room.name,
        isPrivate: !!room.isPrivate,
        memberCount: room.memberCount ?? 0
      }];
    });
  }, []);

  // Función para cargar salas desde el backend
  const loadRooms = useCallback(async () => {
    try {
      console.log('📡 Cargando salas desde el backend...');
      const roomsList = await api.listRooms();
      console.log('✅ Salas recibidas:', roomsList);
      
      const formatted = (roomsList || []).map(r => ({
        id: r.id,
        name: r.name,
        isPrivate: r.isPrivate || false,
        memberCount: r.members?.length || r.memberCount || 0
      }));
      
      setRooms(formatted);
      return formatted;
    } catch (err) {
      console.error('❌ Error al cargar salas:', err);
      return [];
    }
  }, []);

  // Cargar salas iniciales y configurar polling + WebSocket
  useEffect(() => {
    let mounted = true;
    let pollInterval;

    // 1. Carga inicial
    const init = async () => {
      setRoomsLoading(true);
      await loadRooms();
      setRoomsLoading(false);
    };

    init();

    // 2. Polling cada 5 segundos para sincronizar salas
    pollInterval = setInterval(() => {
      if (mounted) {
        console.log('🔄 Actualizando lista de salas...');
        loadRooms();
      }
    }, 5000); // Actualiza cada 5 segundos

    // --- LISTENERS DE WEBSOCKET ---

    const handleNewMessage = (data) => {
      console.log("WS: Mensaje recibido", data);
      const normalized = {
        id: data.id || `${Date.now()}-${Math.random()}`,
        content: data.content,
        timestamp: data.timestamp || Date.now(),
        user: data.User || data.user || data.sender || { username: 'Desconocido' },
        roomId: data.roomId || data.room_id || data.room
      };
      setMessages(prev => [...prev, normalized]);
    };

    const handleRoomCreated = (data) => {
      console.log("WS: Sala creada recibida (RAW):", data); 
      const roomData = data.room || data.data || data;
      
      if (!roomData || !roomData.id) {
        console.warn("WS: Estructura de sala inválida recibida", roomData);
        // Si el WebSocket no funciona bien, el polling se encargará
        loadRooms();
        return;
      }

      console.log("WS: Añadiendo sala a la lista:", roomData);
      addRoomIfNotExists({
        id: roomData.id,
        name: roomData.name,
        isPrivate: !!roomData.isPrivate,
        memberCount: roomData.memberCount || 0
      });
    };

    const handleUserJoined = ({ roomId, user: joinedUser }) => {
      console.log(`WS: Usuario ${joinedUser?.username} entró a sala ${roomId}`);
      setRooms(prev => prev.map(r => r.id === roomId ? { ...r, memberCount: (r.memberCount || 0) + 1 } : r));
      
      setCurrentRoom(curr => {
        if (curr?.id === roomId) {
            setMessages(prev => [...prev, { 
                id: `sys-join-${Date.now()}`, 
                content: `${joinedUser.username} se unió`, 
                timestamp: Date.now(), 
                system: true 
            }]);
        }
        return curr;
      });
    };

    const handleUserLeft = ({ roomId, user: leftUser }) => {
       setRooms(prev => prev.map(r => r.id === roomId ? { ...r, memberCount: Math.max((r.memberCount || 1) - 1, 0) } : r));
       
       setCurrentRoom(curr => {
        if (curr?.id === roomId) {
            setMessages(prev => [...prev, { 
                id: `sys-left-${Date.now()}`, 
                content: `${leftUser.username} salió`, 
                timestamp: Date.now(), 
                system: true 
            }]);
        }
        return curr;
      });
    };

    // Suscribirse a eventos
    ws.on('new_message', handleNewMessage);
    ws.on('room_created', handleRoomCreated);
    ws.on('user_joined', handleUserJoined);
    ws.on('user_left', handleUserLeft);

    return () => {
      mounted = false;
      clearInterval(pollInterval);
      ws.off('new_message', handleNewMessage);
      ws.off('room_created', handleRoomCreated);
      ws.off('user_joined', handleUserJoined);
      ws.off('user_left', handleUserLeft);
    };
  }, [addRoomIfNotExists, loadRooms]);

  // Auto-scroll mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Manejar join a sala (públicas solo)
  const handleJoinRoom = useCallback(async (room) => {
    if (!room || !room.id) return;
    
    // No permitir click directo en salas privadas
    if (room.isPrivate) {
      alert('🔒 Esta es una sala privada.\nUsa "Unirse con código" e ingresa el ID de la sala.');
      return;
    }
    
    setLoading(true);
    try {
      await api.joinRoom(room.id);
      ws.joinRoom(room.id);
      
      const history = await api.getHistory(room.id, 1, 50);
      const msgs = (history?.messages || []).map(m => ({
        id: m.id,
        content: m.content,
        timestamp: m.timestamp,
        user: m.User || m.user || m.sender || { username: m.username || 'Usuario' }
      }));
      setMessages(msgs);
      setCurrentRoom({
        id: room.id,
        name: room.name,
        isPrivate: room.isPrivate,
        memberCount: room.memberCount ?? 0
      });
    } catch (err) {
      console.error('Error al unirse a la sala:', err);
      alert('No se pudo unir a la sala: ' + (err?.message || 'error'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Nuevo: Unirse con código (ID de sala privada)
  const handleJoinWithCode = useCallback(async (roomId) => {
    if (!roomId || !roomId.trim()) {
      alert('⚠️ Ingresa un código de sala válido');
      return;
    }

    setLoading(true);
    try {
      // Intentar unirse directamente con el ID
      await api.joinRoom(roomId.trim());
      ws.joinRoom(roomId.trim());
      
      const history = await api.getHistory(roomId.trim(), 1, 50);
      const msgs = (history?.messages || []).map(m => ({
        id: m.id,
        content: m.content,
        timestamp: m.timestamp,
        user: m.User || m.user || m.sender || { username: m.username || 'Usuario' }
      }));
      
      // Buscar la sala en la lista para obtener info
      const room = rooms.find(r => r.id === roomId.trim());
      
      setMessages(msgs);
      setCurrentRoom({
        id: roomId.trim(),
        name: room?.name || 'Sala Privada',
        isPrivate: true,
        memberCount: room?.memberCount ?? 0
      });
      
      // Recargar salas para que aparezca en la lista
      await loadRooms();
      
      setShowJoinPrivate(false);
    } catch (err) {
      console.error('Error al unirse con código:', err);
      alert('❌ Código inválido o no tienes acceso a esta sala');
    } finally {
      setLoading(false);
    }
  }, [rooms, loadRooms]);

  const handleSendMessage = useCallback(async () => {
    if (!messageText.trim() || !currentRoom) return;
    const content = messageText.trim();
    
    try {
      ws.sendMessage(currentRoom.id, content);
      setMessageText('');
    } catch (err) {
      console.error('Error enviando mensaje:', err);
      alert('No se pudo enviar el mensaje');
    }
  }, [messageText, currentRoom]);

  const handleKeyDownMessage = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCreateRoom = async (name, isPrivate) => {
    if (!name.trim()) return;
    
    try {
      const room = await api.createRoom(name.trim(), isPrivate);
      console.log('✅ Sala creada:', room);
      
      // Si es privada, mostrar el código al creador
      if (isPrivate) {
        alert(`✅ Sala privada creada exitosamente!\n\n🔑 Código de acceso:\n${room.id}\n\nComparte este código con quien quieras invitar.`);
      }
      
      // Recargar todas las salas para sincronizar
      await loadRooms();
      
      // Auto-join a la sala creada
      setCurrentRoom({
        id: room.id,
        name: room.name,
        isPrivate: room.isPrivate,
        memberCount: 1
      });
      
      // Cargar historial vacío
      setMessages([]);
      
      // Join via WebSocket
      ws.joinRoom(room.id);
      
      setShowCreateRoom(false);
    } catch (err) {
      console.error('Error al crear sala:', err);
      alert('Error al crear la sala: ' + (err?.message || 'unknown'));
    }
  };

  const handleLogout = () => {
    ws.disconnect();
    api.clearToken();
    onLogout();
  };

  // Botón manual para refrescar salas
  const handleRefreshRooms = async () => {
    setRoomsLoading(true);
    await loadRooms();
    setRoomsLoading(false);
  };

  return (
    <div className="flex h-screen bg-slate-900">
      {/* Sidebar */}
      <div className="w-80 bg-slate-800 border-r border-slate-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-purple-500 to-blue-500 p-2 rounded-lg">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-white font-bold">Chat App</h2>
                <p className="text-xs text-slate-400">@{user.username}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="text-slate-400 hover:text-red-400 transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={() => setShowCreateRoom(true)}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg flex items-center justify-center gap-2 transition-colors mb-2"
          >
            <Plus className="w-4 h-4" />
            Nueva Sala
          </button>

          <button
            onClick={() => setShowJoinPrivate(true)}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm"
          >
            <Lock className="w-4 h-4" />
            Unirse con código
          </button>
        </div>

        {/* Rooms List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-slate-400 text-sm font-semibold flex items-center gap-2">
              <Hash className="w-4 h-4" />
              SALAS
            </h3>
            <button
              onClick={handleRefreshRooms}
              disabled={roomsLoading}
              className="text-slate-400 hover:text-purple-400 transition-colors disabled:opacity-50"
              title="Refrescar salas"
            >
              <RefreshCw className={`w-4 h-4 ${roomsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {roomsLoading && rooms.length === 0 ? (
            <div className="text-slate-400 text-sm">Cargando salas...</div>
          ) : (
            <div className="space-y-2">
              {rooms.map(room => (
                <button
                  key={String(room.id)}
                  onClick={() => handleJoinRoom(room)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-all ${currentRoom?.id === room.id ? 'bg-purple-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {room.isPrivate ? <Lock className="w-4 h-4 flex-shrink-0" /> : <Globe className="w-4 h-4 flex-shrink-0" />}
                      <span className="font-medium truncate">
                        {room.isPrivate ? '🔒 Sala Privada' : room.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs flex-shrink-0">
                      <Users className="w-3 h-3" />
                      <span>{room.memberCount || 0}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {currentRoom ? (
          <>
            {/* Chat Header */}
            <div className="h-16 bg-slate-800 border-b border-slate-700 px-6 flex items-center justify-between">
              <div>
                <h2 className="text-white font-bold text-lg flex items-center gap-2">
                  {currentRoom.isPrivate ? <Lock className="w-5 h-5" /> : <Hash className="w-5 h-5" />}
                  {currentRoom.name}
                </h2>
                <p className="text-slate-400 text-sm">{currentRoom.memberCount || 0} miembros</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-slate-400">Cargando mensajes...</div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-slate-400">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No hay mensajes aún</p>
                    <p className="text-sm">¡Sé el primero en escribir!</p>
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  const sender = msg.user || msg.User || { username: 'Usuario' };
                  const time = msg.timestamp ? new Date(msg.timestamp) : null;
                  const isOwnMessage = sender?.id === user.id || sender?.username === user.username;
                  
                  return (
                    <div 
                      key={msg.id ?? `${msg.timestamp}-${Math.random()}`} 
                      className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${
                        isOwnMessage 
                          ? 'bg-gradient-to-br from-green-500 to-emerald-500' 
                          : 'bg-gradient-to-br from-purple-500 to-blue-500'
                      }`}>
                        {(sender?.username?.[0] || 'U').toUpperCase()}
                      </div>
                      <div className={`flex-1 ${isOwnMessage ? 'text-right' : ''}`}>
                        <div className={`flex items-baseline gap-2 mb-1 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
                          <span className="font-semibold text-white">
                            {isOwnMessage ? 'Tú' : (sender?.username || 'Usuario')}
                          </span>
                          <span className="text-xs text-slate-500">{time ? time.toLocaleTimeString() : ''}</span>
                        </div>
                        <p className={`text-slate-300 ${isOwnMessage ? 'bg-green-900/30 px-3 py-2 rounded-lg inline-block' : ''}`}>
                          {msg.content}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 bg-slate-800 border-t border-slate-700">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={handleKeyDownMessage}
                  placeholder={`Mensaje en #${currentRoom.name}`}
                  className="flex-1 bg-slate-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!messageText.trim()}
                  className="bg-gradient-to-r from-purple-500 to-blue-500 text-white p-3 rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <h3 className="text-xl font-semibold mb-2">Selecciona una sala</h3>
              <p>Elige una sala del panel izquierdo para empezar a chatear</p>
            </div>
          </div>
        )}
      </div>

      {/* Create Room Modal */}
      {showCreateRoom && (
        <CreateRoomModal onClose={() => setShowCreateRoom(false)} onCreate={handleCreateRoom} />
      )}

      {/* Join Private Room Modal */}
      {showJoinPrivate && (
        <JoinPrivateRoomModal onClose={() => setShowJoinPrivate(false)} onJoin={handleJoinWithCode} />
      )}
    </div>
  );
}

function CreateRoomModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  const handleSubmit = () => {
    if (!name.trim()) {
      alert('⚠️ Ingresa un nombre para la sala');
      return;
    }
    
    onCreate(name.trim(), isPrivate);
    setName('');
    setIsPrivate(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700">
        <h3 className="text-xl font-bold text-white mb-4">Crear Nueva Sala</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Nombre de la sala
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-slate-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:outline-none"
              placeholder="mi-sala-genial"
            />
          </div>

          <div className="bg-slate-700/50 p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="private"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="w-5 h-5 mt-1 rounded bg-slate-700 border-slate-600 text-purple-600 focus:ring-2 focus:ring-purple-500"
              />
              <div className="flex-1">
                <label htmlFor="private" className="text-slate-300 cursor-pointer font-medium">
                  Sala privada
                </label>
                <p className="text-xs text-slate-400 mt-1">
                  🔑 Solo usuarios con el código de acceso podrán entrar
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button 
              onClick={onClose} 
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSubmit} 
              className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white py-2 rounded-lg transition-all"
            >
              Crear Sala
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function JoinPrivateRoomModal({ onClose, onJoin }) {
  const [roomCode, setRoomCode] = useState('');

  const handleSubmit = () => {
    if (!roomCode.trim()) {
      alert('⚠️ Ingresa el código de la sala');
      return;
    }
    
    onJoin(roomCode.trim());
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-purple-600 p-2 rounded-lg">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-bold text-white">Unirse a Sala Privada</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Código de acceso
            </label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-slate-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:outline-none font-mono text-sm"
              placeholder="ej: 8d8317bc-d0a8-4c79-b73e-948784667a79"
            />
            <p className="text-xs text-slate-500 mt-2">
              💡 Pídele el código al creador de la sala
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button 
              onClick={onClose} 
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSubmit} 
              className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white py-2 rounded-lg transition-all"
            >
              Unirse
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);

  return user ? <ChatApp user={user} onLogout={() => setUser(null)} /> : <LoginPage onLogin={setUser} />;
}