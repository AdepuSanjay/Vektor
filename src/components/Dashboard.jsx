import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Dashboard = ({ user, onLogout }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchUserSessions();
  }, []);

  const fetchUserSessions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/sessions/user-sessions', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const createNewSession = async (projectType = 'blank') => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/sessions/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          project_path: projectType === 'blank' ? null : `project_${Date.now()}`
        })
      });

      if (response.ok) {
        const data = await response.json();
        navigate(`/workspace/${data.session_id}`);
      }
    } catch (error) {
      console.error('Error creating session:', error);
    }
  };

  const openSession = (sessionId) => {
    navigate(`/workspace/${sessionId}`);
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>AI Code Assistant</h1>
        <div className="user-info">
          <span>Welcome, {user.name}</span>
          <button className="logout-button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="quick-actions">
          <div 
            className="action-card" 
            onClick={() => createNewSession('blank')}
          >
            <h3>New Blank Project</h3>
            <p>Start with a clean slate and build your project from scratch</p>
          </div>
          
          <div 
            className="action-card"
            onClick={() => createNewSession('react')}
          >
            <h3>React Project</h3>
            <p>Start with a React template and AI-powered development</p>
          </div>
          
          <div 
            className="action-card"
            onClick={() => createNewSession('node')}
          >
            <h3>Node.js Project</h3>
            <p>Begin with a Node.js backend setup and AI assistance</p>
          </div>
        </div>

        <div className="sessions-section">
          <h2>Your Sessions</h2>
          {loading ? (
            <div className="loading">
              <div className="spinner"></div>
              <p>Loading sessions...</p>
            </div>
          ) : sessions.length > 0 ? (
            <div className="sessions-grid">
              {sessions.map((session) => (
                <div key={session.session_id} className="session-card">
                  <h4>Session {session.session_id.slice(0, 8)}</h4>
                  <p>Created: {new Date(session.created_at).toLocaleDateString()}</p>
                  <p>Project: {session.project_path || 'No project'}</p>
                  <button 
                    className="open-session-button"
                    onClick={() => openSession(session.session_id)}
                  >
                    Open Session
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-sessions">
              <p>No active sessions. Create a new project to get started!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Workspace Component
const Workspace = ({ user, onLogout }) => {
  const [files, setFiles] = useState([]);
  const [currentFile, setCurrentFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [terminalVisible, setTerminalVisible] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState([]);
  const [terminalInput, setTerminalInput] = useState('');
  const [wsTerminal, setWsTerminal] = useState(null);
  const [wsChat, setWsChat] = useState(null);
  const [diffPreview, setDiffPreview] = useState(null);
  const [sessionId] = useState(window.location.pathname.split('/').pop());

  useEffect(() => {
    initializeWorkspace();
    return () => {
      if (wsTerminal) wsTerminal.close();
      if (wsChat) wsChat.close();
    };
  }, []);

  const initializeWorkspace = async () => {
    await loadFiles();
    setupWebSockets();
  };

  const loadFiles = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/files/operation', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'list',
          path: '',
          session_id: sessionId
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setFiles(data.result.items || []);
      }
    } catch (error) {
      console.error('Error loading files:', error);
    }
  };

  const setupWebSockets = () => {
    // Terminal WebSocket
    const terminalWs = new WebSocket(`ws://localhost:8000/ws/terminal/${sessionId}`);
    terminalWs.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setTerminalOutput(prev => [...prev, `$ ${data.command}`, data.output]);
    };
    setWsTerminal(terminalWs);

    // Chat WebSocket
    const chatWs = new WebSocket(`ws://localhost:8000/ws/chat/${sessionId}`);
    chatWs.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'response') {
        setChatMessages(prev => [...prev, {
          type: 'assistant',
          content: data.response.response
        }]);
      }
    };
    setWsChat(chatWs);
  };

  const handleFileSelect = async (file) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/files/operation', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'read',
          path: file.path,
          session_id: sessionId
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setCurrentFile(file);
        setFileContent(data.result.content);
      }
    } catch (error) {
      console.error('Error reading file:', error);
    }
  };

  const saveFile = async () => {
    if (!currentFile) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/files/operation', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'update',
          path: currentFile.path,
          content: fileContent,
          session_id: sessionId
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.result.diff_id) {
          setDiffPreview(data.result);
        }
      }
    } catch (error) {
      console.error('Error saving file:', error);
    }
  };

  const applyDiff = async (diffId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8000/api/files/apply-diff/${diffId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        setDiffPreview(null);
        await loadFiles();
      }
    } catch (error) {
      console.error('Error applying diff:', error);
    }
  };

  const handleChatSubmit = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = {
      type: 'user',
      content: chatInput
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    
    if (wsChat && wsChat.readyState === WebSocket.OPEN) {
      wsChat.send(JSON.stringify({
        type: 'message',
        message: chatInput,
        session_id: sessionId
      }));
    }
    
    setChatInput('');
  };

  const handleTerminalCommand = (e) => {
    e.preventDefault();
    if (!terminalInput.trim()) return;

    if (wsTerminal && wsTerminal.readyState === WebSocket.OPEN) {
      wsTerminal.send(JSON.stringify({
        type: 'command',
        command: terminalInput
      }));
    }
    
    setTerminalInput('');
  };

  const executeAIAction = async (action) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/chat/with-project', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: action,
          session_id: sessionId,
          auto_execute: true
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setChatMessages(prev => [...prev, {
          type: 'user',
          content: action
        }, {
          type: 'assistant',
          content: data.response
        }]);
        
        if (data.execution_performed) {
          await loadFiles();
        }
      }
    } catch (error) {
      console.error('Error executing AI action:', error);
    }
  };

  return (
    <div className="workspace">
      {/* Diff Preview Modal */}
      {diffPreview && (
        <div className="diff-modal">
          <div className="diff-content">
            <div className="diff-header">
              <h3>Changes Preview - {diffPreview.path}</h3>
              <p>Review the changes before applying</p>
            </div>
            <div className="diff-body">
              {diffPreview.diff_content.split('\n').map((line, index) => (
                <div 
                  key={index}
                  className={`diff-line ${
                    line.startsWith('+') ? 'diff-added' :
                    line.startsWith('-') ? 'diff-removed' : 'diff-context'
                  }`}
                >
                  {line}
                </div>
              ))}
            </div>
            <div className="diff-actions">
              <button 
                className="diff-button diff-cancel"
                onClick={() => setDiffPreview(null)}
              >
                Cancel
              </button>
              <button 
                className="diff-button diff-apply"
                onClick={() => applyDiff(diffPreview.diff_id)}
              >
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="sidebar">
        <div className="sidebar-header">
          <h3>Workspace</h3>
          <p>Session: {sessionId.slice(0, 8)}</p>
        </div>
        
        <div className="file-tree">
          {files.map(file => (
            <div 
              key={file.path}
              className={`file-item ${currentFile?.path === file.path ? 'active' : ''}`}
              onClick={() => handleFileSelect(file)}
            >
              <span className="file-icon">
                {file.type === 'directory' ? '📁' : '📄'}
              </span>
              {file.name}
            </div>
          ))}
        </div>

        <div style={{ padding: '20px', borderTop: '1px solid #3e3e42' }}>
          <h4 style={{ color: '#cccccc', marginBottom: '10px' }}>Quick Actions</h4>
          <button 
            style={{
              width: '100%',
              padding: '10px',
              marginBottom: '8px',
              background: '#007acc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
            onClick={() => executeAIAction('Analyze the current project structure and suggest improvements')}
          >
            Analyze Project
          </button>
          <button 
            style={{
              width: '100%',
              padding: '10px',
              marginBottom: '8px',
              background: '#007acc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
            onClick={() => executeAIAction('Check for any bugs or issues in the code')}
          >
            Check for Bugs
          </button>
        </div>
      </div>

      <div className="main-content">
        <div className="editor-header">
          <h3>{currentFile ? currentFile.name : 'Select a file'}</h3>
          <div>
            {currentFile && (
              <button 
                style={{
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginRight: '10px'
                }}
                onClick={saveFile}
              >
                Save File
              </button>
            )}
            <button 
              className="terminal-toggle"
              onClick={() => setTerminalVisible(!terminalVisible)}
            >
              {terminalVisible ? 'Hide Terminal' : 'Show Terminal'}
            </button>
          </div>
        </div>

        <div className="editor-container">
          <div className="code-editor">
            {currentFile ? (
              <textarea
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                placeholder="Start coding..."
              />
            ) : (
              <div style={{ 
                color: '#666', 
                textAlign: 'center', 
                padding: '40px',
                fontStyle: 'italic'
              }}>
                Select a file from the sidebar to start editing
              </div>
            )}
          </div>

          <div className="chat-panel">
            <div className="chat-messages">
              {chatMessages.map((message, index) => (
                <div key={index} className={`message ${message.type}`}>
                  {message.content}
                </div>
              ))}
            </div>
            <div className="chat-input">
              <form onSubmit={handleChatSubmit}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask AI to help with your code..."
                />
                <button type="submit">Send</button>
              </form>
            </div>
          </div>
        </div>

        {terminalVisible && (
          <div className="terminal-panel">
            <div className="terminal-header">
              <span>Terminal</span>
            </div>
            <div className="terminal-content">
              {terminalOutput.map((line, index) => (
                <div key={index} style={{ fontFamily: 'Courier New, monospace' }}>
                  {line}
                </div>
              ))}
            </div>
            <form className="terminal-input" onSubmit={handleTerminalCommand}>
              <span style={{ color: '#0f0', padding: '8px' }}>$</span>
              <input
                type="text"
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                placeholder="Enter command..."
              />
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;