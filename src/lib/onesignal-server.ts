// OneSignal Push Notification Service
const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID!
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY!

interface SendNotificationOptions {
  driverId: string
  title: string
  message: string
  data?: Record<string, string>
}

export async function sendDriverNotification({
  driverId,
  title,
  message,
  data = {},
}: SendNotificationOptions) {
  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        filters: [{ field: "tag", key: "driverId", value: driverId }],
        headings: { en: title, tr: title },
        contents: { en: message, tr: message },
        data,
        url: "/driver",
      }),
    })

    const result = await response.json()
    console.log("OneSignal notification sent:", result)
    return result
  } catch (error) {
    console.error("OneSignal notification error:", error)
    throw error
  }
}

// Transfer atandığında bildirim gönder
export async function notifyDriverAssigned(
  driverId: string,
  customerName: string,
  hotelName: string,
  time: string
) {
  return sendDriverNotification({
    driverId,
    title: "🚗 Yeni Transfer Atandı",
    message: `${customerName} - ${hotelName} (${time})`,
    data: { type: "new_transfer" },
  })
}

// Transfer iptal edildiğinde bildirim gönder
export async function notifyDriverTransferCancelled(
  driverId: string,
  customerName: string
) {
  return sendDriverNotification({
    driverId,
    title: "❌ Transfer İptal Edildi",
    message: `${customerName} transferi iptal edildi`,
    data: { type: "transfer_cancelled" },
  })
}
