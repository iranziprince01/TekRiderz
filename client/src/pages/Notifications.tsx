import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Bell, ArrowLeft, Filter, Search, Check, Trash2, Eye, EyeOff,
  Clock, AlertCircle, CheckCircle, Info, Star, BookOpen, Users, Award, MessageSquare, Calendar, Settings,
  ChevronDown, MoreHorizontal, X
} from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

const Notifications: React.FC = () => {
  const { notifications, stats, loading, fetchNotifications, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const content = {
    en: {
      title: 'Notifications',
      subtitle: 'Stay updated with your latest activities',
      backToDashboard: 'Back to Dashboard',
      all: 'All',
      unread: 'Unread',
      read: 'Read',
      search: 'Search notifications...',
      filters: 'Filters',
      markAllRead: 'Mark all as read',
      deleteSelected: 'Delete Selected',
      noNotifications: 'No notifications yet',
      noResults: 'No notifications match your filters',
      loading: 'Loading notifications...',
      notificationTypes: {
        all: 'All Types',
        course_enrollment: 'Course Enrollment',
        course_completion: 'Course Completion',
        course_approval: 'Course Approval',
        course_publishing: 'Course Publishing',
        course_deletion: 'Course Deletion',
        assignment_reminder: 'Assignment Reminder',
        course_announcement: 'Course Announcement',
        discussion_reply: 'Discussion Reply',
        question_answered: 'Question Answered',
        system_update: 'System Update',
        welcome_email: 'Welcome',
        payment_received: 'Payment Received',
        grade_posted: 'Grade Posted',
        message_received: 'Message Received',
        forum_post: 'Forum Post',
        assignment_due: 'Assignment Due',
        course_deadline: 'Course Deadline',
        maintenance_notice: 'Maintenance Notice'
      },
      priorities: {
        all: 'All Priorities',
        urgent: 'Urgent',
        high: 'High',
        medium: 'Medium',
        low: 'Low'
      },
      stats: {
        total: 'Total',
        unread: 'Unread',
        read: 'Read'
      },
      actions: {
        markRead: 'Mark as Read',
        delete: 'Delete',
        view: 'View'
      },
      timeAgo: {
        justNow: 'Just now',
        minutesAgo: 'minutes ago',
        hoursAgo: 'hours ago',
        yesterday: 'Yesterday',
        daysAgo: 'days ago',
        lastWeek: 'Last week',
        lastMonth: 'Last month'
      }
    },
    rw: {
      title: 'Amakuru',
      subtitle: 'Menya ibintu bishya byakozwe',
      backToDashboard: 'Subira ku Kibaho',
      all: 'Byose',
      unread: 'Ntibyasomwe',
      read: 'Byasomwe',
      search: 'Shakisha amakuru...',
      filters: 'Ibikoresho',
      markAllRead: 'Bika byose nk\'ubyasomwe',
      deleteSelected: 'Siba Byahiswemo',
      noNotifications: 'Nta makuru ahari',
      noResults: 'Nta makuru ahura n\'ibikoresho byawe',
      loading: 'Amakuru arimo...',
      notificationTypes: {
        all: 'Ubwoko Bwose',
        course_enrollment: 'Kwiyandikisha mu Isomo',
        course_completion: 'Kurangiza Isomo',
        course_approval: 'Kemera Isomo',
        course_publishing: 'Gusohora Isomo',
        course_deletion: 'Gusiba Isomo',
        assignment_reminder: 'Ibyibutso by\'Umukoro',
        course_announcement: 'Itangazo rya Isomo',
        discussion_reply: 'Igisubizo mu Ngengero',
        question_answered: 'Ikibazo Cyasubijwe',
        system_update: 'Guhindura Sisitemu',
        welcome_email: 'Murakaza',
        payment_received: 'Amafaranga Yakiriwe',
        grade_posted: 'Igipimo Cyashyizwe',
        message_received: 'Ubutumwa Bwakiriwe',
        forum_post: 'Inyandiko mu Ngengero',
        assignment_due: 'Umukoro Uraza',
        course_deadline: 'Igihe Isomo Riraza',
        maintenance_notice: 'Itangazo rya Serivisi'
      },
      priorities: {
        all: 'Icyemezo Cyose',
        urgent: 'Bihutirwa',
        high: 'Hejuru',
        medium: 'Hagati',
        low: 'Hasi'
      },
      stats: {
        total: 'Byose',
        unread: 'Ntibyasomwe',
        read: 'Byasomwe'
      },
      actions: {
        markRead: 'Bika nk\'ubyasomwe',
        delete: 'Siba',
        view: 'Reba'
      },
      timeAgo: {
        justNow: 'Ubu',
        minutesAgo: 'iminota ishize',
        hoursAgo: 'amasaha ashize',
        yesterday: 'Ejo',
        daysAgo: 'iminsi ishize',
        lastWeek: 'Icyumweru gishize',
        lastMonth: 'Ukwezi kushize'
      }
    }
  };

  const t = (key: string) => {
    const keys = key.split('.');
    let current: any = content[language];
    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return key;
      }
    }
    return current;
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'course_publishing': return <BookOpen className="w-5 h-5 text-green-500" />;
      case 'course_enrollment': return <Users className="w-5 h-5 text-blue-500" />;
      case 'course_completion': return <Award className="w-5 h-5 text-yellow-500" />;
      case 'course_approval': return <CheckCircle className="w-5 h-5 text-green-500" />;

      case 'system_update': return <Settings className="w-5 h-5 text-indigo-500" />;
      case 'assignment_reminder': return <Calendar className="w-5 h-5 text-orange-500" />;
      case 'assignment_due': return <Calendar className="w-5 h-5 text-orange-500" />;
      case 'course_deadline': return <Calendar className="w-5 h-5 text-red-500" />;
      case 'welcome_email': return <Info className="w-5 h-5 text-teal-500" />;
      case 'course_deletion': return <Trash2 className="w-5 h-5 text-red-500" />;
      case 'payment_received': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'grade_posted': return <Star className="w-5 h-5 text-yellow-500" />;
      case 'message_received': return <MessageSquare className="w-5 h-5 text-purple-500" />;
      case 'forum_post': return <MessageSquare className="w-5 h-5 text-purple-500" />;
      case 'discussion_reply': return <MessageSquare className="w-5 h-5 text-purple-500" />;
      case 'question_answered': return <MessageSquare className="w-5 h-5 text-purple-500" />;
      case 'maintenance_notice': return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      default: return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400';
      case 'medium': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400';
      case 'low': return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400';
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return t('timeAgo.justNow');
    if (diffInMinutes < 60) return `${diffInMinutes} ${t('timeAgo.minutesAgo')}`;
    if (diffInHours < 24) return `${diffInHours} ${t('timeAgo.hoursAgo')}`;
    if (diffInDays === 1) return t('timeAgo.yesterday');
    if (diffInDays < 7) return `${diffInDays} ${t('timeAgo.daysAgo')}`;
    if (diffInDays < 30) return t('timeAgo.lastWeek');
    return t('timeAgo.lastMonth');
  };

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'unread' && notification.isRead) return false;
    if (filter === 'read' && !notification.isRead) return false;
    if (typeFilter !== 'all' && notification.notificationType !== typeFilter) return false;
    if (priorityFilter !== 'all' && notification.priority !== priorityFilter) return false;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        notification.title.toLowerCase().includes(searchLower) ||
        notification.message.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const handleMarkAsRead = async (notificationId: string) => {
    await markAsRead(notificationId);
  };

  const handleDeleteNotification = async (notificationId: string) => {
    await deleteNotification(notificationId);
  };

  const handleSelectNotification = (notificationId: string) => {
    setSelectedNotifications(prev => 
      prev.includes(notificationId) 
        ? prev.filter(id => id !== notificationId)
        : [...prev, notificationId]
    );
  };

  const handleBulkAction = async (action: 'read' | 'delete') => {
    if (selectedNotifications.length === 0) return;

    if (action === 'read') {
      await Promise.all(selectedNotifications.map(id => markAsRead(id)));
    } else if (action === 'delete') {
      await Promise.all(selectedNotifications.map(id => deleteNotification(id)));
    }
    
    setSelectedNotifications([]);
  };

  const handleNotificationClick = (notification: any) => {
    if (!notification.isRead) {
      markAsRead(notification._id);
    }
    
    // Route based on notification type and metadata
    const routeToPage = () => {
      const { notificationType, metadata } = notification;
      
      switch (notificationType) {
        case 'course_approval':
        case 'course_publishing':
        case 'course_published':
          // For course-related notifications, navigate to the course page
          if (metadata?.courseId) {
            navigate(`/course/${metadata.courseId}`);
          } else if (user?.role === 'tutor') {
            navigate('/dashboard/courses');
          } else {
            navigate('/dashboard');
          }
          break;
          
        case 'course_enrollment':
          // For enrollment notifications, navigate to the course
          if (metadata?.courseId) {
            navigate(`/course/${metadata.courseId}`);
          } else {
            navigate('/dashboard');
          }
          break;
          
        case 'course_completion':
          // For completion notifications, navigate to certificates
          navigate('/certificates');
          break;
          
        case 'new_student_enrolled':
          // For tutor notifications about new students
          if (metadata?.courseId) {
            navigate(`/course/${metadata.courseId}`);
          } else {
            navigate('/dashboard/courses');
          }
          break;
          
        case 'system_update':
        case 'maintenance_notice':
          // For system notifications, stay on notifications page
          break;
          
        default:
          // Default fallback based on user role
          if (user?.role === 'tutor') {
            navigate('/dashboard/courses');
          } else if (user?.role === 'learner') {
            navigate('/dashboard');
          } else {
            navigate('/dashboard');
          }
          break;
      }
    };
    
    // Execute the routing
    routeToPage();
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                <Bell className="w-6 h-6 mr-3 text-blue-600" />
                {t('title')}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {t('subtitle')}
              </p>
            </div>
            
            {/* Stats */}
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-sm text-gray-500 dark:text-gray-400">{t('stats.total')}</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500 dark:text-gray-400">{t('stats.unread')}</div>
                <div className="text-xl font-bold text-blue-600">{stats.unread}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder={t('search')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filter Toggle */}
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                {t('filters')}
                <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </Button>
            </div>

            {/* Bulk Actions */}
            <div className="flex gap-2">
              {selectedNotifications.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => handleBulkAction('read')}
                    className="flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    {t('actions.markRead')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleBulkAction('delete')}
                    className="flex items-center gap-2 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                    {t('actions.delete')}
                  </Button>
                </>
              )}
              <Button
                onClick={markAllAsRead}
                className="flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                {t('markAllRead')}
              </Button>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <Card className="mt-4 p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Status
                  </label>
                  <div className="flex gap-2">
                    {(['all', 'unread', 'read'] as const).map((status) => (
                                             <Button
                         key={status}
                         variant={filter === status ? 'primary' : 'outline'}
                         size="sm"
                         onClick={() => setFilter(status)}
                       >
                        {t(status)}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Type Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Type
                  </label>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    {Object.entries(content[language].notificationTypes).map(([key, value]) => (
                      <option key={key} value={key === 'all' ? 'all' : key}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Priority
                  </label>
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    {Object.entries(content[language].priorities).map(([key, value]) => (
                      <option key={key} value={key === 'all' ? 'all' : key}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Notifications List */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <Card className="p-8 text-center">
              <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {searchTerm || showFilters ? t('noResults') : t('noNotifications')}
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                {searchTerm || showFilters ? 'Try adjusting your filters or search terms.' : 'You\'ll see notifications here when they arrive.'}
              </p>
            </Card>
          ) : (
            filteredNotifications.map((notification) => (
              <Card
                key={notification._id}
                className={`p-4 transition-all duration-200 hover:shadow-md ${
                  !notification.isRead ? 'border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-900/10' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedNotifications.includes(notification._id)}
                    onChange={() => handleSelectNotification(notification._id)}
                    className="mt-1"
                  />

                  {/* Icon */}
                  <div className="flex-shrink-0">
                    {getNotificationIcon(notification.notificationType)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                            {notification.title}
                          </h3>
                          {!notification.isRead && (
                                                         <Badge variant="info" className="text-xs">
                               New
                             </Badge>
                          )}
                          <Badge className={`text-xs ${getPriorityColor(notification.priority)}`}>
                            {notification.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(notification.createdAt)}
                          </span>
                          <span>{t(`notificationTypes.${notification.notificationType}`)}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {notification.actionUrl && (
                          <Button
                            size="sm"
                            onClick={() => handleNotificationClick(notification)}
                            className="text-xs"
                          >
                            {t('actions.view')}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMarkAsRead(notification._id)}
                          className="text-xs"
                        >
                          {notification.isRead ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteNotification(notification._id)}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Notifications; 