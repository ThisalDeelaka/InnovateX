import { useState, useEffect } from 'react';
import useSpeechToText from '../hooks/useSpeechToText';
import { useNavigate } from 'react-router-dom';

const AccessibilityTaskbar = () => {
  const { isListning, transcript, startListning, stopListning } =
    useSpeechToText({ continuous: true });

  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isTaskbarActivated, setIsTaskbarActivated] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [lineHeight, setLineHeight] = useState(1.5);
  const [letterSpacing, setLetterSpacing] = useState(1);
  const [contrast, setContrast] = useState('default');
  const [monochrome, setMonochrome] = useState(false);
  const [saturation, setSaturation] = useState(100);
  const [seizureSafe, setSeizureSafe] = useState(false);
  const [visionImpaired, setVisionImpaired] = useState(false);

  const [isTaskbarVisible, setIsTaskbarVisible] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(null);
  const [showCommandFeedback, setShowCommandFeedback] = useState('');
  const [tooltip, setTooltip] = useState('');

  const navigate = useNavigate();

  // — Speech toggle —
  const startStopListening = () => {
    if (isListning) {
      stopListning();
      setIsVoiceActive(false);
    } else {
      startListning();
      setIsVoiceActive(true);
    }
  };

  // — Voice commands handler —
  useEffect(() => {
    const cmd = transcript.trim().toLowerCase();
    const exec = (feedback, fn) => {
      fn();
      setShowCommandFeedback(feedback);
      setTimeout(() => setShowCommandFeedback(''), 3000);
      stopListning();
      setIsVoiceActive(false);
    };

    if (cmd.includes('activate taskbar')) {
      exec('Taskbar Activated', () => setIsTaskbarActivated(true));
    } else if (cmd.includes('deactivate taskbar')) {
      exec('Taskbar Deactivated', () => setIsTaskbarActivated(false));
    } else if (cmd.includes('increase text size')) {
      exec('Text Size Increased', () => setFontSize(f => f + 2));
    } else if (cmd.includes('decrease text size')) {
      exec('Text Size Decreased', () => setFontSize(f => Math.max(12, f - 2)));
    } else if (cmd.includes('increase line height')) {
      exec('Line Height Increased', () => setLineHeight(l => l + 0.1));
    } else if (cmd.includes('decrease line height')) {
      exec('Line Height Decreased', () => setLineHeight(l => Math.max(1, l - 0.1)));
    } else if (cmd.includes('increase contrast')) {
      exec('Contrast Increased', () => setContrast('high'));
    } else if (cmd.includes('decrease contrast')) {
      exec('Contrast Reset', () => setContrast('default'));
    } else if (cmd.includes('reset')) {
      exec('Settings Reset', resetSettings);
    } else if (cmd === 'go to explore') {
      exec('Navigating to explore', () => navigate('/explore'));
    } else if (cmd === 'go to favorite') {
      exec('Navigating to favorites', () => navigate('/favorites'));
    } 
  }, [transcript, navigate]);

  // — Visual settings effects —
  useEffect(() => {
    document.body.style.filter = seizureSafe ? 'grayscale(100%)' : 'none';
  }, [seizureSafe]);

  useEffect(() => {
    document.body.style.fontSize = visionImpaired ? '20px' : '16px';
    document.body.style.filter = visionImpaired ? 'contrast(150%)' : 'contrast(100%)';
  }, [visionImpaired]);

  useEffect(() => {
    document.body.style.fontSize = `${fontSize}px`;
  }, [fontSize]);

  useEffect(() => {
    document.body.style.lineHeight = `${lineHeight}`;
  }, [lineHeight]);

  useEffect(() => {
    document.body.style.letterSpacing = `${letterSpacing}px`;
  }, [letterSpacing]);

  useEffect(() => {
    switch (contrast) {
      case 'dark':
        document.body.style.backgroundColor = '#000';
        document.body.style.color = '#FFF';
        break;
      case 'light':
        document.body.style.backgroundColor = '#FFF';
        document.body.style.color = '#000';
        break;
      case 'high':
        document.body.style.filter = 'contrast(200%)';
        break;
      default:
        document.body.style.backgroundColor = '';
        document.body.style.color = '';
        document.body.style.filter = 'contrast(100%)';
    }
  }, [contrast]);

  useEffect(() => {
    document.body.style.filter = monochrome ? 'grayscale(100%)' : '';
  }, [monochrome]);

  useEffect(() => {
    document.body.style.filter = saturation !== 100 ? `saturate(${saturation}%)` : 'none';
  }, [saturation]);

  // — Reset all to defaults —
  const resetSettings = () => {
    setSeizureSafe(false);
    setVisionImpaired(false);
    setFontSize(16);
    setLineHeight(1.5);
    setLetterSpacing(1);
    setContrast('default');
    setMonochrome(false);
    setSaturation(100);
  };

  // — Animation keyframes —
  const keyframes = `
    @keyframes orbGlow {
      0%,100% { transform: scale(1); box-shadow: 0 0 15px rgba(0,255,255,0.4); }
      50%    { transform: scale(1.1); box-shadow: 0 0 35px rgba(0,255,255,0.8); }
    }
  `;

  // — Tooltip style (added!) —
  const tooltipStyle = {
    position: 'absolute',
    bottom: '80px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(0,0,0,0.85)',
    color: '#fff',
    padding: '10px 15px',
    borderRadius: '8px',
    fontSize: '16px',
    whiteSpace: 'nowrap',
    zIndex: 1001,
    boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
  };

  return (
    <>
      <style>{keyframes}</style>

      {/* Voice command feedback */}
      <div
        style={{
          position: 'fixed',
          bottom: '100px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0,0,0,0.85)',
          color: '#fff',
          padding: '10px 20px',
          borderRadius: '10px',
          fontSize: '18px',
          fontWeight: 'bold',
          zIndex: 1002,
          display: showCommandFeedback ? 'block' : 'none',
        }}
      >
        {showCommandFeedback}
      </div>

      {/* Voice orb */}
      {isVoiceActive && (
        <div
          style={{
            position: 'fixed',
            bottom: '180px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            zIndex: 1001,
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background:
                'linear-gradient(135deg, #66e2ff, #8e9bff, #d066ff, #ff66b3)',
              animation: 'orbGlow 2s ease-in-out infinite',
              boxShadow: '0 0 30px rgba(0,255,255,0.5)',
            }}
          />
          <div
            style={{
              color: 'white',
              marginTop: '15px',
              fontSize: '20px',
              fontWeight: 'bold',
            }}
          >
            Processing...
          </div>
        </div>
      )}

      {/* Live transcript */}
      {isListning && (
        <div
          style={{
            position: 'fixed',
            bottom: '150px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0,0,0,0.85)',
            color: '#fff',
            padding: '15px 30px',
            borderRadius: '25px',
            fontSize: '22px',
            fontWeight: 'bold',
            zIndex: 1002,
            letterSpacing: '1px',
          }}
        >
          {transcript || 'Listening...'}
        </div>
      )}

      {/* Accessibility taskbar */}
      {isTaskbarVisible && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: isTaskbarActivated
              ? 'rgba(34,34,34,0.95)'
              : 'rgba(34,34,34,0.85)',
            backdropFilter: 'blur(10px)',
            color: 'white',
            padding: isExpanded ? '10px 20px' : '10px',
            borderRadius: '30px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 1000,
            fontFamily: 'Arial, sans-serif',
            width: isExpanded ? 'auto' : '60px',
            height: isExpanded ? 'auto' : '60px',
            boxShadow: isTaskbarActivated
              ? '0 0 20px rgba(0,123,255,0.7)'
              : '0 4px 10px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.2)',
            overflow: 'visible',    // ← popups & tooltips escape
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={() => setIsExpanded(true)}
          onMouseLeave={() => setIsExpanded(false)}
        >
          {/* collapsed orb */}
          {!isExpanded && (
            <button
              onClick={() => setIsExpanded(true)}
              aria-label="Expand Accessibility Menu"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                fontSize: '24px',
                cursor: 'pointer',
              }}
            >
              ♿
            </button>
          )}

          {/* expanded controls */}
          {isExpanded && (
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              <button
                style={iconButtonStyle}
                onClick={() =>
                  setShowSettings(s => (s === 'fontSize' ? null : 'fontSize'))
                }
                aria-label="Adjust Font Size"
                onMouseEnter={() =>
                  setTooltip("Increase Text Size (Say 'Increase Text Size')")
                }
                onMouseLeave={() => setTooltip('')}
              >
                🔤
              </button>

              <button
                style={iconButtonStyle}
                onClick={() =>
                  setShowSettings(s => (s === 'lineHeight' ? null : 'lineHeight'))
                }
                aria-label="Adjust Line Height"
                onMouseEnter={() =>
                  setTooltip("Adjust Line Height (Say 'Increase Line Height')")
                }
                onMouseLeave={() => setTooltip('')}
              >
                📏
              </button>

              <button
                style={iconButtonStyle}
                onClick={() =>
                  setShowSettings(s =>
                    s === 'letterSpacing' ? null : 'letterSpacing'
                  )
                }
                aria-label="Adjust Letter Spacing"
                onMouseEnter={() =>
                  setTooltip("Adjust Letter Spacing (Say 'Increase Letter Spacing')")
                }
                onMouseLeave={() => setTooltip('')}
              >
                ↔️
              </button>

              <button
                style={iconButtonStyle}
                onClick={() =>
                  setShowSettings(s => (s === 'monochrome' ? null : 'monochrome'))
                }
                aria-label="Toggle Monochrome"
                onMouseEnter={() =>
                  setTooltip("Toggle Monochrome (Say 'Activate Monochrome')")
                }
                onMouseLeave={() => setTooltip('')}
              >
                🖤
              </button>

              <button
                style={iconButtonStyle}
                onClick={() =>
                  setShowSettings(s =>
                    s === 'visionImpaired' ? null : 'visionImpaired'
                  )
                }
                aria-label="Toggle Vision Impaired Profile"
                onMouseEnter={() =>
                  setTooltip("Activate Vision Impaired Mode (Say 'Activate Vision Impaired')")
                }
                onMouseLeave={() => setTooltip('')}
              >
                👓
              </button>

              <button
                style={iconButtonStyle}
                onClick={startStopListening}
                aria-label="Voice to Text Feature"
              >
                🎤
              </button>

              <button
                onClick={resetSettings}
                style={{
                  backgroundColor: '#f00',
                  color: 'white',
                  border: 'none',
                  padding: '8px 12px',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  transition: 'background 0.3s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#c00')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#f00')}
              >
                Reset
              </button>
            </div>
          )}

          {/* the tooltip */}
          {tooltip && <div style={tooltipStyle}>{tooltip}</div>}

          {/* Settings popups */}
          {showSettings === 'fontSize' && (
            <SettingsPopup
              label={`Font Size: ${fontSize}px`}
              min="12"
              max="40"
              value={fontSize}
              onChange={e => setFontSize(Number(e.target.value))}
              onMouseEnter={() => setIsExpanded(true)}
            />
          )}
          {showSettings === 'lineHeight' && (
            <SettingsPopup
              label={`Line Height: ${lineHeight.toFixed(1)}`}
              min="1"
              max="3"
              step="0.1"
              value={lineHeight}
              onChange={e => setLineHeight(Number(e.target.value))}
              onMouseEnter={() => setIsExpanded(true)}
            />
          )}
          {showSettings === 'letterSpacing' && (
            <SettingsPopup
              label={`Letter Spacing: ${letterSpacing}px`}
              min="0"
              max="5"
              value={letterSpacing}
              onChange={e => setLetterSpacing(Number(e.target.value))}
              onMouseEnter={() => setIsExpanded(true)}
            />
          )}
          {showSettings === 'monochrome' && (
            <SettingsPopup
              label={`Monochrome: ${monochrome ? 'On' : 'Off'}`}
              isCheckbox
              checked={monochrome}
              onChange={() => setMonochrome(m => !m)}
              onMouseEnter={() => setIsExpanded(true)}
            />
          )}
          {showSettings === 'visionImpaired' && (
            <SettingsPopup
              label={`Vision Impaired: ${visionImpaired ? 'On' : 'Off'}`}
              isCheckbox
              checked={visionImpaired}
              onChange={() => setVisionImpaired(v => !v)}
              onMouseEnter={() => setIsExpanded(true)}
            />
          )}
          {showSettings === 'seizureSafe' && (
            <SettingsPopup
              label={`Seizure Safe: ${seizureSafe ? 'On' : 'Off'}`}
              isCheckbox
              checked={seizureSafe}
              onChange={() => setSeizureSafe(s => !s)}
              onMouseEnter={() => setIsExpanded(true)}
            />
          )}
        </div>
      )}

      {/* fallback “Show Taskbar” button */}
      {!isTaskbarVisible && (
        <button
          onClick={() => setIsTaskbarVisible(true)}
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            backgroundColor: '#555',
            color: 'white',
            border: 'none',
            padding: '8px 12px',
            borderRadius: '20px',
            cursor: 'pointer',
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#333')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#555')}
        >
          Show Taskbar
        </button>
      )}
    </>
  );
};

// shared icon style
const iconButtonStyle = {
  fontSize: '20px',
  color: 'white',
  cursor: 'pointer',
  border: 'none',
  background: 'transparent',
  padding: '10px',
  borderRadius: '50%',
  transition: 'background 0.3s ease',
};

// Settings popup component
const SettingsPopup = ({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  isCheckbox = false,
  checked,
  onMouseEnter,
}) => (
  <div
    onMouseEnter={onMouseEnter}
    style={{
      position: 'absolute',
      bottom: '80px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'rgba(50,50,50,0.95)',
      backdropFilter: 'blur(10px)',
      color: 'white',
      padding: '20px',
      borderRadius: '12px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
      minWidth: '350px',
      textAlign: 'center',
      zIndex: 1001,
    }}
  >
    <label>{label}</label>
    {isCheckbox ? (
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{ marginLeft: '10px', cursor: 'pointer' }}
      />
    ) : (
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        style={{
          marginLeft: '10px',
          cursor: 'pointer',
          width: '100px',
          accentColor: '#1a73e8',
          backgroundColor: '#1a73e8',
        }}
      />
    )}
  </div>
);

export default AccessibilityTaskbar;
