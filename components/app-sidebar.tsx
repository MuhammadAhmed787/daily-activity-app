"use client"

import { CheckSquare, Home, Users, UserCheck, BarChart3, Plus, Archive, Sparkles, Building2 , ClipboardList} from "lucide-react"
import { useState } from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMediaQuery } from "@/hooks/use-media-query";


// Define the UserSession interface
interface UserSession {
  id: string
  username: string
  role: {
    id: string
    name: string
    permissions: string[]
  }
}

// Define props interface for AppSidebar
interface AppSidebarProps {
  user: UserSession
}

// Menu items with permissions, colors, and descriptions
const items = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    description: "Overview & Analytics",
    permission: "dashboard",
  },
  {
    title: "Company Info",
    url: "/dashboard/company_information",
    icon: Building2, // Make sure to import Building2 from lucide-react
    color: "text-amber-600",
    bgColor: "bg-amber-100",
    description: "Company Details",
    permission: "company_information.manage",
  },
  {
    title: "Create Task",
    url: "/dashboard/tasks/create",
    icon: Plus,
    color: "text-emerald-600",
    bgColor: "bg-emerald-100",
    description: "Add New Tasks",
    permission: "tasks.create",
  },
  {
    title: "Task Assignment",
    url: "/dashboard/tasks/assign",
    icon: UserCheck,
    color: "text-purple-600",
    bgColor: "bg-purple-100",
    description: "Approve & Assign",
    permission: "tasks.assign",
  },
    {
    title: "Developer Tasks",
    url: "/dashboard/tasks/developer_working",
    icon: ClipboardList,
    color: "text-teal-600",
    bgColor: "bg-teal-100",
    description: "My Assigned Tasks",
    permission: "tasks.developer_working",
  },
  {
    title: "All Tasks",
    url: "/dashboard/tasks/all",
    icon: CheckSquare,
    color: "text-indigo-600",
    bgColor: "bg-indigo-100",
    description: "Manage Status",
    permission: "tasks.complete",
  },
  {
    title: "Unpost Tasks",
    url: "/dashboard/tasks/unpost",
    icon: Archive,
    color: "text-orange-600",
    bgColor: "bg-orange-100",
    description: "Archive & Review",
    permission: "tasks.manage", // Assuming unpost tasks require manage permission
  },
  {
    title: "Users",
    url: "/dashboard/users",
    icon: Users,
    color: "text-cyan-600",
    bgColor: "bg-cyan-100",
    description: "Team Management",
    permission: "users.manage",
  },
  {
    title: "Reports",
    url: "/dashboard/reports",
    icon: BarChart3,
    color: "text-pink-600",
    bgColor: "bg-pink-100",
    description: "Analytics & Insights",
    permission: "reports.view",
  },
]

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname()
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const { setOpen, setOpenMobile, isMobile } = useSidebar() // Get mobile state from context

  // Filter items based on user permissions
  const filteredItems = items.filter(item => user.role.permissions.includes(item.permission))

  // Function to handle navigation
  const handleNavigation = () => {
    if (isMobile) {
      setOpenMobile(false) // Use mobile-specific close function
    } else {
      setOpen(false) // Close regular sidebar
    }
  }

  return (
    <Sidebar className="border-r border-border/50 bg-gradient-to-b from-sidebar to-sidebar/80 backdrop-blur-sm">
      <SidebarHeader className="p-6 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <h2 className="font-bold text-lg bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
              PowerSoft360
            </h2>
            <p className="text-xs text-muted-foreground">Activity Management</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground/80 mb-4 px-2">
            NAVIGATION
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-2">
              {filteredItems.map((item) => {
                const isActive = pathname === item.url
                const isHovered = hoveredItem === item.title

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      className={`
                        group relative overflow-hidden rounded-xl transition-all-smooth h-auto p-0
                        ${
                          isActive
                            ? "bg-primary/10 border border-primary/20 shadow-sm"
                            : "hover:bg-accent/50 hover:shadow-sm"
                        }
                      `}
                      onMouseEnter={() => setHoveredItem(item.title)}
                      onMouseLeave={() => setHoveredItem(null)}
                    >
                      <Link 
                        href={item.url} 
                        className="flex items-center gap-4 p-4 w-full"
                        onClick={handleNavigation} // Close sidebar on mobile
                      >
                        <div
                          className={`
                          w-10 h-10 rounded-lg flex items-center justify-center transition-all-smooth
                          ${
                            isActive
                              ? `${item.bgColor} ${item.color} shadow-sm scale-105`
                              : `${isHovered ? item.bgColor : "bg-muted/50"} ${isHovered ? item.color : "text-muted-foreground"}`
                          }
                        `}
                        >
                          <item.icon
                            className={`w-5 h-5 transition-all-smooth ${isActive || isHovered ? "scale-110" : ""}`}
                          />
                        </div>

                        <div className="flex flex-col flex-1 min-w-0">
                          <span
                            className={`
                            font-medium text-sm transition-all-smooth truncate
                            ${isActive ? "text-primary font-semibold" : "text-foreground group-hover:text-primary"}
                          `}
                          >
                            {item.title}
                          </span>
                          <span
                            className={`
                            text-xs transition-all-smooth truncate
                            ${isActive ? "text-primary/70" : "text-muted-foreground group-hover:text-primary/70"}
                          `}
                          >
                            {item.description}
                          </span>
                        </div>

                        {isActive && <div className="w-1 h-8 bg-primary rounded-full animate-scale-in" />}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}