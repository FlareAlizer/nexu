// Показ ошибок API: бэкенд отвечает {"error": "..."} по-русски.
import { ApiError } from "../../api/client";
import { alertDialog } from "../ui/dialogs";

export function showApiError(e: unknown): void {
  let msg = "Ошибка запроса";
  if (e instanceof ApiError) {
    try {
      msg = (JSON.parse(e.message) as { error?: string }).error ?? e.message;
    } catch {
      msg = e.message;
    }
  }
  void alertDialog(msg);
}
