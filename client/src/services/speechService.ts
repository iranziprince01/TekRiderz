// Secure Speech Service - calls backend APIs instead of Google Cloud directly
import { apiClient } from '../utils/api';

export interface SpeechToTextOptions {
  languageCode?: string;
  sampleRateHertz?: number;
  enableLanguageDetection?: boolean;
}

export interface TextToSpeechOptions {
  languageCode?: string;
  voiceName?: string;
  speakingRate?: number;
  pitch?: number;
  ssmlGender?: 'NEUTRAL' | 'FEMALE' | 'MALE';
}

export interface SpeechHealthResponse {
  success: boolean;
  googleCloudAvailable: boolean;
  status: string;
  supportedLanguages?: {
    tts: string[];
    stt: string[];
    note?: string;
  };
  timestamp: string;
}

class SecureSpeechService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NODE_ENV === 'production' 
      ? '/api' 
      : 'http://localhost:3001/api';
  }

  /**
   * Get authentication token for API requests
   */
  private async getAuthToken(): Promise<string | null> {
    try {
      const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
      return token;
    } catch (error) {
      console.warn('Could not retrieve auth token:', error);
      return null;
    }
  }

  /**
   * Convert blob to base64 string
   */
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Convert base64 to blob
   */
  private base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  /**
   * Detect language from text content
   */
  private detectLanguageFromText(text: string): string {
    // Enhanced Kinyarwanda detection
    const kinyarwandaWords = [
      // Common words
      'muri', 'jya', 'erekana', 'fungura', 'amanota', 'ibice', 'rugo', 'ndumva',
      // Educational terms
      'isomo', 'kwiga', 'amasomo', 'umwarimu', 'umunyeshuri', 'ikizamini',
      'amateka', 'iterambere', 'ubumenyi', 'amahugurwa',
      // Navigation terms
      'garuka', 'komeza', 'tangira', 'reba', 'saba', 'emeza',
      // Common verbs and adjectives
      'kora', 'gukora', 'gutangira', 'gukomeza', 'gusoma', 'kwandika',
      'neza', 'byiza', 'bya', 'mu', 'ku', 'na', 'ni'
    ];

    const textLower = text.toLowerCase();
    const words = textLower.split(/\s+/).filter(word => word.length > 1);
    
    if (words.length === 0) return 'en-US';
    
    const kinyarwandaCount = words.filter(word => 
      kinyarwandaWords.some(kw => word.includes(kw) || kw.includes(word))
    ).length;
    
    // If more than 15% of words are Kinyarwanda, consider it Kinyarwanda
    const isKinyarwanda = (kinyarwandaCount / words.length) > 0.15 || 
                          kinyarwandaWords.some(word => textLower.includes(word));
    
    return isKinyarwanda ? 'rw-RW' : 'en-US';
  }

  /**
   * Get optimal TTS settings for different languages
   */
  private getOptimalTTSSettings(languageCode: string, text: string): Partial<TextToSpeechOptions> {
    const baseSettings: Partial<TextToSpeechOptions> = {
      speakingRate: 1.0,
      pitch: 0.0,
      ssmlGender: 'NEUTRAL'
    };

    if (languageCode.startsWith('rw')) {
      // Kinyarwanda optimization
      return {
        ...baseSettings,
        speakingRate: 0.9, // Slightly slower for clarity
        pitch: 0.0,
        ssmlGender: 'FEMALE', // Female voices often have better clarity for Kinyarwanda
        languageCode: 'rw-RW' // Backend will handle the voice mapping
      };
    } else if (languageCode.startsWith('en')) {
      // English optimization
      return {
        ...baseSettings,
        speakingRate: 1.0,
        pitch: 0.0,
        ssmlGender: 'NEUTRAL'
      };
    } else if (languageCode.startsWith('fr')) {
      // French optimization (common in Rwanda)
      return {
        ...baseSettings,
        speakingRate: 0.95,
        pitch: 0.0,
        ssmlGender: 'FEMALE'
      };
    }

    return baseSettings;
  }

  /**
   * Check backend speech service health
   */
  async checkHealth(): Promise<SpeechHealthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/speech/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Speech health check error:', error);
      return {
        success: false,
        googleCloudAvailable: false,
        status: 'Unavailable',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Convert audio to text using backend Google Cloud Speech-to-Text
   */
  async speechToText(audioBlob: Blob, options: SpeechToTextOptions = {}): Promise<{
    success: boolean;
    transcript: string;
    confidence: number;
    detectedLanguage?: string;
    navigation?: any;
    error?: string;
  }> {
    try {
      // Convert audio blob to base64
      const audioData = await this.blobToBase64(audioBlob);
      
      // Auto-detect language for STT if not specified
      const defaultLanguage = options.languageCode || 'en-US';
      
      const requestBody = {
        audioData,
        languageCode: defaultLanguage,
        sampleRateHertz: options.sampleRateHertz || 48000,
        enableLanguageDetection: options.enableLanguageDetection !== false // Default to true
      };

      // Get auth token for the request
      const token = await this.getAuthToken();
      
      const response = await fetch(`${this.baseUrl}/speech-to-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Speech-to-text service error:', error);
      return {
        success: false,
        transcript: '',
        confidence: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Convert text to speech using backend Google Cloud Text-to-Speech with enhanced Kinyarwanda support
   */
  async textToSpeech(text: string, options: TextToSpeechOptions = {}): Promise<{
    success: boolean;
    audioUrl?: string;
    languageUsed?: string;
    voiceUsed?: any;
    error?: string;
  }> {
    try {
      if (!text.trim()) {
        throw new Error('Text is required');
      }

      // Auto-detect language if not provided
      const detectedLanguage = options.languageCode || this.detectLanguageFromText(text);
      
      // Get optimal settings for the detected language
      const optimalSettings = this.getOptimalTTSSettings(detectedLanguage, text);
      
      // Merge user options with optimal settings (user options take precedence)
      const finalOptions = {
        ...optimalSettings,
        ...options,
        languageCode: options.languageCode || detectedLanguage
      };

      const requestBody = {
        text: text.trim(),
        languageCode: finalOptions.languageCode,
        voiceName: finalOptions.voiceName,
        speakingRate: finalOptions.speakingRate || 1.0,
        pitch: finalOptions.pitch || 0.0,
        ssmlGender: finalOptions.ssmlGender || 'NEUTRAL'
      };

      // Get auth token for the request
      const token = await this.getAuthToken();

      const response = await fetch(`${this.baseUrl}/text-to-speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success && result.audioContent) {
        // Convert base64 audio to blob URL
        const audioBlob = this.base64ToBlob(result.audioContent, 'audio/mp3');
        const audioUrl = URL.createObjectURL(audioBlob);
        
        return {
          success: true,
          audioUrl,
          languageUsed: result.languageUsed,
          voiceUsed: result.voiceUsed
        };
      }

      throw new Error(result.error || 'Invalid response from speech service');
    } catch (error) {
      console.error('Text-to-speech service error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Enhanced text-to-speech specifically optimized for course content
   */
  async speakCourseContent(text: string, language: 'en' | 'rw' = 'en'): Promise<{
    success: boolean;
    audioUrl?: string;
    error?: string;
  }> {
    const languageCode = language === 'rw' ? 'rw-RW' : 'en-US';
    
    // Course-specific optimizations
    const courseOptimizedOptions: TextToSpeechOptions = {
      languageCode,
      speakingRate: language === 'rw' ? 0.85 : 0.95, // Slower for better comprehension
      pitch: 0.0,
      ssmlGender: 'FEMALE' // Generally clearer for educational content
    };

    return this.textToSpeech(text, courseOptimizedOptions);
  }
}

// Export singleton instance
export const speechService = new SecureSpeechService();

// Legacy Web Speech API fallback (for when backend is not available)
export class WebSpeechFallback {
  private recognition: any = null;
  private synth!: SpeechSynthesis;
  private supported = {
    speechRecognition: false,
    speechSynthesis: false
  };

  constructor() {
    // Check browser support
    this.supported.speechRecognition = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    this.supported.speechSynthesis = 'speechSynthesis' in window;
    
    if (this.supported.speechRecognition) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
    }

    if (this.supported.speechSynthesis) {
      this.synth = window.speechSynthesis;
    }
  }

  isSupported() {
    return this.supported;
  }

  startListening(
    onResult: (transcript: string, isFinal: boolean) => void,
    onError: (error: string) => void,
    language: string = 'en-US'
  ) {
    if (!this.supported.speechRecognition || !this.recognition) {
      onError('Speech recognition not supported');
      return;
    }

    // For Kinyarwanda, use English as fallback for Web Speech API
    const fallbackLanguage = language.startsWith('rw') ? 'en-US' : language;
    
    this.recognition.lang = fallbackLanguage;
    
    this.recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        onResult(result[0].transcript, result.isFinal);
      }
    };

    this.recognition.onerror = (event: any) => {
      onError(event.error);
    };

    this.recognition.onend = () => {
      // Auto-restart if needed
    };

    this.recognition.start();
  }

  stopListening() {
    if (this.recognition) {
      this.recognition.stop();
    }
  }

  speak(
    text: string, 
    options: {
      rate?: number;
      pitch?: number;
      volume?: number;
      lang?: string;
    } = {}
  ) {
    if (!this.supported.speechSynthesis) {
      console.error('Speech synthesis not supported');
      return;
    }

    // Cancel any ongoing speech
    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set language - for Kinyarwanda, use English with slower rate
    if (options.lang?.startsWith('rw')) {
      utterance.lang = 'en-US';
      utterance.rate = options.rate ? options.rate * 0.8 : 0.8; // Slower for Kinyarwanda content
    } else {
      utterance.lang = options.lang || 'en-US';
      utterance.rate = options.rate || 1.0;
    }
    
    utterance.pitch = options.pitch || 1.0;
    utterance.volume = options.volume || 1.0;

    // Try to select a suitable voice
    const voices = this.synth.getVoices();
    const preferredVoice = voices.find(voice => 
      voice.lang === utterance.lang && voice.name.includes('Female')
    ) || voices.find(voice => voice.lang === utterance.lang);
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    this.synth.speak(utterance);
  }

  stopSpeaking() {
    if (this.synth) {
      this.synth.cancel();
    }
  }
}

export const webSpeechFallback = new WebSpeechFallback(); 