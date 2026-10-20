import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') ||
                   import.meta.env.VITE_SOCKET_URL ||
                   window.location.origin;

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 5,
  reconnectionDelay: 2000,
});

export const connectSocket = (userId?: string | null) => {
  if (!userId || typeof userId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(userId)) {
    return;
  }
  if (!socket.connected) {
    socket.connect();
    socket.off('connect');
    socket.on('connect', () => {
      socket.emit('register', userId);
    });
  } else {
    socket.emit('register', userId);
  }
};

export const disconnectSocket = () => {
  if (socket.connected) socket.disconnect();
};

export const onNewMessage = (cb: (msg: any) => void) => {
  socket.off('new_message').on('new_message', cb);
};

export const onNewNotification = (cb: (notif: any) => void) => {
  socket.off('notification').on('notification', cb);
};
