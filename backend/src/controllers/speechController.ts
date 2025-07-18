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
  ssmlGender?: 'NEUTRAL' | 'FEMALE' | 'MALE';
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
  audioContent?: string;
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

    const requestBody = {
      config: {
        encoding: 'WEBM_OPUS',
        sampleRateHertz,
        languageCode: enableLanguageDetection ? undefined : languageCode,
        alternativeLanguageCodes: enableLanguageDetection ? ['en-US', 'rw-RW'] : undefined,
        enableAutomaticPunctuation: true,
        enableLanguageDetection,
        model: 'command_and_search', // Better for navigation commands
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
          const detectedLanguage = result.languageCode || languageCode;
          
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
  const lang = detectedLanguage.startsWith('rw') ? 'rw' : 'en';
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

// Get route mapping for navigation
const getRouteForAction = (action: string): string | null => {
  const routes: Record<string, string> = {
    home: '',
    modules: '/modules', 
    assessments: '/assessments',
    grades: '/assessments' // Same as assessments for now
  };
  
  return routes[action] || null;
};

// Enhanced TTS with language detection
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
    
    // Get appropriate voice for language
    const voiceConfig = getVoiceConfig(detectedLang, ssmlGender);

    const requestBody = {
      input: { text },
      voice: voiceConfig,
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate,
        pitch,
        volumeGainDb: 0.0,
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
        languageUsed: detectedLang
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

// Simple language detection for text
const detectTextLanguage = (text: string): string => {
  // Simple heuristic - check for common Kinyarwanda words
  const kinyarwandaWords = ['muri', 'jya', 'erekana', 'fungura', 'amanota', 'ibice', 'rugo', 'ndumva'];
  const textLower = text.toLowerCase();
  
  const hasKinyarwanda = kinyarwandaWords.some(word => textLower.includes(word));
  return hasKinyarwanda ? 'rw-RW' : 'en-US';
};

// Get voice configuration for language
const getVoiceConfig = (languageCode: string, gender: string) => {
  if (languageCode.startsWith('rw')) {
    // Use Swahili as closest available for Kinyarwanda
    return {
      languageCode: 'sw-KE',
      name: 'sw-KE-Standard-A',
      ssmlGender: gender
    };
  } else {
    return {
      languageCode: 'en-US',
      name: 'en-US-Neural2-D',
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