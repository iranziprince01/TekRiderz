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
import { cacheUser, updateCachedUser, getCachedUser } from '../offline/cacheService';
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
  BookOpen,
  Wifi,
  WifiOff
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
  const { user, isOfflineMode } = useAuth();
  const { t } = useLanguage();
  
  // Safe translation function that handles missing keys gracefully
  const safeT = (key: string, fallback?: string) => {
    try {
      const translation = t(key);
      // If the translation returns the key itself, it means the key is missing
      if (translation === key) {
        console.warn(`Missing translation key: ${key}`);
        return fallback || key;
      }
      return translation;
    } catch (error) {
      console.warn(`Translation error for key: ${key}`, error);
      return fallback || key;
    }
  };
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isOffline, setIsOffline] = useState(false);
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

  // Detect offline mode
  useEffect(() => {
    const checkOfflineMode = () => {
      const offline = isOfflineMode || !navigator.onLine;
      setIsOffline(offline);
      if (offline) {
        console.log('Profile page in offline mode');
      }
    };

    checkOfflineMode();
    window.addEventListener('online', checkOfflineMode);
    window.addEventListener('offline', checkOfflineMode);

    return () => {
      window.removeEventListener('online', checkOfflineMode);
      window.removeEventListener('offline', checkOfflineMode);
    };
  }, [isOfflineMode]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      
      // Check if we're in offline mode
      if (isOffline || isOfflineMode || !navigator.onLine) {
        console.log('Loading profile from offline cache');
        setIsOffline(true);
        
        // Try to load from cached user data
        if (user?.id) {
          const cachedUser = await getCachedUser(user.id);
          if (cachedUser) {
            console.log('Profile loaded from cache');
            setProfile({
              id: cachedUser.id,
              name: cachedUser.name,
              email: cachedUser.email,
              phone: (cachedUser as any).phone,
              bio: (cachedUser as any).bio,
              location: (cachedUser as any).location,
              role: cachedUser.role,
              status: (cachedUser as any).status || 'active',
              createdAt: (cachedUser as any).createdAt || new Date().toISOString(),
              lastLogin: (cachedUser as any).lastLogin,
              avatar: cachedUser.avatar || undefined
            });
            setFormData({
              name: cachedUser.name,
              email: cachedUser.email,
              phone: (cachedUser as any).phone || '',
              bio: (cachedUser as any).bio || '',
              location: (cachedUser as any).location || '',
              avatar: cachedUser.avatar || ''
            });
            setLoading(false);
            return;
          }
        }
        
        // Fallback to AuthContext user data
        if (user) {
          console.log('Using AuthContext user data as fallback');
          setProfile({
            id: user.id,
            name: user.name,
            email: user.email,
            phone: (user as any).phone,
            bio: (user as any).bio,
            location: (user as any).location,
            role: user.role,
            status: 'active',
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            avatar: user.avatar || undefined
          });
          setFormData({
            name: user.name,
            email: user.email,
            phone: (user as any).phone || '',
            bio: (user as any).bio || '',
            location: (user as any).location || '',
            avatar: user.avatar || ''
          });
          setLoading(false);
          return;
        }
        
        setLoading(false);
        setMessage({ type: 'error', text: 'Unable to load profile data while offline' });
        return;
      }

      // Online mode - fetch fresh data
      console.log('Loading profile from API');
      const response = await apiClient.getProfile();
      
      console.log('API Response:', response);
      
      if (response.success && response.data) {
        // The backend returns { data: { user: {...} } }
        const userData = response.data.user || response.data;
        console.log('Profile loaded from API, userData:', userData);
        
        // Handle different response structures
        const profileData = {
          id: userData.id || userData._id || user?.id,
          name: userData.name || userData.fullName || '',
          email: userData.email || '',
          phone: userData.phone || userData.profile?.phone || '',
          bio: userData.bio || userData.profile?.bio || '',
          location: userData.location || userData.profile?.location || '',
          role: userData.role || 'learner',
          status: userData.status || 'active',
          createdAt: userData.createdAt || new Date().toISOString(),
          lastLogin: userData.lastLogin || new Date().toISOString(),
          avatar: userData.avatar || userData.profile?.avatar || ''
        };
        
        console.log('Processed profile data:', profileData);
        
        setProfile(profileData);
        setFormData({
          name: profileData.name,
          email: profileData.email,
          phone: profileData.phone || '',
          bio: profileData.bio || '',
          location: profileData.location || '',
          avatar: profileData.avatar || ''
        });
        
        // Cache the user data for offline access
        try {
          await cacheUser(userData);
          console.log('Profile cached for offline access');
        } catch (cacheError) {
          console.warn('Failed to cache profile:', cacheError);
        }
      } else {
        console.error('API response indicates failure:', response);
        throw new Error(response.message || response.error || 'Failed to load profile data');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      
      // Try to load from cache as fallback
      if (user?.id) {
        try {
          const cachedUser = await getCachedUser(user.id);
          if (cachedUser) {
            console.log('Loading from cache as fallback');
            setProfile({
              id: cachedUser.id,
              name: cachedUser.name,
              email: cachedUser.email,
              phone: (cachedUser as any).phone,
              bio: (cachedUser as any).bio,
              location: (cachedUser as any).location,
              role: cachedUser.role,
              status: (cachedUser as any).status || 'active',
              createdAt: (cachedUser as any).createdAt || new Date().toISOString(),
              lastLogin: (cachedUser as any).lastLogin,
              avatar: cachedUser.avatar || undefined
            });
            setFormData({
              name: cachedUser.name,
              email: cachedUser.email,
              phone: (cachedUser as any).phone || '',
              bio: (cachedUser as any).bio || '',
              location: (cachedUser as any).location || '',
              avatar: cachedUser.avatar || ''
            });
            return;
          }
        } catch (cacheError) {
          console.warn('Failed to load from cache:', cacheError);
        }
      }
      
      // Final fallback to AuthContext user data
      if (user) {
        console.log('Using AuthContext user data as final fallback');
        setProfile({
          id: user.id,
          name: user.name,
          email: user.email,
          phone: (user as any).phone,
          bio: (user as any).bio,
          location: (user as any).location,
          role: user.role,
          status: 'active',
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          avatar: user.avatar || undefined
        });
        setFormData({
          name: user.name,
          email: user.email,
          phone: (user as any).phone || '',
          bio: (user as any).bio || '',
          location: (user as any).location || '',
          avatar: user.avatar || ''
        });
      } else {
        setMessage({ type: 'error', text: 'Failed to load profile data. Please try refreshing the page.' });
      }
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
    // Reset form data to original values
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
    if (isOffline) {
      setMessage({ type: 'error', text: 'Cannot update profile while offline. Please connect to the internet and try again.' });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);

      const response = await apiClient.updateProfile(formData);
      
      if (response.success) {
        setProfile(prev => prev ? { ...prev, ...formData } : null);
        setEditing(false);
        setMessage({ type: 'success', text: 'Profile updated successfully' });
        
        // Update cached user data
        if (user) {
          const updatedUser = { ...user, ...formData };
          await updateCachedUser(updatedUser);
          console.log('Updated profile cached');
        }
      } else {
        throw new Error(response.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'inactive': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      case 'suspended': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default: return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
    }
  };

  const getRoleDisplayName = (role: string) => {
    try {
      switch (role.toLowerCase()) {
        case 'learner': return safeT('profile.student', 'Student');
        case 'tutor': return safeT('profile.instructor', 'Instructor');
        case 'admin': return safeT('profile.administrator', 'Administrator');
        default: return role;
      }
    } catch (error) {
      console.warn('Translation error for role:', role, error);
      return role;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return safeT('profile.unknown', 'Unknown');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-center">
          <LoadingSpinner size="lg" className="text-blue-600 dark:text-blue-400" />
          <p className="text-gray-600 dark:text-gray-400 mt-4 text-lg">
            {safeT('profile.loading', 'Loading your profile...')}
          </p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-8 text-center max-w-md border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <User className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Profile Not Found
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Unable to load your profile information. This might be due to a network issue or missing data.
          </p>
          <div className="space-y-3">
            <Button onClick={loadProfile} className="w-full">
              Try Again
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()} 
              className="w-full"
            >
              Reload Page
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto p-6">
      {/* Offline Indicator */}
      {isOffline && (
        <div className="bg-blue-50 dark:bg-blue-900/10 border-l-4 border-blue-400 rounded-r-lg p-3">
          <div className="flex items-center space-x-2">
            <WifiOff className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-blue-800 dark:text-blue-200 text-sm font-medium">
              Offline Mode
            </span>
            <span className="text-blue-600 dark:text-blue-400 text-sm">
              • Viewing cached data • Updates disabled
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 border border-blue-200 dark:border-gray-700 rounded-2xl p-8">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          {/* Profile Picture Upload */}
          <div className="flex-shrink-0">
            {editing ? (
              <ProfilePictureUpload
                onImageUploaded={(url: string) => handleInputChange('avatar', url)}
                currentImageUrl={formData.avatar}
                userName={profile.name}
                size="lg"
              />
            ) : (
              <div className="relative">
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white dark:border-gray-700 shadow-lg bg-gradient-to-br from-blue-400 to-blue-600">
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
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {profile.name}
            </h1>
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <Badge variant="default" className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1">
                <User className="w-4 h-4 mr-2" />
                {getRoleDisplayName(profile.role)}
              </Badge>
              <Badge variant="success" className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-3 py-1">
                <CheckCircle className="w-4 h-4 mr-2" />
                {safeT('profile.active', 'Active')}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Mail className="w-4 h-4" />
              <span>{profile.email}</span>
            </div>
          </div>
          
          {/* Edit Button */}
          <div className="flex-shrink-0">
            {!editing ? (
              <Button
                onClick={handleEdit}
                disabled={isOffline}
                className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-6 py-2"
              >
                <Edit3 className="w-4 h-4 mr-2" />
                {safeT('profile.editProfile', 'Edit Profile')}
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  onClick={handleSave}
                  disabled={saving || isOffline}
                  className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white px-4 py-2"
                >
                  {saving ? (
                    <LoadingSpinner size="sm" className="mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  {safeT('profile.save', 'Save')}
                </Button>
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 px-4 py-2"
                >
                  <X className="w-4 h-4 mr-2" />
                  {safeT('profile.cancel', 'Cancel')}
                </Button>
              </div>
            )}
          </div>
        </div>
        
        {/* Success/Error Messages */}
        {message && (
          <div className={`mt-4 p-4 rounded-lg border ${
            message.type === 'success' 
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-800 dark:text-green-200' 
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200'
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
        <Card className="p-6 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{safeT('profile.personalInformation', 'Personal Information')}</h2>
          </div>
          
          <div className="space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {safeT('profile.fullName', 'Full Name')}
              </label>
              {editing ? (
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  disabled={isOffline}
                  className="w-full border-gray-300 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400"
                  placeholder={safeT('profile.enterFullName', 'Enter your full name')}
                />
              ) : (
                <p className="text-gray-900 dark:text-white py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  {profile.name || safeT('profile.notProvided', 'Not provided')}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {safeT('profile.emailAddress', 'Email Address')}
              </label>
              <p className="text-gray-900 dark:text-white py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                {profile.email}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {safeT('profile.emailCannotBeChanged', 'Email cannot be changed')}
              </p>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {safeT('profile.phoneNumber', 'Phone Number')}
              </label>
              {editing ? (
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  disabled={isOffline}
                  className="w-full border-gray-300 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400"
                  placeholder={safeT('profile.enterPhoneNumber', 'Enter your phone number')}
                />
              ) : (
                <p className="text-gray-900 dark:text-white py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  {profile.phone || safeT('profile.notProvided', 'Not provided')}
                </p>
              )}
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {safeT('profile.location', 'Location')}
              </label>
              {editing ? (
                <Input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  disabled={isOffline}
                  className="w-full border-gray-300 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400"
                  placeholder={safeT('profile.enterLocation', 'Enter your location')}
                />
              ) : (
                <p className="text-gray-900 dark:text-white py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  {profile.location || safeT('profile.notProvided', 'Not provided')}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* About & Account Info */}
        <div className="space-y-8">
          {/* Bio Section */}
          <Card className="p-6 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{safeT('profile.about', 'About')}</h2>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {safeT('profile.bio', 'Bio')}
              </label>
              {editing ? (
                <textarea
                  value={formData.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  rows={4}
                  disabled={isOffline}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder={safeT('profile.tellUsAboutYourself', 'Tell us about yourself...')}
                />
              ) : (
                <div className="text-gray-900 dark:text-white py-3 px-3 bg-gray-50 dark:bg-gray-700 rounded-lg min-h-[100px]">
                  {profile.bio || (
                    <span className="text-gray-500 dark:text-gray-400 italic">
                      {safeT('profile.noBioProvidedYet', 'No bio provided yet')}
                    </span>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Account Information */}
          <Card className="p-6 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{safeT('profile.accountInformation', 'Account Information')}</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{safeT('profile.memberSince', 'Member Since')}</span>
                </div>
                <span className="text-sm text-gray-900 dark:text-white">{formatDate(profile.createdAt)}</span>
              </div>
              
              <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{safeT('profile.lastLogin', 'Last Login')}</span>
                </div>
                <span className="text-sm text-gray-900 dark:text-white">
                  {profile.lastLogin ? formatDate(profile.lastLogin) : safeT('profile.unknown', 'Unknown')}
                </span>
              </div>
              

            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;