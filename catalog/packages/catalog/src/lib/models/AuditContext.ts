import { SvSecurityContext } from '@securustablets/libraries.httpsecurity';

export interface AuditContext extends SvSecurityContext {
  error?: any;
  reason?: any;
  source?: any;
  routingKey?: any;
}
