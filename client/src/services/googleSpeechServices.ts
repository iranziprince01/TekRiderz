// Google Cloud Speech Services (Optional Upgrade)
// Uncomment and configure when ready to use Google Cloud APIs

export interface GoogleCloudConfig {
  apiKey: string;
  projectId?: string;
  region?: string;
}

export class GoogleCloudSpeechToText {
  private config: GoogleCloudConfig;
  private isAvailable = false;

  constructor(config: GoogleCloudConfig) {
    this.config = config;
    this.isAvailable = !!config.apiKey;
  }

  async transcribeAudio(audioBlob: Blob, options: {
    languageCode?: string;
    enableAutomaticPunctuation?: boolean;
    enableWordTimeOffsets?: boolean;
  } = {}): Promise<{ transcript: string; confidence: number; words?: any[] }> {
    if (!this.isAvailable) {
      throw new Error('Google Cloud Speech API not configured');
    }

    // Convert audio blob to base64
    const audioBase64 = await this.blobToBase64(audioBlob);

    const requestBody = {
      config: {
        encoding: 'WEBM_OPUS', // or 'LINEAR16' depending on your audio format
        sampleRateHertz: 48000, // Adjust based on your audio
        languageCode: options.languageCode || 'en-US',
        enableAutomaticPunctuation: options.enableAutomaticPunctuation || true,
        enableWordTimeOffsets: options.enableWordTimeOffsets || false,
      },
      audio: {
        content: audioBase64,
      },
    };

    const response = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${this.config.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      throw new Error(`Google Cloud Speech API error: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.results && result.results.length > 0) {
      const alternative = result.results[0].alternatives[0];
      return {
        transcript: alternative.transcript,
        confidence: alternative.confidence,
        words: alternative.words || []
      };
    }

    return { transcript: '', confidence: 0 };
  }

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
}

export class GoogleCloudTextToSpeech {
  private config: GoogleCloudConfig;
  private isAvailable = false;

  constructor(config: GoogleCloudConfig) {
    this.config = config;
    this.isAvailable = !!config.apiKey;
  }

  async synthesizeSpeech(text: string, options: {
    languageCode?: string;
    voiceName?: string;
    ssmlGender?: 'NEUTRAL' | 'FEMALE' | 'MALE';
    audioFormat?: 'MP3' | 'WAV' | 'OGG';
    speakingRate?: number;
    pitch?: number;
  } = {}): Promise<{ audioContent: string; audioUrl: string }> {
    if (!this.isAvailable) {
      throw new Error('Google Cloud Text-to-Speech API not configured');
    }

    const requestBody = {
      input: { text },
      voice: {
        languageCode: options.languageCode || 'en-US',
        name: options.voiceName,
        ssmlGender: options.ssmlGender || 'NEUTRAL',
      },
      audioConfig: {
        audioEncoding: options.audioFormat || 'MP3',
        speakingRate: options.speakingRate || 1.0,
        pitch: options.pitch || 0.0,
      },
    };

    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${this.config.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      throw new Error(`Google Cloud TTS API error: ${response.statusText}`);
    }

    const result = await response.json();
    const audioContent = result.audioContent;
    
    // Create blob URL for audio playback
    const audioBlob = this.base64ToBlob(audioContent, `audio/${(options.audioFormat || 'MP3').toLowerCase()}`);
    const audioUrl = URL.createObjectURL(audioBlob);

    return { audioContent, audioUrl };
  }

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

// Factory function to create services with configuration
export const createGoogleSpeechServices = (config: GoogleCloudConfig) => {
  return {
    speechToText: new GoogleCloudSpeechToText(config),
    textToSpeech: new GoogleCloudTextToSpeech(config),
  };
};

// Usage example (commented out):
/*
// In your environment variables:
// VITE_GOOGLE_CLOUD_API_KEY=your_api_key_here

const googleServices = createGoogleSpeechServices({
  apiKey: import.meta.env.VITE_GOOGLE_CLOUD_API_KEY || '',
});

// Use in your components:
const transcript = await googleServices.speechToText.transcribeAudio(audioBlob);
const audio = await googleServices.textToSpeech.synthesizeSpeech("Hello world");
*/ 