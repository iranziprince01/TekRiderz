import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { 
  Play, 
  TestTube, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Volume2,
  Mic,
  Keyboard
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { testAccessibilityNavigation, logAccessibilityTestResults } from '../../utils/accessibilityTest';

interface TestResult {
  testName: string;
  passed: boolean;
  details: string;
  timestamp: Date;
}

export const AccessibilityTestPanel: React.FC = () => {
  const { language } = useLanguage();
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    passed: number;
    failed: number;
    successRate: number;
  } | null>(null);

  const runTests = async () => {
    setIsRunning(true);
    setResults([]);
    setSummary(null);

    try {
      console.log('🧪 Starting accessibility tests...');
      
      const testResults = await testAccessibilityNavigation();
      setResults(testResults.results);
      setSummary(testResults.summary);
      
      // Log results to console
      logAccessibilityTestResults(testResults.results);
      
      console.log('🧪 Accessibility tests completed:', testResults.summary);
    } catch (error) {
      console.error('❌ Test execution failed:', error);
      setResults([{
        testName: 'Test Execution',
        passed: false,
        details: `Error: ${error}`,
        timestamp: new Date()
      }]);
    } finally {
      setIsRunning(false);
    }
  };

  const testVoiceCommands = () => {
    const commands = [
      'go to modules',
      'open assessments', 
      'course home',
      'jya mu bice',
      'fungura ibizamini',
      'ahabanza'
    ];

    commands.forEach((command, index) => {
      setTimeout(() => {
        console.log(`🗣️ Testing voice command: "${command}"`);
        window.dispatchEvent(new CustomEvent('voiceCommand', { 
          detail: { command, test: true } 
        }));
      }, index * 500);
    });
  };

  const testKeyboardShortcuts = () => {
    const shortcuts = [
      { key: '1', description: 'Navigate to Home' },
      { key: '2', description: 'Navigate to Modules' },
      { key: '3', description: 'Navigate to Assessments' },
      { key: '4', description: 'Continue to Next Module' },
      { key: '5', description: 'Continue to Next Quiz' }
    ];

    shortcuts.forEach((shortcut, index) => {
      setTimeout(() => {
        console.log(`⌨️ Testing keyboard shortcut: "${shortcut.key}" - ${shortcut.description}`);
        document.dispatchEvent(new KeyboardEvent('keydown', { 
          key: shortcut.key, 
          bubbles: true 
        }));
      }, index * 300);
    });
  };

  const testCustomEvents = () => {
    const events = [
      'highlightModule',
      'highlightQuiz',
      'continueNextModule',
      'continueNextQuiz',
      'startCurrentModule',
      'startCurrentQuiz',
      'submitCurrentQuiz'
    ];

    events.forEach((eventName, index) => {
      setTimeout(() => {
        console.log(`🎯 Testing custom event: "${eventName}"`);
        window.dispatchEvent(new CustomEvent(eventName, { 
          detail: { test: true, timestamp: Date.now() } 
        }));
      }, index * 200);
    });
  };

  const getStatusColor = (passed: boolean) => {
    return passed ? 'text-green-600' : 'text-red-600';
  };

  const getStatusIcon = (passed: boolean) => {
    return passed ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />;
  };

  return (
    <Card className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <TestTube className="w-6 h-6 text-blue-600" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {language === 'rw' ? 'Ugeragezo rw\'Uburenganzira' : 'Accessibility Test Panel'}
        </h2>
      </div>

      {/* Test Controls */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Button
          onClick={runTests}
          disabled={isRunning}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          <span className="ml-2">
            {isRunning 
              ? (language === 'rw' ? 'Birimo...' : 'Running...')
              : (language === 'rw' ? 'Tangira Ugeragezo' : 'Run Tests')
            }
          </span>
        </Button>

        <Button
          onClick={testVoiceCommands}
          variant="outline"
          className="border-green-300 text-green-700 hover:bg-green-50"
        >
          <Mic className="w-4 h-4" />
          <span className="ml-2">
            {language === 'rw' ? 'Ugeragezo rw\'Ijwi' : 'Test Voice'}
          </span>
        </Button>

        <Button
          onClick={testKeyboardShortcuts}
          variant="outline"
          className="border-purple-300 text-purple-700 hover:bg-purple-50"
        >
          <Keyboard className="w-4 h-4" />
          <span className="ml-2">
            {language === 'rw' ? 'Ugeragezo rw\'Uburyo' : 'Test Keyboard'}
          </span>
        </Button>

        <Button
          onClick={testCustomEvents}
          variant="outline"
          className="border-orange-300 text-orange-700 hover:bg-orange-50"
        >
          <Volume2 className="w-4 h-4" />
          <span className="ml-2">
            {language === 'rw' ? 'Ugeragezo rw\'Ibikorwa' : 'Test Events'}
          </span>
        </Button>
      </div>

      {/* Test Summary */}
      {summary && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
            {language === 'rw' ? 'Ibisubizo by\'Ugeragezo' : 'Test Summary'}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{summary.total}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {language === 'rw' ? 'Byose' : 'Total'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{summary.passed}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {language === 'rw' ? 'Byagenze' : 'Passed'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{summary.failed}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {language === 'rw' ? 'Bitarangiye' : 'Failed'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{summary.successRate.toFixed(1)}%</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {language === 'rw' ? 'Umutekano' : 'Success Rate'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Results */}
      {results.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
            {language === 'rw' ? 'Ibisubizo by\'Ugeragezo' : 'Test Results'}
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {results.map((result, index) => (
              <div
                key={index}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  result.passed 
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                }`}
              >
                <div className={getStatusColor(result.passed)}>
                  {getStatusIcon(result.passed)}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {result.testName}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {result.details}
                  </div>
                </div>
                <Badge variant={result.passed ? 'success' : 'error'}>
                  {result.passed 
                    ? (language === 'rw' ? 'Byagenze' : 'PASS')
                    : (language === 'rw' ? 'Bitarangiye' : 'FAIL')
                  }
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
          {language === 'rw' ? 'Amabwiriza' : 'Instructions'}
        </h4>
        <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
          <div>• {language === 'rw' ? 'Kanda "Tangira Ugeragezo" kugirango ugerageze ibintu byose' : 'Click "Run Tests" to test all accessibility features'}</div>
          <div>• {language === 'rw' ? 'Kanda "Ugeragezo rw\'Ijwi" kugirango ugerageze amabwiriza y\'ijwi' : 'Click "Test Voice" to test voice commands'}</div>
          <div>• {language === 'rw' ? 'Kanda "Ugeragezo rw\'Uburyo" kugirango ugerageze uburyo bwo kwinjiza' : 'Click "Test Keyboard" to test keyboard shortcuts'}</div>
          <div>• {language === 'rw' ? 'Kanda "Ugeragezo rw\'Ibikorwa" kugirango ugerageze ibikorwa by\'uburenganzira' : 'Click "Test Events" to test accessibility events'}</div>
        </div>
      </div>
    </Card>
  );
}; 