import React, { useState, useEffect } from 'react';
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
  X
} from 'lucide-react';
import { apiClient } from '../../utils/api';

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
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(false); // Changed from true to false
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string>('');
  const [hoveredButton, setHoveredButton] = useState<string>('');
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
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
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        data: { users: userData, pagination: paginationData, stats: statsData },
        timestamp: Date.now()
      }));
    } catch (error) {
      console.warn('Failed to cache users data:', error);
    }
  };

  useEffect(() => {
    // Try to load from cache first
    const cachedData = getCachedData();
    if (cachedData) {
      setUsers(cachedData.users || []);
      setPagination(cachedData.pagination || { page: 1, limit: 12, total: 0, pages: 0 });
      setStats(cachedData.stats || {
        total: 0, admins: 0, tutors: 0, learners: 0, 
        active: 0, inactive: 0, suspended: 0
      });
      // Refresh in background without showing loader
      loadUsers(1, false);
    } else {
      // Only show loading if no cached data
    loadUsers();
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination(prev => ({ ...prev, page: 1 }));
      loadUsers(1);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, roleFilter, statusFilter]);

  const addToast = (toast: Omit<ToastNotification, 'id'>) => {
    const id = Date.now().toString();
    const newToast = { ...toast, id };
    setToasts(prev => [...prev, newToast]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, toast.duration || 4000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const loadUsers = async (page = 1, showLoader = true) => {
    try {
      if (showLoader && users.length === 0) { // Only show loader if no existing data
      setLoading(true);
      }
      // setError(''); // Removed as per new_code

      const params: any = { page, limit: pagination.limit };
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (roleFilter) params.role = roleFilter;
      if (statusFilter) params.status = statusFilter;

      const response = await apiClient.getUsers(params);

      if (response.success && response.data) {
        const { users: userData, pagination: paginationData } = response.data;
        
        // Debug: Log user data structure (development only)
        if (process.env.NODE_ENV === 'development') {
          console.log('Loaded users data:', userData?.slice(0, 2).map((u: UserData) => ({ id: u.id, _id: u._id, name: u.name })));
        }
        
        setUsers(userData || []);
        setPagination({
          page: paginationData.currentPage || paginationData.page || 1,
          limit: paginationData.itemsPerPage || paginationData.limit || 12,
          total: paginationData.totalItems || paginationData.total || 0,
          pages: paginationData.totalPages || paginationData.pages || 0
        });
        
        // Calculate stats
        const safeUserData = Array.isArray(userData) ? userData : [];
        const statsData: UserStats = {
          total: paginationData.totalItems || paginationData.total || 0,
          admins: safeUserData.filter((u: UserData) => u.role === 'admin').length,
          tutors: safeUserData.filter((u: UserData) => u.role === 'tutor').length,
          learners: safeUserData.filter((u: UserData) => u.role === 'learner').length,
          active: safeUserData.filter((u: UserData) => u.status === 'active').length,
          inactive: safeUserData.filter((u: UserData) => u.status === 'inactive').length,
          suspended: safeUserData.filter((u: UserData) => u.status === 'suspended').length
        };
        setStats(statsData);

        // Cache the data
        setCachedData(userData || [], paginationData, statsData);

      } else {
        // setError(response.error || 'Failed to load users'); // Removed as per new_code
        addToast({ type: 'error', title: 'Error', message: response.error || 'Failed to load users' });
      }
    } catch (err: any) {
      // setError(err.message || 'Failed to load users'); // Removed as per new_code
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

    // Use the CouchDB _id for API calls
    const actualUserId = user._id || user.id;
    
    // Debug: Log IDs being used (development only)
    if (process.env.NODE_ENV === 'development') {
      console.log('User action:', { 
        action, 
        inputUserId: userId, 
        foundUser: { id: user.id, _id: user._id, name: user.name }, 
        actualUserId 
      });
    }

    const confirmMessages = {
      activate: `Are you sure you want to activate ${user.name}?`,
      deactivate: `Are you sure you want to deactivate ${user.name}?`,
      delete: force 
        ? `FORCE DELETE: Are you sure you want to permanently delete ${user.name} and ALL associated data? This action cannot be undone.`
        : `Are you sure you want to delete ${user.name}? This action cannot be undone.`
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
        // Check if deletion failed due to constraints
        if (action === 'delete' && !force && response.error?.includes('associated data')) {
          const forceDelete = window.confirm(
            `${response.error}\n\nDo you want to FORCE DELETE this user and all associated data? This action cannot be undone.`
          );
          
          if (forceDelete) {
            // Retry with force=true using the original userId (which is what the component uses)
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
      // Check if deletion failed due to constraints
      if (action === 'delete' && !force && err.message?.includes('associated data')) {
        const forceDelete = window.confirm(
          `${err.message}\n\nDo you want to FORCE DELETE this user and all associated data? This action cannot be undone.`
        );
        
        if (forceDelete) {
          // Retry with force=true using the original userId (which is what the component uses)
          handleUserAction(userId, action, true);
          return;
        }
      }
      
      addToast({ type: 'error', title: 'Error', message: err.message || `Failed to ${action} user` });
    } finally {
      setActionLoading('');
    }
  };

  const openUserDetails = (user: UserData) => {
    setSelectedUser(user);
    setShowDetailModal(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getRoleBadge = (role: string) => {
    return (
      <Badge variant="default" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const configs = {
      active: { label: 'Active' },
      suspended: { label: 'Suspended' },
      inactive: { label: 'Inactive' }
    };
    
    const config = configs[status as keyof typeof configs] || configs.inactive;
    
    return (
      <Badge variant="default" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="flex items-center px-4 py-3 rounded-lg shadow-lg border-l-4 transition-all duration-300 ease-in-out transform translate-y-0 opacity-100 max-w-md w-auto min-w-80 bg-blue-50 dark:bg-blue-900/20 border-blue-400 text-blue-800 dark:text-blue-200"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                    {toast.message}
                  </p>
                </div>
                  <button
                    onClick={() => removeToast(toast.id)}
              className="ml-3 flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
              ×
                  </button>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            User Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage all platform users and their permissions
          </p>
        </div>
        

      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => {
            setRoleFilter('');
            setStatusFilter('');
            setSearchTerm('');
          }}
        >
          <Card className="p-4">
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
            </div>
          </Card>
        </div>
        
        <div 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => { setRoleFilter('admin'); setStatusFilter(''); setSearchTerm(''); }}
        >
          <Card className="p-4">
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">Admins</p>
              <p className="text-xl font-bold text-blue-600">{stats.admins}</p>
            </div>
          </Card>
        </div>
        
        <div 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => { setRoleFilter('tutor'); setStatusFilter(''); setSearchTerm(''); }}
        >
          <Card className="p-4">
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">Tutors</p>
              <p className="text-xl font-bold text-blue-500">{stats.tutors}</p>
            </div>
          </Card>
        </div>
        
        <div 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => { setRoleFilter('learner'); setStatusFilter(''); setSearchTerm(''); }}
        >
          <Card className="p-4">
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">Learners</p>
              <p className="text-xl font-bold text-blue-400">{stats.learners}</p>
            </div>
          </Card>
        </div>
        
        <div 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => { setRoleFilter(''); setStatusFilter('active'); setSearchTerm(''); }}
        >
          <Card className="p-4">
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">Active</p>
              <p className="text-xl font-bold text-blue-500">{stats.active}</p>
            </div>
          </Card>
        </div>
        
        <div 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => { setRoleFilter(''); setStatusFilter('inactive'); setSearchTerm(''); }}
        >
          <Card className="p-4">
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">Inactive</p>
              <p className="text-xl font-bold text-gray-600">{stats.inactive}</p>
            </div>
          </Card>
        </div>
        
        <div 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => { setRoleFilter(''); setStatusFilter('suspended'); setSearchTerm(''); }}
        >
          <Card className="p-4">
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">Suspended</p>
              <p className="text-xl font-bold text-gray-500">{stats.suspended}</p>
            </div>
          </Card>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
            <Input
              type="text"
              placeholder="Search users by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
            />
        </div>
        
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-6 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
        >
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="tutor">Tutor</option>
          <option value="learner">Learner</option>
        </select>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-6 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {users.map((user) => (
          <Card key={user.id} className="p-4 hover:shadow-lg transition-shadow cursor-pointer">
            <div onClick={() => openUserDetails(user)}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                    {user.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                    {user.email}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-between mb-3">
                {getRoleBadge(user.role)}
                {getStatusBadge(user.status)}
              </div>
              
              <div className="text-xs text-gray-500 dark:text-gray-400">
                <p>Joined: {formatDate(user.createdAt)}</p>
                {user.lastLogin && (
                  <p>Last login: {formatDate(user.lastLogin)}</p>
                )}
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
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
                    View Details
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-900 dark:border-t-gray-100"></div>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUserAction(user.id, user.status === 'active' ? 'deactivate' : 'activate');
                  }}
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
                    {user.status === 'active' ? 'Deactivate User' : 'Activate User'}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-900 dark:border-t-gray-100"></div>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUserAction(user.id, 'delete');
                  }}
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
                    Delete User
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-900 dark:border-t-gray-100"></div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadUsers(pagination.page - 1)}
            disabled={pagination.page === 1}
          >
            Previous
          </Button>
          
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Page {pagination.page} of {pagination.pages}
          </span>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadUsers(pagination.page + 1)}
            disabled={pagination.page >= pagination.pages}
          >
            Next
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
                  User Details
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDetailModal(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-6">
                {/* User Info */}
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-xl">
                    {selectedUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {selectedUser.name}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">{selectedUser.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {getRoleBadge(selectedUser.role)}
                      {getStatusBadge(selectedUser.status)}
                    </div>
                  </div>
                </div>
                
                {/* Account Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Account Info</h4>
                    <div className="space-y-2 text-sm">
                      <p><span className="font-medium">User ID:</span> {selectedUser.id}</p>
                      <p><span className="font-medium">Verified:</span> {selectedUser.verified ? 'Yes' : 'No'}</p>
                      <p><span className="font-medium">Joined:</span> {formatDate(selectedUser.createdAt)}</p>
                      {selectedUser.lastLogin && (
                        <p><span className="font-medium">Last Login:</span> {formatDate(selectedUser.lastLogin)}</p>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Learning Stats</h4>
                    <div className="space-y-2 text-sm">
                      <p><span className="font-medium">Enrolled Courses:</span> {selectedUser.enrolledCourses || 0}</p>
                      <p><span className="font-medium">Completed Courses:</span> {selectedUser.completedCourses || 0}</p>
                    </div>
                  </div>
                </div>
                
                {/* Profile Info */}
                {selectedUser.profile && (
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Profile</h4>
                    <div className="space-y-2 text-sm">
                      {selectedUser.profile.bio && (
                        <p><span className="font-medium">Bio:</span> {selectedUser.profile.bio}</p>
                      )}
                      {selectedUser.profile.location && (
                        <p><span className="font-medium">Location:</span> {selectedUser.profile.location}</p>
                      )}
                      {selectedUser.profile.website && (
                        <p><span className="font-medium">Website:</span> {selectedUser.profile.website}</p>
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
                        'Deactivate'
                    ) : (
                        'Activate'
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => handleUserAction(selectedUser.id, 'delete')}
                    disabled={actionLoading.includes(selectedUser.id)}
                    className="text-blue-500 hover:text-blue-600"
                  >
                    {actionLoading.includes(selectedUser.id) ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                        'Delete User'
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