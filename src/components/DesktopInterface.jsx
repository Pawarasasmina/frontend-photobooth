import React, { useState, useEffect, useRef } from 'react';
import Loader from './loader';
import styled from 'styled-components';
import { Camera, QrCode, Wifi, WifiOff, Users, Zap, Monitor, Smartphone, CheckCircle2, AlertCircle } from 'lucide-react';
import QRCode from 'qrcode';
import io from 'socket.io-client';
import bgframe from '../assets/bgframe.png';

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
      const response = await fetch('/api/generate-session', {
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
        const newSocket = io('/', {
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
          // If the button is enabled, trigger its click
          if (captureBtnRef.current && !captureBtnRef.current.disabled) {
            captureBtnRef.current.click();
          } else {
            // fallback: call captureImage directly
            captureImage();
          }
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
    <StyledWrapper>
      <div className="brutalist-header">
        <div className="brutalist-header__icon">
          <Monitor />
        </div>
        <h1 className="brutalist-header__title">QR Camera Station</h1>
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
                <a
                  ref={captureBtnRef}
                  className={`brutalist-card__button brutalist-card__button--mark${!mobileConnected || connectionStatus === 'capturing' ? ' brutalist-card__button--disabled' : ''}`}
                  href="#"
                  onClick={e => {e.preventDefault(); captureImage();}}
                  style={{ pointerEvents: !mobileConnected || connectionStatus === 'capturing' ? 'none' : 'auto', opacity: !mobileConnected || connectionStatus === 'capturing' ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}
                >
                  <Camera />
                  <span style={{ fontWeight: 700 }}>{connectionStatus === 'capturing' ? 'Capturing...' : 'Capture Photo'}</span>
                </a>
                
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
  );
};


const StyledWrapper = styled.div`
hmin-height: 100vh;
background: #fff;
padding: 2rem;
font-family: 'Space Grotesk', Arial, Helvetica, sans-serif;
display: flex;
flex-direction: column;
align-items: center;
justify-content: center;
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
      font-size: 2.5rem;
      font-weight: 900;
      color: #000;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
  }
  .brutalist-header__desc {
    font-size: 1.1rem;
    color: #222;
    margin-bottom: 2rem;
    font-weight: 600;
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
    align-items: center;
    justify-content: center;
    width: 100%;
    max-width: 420px;
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
        font-size: 1.3rem;
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
      .brutalist-card__loading {
        text-align: center;
        color: #888;
        font-size: 1.1rem;
        font-weight: 700;
        margin: 1rem 0;
      }
      .brutalist-card__status {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 700;
        color: #000;
        margin-top: 1rem;
        svg {
          width: 1.2rem;
          height: 1.2rem;
        }
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
  .brutalist-session {
    margin-top: 2rem;
    border: 3px solid #000;
    background: #f9f9f9;
    box-shadow: 5px 5px 0 #000;
    border-radius: 8px;
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
      color: #222;
      .brutalist-session__label {
        font-weight: 700;
      }
      .brutalist-session__id {
        font-family: monospace;
        background: #eee;
        padding: 0.3rem 0.7rem;
        border-radius: 6px;
        font-size: 1rem;
      }
    }
    .brutalist-session__expire {
      font-size: 0.95rem;
      color: #555;
      margin-top: 0.5rem;
    }
  }
`;

export default DesktopInterface;