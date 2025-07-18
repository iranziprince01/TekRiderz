// Secure Speech Service - calls backend APIs instead of Google Cloud directly
import { apiClient } from '../utils/api';

export interface SpeechToTextOptions {
  languageCode?: string;
  sampleRateHertz?: number;
}

export interface TextToSpeechOptions {
  languageCode?: string;
  voiceName?: string;
  speakingRate?: number;
  pitch?: number;
  ssmlGender?: 'NEUTRAL' | 'FEMALE' | 'MALE';
}

export interface SpeechHealthStatus {
  success: boolean;
  googleCloudAvailable: boolean;
  webSpeechFallback: boolean;
  status: string;
}

class SecureSpeechService {
  private baseUrl = '/api/v1/speech';

  /**
   * Check if backend speech services are available
   */
  async checkHealth(): Promise<SpeechHealthStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.warn('Speech service health check failed:', error);
      return {
        success: false,
        googleCloudAvailable: false,
        webSpeechFallback: true,
        status: 'Backend speech services unavailable'
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
    error?: string;
  }> {
    try {
      // Convert audio blob to base64
      const audioData = await this.blobToBase64(audioBlob);
      
      const requestBody = {
        audioData,
        languageCode: options.languageCode || 'en-US',
        sampleRateHertz: options.sampleRateHertz || 48000
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
   * Convert text to speech using backend Google Cloud Text-to-Speech
   */
  async textToSpeech(text: string, options: TextToSpeechOptions = {}): Promise<{
    success: boolean;
    audioUrl?: string;
    error?: string;
  }> {
    try {
      if (!text.trim()) {
        throw new Error('Text is required');
      }

      const requestBody = {
        text: text.trim(),
        languageCode: options.languageCode || 'en-US',
        voiceName: options.voiceName,
        speakingRate: options.speakingRate || 1.0,
        pitch: options.pitch || 0.0,
        ssmlGender: options.ssmlGender || 'NEUTRAL'
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
          audioUrl
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
   * Get authentication token from the API client
   */
  private async getAuthToken(): Promise<string | null> {
    try {
      // Use the same token storage as the API client
      const tokenStorage = (apiClient as any).tokenStorage;
      if (tokenStorage && typeof tokenStorage.getToken === 'function') {
        return await tokenStorage.getToken();
      }
      return null;
    } catch (error) {
      console.warn('Failed to get auth token:', error);
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
        if (typeof reader.result === 'string') {
          // Remove data URL prefix (e.g., "data:audio/webm;base64,")
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to convert blob to base64'));
        }
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
    }

    if (this.supported.speechSynthesis) {
      this.synth = window.speechSynthesis;
    }
  }

  isSupported() {
    return this.supported;
  }

  startListening(onResult: (text: string, isFinal: boolean) => void, onError?: (error: string) => void) {
    if (!this.recognition) {
      onError?.('Speech recognition not supported');
      return;
    }

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

      onResult(finalTranscript || interimTranscript, !!finalTranscript);
    };

    this.recognition.onerror = (event: any) => {
      onError?.(event.error);
    };

    this.recognition.start();
  }

  stopListening() {
    if (this.recognition) {
      this.recognition.stop();
    }
  }

  speak(text: string, options: { rate?: number; pitch?: number; volume?: number; lang?: string } = {}) {
    if (!this.supported.speechSynthesis || !text.trim()) return;

    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options.rate || 1;
    utterance.pitch = options.pitch || 1;
    utterance.volume = options.volume || 1;
    utterance.lang = options.lang || 'en-US';

    this.synth.speak(utterance);
  }

  stopSpeaking() {
    if (this.supported.speechSynthesis) {
      this.synth.cancel();
    }
  }
}

export const webSpeechFallback = new WebSpeechFallback(); 