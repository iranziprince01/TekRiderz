import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Badge } from '../../components/ui/Badge';
import { 
  Eye, 
  UserCheck, 
  UserX, 
  Trash2, 
  X,
  Shield,
  Crown,
  GraduationCap,
  Edit3,
  Save,
  AlertTriangle,
  RefreshCw,
  Users,
  Search
} from 'lucide-react';
import { apiClient, updateUserRole, getFileUrl } from '../../utils/api';

interface UserData {
  id: string;
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'tutor' | 'learner';
  status: 'active' | 'suspended' | 'inactive';
  createdAt: string;
  lastLogin?: string;
  verified: boolean;
  enrolledCourses?: number;
  completedCourses?: number;
  avatar?: string;
  profile?: {
    bio?: string;
    location?: string;
    website?: string;
    expertise?: string[];
    socialMedia?: any;
  };
}

interface UserStats {
  total: number;
  admins: number;
  tutors: number;
  learners: number;
  active: number;
  inactive: number;
  suspended: number;
}

interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

const AdminUsers: React.FC = () => {
  const { t } = useLanguage();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string>('');
  const [hoveredButton, setHoveredButton] = useState<string>('');
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    pages: 0
  });
  const [stats, setStats] = useState<UserStats>({
    total: 0,
    admins: 0,
    tutors: 0,
    learners: 0,
    active: 0,
    inactive: 0,
    suspended: 0
  });

  // Cache management
  const CACHE_KEY = 'admin-users-data';
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  const getCachedData = () => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const isExpired = Date.now() - timestamp > CACHE_DURATION;
        if (!isExpired) {
          return data;
        }
      }
    } catch (error) {
      console.warn('Failed to parse cached users data:', error);
    }
    return null;
  };

  const setCachedData = (userData: UserData[], paginationData: any, statsData: UserStats) => {
    try {
      const cacheData = {
        users: userData,
        pagination: paginationData,
        stats: statsData,
        timestamp: Date.now()
      };
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache users data:', error);
    }
  };

  const addToast = (toast: Omit<ToastNotification, 'id'>) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { ...toast, id }]);
    setTimeout(() => removeToast(id), toast.duration || 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const loadUsers = async (page = 1, showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      
      // Check cache first
      const cached = getCachedData();
      if (cached && page === 1) {
        setUsers(cached.users);
        setPagination(cached.pagination);
        setStats(cached.stats);
        return;
      }

      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        ...(roleFilter && { role: roleFilter }),
        ...(statusFilter && { status: statusFilter }),
        ...(searchTerm && { search: searchTerm })
      });

      const response = await apiClient.getUsers(params);
      
      if (response.success) {
        const userData = response.data.users || [];
        const paginationData = response.data.pagination || {};
        const statsData = response.data.stats || {};

        // Calculate stats from user data if not provided by backend
        const calculatedStats = {
          total: statsData.total || userData.length,
          admins: statsData.admins || userData.filter((u: UserData) => u.role === 'admin').length,
          tutors: statsData.tutors || userData.filter((u: UserData) => u.role === 'tutor').length,
          learners: statsData.learners || userData.filter((u: UserData) => u.role === 'learner').length,
          active: statsData.active || userData.filter((u: UserData) => u.status === 'active').length,
          inactive: statsData.inactive || userData.filter((u: UserData) => u.status === 'inactive').length,
          suspended: statsData.suspended || userData.filter((u: UserData) => u.status === 'suspended').length,
        };

        setUsers(userData);
        setPagination(paginationData);
        setStats(calculatedStats);

        // Cache the data
        setCachedData(userData || [], paginationData, calculatedStats);

      } else {
        addToast({ type: 'error', title: 'Error', message: response.error || 'Failed to load users' });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message || 'Failed to load users' });
    } finally {
      setLoading(false);
    }
  };

  const handleUserAction = async (userId: string, action: 'activate' | 'deactivate' | 'delete', force = false) => {
    const user = users.find(u => u.id === userId || u._id === userId);
    if (!user) {
      console.error('User not found in local data:', { userId, users: users.map(u => ({ id: u.id, _id: u._id })) });
      return;
    }

    const actualUserId = user._id || user.id;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('User action:', { 
        action, 
        inputUserId: userId, 
        foundUser: { id: user.id, _id: user._id, name: user.name }, 
        actualUserId 
      });
    }

    const confirmMessages = {
      activate: `Are you sure you want to activate ${user.name || user.email || 'this user'}?`,
      deactivate: `Are you sure you want to deactivate ${user.name || user.email || 'this user'}?`,
      delete: force 
        ? `FORCE DELETE: Are you sure you want to permanently delete ${user.name || user.email || 'this user'} and ALL associated data? This action cannot be undone.`
        : `Are you sure you want to delete ${user.name || user.email || 'this user'}? This action cannot be undone.`
    };

    if (!window.confirm(confirmMessages[action])) return;

    try {
      setActionLoading(`${action}-${userId}`);
      let response;

      if (action === 'delete') {
        response = await apiClient.deleteUser(actualUserId, force);
      } else {
        const isActive = action === 'activate';
        response = await apiClient.updateUserStatus(actualUserId, isActive);
      }

      if (response.success) {
        addToast({
          type: 'success',
          title: 'Success',
          message: `User ${action}d successfully!`
        });
        
        if (action === 'delete') {
          setShowDetailModal(false);
          setSelectedUser(null);
        } else if (selectedUser && (selectedUser.id === userId || selectedUser._id === userId)) {
          setSelectedUser({
            ...selectedUser,
            status: action === 'activate' ? 'active' : 'suspended'
          });
        }
        
        loadUsers(pagination.page);
      } else {
        if (action === 'delete' && !force && response.error?.includes('associated data')) {
          const forceDelete = window.confirm(
            `${response.error}\n\nDo you want to FORCE DELETE this user and all associated data? This action cannot be undone.`
          );
          
          if (forceDelete) {
            handleUserAction(userId, action, true);
            return;
          }
        }
        
        addToast({
          type: 'error',
          title: 'Error',
          message: response.error || `Failed to ${action} user`
        });
      }
    } catch (err: any) {
      if (action === 'delete' && !force && err.message?.includes('associated data')) {
        const forceDelete = window.confirm(
          `${err.message}\n\nDo you want to FORCE DELETE this user and all associated data? This action cannot be undone.`
        );
        
        if (forceDelete) {
          handleUserAction(userId, action, true);
          return;
        }
      }
      
      addToast({ type: 'error', title: 'Error', message: err.message || `Failed to ${action} user` });
    } finally {
      setActionLoading('');
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    const user = users.find(u => u.id === userId || u._id === userId);
    if (!user) return;

    const actualUserId = user._id || user.id;
    
    const confirmMessage = `Are you sure you want to change ${user.name || user.email || 'this user'}'s role from ${user.role} to ${newRole}? This will affect their permissions and access.`;
    
    if (!window.confirm(confirmMessage)) return;

    try {
      setActionLoading(`role-${userId}`);
      const response = await updateUserRole(actualUserId, newRole);

      if (response.success) {
        addToast({
          type: 'success',
          title: 'Role Updated',
          message: `${user.name || user.email || 'User'}'s role has been changed to ${newRole}`
        });
        
        if (selectedUser && (selectedUser.id === userId || selectedUser._id === userId)) {
          setSelectedUser({
            ...selectedUser,
            role: newRole as 'admin' | 'tutor' | 'learner'
          });
        }
        
        loadUsers(pagination.page);
      } else {
        addToast({
          type: 'error',
          title: 'Error',
          message: response.error || 'Failed to update user role'
        });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message || 'Failed to update user role' });
    } finally {
      setActionLoading('');
    }
  };

  const openUserDetails = (user: UserData) => {
    setSelectedUser(user);
    setEditingUser(user);
    setEditMode(false);
    setShowDetailModal(true);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    
    // Check if date is valid and not in the future
    if (isNaN(date.getTime()) || date > new Date()) {
      // If date is invalid or in the future, return a fallback
      return 'N/A';
    }
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getRoleBadge = (role: string) => {
    const roleConfigs = {
      admin: { 
        label: 'Admin', 
        className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        icon: Crown
      },
      tutor: { 
        label: 'Tutor', 
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        icon: GraduationCap
      },
      learner: { 
        label: 'Learner', 
        className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        icon: Shield
      }
    };
    
    const config = roleConfigs[role as keyof typeof roleConfigs] || roleConfigs.learner;
    const IconComponent = config.icon;
    
    return (
      <Badge variant="default" className={config.className}>
        <IconComponent className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const statusConfigs = {
      active: { 
        label: t('admin.users.active'), 
        className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      },
      suspended: { 
        label: t('admin.users.suspended'), 
        className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      },
      inactive: { 
        label: t('admin.users.inactive'), 
        className: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
      }
    };
    
    const config = statusConfigs[status as keyof typeof statusConfigs] || statusConfigs.inactive;
    
    return (
      <Badge variant="default" className={config.className}>
        {config.label}
      </Badge>
    );
  };

  useEffect(() => {
    loadUsers();
  }, [roleFilter, statusFilter, searchTerm]);

  const filteredUsers = users.filter(user => {
            const matchesSearch = !searchTerm || 
          (user.name && user.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesRole = !roleFilter || user.role === roleFilter;
    const matchesStatus = !statusFilter || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`p-4 rounded-lg shadow-lg max-w-sm transform transition-all duration-300 ${
              toast.type === 'success' ? 'bg-green-500 text-white' :
              toast.type === 'error' ? 'bg-red-500 text-white' :
              toast.type === 'warning' ? 'bg-yellow-500 text-white' :
              'bg-blue-500 text-white'
            }`}
          >
            <div className="font-semibold">{toast.title}</div>
            <div className="text-sm opacity-90">{toast.message}</div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('admin.users.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('admin.users.description')}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            onClick={() => loadUsers(pagination.page, true)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            {t('admin.users.refresh')}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('admin.users.totalUsers')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('admin.users.admins')}</p>
              <p className="text-2xl font-bold text-red-600">{stats.admins}</p>
            </div>
            <Crown className="w-8 h-8 text-red-500" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('admin.users.tutors')}</p>
              <p className="text-2xl font-bold text-blue-600">{stats.tutors}</p>
            </div>
            <GraduationCap className="w-8 h-8 text-blue-500" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('admin.users.learners')}</p>
              <p className="text-2xl font-bold text-green-600">{stats.learners}</p>
            </div>
            <Shield className="w-8 h-8 text-green-500" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('admin.users.search')}
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder={t('admin.users.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="flex gap-6">
            <div className="w-48">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('admin.users.role')}
              </label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">{t('admin.users.allRoles')}</option>
                <option value="admin">{t('admin.users.admin')}</option>
                <option value="tutor">{t('admin.users.tutor')}</option>
                <option value="learner">{t('admin.users.learner')}</option>
              </select>
            </div>
            
            <div className="w-48">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('admin.users.status')}
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">{t('admin.users.allStatuses')}</option>
                <option value="active">{t('admin.users.active')}</option>
                <option value="inactive">{t('admin.users.inactive')}</option>
                <option value="suspended">{t('admin.users.suspended')}</option>
              </select>
            </div>
          </div>
          

        </div>
      </Card>

      {/* Users Table */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('admin.users.user')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('admin.users.role')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('admin.users.status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('admin.users.joined')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('admin.users.lastLogin')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('admin.users.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {user.avatar ? (
                          <img
                            src={getFileUrl(user.avatar, 'avatar')}
                            alt={user.name || user.email || 'User avatar'}
                            className="w-10 h-10 rounded-full object-cover"
                            onError={(e) => {
                              // Fallback to initials if image fails to load
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              target.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={`w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm ${user.avatar ? 'hidden' : ''}`}>
                          {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {user.name || user.email || 'Unknown User'}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getRoleBadge(user.role)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(user.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {user.lastLogin ? formatDate(user.lastLogin) : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <button
                            onClick={() => openUserDetails(user)}
                            className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            onMouseEnter={() => setHoveredButton(`view-${user.id}`)}
                            onMouseLeave={() => setHoveredButton('')}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {hoveredButton === `view-${user.id}` && (
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded whitespace-nowrap z-10">
                              {t('admin.users.viewDetails')}
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-900 dark:border-t-gray-100"></div>
                            </div>
                          )}
                        </div>
                        
                        <div className="relative">
                          <button
                            onClick={() => handleUserAction(user.id, user.status === 'active' ? 'deactivate' : 'activate')}
                            disabled={actionLoading === `${user.status === 'active' ? 'deactivate' : 'activate'}-${user.id}`}
                            className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
                            onMouseEnter={() => setHoveredButton(`${user.status === 'active' ? 'deactivate' : 'activate'}-${user.id}`)}
                            onMouseLeave={() => setHoveredButton('')}
                          >
                            {actionLoading === `${user.status === 'active' ? 'deactivate' : 'activate'}-${user.id}` ? (
                              <LoadingSpinner size="sm" />
                            ) : user.status === 'active' ? (
                              <UserX className="w-4 h-4" />
                            ) : (
                              <UserCheck className="w-4 h-4" />
                            )}
                          </button>
                          {hoveredButton === `${user.status === 'active' ? 'deactivate' : 'activate'}-${user.id}` && (
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded whitespace-nowrap z-10">
                              {user.status === 'active' ? t('admin.users.deactivate') : t('admin.users.activate')}
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-900 dark:border-t-gray-100"></div>
                            </div>
                          )}
                        </div>
                        
                        <div className="relative">
                          <button
                            onClick={() => handleUserAction(user.id, 'delete')}
                            disabled={actionLoading === `delete-${user.id}`}
                            className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                            onMouseEnter={() => setHoveredButton(`delete-${user.id}`)}
                            onMouseLeave={() => setHoveredButton('')}
                          >
                            {actionLoading === `delete-${user.id}` ? (
                              <LoadingSpinner size="sm" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                          {hoveredButton === `delete-${user.id}` && (
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded whitespace-nowrap z-10">
                              {t('admin.users.deleteUser')}
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-900 dark:border-t-gray-100"></div>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadUsers(pagination.page - 1)}
            disabled={pagination.page === 1}
          >
            {t('admin.courses.pagination.previous')}
          </Button>
          
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {t('admin.courses.pagination.page')} {pagination.page} {t('admin.courses.pagination.of')} {pagination.pages}
          </span>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadUsers(pagination.page + 1)}
            disabled={pagination.page >= pagination.pages}
          >
            {t('admin.courses.pagination.next')}
          </Button>
        </div>
      )}

      {/* User Details Modal */}
      {showDetailModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {t('admin.users.userDetails')}
                </h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditMode(!editMode)}
                    className="flex items-center gap-1"
                  >
                    {editMode ? <Save className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                    {editMode ? t('admin.users.save') : t('admin.users.edit')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDetailModal(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="space-y-6">
                {/* User Info */}
                <div className="flex items-center gap-4">
                  {selectedUser.avatar ? (
                    <img
                      src={getFileUrl(selectedUser.avatar, 'avatar')}
                      alt={selectedUser.name || selectedUser.email || 'User avatar'}
                      className="w-16 h-16 rounded-full object-cover"
                      onError={(e) => {
                        // Fallback to initials if image fails to load
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-xl ${selectedUser.avatar ? 'hidden' : ''}`}>
                    {(selectedUser.name || selectedUser.email || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {selectedUser.name || selectedUser.email || 'Unknown User'}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">{selectedUser.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {getRoleBadge(selectedUser.role)}
                      {getStatusBadge(selectedUser.status)}
                    </div>
                  </div>
                </div>
                
                {/* Role Management */}
                {editMode && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-600" />
                      <h4 className="font-semibold text-yellow-800 dark:text-yellow-200">
                        {t('admin.users.roleManagement')}
                      </h4>
                    </div>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                      {t('admin.users.roleWarning')}
                    </p>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedUser.role}
                        onChange={(e) => {
                          const newRole = e.target.value as 'admin' | 'tutor' | 'learner';
                          setSelectedUser({ ...selectedUser, role: newRole });
                        }}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      >
                        <option value="learner">{t('admin.users.learner')}</option>
                        <option value="tutor">{t('admin.users.tutor')}</option>
                        <option value="admin">{t('admin.users.admin')}</option>
                      </select>
                      <Button
                        onClick={() => handleRoleChange(selectedUser.id, selectedUser.role)}
                        disabled={actionLoading === `role-${selectedUser.id}`}
                        size="sm"
                        className="bg-yellow-600 hover:bg-yellow-700 text-white"
                      >
                        {actionLoading === `role-${selectedUser.id}` ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          t('admin.users.updateRole')
                        )}
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Account Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">{t('admin.users.accountInfo')}</h4>
                    <div className="space-y-2 text-sm">
                      <p><span className="font-medium">{t('admin.users.userId')}:</span> {selectedUser.id}</p>
                      <p><span className="font-medium">{t('admin.users.verified')}:</span> {selectedUser.verified ? t('admin.users.yes') : t('admin.users.no')}</p>
                      <p><span className="font-medium">{t('admin.users.joined')}:</span> {formatDate(selectedUser.createdAt)}</p>
                      {selectedUser.lastLogin && (
                        <p><span className="font-medium">{t('admin.users.lastLogin')}:</span> {formatDate(selectedUser.lastLogin)}</p>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">{t('admin.users.learningStats')}</h4>
                    <div className="space-y-2 text-sm">
                      <p><span className="font-medium">{t('admin.users.enrolledCourses')}:</span> {selectedUser.enrolledCourses || 0}</p>
                      <p><span className="font-medium">{t('admin.users.completedCourses')}:</span> {selectedUser.completedCourses || 0}</p>
                    </div>
                  </div>
                </div>
                
                {/* Profile Info */}
                {selectedUser.profile && (
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">{t('admin.users.profile')}</h4>
                    <div className="space-y-2 text-sm">
                      {selectedUser.profile.bio && (
                        <p><span className="font-medium">{t('admin.users.bio')}:</span> {selectedUser.profile.bio}</p>
                      )}
                      {selectedUser.profile.location && (
                        <p><span className="font-medium">{t('admin.users.location')}:</span> {selectedUser.profile.location}</p>
                      )}
                      {selectedUser.profile.website && (
                        <p><span className="font-medium">{t('admin.users.website')}:</span> {selectedUser.profile.website}</p>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    variant="outline"
                    onClick={() => handleUserAction(selectedUser.id, selectedUser.status === 'active' ? 'deactivate' : 'activate')}
                    disabled={actionLoading.includes(selectedUser.id)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    {actionLoading.includes(selectedUser.id) ? (
                      <LoadingSpinner size="sm" />
                    ) : selectedUser.status === 'active' ? (
                        t('admin.users.deactivate')
                    ) : (
                        t('admin.users.activate')
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => handleUserAction(selectedUser.id, 'delete')}
                    disabled={actionLoading.includes(selectedUser.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    {actionLoading.includes(selectedUser.id) ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                        t('admin.users.deleteUser')
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers; 