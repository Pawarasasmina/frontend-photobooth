import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import styled from 'styled-components';
import DesktopInterface from './components/DesktopInterface';
import MobileInterface from './components/MobileInterface';
import './App.css';

function App() {
  // Detect if device is mobile based on screen size and user agent
  const isMobile = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(userAgent);
    const isSmallScreen = window.innerWidth <= 768;
    return isMobileUA || isSmallScreen;
  };

  return (
    <Router>
      <StyledApp>
        <AnimatePresence mode="wait">
          <Routes>
            {/* Desktop interface - default route */}
            <Route 
              path="/" 
              element={
                isMobile() ? (
                  <MobileRedirect />
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    <DesktopInterface />
                  </motion.div>
                )
              } 
            />
            {/* Mobile interface with session ID */}
            <Route 
              path="/mobile/:sessionId" 
              element={
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.5 }}
                >
                  <MobileInterface />
                </motion.div>
              } 
            />
            {/* Desktop interface (explicit) */}
            <Route 
              path="/desktop" 
              element={
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <DesktopInterface />
                </motion.div>
              } 
            />
            {/* Fallback redirect */}
            <Route 
              path="*" 
              element={<Navigate to="/" replace />} 
            />
          </Routes>
        </AnimatePresence>
      </StyledApp>
    </Router>
  );
}

// Component to show mobile users how to connect
const MobileRedirect = () => {
  return (
    <StyledMobileRedirect>
      <div className="brutalist-header">
        <div className="brutalist-header__icon" style={{background:'#296fbb', color:'#fff'}}>
          <span role="img" aria-label="Thank you">�</span>
        </div>
        <h1 className="brutalist-header__title" style={{background:'linear-gradient(90deg, #ff7f00 0%, #296fbb 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', textFillColor:'transparent'}}>Thank You for Participating!</h1>
      </div>
      <p className="brutalist-header__desc" style={{fontSize:'1.2rem', color:'#296fbb', fontWeight:700}}>
        You have successfully completed your photo session.<br/>
        We appreciate your participation in #SEDay2025.<br/>
        <span style={{color:'#ff7f00'}}>Have a wonderful day!</span>
      </p>
      <div className="brutalist-main">
        <div className="brutalist-card" style={{borderColor:'#296fbb', boxShadow:'10px 10px 0 #ff7f00'}}>
          <div className="brutalist-card__header">
            <div className="brutalist-card__icon" style={{background:'#ff7f00', color:'#fff'}}>
              �
            </div>
            <div className="brutalist-card__alert" style={{color:'#296fbb'}}>Session Ended</div>
          </div>
          <div className="brutalist-card__message" style={{color:'#296fbb', fontWeight:700}}>
            Thank you for using the QR Camera Station.<br/>
            If you want to start a new session, please refresh or return to the home page.
          </div>
          <div className="brutalist-card__actions">
            <a className="brutalist-card__button brutalist-card__button--mark" href="/" style={{background:'#296fbb', color:'#fff', borderColor:'#296fbb'}}>Go to Home</a>
          </div>
        </div>
      </div>
    </StyledMobileRedirect>
  );
};

const StyledApp = styled.div`
  min-height: 100vh;
  background: #fff;
  font-family: 'Space Grotesk', Arial, Helvetica, sans-serif;
  h1, h2, h3, h4, h5, h6 {
    font-family: 'Recursive', Arial, Helvetica, sans-serif;
    font-weight: 900;
  }
`;

const StyledMobileRedirect = styled.div`
  min-height: 100vh;
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
      color: #fff;
      font-size: 2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
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
    text-align: center;
  }
  .brutalist-main {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
    margin-bottom: 2rem;
    width: 100%;
    max-width: 400px;
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
        color: #fff;
        font-size: 1.2rem;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
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
      .brutalist-card__steps {
        list-style: none;
        padding: 0;
        margin: 0;
        li {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.7rem;
          .brutalist-card__step {
            background: #296fbb;
            color: #fff;
            border-radius: 50%;
            width: 1.5rem;
            height: 1.5rem;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 1rem;
          }
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
        background: #000;
        color: #fff;
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
      .brutalist-card__button:hover {
        transform: translate(-2px, -2px);
        box-shadow: 7px 7px 0 #000;
        background: #296fbb;
        border-color: #296fbb;
        color: #fff;
      }
      .brutalist-card__button:active {
        transform: translate(5px, 5px);
        box-shadow: none;
      }
    }
    .brutalist-card__info {
      margin-top: 1rem;
      color: #296fbb;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      justify-content: center;
    }
  }
`;

export default App;

