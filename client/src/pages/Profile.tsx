import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { 
  User,
  Mail,
  Phone,
  Globe,
  Calendar,
  Settings,
  Save,
  Edit,
  Camera,
  X,
  Check,
  Upload,
  Trash2,
  ImageIcon
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getUserProfile, updateUserProfile, uploadAvatar } from '../utils/api';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  bio?: string;
  avatar?: string;
  role: string;
  status: string;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
  profile?: {
    bio?: string;
    location?: string;
    website?: string;
    phone?: string;
    expertise?: string[];
    education?: string;
    experience?: string;
    socialMedia?: {
      twitter?: string;
      linkedin?: string;
      github?: string;
    };
  };
  preferences?: {
    language: string;
    notifications: {
      email: boolean;
      push: boolean;
      marketing?: boolean;
    };
  };
  stats?: {
    totalEnrollments: number;
    completedCourses: number;
    averageProgress: number;
    timeSpent: number;
  };
}

const Profile: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  
  // Simple profile system - fetches data from CouchDB users database
  console.log('✅ Using simplified profile system with CouchDB');
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    location: '',
    website: '',
    phone: '',
    education: '',
    experience: '',
    expertise: [] as string[],
    language: 'en',
    notifications: {
      email: true,
      push: true,
      marketing: false
    },
    socialMedia: {
      twitter: '',
      linkedin: '',
      github: ''
    }
  });
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Simple direct avatar URL approach
  const getDirectAvatarUrl = (avatar?: string): string => {
    if (!avatar) return '';
    
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
    const directUrl = `${baseUrl}/uploads/users/avatars/${avatar}`;
    
    console.log('🔗 Direct avatar URL:', directUrl);
    return directUrl;
  };

  // Load profile data from CouchDB
  const loadProfile = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (!user || !isAuthenticated) {
        setError('Please log in to view your profile');
        return;
      }

      const response = await getUserProfile();
      
      if (response.success && response.data) {
        const userData = response.data.user;
        setProfile(userData);
        
        // Initialize form with profile data
        setFormData({
          name: userData.name || '',
          bio: userData.profile?.bio || '',
          location: userData.profile?.location || '',
          website: userData.profile?.website || '',
          phone: userData.profile?.phone || userData.phone || '',
          education: userData.profile?.education || '',
          experience: userData.profile?.experience || '',
          expertise: userData.profile?.expertise || [],
          language: userData.preferences?.language || 'en',
          notifications: {
            email: userData.preferences?.notifications?.email ?? true,
            push: userData.preferences?.notifications?.push ?? true,
            marketing: userData.preferences?.notifications?.marketing ?? false
          },
          socialMedia: {
            twitter: userData.profile?.socialMedia?.twitter || '',
            linkedin: userData.profile?.socialMedia?.linkedin || '',
            github: userData.profile?.socialMedia?.github || ''
          }
        });
      } else {
        setError(response.error || 'Failed to load profile');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      setError('Failed to load profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Save profile data to CouchDB
  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccessMessage('');

      const updateData = {
        name: formData.name,
        bio: formData.bio,
        location: formData.location,
        website: formData.website,
        phone: formData.phone,
        education: formData.education,
        experience: formData.experience,
        expertise: formData.expertise,
        preferences: {
          language: formData.language,
          notifications: formData.notifications
        },
        socialMedia: formData.socialMedia
      };

      const response = await updateUserProfile(updateData);
      
      if (response.success) {
        setSuccessMessage('Profile updated successfully!');
        setIsEditing(false);
        // Reload profile data
        await loadProfile();
      } else {
        setError(response.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      setError('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Handle avatar upload
  const handleAvatarUpload = async (file: File) => {
    try {
      setAvatarUploading(true);
      setError('');

      const response = await uploadAvatar(file);
      
      if (response.success) {
        setSuccessMessage('Avatar updated successfully!');
        await loadProfile(); // Reload to get updated avatar
      } else {
        setError(response.error || 'Failed to upload avatar');
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      setError('Failed to upload avatar. Please try again.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleAvatarUpload(file);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNestedInputChange = (section: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...(prev[section as keyof typeof prev] as any),
        [field]: value
      }
    }));
  };

  const addExpertise = (expertise: string) => {
    if (expertise.trim() && !formData.expertise.includes(expertise.trim())) {
      setFormData(prev => ({
        ...prev,
        expertise: [...prev.expertise, expertise.trim()]
      }));
    }
  };

  const removeExpertise = (expertise: string) => {
    setFormData(prev => ({
      ...prev,
      expertise: prev.expertise.filter(e => e !== expertise)
    }));
  };

  const getRoleDisplayName = (role: string) => {
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  useEffect(() => {
    if (isAuthenticated && user) {
      loadProfile();
    }
  }, [isAuthenticated, user]);

      if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" />
        </div>
      );
    }

    if (!isAuthenticated || !user) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <Alert variant="error">
            <X className="h-4 w-4" />
            <div>Please log in to view your profile</div>
          </Alert>
        </div>
      );
    }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {error && (
        <Alert variant="error">
          <X className="h-4 w-4" />
          <div>{error}</div>
        </Alert>
      )}

      {successMessage && (
        <Alert>
          <Check className="h-4 w-4" />
          <div>{successMessage}</div>
        </Alert>
      )}

      {profile && (
        <>
          {/* Profile Header */}
          <Card className="p-6">
            <div className="flex items-center space-x-6">
                              <div className="relative">
                  <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg overflow-hidden bg-gray-200">
                    {profile.avatar ? (
                      <img
                        src={getDirectAvatarUrl(profile.avatar)}
                        alt="Profile"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          console.log('❌ Avatar image failed to load');
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={`w-full h-full flex items-center justify-center bg-gray-300 ${profile.avatar ? 'hidden' : ''}`}>
                      <User className="w-8 h-8 text-gray-500" />
                    </div>
                  </div>
                <button
                  onClick={triggerFileUpload}
                  disabled={avatarUploading}
                  className="absolute bottom-0 right-0 bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600 disabled:opacity-50"
                >
                                      {avatarUploading ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <h1 className="text-2xl font-bold text-gray-900">{profile.name}</h1>
                                      <Badge variant="info">
                      {getRoleDisplayName(profile.role)}
                    </Badge>
                    {profile.verified && (
                      <Badge variant="success">Verified</Badge>
                    )}
                </div>
                <p className="text-gray-600 mt-1">{profile.email}</p>
                <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-4 w-4" />
                    <span>Joined {new Date(profile.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-2">
                {!isEditing ? (
                  <Button onClick={() => setIsEditing(true)} variant="outline">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                ) : (
                  <div className="flex space-x-2">
                    <Button onClick={handleSaveProfile} disabled={saving}>
                      {saving ? <LoadingSpinner size="sm" /> : <Save className="h-4 w-4 mr-2" />}
                      Save
                    </Button>
                    <Button onClick={() => setIsEditing(false)} variant="outline">
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Stats */}
          {profile.stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{profile.stats.totalEnrollments}</div>
                <div className="text-sm text-gray-600">Courses</div>
              </Card>
              <Card className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{profile.stats.completedCourses}</div>
                <div className="text-sm text-gray-600">Completed</div>
              </Card>
              <Card className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">{profile.stats.averageProgress}%</div>
                <div className="text-sm text-gray-600">Progress</div>
              </Card>
              <Card className="p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">{Math.round(profile.stats.timeSpent / 60)}h</div>
                <div className="text-sm text-gray-600">Time Spent</div>
              </Card>
            </div>
          )}

          {/* Profile Information */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Personal Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                {isEditing ? (
                  <Input
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Enter your name"
                  />
                ) : (
                  <p className="text-gray-900">{profile.name}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <p className="text-gray-600">{profile.email}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                {isEditing ? (
                  <Input
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="Enter your phone number"
                  />
                ) : (
                  <p className="text-gray-900">{profile.profile?.phone || profile.phone || 'Not provided'}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                {isEditing ? (
                  <Input
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    placeholder="Enter your location"
                  />
                ) : (
                  <p className="text-gray-900">{profile.profile?.location || 'Not provided'}</p>
                )}
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                {isEditing ? (
                  <textarea
                    value={formData.bio}
                    onChange={(e) => handleInputChange('bio', e.target.value)}
                    placeholder="Tell us about yourself"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{profile.profile?.bio || 'No bio provided'}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                {isEditing ? (
                  <Input
                    value={formData.website}
                    onChange={(e) => handleInputChange('website', e.target.value)}
                    placeholder="https://your-website.com"
                  />
                ) : (
                  <p className="text-gray-900">{profile.profile?.website || 'Not provided'}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Education</label>
                {isEditing ? (
                  <Input
                    value={formData.education}
                    onChange={(e) => handleInputChange('education', e.target.value)}
                    placeholder="Your education background"
                  />
                ) : (
                  <p className="text-gray-900">{profile.profile?.education || 'Not provided'}</p>
                )}
              </div>
            </div>
          </Card>

          {/* Expertise */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Expertise</h2>
            <div className="flex flex-wrap gap-2">
              {(isEditing ? formData.expertise : profile.profile?.expertise || []).map((skill, index) => (
                <div key={index} className="flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                  <span>{skill}</span>
                  {isEditing && (
                    <button
                      onClick={() => removeExpertise(skill)}
                      className="ml-2 text-blue-600 hover:text-blue-800"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
              {isEditing && (
                <div className="flex items-center">
                  <Input
                    placeholder="Add expertise"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        addExpertise(e.currentTarget.value);
                        e.currentTarget.value = '';
                      }
                    }}
                    className="w-32"
                  />
                </div>
              )}
            </div>
          </Card>

          {/* Preferences */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Preferences</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                {isEditing ? (
                  <select
                    value={formData.language}
                    onChange={(e) => handleInputChange('language', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                  </select>
                ) : (
                  <p className="text-gray-900">{profile.preferences?.language || 'English'}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notifications</label>
                <div className="space-y-2">
                  {['email', 'push', 'marketing'].map((type) => (
                    <label key={type} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.notifications[type as keyof typeof formData.notifications]}
                        onChange={(e) => handleNestedInputChange('notifications', type, e.target.checked)}
                        disabled={!isEditing}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">
                        {type.charAt(0).toUpperCase() + type.slice(1)} notifications
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default Profile;