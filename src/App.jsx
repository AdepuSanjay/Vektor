import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const App = () => {
  const [activeTab, setActiveTab] = useState('chat');
  const [files, setFiles] = useState([]);
  const [currentFile, setCurrentFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [terminalOutput, setTerminalOutput] = useState([]);
  const [terminalCommand, setTerminalCommand] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [projectPath, setProjectPath] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuth, setShowAuth] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [authData, setAuthData] = useState({ name: '', email: '', password: '' });
  const [githubUrl, setGithubUrl] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const chatEndRef = useRef(null);
  const terminalEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const API_BASE = 'http://localhost:8000';

  // WebSocket connections
  const chatWs = useRef(null);
  const terminalWs = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      verifyAuth(token);
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalOutput]);

  const verifyAuth = async (token) => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setIsAuthenticated(true);
        setShowAuth(false);
        initializeSession();
      }
    } catch (error) {
      localStorage.removeItem('token');
    }
  };

  const initializeSession = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/sessions/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ project_path: projectPath })
      });
      const data = await response.json();
      if (data.success) {
        setSessionId(data.session_id);
        setProjectPath(data.project_context?.project_path || '');
        loadFiles();
      }
    } catch (error) {
      console.error('Session initialization failed:', error);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authData)
      });
      
      const data = await response.json();
      if (data.success) {
        localStorage.setItem('token', data.access_token);
        setUser(data.user);
        setIsAuthenticated(true);
        setShowAuth(false);
        initializeSession();
      }
    } catch (error) {
      console.error('Authentication failed:', error);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setIsAuthenticated(false);
    setShowAuth(true);
    setSessionId('');
  };

  const loadFiles = async (path = '') => {
    try {
      const response = await fetch(`${API_BASE}/api/files/operation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'list',
          path: path,
          session_id: sessionId
        })
      });
      const data = await response.json();
      if (data.success) {
        setFiles(data.result.items || []);
      }
    } catch (error) {
      console.error('Failed to load files:', error);
    }
  };

  const readFile = async (filePath) => {
    try {
      const response = await fetch(`${API_BASE}/api/files/operation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'read',
          path: filePath,
          session_id: sessionId
        })
      });
      const data = await response.json();
      if (data.success) {
        setCurrentFile(filePath);
        setFileContent(data.result.content);
      }
    } catch (error) {
      console.error('Failed to read file:', error);
    }
  };

  const saveFile = async () => {
    if (!currentFile) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/files/operation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'update',
          path: currentFile,
          content: fileContent,
          session_id: sessionId
        })
      });
      const data = await response.json();
      if (data.success) {
        console.log('File saved successfully');
      }
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  };

  const createFile = async (fileName) => {
    try {
      const response = await fetch(`${API_BASE}/api/files/operation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'create',
          path: fileName,
          content: '',
          session_id: sessionId
        })
      });
      const data = await response.json();
      if (data.success) {
        loadFiles();
        readFile(fileName);
      }
    } catch (error) {
      console.error('Failed to create file:', error);
    }
  };

  const deleteFile = async (filePath) => {
    try {
      const response = await fetch(`${API_BASE}/api/files/operation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'delete',
          path: filePath,
          session_id: sessionId
        })
      });
      const data = await response.json();
      if (data.success) {
        loadFiles();
        if (currentFile === filePath) {
          setCurrentFile(null);
          setFileContent('');
        }
      }
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  };

  const sendChatMessage = async () => {
    if (!newMessage.trim()) return;

    const message = newMessage;
    setNewMessage('');
    setChatMessages(prev => [...prev, { role: 'user', content: message }]);

    try {
      const response = await fetch(`${API_BASE}/api/chat/with-project`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: message,
          session_id: sessionId,
          project_path: projectPath,
          auto_execute: true
        })
      });
      const data = await response.json();
      if (data.success) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        
        // Reload files if execution was performed
        if (data.execution_performed) {
          loadFiles();
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Error: Failed to process message' 
      }]);
    }
  };

  const executeTerminalCommand = async () => {
    if (!terminalCommand.trim()) return;

    const command = terminalCommand;
    setTerminalCommand('');
    setTerminalOutput(prev => [...prev, `$ ${command}`]);

    try {
      const response = await fetch(`${API_BASE}/api/terminal/execute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          command: command,
          working_dir: projectPath || undefined,
          session_id: sessionId
        })
      });
      const data = await response.json();
      if (data.success) {
        const result = data.result;
        setTerminalOutput(prev => [
          ...prev,
          result.stdout || '',
          result.stderr || '',
          `Exit code: ${result.return_code}`
        ]);
      }
    } catch (error) {
      console.error('Failed to execute command:', error);
      setTerminalOutput(prev => [...prev, 'Error executing command']);
    }
  };

  const cloneGithubRepo = async () => {
    if (!githubUrl.trim()) return;

    try {
      const response = await fetch(`${API_BASE}/api/github/clone`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          repo_url: githubUrl,
          session_id: sessionId
        })
      });
      const data = await response.json();
      if (data.success) {
        setProjectPath(data.local_path);
        loadFiles();
        setGithubUrl('');
        alert('Repository cloned successfully!');
      }
    } catch (error) {
      console.error('Failed to clone repository:', error);
      alert('Failed to clone repository');
    }
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    formData.append('session_id', sessionId);

    try {
      const response = await fetch(`${API_BASE}/api/upload/folder`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      const data = await response.json();
      if (data.success) {
        setUploadedFiles(data.files);
        loadFiles();
        alert('Files uploaded successfully!');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed');
    }
  };

  const implementRequirements = async (requirements) => {
    try {
      const response = await fetch(`${API_BASE}/api/agent/implement-requirements`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requirements: requirements,
          session_id: sessionId,
          project_path: projectPath,
          auto_execute: true
        })
      });
      const data = await response.json();
      if (data.success) {
        setChatMessages(prev => [...prev, 
          { role: 'user', content: requirements },
          { role: 'assistant', content: `Requirements implemented successfully! Files created: ${data.files_created?.length || 0}, Files updated: ${data.files_updated?.length || 0}` }
        ]);
        loadFiles();
      }
    } catch (error) {
      console.error('Implementation failed:', error);
    }
  };

  const quickActions = {
    'Create React Component': 'Create a new React component with TypeScript and CSS',
    'Fix CSS Issues': 'Fix any CSS issues and improve responsiveness',
    'Add API Integration': 'Add API integration with error handling',
    'Optimize Performance': 'Optimize React component performance'
  };

  if (showAuth) {
    return (
      <div className="auth-container">
        <div className="auth-box">
          <h2>{authMode === 'login' ? 'Login' : 'Sign Up'}</h2>
          <form onSubmit={handleAuth}>
            {authMode === 'signup' && (
              <input
                type="text"
                placeholder="Name"
                value={authData.name}
                onChange={(e) => setAuthData({...authData, name: e.target.value})}
                required
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={authData.email}
              onChange={(e) => setAuthData({...authData, email: e.target.value})}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={authData.password}
              onChange={(e) => setAuthData({...authData, password: e.target.value})}
              required
            />
            <button type="submit">{authMode === 'login' ? 'Login' : 'Sign Up'}</button>
          </form>
          <p>
            {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <span 
              className="auth-switch" 
              onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
            >
              {authMode === 'login' ? 'Sign Up' : 'Login'}
            </span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <h1>Cursor AI Clone</h1>
          <span className="session-info">Session: {sessionId?.substring(0, 8)}</span>
        </div>
        <div className="header-right">
          <span>Welcome, {user?.name}</span>
          <button onClick={logout} className="logout-btn">Logout</button>
        </div>
      </header>

      <div className="main-container">
        {/* Left Sidebar - File Explorer */}
        <div className="sidebar left-sidebar">
          <div className="sidebar-section">
            <h3>File Explorer</h3>
            <div className="file-actions">
              <button onClick={() => createFile(prompt('Enter file name:'))}>
                New File
              </button>
              <input
                type="file"
                ref={fileInputRef}
                multiple
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <button onClick={() => fileInputRef.current?.click()}>
                Upload Files
              </button>
            </div>
            
            <div className="github-section">
              <input
                type="text"
                placeholder="GitHub URL"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
              />
              <button onClick={cloneGithubRepo}>Clone</button>
            </div>
          </div>

          <div className="file-tree">
            {files.map((file, index) => (
              <div key={index} className="file-item">
                <span 
                  className={`file-icon ${file.type}`}
                  onClick={() => file.type === 'directory' ? loadFiles(file.path) : readFile(file.path)}
                >
                  {file.type === 'directory' ? '📁' : '📄'} {file.name}
                </span>
                {file.type === 'file' && (
                  <button 
                    className="delete-btn"
                    onClick={() => deleteFile(file.path)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Center - Code Editor / Terminal */}
        <div className="main-content">
          <div className="tabs">
            <button 
              className={activeTab === 'editor' ? 'active' : ''}
              onClick={() => setActiveTab('editor')}
            >
              Code Editor
            </button>
            <button 
              className={activeTab === 'terminal' ? 'active' : ''}
              onClick={() => setActiveTab('terminal')}
            >
              Terminal
            </button>
          </div>

          {activeTab === 'editor' && (
            <div className="editor-container">
              <div className="editor-header">
                <span>{currentFile || 'No file selected'}</span>
                {currentFile && (
                  <button onClick={saveFile}>Save</button>
                )}
              </div>
              <textarea
                className="code-editor"
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                placeholder="Select a file to edit..."
                spellCheck={false}
              />
            </div>
          )}

          {activeTab === 'terminal' && (
            <div className="terminal-container">
              <div className="terminal-output">
                {terminalOutput.map((line, index) => (
                  <div key={index} className="terminal-line">{line}</div>
                ))}
                <div ref={terminalEndRef} />
              </div>
              <div className="terminal-input">
                <span>$</span>
                <input
                  type="text"
                  value={terminalCommand}
                  onChange={(e) => setTerminalCommand(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && executeTerminalCommand()}
                  placeholder="Enter command..."
                />
                <button onClick={executeTerminalCommand}>Run</button>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Chat */}
        <div className="sidebar right-sidebar">
          <div className="chat-container">
            <div className="chat-header">
              <h3>AI Assistant</h3>
              <div className="quick-actions">
                {Object.entries(quickActions).map(([action, desc]) => (
                  <button
                    key={action}
                    className="quick-action-btn"
                    onClick={() => implementRequirements(desc)}
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="chat-messages">
              {chatMessages.map((message, index) => (
                <div key={index} className={`message ${message.role}`}>
                  <div className="message-content">
                    {message.content}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            
            <div className="chat-input">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendChatMessage();
                  }
                }}
                placeholder="Ask me to build, fix, or explain code..."
                rows={3}
              />
              <button onClick={sendChatMessage}>Send</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;