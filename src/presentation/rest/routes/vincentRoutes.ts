import express from "express";
import { AgentController } from "../controllers/AgentController.js";

/**
 * Create Vincent-specific routes (consent callbacks, etc.)
 * @param agentController Agent controller instance
 * @returns Express router configured with Vincent routes
 */
export function createVincentRoutes(agentController: AgentController): express.Router {
  const router = express.Router();

  // Vincent consent callback route
  router.get("/callback", async (req, res) => {
    try {
      // Extract JWT from query parameters
      const { jwt } = req.query;

      if (!jwt) {
        return res.status(400).send(`
          <html>
            <head><title>Vincent Consent - Error</title></head>
            <body>
              <h1>❌ Authorization Error</h1>
              <p>No JWT token received from Vincent consent flow.</p>
              <button onclick="window.close()">Close Window</button>
            </body>
          </html>
        `);
      }

      // In a real implementation, you would:
      // 1. Verify the JWT signature
      // 2. Extract user information and permissions
      // 3. Store the consent in your database
      // 4. Update the agent status

      // For demo purposes, we'll just set consent to true
      await agentController.setVincentConsent(
        {} as express.Request,
        {
          json: (data: any) => {
            console.log("Vincent consent granted:", data);
          }
        } as express.Response
      );

      // Return success page with auto-redirect
      res.send(`
        <html>
          <head>
            <title>Vincent Consent - Success</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                text-align: center;
                padding: 2rem;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                margin: 0;
              }
              .container {
                max-width: 500px;
                margin: 0 auto;
                background: rgba(255, 255, 255, 0.1);
                padding: 2rem;
                border-radius: 16px;
                backdrop-filter: blur(10px);
              }
              .success-icon { font-size: 4rem; margin-bottom: 1rem; }
              .countdown { font-size: 1.2rem; margin: 1rem 0; }
              button {
                background: linear-gradient(135deg, #10b981, #059669);
                border: none;
                border-radius: 8px;
                color: white;
                padding: 1rem 2rem;
                font-size: 1rem;
                cursor: pointer;
                margin: 0.5rem;
              }
              button:hover { background: linear-gradient(135deg, #059669, #047857); }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success-icon">✅</div>
              <h1>Vincent Authorization Successful!</h1>
              <p>Your Social Trading Agent has been authorized and is ready to trade.</p>
              <div class="countdown">Redirecting in <span id="countdown">5</span> seconds...</div>
              <button onclick="redirectNow()">Return to Dashboard</button>
              <button onclick="window.close()">Close Window</button>
            </div>

            <script>
              let countdown = 5;
              const countdownElement = document.getElementById('countdown');

              function redirectNow() {
                window.location.href = '${process.env.FRONTEND_URL || 'http://localhost:5173'}?tab=trading&vincent=authorized';
              }

              const timer = setInterval(() => {
                countdown--;
                countdownElement.textContent = countdown;
                if (countdown <= 0) {
                  clearInterval(timer);
                  redirectNow();
                }
              }, 1000);
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Vincent callback error:", error);
      res.status(500).send(`
        <html>
          <head><title>Vincent Consent - Error</title></head>
          <body>
            <h1>❌ Server Error</h1>
            <p>An error occurred while processing your authorization.</p>
            <button onclick="window.close()">Close Window</button>
          </body>
        </html>
      `);
    }
  });

  return router;
}
