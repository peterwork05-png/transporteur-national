import { useEffect } from 'react';

const VAPID_PUBLIC = 'BPCj4NAFzNrfKjaL3uUtF5DxxWvaxZQDbYZpQMMZ7mKDe77kG4mU1ksV8PmYpsRHr5fnEw_D23ovdhav9TbrjG0';

export function usePushNotifications(userType, userId) {
  useEffect(() => {
    if (!userId || !('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const subscribe = async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        
        // Check if already subscribed
        let sub = await reg.pushManager.getSubscription();
        
        if (!sub) {
          // Request permission
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') return;

          // Subscribe
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
          });
        }

        // Save to server
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub, userType, userId }),
        });
      } catch(err) {
        console.error('Push subscription error:', err);
      }
    };

    subscribe();
  }, [userType, userId]);
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}
