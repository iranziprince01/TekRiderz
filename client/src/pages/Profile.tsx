import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../contexts/AuthContext';
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
  RefreshCw
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
    location: ''
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

  const loadProfile = async (forceRefresh = false) => {
    try {
      setLoading(true);
      
      console.log('Starting profile load. User from auth context:', user);
      
      // Try to fetch fresh profile data from the backend for persistence verification
      try {
        console.log('Loading profile from backend...');
        const response = await apiClient.getProfile();
        console.log('Backend response:', response);
        
        if (response.success && response.data && response.data.user) {
          const backendUser = response.data.user;
          console.log('Backend user data:', backendUser);
          
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
            avatar: backendUser.avatar || undefined
          };
          
          console.log('Processed profile data from backend:', profileData);
          
          setProfile(profileData);
          setFormData({
            name: profileData.name,
            email: profileData.email,
            phone: profileData.phone,
            bio: profileData.bio,
            location: profileData.location
          });
          
          console.log('Profile loaded from CouchDB successfully');
          return;
        } else {
          console.log('Backend response not successful or no data:', response);
        }
      } catch (backendError) {
        console.warn('Failed to load from backend, error:', backendError);
      }
      
      // Fallback to user context data
      if (user) {
        console.log('Using fallback auth context data:', user);
        
        const profileData = {
          id: user.id || '',
          name: user.name || '',
          email: user.email || '',
          phone: user.profile?.phone || '',
          bio: user.profile?.bio || '',
          location: user.profile?.location || '',
          role: user.role || 'learner',
          status: 'active',
          createdAt: new Date().toISOString(),
          lastLogin: user.lastLogin || new Date().toISOString(),
          avatar: user.avatar || undefined
        };
        
        console.log('Processed profile data from auth context:', profileData);
        
        setProfile(profileData);
        setFormData({
          name: profileData.name,
          email: profileData.email,
          phone: profileData.phone,
          bio: profileData.bio,
          location: profileData.location
        });
        
        console.log('Profile loaded from auth context (fallback)');
      } else {
        console.error('No user data available in auth context');
        setMessage({ type: 'error', text: 'No user data available. Please try logging in again.' });
      }
    } catch (err: any) {
      console.error('Failed to load profile:', err);
      setMessage({ type: 'error', text: 'Failed to load profile data' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      if (!formData.name.trim()) {
        setMessage({ type: 'error', text: 'Name is required' });
        return;
      }

      // Prepare data in the format expected by backend
      const updateData = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        bio: formData.bio.trim(),
        location: formData.location.trim(),
        // Note: Email updates might require additional verification
        // For now, we'll exclude email from profile updates
      };

      console.log('Updating profile with data:', updateData);

      const response = await apiClient.updateProfile(updateData);

      if (response.success) {
        setMessage({ type: 'success', text: 'Profile updated and synced to database successfully!' });
        setEditing(false);
        
        // Update the profile state with the returned data
        if (response.data && response.data.user) {
          const updatedUser = response.data.user;
          const updatedProfile = {
            id: updatedUser.id || updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            phone: updatedUser.profile?.phone || '',
            bio: updatedUser.profile?.bio || '',
            location: updatedUser.profile?.location || '',
            role: updatedUser.role,
            status: updatedUser.status,
            createdAt: profile?.createdAt || new Date().toISOString(),
            lastLogin: profile?.lastLogin || new Date().toISOString(),
            avatar: updatedUser.avatar
          };
          
          setProfile(updatedProfile);
          setFormData({
            name: updatedProfile.name,
            email: updatedProfile.email,
            phone: updatedProfile.phone,
            bio: updatedProfile.bio,
            location: updatedProfile.location
          });

          console.log('Profile successfully updated in CouchDB:', updatedProfile);
        }
      } else {
        setMessage({ type: 'error', text: response.error || 'Failed to update profile' });
        console.error('Profile update failed:', response.error);
      }
    } catch (err: any) {
      console.error('Profile update error:', err);
      setMessage({ 
        type: 'error', 
        text: err.message || 'Network error - please check your connection and try again' 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      setFormData({
        name: profile.name,
        email: profile.email,
        phone: profile.phone || '',
        bio: profile.bio || '',
        location: profile.location || ''
      });
    }
    setEditing(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getInitials = (name?: string) => {
    if (!name || typeof name !== 'string') {
      return 'U'; // Default to 'U' for User
    }
    return name.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'tutor':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'learner':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">Failed to load profile</p>
          <Button onClick={() => loadProfile()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg border-l-4 ${
            message.type === 'success'
              ? 'bg-blue-50 border-blue-400 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200'
              : 'bg-red-50 border-red-400 text-red-800 dark:bg-red-900/20 dark:text-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Profile
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your personal information
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!editing ? (
            <>
              <Button 
                variant="outline"
                onClick={() => loadProfile(true)}
                disabled={loading}
                className="flex items-center gap-2"
                title="Refresh data from database"
              >
                {loading ? <LoadingSpinner size="sm" /> : <RefreshCw size={16} />}
                Refresh
              </Button>
              <Button 
                onClick={() => setEditing(true)} 
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <Edit3 size={16} />
                Edit Profile
              </Button>
            </>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={saving}
                className="flex items-center gap-2"
              >
                <X size={16} />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
              >
                {saving ? <LoadingSpinner size="sm" /> : <Save size={16} />}
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Profile Card */}
      <Card className="p-8">
        {/* Avatar and Basic Info */}
        <div className="flex items-center gap-6 mb-8">
                   <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-2xl">
           {profile.avatar ? (
             <img 
               src={profile.avatar} 
               alt="Profile" 
               className="w-full h-full rounded-full object-cover" 
             />
           ) : (
             getInitials(profile?.name)
           )}
         </div>
                     <div>
             <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
               {profile?.name || 'Enter your name'}
             </h2>
             <p className="text-gray-600 dark:text-gray-400 mb-2">{profile?.email || 'Enter your email'}</p>
             <Badge className={getRoleColor(profile?.role || 'learner')}>
               {profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : 'User'}
             </Badge>
           </div>
        </div>

        {/* Profile Information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Personal Details */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Personal Information
            </h3>

            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Full Name *
                  </label>
                                     <Input
                     type="text"
                     value={formData.name}
                     onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                     placeholder="e.g., John Doe"
                   />
                 </div>

                 <div>
                   <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                     Email Address
                   </label>
                   <Input
                     type="email"
                     value={formData.email}
                     onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                     placeholder="e.g., john@example.com"
                   />
                 </div>

                 <div>
                   <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                     Phone Number
                   </label>
                   <Input
                     type="tel"
                     value={formData.phone}
                     onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                     placeholder="e.g., +1 (555) 123-4567"
                   />
                 </div>

                 <div>
                   <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                     Location
                   </label>
                   <Input
                     type="text"
                     value={formData.location}
                     onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                     placeholder="e.g., New York, USA"
                   />
                 </div>

                 <div>
                   <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                     Bio
                   </label>
                   <textarea
                     value={formData.bio}
                     onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                     placeholder="Write a brief description about yourself, your interests, or professional background..."
                     rows={4}
                     className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                   />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                                 <div className="flex items-center gap-3">
                   <User className="text-blue-600" size={20} />
                   <div>
                     <p className="text-sm text-gray-600 dark:text-gray-400">Full Name</p>
                     <p className="font-medium text-gray-900 dark:text-white">{profile?.name || 'Click edit to add your name'}</p>
                   </div>
                 </div>

                 <div className="flex items-center gap-3">
                   <Mail className="text-blue-600" size={20} />
                   <div>
                     <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
                     <p className="font-medium text-gray-900 dark:text-white">{profile?.email || 'Click edit to add your email'}</p>
                   </div>
                 </div>

                 {profile?.phone && (
                   <div className="flex items-center gap-3">
                     <Phone className="text-blue-600" size={20} />
                     <div>
                       <p className="text-sm text-gray-600 dark:text-gray-400">Phone</p>
                       <p className="font-medium text-gray-900 dark:text-white">{profile.phone}</p>
                     </div>
                   </div>
                 )}

                 {profile?.location && (
                   <div className="flex items-center gap-3">
                     <MapPin className="text-blue-600" size={20} />
                     <div>
                       <p className="text-sm text-gray-600 dark:text-gray-400">Location</p>
                       <p className="font-medium text-gray-900 dark:text-white">{profile.location}</p>
                     </div>
                   </div>
                 )}

                 {profile?.bio && (
                   <div className="mt-6">
                     <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">About</p>
                     <p className="text-gray-900 dark:text-white leading-relaxed">{profile.bio}</p>
                   </div>
                 )}
              </div>
            )}
          </div>

          {/* Account Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Account Information
            </h3>

            <div className="space-y-4">
                             <div className="flex items-center gap-3">
                 <Calendar className="text-blue-600" size={20} />
                 <div>
                   <p className="text-sm text-gray-600 dark:text-gray-400">Member Since</p>
                   <p className="font-medium text-gray-900 dark:text-white">
                     {profile?.createdAt ? formatDate(profile.createdAt) : 'Unknown'}
                   </p>
                 </div>
               </div>

               {profile?.lastLogin && (
                 <div className="flex items-center gap-3">
                   <Calendar className="text-blue-600" size={20} />
                   <div>
                     <p className="text-sm text-gray-600 dark:text-gray-400">Last Login</p>
                     <p className="font-medium text-gray-900 dark:text-white">
                       {formatDate(profile.lastLogin)}
                     </p>
                   </div>
                 </div>
               )}
             </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Profile;