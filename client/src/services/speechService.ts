// Enhanced speech service with better navigation handling
// Focused on Web Speech API for accessibility navigation

export interface SpeechSettings {
  rate: number;
  pitch: number;
  volume: number;
  languageCode: string;
}

export interface SpeechRecognitionResult {
  success: boolean;
  text?: string;
  confidence?: number;
  error?: string;
}

export interface TextToSpeechResult {
  success: boolean;
  audioUrl?: string;
  error?: string;
}

export interface SpeechHealth {
  googleCloudAvailable: boolean;
  webSpeechAvailable: boolean;
  microphoneAvailable: boolean;
  overallStatus: 'excellent' | 'good' | 'limited' | 'unavailable';
}

class SpeechService {
  private isListening = false;
  private recognition: any = null;
  private synthesis: any = null;

  constructor() {
    this.initializeWebSpeech();
  }

  private initializeWebSpeech() {
    // Initialize Web Speech API
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
    }

    if ('speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
    }
  }

  async checkHealth(): Promise<SpeechHealth> {
    try {
      // For now, focus on Web Speech API availability
      const webSpeechAvailable = !!(this.recognition && this.synthesis);

      // Check microphone availability
      let microphoneAvailable = false;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        microphoneAvailable = true;
        stream.getTracks().forEach(track => track.stop());
      } catch (error) {
        console.warn('Microphone not available:', error);
      }

      // Determine overall status
      let overallStatus: SpeechHealth['overallStatus'] = 'unavailable';
      if (webSpeechAvailable && microphoneAvailable) {
        overallStatus = 'good';
      } else if (webSpeechAvailable || microphoneAvailable) {
        overallStatus = 'limited';
      }

      return {
        googleCloudAvailable: false, // Simplified for now
        webSpeechAvailable,
        microphoneAvailable,
        overallStatus
      };
    } catch (error) {
      console.error('Speech health check failed:', error);
      return {
        googleCloudAvailable: false,
        webSpeechAvailable: !!(this.recognition && this.synthesis),
        microphoneAvailable: false,
        overallStatus: 'unavailable'
      };
    }
  }

  // Web Speech API methods
  startListening(
    onResult: (text: string, isFinal: boolean) => void,
    onError: (error: string) => void,
    language: string = 'en-US'
  ): boolean {
    if (!this.recognition) {
      onError('Speech recognition not supported');
      return false;
    }

    try {
      this.recognition.lang = language;
      this.recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (interimTranscript) {
          onResult(interimTranscript, false);
        }
        if (finalTranscript) {
          onResult(finalTranscript, true);
        }
      };

      this.recognition.onerror = (event: any) => {
        onError(event.error);
      };

      this.recognition.onend = () => {
        this.isListening = false;
      };

      this.recognition.start();
      this.isListening = true;
      return true;
    } catch (error) {
      onError('Failed to start speech recognition');
      return false;
    }
  }

  stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  speak(text: string, settings: Partial<SpeechSettings> = {}): boolean {
    if (!this.synthesis) {
      return false;
    }

    try {
      // Stop any current speech
      this.synthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = settings.rate || 1.0;
      utterance.pitch = settings.pitch || 1.0;
      utterance.volume = settings.volume || 1.0;
      utterance.lang = settings.languageCode || 'en-US';

      this.synthesis.speak(utterance);
      return true;
    } catch (error) {
      console.error('Speech synthesis failed:', error);
      return false;
    }
  }

  stopSpeaking(): void {
    if (this.synthesis) {
      this.synthesis.cancel();
    }
  }

  isSupported(): { speechRecognition: boolean; speechSynthesis: boolean } {
    return {
      speechRecognition: !!this.recognition,
      speechSynthesis: !!this.synthesis
    };
  }
}

// Web Speech API fallback for when Google Cloud is not available
export class WebSpeechFallback {
  private recognition: any = null;
  private synthesis: any = null;

  constructor() {
    this.initialize();
  }

  private initialize() {
    // Initialize Web Speech API
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
    }

    if ('speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
    }
  }

  startListening(
    onResult: (text: string, isFinal: boolean) => void,
    onError: (error: string) => void,
    language: string = 'en-US'
  ): boolean {
    if (!this.recognition) {
      onError('Speech recognition not supported');
      return false;
    }

    try {
      this.recognition.lang = language;
      this.recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (interimTranscript) {
          onResult(interimTranscript, false);
        }
        if (finalTranscript) {
          onResult(finalTranscript, true);
        }
      };

      this.recognition.onerror = (event: any) => {
        onError(event.error);
      };

      this.recognition.start();
      return true;
    } catch (error) {
      onError('Failed to start speech recognition');
      return false;
    }
  }

  stopListening(): void {
    if (this.recognition) {
      this.recognition.stop();
    }
  }

  speak(text: string, settings: Partial<SpeechSettings> = {}): boolean {
    if (!this.synthesis) {
      return false;
    }

    try {
      // Stop any current speech
      this.synthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = settings.rate || 1.0;
      utterance.pitch = settings.pitch || 1.0;
      utterance.volume = settings.volume || 1.0;
      utterance.lang = settings.languageCode || 'en-US';

      this.synthesis.speak(utterance);
      return true;
    } catch (error) {
      console.error('Speech synthesis failed:', error);
      return false;
    }
  }

  stopSpeaking(): void {
    if (this.synthesis) {
      this.synthesis.cancel();
    }
  }

  isSupported(): { speechRecognition: boolean; speechSynthesis: boolean } {
    return {
      speechRecognition: !!this.recognition,
      speechSynthesis: !!this.synthesis
    };
  }
}

export const speechService = new SpeechService();
export const webSpeechFallback = new WebSpeechFallback(); 