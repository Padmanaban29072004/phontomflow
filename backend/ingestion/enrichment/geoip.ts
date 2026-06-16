import * as geoip from 'geoip-lite';
import { UnifiedEventSchema } from '../types';

export function enrichWithGeoIp(event: UnifiedEventSchema): UnifiedEventSchema {
  const lookup = geoip.lookup(event.src_ip);
  if (!lookup) {
    return event;
  }

  return {
    ...event,
    geo: {
      country: lookup.country,
      region: lookup.region,
      city: lookup.city,
      timezone: lookup.timezone,
      ll: lookup.ll,
    },
  };
}

