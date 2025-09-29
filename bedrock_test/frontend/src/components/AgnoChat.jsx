import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, FileText, Download, Loader2, Bot, User, X, ChevronRight } from 'lucide-react';

const AgnoChat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState('team');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [artifacts, setArtifacts] = useState([]);
  const [showArtifacts, setShowArtifacts] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const wsRef = useRef(null);

  const API_BASE = 'http://localhost:8000';

  const agents = [
    { id: 'team', name: 'Team', desc: 'Coordinated specialists' },
    { id: 'research', name: 'Research', desc: 'Web search & info' },
    { id: 'analyze', name: 'Analysis', desc: 'Data & calculations' },
    { id: 'general', name: 'General', desc: 'AI assistant' }
  ];

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    fetchArtifacts();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchArtifacts = async () => {
    try {
      const res = await fetch(`${API_BASE}/artifacts`);
      const data = await res.json();
      setArtifacts(data.files || []);
    } catch (err) {
      console.error('Error fetching artifacts:', err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      setUploadedFile(data.filename);
      setMessages(prev => [...prev, {
        role: 'system',
        content: `📎 Uploaded: ${data.filename}`
      }]);
    } catch (err) {
      console.error('Upload error:', err);
    }
  };

  const handleSend = async () => {
    if (!input.trim() && !uploadedFile) return;

    const userMessage = {
      role: 'user',
      content: input,
      file: uploadedFile
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const assistantMessage = {
      role: 'assistant',
      content: '',
      isStreaming: true
    };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      const ws = new WebSocket(`${API_BASE.replace('http', 'ws')}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          agent_type: selectedAgent,
          query: input,
          session_id: 'user-session-1',
          attached_file: uploadedFile
        }));
      };

      ws.onmessage = (event) => {
        const chunk = event.data;
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg.role === 'assistant') {
            lastMsg.content += chunk;
          }
          return newMessages;
        });
      };

      ws.onclose = () => {
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg.role === 'assistant') {
            lastMsg.isStreaming = false;
          }
          return newMessages;
        });
        setIsLoading(false);
        setUploadedFile(null);
        fetchArtifacts();
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        setIsLoading(false);
      };
    } catch (err) {
      console.error('Send error:', err);
      setIsLoading(false);
    }
  };

  const handleDownload = async (filename) => {
    try {
      const res = await fetch(`${API_BASE}/download/${filename}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm">
        <div className="p-6 border-b border-slate-200">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Agno AI
          </h1>
          <p className="text-xs text-slate-500 mt-1">Multi-Agent System</p>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3 block">
            Select Agent
          </label>
          <div className="space-y-2">
            {agents.map(agent => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(agent.id)}
                className={`w-full text-left p-3 rounded-lg transition-all ${
                  selectedAgent === agent.id
                    ? 'bg-indigo-50 border-2 border-indigo-500 shadow-sm'
                    : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100'
                }`}
              >
                <div className="font-semibold text-sm text-slate-800">{agent.name}</div>
                <div className="text-xs text-slate-500 mt-1">{agent.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setShowArtifacts(!showArtifacts)}
          className="m-4 p-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:from-indigo-600 hover:to-purple-600 transition-all shadow-md flex items-center justify-center gap-2"
        >
          <FileText size={18} />
          <span className="font-medium">Artifacts ({artifacts.length})</span>
        </button>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <Bot size={40} className="text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-3">
                  Welcome to Agno AI
                </h2>
                <p className="text-slate-600">
                  Choose an agent and start chatting. Upload files, generate artifacts, and get intelligent assistance.
                </p>
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0 shadow-md">
                  <Bot size={18} className="text-white" />
                </div>
              )}
              
              <div
                className={`max-w-3xl rounded-2xl px-6 py-4 shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : msg.role === 'system'
                    ? 'bg-amber-50 text-amber-900 border border-amber-200'
                    : 'bg-white text-slate-800 border border-slate-200'
                }`}
              >
                {msg.file && (
                  <div className="flex items-center gap-2 text-sm mb-2 pb-2 border-b border-indigo-400">
                    <Paperclip size={14} />
                    <span>{msg.file}</span>
                  </div>
                )}
                <div className="prose prose-sm max-w-none">
                  {msg.content}
                  {msg.isStreaming && (
                    <span className="inline-block w-2 h-4 bg-slate-400 ml-1 animate-pulse" />
                  )}
                </div>
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 shadow-md">
                  <User size={18} className="text-white" />
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-slate-200 bg-white p-4 shadow-lg">
          {uploadedFile && (
            <div className="mb-3 flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg">
              <Paperclip size={16} />
              <span className="text-sm flex-1">{uploadedFile}</span>
              <button
                onClick={() => setUploadedFile(null)}
                className="text-indigo-400 hover:text-indigo-600"
              >
                <X size={16} />
              </button>
            </div>
          )}
          
          <div className="flex gap-3">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              className="hidden"
            />
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-3 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors"
              disabled={isLoading}
            >
              <Paperclip size={20} className="text-slate-600" />
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Message Agno AI..."
              disabled={isLoading}
              className="flex-1 px-6 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 transition-colors"
            />

            <button
              onClick={handleSend}
              disabled={isLoading || (!input.trim() && !uploadedFile)}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md flex items-center gap-2"
            >
              {isLoading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Send size={20} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Artifacts Panel */}
      {showArtifacts && (
        <div className="w-80 bg-white border-l border-slate-200 flex flex-col shadow-lg">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-800">Artifacts</h3>
            <button
              onClick={() => setShowArtifacts(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={20} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {artifacts.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">
                No artifacts yet
              </p>
            ) : (
              artifacts.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors group"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText size={18} className="text-indigo-500 flex-shrink-0" />
                    <span className="text-sm text-slate-700 truncate">{file}</span>
                  </div>
                  <button
                    onClick={() => handleDownload(file)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-500 hover:text-indigo-700"
                  >
                    <Download size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AgnoChat;