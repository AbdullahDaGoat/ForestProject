// Parse the push subscription object into a format the server can use
export function base64UrlToUint8Array(base64UrlData) {
    const padding = '='.repeat((4 - (base64UrlData.length % 4)) % 4);
    const base64 = (base64UrlData + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    const rawData = atob(base64);
    const buffer = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
      buffer[i] = rawData.charCodeAt(i);
    }
    
    return buffer;
  }
  
  // Generate VAPID keys for your application (run this once and save the keys)
  // This would normally be done on the server in a real application
export async function generateVAPIDKeys() {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        // This is only for demo purposes - in production you'd generate these server-side
        const keyPair = await window.crypto.subtle.generateKey(
          {
            name: 'ECDSA',
            namedCurve: 'P-256'
          },
          true,
          ['sign', 'verify']
        );
        
        // Export the keys
        const publicKey = await window.crypto.subtle.exportKey('raw', keyPair.publicKey);
        const privateKey = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
        
        // Convert to base64
        const publicKeyBase64 = btoa(String.fromCharCode.apply(null, new Uint8Array(publicKey)));
        const privateKeyBase64 = btoa(String.fromCharCode.apply(null, new Uint8Array(privateKey)));
        
        return {
          publicKey: publicKeyBase64,
          privateKey: privateKeyBase64
        };
      } catch (err) {
        console.error('Error generating VAPID keys:', err);
        return null;
      }
    }
    return null;
  }