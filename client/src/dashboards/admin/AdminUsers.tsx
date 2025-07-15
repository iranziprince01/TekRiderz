import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Badge } from '../../components/ui/Badge';
import { 
  Users, 
  Search, 
  Filter, 
  Eye, 
  Edit, 
  Trash2, 
  UserCheck, 
  UserX, 
  RefreshCw,
  Plus,
  MoreHorizontal,
  Calendar,
  Mail,
  Shield,
  GraduationCap,
  BookOpen,
  X,
  CheckCircle,
  XCircle,
  AlertTriangle,
  AlertCircle
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
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    loadUsers();
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

  const loadUsers = async (page = 1) => {
    try {
      setLoading(true);
      // setError(''); // Removed as per new_code

      const params: any = { page, limit: pagination.limit };
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (roleFilter) params.role = roleFilter;
      if (statusFilter) params.status = statusFilter;

      const response = await apiClient.getUsers(params);

      if (response.success && response.data) {
        const { users: userData, pagination: paginationData } = response.data;
        
        setUsers(userData || []);
        setPagination({
          page: paginationData.currentPage || paginationData.page || 1,
          limit: paginationData.itemsPerPage || paginationData.limit || 12,
          total: paginationData.totalItems || paginationData.total || 0,
          pages: paginationData.totalPages || paginationData.pages || 0
        });
        
        // Calculate stats
        const statsData: UserStats = {
          total: paginationData.totalItems || paginationData.total || 0,
          admins: userData.filter((u: UserData) => u.role === 'admin').length,
          tutors: userData.filter((u: UserData) => u.role === 'tutor').length,
          learners: userData.filter((u: UserData) => u.role === 'learner').length,
          active: userData.filter((u: UserData) => u.status === 'active').length,
          inactive: userData.filter((u: UserData) => u.status === 'inactive').length,
          suspended: userData.filter((u: UserData) => u.status === 'suspended').length
        };
        setStats(statsData);
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

  const handleUserAction = async (userId: string, action: 'activate' | 'deactivate' | 'delete') => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const confirmMessages = {
      activate: `Are you sure you want to activate ${user.name}?`,
      deactivate: `Are you sure you want to deactivate ${user.name}?`,
      delete: `Are you sure you want to delete ${user.name}? This action cannot be undone.`
    };

    if (!window.confirm(confirmMessages[action])) return;

    try {
      setActionLoading(`${action}-${userId}`);
      let response;

      if (action === 'delete') {
        response = await apiClient.deleteUser(userId);
      } else {
        const isActive = action === 'activate';
        response = await apiClient.updateUserStatus(userId, isActive);
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
        } else if (selectedUser && selectedUser.id === userId) {
          setSelectedUser({
            ...selectedUser,
            status: action === 'activate' ? 'active' : 'suspended'
          });
        }
        
        loadUsers(pagination.page);
      } else {
        addToast({
          type: 'error',
          title: 'Error',
          message: response.error || `Failed to ${action} user`
        });
      }
    } catch (err: any) {
      // setError(err.message || `Failed to ${action} user`); // Removed as per new_code
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
    const configs = {
      admin: { variant: 'error' as const, icon: Shield },
      tutor: { variant: 'warning' as const, icon: GraduationCap },
      learner: { variant: 'success' as const, icon: BookOpen }
    };
    
    const config = configs[role as keyof typeof configs] || configs.learner;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon size={12} />
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const configs = {
      active: { variant: 'success' as const, label: 'Active' },
      suspended: { variant: 'error' as const, label: 'Suspended' },
      inactive: { variant: 'default' as const, label: 'Inactive' }
    };
    
    const config = configs[status as keyof typeof configs] || configs.inactive;
    
    return (
      <Badge variant={config.variant}>
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
      <div className="fixed top-20 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="max-w-sm w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden transform transition-all duration-300 ease-in-out"
          >
            <div className="p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {toast.type === 'success' && (
                    <CheckCircle className="h-6 w-6 text-green-400" />
                  )}
                  {toast.type === 'error' && (
                    <XCircle className="h-6 w-6 text-red-400" />
                  )}
                  {toast.type === 'warning' && (
                    <AlertTriangle className="h-6 w-6 text-yellow-400" />
                  )}
                  {toast.type === 'info' && (
                    <AlertCircle className="h-6 w-6 text-blue-400" />
                  )}
                </div>
                <div className="ml-3 w-0 flex-1 pt-0.5">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {toast.title}
                  </p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {toast.message}
                  </p>
                </div>
                <div className="ml-4 flex-shrink-0 flex">
                  <button
                    className="bg-white dark:bg-gray-800 rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none"
                    onClick={() => removeToast(toast.id)}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
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
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadUsers(pagination.page)}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add User
          </Button>
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
              <Users className="w-6 h-6 mx-auto mb-2 text-gray-600" />
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
              <Shield className="w-6 h-6 mx-auto mb-2 text-red-600" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Admins</p>
              <p className="text-xl font-bold text-red-600">{stats.admins}</p>
            </div>
          </Card>
        </div>
        
        <div 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => { setRoleFilter('tutor'); setStatusFilter(''); setSearchTerm(''); }}
        >
          <Card className="p-4">
            <div className="text-center">
              <GraduationCap className="w-6 h-6 mx-auto mb-2 text-purple-600" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Tutors</p>
              <p className="text-xl font-bold text-purple-600">{stats.tutors}</p>
            </div>
          </Card>
        </div>
        
        <div 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => { setRoleFilter('learner'); setStatusFilter(''); setSearchTerm(''); }}
        >
          <Card className="p-4">
            <div className="text-center">
              <BookOpen className="w-6 h-6 mx-auto mb-2 text-green-600" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Learners</p>
              <p className="text-xl font-bold text-green-600">{stats.learners}</p>
            </div>
          </Card>
        </div>
        
        <div 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => { setRoleFilter(''); setStatusFilter('active'); setSearchTerm(''); }}
        >
          <Card className="p-4">
            <div className="text-center">
              <UserCheck className="w-6 h-6 mx-auto mb-2 text-blue-600" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Active</p>
              <p className="text-xl font-bold text-blue-600">{stats.active}</p>
            </div>
          </Card>
        </div>
        
        <div 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => { setRoleFilter(''); setStatusFilter('inactive'); setSearchTerm(''); }}
        >
          <Card className="p-4">
            <div className="text-center">
              <UserX className="w-6 h-6 mx-auto mb-2 text-gray-600" />
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
              <UserX className="w-6 h-6 mx-auto mb-2 text-red-600" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Suspended</p>
              <p className="text-xl font-bold text-red-600">{stats.suspended}</p>
            </div>
          </Card>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Search users by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
        >
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="tutor">Tutor</option>
          <option value="learner">Learner</option>
        </select>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
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
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
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
                  <Eye className="w-5 h-5" />
                </button>
                {hoveredButton === `view-${user.id}` && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded whitespace-nowrap z-10">
                    View
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
                  className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                    user.status === 'active' 
                      ? 'text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20' 
                      : 'text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20'
                  }`}
                  onMouseEnter={() => setHoveredButton(`${user.status === 'active' ? 'deactivate' : 'activate'}-${user.id}`)}
                  onMouseLeave={() => setHoveredButton('')}
                >
                  {actionLoading === `${user.status === 'active' ? 'deactivate' : 'activate'}-${user.id}` ? (
                    <LoadingSpinner size="sm" />
                  ) : user.status === 'active' ? (
                    <UserX className="w-5 h-5" />
                  ) : (
                    <UserCheck className="w-5 h-5" />
                  )}
                </button>
                {hoveredButton === `${user.status === 'active' ? 'deactivate' : 'activate'}-${user.id}` && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded whitespace-nowrap z-10">
                    {user.status === 'active' ? 'Deactivate' : 'Activate'}
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
                    <Trash2 className="w-5 h-5" />
                  )}
                </button>
                {hoveredButton === `delete-${user.id}` && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded whitespace-nowrap z-10">
                    Delete
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
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-xl">
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
                    className={selectedUser.status === 'active' ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}
                  >
                    {actionLoading.includes(selectedUser.id) ? (
                      <LoadingSpinner size="sm" />
                    ) : selectedUser.status === 'active' ? (
                      <>
                        <UserX className="w-4 h-4 mr-2" />
                        Deactivate
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4 mr-2" />
                        Activate
                      </>
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
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete User
                      </>
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