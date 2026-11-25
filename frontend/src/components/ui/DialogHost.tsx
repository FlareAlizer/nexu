// Окно для диалогов из dialogs.ts. Нативный <dialog>: фокус остаётся внутри, Esc закрывает.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import Button from "./Button";
import { currentDialog, shiftDialog, subscribe } from "./dialogs";
import { Input } from "./Field";

export default function DialogHost() {
  const req = useSyncExternalStore(subscribe, currentDialog);
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (req) {
      setValue(req.kind === "prompt" ? req.initial : "");
      if (!el.open) el.showModal();
      // Фокус ставим сами: в цепочке диалогов окно не закрывается, и браузер его не переносит
      if (req.kind === "prompt") {
        inputRef.current?.focus();
        inputRef.current?.select();
      } else {
        okRef.current?.focus();
      }
    } else if (el.open) {
      el.close();
    }
  }, [req]);

  /** Ответить на диалог: ok=false — отмена. */
  function answer(ok: boolean) {
    if (!req) return;
    if (req.kind === "alert") req.resolve();
    else if (req.kind === "confirm") req.resolve(ok);
    else req.resolve(ok ? value : null);
    shiftDialog();
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-text"
      className="m-auto w-[calc(100%-2rem)] max-w-md bg-transparent p-0 text-ink"
      onCancel={(e) => {
        e.preventDefault(); // Esc: отвечаем «отмена» и закрываем сами, чтобы очередь не разошлась с окном
        answer(false);
      }}
    >
      {req && (
        <form
          className="hud hud-holo space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            answer(true);
          }}
        >
          <p id="dialog-text" className="whitespace-pre-wrap break-words leading-relaxed">
            {req.text}
          </p>
          {req.kind === "prompt" && (
            <Input ref={inputRef} aria-labelledby="dialog-text" value={value} onChange={(e) => setValue(e.target.value)} />
          )}
          <div className="flex flex-wrap justify-end gap-3">
            {req.kind !== "alert" && (
              <Button variant="ghost" onClick={() => answer(false)}>
                Отмена
              </Button>
            )}
            <Button ref={okRef} type="submit">
              {req.kind === "alert" ? "Понятно" : req.kind === "confirm" ? "Да" : "Готово"}
            </Button>
          </div>
        </form>
      )}
    </dialog>
  );
}
