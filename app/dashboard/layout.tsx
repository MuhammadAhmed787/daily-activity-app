"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { LogOut, User, Bell, Settings } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { useMediaQuery } from "@/hooks/use-media-query"

interface UserSession {
  id: string
  username: string
  role: {
    id: string
    name: string
    permissions: string[]
  }
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<UserSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const { toast } = useToast()
  const isMobile = useMediaQuery("(max-width: 768px)")

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
    } finally {
      setIsLoading(false)
    }
  }, [router, toast])

  const handleLogout = () => {
    const userData = localStorage.getItem("user")
    const user = userData ? JSON.parse(userData) : null

    localStorage.removeItem("user")

    toast({
      title: "Logged Out Successfully! 👋",
      description: `Goodbye ${user?.username || "User"}! You have been safely logged out of the system.`,
      duration: 4000,
    })

    router.push("/login")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50">
        <div className="text-center">
          <p className="text-lg font-medium">Session expired. Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar user={user}/>
      <SidebarInset className="bg-gradient-to-br from-background via-background to-muted/20">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border/50 bg-background/80 backdrop-blur-sm px-4 sticky top-0 z-40">
          <SidebarTrigger className="-ml-1 hover:bg-accent/50 transition-colors" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex flex-1 items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="font-bold text-lg bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                PowerSoft360
              </h1>
              <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-muted/50 rounded-full">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-muted-foreground">System Online</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="hidden sm:flex gap-2 hover:bg-accent/50 transition-colors">
                <Bell className="h-4 w-4" />
                <span className="hidden md:inline">Notifications</span>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 hover:bg-accent/50 transition-colors">
                    <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <span className="hidden sm:inline font-medium">{user.username}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 animate-scale-in">
                  <div className="px-3 py-2 border-b border-border/50">
                    <p className="text-sm font-medium">{user.username}</p>
                    <p className="text-xs text-muted-foreground capitalize">{user.role.name} Account</p>
                  </div>
                  <DropdownMenuItem className="gap-2 hover:bg-accent/50 transition-colors">
                    <Settings className="h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="gap-2 text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 space-y-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}