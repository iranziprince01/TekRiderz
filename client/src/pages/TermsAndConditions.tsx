import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import Header from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { 
  Shield, 
  Users, 
  BookOpen, 
  Lock, 
  Globe,
  ArrowLeft
} from 'lucide-react';

const TermsAndConditions: React.FC = () => {
  const { language } = useLanguage();

  const content = {
    en: {
      title: 'Terms and Conditions',
      subtitle: 'Please read these terms carefully before using our platform',
      lastUpdated: 'Last updated: January 2025',
      sections: [
        {
          title: '1. Acceptance of Terms',
          content: 'By accessing and using TekRiders, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.'
        },
        {
          title: '2. Description of Service',
          content: 'TekRiders is an online learning platform that provides educational content, courses, and interactive learning experiences. We connect learners with instructors and provide tools for course creation and management.'
        },
        {
          title: '3. User Accounts',
          content: 'You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account or password.'
        },
        {
          title: '4. User Conduct',
          content: 'You agree not to use the service to: (a) violate any laws or regulations; (b) infringe upon the rights of others; (c) upload harmful or malicious content; (d) attempt to gain unauthorized access to our systems.'
        },
        {
          title: '5. Content and Intellectual Property',
          content: 'All content on TekRiders is protected by copyright and other intellectual property laws. Users retain ownership of their content but grant us license to display and distribute it on our platform.'
        },
        {
          title: '6. Privacy and Data Protection',
          content: 'We are committed to protecting your privacy. Our collection and use of personal information is governed by our Privacy Policy, which is incorporated into these terms by reference.'
        },
        {
          title: '7. Payment and Refunds',
          content: 'Course fees are clearly stated before purchase. Refunds are available within 30 days of purchase if you are not satisfied with the course content, subject to our refund policy.'
        },
        {
          title: '8. Limitation of Liability',
          content: 'TekRiders shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the service.'
        },
        {
          title: '9. Termination',
          content: 'We may terminate or suspend your account immediately, without prior notice, for conduct that we believe violates these Terms and Conditions or is harmful to other users or us.'
        },
        {
          title: '10. Changes to Terms',
          content: 'We reserve the right to modify these terms at any time. We will notify users of any material changes via email or through the platform.'
        },
        {
          title: '11. Contact Information',
          content: 'If you have any questions about these Terms and Conditions, please contact us at info.tekriders@gmail.com or call +250 785 961 427.'
        }
      ]
    },
    rw: {
      title: 'Amabwiriza n\'Ibikorwa',
      subtitle: 'Soma amabwiriza aya neza mbere yo gukoresha urubuga rwacu',
      lastUpdated: 'Byashyizwe ahagaragara: Mutarama 2025',
      sections: [
        {
          title: '1. Kwemera Amabwiriza',
          content: 'Uko ukoresha TekRiders, uyemera kandi uvugirwa n\'amabwiriza y\'iyi sano. Iyo utemera kuzuzuza ibiri hejuru, ntukoreshe iyi serivisi.'
        },
        {
          title: '2. Gusobanura Serivisi',
          content: 'TekRiders ni urubuga rwo kwiga kuri interineti rwatanze ibirimo by\'uburezi, amasomo, n\'ibikorwa byo kwiga. Duhuza abanyeshuri n\'abarimu kandi tubaha ibikoresho byo gukora n\'ubuyobozi bw\'amasomo.'
        },
        {
          title: '3. Konti za Bakoresha',
          content: 'Ufite umwanya wo kurinda ibanga ryawe rya konte n\'ijambo ry\'ibanga. Uyemera kwakira umwanya wa byose biba mu konte yawe cyangwa ijambo ry\'ibanga.'
        },
        {
          title: '4. Imikorere ya Bakoresha',
          content: 'Uyemera kutakoresha serivisi: (a) gukora icyaha cyangwa amabwiriza; (b) gukangiza uburenganzira bw\'abandi; (c) kwinjiza ibirimo bibi cyangwa bibi; (d) kugerageza kwinjira mu masisitemu yacu utemewe.'
        },
        {
          title: '5. Ibirimo n\'Uburenganzira',
          content: 'Ibirimo byose kuri TekRiders birinzwe na copyright n\'andi mategeko y\'uburenganzira. Bakoresha bakomeza ubwabo bw\'ibirimo byabo ariko banatanga uruhushya rwo kubyerekana no kubwirakabya kuri urubuga.'
        },
        {
          title: '6. Ibanga n\'Umutekano w\'Amakuru',
          content: 'Dushyizwe mu bikorwa byo kurinda ibanga ryawe. Gukusanya no gukoresha amakuru yawe y\'ibanga bigenzurwa na Politiki yacu y\'Ibanga, ihuza mu ma mabwiriza.'
        },
        {
          title: '7. Kwishyura n\'Gusubiza',
          content: 'Amafaranga y\'amasomo asobanuwe neza mbere yo guhagura. Gusubiza amafaranga biraboneka mu masomo 30 yo guhagura iyo utishimishwa n\'ibirimo by\'isomo, bigenewe na politiki yacu yo gusubiza.'
        },
        {
          title: '8. Ingaruka z\'Umwanya',
          content: 'TekRiders ntizuzuzwa inyungu zitari zo hagati, ziboneka, zihariye, zinyongera, cyangwa zihutirwa ziterwa no gukoresha kwawe serivisi.'
        },
        {
          title: '9. Gukomeza',
          content: 'Dushobora gukomeza cyangwa guhagarika konte yawe byihuse, utatangira kumenyesha, ku mikorere dutekereza ko ihangana na ma mabwiriza cyangwa ibihe abandi bakoresha cyangwa twe.'
        },
        {
          title: '10. Guhindura Amabwiriza',
          content: 'Dufite uburenganzira bwo guhindura amabwiriza aya igihe icyo ari cyo. Tuzamenyesha bakoresha impinduka zose z\'ingenzi binyuze kuri imeli cyangwa kuri urubuga.'
        },
        {
          title: '11. Amakuru yo Guhuza',
          content: 'Iyo ufite ibibazo ihereye ku ma mabwiriza aya, uhuze natwe kuri info.tekriders@gmail.com cyangwa utwame +250 785 961 427.'
        }
      ]
    }
  };

  const currentContent = content[language as keyof typeof content] || content.en;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Header showAuth={true} />
      
      <main className="pt-16 pb-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl mb-6">
              <Shield className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              {currentContent.title}
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-2">
              {currentContent.subtitle}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {currentContent.lastUpdated}
            </p>
          </div>

          {/* Back Button */}
          <div className="mb-8">
            <Link
              to="/"
              className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {language === 'rw' ? 'Subira inyuma' : 'Back to Home'}
            </Link>
          </div>

          {/* Terms Content */}
          <Card className="p-8 space-y-8">
            {currentContent.sections.map((section, index) => (
              <div key={index} className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                      {index + 1}
                    </span>
                  </div>
                  {section.title}
                </h2>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed pl-11">
                  {section.content}
                </p>
              </div>
            ))}
          </Card>

          {/* Footer Note */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {language === 'rw' 
                ? 'Iyo ufite ibibazo cyangwa ukeneye ubufasha, uhuze natwe.' 
                : 'If you have questions or need assistance, please contact us.'
              }
            </p>
            <div className="mt-4 flex justify-center space-x-6">
              <a
                href="mailto:info.tekriders@gmail.com"
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm"
              >
                info.tekriders@gmail.com
              </a>
              <a
                href="tel:+250785961427"
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm"
              >
                +250 785 961 427
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TermsAndConditions; 