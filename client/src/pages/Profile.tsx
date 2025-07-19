import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Badge } from '../components/ui/Badge';
import ProfilePictureUpload from '../components/ui/ProfilePictureUpload';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { apiClient } from '../utils/api';
import { 
  User,
  Mail,
  Phone, 
  MapPin, 
  Edit3,
  Save,
  X,
  Calendar,
  RefreshCw,
  CheckCircle,
  Settings,
  BookOpen
} from 'lucide-react';

interface ProfileData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  bio?: string;
  location?: string;
  role: string;
  status: string;
  createdAt: string;
  lastLogin?: string;
  avatar?: string;
}

const Profile: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    bio: '',
    location: '',
    avatar: ''
  });

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      
      // Try to fetch fresh profile data from the backend
      try {
        const response = await apiClient.getProfile();
        
        if (response.success && response.data && response.data.user) {
          const backendUser = response.data.user;
          
          const profileData = {
            id: backendUser.id || backendUser._id,
            name: backendUser.name || '',
            email: backendUser.email || '',
            phone: backendUser.profile?.phone || '',
            bio: backendUser.profile?.bio || '',
            location: backendUser.profile?.location || '',
            role: backendUser.role || 'learner',
            status: backendUser.status || 'active',
            createdAt: backendUser.createdAt || new Date().toISOString(),
            lastLogin: backendUser.lastLogin || new Date().toISOString(),
            avatar: backendUser.avatar || backendUser.profile?.avatar || ''
          };
          
          setProfile(profileData);
          setFormData({
            name: profileData.name,
            email: profileData.email,
            phone: profileData.phone,
            bio: profileData.bio,
            location: profileData.location,
            avatar: profileData.avatar
          });
          return;
        }
      } catch (backendError) {
        console.warn('Backend profile fetch failed, using auth context:', backendError);
      }

      // Fallback to auth context if backend fails
      if (user) {
        const profileData = {
          id: user.id || (user as any)._id || '',
          name: user.name || '',
          email: user.email || '',
          phone: user.profile?.phone || '',
          bio: user.profile?.bio || '',
          location: user.profile?.location || '',
          role: user.role || 'learner',
          status: (user as any).status || 'active',
          createdAt: (user as any).createdAt || new Date().toISOString(),
          lastLogin: (user as any).lastLogin || new Date().toISOString(),
          avatar: (user as any).avatar || user.profile?.avatar || ''
        };
        
        setProfile(profileData);
        setFormData({
          name: profileData.name,
          email: profileData.email,
          phone: profileData.phone,
          bio: profileData.bio,
          location: profileData.location,
          avatar: profileData.avatar
        });
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
      setMessage({
        type: 'error',
        text: t('Failed to load profile. Please try again.')
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setEditing(true);
    setMessage(null);
  };

  const handleCancel = () => {
    setEditing(false);
    setMessage(null);
    // Reset form data to original profile values
    if (profile) {
      setFormData({
        name: profile.name,
        email: profile.email,
        phone: profile.phone || '',
        bio: profile.bio || '',
        location: profile.location || '',
        avatar: profile.avatar || ''
      });
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const response = await apiClient.updateProfile({
        name: formData.name,
        avatar: formData.avatar,
        profile: {
          phone: formData.phone,
          bio: formData.bio,
          location: formData.location,
          avatar: formData.avatar
        }
      });

      if (response.success) {
        setMessage({
          type: 'success',
          text: t('Profile updated successfully!')
        });
        setEditing(false);
        await loadProfile(); // Reload to get fresh data
      } else {
        throw new Error(response.error || t('Failed to update profile'));
      }
    } catch (error) {
      console.error('Profile update error:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : t('Failed to update profile')
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAvatarUpload = (url: string) => {
    setFormData(prev => ({
      ...prev,
      avatar: url
    }));
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return t('Unknown');
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'learner': return t('Learner');
      case 'tutor': return t('Instructor');
      case 'admin': return t('Administrator');
      default: return role;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-center">
          <LoadingSpinner size="lg" className="text-blue-600" />
          <p className="text-gray-600 mt-4 text-lg">
            {t('Loading your profile...')}
          </p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-8 text-center max-w-md border-gray-200">
          <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {t('Profile not found')}
          </h3>
          <p className="text-gray-600 mb-6">
            {t('Unable to load your profile information')}
          </p>
          <Button 
            onClick={loadProfile}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {t('Try Again')}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-8">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          {/* Profile Picture Upload */}
          <div className="flex-shrink-0">
            {editing ? (
              <ProfilePictureUpload
                onImageUploaded={handleAvatarUpload}
                currentImageUrl={formData.avatar}
                userName={profile.name}
                size="lg"
              />
            ) : (
              <div className="relative">
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg bg-gradient-to-br from-blue-400 to-blue-600">
                  {profile.avatar && !profile.avatar.startsWith('data:') ? (
                    <img
                      src={profile.avatar}
                      alt={`${profile.name}'s profile picture`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        // Show fallback initials
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = `
                            <div class="w-full h-full flex items-center justify-center text-white font-bold text-4xl">
                              ${profile.name.split(' ').map(word => word.charAt(0)).join('').toUpperCase().slice(0, 2)}
                            </div>
                          `;
                        }
                      }}
                    />
                  ) : profile.avatar?.startsWith('data:') ? (
                    <img
                      src={profile.avatar}
                      alt={`${profile.name}'s profile picture`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white font-bold text-4xl">
                      {profile.name.split(' ').map(word => word.charAt(0)).join('').toUpperCase().slice(0, 2)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Basic Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {profile.name}
            </h1>
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <Badge variant="default" className="bg-blue-100 text-blue-800 px-3 py-1">
                <User className="w-4 h-4 mr-2" />
                {getRoleDisplayName(profile.role)}
              </Badge>
              <Badge variant="success" className="bg-green-100 text-green-800 px-3 py-1">
                <CheckCircle className="w-4 h-4 mr-2" />
                {t('Active')}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Mail className="w-4 h-4" />
              <span>{profile.email}</span>
            </div>
          </div>
          
          {/* Edit Button */}
          <div className="flex-shrink-0">
            {!editing ? (
              <Button
                onClick={handleEdit}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
              >
                <Edit3 className="w-4 h-4 mr-2" />
                {t('Edit Profile')}
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2"
                >
                  {saving ? (
                    <LoadingSpinner size="sm" className="mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  {t('Save')}
                </Button>
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2"
                >
                  <X className="w-4 h-4 mr-2" />
                  {t('Cancel')}
                </Button>
              </div>
            )}
          </div>
        </div>
        
        {/* Success/Error Messages */}
        {message && (
          <div className={`mt-4 p-4 rounded-lg border ${
            message.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center gap-2">
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <X className="w-5 h-5" />
              )}
              <span>{message.text}</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Personal Information */}
        <Card className="p-6 border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <User className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">{t('Personal Information')}</h2>
          </div>
          
          <div className="space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('Full Name')}
              </label>
              {editing ? (
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  placeholder={t('Enter your full name')}
                />
              ) : (
                <p className="text-gray-900 py-2 px-3 bg-gray-50 rounded-lg">
                  {profile.name || t('Not provided')}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('Email Address')}
              </label>
              <p className="text-gray-900 py-2 px-3 bg-gray-50 rounded-lg">
                {profile.email}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {t('Email cannot be changed')}
              </p>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('Phone Number')}
              </label>
              {editing ? (
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="w-full border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  placeholder={t('Enter your phone number')}
                />
              ) : (
                <p className="text-gray-900 py-2 px-3 bg-gray-50 rounded-lg">
                  {profile.phone || t('Not provided')}
                </p>
              )}
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('Location')}
              </label>
              {editing ? (
                <Input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleChange('location', e.target.value)}
                  className="w-full border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  placeholder={t('Enter your location')}
                />
              ) : (
                <p className="text-gray-900 py-2 px-3 bg-gray-50 rounded-lg">
                  {profile.location || t('Not provided')}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* About & Account Info */}
        <div className="space-y-8">
          {/* Bio Section */}
          <Card className="p-6 border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <BookOpen className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">{t('About')}</h2>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('Bio')}
              </label>
              {editing ? (
                <textarea
                  value={formData.bio}
                  onChange={(e) => handleChange('bio', e.target.value)}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-blue-500 resize-none"
                  placeholder={t('Tell us about yourself...')}
                />
              ) : (
                <div className="text-gray-900 py-3 px-3 bg-gray-50 rounded-lg min-h-[100px]">
                  {profile.bio || (
                    <span className="text-gray-500 italic">
                      {t('No bio provided yet')}
                    </span>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Account Information */}
          <Card className="p-6 border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Settings className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">{t('Account Information')}</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">{t('Member Since')}</span>
                </div>
                <span className="text-sm text-gray-900">{formatDate(profile.createdAt)}</span>
              </div>
              
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">{t('Last Login')}</span>
                </div>
                <span className="text-sm text-gray-900">
                  {profile.lastLogin ? formatDate(profile.lastLogin) : t('Unknown')}
                </span>
              </div>
              
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">{t('Account Status')}</span>
                </div>
                <Badge variant="success" className="bg-green-100 text-green-800 text-xs">
                  {t('Active')}
                </Badge>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;