import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { 
  Accessibility,
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Cloud,
  Wifi,
  ChevronDown,
  ChevronUp,
  Settings
} from 'lucide-react';
import { speechService, webSpeechFallback } from '../../services/speechService';
import { useLanguage } from '../../contexts/LanguageContext';

interface CourseAccessibilityBarProps {
  pageContent?: string;
  courseTitle?: string;
}

export const CourseAccessibilityBar: React.FC<CourseAccessibilityBarProps> = ({
  pageContent,
  courseTitle
}) => {
  const { language } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
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
        // Professional status messages instead of technical details
        if (health.googleCloudAvailable) {
          setHealthStatus(language === 'rw' ? 'Bikora neza' : 'Ready');
        } else {
          setHealthStatus(language === 'rw' ? 'Bisanzwe' : 'Available');
        }
        console.log('Speech service status:', health);
      } catch (error) {
        console.warn('Speech health check failed:', error);
        setGoogleCloudAvailable(false);
        setHealthStatus(language === 'rw' ? 'Bisanzwe' : 'Available');
      }
    };

    checkSpeechHealth();
  }, [language]);

  // Auto-detect page content for reading
  const getReadableContent = () => {
    if (pageContent) return pageContent;
    
    // Auto-extract content from the page
    const mainContent = document.querySelector('main');
    if (mainContent) {
      const headings = Array.from(mainContent.querySelectorAll('h1, h2, h3')).map(h => h.textContent).join('. ');
      const paragraphs = Array.from(mainContent.querySelectorAll('p')).slice(0, 3).map(p => p.textContent).join('. ');
      return `${courseTitle ? `${courseTitle}. ` : ''}${headings}. ${paragraphs}`.substring(0, 500);
    }
    
    return courseTitle || 'Course content';
  };

  const startListening = async () => {
    setIsListening(true);
    setTranscript('');
    
    if (googleCloudAvailable) {
      console.log('🎤 Starting enhanced voice recognition with language detection');
      
      // Use Web Speech API for real-time audio capture, then enhance with Google Cloud
      const webSupport = webSpeechFallback.isSupported();
      
      if (webSupport.speechRecognition) {
        webSpeechFallback.startListening(
          async (text: string, isFinal: boolean) => {
            setTranscript(text);
            if (isFinal && text.trim()) {
              // Enhanced command processing with voice feedback
              await handleSmartVoiceCommand(text);
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
    } else {
      // Fallback to Web Speech API only
      console.log('🔄 Using Web Speech API fallback');
      const webSupport = webSpeechFallback.isSupported();
      
      if (webSupport.speechRecognition) {
        webSpeechFallback.startListening(
          (text: string, isFinal: boolean) => {
            setTranscript(text);
            if (isFinal) {
              handleVoiceCommand(text);
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
    }
  };

  const stopListening = () => {
    setIsListening(false);
    webSpeechFallback.stopListening();
  };

  // Enhanced smart voice command processing like Siri/Alexa
  const handleSmartVoiceCommand = async (transcript: string, navigationResult?: any) => {
    const cmd = transcript.toLowerCase();
    
    // Detect language from the transcript
    const isKinyarwanda = /\b(jya|fungura|erekana|amanota|ibice|rugo|ndumva|muri)\b/i.test(transcript);
    const detectedLang = isKinyarwanda ? 'rw' : 'en';
    
    console.log('🗣️ Processing voice command:', transcript);
    console.log('🌍 Detected language:', detectedLang);
    
    // Navigation commands with voice feedback
    let navigateToRoute = '';
    let responseMessage = '';
    
    if (detectedLang === 'rw') {
      // Kinyarwanda commands
      if (cmd.includes('jya mu bice') || cmd.includes('fungura ibice')) {
        navigateToRoute = '/modules';
        responseMessage = 'Ndafungura amabice y\'isomo';
      } else if (cmd.includes('jya mu bizamini') || cmd.includes('erekana amanota')) {
        navigateToRoute = '/assessments';
        responseMessage = 'Ndafungura ibizamini n\'amanota';
      } else if (cmd.includes('jya mu rugo') || cmd.includes('urupapuro rukuru')) {
        navigateToRoute = '';
        responseMessage = 'Ndajya mu rupapuro rw\'ibanze';
      } else if (cmd.includes('soma') || cmd.includes('erekana')) {
        responseMessage = 'Ndashaka kusoma...';
        await speakContent();
        return;
      } else {
        responseMessage = 'Babyaye, sinumvise iyo ngingo';
      }
    } else {
      // English commands
      if (cmd.includes('go to modules') || cmd.includes('open modules') || cmd.includes('show modules')) {
        navigateToRoute = '/modules';
        responseMessage = 'Opening course modules';
      } else if (cmd.includes('go to assessments') || cmd.includes('open assessments') || cmd.includes('grades') || cmd.includes('quiz')) {
        navigateToRoute = '/assessments';
        responseMessage = 'Opening assessments and grades';
      } else if (cmd.includes('go home') || cmd.includes('course home') || cmd.includes('main page')) {
        navigateToRoute = '';
        responseMessage = 'Going to course home';
      } else if (cmd.includes('read page') || cmd.includes('read content') || cmd.includes('read this')) {
        responseMessage = 'Reading page content...';
        await speakContent();
        return;
      } else {
        responseMessage = 'Sorry, I didn\'t understand that command';
      }
    }
    
    // Provide voice feedback
    if (responseMessage) {
      await speakResponse(responseMessage, detectedLang);
    }
    
    // Navigate if route was determined
    if (navigateToRoute !== null) {
      setTimeout(() => {
        const currentPath = window.location.pathname.replace(/\/[^\/]*$/, '');
        window.location.href = currentPath + navigateToRoute;
      }, 1500); // Delay to allow voice feedback to complete
    }
  };

  // Simple fallback command processing
  const handleVoiceCommand = (command: string) => {
    const cmd = command.toLowerCase();
    
    // Simple voice navigation commands
    if (cmd.includes('go to modules') || cmd.includes('open modules')) {
      window.location.href = window.location.pathname.replace(/\/[^\/]*$/, '/modules');
    } else if (cmd.includes('go to assessments') || cmd.includes('open assessments')) {
      window.location.href = window.location.pathname.replace(/\/[^\/]*$/, '/assessments');
    } else if (cmd.includes('go home') || cmd.includes('course home')) {
      window.location.href = window.location.pathname.replace(/\/[^\/]*$/, '');
    } else if (cmd.includes('read page') || cmd.includes('read content')) {
      speakContent();
    }
  };

  const speakContent = async () => {
    const textToSpeak = getReadableContent();
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
          languageCode: language === 'rw' ? 'rw-RW' : 'en-US',
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
            URL.revokeObjectURL(result.audioUrl!);
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
        lang: language === 'rw' ? 'rw-RW' : 'en-US'
      });
      
      const estimatedDuration = text.length * 100;
      setTimeout(() => setIsSpeaking(false), estimatedDuration);
    } else {
      setIsSpeaking(false);
      console.error('Text-to-speech not supported');
    }
  };

  const stopSpeaking = () => {
    setIsSpeaking(false);
    
    if (currentAudio.current) {
      currentAudio.current.pause();
      currentAudio.current = null;
    }
    
    webSpeechFallback.stopSpeaking();
  };

  // Speak response messages like Siri/Alexa
  const speakResponse = async (message: string, lang: string = 'en') => {
    try {
      if (googleCloudAvailable) {
        console.log('🔊 Speaking response with Google TTS:', message);
        
        const result = await speechService.textToSpeech(message, {
          languageCode: lang === 'rw' ? 'rw-RW' : 'en-US',
          speakingRate: speechSettings.rate,
          pitch: speechSettings.pitch,
          ssmlGender: 'NEUTRAL'
        });

        if (result.success && result.audioUrl) {
          const audio = new Audio(result.audioUrl);
          audio.onended = () => URL.revokeObjectURL(result.audioUrl!);
          await audio.play();
        }
      } else {
        // Fallback to Web Speech
        webSpeechFallback.speak(message, {
          rate: speechSettings.rate,
          pitch: speechSettings.pitch,
          volume: speechSettings.volume,
          lang: lang === 'rw' ? 'rw-RW' : 'en-US'
        });
      }
    } catch (error) {
      console.warn('Response speech failed:', error);
    }
  };

  const webSupport = webSpeechFallback.isSupported();
  const hasAnySpeechSupport = googleCloudAvailable || webSupport.speechRecognition || webSupport.speechSynthesis;

  if (!hasAnySpeechSupport) {
    return null; // Don't show if no speech support available
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-b border-blue-200 dark:border-blue-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Compact Bar */}
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Accessibility className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-blue-800 dark:text-blue-200">
                {language === 'rw' ? 'Ubwisanzure' : 'Accessibility'}
              </span>
              {googleCloudAvailable ? (
                <Cloud className="w-4 h-4 text-green-500" />
              ) : (
                <Wifi className="w-4 h-4 text-blue-500" />
              )}
            </div>
            
            <Badge variant="info" className="text-xs">
              {healthStatus}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Action Buttons */}
            <Button
              onClick={isSpeaking ? stopSpeaking : speakContent}
              variant="outline"
              size="sm"
              className={`${isSpeaking ? 'bg-green-100 border-green-300 text-green-700' : 'text-blue-700 border-blue-300'}`}
              disabled={!getReadableContent()}
            >
              {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span className="ml-1">
                {isSpeaking 
                  ? (language === 'rw' ? 'Hagarika' : 'Stop') 
                  : (language === 'rw' ? 'Soma' : 'Read')
                }
              </span>
            </Button>

            <Button
              onClick={isListening ? stopListening : startListening}
              variant="outline"
              size="sm"
              className={`${isListening ? 'bg-red-100 border-red-300 text-red-700' : 'text-blue-700 border-blue-300'}`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span className="ml-1">
                {isListening 
                  ? (language === 'rw' ? 'Hagarika' : 'Stop')
                  : (language === 'rw' ? 'Umva' : 'Listen')
                }
              </span>
            </Button>

            <Button
              onClick={() => setIsExpanded(!isExpanded)}
              variant="ghost"
              size="sm"
              className="text-blue-700"
            >
              <Settings className="w-4 h-4" />
              {isExpanded ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
            </Button>
          </div>
        </div>

        {/* Expanded Settings */}
        {isExpanded && (
          <div className="pb-4 space-y-4 border-t border-blue-200 dark:border-blue-800 pt-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Voice Input Section */}
              {(webSupport.speechRecognition || googleCloudAvailable) && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    {language === 'rw' ? 'Ijwi rya Kwinjiza' : 'Voice Input'}
                  </h4>
                  {isListening && (
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      {language === 'rw' ? 'Ndumva...' : 'Listening...'}
                    </div>
                  )}
                  {transcript && (
                    <div className="text-xs bg-white dark:bg-gray-800 p-2 rounded border text-gray-700 dark:text-gray-300">
                      {transcript}
                    </div>
                  )}
                  <div className="text-xs text-blue-600 dark:text-blue-400">
                    {language === 'rw' 
                      ? 'Vuga: "Jya mu bice", "Fungura ibizamini", "Soma iki kibanza", "Jya mu rugo"'
                      : 'Say: "Go to modules", "Open assessments", "Read this page", "Go home"'
                    }
                  </div>
                </div>
              )}

              {/* Speech Settings */}
              {(webSupport.speechSynthesis || googleCloudAvailable) && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    {language === 'rw' ? 'Amabwiriza y\'Ijwi' : 'Voice Settings'}
                  </h4>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-16">{language === 'rw' ? 'Umuvuduko:' : 'Speed:'}</span>
                      <input
                        type="range"
                        min="0.5"
                        max="2"
                        step="0.1"
                        value={speechSettings.rate}
                        onChange={(e) => setSpeechSettings(prev => ({ ...prev, rate: parseFloat(e.target.value) }))}
                        className="flex-1 h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="w-8 text-blue-600">{speechSettings.rate}x</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-16">{language === 'rw' ? 'Ijwi:' : 'Pitch:'}</span>
                      <input
                        type="range"
                        min="0.5"
                        max="2"
                        step="0.1"
                        value={speechSettings.pitch}
                        onChange={(e) => setSpeechSettings(prev => ({ ...prev, pitch: parseFloat(e.target.value) }))}
                        className="flex-1 h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 