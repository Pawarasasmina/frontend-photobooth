import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { Camera, Download, Smartphone, Wifi, WifiOff, CheckCircle, Zap, Image, Share2, RefreshCw, Power } from 'lucide-react';
import io from 'socket.io-client';
import bgframe from '../assets/bgframe.png';

const MobileInterface = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // connecting, connected, disconnected, error
  const [capturedImage, setCapturedImage] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState(null); // null or number
  const [error, setError] = useState('');
  const [captureCount, setCaptureCount] = useState(0);
  const [connectionTime, setConnectionTime] = useState(null);

  // Connect to session
  useEffect(() => {
    if (!sessionId) {
      setError('Invalid session ID');
      return;
    }

    const newSocket = io('/', {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
      newSocket.emit('join_mobile_session', { session_id: sessionId });
    });

    newSocket.on('mobile_joined', (data) => {
      console.log('Mobile joined session:', data);
      setConnectionStatus('connected');
      setConnectionTime(new Date());
      setError('');
    });

    newSocket.on('image_received', (data) => {
      console.log('Image received:', data);
      setCapturedImage(data.image_data);
      setIsCapturing(false);
      setCaptureCount(prev => prev + 1);
  setError(''); // Clear any previous error on successful capture
    });

    newSocket.on('session_ended', () => {
      console.log('Session ended by PC');
      setConnectionStatus('disconnected');
      setError('Session ended by the desktop computer');
      setTimeout(() => {
        navigate('/');
      }, 3000);
    });

    newSocket.on('error', (data) => {
      console.error('Socket error:', data);
      setError(data.message || 'Connection error');
      setConnectionStatus('error');
      setIsCapturing(false); // Reset capturing state if error received
    });

    // Listen for webcam error from desktop and reset capturing state
    newSocket.on('webcam_error', (data) => {
      setError(data.message || 'Webcam error');
      setIsCapturing(false);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnectionStatus('disconnected');
    });

    setSocket(newSocket);

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [sessionId, navigate]);

  // Request image capture
  const requestCapture = () => {
    if (!socket || connectionStatus !== 'connected') {
      setError('Not connected to desktop');
      return;
    }

    setCountdown(3);
    setCapturedImage(null);
    let count = 3;
    const interval = setInterval(() => {
      setCountdown(count);
      if (count === 1) {
        clearInterval(interval);
        setCountdown(null);
        setIsCapturing(true);
        socket.emit('capture_request', { session_id: sessionId });
      }
      count--;
    }, 1000);
  };

  // Download captured image
  const downloadImage = () => {
    if (!capturedImage) return;

    const link = document.createElement('a');
    link.href = capturedImage;
    link.download = `qr-camera-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Share image (if supported)
  const shareImage = async () => {
    if (!capturedImage) return;

    try {
      // Convert base64 to blob
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      const file = new File([blob], `qr-camera-${Date.now()}.jpg`, { type: 'image/jpeg' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'QR Camera Photo',
          text: 'Photo captured with QR Camera Station',
          files: [file]
        });
      } else {
        // Fallback to download
        downloadImage();
      }
    } catch (err) {
      console.error('Error sharing image:', err);
      downloadImage();
    }
  };

  // End session
  const endSession = () => {
    if (socket) {
      socket.emit('end_session', { session_id: sessionId });
    }
    navigate('/');
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <Wifi className="w-5 h-5 text-emerald-500" />;
      case 'connecting': return (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"
        />
      );
      case 'disconnected': 
      case 'error': return <WifiOff className="w-5 h-5 text-red-500" />;
      default: return <WifiOff className="w-5 h-5 text-slate-500" />;
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected to Desktop';
      case 'connecting': return 'Connecting...';
      case 'disconnected': return 'Disconnected';
      case 'error': return 'Connection Error';
      default: return 'Unknown Status';
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-emerald-600';
      case 'connecting': return 'text-blue-600';
      case 'disconnected': 
      case 'error': return 'text-red-600';
      default: return 'text-slate-600';
    }
  };

  return (
    <>
      {countdown !== null && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <span style={{
            color: '#fff',
            fontSize: '5rem',
            fontWeight: 'bold',
            textShadow: '0 2px 8px #000'
          }}>{countdown}</span>
        </div>
      )}
      <StyledWrapper>
        <div className="brutalist-header">
          <div className="brutalist-header__icon">
            <Smartphone />
          </div>
          <h1 className="brutalist-header__title">Mobile Camera Remote</h1>
        </div>
        <p className="brutalist-header__desc">
          Control the desktop camera from your mobile device
        </p>
        <div className="brutalist-main">
          <div className="brutalist-card">
            <div className="brutalist-card__header">
              <div className="brutalist-card__icon">{getStatusIcon()}</div>
              <div className="brutalist-card__alert">{getStatusText()}</div>
            </div>
            <div className="brutalist-card__message">
              {connectionTime && connectionStatus === 'connected' && (
                <div className="brutalist-card__info">Connected at {connectionTime.toLocaleTimeString()}</div>
              )}
              {sessionId && (
                <div className="brutalist-card__info">Session: <span className="brutalist-session__id">{sessionId.slice(0, 8)}...</span></div>
              )}
              {captureCount > 0 && (
                <div className="brutalist-card__captures">
                  <Image style={{ marginRight: 8 }} />
                  <span className="brutalist-card__captures-count">{captureCount}</span> photos captured
                </div>
              )}
              {error && (
                <div className="brutalist-card__error">
                  <WifiOff style={{ marginRight: 8 }} />
                  {error}
                </div>
              )}
            </div>
          </div>
          {!capturedImage && (
            <div className="brutalist-card">
              <div className="brutalist-card__header">
                <div className="brutalist-card__icon"><Camera /></div>
                <div className="brutalist-card__alert">Camera Control</div>
              </div>
              <div className="brutalist-card__message">
                <a
                  className={`brutalist-card__button brutalist-card__button--mark${connectionStatus !== 'connected' || isCapturing || countdown !== null ? ' brutalist-card__button--disabled' : ''}`}
                  href="#"
                  onClick={e => {e.preventDefault(); requestCapture();}}
                  style={{ pointerEvents: connectionStatus !== 'connected' || isCapturing || countdown !== null ? 'none' : 'auto', opacity: connectionStatus !== 'connected' || isCapturing || countdown !== null ? 0.5 : 1 }}
                >
                  {isCapturing ? <Zap style={{ marginRight: 8 }} /> : <Camera style={{ marginRight: 8 }} />}
                  {isCapturing ? 'Capturing...' : countdown !== null ? `Wait...` : 'Capture Photo'}
                </a>
                <div className="brutalist-card__info">
                  {connectionStatus === 'connected'
                    ? "📸 Tap the button above to capture a photo from the desktop camera"
                    : "🔗 Connect to desktop to start capturing photos"}
                </div>
              </div>
            </div>
          )}
          {capturedImage && (
            <div className="brutalist-card">
              <div className="brutalist-card__header">
                <div className="brutalist-card__icon"><CheckCircle /></div>
                <div className="brutalist-card__alert">Captured Photo</div>
              </div>
              <div className="brutalist-card__message">
                <img src={capturedImage} alt="Captured" className="brutalist-card__qr" />
                <div className="brutalist-card__actions" style={{ display: 'flex', gap: '0.5rem' }}>
                  <a className="brutalist-card__button brutalist-card__button--mark" href="#" onClick={e => {e.preventDefault(); downloadImage();}}>
                    <Download style={{ marginRight: 8 }} /> Download
                  </a>
                  <a className="brutalist-card__button brutalist-card__button--read" href="#" onClick={async e => {e.preventDefault(); await shareImage();}}>
                    <Share2 style={{ marginRight: 8 }} /> Share
                  </a>
                </div>
                <div className="brutalist-card__info" style={{ background: '#e6fff7', color: '#008060', padding: '0.5rem', borderRadius: '8px', marginTop: '1rem' }}>
                  ✨ Photo captured successfully! You can download it or capture another one.
                </div>
              </div>
            </div>
          )}
          <div className="brutalist-card">
            <div className="brutalist-card__header">
              <div className="brutalist-card__icon"><Power /></div>
              <div className="brutalist-card__alert">Session Controls</div>
            </div>
            <div className="brutalist-card__message">
              <div className="brutalist-card__actions">
                <a className={`brutalist-card__button brutalist-card__button--mark${connectionStatus === 'connecting' ? ' brutalist-card__button--disabled' : ''}`} href="#" onClick={e => {e.preventDefault(); window.location.reload();}} style={{ pointerEvents: connectionStatus === 'connecting' ? 'none' : 'auto', opacity: connectionStatus === 'connecting' ? 0.5 : 1 }}>
                  <RefreshCw style={{ marginRight: 8 }} /> Reconnect
                </a>
                <a className="brutalist-card__button brutalist-card__button--read" href="#" onClick={e => {e.preventDefault(); endSession();}}>
                  <Power style={{ marginRight: 8 }} /> End Session
                </a>
              </div>
              <div className="brutalist-card__info" style={{ fontSize: '0.95rem', color: '#555', marginTop: '1rem' }}>
                🕒 Session will automatically expire after 5 minutes of inactivity<br />📱 Keep this tab open to maintain connection
              </div>
            </div>
          </div>
        </div>
      </StyledWrapper>
    </>
  );
};


const StyledWrapper = styled.div`
  min-height: 100vh;
  background: #fff;
  padding: 2rem;
  font-family: 'Space Grotesk', Arial, Helvetica, sans-serif;
  h1, h2, h3, h4, h5, h6 {
    font-family: 'Recursive', Arial, Helvetica, sans-serif;
    font-weight: 900;
  }
  .brutalist-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.5rem;
    .brutalist-header__icon {
      background: #000;
      padding: 0.5rem;
      border-radius: 8px;
      svg {
        color: #fff;
        width: 2rem;
        height: 2rem;
      }
    }
    .brutalist-header__title {
      font-size: 2rem;
      font-weight: 900;
      color: #000;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
  }
  .brutalist-header__desc {
    font-size: 1rem;
    color: #222;
    margin-bottom: 2rem;
    font-weight: 600;
  }
  .brutalist-main {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
    margin-bottom: 2rem;
  }
  .brutalist-card {
    border: 4px solid #000;
    background: #fff;
    box-shadow: 10px 10px 0 #000;
    padding: 1.5rem;
    margin-bottom: 1rem;
    border-radius: 12px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    .brutalist-card__header {
      display: flex;
      align-items: center;
      gap: 1rem;
      border-bottom: 2px solid #000;
      padding-bottom: 1rem;
      margin-bottom: 1rem;
      .brutalist-card__icon {
        background: #000;
        padding: 0.5rem;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        svg {
          color: #fff;
          width: 1.5rem;
          height: 1.5rem;
        }
      }
      .brutalist-card__alert {
        font-weight: 900;
        color: #000;
        font-size: 1.1rem;
        text-transform: uppercase;
      }
    }
    .brutalist-card__message {
      color: #000;
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 1rem;
      border-bottom: 2px solid #000;
      padding-bottom: 1rem;
      .brutalist-card__error {
        color: #ff0000;
        font-weight: bold;
        margin-top: 0.5rem;
        display: flex;
        align-items: center;
      }
      .brutalist-card__qr {
        display: block;
        margin: 0.5rem auto;
        border: 4px solid #000;
        border-radius: 8px;
        box-shadow: 5px 5px 0 #000;
        width: 180px;
        height: 180px;
        object-fit: contain;
      }
      .brutalist-card__info {
        margin-top: 1rem;
        color: #296fbb;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .brutalist-card__last-capture {
        font-size: 0.9rem;
        color: #555;
        margin-top: 0.5rem;
      }
      .brutalist-card__captures {
        margin-top: 1rem;
        font-size: 1rem;
        color: #000;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        .brutalist-card__captures-count {
          font-size: 1.1rem;
          color: #296fbb;
          font-weight: 900;
          margin-right: 0.5rem;
        }
      }
    }
    .brutalist-card__actions {
      margin-top: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      .brutalist-card__button {
        display: block;
        width: 100%;
        padding: 0.75rem;
        text-align: center;
        font-size: 1rem;
        font-weight: 700;
        text-transform: uppercase;
        border: 3px solid #000;
        background: #fff;
        color: #000;
        position: relative;
        transition: all 0.2s ease;
        box-shadow: 5px 5px 0 #000;
        overflow: hidden;
        text-decoration: none;
        margin-bottom: 0.5rem;
        cursor: pointer;
      }
      .brutalist-card__button--read {
        background: #000;
        color: #fff;
      }
      .brutalist-card__button--mark {
        background: #fff;
        color: #000;
      }
      .brutalist-card__button--disabled {
        background: #eee;
        color: #aaa;
        border-color: #aaa;
        cursor: not-allowed;
        box-shadow: none;
      }
      .brutalist-card__button::before {
        content: "";
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(120deg, transparent, rgba(255,255,255,0.3), transparent);
        transition: all 0.6s;
      }
      .brutalist-card__button:hover::before {
        left: 100%;
      }
      .brutalist-card__button:hover {
        transform: translate(-2px, -2px);
        box-shadow: 7px 7px 0 #000;
      }
      .brutalist-card__button--mark:hover {
        background: #296fbb;
        border-color: #296fbb;
        color: #fff;
        box-shadow: 7px 7px 0 #004280;
      }
      .brutalist-card__button--read:hover {
        background: #ff0000;
        border-color: #ff0000;
        color: #fff;
        box-shadow: 7px 7px 0 #800000;
      }
      .brutalist-card__button:active {
        transform: translate(5px, 5px);
        box-shadow: none;
      }
    }
  }
  .brutalist-session__id {
    font-family: monospace;
    background: #eee;
    padding: 0.3rem 0.7rem;
    border-radius: 6px;
    font-size: 1rem;
  }
`;

export default MobileInterface;

