"use client"

import { useEffect } from "react"
import OneSignal from "react-onesignal"

let initialized = false

export function OneSignalProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (initialized) return
    initialized = true

    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID

    // Skip initialization if no app ID is configured
    if (!appId || appId === "your-onesignal-app-id") {
      console.log("OneSignal: Skipping initialization (no app ID configured)")
      return
    }

    const initOneSignal = async () => {
      try {
        await OneSignal.init({
          appId,
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerPath: "/OneSignalSDKWorker.js",
        })
        console.log("OneSignal initialized")
      } catch (error) {
        console.error("OneSignal init error:", error)
      }
    }

    initOneSignal()
  }, [])

  return <>{children}</>
}

// Şoför ID'sini OneSignal'a kaydet
export async function setDriverTag(driverId: string) {
  try {
    await OneSignal.User.addTag("driverId", driverId)
    console.log("Driver tag set:", driverId)
  } catch (error) {
    console.error("Failed to set driver tag:", error)
  }
}

// Bildirim izni iste
export async function requestNotificationPermission() {
  try {
    const permission = await OneSignal.Notifications.requestPermission()
    return permission
  } catch (error) {
    console.error("Permission request error:", error)
    return false
  }
}
