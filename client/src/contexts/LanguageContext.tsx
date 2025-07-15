import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'rw';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

// Comprehensive translations for Rwandan context
const translations = {
  en: {
    // Navigation & Header
    'nav.home': 'Home',
    'nav.courses': 'Courses',
    'nav.dashboard': 'Dashboard',
    'nav.profile': 'Profile',
    'nav.login': 'Login',
    'nav.signup': 'Get Started',
    'nav.logout': 'Logout',
    'nav.settings': 'Settings',
    'nav.notifications': 'Notifications',
    'nav.createCourse': 'Create Course',
    'nav.myCourses': 'My Courses',
    'nav.progress': 'Progress',
    
    // Landing Page
    'landing.hero.title': 'Learn Digital Skills',
    'landing.hero.subtitle': 'In Kinyarwanda.',
    'landing.hero.description': 'Join thousands of young Rwandans mastering technology skills with courses designed for our community. Learn coding, design, and digital entrepreneurship in your native language.',
    'landing.hero.cta': 'Start Learning Today',
    'landing.hero.demo': 'Watch Demo',
    
    // Stats
    'stats.learners': 'Young Learners',
    'stats.tutors': 'Community Mentors',
    'stats.courses': 'Courses Available',
    'stats.success': 'Success Rate',
    
    // Features
    'features.title': 'Why Choose Tek Riders?',
    'features.subtitle': 'Experience learning designed specifically for young Rwandans, with content that speaks to your dreams and challenges.',
    'features.learn.title': 'Learn from Community Leaders',
    'features.learn.description': 'Access courses from successful Rwandan entrepreneurs and tech professionals who understand your journey.',
    'features.track.title': 'Track Your Growth',
    'features.track.description': 'Monitor your progress with tools designed to help you build a portfolio that opens doors to opportunities.',
    'features.interactive.title': 'Hands-on Projects',
    'features.interactive.description': 'Work on real projects that solve problems in your community while building valuable skills.',
    'features.community.title': 'Ubuntu Learning',
    'features.community.description': 'Connect with fellow young learners across Rwanda and East Africa in our supportive community.',
    
    // Testimonials
    'testimonials.title': 'Stories from Our Community',
    'testimonials.subtitle': 'Young Rwandans who transformed their lives through digital skills.',
    'testimonial.amara.quote': 'Tek Riders gave me hope when I had none. Learning web development in Kinyarwanda helped me start my own tech business in Kigali.',
    'testimonial.jean.quote': 'From a village in Musanze to working with international clients - Tek Riders made my data science dreams possible. Murakoze cyane!',
    'testimonial.grace.quote': 'As a young woman in tech, finding mentors who understood my culture was everything. Now I design apps used across East Africa.',
    
    // CTA Section
    'cta.title': 'Ready to Change Your Future?',
    'cta.subtitle': 'Join over 5,000 young Rwandans who are building better lives through technology.',
    'cta.start': 'Start Free Today',
    'cta.browse': 'Explore Courses',
    
    // Footer
    'footer.description': 'Empowering young Rwandans worldwide with quality education and innovative learning experiences designed for our community.',
    'footer.platform.title': 'Platform',
    'footer.platform.browseCourses': 'Browse Courses',
    'footer.platform.becomeTutor': 'Become a Mentor',
    'footer.platform.mobileApp': 'Mobile App',
    'footer.support.title': 'Support',
    'footer.support.helpCenter': 'Help Center',
    'footer.support.contactUs': 'Contact Us',
    'footer.support.community': 'Community',
    'footer.company.title': 'Company',
    'footer.company.aboutUs': 'About Us',
    'footer.company.careers': 'Careers',
    'footer.company.privacy': 'Privacy Policy',
    'footer.copyright': '© 2025 Tek Riders. All rights reserved.',
    
    // Auth Pages
    'auth.welcome': 'Welcome!',
    'auth.welcomeBack': 'Welcome Back!',
    'auth.continueJourney': 'Continue your journey to digital success',
    'auth.joinCommunity': 'Join Our Community',
    'auth.startJourney': 'Begin your path to digital empowerment',
    'auth.email': 'Email Address',
    'auth.password': 'Password',
    'auth.confirmPassword': 'Confirm Password',
    'auth.fullName': 'Full Name',
    'auth.rememberMe': 'Remember me',
    'auth.forgotPassword': 'Forgot password?',
    'auth.signIn': 'Sign In',
    'auth.signUp': 'Create Account',
    'auth.chooseRole': 'Choose your role:',
    'auth.learner': 'Learner',
    'auth.tutor': 'Tutor',
    'auth.hasAccount': 'Already have an account?',
    'auth.noAccount': 'New to Tek Riders?',
    'auth.createAccount': 'Create your account',
    'auth.signInAccount': 'Sign in to your account',
    'auth.agreeTerms': 'I agree to the Terms of Service and Privacy Policy',
    'auth.freeJoin': 'Free to join',
    'auth.communitySize': '5K+ young learners',
    'auth.expertMentors': 'Community mentors',
    'auth.emailPlaceholder': 'Enter your email address',
    'auth.passwordPlaceholder': 'Enter your password',
    'auth.confirmPasswordPlaceholder': 'Confirm your password',
    'auth.fullNamePlaceholder': 'Enter your full name',
    'auth.signingIn': 'Signing in...',
    'auth.creatingAccount': 'Creating account...',
    'auth.termsText': 'By signing up, you agree to our',
    'auth.termsLink': 'Terms of Service',
    'auth.privacyLink': 'Privacy Policy',
    'auth.and': 'and',
    
    // Dashboard
    'dashboard.welcome': 'Welcome back',
    'dashboard.subtitle': 'Ready to continue building your future? Let\'s pick up where you left off.',
    'dashboard.coursesEnrolled': 'Courses Enrolled',
    'dashboard.hoursLearned': 'Hours Learned',
    'dashboard.certificates': 'Certificates',
    'dashboard.streakDays': 'Streak Days',
    'dashboard.continueLearning': 'Continue Learning',
    'dashboard.quickActions': 'Quick Actions',
    'dashboard.browseCourses': 'Browse Courses',
    'dashboard.createCourse': 'Share Knowledge',
    'dashboard.joinCommunity': 'Join Community',
    'dashboard.achievements': 'Achievements',
    'dashboard.streakTitle': 'Day Streak!',
    'dashboard.streakMessage': 'You\'re building momentum! Keep growing.',
    'dashboard.keepStreak': 'Keep Learning',
    
    // Course Marketplace
    'courses.title': 'Explore Courses',
    'courses.subtitle': 'Discover skills that will transform your life and open new opportunities.',
    'courses.search': 'Search courses, mentors, or topics...',
    'courses.filters': 'Filters',
    'courses.allCategories': 'All Categories',
    'courses.programming': 'Programming',
    'courses.design': 'Design',
    'courses.businessTech': 'Business Tech',
    'courses.generalIT': 'General IT',
    'courses.allLevels': 'All Levels',
    'courses.beginner': 'Beginner',
    'courses.intermediate': 'Intermediate',
    'courses.advanced': 'Advanced',
    'courses.showing': 'Showing',
    'courses.results': 'results',
    'courses.for': 'for',
    'courses.enrollNow': 'Enroll Now',
    'courses.preview': 'Preview',
    'courses.bestseller': 'Popular',
    'courses.noResults': 'No courses found',
    'courses.adjustFilters': 'Try adjusting your search criteria or filters',
    
    // Hero Card Content
    'hero.card.title': 'Advanced React Development',
    'hero.card.instructor': 'Sarah Johnson',
    'hero.card.description': 'Master modern React development with hooks, context, and real-world projects.',
    
    // Common
    'common.loading': 'Loading...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.continue': 'Continue',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.previous': 'Previous',
    'common.close': 'Close',
    'common.viewAll': 'View All',
    'common.learnMore': 'Learn More',
    'common.getStarted': 'Get Started',
    'common.by': 'by',
    'common.free': 'Free',
    'common.premium': 'Premium',
    'common.new': 'New',
    'common.popular': 'Popular',
    'common.recommended': 'Recommended',
  },
  rw: {
    // Navigation & Header
    'nav.home': 'Ahabanza',
    'nav.courses': 'Amasomo',
    'nav.dashboard': 'Ikibaho',
    'nav.profile': 'Umwirondoro',
    'nav.login': 'Kwinjira',
    'nav.signup': 'Tangira',
    'nav.logout': 'Gusohoka',
    'nav.settings': 'Igenamiterere',
    'nav.notifications': 'Amakuru',
    'nav.createCourse': 'Kora Isomo',
    'nav.myCourses': 'Amasomo Yanjye',
    'nav.progress': 'Iterambere',
    
    // Landing Page
    'landing.hero.title': 'Iga Ikoranabuhanga Rigezweho',
    'landing.hero.subtitle': 'Mu Kinyarwanda.',
    'landing.hero.description': 'Jya mu rubyiruko rw\'u Rwanda rwiga ubuhanga bwa tekinoroji mu masomo yakozwe ku rubyiruko rwacu. Wige gukora porogaramu, gushushanya, no kwihangana mu bucuruzi bwa digitale mu rurimi rwawe.',
    'landing.hero.cta': 'Tangira Kwiga Uyu Munsi',
    'landing.hero.demo': 'Reba Icyitegererezo',
    
    // Stats
    'stats.learners': 'Urubyiruko Rwiga',
    'stats.tutors': 'Abarimu b\'Umuryango',
    'stats.courses': 'Amasomo Aboneka',
    'stats.success': 'Igipimo cy\'Intsinzi',
    
    // Features
    'features.title': 'Kuki wahitamo Tek Riders?',
    'features.subtitle': 'Menya uburyo bwo kwiga bwakozwe ku rubyiruko rw\'u Rwanda, hamwe n\'ibirimo bivuga ku nzozi zawe n\'ibibazo byawe.',
    'features.learn.title': 'Wige ku Bayobozi b\'Umuryango',
    'features.learn.description': 'Bona amasomo y\'abacuruzi b\'u Rwanda batsinze n\'abahanga ba tekinoroji bazi urugendo rwawe.',
    'features.track.title': 'Genzura Iterambere Ryawe',
    'features.track.description': 'Koresha ibikoresho byakozwe kugira ngo ugufashe kubaka portfolio ifungura inzira z\'amahirwe.',
    'features.interactive.title': 'Imishinga Ifatika',
    'features.interactive.description': 'Kora ku mishinga nyayo ikemura ibibazo mu muryango wawe mu gihe wubaka ubuhanga bw\'agaciro.',
    'features.community.title': 'Kwiga Ubuntu',
    'features.community.description': 'Huza n\'urubyiruko rundi rwiga mu Rwanda no mu Burasirazuba bw\'Afurika mu muryango wacu ushyigikira.',
    
    // Testimonials
    'testimonials.title': 'Inkuru z\'Umuryango Wacu',
    'testimonials.subtitle': 'Urubyiruko rw\'u Rwanda rwahinduye ubuzima bwarwo binyuze mu buhanga bwa digitale.',
    'testimonial.amara.quote': 'Tek Riders yampagarije ibyiringiro igihe ntari mfite na kimwe. Kwiga gukora urubuga mu Kinyarwanda byamfashije gutangira ubucuruzi bwanjye bwa tekinoroji i Kigali.',
    'testimonial.jean.quote': 'Kuva mu cyaro cya Musanze kugeza ku gukora n\'abakiriya mpuzamahanga - Tek Riders yakoze inzozi zanjye z\'ubumenyi bw\'amakuru zishoboka. Murakoze cyane!',
    'testimonial.grace.quote': 'Nk\'umukobwa mukuru mu buhanga, kubona abayobozi babyumva umuco wanjye byari byose. Ubu nkora porogaramu zikoreshwa mu Burasirazuba bw\'Afurika.',
    
    // CTA Section
    'cta.title': 'Witeguye Guhindura Ejo Hazaza Hawe?',
    'cta.subtitle': 'Jya mu rubyiruko rw\'u Rwanda rurenga 5,000 rubaka ubuzima bwiza binyuze mu buhanga.',
    'cta.start': 'Tangira Ubuntu Uyu Munsi',
    'cta.browse': 'Shakisha Amasomo',
    
    // Footer
    'footer.description': 'Gushimangira urubyiruko rw\'u Rwanda rw\'isi yose n\'uburezi bwiza n\'uburambe bwo kwiga bushya bwakozwe ku muryango wacu.',
    'footer.platform.title': 'Urubuga',
    'footer.platform.browseCourses': 'Shakisha Amasomo',
    'footer.platform.becomeTutor': 'Ba Umwarimu',
    'footer.platform.mobileApp': 'Porogaramu yo muri Telefoni',
    'footer.support.title': 'Umutwe',
    'footer.support.helpCenter': 'Umwanya w\'Ubufasha',
    'footer.support.contactUs': 'Duhamagare',
    'footer.support.community': 'Umuryango',
    'footer.company.title': 'Ikigo',
    'footer.company.aboutUs': 'Turi bande',
    'footer.company.careers': 'Akazi',
    'footer.company.privacy': 'Politiki y\'Amahame',
    'footer.copyright': '© 2025 Tek Riders. Uburenganzira bwose burarinzwe.',
    
    // Auth Pages
    'auth.welcome': 'Murakaza neza!',
    'auth.welcomeBack': 'Murakaza neza!',
    'auth.continueJourney': 'Komeza urugendo rwawe rwo gutsinda mu buhanga',
    'auth.joinCommunity': 'Injira mu Muryango',
    'auth.startJourney': 'Tangira urugendo rwo gushimangira ubuhanga',
    'auth.email': 'Email',
    'auth.password': 'Ijambo banga',
    'auth.confirmPassword': 'Emeza Ijambo banga',
    'auth.fullName': 'Amazina Yose',
    'auth.rememberMe': 'Nyibuka',
    'auth.forgotPassword': 'Wibagiwe ijambo banga?',
    'auth.signIn': 'Kwinjira',
    'auth.signUp': 'Kora Konti',
    'auth.chooseRole': 'Hitamo uruhare rwawe:',
    'auth.learner': 'Umunyeshuri',
    'auth.tutor': 'Umwarimu',
    'auth.hasAccount': 'Usanzwe ufite konti?',
    'auth.noAccount': 'Uri mushya kuri Tek Riders?',
    'auth.createAccount': 'Kora konti yawe',
    'auth.signInAccount': 'Injira muri konti yawe',
    'auth.agreeTerms': 'Nemeye amabwiriza yo gukoresha na politiki y\'ubwoba',
    'auth.freeJoin': 'Ubuntu kwinjira',
    'auth.communitySize': '5K+ urubyiruko rwiga',
    'auth.expertMentors': 'Abayobozi b\'umuryango',
    'auth.emailPlaceholder': 'Andika aderesi ya email yawe',
    'auth.passwordPlaceholder': 'Andika ijambo banga',
    'auth.confirmPasswordPlaceholder': 'Emeza ijambo banga',
    'auth.fullNamePlaceholder': 'Andika amazina yawe yose',
    'auth.signingIn': 'Birimo kwinjira...',
    'auth.creatingAccount': 'Irimo gufunguka...',
    'auth.termsText': 'Mu kwiyandikisha, wemera',
    'auth.and': 'na',
    
    // Dashboard
    'dashboard.welcome': 'Murakaza neza',
    'dashboard.subtitle': 'Witeguye gukomeza kubaka ejo hazaza hawe? Reka dukomeze aho twari.',
    'dashboard.coursesEnrolled': 'Amasomo Wanditsemo',
    'dashboard.hoursLearned': 'Amasaha Wize',
    'dashboard.certificates': 'Ceretifika',
    'dashboard.continueLearning': 'Komeza Kwiga',
    'dashboard.quickActions': 'Ibikorwa Byihuse',
    'dashboard.browseCourses': 'Shakisha Amasomo',
    'dashboard.createCourse': 'Shyiraho Isomo',
    'dashboard.joinCommunity': 'Injira mu Muryango',
    'dashboard.achievements': 'Ibyagezweho',
    'dashboard.streakTitle': 'Iminsi Ikurikirana!',
    'dashboard.streakMessage': 'Urimo kubaka ibigwi! Komereza aho.',
    'dashboard.keepStreak': 'Komeza Kwiga',
    
    // Course Marketplace
    'courses.title': 'Shakisha Amasomo',
    'courses.subtitle': 'Menya ubuhanga buzahindura ubuzima bwawe kandi bufnafungure amahirwe mashya.',
    'courses.search': 'Shakisha amasomo, abarimu, cyangwa ingingo...',
    'courses.filters': 'Amashyushyu',
    'courses.allCategories': 'Ibyiciro Byose',
    'courses.programming': 'Porogaramu',
    'courses.design': 'Igishushanyo',
    'courses.businessTech': 'Tekinoroji y\'Ubucuruzi',
    'courses.generalIT': 'Tekinoroji Rusange',
    'courses.allLevels': 'Urwego Rwose',
    'courses.beginner': 'Utangira',
    'courses.intermediate': 'Hagati',
    'courses.advanced': 'Urwego rwo Hejuru',
    'courses.showing': 'Werekana',
    'courses.results': 'ibisubizo',
    'courses.for': 'kuri',
    'courses.enrollNow': 'Iyandikishe Ubu',
    'courses.preview': 'Reba Mbere',
    'courses.bestseller': 'Gikunda',
    'courses.noResults': 'Nta masomo aboneka',
    'courses.adjustFilters': 'Gerageza guhindura ibisabwa byawe byo gushakisha cyangwa amashyushyu',
    
    // Hero Card Content
    
    // Common
    'common.loading': 'Birimo gutegurwa...',
    'common.save': 'Bika',
    'common.cancel': 'Rangiza',
    'common.continue': 'Komeza',
    'common.back': 'Subira inyuma',
    'common.next': 'Ibikurikira',
    'common.previous': 'Ibyabanje',
    'common.close': 'Funga',
    'common.viewAll': 'Reba Byose',
    'common.learnMore': 'Menya Byinshi',
    'common.getStarted': 'Tangira',
    'common.by': 'Na',
    'common.free': 'Ku Ubuntu',
    'common.premium': 'Kirenze',
    'common.new': 'Gishya',
    'common.popular': 'Kizwi cyane',
    'common.recommended': 'Byasabwe',
  }
};

interface LanguageProviderProps {
  children: React.ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('language') as Language) || 'rw'; // Default to Kinyarwanda
    }
    return 'rw';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations['en']] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};