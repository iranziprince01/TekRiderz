import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import Header from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { 
  BookOpen, 
  Users, 
  Award, 
  CheckCircle, 
  ArrowRight,
  Star,
  PlayCircle,
  Zap,
  Shield,
  Globe
} from 'lucide-react';

const Landing: React.FC = () => {
  const { t } = useLanguage();

  const featuredCourses = [
    {
      id: 1,
      title: t('hero.card.title') || 'Introduction to Programming',
      description: 'Learn the fundamentals of programming with modern languages and best practices.',
      instructor: 'John Smith',
      students: 1250,
      rating: 4.8,
      price: t('common.free') || 'Free',
      category: 'Programming'
    },
    {
      id: 2,
      title: 'Web Development Basics',
      description: 'Build your first website with HTML, CSS, and JavaScript fundamentals.',
      instructor: 'Sarah Johnson',
      students: 890,
      rating: 4.9,
      price: t('common.free') || 'Free',
      category: 'Web Development'
    },
    {
      id: 3,
      title: 'Digital Marketing Fundamentals',
      description: 'Learn essential digital marketing strategies for modern businesses.',
      instructor: 'Mike Davis',
      students: 650,
      rating: 4.7,
      price: t('common.free') || 'Free',
      category: 'Marketing'
    }
  ];

  const stats = [
    { 
      label: t('stats.learners') || 'Active Learners', 
      value: '10,000+', 
      icon: Users,
      description: 'Growing community'
    },
    { 
      label: t('stats.courses') || 'Courses Available', 
      value: '500+', 
      icon: BookOpen,
      description: 'Expert-led content'
    },
    { 
      label: t('stats.tutors') || 'Expert Instructors', 
      value: '150+', 
      icon: Award,
      description: 'Industry professionals'
    },
    { 
      label: t('stats.success') || 'Certificates Issued', 
      value: '5,000+', 
      icon: CheckCircle,
      description: 'Career advancement'
    }
  ];

  const features = [
    {
      icon: BookOpen,
      title: t('features.learn.title') || 'Quality Content',
      description: t('features.learn.description') || 'Learn from industry experts with practical, up-to-date content that matters in today\'s job market.'
    },
    {
      icon: Users,
      title: t('features.community.title') || 'Community Support',
      description: t('features.community.description') || 'Connect with fellow learners, get help when you need it, and build lasting professional relationships.'
    },
    {
      icon: Award,
      title: 'Certificates',
      description: 'Earn recognized certificates to showcase your achievements and advance your career prospects.'
    },
    {
      icon: Zap,
      title: 'Fast & Interactive',
      description: 'Engage with hands-on projects and interactive content designed for modern learning experiences.'
    },
    {
      icon: Shield,
      title: 'Secure & Reliable',
      description: 'Your data and progress are protected with enterprise-grade security and reliable infrastructure.'
    },
    {
      icon: Globe,
      title: 'Global Access',
      description: 'Learn from anywhere in the world with our responsive platform that works on any device.'
    }
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-200">
      {/* Header */}
      <Header showAuth={true} />

      {/* Hero Section */}
      <section className="relative py-16 lg:py-24 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.02] dark:opacity-[0.05]"></div>
        <div className="absolute top-0 right-0 w-72 h-72 bg-blue-400/5 dark:bg-blue-400/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-indigo-400/5 dark:bg-indigo-400/10 rounded-full blur-3xl"></div>
        
        <div className="relative container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              <div className="space-y-6">
                <div className="inline-flex items-center px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-sm font-medium">
                  <Zap className="w-4 h-4 mr-2" />
                  {t('landing.hero.subtitle') || 'Modern E-Learning Platform'}
                </div>
                
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white leading-tight">
                  {t('landing.hero.title') || 'Learn Skills'}<br />
                  <span className="text-blue-600 dark:text-blue-400">That Matter</span>
                </h1>
                
                <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 leading-relaxed max-w-2xl">
                  {t('landing.hero.description') || 'Access high-quality courses from industry experts. Build practical skills and advance your career with our comprehensive learning platform.'}
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/signup" className="flex-1 sm:flex-none">
                  <Button size="lg" className="w-full sm:w-auto shadow-lg hover:shadow-xl transition-shadow">
                    {t('landing.hero.cta') || 'Start Learning Today'}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/signup" className="flex-1 sm:flex-none">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto border-2">
                    {t('landing.hero.demo') || 'Browse Courses'}
                  </Button>
                </Link>
              </div>

              {/* Trust Indicators */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>Free courses available</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>Industry certificates</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>Expert instructors</span>
                </div>
              </div>
            </div>

            {/* Right Content - Feature Card */}
            <div className="relative">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 lg:p-8 backdrop-blur-sm">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Featured Course</h3>
                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-sm font-medium rounded-full">
                      {t('common.free') || 'Free'}
                    </span>
                  </div>
                  
                  <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-xl flex items-center justify-center group cursor-pointer transition-all hover:scale-105">
                    <div className="text-center">
                      <PlayCircle className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-2 group-hover:text-blue-500 transition-colors" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">Click to preview</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Introduction to Web Development</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Learn the basics of HTML, CSS, and JavaScript to build your first website
                      </p>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span>1,250</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500" />
                          <span>4.8</span>
                        </div>
                      </div>
                      <Button size="sm" variant="outline">
                        {t('common.learnMore') || 'Learn More'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Floating elements */}
              <div className="absolute -top-3 -right-3 bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium shadow-lg animate-bounce">
                {t('common.new') || 'New'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 lg:py-20 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 lg:mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              {t('testimonials.title') || 'Join Our Growing Community'}
            </h2>
            <p className="text-lg lg:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              {t('testimonials.subtitle') || 'Thousands of learners are already building their future with us'}
            </p>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center group">
                <div className="inline-flex items-center justify-center w-16 h-16 lg:w-20 lg:h-20 bg-blue-50 dark:bg-blue-900/30 rounded-2xl mb-4 group-hover:scale-110 transition-transform">
                  <stat.icon className="w-8 h-8 lg:w-10 lg:h-10 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2">{stat.value}</div>
                <div className="text-sm lg:text-base font-medium text-gray-700 dark:text-gray-300 mb-1">{stat.label}</div>
                <div className="text-xs lg:text-sm text-gray-500 dark:text-gray-400">{stat.description}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Courses */}
      <section className="py-16 lg:py-20 bg-gray-50 dark:bg-gray-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 lg:mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              {t('courses.title') || 'Popular Courses'}
            </h2>
            <p className="text-lg lg:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              {t('courses.subtitle') || 'Start with these highly-rated courses from our community'}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {featuredCourses.map((course) => (
              <Card key={course.id} className="group overflow-hidden hover:shadow-xl dark:hover:shadow-2xl transition-all duration-300 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <PlayCircle className="w-12 h-12 text-gray-400 dark:text-gray-500 group-hover:text-blue-500 transition-colors" />
                </div>
                
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                      {course.category}
                    </span>
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-full">
                      {course.price}
                    </span>
                  </div>
                  
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {course.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-2">
                    {course.description}
                  </p>
                  
                  <div className="flex items-center gap-2 mb-4 text-sm text-gray-500 dark:text-gray-400">
                    <span>by {course.instructor}</span>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{course.students.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500" />
                        <span>{course.rating}</span>
                      </div>
                    </div>
                    
                    <Link to={`/course/${course.id}`}>
                      <Button size="sm" variant="outline" className="group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 transition-colors">
                        {t('common.viewAll') || 'View Course'}
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          
          <div className="text-center mt-12">
            <Link to="/signup">
              <Button size="lg" variant="outline" className="border-2 hover:bg-blue-50 dark:hover:bg-blue-900/30">
                {t('common.viewAll') || 'View All Courses'}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 lg:py-20 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 lg:mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              {t('features.title') || 'Why Choose TekRiders?'}
            </h2>
            <p className="text-lg lg:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              {t('features.subtitle') || 'Everything you need to succeed in your learning journey'}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="text-center group p-6 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-2xl mb-6 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{feature.title}</h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 lg:py-20 bg-gradient-to-r from-blue-600 to-indigo-700 dark:from-blue-700 dark:to-indigo-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-4xl mx-auto space-y-8 text-white">
            <h2 className="text-3xl lg:text-5xl font-bold">
              {t('cta.title') || 'Ready to Start Learning?'}
            </h2>
            <p className="text-lg lg:text-xl opacity-90 max-w-2xl mx-auto">
              {t('cta.subtitle') || 'Join thousands of learners who are building their future with TekRiders'}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
              <Link to="/signup" className="flex-1">
                <Button size="lg" variant="secondary" className="w-full shadow-lg hover:shadow-xl transition-shadow">
                  {t('cta.start') || 'Get Started Free'}
                </Button>
              </Link>
              <Link to="/login" className="flex-1">
                <Button size="lg" variant="outline" className="w-full border-white text-white hover:bg-white hover:text-blue-600 transition-colors">
                  {t('nav.login') || 'Sign In'}
                </Button>
              </Link>
            </div>
            
            <p className="text-sm opacity-75">
              No credit card required • Free forever • Start in 30 seconds
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 dark:bg-black text-white py-12 lg:py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
            <div className="col-span-2 md:col-span-1 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-blue-400">TekRiders</span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                {t('footer.description') || 'Empowering learners worldwide with quality education and innovative learning experiences.'}
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-white">{t('footer.platform.title') || 'Platform'}</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li className="hover:text-white transition-colors cursor-pointer">{t('footer.platform.browseCourses') || 'Browse Courses'}</li>
                <li className="hover:text-white transition-colors cursor-pointer">{t('footer.platform.becomeTutor') || 'Become Instructor'}</li>
                <li className="hover:text-white transition-colors cursor-pointer">{t('footer.platform.mobileApp') || 'Mobile App'}</li>
                <li className="hover:text-white transition-colors cursor-pointer">Enterprise</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-white">{t('footer.support.title') || 'Support'}</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li className="hover:text-white transition-colors cursor-pointer">{t('footer.support.helpCenter') || 'Help Center'}</li>
                <li className="hover:text-white transition-colors cursor-pointer">{t('footer.support.contactUs') || 'Contact Us'}</li>
                <li className="hover:text-white transition-colors cursor-pointer">{t('footer.support.community') || 'Community'}</li>
                <li className="hover:text-white transition-colors cursor-pointer">System Status</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-white">{t('footer.company.title') || 'Company'}</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li className="hover:text-white transition-colors cursor-pointer">{t('footer.company.aboutUs') || 'About Us'}</li>
                <li className="hover:text-white transition-colors cursor-pointer">{t('footer.company.careers') || 'Careers'}</li>
                <li className="hover:text-white transition-colors cursor-pointer">{t('footer.company.privacy') || 'Privacy Policy'}</li>
                <li className="hover:text-white transition-colors cursor-pointer">Terms of Service</li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-sm text-gray-400">
            <p>{t('footer.copyright') || '© 2024 TekRiders. All rights reserved.'}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;