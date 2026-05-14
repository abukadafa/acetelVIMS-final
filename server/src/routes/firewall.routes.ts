import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { listBlockedIPs, listSuspects, blockIP, unblockIPHandler, firewallStats } from '../controllers/firewall.controller';

const r = Router();

// All firewall management is admin-only
r.use(authenticate, authorize('admin'));

r.get('/stats',          firewallStats);
r.get('/blocked',        listBlockedIPs);
r.get('/suspects',       listSuspects);
r.post('/block',         blockIP);
r.delete('/block/:ip',   unblockIPHandler);

export default r;
