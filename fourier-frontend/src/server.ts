import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { request as httpRequest } from 'node:http';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * Proxy /api requests to the backend (needed for SSR-side HttpClient calls).
 * Express strips the /api prefix in req.url, so we re-add it when forwarding.
 */
app.use('/api', (req, res) => {
  const backendReq = httpRequest(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api' + (req.url ?? ''),
      method: req.method,
      headers: { ...req.headers, host: 'localhost:3000' },
    },
    (backendRes) => {
      res.writeHead(backendRes.statusCode ?? 502, backendRes.headers);
      backendRes.pipe(res, { end: true });
    },
  );
  backendReq.on('error', () => res.status(502).end());
  req.pipe(backendReq, { end: true });
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 *
 * We override the Host header to 'localhost:4000' before handing the request
 * to Angular SSR. Angular resolves relative URLs (e.g. /api/auth/quota) against
 * the Host header. Without this, it would resolve them against the public domain
 * (fouriersolver.com), which Angular's SSRF protection then blocks. Localhost is
 * always allowed by SSRF, so the proxy above can forward the request normally.
 * SEO tags (canonical, hreflang) are built from environment.baseUrl, not from
 * the Host header, so they remain correct.
 */
app.use((req, res, next) => {
  req.headers['host'] = 'localhost:4000';
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
