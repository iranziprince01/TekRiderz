import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Settings, 
  X,
  Minimize2,
  Maximize2,
  Accessibility,
  Cloud,
  Wifi
} from 'lucide-react';
import { speechService, webSpeechFallback } from '../../services/speechService';

interface AccessibilityPanelProps {
  onSpeechToText?: (text: string) => void;
  textToRead?: string;
  isVisible?: boolean;
  onToggleVisibility?: (visible: boolean) => void;
}

export const AccessibilityPanel: React.FC<AccessibilityPanelProps> = ({
  onSpeechToText,
  textToRead,
  isVisible = false,
  onToggleVisibility
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [googleCloudAvailable, setGoogleCloudAvailable] = useState(false);
  const [healthStatus, setHealthStatus] = useState<string>('Checking...');
  const [speechSettings, setSpeechSettings] = useState({
    rate: 1,
    pitch: 1,
    volume: 1
  });

  // Track current audio for cleanup
  const currentAudio = useRef<HTMLAudioElement | null>(null);

  // Check backend speech service health on mount
  useEffect(() => {
    const checkSpeechHealth = async () => {
      try {
        const health = await speechService.checkHealth();
        setGoogleCloudAvailable(health.googleCloudAvailable);
        setHealthStatus(health.status);
        console.log('Speech service status:', health);
      } catch (error) {
        console.warn('Speech health check failed:', error);
        setGoogleCloudAvailable(false);
        setHealthStatus('Backend speech services unavailable');
      }
    };

    checkSpeechHealth();
  }, []);

  const startListening = async () => {
    setIsListening(true);
    setTranscript('');
    
    // For now, use Web Speech API for real-time speech recognition
    // Google Cloud STT requires more complex audio recording setup
    const webSupport = webSpeechFallback.isSupported();
    
    if (webSupport.speechRecognition) {
      webSpeechFallback.startListening(
        (text: string, isFinal: boolean) => {
          setTranscript(text);
          if (isFinal && onSpeechToText) {
            onSpeechToText(text);
          }
        },
        (error: string) => {
          console.error('Speech recognition error:', error);
          setIsListening(false);
          setTranscript('Error: ' + error);
        }
      );
    } else {
      setTranscript('Speech recognition not supported in this browser');
      setIsListening(false);
    }
  };

  const stopListening = () => {
    setIsListening(false);
    webSpeechFallback.stopListening();
  };

  const speakText = async (text?: string) => {
    const textToSpeak = text || textToRead;
    if (!textToSpeak?.trim()) return;

    // Stop any current audio
    if (currentAudio.current) {
      currentAudio.current.pause();
      currentAudio.current = null;
    }

    setIsSpeaking(true);

    try {
      if (googleCloudAvailable) {
        console.log('🔊 Using Google Cloud Text-to-Speech via backend');
        
        // Use Google Cloud TTS through secure backend
        const result = await speechService.textToSpeech(textToSpeak, {
          languageCode: 'en-US',
          speakingRate: speechSettings.rate,
          pitch: speechSettings.pitch,
          ssmlGender: 'NEUTRAL'
        });

        if (result.success && result.audioUrl) {
          const audio = new Audio(result.audioUrl);
          currentAudio.current = audio;
          
          audio.onended = () => {
            setIsSpeaking(false);
            currentAudio.current = null;
            URL.revokeObjectURL(result.audioUrl!); // Clean up blob URL
          };
          
          audio.onerror = (error) => {
            console.warn('Google TTS playback failed, falling back to Web Speech:', error);
            fallbackToWebTTS(textToSpeak);
          };
          
          await audio.play();
        } else {
          throw new Error(result.error || 'TTS request failed');
        }
      } else {
        fallbackToWebTTS(textToSpeak);
      }
    } catch (error) {
      console.warn('Google TTS error, falling back to Web Speech:', error);
      fallbackToWebTTS(textToSpeak);
    }
  };

  const fallbackToWebTTS = (text: string) => {
    console.log('🔄 Using Web Speech API fallback');
    const webSupport = webSpeechFallback.isSupported();
    
    if (webSupport.speechSynthesis) {
      webSpeechFallback.speak(text, {
        rate: speechSettings.rate,
        pitch: speechSettings.pitch,
        volume: speechSettings.volume,
        lang: 'en-US'
      });
      
      // Estimate duration and stop speaking indicator
      const estimatedDuration = text.length * 100; // rough estimate
      setTimeout(() => setIsSpeaking(false), estimatedDuration);
    } else {
      setIsSpeaking(false);
      console.error('Text-to-speech not supported');
    }
  };

  const stopSpeaking = () => {
    setIsSpeaking(false);
    
    // Stop Google Cloud audio
    if (currentAudio.current) {
      currentAudio.current.pause();
      currentAudio.current = null;
    }
    
    // Stop Web Speech API
    webSpeechFallback.stopSpeaking();
  };

  if (!isVisible) {
    return (
      <Button
        onClick={() => onToggleVisibility?.(true)}
        className="fixed bottom-4 right-4 z-50 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 shadow-lg"
        title="Open Accessibility Panel"
      >
        <Accessibility className="w-5 h-5" />
      </Button>
    );
  }

  if (isMinimized) {
    return (
      <Card className="fixed bottom-4 right-4 z-50 p-3 shadow-lg border">
        <div className="flex items-center gap-2">
          <Accessibility className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium">Accessibility</span>
          {googleCloudAvailable && (
            <Cloud className="w-3 h-3 text-green-500" />
          )}
          <div className="flex gap-1 ml-2">
            <Button
              onClick={() => setIsMinimized(false)}
              variant="outline"
              size="sm"
              className="p-1"
            >
              <Maximize2 className="w-3 h-3" />
            </Button>
            <Button
              onClick={() => onToggleVisibility?.(false)}
              variant="outline"
              size="sm"
              className="p-1"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const webSupport = webSpeechFallback.isSupported();
  const hasAnySpeechSupport = googleCloudAvailable || webSupport.speechRecognition || webSupport.speechSynthesis;

  return (
    <Card className="fixed bottom-4 right-4 z-50 w-80 p-4 shadow-lg border">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Accessibility className="w-4 h-4 text-blue-600" />
          <span className="font-medium">Accessibility</span>
          {googleCloudAvailable ? (
            <Cloud className="w-4 h-4 text-green-500" />
          ) : (
            <Wifi className="w-4 h-4 text-blue-500" />
          )}
        </div>
        <div className="flex gap-1">
          <Button
            onClick={() => setIsMinimized(true)}
            variant="outline"
            size="sm"
            className="p-1"
          >
            <Minimize2 className="w-3 h-3" />
          </Button>
          <Button
            onClick={() => onToggleVisibility?.(false)}
            variant="outline"
            size="sm"
            className="p-1"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* API Status */}
      <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs">
        <div className="flex items-center gap-1">
          {googleCloudAvailable ? (
            <Cloud className="w-3 h-3 text-green-600" />
          ) : (
            <Wifi className="w-3 h-3 text-blue-600" />
          )}
          <span className={googleCloudAvailable ? "text-green-700 dark:text-green-300" : "text-blue-700 dark:text-blue-300"}>
            {healthStatus}
          </span>
        </div>
      </div>

      {/* Speech-to-Text Section */}
      {(webSupport.speechRecognition || googleCloudAvailable) && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">Voice Input</h4>
          <div className="flex items-center gap-2 mb-2">
            <Button
              onClick={isListening ? stopListening : startListening}
              variant={isListening ? "primary" : "outline"}
              size="sm"
              className={isListening ? "bg-red-600 hover:bg-red-700" : ""}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {isListening ? 'Stop' : 'Listen'}
            </Button>
            {isListening && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-gray-500">Listening...</span>
              </div>
            )}
          </div>
          {transcript && (
            <div className="text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded border">
              {transcript}
            </div>
          )}
        </div>
      )}

      {/* Text-to-Speech Section */}
      {(webSupport.speechSynthesis || googleCloudAvailable) && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">Read Aloud</h4>
          <div className="flex items-center gap-2 mb-2">
            <Button
              onClick={isSpeaking ? stopSpeaking : () => speakText()}
              variant={isSpeaking ? "primary" : "outline"}
              size="sm"
              className={isSpeaking ? "bg-green-600 hover:bg-green-700" : ""}
              disabled={!textToRead}
            >
              {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              {isSpeaking ? 'Stop' : 'Read'}
            </Button>
            {isSpeaking && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-gray-500">Speaking...</span>
              </div>
            )}
          </div>

          {/* Speech Settings */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-12">Speed:</span>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={speechSettings.rate}
                onChange={(e) => setSpeechSettings(prev => ({ ...prev, rate: parseFloat(e.target.value) }))}
                className="flex-1"
              />
              <span className="w-8">{speechSettings.rate}x</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-12">Pitch:</span>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={speechSettings.pitch}
                onChange={(e) => setSpeechSettings(prev => ({ ...prev, pitch: parseFloat(e.target.value) }))}
                className="flex-1"
              />
            </div>
          </div>
        </div>
      )}

      {/* Compatibility Notice */}
      {!hasAnySpeechSupport && (
        <div className="text-xs text-gray-500 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded border">
          Speech features not supported in this browser or backend unavailable
        </div>
      )}
    </Card>
  );
}; 