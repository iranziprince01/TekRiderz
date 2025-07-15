import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { 
  User, 
  Mail, 
  Calendar, 
  MapPin, 
  Globe, 
  Phone,
  Edit3,
  Save,
  X,
  Camera,
  CheckCircle,
  Award,
  BookOpen,
  Clock,
  TrendingUp
} from 'lucide-react';
import { useComprehensiveDashboardData } from '../hooks/useComprehensiveDashboardData';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { apiClient } from '../utils/api';

const Profile: React.FC = () => {
  const { t } = useLanguage();
  const { isOnline } = useNetworkStatus();
  const {
    user,
    stats,
    enrolledCourses,
    certificates,
    isLoading,
    error,
    refreshData
  } = useComprehensiveDashboardData();

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    location: '',
    website: '',
    phone: '',
    education: '',
    experience: '',
    expertise: [] as string[],
    socialMedia: {
      twitter: '',
      linkedin: '',
      github: ''
    }
  });

  // Initialize form data when user data is available
  React.useEffect(() => {
    if (user && !isEditing) {
      setFormData({
        name: user.name || '',
        bio: user.profile?.bio || '',
        location: user.profile?.location || '',
        website: user.profile?.website || '',
        phone: user.profile?.phone || '',
        education: user.profile?.education || '',
        experience: user.profile?.experience || '',
        expertise: user.profile?.expertise || [],
        socialMedia: {
          twitter: user.profile?.socialMedia?.twitter || '',
          linkedin: user.profile?.socialMedia?.linkedin || '',
          github: user.profile?.socialMedia?.github || ''
        }
      });
    }
  }, [user, isEditing]);

  // Calculate user statistics
  const userStats = React.useMemo(() => {
    const totalEnrolled = enrolledCourses?.length || 0;
    const totalCompleted = enrolledCourses?.filter((course: any) => 
      course.enrollment?.status === 'completed' || 
      course.progress?.percentage >= 100
    ).length || 0;
    const totalCertificates = certificates?.length || 0;
    const totalTimeSpent = stats?.timeSpent || 0;
    const averageProgress = stats?.averageProgress || 0;
    
    return {
      totalEnrolled,
      totalCompleted,
      totalCertificates,
      totalTimeSpent: Math.round(totalTimeSpent / 60), // Convert to minutes
      averageProgress,
      completionRate: totalEnrolled > 0 ? Math.round((totalCompleted / totalEnrolled) * 100) : 0
    };
  }, [enrolledCourses, certificates, stats]);

  // Handle form changes
  const handleInputChange = (field: string, value: any) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...(prev as any)[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  // Handle expertise changes
  const handleExpertiseChange = (value: string) => {
    const expertiseArray = value.split(',').map(item => item.trim()).filter(Boolean);
    setFormData(prev => ({
      ...prev,
      expertise: expertiseArray
    }));
  };

  // Handle profile update
  const handleSave = async () => {
    if (!isOnline) {
      setEditError(t('You need to be online to update your profile'));
      return;
    }

    setSaving(true);
    setEditError('');
    setEditSuccess('');

    try {
      const response = await apiClient.updateUserProfile({
        name: formData.name,
        profile: {
          bio: formData.bio,
          location: formData.location,
          website: formData.website,
          phone: formData.phone,
          education: formData.education,
          experience: formData.experience,
          expertise: formData.expertise,
          socialMedia: formData.socialMedia
        }
      });

      if (response.success) {
        setEditSuccess(t('Profile updated successfully'));
        setIsEditing(false);
        // Refresh data to get updated profile
        await refreshData();
      } else {
        setEditError(response.error || t('Failed to update profile'));
      }
    } catch (error) {
      console.error('Profile update error:', error);
      setEditError(t('Failed to update profile. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  // Handle cancel editing
  const handleCancel = () => {
    setIsEditing(false);
    setEditError('');
    setEditSuccess('');
    // Reset form data to original values
    if (user) {
      setFormData({
        name: user.name || '',
        bio: user.profile?.bio || '',
        location: user.profile?.location || '',
        website: user.profile?.website || '',
        phone: user.profile?.phone || '',
        education: user.profile?.education || '',
        experience: user.profile?.experience || '',
        expertise: user.profile?.expertise || [],
        socialMedia: {
          twitter: user.profile?.socialMedia?.twitter || '',
          linkedin: user.profile?.socialMedia?.linkedin || '',
          github: user.profile?.socialMedia?.github || ''
        }
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <LoadingSpinner className="mx-auto mb-4" />
          <p className="text-gray-600">
            {t('Loading your profile...')}
          </p>
        </div>
      </div>
    );
  }

  if (!user || error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-8 text-center">
          <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {t('Unable to load profile')}
          </h3>
          <p className="text-gray-600">
            {error || t('Profile information is not available')}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {t('My Profile')}
        </h1>
        <p className="text-gray-600 mt-1">
          {t('Manage your personal information and preferences')}
        </p>
      </div>

      {/* Error/Success Messages */}
      {editError && (
        <Card className="p-4 bg-red-50 border-red-200">
          <p className="text-red-700">{editError}</p>
        </Card>
      )}

      {editSuccess && (
        <Card className="p-4 bg-green-50 border-green-200">
          <p className="text-green-700">{editSuccess}</p>
        </Card>
      )}

      {/* Profile Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Profile Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">{t('Basic Information')}</h2>
              {!isEditing ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  disabled={!isOnline}
                  className="flex items-center gap-2"
                >
                  <Edit3 className="w-4 h-4" />
                  {t('Edit')}
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2"
                  >
                    {saving ? (
                      <LoadingSpinner className="w-4 h-4" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {saving ? t('Saving...') : t('Save')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={saving}
                    className="flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    {t('Cancel')}
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                    {user.avatar ? (
                      <img 
                        src={user.avatar} 
                        alt={user.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      user.name?.charAt(0)?.toUpperCase() || 'U'
                    )}
                  </div>
                  {isEditing && (
                    <button className="absolute bottom-0 right-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white">
                      <Camera className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{user.name}</h3>
                  <p className="text-gray-600 capitalize">{user.role}</p>
                  <Badge variant={user.status === 'active' ? 'success' : 'default'} className="text-xs mt-1">
                    {t(user.status)}
                  </Badge>
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('Full Name')}
                  </label>
                  {isEditing ? (
                    <Input
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder={t('Enter your full name')}
                    />
                  ) : (
                    <p className="text-gray-900">{user.name || t('Not provided')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('Email')}
                  </label>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <p className="text-gray-900">{user.email}</p>
                    {user.verified && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('Location')}
                  </label>
                  {isEditing ? (
                    <Input
                      value={formData.location}
                      onChange={(e) => handleInputChange('location', e.target.value)}
                      placeholder={t('Enter your location')}
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <p className="text-gray-900">{user.profile?.location || t('Not provided')}</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('Phone')}
                  </label>
                  {isEditing ? (
                    <Input
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder={t('Enter your phone number')}
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <p className="text-gray-900">{user.profile?.phone || t('Not provided')}</p>
                    </div>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('Website')}
                  </label>
                  {isEditing ? (
                    <Input
                      value={formData.website}
                      onChange={(e) => handleInputChange('website', e.target.value)}
                      placeholder={t('Enter your website URL')}
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-gray-400" />
                      {user.profile?.website ? (
                        <a 
                          href={user.profile.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {user.profile.website}
                        </a>
                      ) : (
                        <p className="text-gray-900">{t('Not provided')}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('Bio')}
                  </label>
                  {isEditing ? (
                    <textarea
                      value={formData.bio}
                      onChange={(e) => handleInputChange('bio', e.target.value)}
                      placeholder={t('Tell us about yourself')}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-gray-900">{user.profile?.bio || t('No bio provided')}</p>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Professional Information */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">{t('Professional Information')}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('Education')}
                </label>
                {isEditing ? (
                  <Input
                    value={formData.education}
                    onChange={(e) => handleInputChange('education', e.target.value)}
                    placeholder={t('Enter your education background')}
                  />
                ) : (
                  <p className="text-gray-900">{user.profile?.education || t('Not provided')}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('Experience')}
                </label>
                {isEditing ? (
                  <textarea
                    value={formData.experience}
                    onChange={(e) => handleInputChange('experience', e.target.value)}
                    placeholder={t('Describe your work experience')}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : (
                  <p className="text-gray-900">{user.profile?.experience || t('Not provided')}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('Expertise')} <span className="text-gray-500 text-xs">({t('comma separated')})</span>
                </label>
                {isEditing ? (
                  <Input
                    value={formData.expertise.join(', ')}
                    onChange={(e) => handleExpertiseChange(e.target.value)}
                    placeholder={t('e.g., React, Node.js, Python')}
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {user.profile?.expertise?.length > 0 ? (
                      user.profile.expertise.map((skill: string, index: number) => (
                        <Badge key={index} variant="default" className="text-xs">
                          {skill}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-gray-900">{t('No expertise listed')}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column - Statistics and Activity */}
        <div className="space-y-6">
          {/* Learning Statistics */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">{t('Learning Statistics')}</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-500" />
                  <span className="text-sm text-gray-600">{t('Enrolled Courses')}</span>
                </div>
                <span className="font-semibold">{userStats.totalEnrolled}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-gray-600">{t('Completed')}</span>
                </div>
                <span className="font-semibold">{userStats.totalCompleted}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm text-gray-600">{t('Certificates')}</span>
                </div>
                <span className="font-semibold">{userStats.totalCertificates}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-500" />
                  <span className="text-sm text-gray-600">{t('Time Spent')}</span>
                </div>
                <span className="font-semibold">{userStats.totalTimeSpent}m</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-orange-500" />
                  <span className="text-sm text-gray-600">{t('Avg Progress')}</span>
                </div>
                <span className="font-semibold">{userStats.averageProgress}%</span>
              </div>
            </div>
          </Card>

          {/* Account Information */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">{t('Account Information')}</h2>
            
            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-600">{t('Member since')}</span>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-sm">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : t('Unknown')}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-sm text-gray-600">{t('Last login')}</span>
                <p className="text-sm mt-1">
                  {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : t('Unknown')}
                </p>
              </div>

              <div>
                <span className="text-sm text-gray-600">{t('Account status')}</span>
                <div className="mt-1">
                  <Badge variant={user.status === 'active' ? 'success' : 'default'}>
                    {t(user.status)}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;