import "./instrument.js"; // Sentry — до всего остального
import { createApp } from "./app.js";
import { config } from "./config.js";
import { startDeadlineReminders } from "./services/reminders.js";

createApp().listen(config.port, () => {
  console.log(`NEXU API on :${config.port}`);
});

// NOTIF-03: ежечасные напоминания о дедлайнах; без токена бота смысла нет
if (config.telegram.botToken) startDeadlineReminders();
