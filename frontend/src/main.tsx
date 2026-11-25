import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";

import "./index.css";
import { AuthProvider } from "./auth/AuthContext";
import DialogHost from "./components/ui/DialogHost";
import Starfield, { triggerWarp } from "./components/ui/Starfield";
import { router } from "./router";

// Sentry (M6): включается только если задан VITE_SENTRY_DSN при сборке.
// Грузим отдельным чанком — без DSN ~100 КБ не поедут в браузер ученику.
// PII не шлём: пользователи несовершеннолетние.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  void import("@sentry/react").then((Sentry) => {
    Sentry.init({
      dsn: sentryDsn,
      environment: import.meta.env.MODE,
      sendDefaultPii: false,
      tracesSampleRate: 0.1,
    });
  });
}

const queryClient = new QueryClient();

// Смена экрана — короткий «гиперпрыжок» звёздного фона
let lastPath = router.state.location.pathname;
router.subscribe((state) => {
  if (state.location.pathname === lastPath) return;
  lastPath = state.location.pathname;
  triggerWarp();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Starfield />
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
    <DialogHost />
  </StrictMode>,
);
