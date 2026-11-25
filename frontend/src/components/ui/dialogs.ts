// Диалоги вместо браузерных alert/confirm/prompt: тот же порядок вызова, но в оформлении
// платформы. Функции возвращают промис; окно рисует <DialogHost /> (один на приложение).

export type DialogRequest =
  | { kind: "alert"; text: string; resolve: () => void }
  | { kind: "confirm"; text: string; resolve: (ok: boolean) => void }
  | { kind: "prompt"; text: string; initial: string; resolve: (value: string | null) => void };

let queue: DialogRequest[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function push(req: DialogRequest) {
  queue = [...queue, req];
  emit();
}

/** Подписка для useSyncExternalStore. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Текущий диалог — первый в очереди. */
export function currentDialog(): DialogRequest | null {
  return queue[0] ?? null;
}

/** Убрать показанный диалог из очереди (вызывает DialogHost после ответа). */
export function shiftDialog(): void {
  queue = queue.slice(1);
  emit();
}

/** Сообщение с кнопкой «Понятно». */
export function alertDialog(text: string): Promise<void> {
  return new Promise((resolve) => push({ kind: "alert", text, resolve }));
}

/** Вопрос «да/нет». false — отмена или Esc. */
export function confirmDialog(text: string): Promise<boolean> {
  return new Promise((resolve) => push({ kind: "confirm", text, resolve }));
}

/** Запрос строки. null — отмена или Esc. */
export function promptDialog(text: string, initial = ""): Promise<string | null> {
  return new Promise((resolve) => push({ kind: "prompt", text, initial, resolve }));
}
