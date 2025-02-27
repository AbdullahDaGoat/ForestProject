// Calculate distance between two points in km using the Haversine formula
export function calculateDistance(
    lat1: number, 
    lon1: number, 
    lat2: number, 
    lon2: number
  ): number {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const d = R * c; // Distance in km
    return d;
  }
  
  function deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }
  
  // Format the danger level for display
  export function formatDangerLevel(level: string): string {
    return level
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  // Get color based on danger level
  export function getDangerColor(level: string): string {
    switch(level) {
      case 'dangerous': return '#ff0000'; // Red
      case 'very high': return '#ff4500'; // OrangeRed
      case 'high': return '#ffa500';      // Orange
      case 'medium': return '#ffff00';    // Yellow
      case 'low': return '#adff2f';       // GreenYellow
      case 'normal': return '#00ff00';    // Green
      case 'no risk':
      default: return '#00bfff';          // DeepSkyBlue
    }
  }