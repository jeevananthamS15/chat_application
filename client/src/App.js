import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import './App.css'; 
const API_URL = 'http://localhost:5000'; 
let socket;

const decodeJwt = (token) => {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
};

function App() {
  const [user, setUser] = useState(null); 
  const [room, setRoom] = useState(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [authMode, setAuthMode] = useState('login');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');



  const handleLogout = () => {
    localStorage.removeItem('token');
    if (socket) {
      socket.disconnect();
    }
    setUser(null);
    setRoom(null);
    setMessages([]);
    setUsernameInput('');
    setPasswordInput('');
  };

  const handleLoginRegister = async () => {
    try {
      const endpoint = authMode === 'login' ? 'login' : 'register';
      const response = await axios.post(`${API_URL}/api/auth/${endpoint}`, {
        username: usernameInput,
        password: passwordInput,
      });

      const { token, username } = response.data;
      
      localStorage.setItem('token', token);
      setUser({ username, token });
      setUsernameInput('');
      setPasswordInput('');
    } catch (error) {
      const msg = error.response?.data?.msg || 'An unknown error occurred.';
      alert(`Error: ${msg}`);
      console.error(`${authMode} failed:`, error);
    }
  };
  
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
        const decoded = decodeJwt(token);
        if (decoded && decoded.user) {
            setUser({ username: decoded.user.username, token });
        } else {
            localStorage.removeItem('token'); 
        }
    }
  }, []);


  const fetchRoomHistory = useCallback(async (roomName, token) => {
    try {
      const response = await axios.get(`${API_URL}/api/messages/${roomName}`, {
        headers: { 'x-auth-token': token },
      });
      setMessages(response.data);
    } catch (error) {
      console.error('Failed to fetch chat history:', error);
   
      if (error.response?.status === 401) {
        alert('Session expired or unauthorized. Please log in again.');
        handleLogout();
      }
    }
  }, []);


  useEffect(() => {
    if (user && room) {
     
      socket = io(API_URL, {
        query: { token: user.token } 
      });

      socket.on('connect_error', (err) => {
        console.error("Socket Connection Error:", err.message);
    
        if (err.message.includes('Authentication error')) {
            alert('Real-time connection failed. Token invalid/expired.');
            handleLogout();
        }
      });
      
      socket.emit('joinRoom', room);


      socket.on('message', (message) => {
        setMessages((prevMessages) => [...prevMessages, message]);
      });
      

      socket.on('typing', ({ user: typingUser, isTyping }) => {
        setTypingUsers(prev => {
          if (isTyping && !prev.includes(typingUser)) {
            return [...prev, typingUser];
          }
          if (!isTyping && prev.includes(typingUser)) {
            return prev.filter(u => u !== typingUser);
          }
          return prev;
        });
      });

      
      fetchRoomHistory(room, user.token);

   
      return () => {
        socket.disconnect();
      };
    }
  }, [user, room, fetchRoomHistory]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (message.trim() && user && room) {
     
      const newMessage = { room, text: message }; 
      socket.emit('sendMessage', newMessage);
      setMessage('');
      

      socket.emit('typing', { room, isTyping: false });
    }
  };
  
  const handleTypingChange = (e) => {
      setMessage(e.target.value);
      if (socket && user && room) {
  
          const isCurrentlyTyping = e.target.value.length > 0;
    
          socket.emit('typing', { room, isTyping: isCurrentlyTyping });
      }
  };

  const handleJoinRoom = (roomName) => {
    setMessages([]); 
    setTypingUsers([]); 
    setRoom(roomName);
  }


  if (!user) {
    return (
      <div className="auth-container">
        <h2>{authMode === 'login' ? 'Login' : 'Register'}</h2>
        <input 
          type="text" 
          value={usernameInput} 
          onChange={(e) => setUsernameInput(e.target.value)} 
          placeholder="Username" 
          required 
        />
        <input 
          type="password" 
          value={passwordInput} 
          onChange={(e) => setPasswordInput(e.target.value)} 
          placeholder="Password" 
          required 
        />
        <button onClick={handleLoginRegister} disabled={!usernameInput || !passwordInput}>
          {authMode === 'login' ? 'Login' : 'Register'}
        </button>
        <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
          {authMode === 'login' ? 'Need an account? Register' : 'Have an account? Login'}
        </button>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="room-list-container">
        <h2>Welcome, {user.username}! Choose a Chat Room</h2>
        <ul>
          <li><button onClick={() => handleJoinRoom('General')}>Join General Chat</button></li>
          <li><button onClick={() => handleJoinRoom('Tech')}>Join Tech Talk</button></li>
          <li><button onClick={() => handleJoinRoom('Random')}>Join Random Room</button></li>
        </ul>
        <button onClick={handleLogout}>Logout</button>
      </div>
    );
  }

  
  const otherTypingUsers = typingUsers.filter(u => u !== user.username);
  const typingIndicatorText = otherTypingUsers.length > 0 
    ? (otherTypingUsers.length === 1 ? `${otherTypingUsers[0]} is typing...` : 'Multiple users are typing...')
    : '';

  return (
    <div className="chat-container">
      <div className="chat-header">
        <span>Room: **{room}**</span>
        <div>
          <button onClick={() => setRoom(null)}>Back to Rooms</button>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </div>
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="empty">No messages yet in **{room}**. Say hello!</div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={msg.user === user.username ? 'my-message' : 'other-message'}>
              <span className="message-user">**{msg.user}**:</span> {msg.text}
              <span className="message-timestamp">{new Date(msg.timestamp).toLocaleTimeString()}</span>
            </div>
          ))
        )}
      </div>
      {typingIndicatorText && <div className="typing-indicator">{typingIndicatorText}</div>}
      <form className="chat-input" onSubmit={handleSendMessage}>
        <input
          type="text"
          value={message}
          onChange={handleTypingChange}
          placeholder={`Message ${room}...`}
        />
        <button type="submit" disabled={!message}>Send</button>
      </form>
    </div>
  );
}

export default App;