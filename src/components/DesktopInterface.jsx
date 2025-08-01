import React, { useState, useEffect, useRef } from 'react';
import Loader from './loader';
import styled from 'styled-components';
import { Camera, QrCode, Wifi, WifiOff, Users, Zap, Monitor, Smartphone, CheckCircle2, AlertCircle } from 'lucide-react';
import QRCode from 'qrcode';
import io from 'socket.io-client';
import bgframe from '../assets/bgframe.png';
import logo from '../assets/logo.png';

const DesktopInterface = () => {
  const [sessionId, setSessionId] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('idle'); // idle, connected, capturing
  const [mobileConnected, setMobileConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState('');
  const [captureCount, setCaptureCount] = useState(0);
  const [lastCaptureTime, setLastCaptureTime] = useState(null);
  const [multiCaptureActive, setMultiCaptureActive] = useState(false);
  const [multiCaptureCount, setMultiCaptureCount] = useState(3); // Default to 3 photos
  const [countdown, setCountdown] = useState(null); // null or number for countdown
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const frameImg = useRef(null); // Ref for frame image
  const [mergedImage, setMergedImage] = useState(null); // Store merged image for download

  // Ref for the capture button
  const captureBtnRef = useRef(null);

  // Initialize webcam
  const initializeWebcam = async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: false
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setError('');
      } catch (err) {
        console.error('Error accessing webcam:', err);
        setError('Unable to access webcam. Please ensure camera permissions are granted.');
      }
    } else {
      const err = new Error('Webcam not supported or unavailable.');
      console.error('Error accessing webcam:', err);
      setError('Webcam not supported or unavailable.');
    }
  };

  // Generate new session
  const generateNewSession = async () => {
    try {
      const response = await fetch('https://backend-photobooth-production.up.railway.app/api/generate-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setSessionId(data.session_id);
        
        // Generate QR code with enhanced styling
        const qrDataUrl = await QRCode.toDataURL(data.qr_data, {
          width: 320,
          margin: 3,
          color: {
            dark: '#1f2937',
            light: '#ffffff'
          },
          errorCorrectionLevel: 'M'
        });
        
        setQrCodeUrl(qrDataUrl);
        setConnectionStatus('idle');
        setMobileConnected(false);
        
        // Connect to socket
        const socketUrl = process.env.NODE_ENV === 'production'
          ? 'https://backend-photobooth-production.up.railway.app'
          : '/';
        const newSocket = io(socketUrl, {
          transports: ['websocket', 'polling']
        });
        
        newSocket.emit('join_pc_session', { session_id: data.session_id });
        
        newSocket.on('mobile_connected', (data) => {
          console.log('Mobile connected:', data);
          setMobileConnected(true);
          setConnectionStatus('connected');
        });
        
        newSocket.on('mobile_disconnected', () => {
          console.log('Mobile disconnected');
          setMobileConnected(false);
          setConnectionStatus('idle');
          setMergedImage(null); // Clear captured image on disconnect
        });
        

        // Listen for capture_image event from mobile and trigger the capture button click
        newSocket.on('capture_image', () => {
          console.log('Capture request received');
          // Start countdown
          setCountdown(3);
          let count = 3;
          const interval = setInterval(() => {
            setCountdown(count);
            if (count === 1) {
              clearInterval(interval);
              setCountdown(null);
              // If the button is enabled, trigger its click
              if (captureBtnRef.current && !captureBtnRef.current.disabled) {
                captureBtnRef.current.click();
              } else {
                // fallback: call captureImage directly
                captureImage();
              }
            }
            count--;
          }, 1000);
        });
        
        newSocket.on('session_ended', () => {
          console.log('Session ended');
          endSession();
        });
        
        setSocket(newSocket);
      }
    } catch (err) {
      console.error('Error generating session:', err);
      setError('Failed to generate session. Please try again.');
    }
  };

  // Capture image from webcam
  const captureImage = () => {
    // Always clear error before attempting to capture
    setError('');
    if (!stream || !videoRef.current || !canvasRef.current) {
      setError('Webcam not available. Attempting to reconnect...');
      // Notify mobile client of webcam error
      if (socket && sessionId) {
        socket.emit('webcam_error', {
          session_id: sessionId,
          message: 'Webcam still not available. Please check your camera and permissions.'
        });
      }
      initializeWebcam().then(() => {
        if (!stream || !videoRef.current || !canvasRef.current) {
          setError('Webcam still not available. Please check your camera and permissions.');
          // Notify mobile client again if still not available
          if (socket && sessionId) {
            socket.emit('webcam_error', {
              session_id: sessionId,
              message: 'Webcam still not available. Please check your camera and permissions.'
            });
          }
          return;
        }
        setError(''); // Clear error if webcam is now available
        setConnectionStatus('capturing');
        const canvas = canvasRef.current;
        const video = videoRef.current;
        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        if (socket && sessionId) {
          socket.emit('image_captured', {
            session_id: sessionId,
            image_data: imageData
          });
        }
        setCaptureCount(prev => prev + 1);
        setLastCaptureTime(new Date());
        setTimeout(() => {
          setConnectionStatus('connected');
          setError(''); // Clear error after successful capture
        }, 1500);
      });
      return;
    }

    setConnectionStatus('capturing');
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    // Merge with frame
    const frame = frameImg.current;
    if (frame) {
      context.drawImage(frame, 0, 0, canvas.width, canvas.height);
    }
    const mergedData = canvas.toDataURL('image/png');
    setMergedImage(mergedData);
    if (socket && sessionId) {
      socket.emit('image_captured', {
        session_id: sessionId,
        image_data: mergedData
      });
    }
    setCaptureCount(prev => prev + 1);
    setLastCaptureTime(new Date());
    setTimeout(() => {
      setConnectionStatus('connected');
      setError(''); // Clear error after successful capture
    }, 1500);
  };

  // Multi-capture logic
  const handleMultiCapture = async (e) => {
    e.preventDefault();
    setMultiCaptureActive(true);
    for (let i = 0; i < multiCaptureCount; i++) {
      await new Promise(resolve => {
        captureImage();
        setTimeout(resolve, 1800); // Wait for capture to finish
      });
    }
    setMultiCaptureActive(false);
  };

  // End current session
  const endSession = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
    
    setSessionId(null);
    setQrCodeUrl('');
    setConnectionStatus('idle');
    setMobileConnected(false);
    setCaptureCount(0);
    setLastCaptureTime(null);
    
    // Generate new session automatically
    setTimeout(() => {
      generateNewSession();
    }, 1000);
  };

  // Initialize on component mount
  // Only generate session on mount
  useEffect(() => {
    generateNewSession();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  // Open/close webcam based on mobile connection
  useEffect(() => {
    if (mobileConnected) {
      initializeWebcam();
    } else {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      }
    }
  }, [mobileConnected]);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-emerald-500';
      case 'capturing': return 'text-blue-500';
      default: return 'text-slate-500';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Mobile Connected';
      case 'capturing': return 'Capturing Image...';
      default: return 'Waiting for Connection';
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'capturing': return <Zap className="w-5 h-5 text-blue-500 animate-pulse" />;
      default: return <AlertCircle className="w-5 h-5 text-slate-500" />;
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
          background: 'rgba(41, 111, 187, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          flexDirection: 'column'
        }}>
      
          <p style={{
            color: '#fff',
            fontSize: '1.5rem',
            fontWeight: 600,
            marginTop: '1rem',
            textAlign: 'center',
            opacity: 0.9
          }}>Get ready for your photo!</p>
        </div>
      )}
      <StyledWrapper>
      <div className="brutalist-header">
        <div className="brutalist-header__logo">
          <img src={logo} alt="Logo" style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 12, background: '#fff', border: '2px solid #296fbb', boxShadow: '0 2px 8px #ff7f00' }} />
        </div>
       
        <h1 className="brutalist-header__title">#SEDay2025</h1>
      </div>
      <p className="brutalist-header__desc">
        Professional remote camera control system. Scan the QR code with your mobile device to start capturing high-quality photos.
      </p>
      <div className="brutalist-main">
        {/* Hidden frame image for merging */}
        <img ref={frameImg} src={bgframe} alt="Frame" style={{ display: 'none' }} crossOrigin="anonymous" />
        {/* Show QR and connection status when idle or not connected */}
        {(!mobileConnected || connectionStatus === 'idle') && (
          <>
            <div className="brutalist-card">
              <div className="brutalist-card__header">
                <div className="brutalist-card__icon">{getStatusIcon()}</div>
                <div className="brutalist-card__alert">{getStatusText()}</div>
              </div>
              <div className="brutalist-card__message">
                {mobileConnected ? 'Ready to capture photos' : 'Waiting for mobile device'}
                {error && (
                  <div className="brutalist-card__error">
                    <AlertCircle style={{ marginRight: 8 }} />
                    {error}
                  </div>
                )}
              </div>
              <div className="brutalist-card__actions">
                <a
                  className="brutalist-card__button brutalist-card__button--mark"
                  href="#"
                  onClick={generateNewSession}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}
                >
                  <QrCode />
                  <span style={{ fontWeight: 700 }}>Generate New QR Code</span>
                </a>
              </div>
            </div>
            <div className="brutalist-card">
              <div className="brutalist-card__header">
                <div className="brutalist-card__icon"><QrCode /></div>
                <div className="brutalist-card__alert">Connection QR Code</div>
              </div>
              <div className="brutalist-card__message">
                {qrCodeUrl ? (
                  <img src={qrCodeUrl} alt="QR Code" className="brutalist-card__qr" />
                ) : (
                  <div className="brutalist-card__loading">Generating QR Code...</div>
                )}
                <div className="brutalist-card__status">
                  {mobileConnected ? <Wifi /> : <WifiOff />}
                  {getStatusText()}
                </div>
              </div>
            </div>
          </>
        )}
        {/* Show camera interface only when mobile is connected */}
        {mobileConnected && connectionStatus !== 'idle' && (
          <div className="brutalist-card" style={{ maxWidth: '900px', width: '100%' }}>
            <div className="brutalist-card__header">
              <div className="brutalist-card__icon"><Camera /></div>
              <div className="brutalist-card__alert">Camera Preview</div>
            </div>
            <div className="brutalist-card__message">
              <div className="brutalist-card__video">
                {connectionStatus === 'capturing' ? (
                  <div style={{ width: '100%', maxWidth: '900px', height: '675px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '2px solid #000' }}>
                    <Loader />
                  </div>
                ) : (
                  mergedImage ? (
                    <div style={{ position: 'relative', width: '100%', maxWidth: '900px', height: '675px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '2px solid #000' }}>
                      <img
                        src={mergedImage}
                        alt="Captured Preview"
                        style={{ width: '100%', height: '675px', objectFit: 'cover', border: '2px solid #000', background: '#222', maxWidth: '900px' }}
                      />
                    </div>
                  ) : (
                    <div style={{ position: 'relative', width: '100%', maxWidth: '900px', height: '675px' }}>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{ width: '100%', height: '675px', objectFit: 'cover', border: '2px solid #000', background: '#222', maxWidth: '900px' }}
                      />
                      {/* Frame overlay */}
                      <img
                        src={bgframe}
                        alt="Frame Overlay"
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '675px', pointerEvents: 'none', maxWidth: '900px' }}
                      />
                      <canvas ref={canvasRef} style={{ display: 'none' }} />
                    </div>
                  )
                )}

              </div>
              <div className="brutalist-card__actions">
                <StyledCaptureButton
                  ref={captureBtnRef}
                  disabled={!mobileConnected || connectionStatus === 'capturing'}
                  onClick={e => {e.preventDefault(); captureImage();}}
                >
                  <Camera style={{ marginRight: 10 }} />
                  <span>{connectionStatus === 'capturing' ? 'Capturing...' : 'Capture Photo'}</span>
                </StyledCaptureButton>
                
                <a
                  className={`brutalist-card__button brutalist-card__button--read${!mergedImage ? ' brutalist-card__button--disabled' : ''}`}
                  href={mergedImage}
                  download={`se-day-photo-${Date.now()}.png`}
                  style={{ pointerEvents: !mergedImage ? 'none' : 'auto', opacity: !mergedImage ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', maxWidth: '900px', width: '100%' }}
                >
                  <Camera />
                  <span style={{ fontWeight: 700 }}>Download Photo with Frame</span>
                </a>
                
              </div>
              <div className="brutalist-card__info">
                {mobileConnected
                  ? "🎯 Mobile device connected. Ready to capture stunning photos!"
                  : "📱 Waiting for mobile device to connect..."}
                {lastCaptureTime && (
                  <div className="brutalist-card__last-capture">Last capture: {lastCaptureTime.toLocaleTimeString()}</div>
                )}
              </div>
              {captureCount > 0 && (
                <div className="brutalist-card__captures">
                  <span className="brutalist-card__captures-count">{captureCount}</span> Photos Captured
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {sessionId && (
        <div className="brutalist-session">
          <div className="brutalist-session__info">
            <span className="brutalist-session__label">Session ID:</span>
            <span className="brutalist-session__id">{sessionId}</span>
          </div>
          <div className="brutalist-session__expire">
            🕒 This session will automatically expire after 5 minutes of inactivity
          </div>
        </div>
      )}
    </StyledWrapper>
    </>
  );
};


const StyledWrapper = styled.div`
min-height: 100vh;
background: linear-gradient(135deg, #fff 0%, #f5f5f5 100%);
padding: 2rem;
font-family: 'Inter', 'Space Grotesk', Arial, Helvetica, sans-serif;
display: flex;
flex-direction: column;
align-items: center;
justify-content: center;
color: #1f2937;
letter-spacing: 0.02em;
  h1, h2, h3, h4, h5, h6 {
    font-family: 'Inter', 'Recursive', Arial, Helvetica, sans-serif;
    font-weight: 900;
    color: #ff6600;
    letter-spacing: 0.04em;
  }
  .brutalist-header {
    display: flex;
    align-items: center;
    gap: 1.2rem;
    margin-bottom: 0.5rem;
    .brutalist-header__logo {
      background: #fff;
      padding: 0.3rem;
      border-radius: 12px;
     
     
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .brutalist-header__icon {
      background: linear-gradient(135deg, #296fbb 60%, #ff7f00 100%);
      padding: 0.5rem;
      border-radius: 8px;
      svg {
        color: #fff;
        width: 2rem;
        height: 2rem;
      }
    }
    .brutalist-header__title {
      font-size: 2.5rem;
      font-weight: 900;
      color: #296fbb;
      text-transform: uppercase;
      letter-spacing: 2px;
      text-shadow: 1px 1px 0 #fff, 2px 2px 0 #ff7f00;
      font-family: 'Inter', 'Space Grotesk', Arial, Helvetica, sans-serif;
    }
  }
  .brutalist-header__desc {
    font-size: 1.15rem;
    color: #296fbb;
    margin-bottom: 2rem;
    font-weight: 500;
    font-family: 'Inter', Arial, Helvetica, sans-serif;
    letter-spacing: 0.02em;
  }
  .brutalist-main {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    gap: 2rem;
    margin-bottom: 2rem;
    width: 100%;
    @media (max-width: 900px) {
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
  }
  .brutalist-card {
    border: 3px solid #296fbb;
    background: #fff;
    box-shadow: 0 4px 24px rgba(41,111,187,0.08);
    padding: 1.5rem;
    margin-bottom: 1rem;
    border-radius: 16px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    align-items: center;
    justify-content: center;
    width: 100%;
    max-width: 420px;
    .brutalist-card__header {
      display: flex;
      align-items: center;
      gap: 1rem;
      border-bottom: 2px solid #296fbb;
      padding-bottom: 1rem;
      margin-bottom: 1rem;
      .brutalist-card__icon {
        background: linear-gradient(135deg, #296fbb 0%, #296fbb);
        padding: 0.5rem;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(255,102,0,0.08);
        svg {
          color: #fff;
          width: 1.5rem;
          height: 1.5rem;
        }
      }
      .brutalist-card__alert {
        font-weight: 900;
        color: #296fbb;
        font-size: 1.3rem;
        text-transform: uppercase;
         font-family: 'Inter', 'Space Grotesk', Arial, Helvetica, sans-serif;
      }
    }
    .brutalist-card__message {
      color: #1f2937;
      font-size: 1.05rem;
      font-weight: 500;
      margin-bottom: 1rem;
      border-bottom: 2px solid #296fbb;
      padding-bottom: 1rem;
      font-family: 'Inter', Arial, Helvetica, sans-serif;
      .brutalist-card__error {
        color: #ff6600;
        font-weight: bold;
        margin-top: 0.5rem;
        display: flex;
        align-items: center;
      }
      .brutalist-card__qr {
        display: block;
        margin: 0.5rem auto;
        border: 4px solid #296fbb;
        border-radius: 12px;
        box-shadow: 0 2px 12px rgba(255,102,0,0.12);
        width: 180px;
        height: 180px;
        object-fit: contain;
        background: #fff;
      }
      .brutalist-card__loading {
        text-align: center;
        color: #296fbb;
        font-size: 1.1rem;
        font-weight: 700;
        margin: 1rem 0;
      }
      .brutalist-card__status {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 700;
        color: #296fbb;
        margin-top: 1rem;
        svg {
          width: 1.2rem;
          height: 1.2rem;
        }
      }
      .brutalist-card__info {
        margin-top: 1rem;
        color: #ff6600;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-family: 'Inter', Arial, Helvetica, sans-serif;
      }
      .brutalist-card__last-capture {
        font-size: 0.95rem;
        color: #296fbb;
        margin-top: 0.5rem;
        font-family: 'Inter', Arial, Helvetica, sans-serif;
      }
      .brutalist-card__captures {
        margin-top: 1rem;
        font-size: 1rem;
        color: #ff6600;
        font-weight: 700;
        font-family: 'Inter', Arial, Helvetica, sans-serif;
        .brutalist-card__captures-count {
          font-size: 1.3rem;
          color: #296fbb;
          font-weight: 900;
          margin-right: 0.5rem;
        }
      }
      .brutalist-card__video {
        margin-bottom: 1rem;
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
        font-size: 1.05rem;
        font-weight: 700;
        text-transform: uppercase;
        border: 3px solid #296fbb;
        background: #fff;
        color: #296fbb;
        position: relative;
        transition: all 0.2s ease;
        box-shadow: 0 2px 8px rgba(255,102,0,0.08);
        overflow: hidden;
        text-decoration: none;
        margin-bottom: 0.5rem;
        cursor: pointer;
        border-radius: 8px;
        font-family: 'Inter', Arial, Helvetica, sans-serif;
      }
      .brutalist-card__button--read {
        background: #296fbb;
        color: #fff;
        border-color: #296fbb;
      }
      .brutalist-card__button--mark {
        background: #296fbb
        color: #fff;
        border-color: #296fbb
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
        box-shadow: 0 4px 16px rgba(41,111,187,0.12);
      }
      .brutalist-card__button--mark:hover {
        background: #296fbb;
        border-color: #296fbb;
        color: #fff;
        box-shadow: 0 4px 16px rgba(255,102,0,0.12);
      }
      .brutalist-card__button--read:hover {
        background: #ff6600;
        border-color: #ff6600;
        color: #fff;
        box-shadow: 0 4px 16px rgba(255,102,0,0.12);
      }
      .brutalist-card__button:active {
        transform: translate(2px, 2px);
        box-shadow: none;
      }
    }
  }
  .brutalist-session {
    margin-top: 2rem;
    border: 3px solid #296fbb;
    background: linear-gradient(135deg, #fff 0%, #296fbb 8%, #fff 100%);
    box-shadow: 0 2px 12px rgba(41,111,187,0.08);
    border-radius: 12px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    max-width: 420px;
    .brutalist-session__info {
      display: flex;
      align-items: center;
      gap: 1rem;
      font-size: 1rem;
      color: #296fbb;
      font-family: 'Inter', Arial, Helvetica, sans-serif;
      .brutalist-session__label {
        font-weight: 700;
        color: #ff6600;
      }
      .brutalist-session__id {
        font-family: monospace;
        background: #fff;
        padding: 0.3rem 0.7rem;
        border-radius: 6px;
        font-size: 1rem;
        color: #296fbb;
        border: 1px solid #ff6600;
      }
    }
    .brutalist-session__expire {
      font-size: 0.95rem;
      color: #ff6600;
      margin-top: 0.5rem;
      font-family: 'Inter', Arial, Helvetica, sans-serif;
    }
  }
`;


const StyledCaptureButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  width: 100%;
  padding: 1rem 0;
  font-size: 1.2rem;
  font-weight: 900;
  text-transform: uppercase;
  border: 4px solid #ff6600;
  background: linear-gradient(135deg, #fff 60%, #ff6600 100%);
  color: #296fbb;
  box-shadow: 0 4px 16px rgba(255,102,0,0.12);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  letter-spacing: 0.04em;
  position: relative;
  outline: none;
  &:hover {
    background: linear-gradient(135deg, #ff6600 60%, #fff 100%);
    color: #fff;
    border-color: #296fbb;
    box-shadow: 0 6px 24px rgba(41,111,187,0.18);
    transform: translate(-2px, -2px);
  }
  &:active {
    transform: translate(2px, 2px);
    box-shadow: none;
  }
  &:disabled {
    background: #eee;
    color: #aaa;
    border-color: #aaa;
    cursor: not-allowed;
    box-shadow: none;
    opacity: 0.6;
  }
`;

export default DesktopInterface;