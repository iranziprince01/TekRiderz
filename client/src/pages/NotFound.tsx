import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import Header from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { 
  Home, 
  Search, 
  BookOpen, 
  ArrowLeft, 
  HelpCircle,
  AlertTriangle
} from 'lucide-react';

const NotFound: React.FC = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();

  const content = {
    en: {
      title: 'Page Not Found',
      subtitle: 'Sorry, we couldn\'t find the page you\'re looking for.',
      description: 'The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.',
      actions: {
        home: 'Go Home',
        back: 'Go Back',
        courses: 'Browse Courses',
        help: 'Get Help'
      },
      suggestions: {
        title: 'Here are some helpful links:',
        items: [
          { label: 'Home Page', path: '/', icon: Home },
          { label: 'Course Marketplace', path: '/courses', icon: BookOpen },
          { label: 'Help Center', path: '/help-center', icon: HelpCircle },
          { label: 'Contact Us', path: '/contact-us', icon: Search }
        ]
      },
      errorCode: '404'
    },
    rw: {
      title: 'Urupapuro Ntirubonetse',
      subtitle: 'Ihangane, ntidushobora kubona urupapuro ushaka.',
      description: 'Urupapuro ushaka rushobora kuba rwakuweho, rwahindutse izina, cyangwa ntiruboneka by\'agateganyo.',
      actions: {
        home: 'Jya Mu Ntangiriro',
        back: 'Garuka Inyuma',
        courses: 'Shakisha Amasomo',
        help: 'Saba Ubufasha'
      },
      suggestions: {
        title: 'Dore amahuriro afasha:',
        items: [
          { label: 'Urupapuro rw\'Itangiriro', path: '/', icon: Home },
          { label: 'Isoko ry\'Amasomo', path: '/courses', icon: BookOpen },
          { label: 'Ikigo cy\'Ubufasha', path: '/help-center', icon: HelpCircle },
          { label: 'Duhamagare', path: '/contact-us', icon: Search }
        ]
      },
      errorCode: '404'
    }
  };

  const currentContent = content[language];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          {/* Error illustration */}
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-32 h-32 bg-orange-100 dark:bg-orange-900/20 rounded-full mb-6">
              <AlertTriangle className="h-16 w-16 text-orange-600" />
            </div>
            <div className="text-8xl font-bold text-gray-300 dark:text-gray-600 mb-4">
              {currentContent.errorCode}
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            {currentContent.title}
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-6">
            {currentContent.subtitle}
          </p>
          <p className="text-gray-500 dark:text-gray-500 max-w-2xl mx-auto">
            {currentContent.description}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Button
            onClick={() => navigate(-1)}
            variant="outline"
            size="lg"
            className="flex items-center"
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            {currentContent.actions.back}
          </Button>
          
          <Link to="/">
            <Button size="lg" className="w-full sm:w-auto">
              <Home className="mr-2 h-5 w-5" />
              {currentContent.actions.home}
            </Button>
          </Link>
          
          <Link to="/courses">
            <Button variant="outline" size="lg" className="w-full sm:w-auto">
              <BookOpen className="mr-2 h-5 w-5" />
              {currentContent.actions.courses}
            </Button>
          </Link>
        </div>

        {/* Helpful links */}
        <Card className="p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
            {currentContent.suggestions.title}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentContent.suggestions.items.map((item, index) => {
              const IconComponent = item.icon;
              return (
                <Link
                  key={index}
                  to={item.path}
                  className="flex items-center p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="bg-primary-100 dark:bg-primary-900/20 p-2 rounded-lg mr-4">
                    <IconComponent className="h-5 w-5 text-primary-600" />
                  </div>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </Card>

        {/* Additional help */}
        <div className="text-center mt-12">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {language === 'rw' 
              ? 'Uracyafite ibibazo? Tuzakwifashije!'
              : 'Still having trouble? We\'re here to help!'
            }
          </p>
          <Link to="/help-center">
            <Button variant="outline">
              <HelpCircle className="mr-2 h-4 w-4" />
              {currentContent.actions.help}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound; 