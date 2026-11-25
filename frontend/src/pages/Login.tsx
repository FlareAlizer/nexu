// Вход: Telegram Login Widget (AUTH-01) + резервный email/пароль (AUTH-02).
// Виджет работает только с домена, привязанного к боту (/setdomain в BotFather), по HTTPS.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import Button from "../components/ui/Button";
import { Input, Label } from "../components/ui/Field";
import Panel from "../components/ui/Panel";
import { ErrorNote } from "../components/ui/States";
import TopBar from "../components/ui/TopBar";

const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME ?? "nexuu_school_bot";

declare global {
  interface Window {
    onTelegramAuth?: (user: Record<string, unknown>) => void;
  }
}

export default function Login() {
  const { user, ready, loginTelegram, loginEmail } = useAuth();
  const navigate = useNavigate();
  const widgetRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showEmail, setShowEmail] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (ready && user) navigate("/", { replace: true });
  }, [ready, user, navigate]);

  // Виджет вставляется скриптом; колбэк — глобальная функция
  useEffect(() => {
    window.onTelegramAuth = (data) => {
      loginTelegram(data).catch(() => setError("Не получилось войти через Telegram. Попробуй ещё раз."));
    };
    const container = widgetRef.current;
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write"); // разрешение боту писать — нужно для уведомлений
    container?.appendChild(script);
    return () => {
      delete window.onTelegramAuth;
      container?.replaceChildren();
    };
  }, [loginTelegram]);

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await loginEmail(email, password);
    } catch {
      setError("Неверный email или пароль.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar>
        {/* На телефоне форма ниже первого экрана — ведём к ней */}
        <Button
          variant="tinted"
          size="sm"
          className="lg:hidden"
          onClick={() => {
            panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            panelRef.current?.focus({ preventScroll: true });
          }}
        >
          Войти
        </Button>
      </TopBar>

      <main className="mx-auto grid w-full max-w-[1200px] flex-1 items-center gap-8 px-4 pb-12 pt-6 md:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:gap-14">
        <Crawl />

        <Panel
          as="section"
          ref={panelRef}
          tone="holo"
          pad="lg"
          tabIndex={-1}
          aria-labelledby="login-heading"
          className="mx-auto w-full max-w-md scroll-mt-20 space-y-5 outline-none"
        >
          <div>
            <p className="hud-label text-holo">Вход</p>
            <h2 id="login-heading" className="mt-2 font-display text-2xl font-semibold leading-tight">
              Вход для учеников и преподавателей
            </h2>
          </div>

          <div ref={widgetRef} className="flex min-h-[44px] justify-center" />

          <p className="text-sm text-ink-mute">
            Основной вход — через Telegram. Пароль для входа по email выдаёт администратор.
          </p>

          <Button
            variant="text"
            aria-expanded={showEmail}
            aria-controls="email-form"
            onClick={() => setShowEmail((v) => !v)}
          >
            Войти по email
          </Button>

          {showEmail && (
            <form id="email-form" onSubmit={submitEmail} className="space-y-3">
              <div>
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="login-password">Пароль</Label>
                <Input
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {/* кнопки ≥44px по высоте (п.4.3) */}
              <Button type="submit" block disabled={pending}>
                {pending ? "Входим…" : "Войти"}
              </Button>
            </form>
          )}

          {error && <ErrorNote>{error}</ErrorNote>}
        </Panel>
      </main>
    </div>
  );
}

// Вступительный текст в перспективе: строки поднимаются снизу и останавливаются.
// Анимация длится меньше 5 секунд и не зациклена — кнопка паузы не нужна (WCAG 2.2.2).
function Crawl() {
  return (
    <section
      aria-labelledby="crawl-title"
      className="mx-auto w-full max-w-[40rem] overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_28%)] [perspective:360px]"
    >
      <div className="origin-bottom px-3 [transform:rotateX(20deg)] md:px-8">
        <div className="animate-crawl-rise text-center text-crawl">
          <p className="font-display text-[clamp(0.9375rem,2.6vw,1.25rem)] font-semibold uppercase tracking-[0.3em]">
            Олимпиадная школа
          </p>
          <h1
            id="crawl-title"
            className="mt-2 font-display text-[clamp(4.5rem,21vw,10rem)] font-black leading-none tracking-[0.12em] [text-indent:0.12em]"
          >
            NEXU
          </h1>
          <div className="mt-4 space-y-4 text-[clamp(1.125rem,3.8vw,1.75rem)] font-bold leading-snug md:mt-6 md:space-y-5">
            <p>Уроки открываются по порядку. В каждом — видео, текст, задание или тест.</p>
            <p>Работы проверяет преподаватель и возвращает с комментариями.</p>
            <p>За просмотр, сдачу и тесты начисляется опыт: от юнлинга до магистра.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
