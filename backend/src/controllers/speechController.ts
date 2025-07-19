import { Request, Response } from 'express';
import fetch from 'node-fetch';

// Google Cloud Speech API endpoints
const SPEECH_TO_TEXT_URL = 'https://speech.googleapis.com/v1/speech:recognize';
const TEXT_TO_SPEECH_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';

interface SpeechToTextRequest {
  audioData: string; // base64 encoded audio
  languageCode?: string;
  sampleRateHertz?: number;
  enableLanguageDetection?: boolean;
}

interface TextToSpeechRequest {
  text: string;
  languageCode?: string;
  voiceName?: string;
  speakingRate?: number;
  pitch?: number;
  ssmlGender?: string;
}

// Google Cloud API response types
interface GoogleSTTResponse {
  results?: Array<{
    alternatives: Array<{
      transcript: string;
      confidence: number;
    }>;
    languageCode?: string;
  }>;
}

interface GoogleTTSResponse {
  audioContent: string;
}

// Enhanced navigation commands for both languages
const NAVIGATION_COMMANDS = {
  en: {
    home: ['go home', 'course home', 'home page', 'main page', 'back to home'],
    modules: ['go to modules', 'open modules', 'show modules', 'modules page', 'course modules'],
    assessments: ['go to assessments', 'open assessments', 'show assessments', 'grades', 'quiz', 'test'],
    grades: ['show grades', 'my grades', 'check grades', 'grade book', 'assessment results']
  },
  rw: {
    home: ['jya mu rugo', 'urupapuro rw\'ibanze', 'ibanze', 'urupapuro rukuru'],
    modules: ['jya mu bice', 'fungura ibice', 'erekana ibice', 'amabice y\'isomo'],
    assessments: ['jya mu bizamini', 'fungura ibizamini', 'erekana ibizamini', 'ibizamini'],
    grades: ['erekana amanota', 'amanota yanjye', 'reba amanota', 'igitabo cy\'amanota']
  }
};

// Response messages
const RESPONSES = {
  en: {
    navigating: 'Navigating to',
    home: 'Going to course home',
    modules: 'Opening course modules',
    assessments: 'Opening assessments and grades',
    grades: 'Showing your grades',
    notUnderstood: 'Sorry, I didn\'t understand that command',
    listening: 'I\'m listening...'
  },
  rw: {
    navigating: 'Ndajya muri',
    home: 'Ndajya mu rupapuro rw\'ibanze',
    modules: 'Ndafungura amabice y\'isomo',
    assessments: 'Ndafungura ibizamini n\'amanota',
    grades: 'Nderekanye amanota yawe',
    notUnderstood: 'Babyaye, sinumvise iyo ngingo',
    listening: 'Ndumva...'
  }
};

type ResponseKey = keyof typeof RESPONSES.en;

// Enhanced STT with automatic language detection
export const speechToText = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      audioData, 
      languageCode = 'en-US', 
      sampleRateHertz = 48000,
      enableLanguageDetection = true 
    }: SpeechToTextRequest = req.body;

    if (!audioData) {
      res.status(400).json({ error: 'Audio data is required' });
      return;
    }

    // For Kinyarwanda, use English as primary with Swahili as alternative
    const primaryLang = languageCode.startsWith('rw') ? 'en-US' : languageCode;
    const alternativeLanguages = languageCode.startsWith('rw') 
      ? ['en-US', 'sw-KE', 'fr-FR'] // English, Swahili, French - common in Rwanda
      : enableLanguageDetection ? ['en-US', 'sw-KE'] : undefined;

    const requestBody = {
      config: {
        encoding: 'WEBM_OPUS',
        sampleRateHertz,
        languageCode: enableLanguageDetection ? undefined : primaryLang,
        alternativeLanguageCodes: alternativeLanguages,
        enableAutomaticPunctuation: true,
        enableLanguageDetection,
        model: 'command_and_search', // Better for navigation commands
        useEnhanced: true, // Use enhanced models when available
      },
      audio: {
        content: audioData,
      },
    };

    const response = await fetch(`${SPEECH_TO_TEXT_URL}?key=${process.env.GOOGLE_CLOUD_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Speech-to-Text API error:', errorText);
      res.status(response.status).json({ error: 'Speech recognition failed', details: errorText });
      return;
    }

    const data = await response.json() as GoogleSTTResponse;
    
    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      if (result && result.alternatives && result.alternatives.length > 0) {
        const alternative = result.alternatives[0];
        if (alternative) {
          const transcript = alternative.transcript;
          const detectedLanguage = result.languageCode || primaryLang;
          
          // Process navigation command
          const navigationResult = processNavigationCommand(transcript, detectedLanguage);
          
          res.json({ 
            success: true, 
            transcript,
            detectedLanguage,
            navigation: navigationResult,
            confidence: alternative.confidence
          });
        } else {
          res.json({ success: false, error: 'No speech alternative data found' });
        }
      } else {
        res.json({ success: false, error: 'No speech alternatives found' });
      }
    } else {
      res.json({ success: false, error: 'No speech detected' });
    }
  } catch (error) {
    console.error('Speech-to-text error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Internal server error', details: errorMessage });
  }
};

// Process navigation commands
const processNavigationCommand = (transcript: string, detectedLanguage: string) => {
  const text = transcript.toLowerCase();
  const lang = detectedLanguage.startsWith('rw') || detectedLanguage.startsWith('sw') ? 'rw' : 'en';
  const commands = NAVIGATION_COMMANDS[lang];
  
  // Check for navigation commands
  for (const [action, phrases] of Object.entries(commands)) {
    for (const phrase of phrases) {
      if (text.includes(phrase)) {
        const responses = RESPONSES[lang];
        const actionKey = action as ResponseKey;
        
        return {
          action,
          message: responses[actionKey] || responses.notUnderstood,
          language: lang,
          route: getRouteForAction(action)
        };
      }
    }
  }
  
  return {
    action: 'unknown',
    message: RESPONSES[lang].notUnderstood,
    language: lang,
    route: null
  };
};

// Get route for action
const getRouteForAction = (action: string): string | null => {
  const routes: { [key: string]: string } = {
    home: '',
    modules: '/modules',
    assessments: '/assessments',
    grades: '/assessments'
  };
  return routes[action] || null;
};

// Enhanced TTS with improved Kinyarwanda handling
export const textToSpeech = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      text, 
      languageCode = 'en-US', 
      voiceName, 
      speakingRate = 1.0, 
      pitch = 0.0, 
      ssmlGender = 'NEUTRAL' 
    }: TextToSpeechRequest = req.body;

    if (!text) {
      res.status(400).json({ error: 'Text is required' });
      return;
    }

    // Auto-detect language if not specified
    const detectedLang = languageCode === 'auto' ? detectTextLanguage(text) : languageCode;
    
    // Prepare text with SSML for better pronunciation
    const enhancedText = prepareTextForTTS(text, detectedLang);
    
    // Get appropriate voice for language
    const voiceConfig = getVoiceConfig(detectedLang, ssmlGender, voiceName);

    const requestBody = {
      input: enhancedText.includes('<speak>') ? { ssml: enhancedText } : { text: enhancedText },
      voice: voiceConfig,
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: Math.max(0.25, Math.min(4.0, speakingRate)), // Ensure valid range
        pitch: Math.max(-20.0, Math.min(20.0, pitch)), // Ensure valid range
        volumeGainDb: 0.0,
        effectsProfileId: ['headphone-class-device'], // Optimize for headphones
      },
    };

    const response = await fetch(`${TEXT_TO_SPEECH_URL}?key=${process.env.GOOGLE_CLOUD_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Text-to-Speech API error:', errorText);
      res.status(response.status).json({ error: 'Text-to-speech failed', details: errorText });
      return;
    }

    const data = await response.json() as GoogleTTSResponse;
    
    if (data.audioContent) {
      res.json({ 
        success: true, 
        audioContent: data.audioContent,
        languageUsed: detectedLang,
        voiceUsed: voiceConfig
      });
    } else {
      res.json({ success: false, error: 'No audio generated' });
    }
  } catch (error) {
    console.error('Text-to-speech error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Internal server error', details: errorMessage });
  }
};

// Enhanced language detection for text
const detectTextLanguage = (text: string): string => {
  // Expanded Kinyarwanda word detection
  const kinyarwandaWords = [
    // Common words
    'muri', 'jya', 'erekana', 'fungura', 'amanota', 'ibice', 'rugo', 'ndumva',
    // Educational terms
    'isomo', 'kwiga', 'amasomo', 'umwarimu', 'umunyeshuri', 'ikizamini',
    'amateka', 'iterambere', 'ubumenyi', 'amahugurwa',
    // Navigation terms
    'garuka', 'komeza', 'tangira', 'reba', 'saba', 'emeza',
    // Common verbs
    'kora', 'gukora', 'gutangira', 'gukomeza', 'gusoma', 'kwandika'
  ];
  
  const textLower = text.toLowerCase();
  const words = textLower.split(/\s+/);
  
  // Count Kinyarwanda words
  const kinyarwandaCount = words.filter(word => 
    kinyarwandaWords.some(kw => word.includes(kw) || kw.includes(word))
  ).length;
  
  // If more than 20% of words are Kinyarwanda, consider it Kinyarwanda
  const isKinyarwanda = (kinyarwandaCount / words.length) > 0.2 || 
                        kinyarwandaWords.some(word => textLower.includes(word));
  
  return isKinyarwanda ? 'rw-RW' : 'en-US';
};

// Prepare text for better TTS pronunciation
const prepareTextForTTS = (text: string, languageCode: string): string => {
  if (!languageCode.startsWith('rw')) {
    return text;
  }

  // For Kinyarwanda, add SSML to improve pronunciation
  let enhancedText = text;

  // Common Kinyarwanda pronunciation improvements
  const pronunciationMap: { [key: string]: string } = {
    'Kinyarwanda': '<phoneme alphabet="ipa" ph="kiˌɲaɾˈwanda">Kinyarwanda</phoneme>',
    'Ubuntu': '<phoneme alphabet="ipa" ph="uˈbuntu">Ubuntu</phoneme>',
    'Rwandan': '<phoneme alphabet="ipa" ph="ɾuˈanda">Rwandan</phoneme>',
    'Kigali': '<phoneme alphabet="ipa" ph="kiˈɡali">Kigali</phoneme>',
    'Nyanza': '<phoneme alphabet="ipa" ph="ɲaˈnza">Nyanza</phoneme>',
    'Musanze': '<phoneme alphabet="ipa" ph="muˈsanze">Musanze</phoneme>'
  };

  // Apply pronunciation improvements
  for (const [word, phoneme] of Object.entries(pronunciationMap)) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    enhancedText = enhancedText.replace(regex, phoneme);
  }

  // Add pauses for better clarity
  enhancedText = enhancedText.replace(/[.!?]/g, '$&<break time="0.5s"/>');
  enhancedText = enhancedText.replace(/[,;]/g, '$&<break time="0.3s"/>');

  // Wrap in SSML if we made changes
  if (enhancedText !== text) {
    enhancedText = `<speak>${enhancedText}</speak>`;
  }

  return enhancedText;
};

// Improved voice configuration for better Kinyarwanda support
const getVoiceConfig = (languageCode: string, gender: string, customVoiceName?: string) => {
  if (customVoiceName) {
    return {
      languageCode: languageCode.startsWith('rw') ? 'en-US' : languageCode,
      name: customVoiceName,
      ssmlGender: gender
    };
  }

  if (languageCode.startsWith('rw')) {
    // For Kinyarwanda, use high-quality English voices with appropriate settings
    // English voices handle mixed content better than Swahili for Kinyarwanda
    return {
      languageCode: 'en-US',
      name: gender === 'FEMALE' ? 'en-US-Neural2-F' : 'en-US-Neural2-D', // High-quality neural voices
      ssmlGender: gender
    };
  } else if (languageCode.startsWith('sw')) {
    // For Swahili content
    return {
      languageCode: 'sw-KE',
      name: 'sw-KE-Standard-A',
      ssmlGender: gender
    };
  } else if (languageCode.startsWith('fr')) {
    // For French content (common in Rwanda)
    return {
      languageCode: 'fr-FR',
      name: gender === 'FEMALE' ? 'fr-FR-Neural2-F' : 'fr-FR-Neural2-G',
      ssmlGender: gender
    };
  } else {
    // For English and other languages
    return {
      languageCode: 'en-US',
      name: gender === 'FEMALE' ? 'en-US-Neural2-F' : 'en-US-Neural2-D',
      ssmlGender: gender
    };
  }
};

// Health check endpoint
export const checkHealth = async (req: Request, res: Response): Promise<void> => {
  try {
    const hasApiKey = !!process.env.GOOGLE_CLOUD_API_KEY;
    
    res.json({
      success: true,
      googleCloudAvailable: hasApiKey,
      status: hasApiKey ? 'Ready' : 'Available',
      supportedLanguages: {
        tts: ['en-US', 'rw-RW', 'sw-KE', 'fr-FR'],
        stt: ['en-US', 'sw-KE', 'fr-FR'],
        note: 'Kinyarwanda (rw-RW) uses enhanced English voices for better pronunciation'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      details: errorMessage
    });
  }
}; 