import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { useTheme } from '../../contexts/ThemeContext';

interface CourseAccessibilityBarProps {
  pageContent?: string;
  courseTitle?: string;
}

export const CourseAccessibilityBar: React.FC<CourseAccessibilityBarProps> = ({
  pageContent,
  courseTitle
}) => {
  const navigate = useNavigate();
  const { id: courseId } = useParams<{ id: string }>();
  const { language } = useLanguage();
  const { theme } = useTheme();
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

  // Check speech service availability on mount
  useEffect(() => {
    const checkSpeechHealth = async () => {
      try {
        const health = await speechService.checkHealth();
        setGoogleCloudAvailable(health.webSpeechAvailable); // Use Web Speech as primary
        
        // Set health status based on availability
        if (health.webSpeechAvailable && health.microphoneAvailable) {
          setHealthStatus(language === 'rw' ? 'Bikora neza' : 'Ready');
        } else if (health.webSpeechAvailable) {
          setHealthStatus(language === 'rw' ? 'Bisanzwe' : 'Available');
        } else {
          setHealthStatus(language === 'rw' ? 'Ntibikora' : 'Unavailable');
        }
        
        console.log('🎤 Speech service health:', health);
      } catch (error) {
        console.warn('Speech service health check failed:', error);
        setGoogleCloudAvailable(false);
        setHealthStatus(language === 'rw' ? 'Ntibikora' : 'Unavailable');
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
    
    console.log('🎤 Starting voice recognition with Web Speech API');
    
    // Use Web Speech API for voice recognition
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
  };

  const stopListening = () => {
    setIsListening(false);
    webSpeechFallback.stopListening();
  };

  // Enhanced smart voice command processing like Siri/Alexa
  const handleSmartVoiceCommand = async (transcript: string, navigationResult?: any) => {
    const cmd = transcript.toLowerCase();
    
    // Detect language from the transcript
    const isKinyarwanda = /\b(jya|fungura|erekana|amanota|ibice|rugo|ndumva|muri|ahabanza|ibanze|tangira|subiramo|hera|ikizamini|module|igice)\b/i.test(transcript);
    const detectedLang = isKinyarwanda ? 'rw' : 'en';
    
    console.log('🗣️ Processing voice command:', transcript);
    console.log('🌍 Detected language:', detectedLang);
    
    // Navigation commands with voice feedback
    let navigateToRoute = '';
    let responseMessage = '';
    let specificAction = '';
    
    if (detectedLang === 'rw') {
      // Kinyarwanda commands
      if (cmd.includes('jya mu bice') || cmd.includes('fungura ibice') || cmd.includes('erekana ibice')) {
        navigateToRoute = '/modules';
        responseMessage = 'Ndafungura amabice y\'isomo';
      } else if (cmd.includes('jya mu bizamini') || cmd.includes('erekana amanota') || cmd.includes('fungura ibizamini')) {
        navigateToRoute = '/assessments';
        responseMessage = 'Ndafungura ibizamini n\'amanota';
      } else if (cmd.includes('jya mu rugo') || cmd.includes('urupapuro rukuru') || cmd.includes('ahabanza') || cmd.includes('ibanze')) {
        navigateToRoute = '';
        responseMessage = 'Ndajya mu rupapuro rw\'ibanze';
      } else if (cmd.includes('tangira igice') || cmd.includes('fungura igice') || cmd.includes('tangira module')) {
        specificAction = 'start_module';
        responseMessage = 'Ndafungura igice. Ongera ugerageze kuvuga igice ukeneye';
      } else if (cmd.includes('subiramo igice') || cmd.includes('reba igice')) {
        specificAction = 'review_module';
        responseMessage = 'Ndafungura igice kugirango usubiremo. Ongera ugerageze kuvuga igice ukeneye';
      } else if (cmd.includes('hera ikizamini') || cmd.includes('tangira ikizamini') || cmd.includes('fungura ikizamini')) {
        specificAction = 'take_quiz';
        responseMessage = 'Ndafungura ikizamini. Ongera ugerageze kuvuga ikizamini ukeneye';
      } else if (cmd.includes('subiramo ikizamini') || cmd.includes('reba ikizamini')) {
        specificAction = 'review_quiz';
        responseMessage = 'Ndafungura ikizamini kugirango usubiremo. Ongera ugerageze kuvuga ikizamini ukeneye';
      } else if (cmd.includes('hera ikizamini cya nyuma') || cmd.includes('ikizamini cya nyuma')) {
        specificAction = 'take_final_quiz';
        responseMessage = 'Ndafungura ikizamini cya nyuma';
      } else if (cmd.includes('komeza') || cmd.includes('ibikurikira')) {
        specificAction = 'continue_next';
        responseMessage = 'Ndakomeza ku gice gikurikira';
      } else if (cmd.includes('garuka inyuma') || cmd.includes('inyuma')) {
        specificAction = 'go_back';
        responseMessage = 'Ndagaruka inyuma';
      } else if (cmd.includes('soma') || cmd.includes('erekana') || cmd.includes('soma urupapuro')) {
        responseMessage = 'Ndashaka kusoma...';
        await speakContent();
        return;
      } else {
        responseMessage = 'Babyaye, sinumvise iyo ngingo. Ongera ugerageze';
      }
    } else {
      // English commands
      if (cmd.includes('go to modules') || cmd.includes('open modules') || cmd.includes('show modules') || cmd.includes('modules page')) {
        navigateToRoute = '/modules';
        responseMessage = 'Opening course modules';
      } else if (cmd.includes('go to assessments') || cmd.includes('open assessments') || cmd.includes('grades') || cmd.includes('quiz') || cmd.includes('test')) {
        navigateToRoute = '/assessments';
        responseMessage = 'Opening assessments and grades';
      } else if (cmd.includes('go home') || cmd.includes('course home') || cmd.includes('main page') || cmd.includes('overview')) {
        navigateToRoute = '';
        responseMessage = 'Going to course home';
      } else if (cmd.includes('start module') || cmd.includes('open module') || cmd.includes('begin module')) {
        specificAction = 'start_module';
        responseMessage = 'Opening module. Please specify which module you want to start';
      } else if (cmd.includes('review module') || cmd.includes('replay module') || cmd.includes('watch module')) {
        specificAction = 'review_module';
        responseMessage = 'Opening module for review. Please specify which module you want to review';
      } else if (cmd.includes('take quiz') || cmd.includes('start quiz') || cmd.includes('begin quiz')) {
        specificAction = 'take_quiz';
        responseMessage = 'Opening quiz. Please specify which quiz you want to take';
      } else if (cmd.includes('review quiz') || cmd.includes('replay quiz') || cmd.includes('retake quiz')) {
        specificAction = 'review_quiz';
        responseMessage = 'Opening quiz for review. Please specify which quiz you want to review';
      } else if (cmd.includes('take final quiz') || cmd.includes('final assessment') || cmd.includes('final exam')) {
        specificAction = 'take_final_quiz';
        responseMessage = 'Opening final assessment';
      } else if (cmd.includes('continue') || cmd.includes('next') || cmd.includes('proceed')) {
        specificAction = 'continue_next';
        responseMessage = 'Continuing to next section';
      } else if (cmd.includes('go back') || cmd.includes('previous') || cmd.includes('back')) {
        specificAction = 'go_back';
        responseMessage = 'Going back';
      } else if (cmd.includes('read page') || cmd.includes('read content') || cmd.includes('read this') || cmd.includes('speak content')) {
        responseMessage = 'Reading page content...';
        await speakContent();
        return;
      } else {
        responseMessage = 'Sorry, I didn\'t understand that command. Please try again';
      }
    }
    
    // Provide voice feedback
    if (responseMessage) {
      await speakResponse(responseMessage, detectedLang);
    }
    
    // Handle specific actions
    if (specificAction) {
      setTimeout(() => {
        handleSpecificAction(specificAction, transcript, detectedLang);
      }, 1500);
      return;
    }
    
    // Navigate if route was determined using React Router
    if (navigateToRoute !== null && courseId) {
      setTimeout(() => {
        try {
          const targetPath = navigateToRoute === '' 
            ? `/course/${courseId}` 
            : `/course/${courseId}${navigateToRoute}`;
          console.log('🧭 Navigating to:', targetPath);
          navigate(targetPath);
        } catch (navigationError) {
          console.error('Navigation error:', navigationError);
          // Fallback to window.location if React Router fails
          const fallbackPath = navigateToRoute === '' 
            ? `/course/${courseId}` 
            : `/course/${courseId}${navigateToRoute}`;
          window.location.href = fallbackPath;
        }
      }, 1500); // Delay to allow voice feedback to complete
    }
  };

  // Handle specific actions like starting modules, taking quizzes, etc.
  const handleSpecificAction = (action: string, transcript: string, language: string) => {
    if (!courseId) return;

    try {
      switch (action) {
        case 'start_module':
        case 'review_module':
          // Extract module number or name from transcript
          const moduleMatch = transcript.match(/(?:module|igice)\s*(\d+)/i);
          if (moduleMatch) {
            const moduleNumber = parseInt(moduleMatch[1]);
            // Navigate to modules page - the component will handle specific module selection
            navigate(`/course/${courseId}/modules`);
            // Dispatch event to highlight specific module
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('highlightModule', {
                detail: { moduleNumber, action }
              }));
            }, 500);
          } else {
            // Navigate to modules page for general module selection
            navigate(`/course/${courseId}/modules`);
          }
          break;

        case 'take_quiz':
        case 'review_quiz':
          // Navigate to assessments page
          navigate(`/course/${courseId}/assessments`);
          // Dispatch event to highlight specific quiz
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('highlightQuiz', {
              detail: { action }
            }));
          }, 500);
          break;

        case 'take_final_quiz':
          // Navigate to assessments page and look for final quiz
          navigate(`/course/${courseId}/assessments`);
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('highlightFinalQuiz', {
              detail: { action }
            }));
          }, 500);
          break;

        case 'continue_next':
          // Try to continue to next available action
          const currentPath = window.location.pathname;
          if (currentPath.includes('/modules')) {
            // If on modules page, try to start next module
            window.dispatchEvent(new CustomEvent('continueNextModule'));
          } else if (currentPath.includes('/assessments')) {
            // If on assessments page, try to take next quiz
            window.dispatchEvent(new CustomEvent('continueNextQuiz'));
          } else {
            // Default: go to modules
            navigate(`/course/${courseId}/modules`);
          }
          break;

        case 'go_back':
          // Go back in history
          window.history.back();
          break;
      }
    } catch (error) {
      console.error('Error handling specific action:', error);
    }
  };

  // Simple fallback command processing with React Router navigation
  const handleVoiceCommand = (command: string) => {
    const cmd = command.toLowerCase();
    
    if (!courseId) {
      console.error('Course ID not available for navigation');
      return;
    }
    
    // Simple voice navigation commands using React Router
    if (cmd.includes('go to modules') || cmd.includes('open modules')) {
      navigate(`/course/${courseId}/modules`);
    } else if (cmd.includes('go to assessments') || cmd.includes('open assessments')) {
      navigate(`/course/${courseId}/assessments`);
    } else if (cmd.includes('go home') || cmd.includes('course home')) {
      navigate(`/course/${courseId}`);
    } else if (cmd.includes('read page') || cmd.includes('read content')) {
      speakContent();
    }
  };

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle keyboard shortcuts when accessibility bar is focused or when Ctrl/Cmd is pressed
      if (event.ctrlKey || event.metaKey || document.activeElement?.closest('[data-accessibility-bar]')) {
        switch (event.key.toLowerCase()) {
          case '1':
            if (courseId) {
              event.preventDefault();
              navigate(`/course/${courseId}`);
              speakResponse('Navigating to course home', 'en');
            }
            break;
          case '2':
            if (courseId) {
              event.preventDefault();
              navigate(`/course/${courseId}/modules`);
              speakResponse('Navigating to modules', 'en');
            }
            break;
          case '3':
            if (courseId) {
              event.preventDefault();
              navigate(`/course/${courseId}/assessments`);
              speakResponse('Navigating to assessments', 'en');
            }
            break;
          case '4':
            if (courseId) {
              event.preventDefault();
              // Navigate to next available module
              window.dispatchEvent(new CustomEvent('continueNextModule'));
              speakResponse('Continuing to next module', 'en');
            }
            break;
          case '5':
            if (courseId) {
              event.preventDefault();
              // Navigate to next available quiz
              window.dispatchEvent(new CustomEvent('continueNextQuiz'));
              speakResponse('Continuing to next quiz', 'en');
            }
            break;
          case 'r':
            if (event.ctrlKey || event.metaKey) {
              event.preventDefault();
              speakContent();
            }
            break;
          case 'm':
            if (event.ctrlKey || event.metaKey) {
              event.preventDefault();
              if (isListening) {
                stopListening();
              } else {
                startListening();
              }
            }
            break;
          case 'n':
            if (event.ctrlKey || event.metaKey) {
              event.preventDefault();
              // Continue to next action
              const currentPath = window.location.pathname;
              if (currentPath.includes('/modules')) {
                window.dispatchEvent(new CustomEvent('continueNextModule'));
                speakResponse('Continuing to next module', 'en');
              } else if (currentPath.includes('/assessments')) {
                window.dispatchEvent(new CustomEvent('continueNextQuiz'));
                speakResponse('Continuing to next quiz', 'en');
              } else {
                navigate(`/course/${courseId}/modules`);
                speakResponse('Navigating to modules', 'en');
              }
            }
            break;
          case 'b':
            if (event.ctrlKey || event.metaKey) {
              event.preventDefault();
              window.history.back();
              speakResponse('Going back', 'en');
            }
            break;
          case 's':
            if (event.ctrlKey || event.metaKey) {
              event.preventDefault();
              // Start current module or quiz
              const currentPath = window.location.pathname;
              if (currentPath.includes('/module/')) {
                window.dispatchEvent(new CustomEvent('startCurrentModule'));
                speakResponse('Starting current module', 'en');
              } else if (currentPath.includes('/assessments')) {
                window.dispatchEvent(new CustomEvent('startCurrentQuiz'));
                speakResponse('Starting current quiz', 'en');
              }
            }
            break;
          case 'c':
            if (event.ctrlKey || event.metaKey) {
              event.preventDefault();
              // Complete current module or submit quiz
              const currentPath = window.location.pathname;
              if (currentPath.includes('/module/')) {
                window.dispatchEvent(new CustomEvent('completeCurrentModule'));
                speakResponse('Completing current module', 'en');
              } else if (currentPath.includes('/assessments')) {
                window.dispatchEvent(new CustomEvent('submitCurrentQuiz'));
                speakResponse('Submitting current quiz', 'en');
              }
            }
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [courseId, isListening, navigate]);

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
      // Use Web Speech API for text-to-speech
      const success = webSpeechFallback.speak(textToSpeak, {
        rate: speechSettings.rate,
        pitch: speechSettings.pitch,
        volume: speechSettings.volume,
        languageCode: language === 'rw' ? 'rw-RW' : 'en-US'
      });

      if (success) {
        // Estimate duration for UI feedback
        const estimatedDuration = textToSpeak.length * 100;
        setTimeout(() => setIsSpeaking(false), estimatedDuration);
      } else {
        setIsSpeaking(false);
        console.warn('Text-to-speech failed');
      }
    } catch (error) {
      console.warn('Speech synthesis error:', error);
      setIsSpeaking(false);
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
        languageCode: language === 'rw' ? 'rw-RW' : 'en-US'
      });
      
      const estimatedDuration = text.length * 100;
      setTimeout(() => setIsSpeaking(false), estimatedDuration);
    } else {
      setIsSpeaking(false);
      console.error('Text-to-speech not supported');
    }
  };

  const stopSpeaking = () => {
    if (currentAudio.current) {
      currentAudio.current.pause();
      currentAudio.current = null;
    }
    webSpeechFallback.stopSpeaking();
    setIsSpeaking(false);
  };

  const speakResponse = async (message: string, lang: string = 'en') => {
    try {
      const success = webSpeechFallback.speak(message, {
        rate: speechSettings.rate,
        pitch: speechSettings.pitch,
        volume: speechSettings.volume,
        languageCode: lang === 'rw' ? 'rw-RW' : 'en-US'
      });

      if (!success) {
        // Fallback to Web Speech
        fallbackToWebTTS(message);
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
    <div 
      data-accessibility-bar="true"
      className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-b border-blue-200 dark:border-blue-800"
    >
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
              title={language === 'rw' ? 'Soma urupapuro (Ctrl+R)' : 'Read page (Ctrl+R)'}
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
              title={language === 'rw' ? 'Umva ijwi (Ctrl+M)' : 'Voice commands (Ctrl+M)'}
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
              title={language === 'rw' ? 'Igenamiterere' : 'Settings'}
            >
              <Settings className="w-4 h-4" />
              {isExpanded ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
            </Button>
          </div>
        </div>

        {/* Expanded Settings */}
        {isExpanded && (
          <div className="pb-4 space-y-4 border-t border-blue-200 dark:border-blue-800 pt-4">
            {/* Keyboard Navigation Help */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                {language === 'rw' ? 'Uburyo bwo Kwinjiza' : 'Keyboard Shortcuts'}
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-white dark:bg-gray-700 rounded text-xs">1</kbd>
                  <span className="text-blue-700 dark:text-blue-300">
                    {language === 'rw' ? 'Ahabanza' : 'Home'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-white dark:bg-gray-700 rounded text-xs">2</kbd>
                  <span className="text-blue-700 dark:text-blue-300">
                    {language === 'rw' ? 'Ibice' : 'Modules'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-white dark:bg-gray-700 rounded text-xs">3</kbd>
                  <span className="text-blue-700 dark:text-blue-300">
                    {language === 'rw' ? 'Ibizamini' : 'Assessments'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-white dark:bg-gray-700 rounded text-xs">4</kbd>
                  <span className="text-blue-700 dark:text-blue-300">
                    {language === 'rw' ? 'Igice Gikurikira' : 'Next Module'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-white dark:bg-gray-700 rounded text-xs">5</kbd>
                  <span className="text-blue-700 dark:text-blue-300">
                    {language === 'rw' ? 'Ikizamini Gikurikira' : 'Next Quiz'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-white dark:bg-gray-700 rounded text-xs">Ctrl+R</kbd>
                  <span className="text-blue-700 dark:text-blue-300">
                    {language === 'rw' ? 'Soma' : 'Read'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-white dark:bg-gray-700 rounded text-xs">Ctrl+M</kbd>
                  <span className="text-blue-700 dark:text-blue-300">
                    {language === 'rw' ? 'Umva' : 'Listen'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-white dark:bg-gray-700 rounded text-xs">Ctrl+N</kbd>
                  <span className="text-blue-700 dark:text-blue-300">
                    {language === 'rw' ? 'Komeza' : 'Continue'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-white dark:bg-gray-700 rounded text-xs">Ctrl+B</kbd>
                  <span className="text-blue-700 dark:text-blue-300">
                    {language === 'rw' ? 'Garuka' : 'Back'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-white dark:bg-gray-700 rounded text-xs">Ctrl+S</kbd>
                  <span className="text-blue-700 dark:text-blue-300">
                    {language === 'rw' ? 'Tangira' : 'Start'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-white dark:bg-gray-700 rounded text-xs">Ctrl+C</kbd>
                  <span className="text-blue-700 dark:text-blue-300">
                    {language === 'rw' ? 'Rangiza' : 'Complete'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-white dark:bg-gray-700 rounded text-xs">Ctrl+Enter</kbd>
                  <span className="text-blue-700 dark:text-blue-300">
                    {language === 'rw' ? 'Hera Ikizamini' : 'Submit Quiz'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-white dark:bg-gray-700 rounded text-xs">Space</kbd>
                  <span className="text-blue-700 dark:text-blue-300">
                    {language === 'rw' ? 'Fata Ikibazo' : 'Flag Question'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-white dark:bg-gray-700 rounded text-xs">H</kbd>
                  <span className="text-blue-700 dark:text-blue-300">
                    {language === 'rw' ? 'Ubufasha' : 'Hint'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-white dark:bg-gray-700 rounded text-xs">1-9</kbd>
                  <span className="text-blue-700 dark:text-blue-300">
                    {language === 'rw' ? 'Ikibazo' : 'Question'}
                  </span>
                </div>
              </div>
            </div>

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
                      <span>{transcript || (language === 'rw' ? 'Ndumva...' : 'Listening...')}</span>
                    </div>
                  )}
                  
                  {/* Voice Commands Help */}
                  <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                    <div className="font-medium">
                      {language === 'rw' ? 'Amabwiriza y\'Ijwi:' : 'Voice Commands:'}
                    </div>
                    <div>
                      <strong>EN:</strong> "Go to modules", "Open assessments", "Course home", "Take quiz", "Start module"
                    </div>
                    <div>
                      <strong>RW:</strong> "Jya mu bice", "Fungura ibizamini", "Ahabanza", "Herera ikizamini", "Tangira igice"
                    </div>
                    <div>
                      <strong>Quiz:</strong> "Submit quiz", "Next question", "Previous question", "Use hint"
                    </div>
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