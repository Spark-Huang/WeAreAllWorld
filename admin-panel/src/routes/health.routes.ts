import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      weareallworld: 'connected',
      newapi: 'connected',
      openclawHelm: 'ready'
    }
  });
});

export default router;