import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import Header from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ArrowLeft, Shield, Users, Database, FileText, Lock, AlertTriangle, CheckCircle } from 'lucide-react';

const PrivacyPolicy: React.FC = () => {
  const { language } = useLanguage();
  const { theme } = useTheme();

  const content = {
    en: {
      title: 'Privacy Policy',
      subtitle: 'End-User License & Privacy Policy',
      lastUpdated: 'Last Updated: December 2024',
      backToHome: 'Back to Home',
      sections: [
        {
          title: '1. Acceptance of Terms',
          icon: CheckCircle,
          content: 'By creating an account or using Tek Riders, you agree to the terms outlined in this policy. You must read and accept these terms before accessing any services. This agreement is available in both Kinyarwanda and English.'
        },
        {
          title: '2. User Rights and Responsibilities',
          icon: Users,
          content: `Learners: You own your personal data. You may request to view, download, or permanently delete your information at any time.

Tutors: You retain full intellectual property rights over any content you create or upload. Tek Riders does not claim ownership.

All Users: You agree to use the platform for lawful educational purposes only and to avoid uploading or sharing inappropriate or harmful content.`
        },
        {
          title: '3. Data Collection and Usage',
          icon: Database,
          content: `We collect only essential data: login credentials, course progress, and basic analytics.

All personal data is encrypted and stored securely. Offline data remains on your device until you choose to sync.

Tek Riders does not sell, trade, or share user data with advertisers or third parties.`
        },
        {
          title: '4. Content Ownership and Marketplace Rules',
          icon: FileText,
          content: `Tutors grant Tek Riders a limited license to host and distribute their content solely for educational purposes.

Tutors can remove their content from the platform at any time.

Revenue-sharing is transparent: course creators receive agreed-upon royalties for paid courses.

Learners may not redistribute or resell any content without the creator's permission.`
        },
        {
          title: '5. Consent and Access',
          icon: Shield,
          content: `Users must provide consent to this policy before account creation.

Minors under 18 should have parental or guardian approval.

The policy is clearly presented in both supported languages to ensure informed acceptance.`
        },
        {
          title: '6. Liability Disclaimer',
          icon: AlertTriangle,
          content: 'Tek Riders is an educational platform. Certificates issued by Tek Riders reflect skill completion but are not government-accredited qualifications. We are not responsible for any external use or interpretation of certificates or content.'
        },
        {
          title: '7. Security and Compliance',
          icon: Lock,
          content: `Our platform follows Rwanda's Data Protection and Privacy Law (2021).

Users are encouraged to protect their login information.

In case of data breaches, we will notify affected users promptly.`
        },
        {
          title: '8. Policy Updates',
          icon: CheckCircle,
          content: 'Tek Riders may update this policy to improve user safety or meet legal requirements. Continued use after updates means you accept the revised terms.'
        }
      ]
    },
    rw: {
      title: 'Politiki y\'Ubwihisho',
      subtitle: 'Urupapuro rw\'Uruhushya rw\'Abakoresha & Politiki y\'Ubwihisho',
      lastUpdated: 'Byashyizweho: Ukuboza 2024',
      backToHome: 'Subira Ahabanza',
      sections: [
        {
          title: '1. Kwemera Amabwiriza',
          icon: CheckCircle,
          content: 'Uko ukoze konti cyangwa ukoreshe Tek Riders, uyemera amabwiriza yerekanye muri iyi politiki. Ukeneye gusoma kandi kwemera aya mabwiriza mbere yo kwinjira muri serivisi zose. Iyi sezerano iboneka mu Kinyarwanda no mu Cyongereza.'
        },
        {
          title: '2. Uburenganzira n\'Ibibanzirwa by\'Umukoresha',
          icon: Users,
          content: `Abanyeshuri: Ufite uburenganzira kuri amakuru yawe. Urashobora gusaba kureba, kurotsa, cyangwa gusiba amakuru yawe buri gihe.

Abarimu: Ufite uburenganzira bwose bw\'ubwenge kuri ibintu byose ukoze cyangwa ukoze. Tek Riders ntibishyira uburenganzira.

Abakoresha bose: Uyemera gukoresha ubutumwa ku buryo bwemewe n\'amategeko gusa kandi kurenganura kohereza cyangwa gusangira ibintu bitari byemewe cyangwa bibangamiye.`
        },
        {
          title: '3. Gukusanya no Gukoresha Amakuru',
          icon: Database,
          content: `Dukusanya amakuru y\'ibanze gusa: amakuru yo kwinjira, iterambere ry\'isomo, n\'ibisubizo by\'ibanze.

Amakuru yose y\'umuntu y\'ibanze yarindishijwe kandi yabikwa neza. Amakuru yo kuri interineti asigara kuri mudasobwa yawe kugeza uhitamo kuyunga.

Tek Riders ntibagurisha, ntibagurane, cyangwa ntibasangire amakuru y\'abakoresha na batandukanye cyangwa abatangaza.`
        },
        {
          title: '4. Uburenganzira bw\'Ibintu n\'Amabwiriza y\'Isoko',
          icon: FileText,
          content: `Abarimu baha Tek Riders uruhushya ruto rwo kubika no kohereza ibintu byabo ku buryo bw\'imyigisho gusa.

Abarimu bashobora gusiba ibintu byabo ku butumwa buri gihe.

Gusangira amafaranga ari mu buryo bwumvikana: abakozi b\'amasomo bahabwa amafaranga yemewe y\'amasomo yishyurwa.

Abanyeshuri ntibashobora kohereza cyangwa kugurisha ibintu byose utaruhushya rw\'umukozi.`
        },
        {
          title: '5. Kwemera no Kwinjira',
          icon: Shield,
          content: `Abakoresha bakeneye kwemera iyi politiki mbere yo gukoza konti.

Abato bari munsi y\'imyaka 18 bakeneye kwemera rw\'ababyeyi cyangwa abujyanama.

Iyi politiki yerekana neza mu ndimi zombi zishyigikiwe kugira ngo abantu bamenye neza ko bayemeye.`
        },
        {
          title: '6. Ubutware bw\'Ibibazo',
          icon: AlertTriangle,
          content: 'Tek Riders ni ubutumwa bw\'imyigisho. Impamyabumenyi Tek Riders yatanze zerekana ko ukoze ibikorwa ariko si impamyabumenyi z\'uburenganzira bw\'igihugu. Ntitufite ubutware ku gukoresha cyangwa gusobanura impamyabumenyi cyangwa ibintu by\'ahandi.'
        },
        {
          title: '7. Ubutabazi n\'Kurikiranwa',
          icon: Lock,
          content: `Ubutumwa bwacu bukurikira Amategeko y\'Ubutabazi n\'Ubwihisho bw\'Amakuru ya Rwanda (2021).

Abakoresha banyishurira kubungabunga amakuru yabo yo kwinjira.

Iyo habaye ibibazo by\'ubutabazi, tuzamenya abakoresha bari mu kaga vuba.`
        },
        {
          title: '8. Gukosora Politiki',
          icon: CheckCircle,
          content: 'Tek Riders ashobora gukosora iyi politiki kugira ngo ashyireho ubutabazi bw\'abakoresha cyangwa ahuzwe n\'amategeko. Gukomeza gukoresha nyuma yo gukosora bisobanura ko uyemera amabwiriza yosowe.'
        }
      ]
    }
  };

  const currentContent = content[language as keyof typeof content] || content.en;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-700 dark:from-blue-700 dark:to-indigo-800 text-white pt-20 pb-16 lg:pt-28 lg:pb-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex justify-center mb-6">
              <div className="p-3 bg-white/10 rounded-full">
                <Shield className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold mb-4">
              {currentContent.title}
            </h1>
            <p className="text-xl lg:text-2xl opacity-90 mb-2">
              {currentContent.subtitle}
            </p>
            <p className="text-sm opacity-75">
              {currentContent.lastUpdated}
            </p>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="py-12 lg:py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            {/* Back Button */}
            <div className="mb-8">
              <Link to="/">
                <Button variant="outline" className="flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  {currentContent.backToHome}
                </Button>
              </Link>
            </div>

            {/* Policy Sections */}
            <div className="space-y-8">
              {currentContent.sections.map((section, index) => (
                <Card key={index} className="p-6 lg:p-8">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                      <section.icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-xl lg:text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                        {section.title}
                      </h2>
                      <div className="prose prose-gray dark:prose-invert max-w-none">
                        <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                          {section.content}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Contact Information */}
            <Card className="mt-12 p-6 lg:p-8 bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  {language === 'rw' ? 'Uruhuzandiko' : 'Contact Us'}
                </h3>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  {language === 'rw' 
                    ? 'Iyo ufite ibibazo kuri iyi politiki, twandikire:'
                    : 'If you have questions about this policy, please contact us:'
                  }
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <a 
                    href="mailto:info.tekriders@gmail.com"
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                  >
                    info.tekriders@gmail.com
                  </a>
                  <a 
                    href="https://wa.me/250785961427"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                  >
                    +250 785 961 427
                  </a>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PrivacyPolicy; 