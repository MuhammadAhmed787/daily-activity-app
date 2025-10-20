"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  CheckCircle,
  Clock,
  ClipboardList,
  TrendingUp,
  Calendar,
  BarChart3,
  Plus,
  UserCheck,
  Zap,
  Target,
  Activity,
  Award,
  Loader2,
  UserCog,
  Menu,
  X,
} from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"

interface UserSession {
  id: string
  username: string
  role: {
    id: string
    name: string
    permissions: string[]
  }
}

interface Task {
  _id: string
  company: { name: string }
  working: string
  status: string
  finalStatus?: string
  approved?: boolean
  unposted?: boolean
  createdAt: string
  assignedTo?: {
    id: string
    username: string
    name: string
    role: {
      name: string
    }
  }
  assignedToId?: string
  contact?: any
  code?: string
  developer_status?: string
  developer_remarks?: string
  createdBy?: string
}

// Global prefetch cache
const prefetchedRoutes = new Set<string>()

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [userTasks, setUserTasks] = useState<Task[]>([])
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    onHoldTasks: 0,
    approvedTasks: 0,
    unpostedTasks: 0,
    userTotalTasks: 0,
    userCompletedTasks: 0,
    userPendingTasks: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<UserSession | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const navigationRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Permission cache for instant checks
  const permissionCache = useRef<Map<string, boolean>>(new Map())

  // Prefetch routes immediately on mount
  useEffect(() => {
    ;[
      "/dashboard/tasks/create",
      "/dashboard/tasks/assign",
      "/dashboard/tasks/all",
      "/dashboard/reports",
    ].forEach((route) => {
      if (!prefetchedRoutes.has(route)) {
        router.prefetch(route)
        prefetchedRoutes.add(route)
      }
    })
  }, [router])

  // User session handling
  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (!userData) {
      toast({
        title: "Session Expired",
        description: "Please log in to continue.",
        variant: "destructive",
      })
      router.push("/login")
      return
    }

    try {
      const parsedUser = JSON.parse(userData)
      if (!parsedUser?.role?.permissions) {
        toast({
          title: "Invalid Session",
          description: "User role or permissions missing. Please log in again.",
          variant: "destructive",
        })
        localStorage.removeItem("user")
        router.push("/login")
        return
      }
      setUser(parsedUser)
    } catch (error) {
      console.error("Error parsing user data:", error)
      toast({
        title: "Session Error",
        description: "Invalid session data. Please log in again.",
        variant: "destructive",
      })
      localStorage.removeItem("user")
      router.push("/login")
    }
  }, [router, toast])

  // Check if user has admin/manager role
  const isAdminOrManager = useMemo(() => {
    if (!user) return false
    return user.role.permissions.includes("tasks.view.all") || 
           user.role.name.toLowerCase().includes("admin") ||
           user.role.name.toLowerCase().includes("manager")
  }, [user])

  // Check if user is a task creator
  const isTaskCreator = useMemo(() => {
    if (!user) return false
    return user.role.permissions.includes("tasks.create") || 
           user.role.permissions.includes("tasks.update")
  }, [user])

  // Process tasks and update stats
  const processTasks = useCallback((tasksData: Task[]) => {
    // Sort tasks by createdAt (client-side fallback if API doesn't sort)
    const sortedTasks = tasksData.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    
    setTasks(sortedTasks)

    // Filter tasks based on user role
    let userSpecificTasks = [];
    
    if (isAdminOrManager) {
      // Admin/manager sees all tasks
      userSpecificTasks = sortedTasks;
    } else if (isTaskCreator) {
      // Task creators see only tasks they created
      userSpecificTasks = sortedTasks.filter(task => task.createdBy === user?.id);
    } else {
      // Developers see tasks assigned to them
      userSpecificTasks = sortedTasks.filter(task => {
        return (task.assignedTo && task.assignedTo.id === user?.id) || 
               (task.assignedToId === user?.id)
      });
    }

    setUserTasks(userSpecificTasks)

    const total = sortedTasks.length
    const completed = sortedTasks.filter((t) => t.finalStatus === "done").length
    const pending = sortedTasks.filter((t) => t.status === "pending").length
    const onHold = sortedTasks.filter((t) => t.finalStatus === "on-hold").length
    const approved = sortedTasks.filter((t) => t.approved).length
    const unposted = sortedTasks.filter((t) => t.unposted).length

    // Calculate user-specific stats based on role
    let userTotal = 0;
    let userCompleted = 0;
    let userPending = 0;
    
    if (isAdminOrManager) {
      userTotal = sortedTasks.length;
      userCompleted = sortedTasks.filter((t) => t.finalStatus === "done").length;
      userPending = sortedTasks.filter((t) => t.status === "pending").length;
    } else if (isTaskCreator) {
      // For task creators, count only tasks they created
      userTotal = userSpecificTasks.length;
      userCompleted = userSpecificTasks.filter((t) => t.finalStatus === "done").length;
      userPending = userSpecificTasks.filter((t) => t.status === "pending").length;
    } else {
      // For developers, use developer_status
      userTotal = userSpecificTasks.length;
      userCompleted = userSpecificTasks.filter((t) => t.developer_status === "done").length;
      userPending = userSpecificTasks.filter((t) => t.developer_status === "pending").length;
    }

    setStats({
      totalTasks: total,
      completedTasks: completed,
      pendingTasks: pending,
      onHoldTasks: onHold,
      approvedTasks: approved,
      unpostedTasks: unposted,
      userTotalTasks: userTotal,
      userCompletedTasks: userCompleted,
      userPendingTasks: userPending,
    })
  }, [user, isAdminOrManager, isTaskCreator])

  // Fetch tasks initially
  const fetchTasks = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/tasks?sort=createdAt:desc")
      if (!response.ok) throw new Error("Failed to fetch tasks")
      const data: Task[] = await response.json()
      processTasks(data)
    } catch (error) {
      console.error("Failed to fetch tasks:", error)
      toast({
        title: "Error fetching tasks",
        description: "Could not load dashboard data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast, processTasks])

  // Set up SSE connection for real-time updates
  useEffect(() => {
    if (!user) return

    // Fetch initial data
    fetchTasks()

    // Set up SSE connection
    const eventSource = new EventSource('/api/tasks/stream')
    eventSourceRef.current = eventSource

    eventSource.onmessage = (event) => {
      try {
        // Check for heartbeat
        if (event.data.trim() === ': heartbeat') {
          return
        }
        
        const tasksData: Task[] = JSON.parse(event.data)
        processTasks(tasksData)
      } catch (error) {
        console.error("Error parsing SSE data:", error)
      }
    }

    eventSource.onerror = (error) => {
      console.error("SSE connection error:", error)
      // Attempt to reconnect after a delay
      setTimeout(() => {
        if (eventSourceRef.current) {
          eventSourceRef.current.close()
          eventSourceRef.current = new EventSource('/api/tasks/stream')
        }
      }, 5000)
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [user, fetchTasks, processTasks])

  // Optimized permission check
  const hasPermission = useCallback(
    (permission: string) => {
      if (!user) return false

      if (permissionCache.current.has(permission)) {
        return permissionCache.current.get(permission) as boolean
      }

      const hasPerm = user.role.permissions.includes(permission)
      permissionCache.current.set(permission, hasPerm)
      return hasPerm
    },
    [user]
  )

  // Memoized quick actions with instant prefetch
  const quickActions = useMemo(() => {
    const actions = [
      {
        title: "Create New Task",
        description: "Add a new task to your workflow",
        icon: Plus,
        href: "/dashboard/tasks/create",
        color: "from-emerald-500 to-emerald-600",
        iconBg: "bg-emerald-100",
        iconColor: "text-emerald-600",
        permission: "tasks.create",
      },
      {
        title: "Assign Tasks",
        description: "Review and approve pending tasks",
        icon: UserCheck,
        href: "/dashboard/tasks/assign",
        color: "from-purple-500 to-purple-600",
        iconBg: "bg-purple-100",
        iconColor: "text-purple-600",
        permission: "tasks.assign",
      },
      {
        title: "Manage Tasks",
        description: "Update task status and progress",
        icon: CheckCircle,
        href: "/dashboard/tasks/all",
        color: "from-indigo-500 to-indigo-600",
        iconBg: "bg-indigo-100",
        iconColor: "text-indigo-600",
        permission: "tasks.manage",
      },
      {
        title: "View Reports",
        description: "Analyze productivity and insights",
        icon: BarChart3,
        href: "/dashboard/reports",
        color: "from-pink-500 to-pink-600",
        iconBg: "bg-pink-100",
        iconColor: "text-pink-600",
        permission: "reports.view",
      },
      {
        title: "User Management",
        description: "Manage users and permissions",
        icon: UserCog,
        href: "/dashboard/users",
        color: "from-amber-500 to-amber-600",
        iconBg: "bg-amber-100",
        iconColor: "text-amber-600",
        permission: "users.manage",
      },
    ]

    const filtered = actions.filter((action) => hasPermission(action.permission))

    // Prefetch all allowed routes immediately
    filtered.forEach((action) => {
      if (!prefetchedRoutes.has(action.href)) {
        router.prefetch(action.href)
        prefetchedRoutes.add(action.href)
      }
    })

    return filtered
  }, [hasPermission, router])

  // Instant navigation handler
  const handleQuickActionClick = useCallback(
    (e: React.MouseEvent, href: string) => {
      e.preventDefault()

      // Visual feedback
      const target = e.currentTarget as HTMLAnchorElement
      target.classList.add("scale-95", "opacity-80")

      // Navigate after brief animation
      setTimeout(() => {
        router.push(href)
      }, 80)
    },
    [router]
  )

  // Progress rates - show user-specific stats for non-admins
  const completionRate = useMemo(
    () => (isAdminOrManager 
      ? (stats.totalTasks > 0 ? (stats.completedTasks / stats.totalTasks) * 100 : 0)
      : (stats.userTotalTasks > 0 ? (stats.userCompletedTasks / stats.userTotalTasks) * 100 : 0)
    ),
    [stats, isAdminOrManager]
  )

  const approvalRate = useMemo(
    () => (stats.totalTasks > 0 ? (stats.approvedTasks / stats.totalTasks) * 100 : 0),
    [stats]
  )

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-6 md:p-8 text-primary-foreground shadow-xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3C/g fill=%22none%22 fillRule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fillOpacity=%220.05%22%3E%3Ccircle cx=%2230%22 cy=%2230%22 r=%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20"></div>
        <div className="relative">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-2xl md:text-4xl font-bold">Welcome to TaskFlow, {user.username}!</h1>
              <p className="text-primary-foreground/80 text-sm md:text-base">
                {isAdminOrManager 
                  ? "Manage all tasks and team activities" 
                  : isTaskCreator
                  ? "Track your created tasks and progress"
                  : "Track your assigned tasks and progress"}
              </p>
              <Badge variant="secondary" className="bg-white/20 text-white backdrop-blur-sm">
                {user.role.name}
              </Badge>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl p-3">
              <Activity className="w-5 h-5" />
              <span className="text-sm font-medium">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:gap-6 grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100/50 hover:shadow-xl transition-all-smooth animate-slide-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-blue-700">
              {isAdminOrManager ? "Total Tasks" : isTaskCreator ? "My Created Tasks" : "My Tasks"}
            </CardTitle>
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <ClipboardList className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold text-blue-600">
              {isAdminOrManager ? stats.totalTasks : stats.userTotalTasks}
            </div>
            <p className="text-xs text-blue-600/70">
              {isAdminOrManager 
                ? "All tasks created" 
                : isTaskCreator 
                ? "Tasks I created" 
                : "Tasks assigned to me"}
            </p>
          </CardContent>
        </Card>

        <Card
          className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-emerald-100/50 hover:shadow-xl transition-all-smooth animate-slide-in"
          style={{ animationDelay: "0.1s" }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-emerald-700">
              {isAdminOrManager ? "Completed" : "My Completed"}
            </CardTitle>
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold text-emerald-600">
              {isAdminOrManager ? stats.completedTasks : stats.userCompletedTasks}
            </div>
            <p className="text-xs text-emerald-600/70">
              {isAdminOrManager 
                ? "Tasks finished" 
                : isTaskCreator 
                ? "Tasks I created that are completed" 
                : "My completed tasks"}
            </p>
          </CardContent>
        </Card>

        {isAdminOrManager && (
          <>
            <Card
              className="border-0 shadow-lg bg-gradient-to-br from-amber-50 to-amber-100/50 hover:shadow-xl transition-all-smooth animate-slide-in"
              style={{ animationDelay: "0.2s" }}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs md:text-sm font-medium text-amber-700">Approved</CardTitle>
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Award className="h-4 w-4 text-amber-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xl md:text-2xl font-bold text-amber-600">{stats.approvedTasks}</div>
                <p className="text-xs text-amber-600/70">Ready for work</p>
              </CardContent>
            </Card>

            <Card
              className="border-0 shadow-lg bg-gradient-to-br from-rose-50 to-rose-100/50 hover:shadow-xl transition-all-smooth animate-slide-in"
              style={{ animationDelay: "0.3s" }}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs md:text-sm font-medium text-rose-700">Pending</CardTitle>
                <div className="w-8 h-8 bg-rose-100 rounded-lg flex items-center justify-center">
                  <Clock className="h-4 w-4 text-rose-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xl md:text-2xl font-bold text-rose-600">{stats.pendingTasks}</div>
                <p className="text-xs text-rose-600/70">Awaiting action</p>
              </CardContent>
            </Card>
          </>
        )}

        {!isAdminOrManager && (
          <Card
            className="border-0 shadow-lg bg-gradient-to-br from-rose-50 to-rose-100/50 hover:shadow-xl transition-all-smooth animate-slide-in"
            style={{ animationDelay: "0.2s" }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-rose-700">My Pending</CardTitle>
              <div className="w-8 h-8 bg-rose-100 rounded-lg flex items-center justify-center">
                <Clock className="h-4 w-4 text-rose-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold text-rose-600">{stats.userPendingTasks}</div>
              <p className="text-xs text-rose-600/70">
                {isTaskCreator 
                  ? "Tasks I created that are pending" 
                  : "My pending tasks"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Progress and Recent Tasks - Mobile Responsive Layout */}
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
          <Card
            className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 animate-slide-in"
            style={{ animationDelay: "0.4s" }}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-primary-foreground" />
                </div>
                {isAdminOrManager ? "Task Progress Overview" : "My Progress Overview"}
              </CardTitle>
              <CardDescription>
                {isAdminOrManager 
                  ? "Track your productivity metrics" 
                  : "Track your personal progress"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">
                    {isAdminOrManager ? "Completion Rate" : "My Completion Rate"}
                  </span>
                  <span className="text-sm text-muted-foreground">{completionRate.toFixed(1)}%</span>
                </div>
                <Progress value={completionRate} className="h-3 bg-muted/50" />
              </div>

              {isAdminOrManager && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Approval Rate</span>
                    <span className="text-sm text-muted-foreground">{approvalRate.toFixed(1)}%</span>
                  </div>
                  <Progress value={approvalRate} className="h-3 bg-muted/50" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="text-center p-3 bg-emerald-50 rounded-xl">
                  <div className="text-lg font-bold text-emerald-600">
                    {isAdminOrManager ? stats.completedTasks : stats.userCompletedTasks}
                  </div>
                  <div className="text-xs text-emerald-600/70">Done</div>
                </div>
                {isAdminOrManager ? (
                  <div className="text-center p-3 bg-blue-50 rounded-xl">
                    <div className="text-lg font-bold text-blue-600">{stats.approvedTasks}</div>
                    <div className="text-xs text-blue-600/70">Approved</div>
                  </div>
                ) : (
                  <div className="text-center p-3 bg-rose-50 rounded-xl">
                    <div className="text-lg font-bold text-rose-600">{stats.userPendingTasks}</div>
                    <div className="text-xs text-rose-600/70">Pending</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card
            className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 animate-slide-in"
            style={{ animationDelay: "0.5s" }}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-white" />
                </div>
                {isAdminOrManager ? "Recent Activities" : "My Recent Tasks"}
              </CardTitle>
              <CardDescription>
                {isAdminOrManager 
                  ? "Latest task updates and changes" 
                  : isTaskCreator 
                  ? "Tasks I recently created" 
                  : "Your recent task updates"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[320px] overflow-y-auto">
                {(isAdminOrManager ? tasks : userTasks).slice(0, 4).map((task, index) => {
                  // Determine which status to display based on user role
                  let displayStatus;
                  if (isAdminOrManager) {
                    displayStatus = task.finalStatus || task.status || "pending";
                  } else if (isTaskCreator) {
                    // For task creators, show the general task status
                    displayStatus = task.finalStatus || task.status || "pending";
                  } else {
                    // For developers, show developer_status
                    displayStatus = task.developer_status || task.status || "pending";
                  }
                  
                  // Determine badge color based on status
                  let statusColor = "bg-rose-100 text-rose-700";
                  if (displayStatus === "done") {
                    statusColor = "bg-emerald-100 text-emerald-700";
                  } else if (displayStatus === "approved" || displayStatus === "completed") {
                    statusColor = "bg-blue-100 text-blue-700";
                  } else if (displayStatus === "pending") {
                    statusColor = "bg-amber-100 text-amber-700";
                  }
                  
                  return (
                    <div
                      key={task._id || index}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-xl hover:bg-muted/50 transition-all duration-300"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            displayStatus === "done"
                              ? "bg-emerald-500"
                              : displayStatus === "approved" || displayStatus === "completed"
                              ? "bg-blue-500"
                              : displayStatus === "pending"
                              ? "bg-amber-500"
                              : "bg-rose-500"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{task.company?.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{task.working}</p>
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${statusColor} whitespace-nowrap`}
                      >
                        {displayStatus}
                      </Badge>
                    </div>
                  )
                })}
                {(isAdminOrManager ? tasks : userTasks).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No tasks yet</p>
                    <p className="text-sm">
                      {isAdminOrManager 
                        ? "Create your first task to get started" 
                        : isTaskCreator
                        ? "You haven't created any tasks yet"
                        : "No tasks assigned to you yet"}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions - Only show if user has any permissions */}
        {quickActions.length > 0 && (
          <Card
            className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 animate-slide-in"
            style={{ animationDelay: "0.6s" }}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-violet-600 rounded-lg flex items-center justify-center">
                  <Zap className="h-4 w-4 text-white" />
                </div>
                Quick Actions
              </CardTitle>
              <CardDescription>Common tasks and shortcuts to boost your productivity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {quickActions.map((action) => (
                  <Link
                    key={action.title}
                    href={action.href}
                    prefetch={false}
                    onClick={(e) => handleQuickActionClick(e, action.href)}
                    onMouseEnter={() => {
                      if (!prefetchedRoutes.has(action.href)) {
                        router.prefetch(action.href);
                        prefetchedRoutes.add(action.href);
                      }
                    }}
                    className="group p-4 border border-border/50 rounded-xl hover:shadow-lg transition-all duration-300 cursor-pointer bg-gradient-to-br from-background to-muted/20 hover:scale-105 active:scale-95 active:opacity-80 transform"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 ${action.iconBg} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200`}
                      >
                        <action.icon className={`h-5 w-5 ${action.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">
                          {action.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{action.description}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
  )
}